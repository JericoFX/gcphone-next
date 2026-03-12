-- Creado/Modificado por JericoFX

local function GetContacts(identifier)
    if not identifier then return {} end
    
    return MySQL.query.await(
        'SELECT id, number, display, avatar, favorite FROM phone_contacts WHERE identifier = ? ORDER BY favorite DESC, display ASC',
        { identifier }
    ) or {}
end

local function CanAccessIdentifierExport(identifier, requestSource)
    local src = tonumber(requestSource)
    if not src or src <= 0 or not identifier then
        return false
    end

    local ownerIdentifier = GetPhoneOwnerIdentifier and GetPhoneOwnerIdentifier(src, true) or GetIdentifier(src)
    return ownerIdentifier ~= nil and ownerIdentifier == identifier
end

local function SafeText(value, maxLength)
    if type(value) ~= 'string' then return nil end
    local text = value:gsub('[%z\1-\31\127]', '')
    text = text:gsub('<.->', '')
    text = text:gsub('^%s+', ''):gsub('%s+$', '')
    if text == '' then return nil end
    return text:sub(1, maxLength or 80)
end

local function SafePhone(value)
    if type(value) ~= 'string' then return nil end
    local number = value:gsub('[^%d%+%-%(%s%)]', '')
    number = number:gsub('^%s+', ''):gsub('%s+$', '')
    if number == '' then return nil end
    return number:sub(1, 20)
end

lib.callback.register('gcphone:getContacts', function(source)
    local identifier = GetPhoneOwnerIdentifier(source, true)
    return GetContacts(identifier)
end)

lib.callback.register('gcphone:addContact', function(source, data)
    if IsPhoneReadOnly(source) then return false, 'READ_ONLY' end
    local identifier = GetIdentifier(source)
    if not identifier then return false end

    local display = type(data) == 'table' and SafeText(data.display, 60) or nil
    local number = type(data) == 'table' and SafePhone(data.number) or nil
    local avatar = type(data) == 'table' and SafeText(data.avatar, 500) or nil

    if not display or not number then
        return false, 'Invalid data'
    end
    
    local existing = MySQL.scalar.await(
        'SELECT id FROM phone_contacts WHERE identifier = ? AND number = ?',
        { identifier, number }
    )
    
    if existing then
        return false, 'Contact already exists'
    end
    
    local id = MySQL.insert.await(
        'INSERT INTO phone_contacts (identifier, number, display, avatar) VALUES (?, ?, ?, ?)',
        { identifier, number, display, avatar }
    )

    if type(TriggerPhoneHook) == 'function' then
        TriggerPhoneHook('contactAdded', {
            source = source,
            identifier = identifier,
            contactId = id,
            name = display,
            number = number,
            avatar = avatar,
        })
    end
    
    TriggerClientEvent('gcphone:contactsUpdated', source, GetContacts(identifier))
    
    return true, id
end)

lib.callback.register('gcphone:updateContact', function(source, data)
    if IsPhoneReadOnly(source) then return false, 'READ_ONLY' end
    local identifier = GetIdentifier(source)
    if not identifier then return false end

    local contactId = type(data) == 'table' and tonumber(data.id) or nil
    local display = type(data) == 'table' and SafeText(data.display, 60) or nil
    local number = type(data) == 'table' and SafePhone(data.number) or nil
    local avatar = type(data) == 'table' and SafeText(data.avatar, 500) or nil

    if not contactId or not display or not number then
        return false, 'Invalid data'
    end
    
    MySQL.update.await(
        'UPDATE phone_contacts SET number = ?, display = ?, avatar = ? WHERE id = ? AND identifier = ?',
        { number, display, avatar, contactId, identifier }
    )

    if type(TriggerPhoneHook) == 'function' then
        TriggerPhoneHook('contactUpdated', {
            source = source,
            identifier = identifier,
            contactId = contactId,
            name = display,
            number = number,
            avatar = avatar,
        })
    end
    
    TriggerClientEvent('gcphone:contactsUpdated', source, GetContacts(identifier))
    
    return true
end)

lib.callback.register('gcphone:deleteContact', function(source, contactId)
    if IsPhoneReadOnly(source) then return false end
    local identifier = GetIdentifier(source)
    if not identifier then return false end

    local id = tonumber(contactId)
    if not id then return false end
    
    local deleted = MySQL.single.await(
        'SELECT display, number, avatar FROM phone_contacts WHERE id = ? AND identifier = ? LIMIT 1',
        { id, identifier }
    )

    MySQL.execute.await(
        'DELETE FROM phone_contacts WHERE id = ? AND identifier = ?',
        { id, identifier }
    )

    if deleted and type(TriggerPhoneHook) == 'function' then
        TriggerPhoneHook('contactDeleted', {
            source = source,
            identifier = identifier,
            contactId = id,
            name = deleted.display,
            number = deleted.number,
            avatar = deleted.avatar,
        })
    end
    
    TriggerClientEvent('gcphone:contactsUpdated', source, GetContacts(identifier))
    
    return true
end)

lib.callback.register('gcphone:toggleFavorite', function(source, contactId)
    if IsPhoneReadOnly(source) then return false end
    local identifier = GetIdentifier(source)
    if not identifier then return false end

    local id = tonumber(contactId)
    if not id then return false end
    
    local current = MySQL.scalar.await(
        'SELECT favorite FROM phone_contacts WHERE id = ? AND identifier = ?',
        { id, identifier }
    )
    
    if current == nil then return false end
    
    MySQL.update.await(
        'UPDATE phone_contacts SET favorite = ? WHERE id = ? AND identifier = ?',
        { current == 1 and 0 or 1, id, identifier }
    )
    
    TriggerClientEvent('gcphone:contactsUpdated', source, GetContacts(identifier))
    
    return true
end)

lib.callback.register('gcphone:shareContact', function(source, data)
    if IsPhoneReadOnly(source) then return false, 'READ_ONLY' end
    local identifier = GetIdentifier(source)
    if not identifier then return false, 'Invalid source' end

    if type(data) ~= 'table' then
        return false, 'Invalid data'
    end

    local targetSource = tonumber(data.targetServerId)
    local contact = type(data.contact) == 'table' and data.contact or nil

    if not targetSource or not contact then
        return false, 'Invalid data'
    end

    local contactDisplay = SafeText(contact.display, 60)
    local contactNumber = SafePhone(contact.number)
    local contactAvatar = SafeText(contact.avatar, 500)

    if not contactDisplay or not contactNumber then
        return false, 'Invalid data'
    end
    
    local targetIdentifier = GetIdentifier(targetSource)
    if not targetIdentifier then
        return false, 'Target not found'
    end
    
    local name = GetName(source)
    
    TriggerClientEvent('gcphone:receiveContactRequest', targetSource, {
        fromPlayer = name,
        fromServerId = source,
        contact = {
            display = contactDisplay,
            number = contactNumber,
            avatar = contactAvatar
        }
    })
    
    return true
end)

lib.callback.register('gcphone:acceptSharedContact', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false end

    local display = type(data) == 'table' and SafeText(data.display, 60) or nil
    local number = type(data) == 'table' and SafePhone(data.number) or nil
    local avatar = type(data) == 'table' and SafeText(data.avatar, 500) or nil

    if not display or not number then
        return false, 'Invalid data'
    end
    
    local existing = MySQL.scalar.await(
        'SELECT id FROM phone_contacts WHERE identifier = ? AND number = ?',
        { identifier, number }
    )
    
    if existing then
        return false, 'Contact already exists'
    end
    
    local insertedId = MySQL.insert.await(
        'INSERT INTO phone_contacts (identifier, number, display, avatar) VALUES (?, ?, ?, ?)',
        { identifier, number, display, avatar }
    )

    if type(TriggerPhoneHook) == 'function' then
        TriggerPhoneHook('contactAdded', {
            source = source,
            identifier = identifier,
            contactId = insertedId,
            name = display,
            number = number,
            avatar = avatar,
            shared = true,
        })
    end
    
    TriggerClientEvent('gcphone:contactsUpdated', source, GetContacts(identifier))
    
    return true
end)

---Get contact list for an identifier.
---@param identifier string
---@param requestSource integer
---@return table[]
exports('GetContacts', function(identifier, requestSource)
    if not CanAccessIdentifierExport(identifier, requestSource) then
        return {}
    end

    return GetContacts(identifier)
end)
