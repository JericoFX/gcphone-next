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

local function RequirePlayerIdentifier(source)
    local src = tonumber(source)
    if not src or src <= 0 then return nil end

    if type(GetPlayer) == 'function' and not GetPlayer(src) then
        return nil
    end

    if type(IsPlayerActionAllowed) == 'function' then
        local allowed = IsPlayerActionAllowed(src)
        if not allowed then
            return nil
        end
    end

    return GetIdentifier(src)
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

local function TransferFrameworkMoney(payerSource, receiverSource, amount, method)
    local moneyType = method == 'cash' and 'cash' or 'bank'

    local payerBalance = GetMoney(payerSource, moneyType)
    if not payerBalance or payerBalance < amount then
        return false, 'INSUFFICIENT_' .. string.upper(moneyType)
    end

    local removed = RemoveMoney(payerSource, amount, moneyType, 'gcphone-invoice-' .. moneyType)
    if not removed then
        return false, 'PAYMENT_FAILED'
    end

    local added = AddMoney(receiverSource, amount, moneyType, 'gcphone-invoice-' .. moneyType)
    if not added then
        AddMoney(payerSource, amount, moneyType, 'gcphone-invoice-revert-' .. moneyType)
        return false, 'PAYMENT_FAILED'
    end

    return true
end

local PendingInvoices = {}

local function BuildInvoiceId(source)
    return tostring(os.time()) .. ':' .. tostring(source) .. ':' .. tostring(math.random(1000, 9999))
end

local function ResolveInvoiceTarget(source, data)
    local fromIdentifier = RequirePlayerIdentifier(source)
    if not fromIdentifier then return nil, nil, nil, 'INVALID_SOURCE' end
    if type(data) ~= 'table' then return nil, nil, nil, 'INVALID_DATA' end

    local targetServerId = tonumber(data.targetServerId)
    local targetPhone = SafeString(data.targetPhone, 20)
    local targetIdentifier = SafeString(data.targetIdentifier, 80)

    if targetServerId then
        local targetId = GetIdentifier(targetServerId)
        if not targetId then return nil, nil, nil, 'TARGET_NOT_FOUND' end
        if type(IsPlayerActionAllowed) == 'function' then
            local allowed = IsPlayerActionAllowed(targetServerId)
            if not allowed then return nil, nil, nil, 'TARGET_UNAVAILABLE' end
        end
        if targetId == fromIdentifier then return nil, nil, nil, 'INVALID_TARGET' end
        local distanceLimit = SafeNumber(Config.Wallet and Config.Wallet.ProximityDistance or nil, 1.0, 10.0) or 3.0
        local near = IsWithinDistance(source, targetServerId, distanceLimit)
        if not near then return nil, nil, nil, 'TOO_FAR' end
        return targetServerId, targetId, 'nfc'
    end

    if targetPhone then
        local targetId = GetIdentifierByPhone(targetPhone)
        if not targetId then return nil, nil, nil, 'TARGET_NOT_FOUND' end
        if targetId == fromIdentifier then return nil, nil, nil, 'INVALID_TARGET' end
        local targetSource = GetSourceFromIdentifier(targetId)
        if not targetSource then return nil, nil, nil, 'TARGET_OFFLINE' end
        if type(IsPlayerActionAllowed) == 'function' then
            local allowed = IsPlayerActionAllowed(targetSource)
            if not allowed then return nil, nil, nil, 'TARGET_UNAVAILABLE' end
        end
        return targetSource, targetId, 'remote'
    end

    if targetIdentifier then
        if targetIdentifier == fromIdentifier then return nil, nil, nil, 'INVALID_TARGET' end
        local targetSource = GetSourceFromIdentifier(targetIdentifier)
        if not targetSource then return nil, nil, nil, 'TARGET_OFFLINE' end
        if type(IsPlayerActionAllowed) == 'function' then
            local allowed = IsPlayerActionAllowed(targetSource)
            if not allowed then return nil, nil, nil, 'TARGET_UNAVAILABLE' end
        end
        return targetSource, targetIdentifier, 'remote'
    end

    return nil, nil, nil, 'INVALID_TARGET'
end

local function NotifyInvoiceResult(invoice, status)
    local fromSource = GetSourceFromIdentifier(invoice.fromIdentifier)
    if fromSource then
        TriggerClientEvent('gcphone:walletNfcInvoiceResult', fromSource, {
            invoiceId = invoice.id,
            status = status,
            amount = invoice.amount,
            title = invoice.title,
            channel = invoice.channel,
        })
    end

    if invoice.channel == 'remote' then
        local toSource = GetSourceFromIdentifier(invoice.toIdentifier)
        if toSource then
            TriggerClientEvent('gcphone:bankInvoiceResult', toSource, {
                invoiceId = invoice.id,
                status = status,
                amount = invoice.amount,
                title = invoice.title,
                channel = invoice.channel,
            })
        end
    end
end

lib.callback.register('gcphone:wallet:getState', function(source)
    local identifier = RequirePlayerIdentifier(source)
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
    local identifier = RequirePlayerIdentifier(source)
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
    local identifier = RequirePlayerIdentifier(source)
    if not identifier then return { success = false, error = 'INVALID_SOURCE' } end
    local cardId = tonumber(type(data) == 'table' and data.cardId or nil)
    if not cardId then return { success = false, error = 'INVALID_CARD' } end

    MySQL.update.await('DELETE FROM phone_wallet_cards WHERE id = ? AND identifier = ?', { cardId, identifier })
    return { success = true }
end)

lib.callback.register('gcphone:wallet:transfer', function(source, data)
    local identifier = RequirePlayerIdentifier(source)
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
    local identifier = RequirePlayerIdentifier(source)
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
    if type(IsPlayerActionAllowed) == 'function' then
        local allowed = IsPlayerActionAllowed(receiverSource)
        if not allowed then
            return { success = false, error = 'TARGET_UNAVAILABLE' }
        end
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
    local requesterIdentifier = RequirePlayerIdentifier(source)
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
    if type(IsPlayerActionAllowed) == 'function' then
        local allowed = IsPlayerActionAllowed(targetSource)
        if not allowed then
            return { success = false, error = 'TARGET_UNAVAILABLE' }
        end
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
    local identifier = RequirePlayerIdentifier(source)
    if not identifier then return { incoming = {}, outgoing = {} } end

    MySQL.update.await([[
        UPDATE phone_wallet_requests
        SET status = 'expired', responded_at = NOW()
        WHERE status = 'pending'
          AND expires_at < NOW()
          AND (target_identifier = ? OR requester_identifier = ?)
    ]], { identifier, identifier })

    local incoming = MySQL.query.await(
        'SELECT * FROM phone_wallet_requests WHERE target_identifier = ? AND status = "pending" AND expires_at >= NOW() ORDER BY created_at DESC LIMIT 30',
        { identifier }
    ) or {}

    local outgoing = MySQL.query.await(
        'SELECT * FROM phone_wallet_requests WHERE requester_identifier = ? AND status = "pending" AND expires_at >= NOW() ORDER BY created_at DESC LIMIT 30',
        { identifier }
    ) or {}

    -- Verified: CommunityOX ox_lib Array/Shared exposes lib.array.map(arr, fn)
    local incomingPayload = lib.array.map(incoming, function(row)
        return BuildWalletRequestPayload(row)
    end)

    local outgoingPayload = lib.array.map(outgoing, function(row)
        return BuildWalletRequestPayload(row)
    end)

    return {
        incoming = incomingPayload,
        outgoing = outgoingPayload,
    }
end)

lib.callback.register('gcphone:wallet:respondRequest', function(source, data)
    local responderIdentifier = RequirePlayerIdentifier(source)
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
    if type(IsPlayerActionAllowed) == 'function' then
        local allowed = IsPlayerActionAllowed(requesterSource)
        if not allowed then
            return { success = false, error = 'TARGET_UNAVAILABLE' }
        end
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

---Check whether two players can use proximity payment within a given distance.
---@param source integer
---@param targetSource integer
---@param maxDistance? number
---@return boolean, string|nil, number|nil
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

---@class GCWalletTransferResponse
---@field success boolean
---@field error? string
---@field status? string
---@field balance? number

---Execute a proximity wallet transfer between two players.
---@param source integer
---@param targetSource integer
---@param amount number
---@param title? string
---@param method? 'qr'|'nfc'|string
---@return GCWalletTransferResponse
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
    if type(IsPlayerActionAllowed) == 'function' then
        local sourceAllowed = IsPlayerActionAllowed(source)
        local targetAllowed = IsPlayerActionAllowed(targetSource)
        if not sourceAllowed then return { success = false, error = 'INVALID_SOURCE' } end
        if not targetAllowed then return { success = false, error = 'TARGET_UNAVAILABLE' } end
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

local function CreateInvoice(source, data)
    local fromIdentifier = RequirePlayerIdentifier(source)
    if not fromIdentifier then return { success = false, error = 'INVALID_SOURCE' } end
    if type(data) ~= 'table' then return { success = false, error = 'INVALID_DATA' } end

    local amount = SafeNumber(data.amount, 1, Config.Wallet and Config.Wallet.MaxTransferAmount or 500000)
    local invoiceTitles = {
        es = 'Factura',
        en = 'Invoice',
        pt = 'Fatura',
        fr = 'Facture',
    }
    local lang = type(GetPhoneLanguageForSource) == 'function' and GetPhoneLanguageForSource(source, true) or 'es'
    local title = SafeString(data.title, 64) or invoiceTitles[lang] or invoiceTitles.es
    if not amount then return { success = false, error = 'INVALID_AMOUNT' } end

    local invoiceMs = (Config.Security and Config.Security.RateLimits and Config.Security.RateLimits.walletRequest) or 1300
    if HitRateLimit(source, 'wallet_create_invoice', invoiceMs, 1) then
        return { success = false, error = 'RATE_LIMITED' }
    end

    local targetSource, toIdentifier, channel, targetErr = ResolveInvoiceTarget(source, data)
    if not targetSource then return { success = false, error = targetErr or 'INVALID_TARGET' } end

    local invoiceId = BuildInvoiceId(source)
    local expiresAt = os.time() + 120

    local invoice = {
        id = invoiceId,
        fromIdentifier = fromIdentifier,
        toIdentifier = toIdentifier,
        amount = amount,
        title = title,
        channel = channel,
        expiresAt = expiresAt,
    }

    PendingInvoices[invoiceId] = invoice

    local payload = {
        invoiceId = invoiceId,
        fromName = GetName(source) or 'Ciudadano',
        amount = amount,
        title = title,
        expiresAt = expiresAt,
        channel = channel,
    }

    if channel == 'nfc' then
        TriggerClientEvent('gcphone:walletNfcInvoiceReceived', targetSource, payload)
    else
        TriggerClientEvent('gcphone:bankInvoiceReceived', targetSource, payload)
    end

    return { success = true, invoiceId = invoiceId, channel = channel }
end

local function RespondInvoice(source, data)
    local toIdentifier = RequirePlayerIdentifier(source)
    if not toIdentifier then return { success = false, error = 'INVALID_SOURCE' } end
    if type(data) ~= 'table' then return { success = false, error = 'INVALID_DATA' } end

    local invoiceId = SafeString(data.invoiceId, 64)
    local accept = data.accept == true
    local requestedMethod = SafeString(data.paymentMethod, 10)
    if not invoiceId then return { success = false, error = 'INVALID_INVOICE' } end

    local invoice = PendingInvoices[invoiceId]
    if not invoice then return { success = false, error = 'INVOICE_NOT_FOUND' } end
    if invoice.toIdentifier ~= toIdentifier then return { success = false, error = 'FORBIDDEN' } end

    if os.time() > invoice.expiresAt then
        PendingInvoices[invoiceId] = nil
        NotifyInvoiceResult(invoice, 'expired')
        return { success = false, error = 'INVOICE_EXPIRED' }
    end

    if not accept then
        PendingInvoices[invoiceId] = nil
        NotifyInvoiceResult(invoice, 'rejected')
        return { success = true, status = 'rejected' }
    end

    local payerSource = source
    local receiverSource = GetSourceFromIdentifier(invoice.fromIdentifier)
    if not receiverSource then
        return { success = false, error = 'TARGET_OFFLINE' }
    end
    if type(IsPlayerActionAllowed) == 'function' then
        local allowed = IsPlayerActionAllowed(receiverSource)
        if not allowed then
            return { success = false, error = 'TARGET_UNAVAILABLE' }
        end
    end

    local method = invoice.channel == 'nfc' and ((requestedMethod == 'cash' and 'cash') or 'bank') or 'bank'
    local ok, err = TransferFrameworkMoney(payerSource, receiverSource, invoice.amount, method)
    if not ok then
        return { success = false, error = err or 'PAYMENT_FAILED' }
    end

    PendingInvoices[invoiceId] = nil
    NotifyInvoiceResult(invoice, 'paid')

    return { success = true, status = 'paid', paymentMethod = method }
end

lib.callback.register('gcphone:wallet:createInvoice', CreateInvoice)
lib.callback.register('gcphone:wallet:respondInvoice', RespondInvoice)

lib.callback.register('gcphone:wallet:createNfcInvoice', function(source, data)
    data = data or {}
    data.targetPhone = nil
    data.targetIdentifier = nil
    return CreateInvoice(source, data)
end)

lib.callback.register('gcphone:wallet:respondNfcInvoice', function(source, data)
    data = data or {}
    return RespondInvoice(source, data)
end)
