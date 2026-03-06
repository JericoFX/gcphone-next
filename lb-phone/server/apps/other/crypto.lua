local Config = Config.Crypto
if not Config or not Config.Enabled then
    debugprint("crypto disabled")
    return
end

local Limits = Config.Limits or { Buy = 1000000, Sell = 1000000 }
local requestCount = 0

local fetchAttempts = 0

-- Função para realizar requisição à API
function FetchCryptoData(endpoint)
    if fetchAttempts >= 5 then
        return false
    end

    fetchAttempts = fetchAttempts + 1
    SetTimeout(60000, function() fetchAttempts = fetchAttempts - 1 end)

    local promise = promise.new()

    -- Constrói a URL da requisição
    local url = "https://api.coingecko.com/api/v3/" .. endpoint
    -- Realiza a requisição HTTP
    PerformHttpRequest(url, function(_, response)
        local success = false
        local data = json.decode(response)
        if data then
            promise:resolve(data)
        end
    end, "GET", "", { ["Content-Type"] = "application/json" })

    -- Aguarda o resultado da requisição
    return Citizen.Await(promise)
end

-- Controle de moedas
local CryptoData = { hasFetched = false, coins = {}, customCoins = {} }

-- Atualiza a lista de moedas com dados obtidos da API ou cache
function UpdateCryptoCoins()
    local lastFetched = GetResourceKvpInt("lb-phone:crypto:lastFetched") or 0
    local currentTime = os.time()
    local refreshInterval = Config.Refresh / 1000

    if currentTime - lastFetched > refreshInterval then
        local cachedCoins = GetResourceKvpString("lb-phone:crypto:coins")
        if cachedCoins then
            CryptoData.coins = json.decode(cachedCoins)
            -- Atualiza moedas personalizadas
            for id, coin in pairs(CryptoData.customCoins) do
                CryptoData.coins[id] = coin
            end
            debugprint("crypto: using kvp cache")
            return
        end

        -- Requisição para obter dados atualizados da API
        local coins = FetchCryptoData("coins/markets?vs_currency=" ..
        Config.Currency ..
        "&sparkline=true&order=market_cap_desc&precision=full&per_page=100&page=1&ids=" ..
        table.concat(Config.Crypto.Coins, ","))
        if coins then
            for _, coin in ipairs(coins) do
                CryptoData.coins[coin.id] = {
                    id = coin.id,
                    name = coin.name,
                    symbol = coin.symbol,
                    image = coin.image,
                    current_price = coin.current_price,
                    prices = coin.sparkline_in_7d.price,
                    change_24h = coin.price_change_percentage_24h
                }
            end
            SetResourceKvpInt("lb-phone:crypto:lastFetched", currentTime)
            SetResourceKvp("lb-phone:crypto:coins", json.encode(CryptoData.coins))
            debugprint("fetched coins")
        else
            debugprint("failed to fetch coins")
        end
    end
end

-- Inicia a atualização das moedas periodicamente
CreateThread(function()
    while true do
        UpdateCryptoCoins()
        CryptoData.hasFetched = true
        TriggerClientEvent("phone:crypto:updateCoins", -1, CryptoData.coins)
        Wait(Config.Refresh)
    end
end)


-- Database operations
local function updateCryptoBalance(identifier, coin, amount, invested)
    MySQL.update.await(
        "INSERT INTO phone_crypto (id, coin, amount, invested) VALUES (?, ?, ?, ?) " ..
        "ON DUPLICATE KEY UPDATE amount = amount + VALUES(amount), invested = invested + VALUES(invested)",
        { identifier, coin, amount, invested or 0 }
    )
end

-- Callbacks
RegisterCallback("crypto:get", function(source)
    local identifier = GetIdentifier(source)

    -- Wait for initial data fetch
    while not CryptoData.hasFetched do
        Wait(0)
    end

    -- Get player's crypto holdings
    local holdings = MySQL.query.await(
        "SELECT coin, amount, invested FROM phone_crypto WHERE id = ?",
        { identifier }
    )

    -- Create a copy of the coin data
    local coinData = table.deep_clone(CryptoData.coins)

    -- Add player's holdings to the data
    for _, holding in ipairs(holdings) do
        if holding and coinData[holding.coin] then
            coinData[holding.coin].owned = holding.amount
            coinData[holding.coin].invested = holding.invested
        end
    end

    return coinData
end)

RegisterCallback("crypto:buy", function(source, coin, amount)
    local identifier = GetIdentifier(source)
    local balance = GetBalance(source)

    -- Validate the transaction
    if amount <= 0 or amount > Limits.Buy or amount > balance then
        return {
            success = false,
            msg = amount <= 0 and "INVALID_AMOUNT" or
                amount > Limits.Buy and "INVALID_AMOUNT" or "NO_MONEY"
        }
    end

    local coinData = CryptoData.coins[coin]
    if not coinData or not identifier then
        return { success = false, msg = coinData and "NO_IDENTIFIER" or "INVALID_COIN" }
    end

    -- Calculate the amount of coins to buy
    local coinAmount = amount / coinData.current_price

    -- Update database and player balance
    updateCryptoBalance(identifier, coin, coinAmount, amount)
    RemoveMoney(source, amount)

    -- Log the transaction
    Log("Crypto", source, "success",
        L("BACKEND.LOGS.BOUGHT_CRYPTO"),
        L("BACKEND.LOGS.CRYPTO_DETAILS", {
            coin = coin,
            amount = coinAmount,
            price = amount
        })
    )

    return { success = true }
end)

RegisterCallback("crypto:sell", function(source, coin, amount)
    local identifier = GetIdentifier(source)

    if amount <= 0 then
        return { success = false, msg = "INVALID_AMOUNT" }
    end

    -- Get player's holdings for this coin
    local holding = MySQL.single.await(
        "SELECT amount, invested FROM phone_crypto WHERE id = ? AND coin = ?",
        { identifier, coin }
    )

    if not holding or amount > holding.amount then
        return { success = false, msg = holding and "NOT_ENOUGH_COINS" or "NO_COINS" }
    end

    local coinData = CryptoData.coins[coin]
    if not coinData then
        return { success = false, msg = "INVALID_COIN" }
    end

    -- Calculate the sale value
    local saleValue = amount * coinData.current_price

    if saleValue > Limits.Sell then
        debugprint(saleValue .. " is above crypto sell limit")
        return { success = false, msg = "INVALID_AMOUNT" }
    end

    -- Update database and player balance
    MySQL.update.await(
        "UPDATE phone_crypto SET amount = amount - ?, invested = invested - ? WHERE id = ? AND coin = ?",
        { amount, saleValue, identifier, coin }
    )

    AddMoney(source, saleValue)

    -- Log the transaction
    Log("Crypto", source, "error",
        L("BACKEND.LOGS.SOLD_CRYPTO"),
        L("BACKEND.LOGS.CRYPTO_DETAILS", {
            coin = coin,
            amount = amount,
            price = saleValue
        })
    )

    return { success = true }
end)

RegisterCallback("crypto:transfer", function(source, name, coin, amount, phoneNumber)
    local coinData = CryptoData.coins[coin]
    if not coinData then
        return { success = false, msg = "INVALID_COIN" }
    end

    -- Find the recipient
    local recipientSrc = GetSourceFromNumber(phoneNumber)
    local recipientId

    if recipientSrc then
        recipientId = GetIdentifier(recipientSrc)
    else
        local column = Config.Item.Unique and "owned_id" or "id"
        recipientId = MySQL.scalar.await(
            "SELECT " .. column .. " FROM phone_phones WHERE phone_number = ?",
            { phoneNumber }
        )
    end

    if not recipientId then
        return { success = false, msg = "INVALID_NUMBER" }
    end

    local senderId = GetIdentifier(source)
    if amount <= 0 then
        return { success = false, msg = "INVALID_AMOUNT" }
    end

    -- Check sender's balance
    local senderAmount = MySQL.scalar.await(
        "SELECT amount FROM phone_crypto WHERE id = ? AND coin = ?",
        { senderId, coin }
    ) or 0

    if amount > senderAmount then
        return { success = false, msg = "INVALID_AMOUNT" }
    end

    -- Process the transfer
    MySQL.update.await(
        "UPDATE phone_crypto SET amount = amount - ? WHERE id = ? AND coin = ?",
        { amount, senderId, coin }
    )

    updateCryptoBalance(recipientId, coin, amount)

    -- Notify the recipient
    SendNotification(phoneNumber, {
        app = "Crypto",
        title = L("BACKEND.CRYPTO.RECEIVED_TRANSFER_TITLE", { coin = coinData.name }),
        content = L("BACKEND.CRYPTO.RECEIVED_TRANSFER_DESCRIPTION", {
            amount = amount,
            coin = coinData.name,
            value = math.floor(amount * coinData.current_price + 0.5)
        })
    })

    -- Log the transaction
    Log("Crypto", source, "error",
        L("BACKEND.LOGS.TRANSFERRED_CRYPTO"),
        L("BACKEND.LOGS.TRANSFERRED_CRYPTO_DETAILS", {
            coin = coin,
            amount = amount,
            to = phoneNumber,
            from = name
        })
    )

    -- Update recipient's client if online
    if recipientSrc then
        TriggerClientEvent("phone:crypto:changeOwnedAmount", recipientSrc, coin, amount)
    end

    return { success = true }
end)

-- Exports
exports("AddCrypto", function(source, coin, amount)
    local identifier = GetIdentifier(source)

    if not CryptoData.coins[coin] then
        print("invalid coin", coin)
        return false
    end

    if not identifier then
        print("no identifier")
        return false
    end

    updateCryptoBalance(identifier, coin, amount)
    TriggerClientEvent("phone:crypto:changeOwnedAmount", source, coin, amount)

    return true
end)

exports("RemoveCrypto", function(source, coin, amount)
    local identifier = GetIdentifier(source)

    if not CryptoData.coins[coin] then
        print("invalid coin", coin)
        return false
    end

    if not identifier then
        print("no identifier")
        return false
    end

    MySQL.Async.execute(
        "UPDATE phone_crypto SET amount = amount - ? WHERE id = ? AND coin = ?",
        { amount, identifier, coin }
    )

    TriggerClientEvent("phone:crypto:changeOwnedAmount", source, coin, -amount)

    return true
end)

exports("AddCustomCoin", function(id, name, symbol, image, currentPrice, prices, change24h)
    -- Validate input
    assert(type(id) == "string", "id must be a string")
    assert(type(name) == "string", "name must be a string")
    assert(type(symbol) == "string", "symbol must be a string")
    assert(type(image) == "string", "image must be a string")
    assert(type(currentPrice) == "number", "currentPrice must be a number")
    assert(type(prices) == "table", "prices must be a table")
    assert(type(change24h) == "number", "change24h must be a number")

    -- Create the custom coin
    local customCoin = {
        id = id,
        name = name,
        symbol = symbol,
        image = image,
        current_price = currentPrice,
        prices = prices,
        change_24h = change24h
    }

    -- Add to data stores
    CryptoData.customCoins[id] = customCoin
    CryptoData.coins[id] = customCoin

    -- Update cache and notify clients
    SetResourceKvp("lb-phone:crypto:coins", json.encode(CryptoData.coins))
    TriggerClientEvent("phone:crypto:updateCoins", -1, CryptoData.coins)
end)

exports("GetCoin", function(coinId)
    return CryptoData.coins[coinId]
end)
