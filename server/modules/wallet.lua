-- Creado/Modificado por JericoFX

local function SafeString(value, maxLen)
    if type(value) ~= 'string' then return nil end
    local trimmed = value:gsub('%s+', ' '):gsub('^%s+', ''):gsub('%s+$', '')
    if trimmed == '' then return nil end
    if maxLen and #trimmed > maxLen then
        trimmed = trimmed:sub(1, maxLen)
    end
    return trimmed
end

local function SafeNumber(value, min, max)
    local num = tonumber(value)
    if not num then return nil end
    if min and num < min then num = min end
    if max and num > max then num = max end
    return num
end

local function EnsureWallet(identifier)
    local wallet = MySQL.single.await('SELECT id, balance FROM phone_wallets WHERE identifier = ? LIMIT 1', { identifier })
    if wallet then return wallet end

    local initial = SafeNumber(Config.Wallet and Config.Wallet.InitialBalance or nil, 0, 999999999) or 2500
    local walletId = MySQL.insert.await('INSERT INTO phone_wallets (identifier, balance) VALUES (?, ?)', { identifier, initial })
    return {
        id = walletId,
        balance = initial,
    }
end

local function ResolveTargetByPhone(phoneNumber)
    local receiverIdentifier = GetIdentifierByPhone(phoneNumber)
    if not receiverIdentifier then return nil, nil end
    return receiverIdentifier, GetSourceFromIdentifier(receiverIdentifier)
end

local function GetPlayerCoordsSafe(source)
    if not source or source <= 0 then return nil end
    local ped = GetPlayerPed(source)
    if not ped or ped <= 0 then return nil end
    local coords = GetEntityCoords(ped)
    if not coords then return nil end
    return vector3(coords.x + 0.0, coords.y + 0.0, coords.z + 0.0)
end

local function IsWithinDistance(sourceA, sourceB, maxDistance)
    local coordsA = GetPlayerCoordsSafe(sourceA)
    local coordsB = GetPlayerCoordsSafe(sourceB)
    if not coordsA or not coordsB then return false, nil end
    local distance = #(coordsA - coordsB)
    local limit = SafeNumber(maxDistance, 1.0, 10.0) or 3.0
    return distance <= limit, distance
end

local function PushWalletNotification(targetSource, title, message)
    if not targetSource or targetSource <= 0 then return end
    TriggerClientEvent('gcphone:notify', targetSource, {
        appId = 'wallet',
        title = title,
        message = message,
        priority = 'normal'
    })
end

local function ExecuteWalletTransfer(senderIdentifier, receiverIdentifier, targetPhone, amount, title)
    local senderWallet = EnsureWallet(senderIdentifier)
    local senderBalance = tonumber(senderWallet.balance) or 0
    if senderBalance < amount then
        return false, { error = 'INSUFFICIENT_FUNDS' }
    end

    local receiverWallet = EnsureWallet(receiverIdentifier)

    MySQL.transaction.await({
        {
            query = 'UPDATE phone_wallets SET balance = balance - ? WHERE id = ?',
            values = { amount, senderWallet.id }
        },
        {
            query = 'UPDATE phone_wallets SET balance = balance + ? WHERE id = ?',
            values = { amount, receiverWallet.id }
        },
        {
            query = 'INSERT INTO phone_wallet_transactions (identifier, amount, type, title, target_phone) VALUES (?, ?, ?, ?, ?)',
            values = { senderIdentifier, amount, 'out', title, targetPhone }
        },
        {
            query = 'INSERT INTO phone_wallet_transactions (identifier, amount, type, title, target_phone) VALUES (?, ?, ?, ?, ?)',
            values = { receiverIdentifier, amount, 'in', title, targetPhone }
        },
    })

    local updated = MySQL.scalar.await('SELECT balance FROM phone_wallets WHERE id = ? LIMIT 1', { senderWallet.id })
    return true, {
        balance = tonumber(updated) or 0,
    }
end

lib.callback.register('gcphone:wallet:getState', function(source)
    local identifier = GetIdentifier(source)
    if not identifier then
        return {
            balance = 0,
            cards = {},
            transactions = {},
        }
    end

    local wallet = EnsureWallet(identifier)
    local cards = MySQL.query.await(
        'SELECT id, label, last4, color, created_at FROM phone_wallet_cards WHERE identifier = ? ORDER BY id DESC',
        { identifier }
    ) or {}

    local tx = MySQL.query.await(
        'SELECT id, amount, type, title, target_phone, created_at FROM phone_wallet_transactions WHERE identifier = ? ORDER BY id DESC LIMIT 60',
        { identifier }
    ) or {}

    return {
        balance = tonumber(wallet.balance) or 0,
        cards = cards,
        transactions = tx,
    }
end)

lib.callback.register('gcphone:wallet:addCard', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return { success = false, error = 'INVALID_SOURCE' } end

    local label = SafeString(type(data) == 'table' and data.label or nil, 32)
    local last4 = SafeString(type(data) == 'table' and data.last4 or nil, 4)
    local color = SafeString(type(data) == 'table' and data.color or nil, 20) or '#2E3B57'

    if not label or not last4 or not last4:match('^%d%d%d%d$') then
        return { success = false, error = 'INVALID_CARD' }
    end

    MySQL.insert.await(
        'INSERT INTO phone_wallet_cards (identifier, label, last4, color) VALUES (?, ?, ?, ?)',
        { identifier, label, last4, color }
    )

    return { success = true }
end)

lib.callback.register('gcphone:wallet:removeCard', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return { success = false, error = 'INVALID_SOURCE' } end
    local cardId = tonumber(type(data) == 'table' and data.cardId or nil)
    if not cardId then return { success = false, error = 'INVALID_CARD' } end

    MySQL.update.await('DELETE FROM phone_wallet_cards WHERE id = ? AND identifier = ?', { cardId, identifier })
    return { success = true }
end)

lib.callback.register('gcphone:wallet:transfer', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return { success = false, error = 'INVALID_SOURCE' } end
    if type(data) ~= 'table' then return { success = false, error = 'INVALID_DATA' } end

    local targetPhone = SafeString(data.targetPhone, 20)
    local title = SafeString(data.title, 64) or 'Transferencia'
    local amount = SafeNumber(data.amount, 1, Config.Wallet and Config.Wallet.MaxTransferAmount or 500000)

    if not targetPhone or not amount then
        return { success = false, error = 'INVALID_TRANSFER' }
    end

    local receiverIdentifier = GetIdentifierByPhone(targetPhone)
    if not receiverIdentifier then
        return { success = false, error = 'TARGET_NOT_FOUND' }
    end

    local success, transferPayload = ExecuteWalletTransfer(identifier, receiverIdentifier, targetPhone, amount, title)
    if not success then
        return { success = false, error = transferPayload.error or 'TRANSFER_FAILED' }
    end

    local receiverSource = GetSourceFromIdentifier(receiverIdentifier)
    if receiverSource then
        PushWalletNotification(receiverSource, 'Wallet', ('Recibiste $%s'):format(math.floor(amount)))
    end

    return {
        success = true,
        balance = transferPayload.balance,
    }
end)

lib.callback.register('gcphone:wallet:proximityTransfer', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return { success = false, error = 'INVALID_SOURCE' } end
    if type(data) ~= 'table' then return { success = false, error = 'INVALID_DATA' } end

    local targetPhone = SafeString(data.targetPhone, 20)
    local title = SafeString(data.title, 64) or 'Pago QR/NFC'
    local amount = SafeNumber(data.amount, 1, Config.Wallet and Config.Wallet.MaxTransferAmount or 500000)
    local method = SafeString(data.method, 8) or 'qr'
    if method ~= 'qr' and method ~= 'nfc' then method = 'qr' end

    if not targetPhone or not amount then
        return { success = false, error = 'INVALID_TRANSFER' }
    end

    local receiverIdentifier, receiverSource = ResolveTargetByPhone(targetPhone)
    if not receiverIdentifier or not receiverSource then
        return { success = false, error = 'TARGET_OFFLINE' }
    end

    if receiverIdentifier == identifier then
        return { success = false, error = 'INVALID_TARGET' }
    end

    local distanceLimit = SafeNumber(Config.Wallet and Config.Wallet.ProximityDistance or nil, 1.0, 10.0) or 3.0
    local near, distance = IsWithinDistance(source, receiverSource, distanceLimit)
    if not near then
        return {
            success = false,
            error = 'TOO_FAR',
            distance = distance and math.floor(distance * 100) / 100 or nil,
            maxDistance = distanceLimit,
        }
    end

    local success, transferPayload = ExecuteWalletTransfer(identifier, receiverIdentifier, targetPhone, amount, title)
    if not success then
        return { success = false, error = transferPayload.error or 'TRANSFER_FAILED' }
    end

    PushWalletNotification(source, 'Wallet', ('Pago %s enviado: $%s'):format(method:upper(), math.floor(amount)))
    PushWalletNotification(receiverSource, 'Wallet', ('Recibiste pago %s: $%s'):format(method:upper(), math.floor(amount)))

    return {
        success = true,
        balance = transferPayload.balance,
        method = method,
        distance = distance and math.floor(distance * 100) / 100 or nil,
    }
end)

exports('CanUseProximityPayment', function(source, targetSource, maxDistance)
    source = tonumber(source)
    targetSource = tonumber(targetSource)
    if not source or source <= 0 or not targetSource or targetSource <= 0 then
        return false, 'INVALID_SOURCE', nil
    end

    local near, distance = IsWithinDistance(source, targetSource, maxDistance or (Config.Wallet and Config.Wallet.ProximityDistance) or 3.0)
    if not near then
        return false, 'TOO_FAR', distance
    end

    return true, nil, distance
end)

exports('ProximityTransfer', function(source, targetSource, amount, title, method)
    source = tonumber(source)
    targetSource = tonumber(targetSource)
    local amountValue = SafeNumber(amount, 1, Config.Wallet and Config.Wallet.MaxTransferAmount or 500000)
    local transferTitle = SafeString(title, 64) or 'Pago QR/NFC'
    local transferMethod = SafeString(method, 8) or 'qr'
    if transferMethod ~= 'qr' and transferMethod ~= 'nfc' then transferMethod = 'qr' end

    if not source or source <= 0 or not targetSource or targetSource <= 0 then
        return { success = false, error = 'INVALID_SOURCE' }
    end

    if not amountValue then
        return { success = false, error = 'INVALID_AMOUNT' }
    end

    local sourceIdentifier = GetIdentifier(source)
    local targetIdentifier = GetIdentifier(targetSource)
    if not sourceIdentifier or not targetIdentifier then
        return { success = false, error = 'TARGET_OFFLINE' }
    end

    if sourceIdentifier == targetIdentifier then
        return { success = false, error = 'INVALID_TARGET' }
    end

    local near, distance = IsWithinDistance(source, targetSource, Config.Wallet and Config.Wallet.ProximityDistance or 3.0)
    if not near then
        return { success = false, error = 'TOO_FAR', distance = distance }
    end

    local targetPhone = GetPhoneNumber(targetIdentifier)
    if not targetPhone then
        return { success = false, error = 'TARGET_NOT_FOUND' }
    end

    local success, transferPayload = ExecuteWalletTransfer(sourceIdentifier, targetIdentifier, targetPhone, amountValue, transferTitle)
    if not success then
        return { success = false, error = transferPayload.error or 'TRANSFER_FAILED' }
    end

    PushWalletNotification(source, 'Wallet', ('Pago %s enviado: $%s'):format(transferMethod:upper(), math.floor(amountValue)))
    PushWalletNotification(targetSource, 'Wallet', ('Recibiste pago %s: $%s'):format(transferMethod:upper(), math.floor(amountValue)))

    return {
        success = true,
        balance = transferPayload.balance,
        method = transferMethod,
        distance = distance,
    }
end)
