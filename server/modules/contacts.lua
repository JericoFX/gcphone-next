-- Creado/Modificado por JericoFX

local Bridge = require 'server.bridge'
local Phone = require 'server.modules.phone'
local Utils = require 'server.lib.utils'
local Hooks = require 'server.modules.hooks'

local function GetContacts(identifier)
    if not identifier then return {} end

    return MySQL.query.await(
        'SELECT id, number, display, avatar, favorite FROM phone_contacts WHERE identifier = ? ORDER BY favorite DESC, display ASC',
        { identifier }
    ) or {}
end

lib.callback.register('gcphone:getContacts', function(source)
    local identifier = Phone.GetPhoneOwnerIdentifier(source, true)
    return GetContacts(identifier)
end)

lib.callback.register('gcphone:addContact', function(source, data)
    if Phone.IsPhoneReadOnly(source) then return false, 'READ_ONLY' end
    local identifier = Bridge.GetIdentifier(source)
    if not identifier then return false end

    local display = type(data) == 'table' and Utils.SafeText(data.display, 60) or nil
    local number = type(data) == 'table' and Utils.SafePhone(data.number) or nil
    local avatar = type(data) == 'table' and Utils.SafeText(data.avatar, 500) or nil

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

    Hooks.triggerHook('contactAdded', {
        source = source,
        identifier = identifier,
        contactId = id,
        name = display,
        number = number,
        avatar = avatar,
    })

    TriggerClientEvent('gcphone:contactsUpdated', source, GetContacts(identifier))

    return true, id
end)

lib.callback.register('gcphone:updateContact', function(source, data)
    if Phone.IsPhoneReadOnly(source) then return false, 'READ_ONLY' end
    local identifier = Bridge.GetIdentifier(source)
    if not identifier then return false end

    local contactId = type(data) == 'table' and tonumber(data.id) or nil
    local display = type(data) == 'table' and Utils.SafeText(data.display, 60) or nil
    local number = type(data) == 'table' and Utils.SafePhone(data.number) or nil
    local avatar = type(data) == 'table' and Utils.SafeText(data.avatar, 500) or nil

    if not contactId or not display or not number then
        return false, 'Invalid data'
    end

    MySQL.update.await(
        'UPDATE phone_contacts SET number = ?, display = ?, avatar = ? WHERE id = ? AND identifier = ?',
        { number, display, avatar, contactId, identifier }
    )

    Hooks.triggerHook('contactUpdated', {
        source = source,
        identifier = identifier,
        contactId = contactId,
        name = display,
        number = number,
        avatar = avatar,
    })

    TriggerClientEvent('gcphone:contactsUpdated', source, GetContacts(identifier))

    return true
end)

lib.callback.register('gcphone:deleteContact', function(source, contactId)
    if Phone.IsPhoneReadOnly(source) then return false end
    local identifier = Bridge.GetIdentifier(source)
    if not identifier then return false end

    local id = tonumber(contactId)
    if not id then return false end

    local deleted = MySQL.single.await(
        'SELECT display, number, avatar FROM phone_contacts WHERE id = ? AND identifier = ? LIMIT 1',
        { id, identifier }
    )

    MySQL.update.await(
        'DELETE FROM phone_contacts WHERE id = ? AND identifier = ?',
        { id, identifier }
    )

    if deleted then
        Hooks.triggerHook('contactDeleted', {
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
    if Phone.IsPhoneReadOnly(source) then return false end
    local identifier = Bridge.GetIdentifier(source)
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
    if Phone.IsPhoneReadOnly(source) then return false, 'READ_ONLY' end
    if Utils.HitRateLimit(source, 'share_contact', 2000, 3) then return false, 'RATE_LIMITED' end
    local identifier = Bridge.GetIdentifier(source)
    if not identifier then return false, 'Invalid source' end

    if type(data) ~= 'table' then
        return false, 'Invalid data'
    end

    local targetSource = tonumber(data.targetServerId)
    local contact = type(data.contact) == 'table' and data.contact or nil

    if not targetSource or not contact then
        return false, 'Invalid data'
    end

    local contactDisplay = Utils.SafeText(contact.display, 60)
    local contactNumber = Utils.SafePhone(contact.number)
    local contactAvatar = Utils.SafeText(contact.avatar, 500)

    if not contactDisplay or not contactNumber then
        return false, 'Invalid data'
    end

    local targetIdentifier = Bridge.GetIdentifier(targetSource)
    if not targetIdentifier then
        return false, 'Target not found'
    end

    local name = Bridge.GetName(source)

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
    local identifier = Bridge.GetIdentifier(source)
    if not identifier then return false end

    local display = type(data) == 'table' and Utils.SafeText(data.display, 60) or nil
    local number = type(data) == 'table' and Utils.SafePhone(data.number) or nil
    local avatar = type(data) == 'table' and Utils.SafeText(data.avatar, 500) or nil

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

    Hooks.triggerHook('contactAdded', {
        source = source,
        identifier = identifier,
        contactId = insertedId,
        name = display,
        number = number,
        avatar = avatar,
        shared = true,
    })

    TriggerClientEvent('gcphone:contactsUpdated', source, GetContacts(identifier))

    return true
end)

---Get contact list for an identifier.
---@param identifier string
---@param requestSource integer
---@return table[]
exports('GetContacts', function(identifier, requestSource)
    if not Utils.CanAccessIdentifierExport(identifier, requestSource, Phone.GetPhoneOwnerIdentifier, Bridge.GetIdentifier) then
        return {}
    end

    return GetContacts(identifier)
end)

return {}
