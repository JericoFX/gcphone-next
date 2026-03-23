local Bridge = require 'server.bridge'
local Phone = require 'server.modules.phone'
local Utils = require 'server.lib.utils'

local function GetIdentifierSafe(source)
    local src = tonumber(source)
    if not src or src <= 0 then return nil end
    return Bridge.GetIdentifier(src)
end

lib.callback.register('gcphone:notes:getAll', function(source)
    local identifier = GetIdentifierSafe(source)
    if not identifier then return {} end

    return MySQL.query.await(
        'SELECT id, title, content, color, created_at, updated_at FROM phone_notes WHERE identifier = ? ORDER BY updated_at DESC',
        { identifier }
    ) or {}
end)

lib.callback.register('gcphone:notes:save', function(source, data)
    if Phone.IsPhoneReadOnly(source) then return false end
    if Utils.HitRateLimit(source, 'notes_save', 1000, 3) then return false end
    local identifier = GetIdentifierSafe(source)
    if not identifier then return false end
    if type(data) ~= 'table' then return false end

    local title = Utils.SanitizeText(data.title, 100, true)
    local content = Utils.SanitizeText(data.content, 5000, true)
    local color = Utils.SanitizeText(data.color, 10, true)
    if content == '' then return false end

    local noteId = tonumber(data.id)

    if noteId and noteId > 0 then
        local owner = MySQL.scalar.await('SELECT identifier FROM phone_notes WHERE id = ?', { noteId })
        if owner ~= identifier then return false end

        MySQL.update.await(
            'UPDATE phone_notes SET title = ?, content = ?, color = ? WHERE id = ? AND identifier = ?',
            { title ~= '' and title or nil, content, color ~= '' and color or '#FFFFFF', noteId, identifier }
        )
        return true, noteId
    end

    local newId = MySQL.insert.await(
        'INSERT INTO phone_notes (identifier, title, content, color) VALUES (?, ?, ?, ?)',
        { identifier, title ~= '' and title or nil, content, color ~= '' and color or '#FFFFFF' }
    )
    return true, newId
end)

lib.callback.register('gcphone:notes:delete', function(source, data)
    if Phone.IsPhoneReadOnly(source) then return false end
    if Utils.HitRateLimit(source, 'notes_delete', 1000, 3) then return false end
    local identifier = GetIdentifierSafe(source)
    if not identifier then return false end
    if type(data) ~= 'table' then return false end

    local noteId = tonumber(data.id)
    if not noteId then return false end

    MySQL.update.await('DELETE FROM phone_notes WHERE id = ? AND identifier = ?', { noteId, identifier })
    return true
end)

return {}
