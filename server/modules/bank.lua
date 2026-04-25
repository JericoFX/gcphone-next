-- Creado/Modificado por JericoFX
-- Bank module with transaction history

local Bridge = require 'server.bridge'
local Phone = require 'server.modules.phone'
local Utils = require 'server.lib.utils'

local function RecordTransaction(identifier, amount, txType, title, targetPhone)
    MySQL.insert.await('INSERT INTO phone_wallet_transactions (identifier, amount, type, title, target_phone) VALUES (?, ?, ?, ?, ?)',
        { identifier, amount, txType, title, targetPhone }
    )
end

lib.callback.register('gcphone:getBankBalance', function(source)
    local identifier = Bridge.GetIdentifier(source)
    if not identifier then return 0 end

    local balance = Bridge.GetMoney(source, 'bank')
    return balance or 0
end)

lib.callback.register('gcphone:getBankTransactions', function(source)
    local identifier = Bridge.GetIdentifier(source)
    if not identifier then return {} end

    local rows = MySQL.query.await([[
        SELECT id, amount, type, title, target_phone, created_at
        FROM phone_wallet_transactions
        WHERE identifier = ?
        ORDER BY created_at DESC
        LIMIT 50
    ]], { identifier }) or {}

    local result = {}
    for _, row in ipairs(rows) do
        local sign = row.type == 'out' and -1 or 1
        result[#result + 1] = {
            id = row.id,
            amount = tonumber(row.amount) * sign,
            description = row.title or 'Transferencia',
            time = row.created_at,
            targetPhone = row.target_phone,
        }
    end

    return result
end)

lib.callback.register('gcphone:transferMoney', function(source, data)
    if Phone.IsPhoneReadOnly(source) then return false, 'READ_ONLY' end
    if Utils.HitRateLimit(source, 'bank_transfer', 2000, 1) then return false, 'RATE_LIMITED' end
    local identifier = Bridge.GetIdentifier(source)
    if not identifier then return false, 'Invalid source' end
    if type(data) ~= 'table' then return false, 'Invalid data' end

    if not data.targetNumber or not data.amount then
        return false, 'Invalid data'
    end

    local amount = tonumber(data.amount)
    if not amount or amount <= 0 then
        return false, 'Invalid amount'
    end

    if amount > Config.Bank.MaxTransferAmount then
        return false, 'Amount exceeds maximum'
    end

    -- Apply transfer fee
    local fee = (Config.Bank.TransferFee or 0)
    local totalDebit = amount
    if fee > 0 then
        totalDebit = amount + (amount * fee)
    end

    local myBalance = Bridge.GetMoney(source, 'bank')
    if myBalance < totalDebit then
        return false, 'Insufficient funds'
    end

    local targetIdentifier = Bridge.GetIdentifierByPhone(data.targetNumber)
    if not targetIdentifier then
        return false, 'Target not found'
    end

    local targetSource = Bridge.GetSourceFromIdentifier(targetIdentifier)
    if not targetSource then
        return false, 'Target unavailable'
    end

    local success = Bridge.RemoveMoney(source, totalDebit, 'bank', 'phone-transfer')
    if not success then
        return false, 'Transfer failed'
    end

    local addOk = Bridge.AddMoney(targetSource, amount, 'bank', 'phone-transfer')
    if not addOk then
        Bridge.AddMoney(source, totalDebit, 'bank', 'phone-transfer-revert')
        return false, 'Transfer failed'
    end

    local name = Bridge.GetName(source)
    local targetName = Bridge.GetName(targetSource)
    local myPhone = Bridge.GetPhoneNumber(identifier)

    -- Record sender transaction
    local feeLabel = fee > 0 and (' (fee: ' .. math.floor(fee * 100) .. '%)') or ''
    RecordTransaction(identifier, totalDebit, 'out', 'Transferencia a ' .. (targetName or data.targetNumber) .. feeLabel, data.targetNumber)

    -- Record receiver transaction
    RecordTransaction(targetIdentifier, amount, 'in', 'Transferencia de ' .. (name or myPhone or '?'), myPhone)

    if targetSource then
        TriggerClientEvent('gcphone:bankTransferReceived', targetSource, {
            amount = amount,
            from = name
        })
    end

    return true
end)

lib.callback.register('gcphone:getContactsForTransfer', function(source)
    local identifier = Bridge.GetIdentifier(source)
    if not identifier then return {} end

    local contacts = MySQL.query.await(
        'SELECT display, number FROM phone_contacts WHERE identifier = ?',
        { identifier }
    ) or {}

    local result = {}
    for _, contact in ipairs(contacts) do
        local contactIdentifier = Bridge.GetIdentifierByPhone(contact.number)
        if contactIdentifier then
            result[#result + 1] = contact
        end
    end

    return result
end)

return {}
