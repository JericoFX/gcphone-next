local function SafeText(value, maxLen)
    if type(value) ~= 'string' then return nil end
    local text = value:gsub('[%c]', ''):gsub('^%s+', ''):gsub('%s+$', '')
    if text == '' then return nil end
    if maxLen and #text > maxLen then
        text = text:sub(1, maxLen)
    end
    return text
end

local function SafeMeta(value)
    if value == nil then return nil end
    if type(value) == 'string' then
        if #value > 4000 then
            return value:sub(1, 4000)
        end
        return value
    end
    if type(value) == 'table' then
        local encoded = json.encode(value)
        if type(encoded) ~= 'string' then return nil end
        if #encoded > 4000 then
            encoded = encoded:sub(1, 4000)
        end
        return encoded
    end
    return nil
end

local function InsertNotification(identifier, payload)
    local appId = SafeText(payload.appId or payload.app or 'system', 40) or 'system'
    local title = SafeText(payload.title or 'Notificacion', 80) or 'Notificacion'
    local content = SafeText(payload.content or payload.message or '', 255)
    if not content then
        return nil
    end

    local avatar = SafeText(payload.avatar or '', 500)
    local meta = SafeMeta(payload.meta)

    return MySQL.insert.await(
        [[
            INSERT INTO phone_notifications (identifier, app_id, title, content, avatar, meta, is_read)
            VALUES (?, ?, ?, ?, ?, ?, 0)
        ]],
        { identifier, appId, title, content, avatar, meta }
    )
end

local function ParseMeta(raw)
    if type(raw) ~= 'string' or raw == '' then
        return nil
    end
    local ok, decoded = pcall(json.decode, raw)
    if ok then return decoded end
    return nil
end

lib.callback.register('gcphone:notifications:get', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then
        return { success = false, error = 'MISSING_IDENTIFIER' }
    end

    local limit = math.floor(tonumber(type(data) == 'table' and data.limit or 50) or 50)
    if limit < 1 then limit = 1 end
    if limit > 150 then limit = 150 end

    local offset = math.floor(tonumber(type(data) == 'table' and data.offset or 0) or 0)
    if offset < 0 then offset = 0 end

    local rows = MySQL.query.await(
        [[
            SELECT id, app_id, title, content, avatar, meta, is_read,
                   UNIX_TIMESTAMP(created_at) * 1000 AS createdAt
            FROM phone_notifications
            WHERE identifier = ?
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        ]],
        { identifier, limit, offset }
    ) or {}

    for _, row in ipairs(rows) do
        row.meta = ParseMeta(row.meta)
    end

    local unread = MySQL.scalar.await(
        'SELECT COUNT(*) FROM phone_notifications WHERE identifier = ? AND is_read = 0',
        { identifier }
    ) or 0

    return {
        success = true,
        notifications = rows,
        unread = tonumber(unread) or 0,
    }
end)

lib.callback.register('gcphone:notifications:markRead', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false end

    local notificationId = tonumber(type(data) == 'table' and data.id or nil)
    if not notificationId or notificationId < 1 then
        return false
    end

    local changed = MySQL.update.await(
        'UPDATE phone_notifications SET is_read = 1 WHERE id = ? AND identifier = ?',
        { notificationId, identifier }
    )
    return (changed or 0) > 0
end)

lib.callback.register('gcphone:notifications:markAllRead', function(source)
    local identifier = GetIdentifier(source)
    if not identifier then return false end

    MySQL.update.await(
        'UPDATE phone_notifications SET is_read = 1 WHERE identifier = ? AND is_read = 0',
        { identifier }
    )

    return true
end)

lib.callback.register('gcphone:notifications:delete', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false end

    local notificationId = tonumber(type(data) == 'table' and data.id or nil)
    if not notificationId or notificationId < 1 then
        return false
    end

    local changed = MySQL.update.await(
        'DELETE FROM phone_notifications WHERE id = ? AND identifier = ?',
        { notificationId, identifier }
    )
    return (changed or 0) > 0
end)

exports('AddPersistentNotification', function(identifier, payload)
    if not identifier or type(payload) ~= 'table' then
        return nil
    end

    local id = InsertNotification(identifier, payload)
    if not id then return nil end

    local target = GetSourceFromIdentifier(identifier)
    if target then
        TriggerClientEvent('gcphone:notify', target, {
            title = payload.title or 'Notificacion',
            message = payload.content or payload.message or '',
            app = payload.appId or payload.app or 'system',
            avatar = payload.avatar,
        })
    end

    return id
end)
