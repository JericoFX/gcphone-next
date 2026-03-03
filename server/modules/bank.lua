-- Creado/Modificado por JericoFX

lib.callback.register('gcphone:getBankBalance', function(source)
    local identifier = GetIdentifier(source)
    if not identifier then return 0 end
    
    local balance = GetMoney(source, 'bank')
    return balance or 0
end)

lib.callback.register('gcphone:getBankTransactions', function(source)
    local identifier = GetIdentifier(source)
    if not identifier then return {} end
    
    return {}
end)

lib.callback.register('gcphone:transferMoney', function(source, data)
    local identifier = GetIdentifier(source)
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
    
    local myBalance = GetMoney(source, 'bank')
    if myBalance < amount then
        return false, 'Insufficient funds'
    end
    
    local targetIdentifier = GetIdentifierByPhone(data.targetNumber)
    if not targetIdentifier then
        return false, 'Target not found'
    end
    
    local targetSource = GetSourceFromIdentifier(targetIdentifier)
    if not targetSource then
        return false, 'Target unavailable'
    end
    
    local success = RemoveMoney(source, amount, 'bank', 'phone-transfer')
    if not success then
        return false, 'Transfer failed'
    end
    
    local addOk = AddMoney(targetSource, amount, 'bank', 'phone-transfer')
    if not addOk then
        AddMoney(source, amount, 'bank', 'phone-transfer-revert')
        return false, 'Transfer failed'
    end
    
    local name = GetName(source)
    
    if targetSource then
        TriggerClientEvent('gcphone:bankTransferReceived', targetSource, {
            amount = amount,
            from = name
        })
    end
    
    return true
end)

lib.callback.register('gcphone:getContactsForTransfer', function(source)
    local identifier = GetIdentifier(source)
    if not identifier then return {} end
    
    local contacts = MySQL.query.await(
        'SELECT display, number FROM phone_contacts WHERE identifier = ?',
        { identifier }
    ) or {}
    
    local result = {}
    for _, contact in ipairs(contacts) do
        local contactIdentifier = GetIdentifierByPhone(contact.number)
        if contactIdentifier then
            table.insert(result, contact)
        end
    end
    
    return result
end)
