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

local function GetPhoneByIdentifier(identifier)
    if not identifier then return nil end
    return MySQL.scalar.await('SELECT phone_number FROM phone_numbers WHERE identifier = ? LIMIT 1', { identifier })
end

local function TransferBetweenWallets(senderIdentifier, receiverIdentifier, amount, title)
    local senderWallet = EnsureWallet(senderIdentifier)
    local receiverWallet = EnsureWallet(receiverIdentifier)
    local senderPhone = GetPhoneByIdentifier(senderIdentifier)
    local receiverPhone = GetPhoneByIdentifier(receiverIdentifier)

    local senderBalance = tonumber(senderWallet.balance) or 0
    if senderBalance < amount then
        return false, 'INSUFFICIENT_FUNDS'
    end

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
            values = { senderIdentifier, amount, 'out', title, receiverPhone }
        },
        {
            query = 'INSERT INTO phone_wallet_transactions (identifier, amount, type, title, target_phone) VALUES (?, ?, ?, ?, ?)',
            values = { receiverIdentifier, amount, 'in', title, senderPhone }
        },
    })

    return true
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
    local fromIdentifier = GetIdentifier(source)
    if not fromIdentifier then return nil, nil, nil, 'INVALID_SOURCE' end
    if type(data) ~= 'table' then return nil, nil, nil, 'INVALID_DATA' end

    local targetServerId = tonumber(data.targetServerId)
    local targetPhone = SafeString(data.targetPhone, 20)
    local targetIdentifier = SafeString(data.targetIdentifier, 80)

    if targetServerId then
        local targetId = GetIdentifier(targetServerId)
        if not targetId then return nil, nil, nil, 'TARGET_NOT_FOUND' end
        if targetId == fromIdentifier then return nil, nil, nil, 'INVALID_TARGET' end
        return targetServerId, targetId, 'nfc'
    end

    if targetPhone then
        local targetId = GetIdentifierByPhone(targetPhone)
        if not targetId then return nil, nil, nil, 'TARGET_NOT_FOUND' end
        if targetId == fromIdentifier then return nil, nil, nil, 'INVALID_TARGET' end
        local targetSource = GetSourceFromIdentifier(targetId)
        if not targetSource then return nil, nil, nil, 'TARGET_OFFLINE' end
        return targetSource, targetId, 'remote'
    end

    if targetIdentifier then
        if targetIdentifier == fromIdentifier then return nil, nil, nil, 'INVALID_TARGET' end
        local targetSource = GetSourceFromIdentifier(targetIdentifier)
        if not targetSource then return nil, nil, nil, 'TARGET_OFFLINE' end
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

    local ok, err = TransferBetweenWallets(identifier, receiverIdentifier, amount, title)
    if not ok then
        return { success = false, error = err or 'TRANSFER_FAILED' }
    end

    local targetSource = GetSourceFromIdentifier(receiverIdentifier)
    if targetSource then
        TriggerClientEvent('gcphone:notify', targetSource, {
            appId = 'wallet',
            title = 'Wallet',
            message = ('Recibiste $%s'):format(math.floor(amount)),
            priority = 'normal'
        })
    end

    local updated = MySQL.scalar.await('SELECT balance FROM phone_wallets WHERE identifier = ? LIMIT 1', { identifier })
    return {
        success = true,
        balance = tonumber(updated) or 0,
    }
end)

local function CreateInvoice(source, data)
    local fromIdentifier = GetIdentifier(source)
    if not fromIdentifier then return { success = false, error = 'INVALID_SOURCE' } end
    if type(data) ~= 'table' then return { success = false, error = 'INVALID_DATA' } end

    local amount = SafeNumber(data.amount, 1, Config.Wallet and Config.Wallet.MaxTransferAmount or 500000)
    local title = SafeString(data.title, 64) or 'Factura'
    if not amount then return { success = false, error = 'INVALID_AMOUNT' } end

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
    local toIdentifier = GetIdentifier(source)
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
