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

    local senderWallet = EnsureWallet(identifier)
    local senderBalance = tonumber(senderWallet.balance) or 0
    if senderBalance < amount then
        return { success = false, error = 'INSUFFICIENT_FUNDS' }
    end

    local receiverIdentifier = GetIdentifierByPhone(targetPhone)
    if not receiverIdentifier then
        return { success = false, error = 'TARGET_NOT_FOUND' }
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
            values = { identifier, amount, 'out', title, targetPhone }
        },
        {
            query = 'INSERT INTO phone_wallet_transactions (identifier, amount, type, title, target_phone) VALUES (?, ?, ?, ?, ?)',
            values = { receiverIdentifier, amount, 'in', title, targetPhone }
        },
    })

    local senderSource = GetSourceFromIdentifier(receiverIdentifier)
    if senderSource then
        TriggerClientEvent('gcphone:notify', senderSource, {
            appId = 'wallet',
            title = 'Wallet',
            message = ('Recibiste $%s'):format(math.floor(amount)),
            priority = 'normal'
        })
    end

    local updated = MySQL.scalar.await('SELECT balance FROM phone_wallets WHERE id = ? LIMIT 1', { senderWallet.id })
    return {
        success = true,
        balance = tonumber(updated) or 0,
    }
end)
