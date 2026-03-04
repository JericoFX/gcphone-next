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

local SecurityResource = GetCurrentResourceName()

local function HitRateLimit(source, key, windowMs, maxHits)
    local ok, blocked = pcall(function()
        return exports[SecurityResource]:HitRateLimit(source, key, windowMs, maxHits)
    end)
    if not ok then return false end
    return blocked == true
end

local function EnsureWalletTables()
    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS `phone_wallet_requests` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `requester_identifier` VARCHAR(64) NOT NULL,
            `requester_phone` VARCHAR(20) NOT NULL,
            `target_identifier` VARCHAR(64) NOT NULL,
            `target_phone` VARCHAR(20) NOT NULL,
            `amount` DECIMAL(12,2) NOT NULL,
            `title` VARCHAR(64) DEFAULT NULL,
            `method` ENUM('qr','nfc') NOT NULL DEFAULT 'qr',
            `status` ENUM('pending','accepted','declined','expired','cancelled') NOT NULL DEFAULT 'pending',
            `expires_at` TIMESTAMP NOT NULL,
            `responded_at` TIMESTAMP NULL DEFAULT NULL,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            KEY `idx_wallet_requests_target` (`target_identifier`, `status`, `expires_at`),
            KEY `idx_wallet_requests_requester` (`requester_identifier`, `status`),
            KEY `idx_wallet_requests_expires` (`expires_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ]])
end

CreateThread(function()
    EnsureWalletTables()
end)

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

local function BuildWalletRequestPayload(row)
    if type(row) ~= 'table' then return nil end
    return {
        id = tonumber(row.id) or 0,
        requesterIdentifier = row.requester_identifier,
        requesterPhone = row.requester_phone,
        targetIdentifier = row.target_identifier,
        targetPhone = row.target_phone,
        amount = tonumber(row.amount) or 0,
        title = row.title,
        method = row.method,
        status = row.status,
        expiresAt = row.expires_at,
        createdAt = row.created_at,
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

    local walletMs = (Config.Security and Config.Security.RateLimits and Config.Security.RateLimits.wallet) or 900
    if HitRateLimit(source, 'wallet_transfer', walletMs, 1) then
        return { success = false, error = 'RATE_LIMITED' }
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

    local walletMs = (Config.Security and Config.Security.RateLimits and Config.Security.RateLimits.wallet) or 900
    if HitRateLimit(source, 'wallet_proximity_transfer', walletMs, 1) then
        return { success = false, error = 'RATE_LIMITED' }
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

lib.callback.register('gcphone:wallet:createRequest', function(source, data)
    local requesterIdentifier = GetIdentifier(source)
    if not requesterIdentifier then return { success = false, error = 'INVALID_SOURCE' } end
    if type(data) ~= 'table' then return { success = false, error = 'INVALID_DATA' } end

    local targetPhone = SafeString(data.targetPhone, 20)
    local title = SafeString(data.title, 64) or 'Solicitud QR/NFC'
    local amount = SafeNumber(data.amount, 1, Config.Wallet and Config.Wallet.MaxTransferAmount or 500000)
    local method = SafeString(data.method, 8) or 'qr'
    if method ~= 'qr' and method ~= 'nfc' then method = 'qr' end
    if not targetPhone or not amount then
        return { success = false, error = 'INVALID_REQUEST' }
    end

    local requestMs = (Config.Security and Config.Security.RateLimits and Config.Security.RateLimits.walletRequest) or 1300
    if HitRateLimit(source, 'wallet_create_request', requestMs, 1) then
        return { success = false, error = 'RATE_LIMITED' }
    end

    local targetIdentifier, targetSource = ResolveTargetByPhone(targetPhone)
    if not targetIdentifier or not targetSource then
        return { success = false, error = 'TARGET_OFFLINE' }
    end
    if targetIdentifier == requesterIdentifier then
        return { success = false, error = 'INVALID_TARGET' }
    end

    local requesterPhone = GetPhoneNumber(requesterIdentifier)
    if not requesterPhone then
        return { success = false, error = 'INVALID_SOURCE' }
    end

    local distanceLimit = SafeNumber(Config.Wallet and Config.Wallet.ProximityDistance or nil, 1.0, 10.0) or 3.0
    local near, distance = IsWithinDistance(source, targetSource, distanceLimit)
    if not near then
        return {
            success = false,
            error = 'TOO_FAR',
            distance = distance and math.floor(distance * 100) / 100 or nil,
            maxDistance = distanceLimit,
        }
    end

    local ttlSeconds = SafeNumber(Config.Wallet and Config.Wallet.RequestTtlSeconds or nil, 15, 300) or 60
    local requestId = MySQL.insert.await(
        'INSERT INTO phone_wallet_requests (requester_identifier, requester_phone, target_identifier, target_phone, amount, title, method, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))',
        { requesterIdentifier, requesterPhone, targetIdentifier, targetPhone, amount, title, method, ttlSeconds }
    )

    PushWalletNotification(targetSource, 'Wallet', ('Solicitud %s: $%s desde %s'):format(method:upper(), math.floor(amount), requesterPhone))

    local payload = MySQL.single.await('SELECT * FROM phone_wallet_requests WHERE id = ? LIMIT 1', { requestId })
    return { success = true, request = BuildWalletRequestPayload(payload) }
end)

lib.callback.register('gcphone:wallet:getPendingRequests', function(source)
    local identifier = GetIdentifier(source)
    if not identifier then return { incoming = {}, outgoing = {} } end

    MySQL.update.await('UPDATE phone_wallet_requests SET status = "expired", responded_at = NOW() WHERE status = "pending" AND expires_at < NOW()')

    local incoming = MySQL.query.await(
        'SELECT * FROM phone_wallet_requests WHERE target_identifier = ? AND status = "pending" AND expires_at >= NOW() ORDER BY created_at DESC LIMIT 30',
        { identifier }
    ) or {}

    local outgoing = MySQL.query.await(
        'SELECT * FROM phone_wallet_requests WHERE requester_identifier = ? AND status = "pending" AND expires_at >= NOW() ORDER BY created_at DESC LIMIT 30',
        { identifier }
    ) or {}

    local incomingPayload = {}
    for _, row in ipairs(incoming) do
        incomingPayload[#incomingPayload + 1] = BuildWalletRequestPayload(row)
    end

    local outgoingPayload = {}
    for _, row in ipairs(outgoing) do
        outgoingPayload[#outgoingPayload + 1] = BuildWalletRequestPayload(row)
    end

    return {
        incoming = incomingPayload,
        outgoing = outgoingPayload,
    }
end)

lib.callback.register('gcphone:wallet:respondRequest', function(source, data)
    local responderIdentifier = GetIdentifier(source)
    if not responderIdentifier then return { success = false, error = 'INVALID_SOURCE' } end
    if type(data) ~= 'table' then return { success = false, error = 'INVALID_DATA' } end

    local requestId = tonumber(data.requestId)
    local accept = data.accept == true
    if not requestId or requestId < 1 then
        return { success = false, error = 'INVALID_REQUEST' }
    end

    local row = MySQL.single.await('SELECT * FROM phone_wallet_requests WHERE id = ? LIMIT 1', { requestId })
    if not row then return { success = false, error = 'REQUEST_NOT_FOUND' } end
    if row.target_identifier ~= responderIdentifier then return { success = false, error = 'NOT_AUTHORIZED' } end
    if row.status ~= 'pending' then return { success = false, error = 'REQUEST_ALREADY_HANDLED' } end

    if not accept then
        MySQL.update.await('UPDATE phone_wallet_requests SET status = "declined", responded_at = NOW() WHERE id = ? AND status = "pending"', { requestId })
        local requesterSource = GetSourceFromIdentifier(row.requester_identifier)
        if requesterSource then
            PushWalletNotification(requesterSource, 'Wallet', 'Solicitud rechazada')
        end
        return { success = true, status = 'declined' }
    end

    local requesterSource = GetSourceFromIdentifier(row.requester_identifier)
    if not requesterSource then
        MySQL.update.await('UPDATE phone_wallet_requests SET status = "expired", responded_at = NOW() WHERE id = ? AND status = "pending"', { requestId })
        return { success = false, error = 'REQUESTER_OFFLINE' }
    end

    local distanceLimit = SafeNumber(Config.Wallet and Config.Wallet.ProximityDistance or nil, 1.0, 10.0) or 3.0
    local near, distance = IsWithinDistance(source, requesterSource, distanceLimit)
    if not near then
        return {
            success = false,
            error = 'TOO_FAR',
            distance = distance and math.floor(distance * 100) / 100 or nil,
            maxDistance = distanceLimit,
        }
    end

    local amount = tonumber(row.amount) or 0
    if amount <= 0 then
        return { success = false, error = 'INVALID_REQUEST' }
    end

    local transferSuccess, transferPayload = ExecuteWalletTransfer(
        responderIdentifier,
        row.requester_identifier,
        row.requester_phone,
        amount,
        row.title or 'Solicitud QR/NFC'
    )
    if not transferSuccess then
        return { success = false, error = transferPayload.error or 'TRANSFER_FAILED' }
    end

    MySQL.update.await('UPDATE phone_wallet_requests SET status = "accepted", responded_at = NOW() WHERE id = ? AND status = "pending"', { requestId })

    PushWalletNotification(source, 'Wallet', ('Pago %s enviado: $%s'):format(string.upper(row.method or 'qr'), math.floor(amount)))
    if requesterSource then
        PushWalletNotification(requesterSource, 'Wallet', ('Solicitud %s pagada: $%s'):format(string.upper(row.method or 'qr'), math.floor(amount)))
    end

    return {
        success = true,
        status = 'accepted',
        balance = transferPayload.balance,
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
