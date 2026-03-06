local cryptoData = {}
local isBusy = false

-- Helper function to find crypto by ID
local function findCryptoById(cryptoId)
    for i, crypto in ipairs(cryptoData) do
        if crypto.id == cryptoId then
            return i, crypto
        end
    end
    return false
end

-- QBit specific handler
local function handleQBitData()
    if not Config.Crypto.QBit or Config.Framework ~= "qb" then return end

    local qbitData = GetQBit()
    local priceHistory = {}

    -- Process price history if available
    for _, history in ipairs(qbitData.History) do
        table.insert(priceHistory, history.PreviousWorth)
        table.insert(priceHistory, history.NewWorth)
    end

    -- Generate random prices if no history exists
    if #qbitData.History == 0 then
        for i = 1, 10 do
            priceHistory[i] = qbitData.Worth + math.random(-10, 10)
        end
    end

    -- Calculate 24h change
    local change24h = 0
    if #qbitData.History > 0 then
        local first = qbitData.History[1].PreviousWorth
        local last = qbitData.History[#qbitData.History].NewWorth
        change24h = last - first
    end

    -- Update or create QBit entry
    local index = findCryptoById("qbit") or #cryptoData + 1
    cryptoData[index] = {
        id = "qbit",
        name = "QBit",
        symbol = "qbit",
        current_price = qbitData.Worth,
        change_24h = change24h,
        prices = priceHistory,
        owned = qbitData.Portfolio,
        image = "https://avatars.githubusercontent.com/u/81791099?s=200&v=4"
    }
end

-- Crypto transaction functions
local function buyCrypto(coinId, amount)
    local result
    if coinId == "qbit" and BuyQBit then
        result = BuyQBit(amount)
    else
        result = AwaitCallback("crypto:buy", coinId, amount)
    end

    isBusy = false
    if not result.success then return result end

    local _, crypto = findCryptoById(coinId)
    if not crypto then return result end

    crypto.owned = (crypto.owned or 0) + (amount / crypto.current_price)
    crypto.invested = (crypto.invested or 0) + amount
    return result
end

local function sellCrypto(coinId, amount)
    local result
    if coinId == "qbit" and SellQBit then
        result = SellQBit(amount)
    else
        result = AwaitCallback("crypto:sell", coinId, amount)
    end

    isBusy = false
    if not result.success then return result end

    local _, crypto = findCryptoById(coinId)
    if not crypto or not crypto.invested or not crypto.owned then return result end

    crypto.invested = crypto.invested - (amount * crypto.current_price)
    crypto.owned = crypto.owned - amount
    return result
end

local function transferCrypto(coinId, amount, targetNumber)
    local result
    if coinId == "qbit" and TransferQBit then
        result = TransferQBit(amount)
    else
        result = AwaitCallback("crypto:transfer", coinId, amount, targetNumber)
    end

    isBusy = false
    if not result.success then return result end

    local _, crypto = findCryptoById(coinId)
    if not crypto or not crypto.invested or not crypto.owned then return result end

    crypto.invested = crypto.invested - (amount * crypto.current_price)
    crypto.owned = crypto.owned - amount
    return result
end

-- NUI Callback handler
RegisterNUICallback("Crypto", function(data, callback)
    local action = data.action
    debugprint("Crypto:" .. (action or ""))

    -- Handle busy state for transactions
    if action == "buy" or action == "sell" or action == "transfer" then
        if isBusy then
            return callback({ success = false, msg = "BUSY" })
        end
        isBusy = true
    end

    if action == "buy" then
        callback(buyCrypto(data.coin, data.amount))
    elseif action == "sell" then
        callback(sellCrypto(data.coin, data.amount))
    elseif action == "transfer" then
        callback(transferCrypto(data.coin, data.amount, data.number))
    elseif action == "get" then
        handleQBitData()
        callback(cryptoData)
    end
end)

-- Initialize crypto data
CreateThread(function()
    while not FrameworkLoaded do
        Wait(0)
    end

    local coins = AwaitCallback("crypto:get")
    cryptoData = {}

    for _, coin in pairs(coins) do
        table.insert(cryptoData, coin)
    end

    debugprint("fetched coins")
end)

-- Event handlers
RegisterNetEvent("phone:crypto:updateCoins", function(updatedCoins)
    -- Update existing coins
    for _, crypto in ipairs(cryptoData) do
        local update = updatedCoins[crypto.id]
        if update then
            crypto.current_price = update.current_price
            crypto.change_24h = update.change_24h
            crypto.prices = update.prices
        end
    end

    -- Add new coins
    for coinId, coinData in pairs(updatedCoins) do
        if not findCryptoById(coinId) then
            table.insert(cryptoData, coinData)
        end
    end

    debugprint("updated crypto cache")
    SendReactMessage("crypto:updateCoins", cryptoData)
end)

RegisterNetEvent("phone:crypto:changeOwnedAmount", function(coinId, amount)
    local _, crypto = findCryptoById(coinId)
    if not crypto then return end

    crypto.owned = (crypto.owned or 0) + amount
    debugprint("updated crypto cache", coinId, amount, crypto.owned)
    SendReactMessage("crypto:updateCoins", cryptoData)
end)

-- Exports
exports("GetCoinValue", function(coinId)
    local _, crypto = findCryptoById(coinId)
    return crypto and crypto.current_price
end)

exports("GetCryptoWallet", function()
    return cryptoData
end)

exports("GetOwnedCoin", function(coinId)
    local _, crypto = findCryptoById(coinId)
    return crypto
end)
