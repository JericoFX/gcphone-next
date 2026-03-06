-- Creado/Modificado por JericoFX

local function ClampNumber(value, minValue, maxValue, fallback)
    local num = tonumber(value)
    if not num then return fallback end
    if num < minValue then num = minValue end
    if num > maxValue then num = maxValue end
    return math.floor(num)
end

lib.callback.register('gcphone:social:getNotifications', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return {} end

    data = type(data) == 'table' and data or {}

    local appType = data.appType
    if appType ~= 'snap' and appType ~= 'chirp' then
        appType = nil
    end

    local limit = ClampNumber(data.limit, 1, 100, 40)
    local offset = ClampNumber(data.offset, 0, 5000, 0)

    if appType then
        return MySQL.query.await([[
            SELECT
                sn.*,
                CASE
                    WHEN sn.app_type = 'snap' THEN sa.username
                    ELSE ca.username
                END as from_username,
                CASE
                    WHEN sn.app_type = 'snap' THEN sa.display_name
                    ELSE ca.display_name
                END as from_display_name,
                CASE
                    WHEN sn.app_type = 'snap' THEN sa.avatar
                    ELSE ca.avatar
                END as from_avatar,
                CASE
                    WHEN sn.app_type = 'snap' THEN sa.verified
                    ELSE ca.verified
                END as from_verified
            FROM phone_social_notifications sn
            LEFT JOIN phone_snap_accounts sa ON sa.identifier = sn.from_identifier AND sn.app_type = 'snap'
            LEFT JOIN phone_chirp_accounts ca ON ca.identifier = sn.from_identifier AND sn.app_type = 'chirp'
            WHERE sn.account_identifier = ?
              AND sn.app_type = ?
            ORDER BY sn.created_at DESC
            LIMIT ? OFFSET ?
        ]], { identifier, appType, limit, offset }) or {}
    end

    return MySQL.query.await([[
        SELECT
            sn.*,
            CASE
                WHEN sn.app_type = 'snap' THEN sa.username
                ELSE ca.username
            END as from_username,
            CASE
                WHEN sn.app_type = 'snap' THEN sa.display_name
                ELSE ca.display_name
            END as from_display_name,
            CASE
                WHEN sn.app_type = 'snap' THEN sa.avatar
                ELSE ca.avatar
            END as from_avatar,
            CASE
                WHEN sn.app_type = 'snap' THEN sa.verified
                ELSE ca.verified
            END as from_verified
        FROM phone_social_notifications sn
        LEFT JOIN phone_snap_accounts sa ON sa.identifier = sn.from_identifier AND sn.app_type = 'snap'
        LEFT JOIN phone_chirp_accounts ca ON ca.identifier = sn.from_identifier AND sn.app_type = 'chirp'
        WHERE sn.account_identifier = ?
        ORDER BY sn.created_at DESC
        LIMIT ? OFFSET ?
    ]], { identifier, limit, offset }) or {}
end)

lib.callback.register('gcphone:social:markNotificationRead', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false end
    if type(data) ~= 'table' then return false end

    local notificationId = tonumber(data.notificationId)
    if not notificationId or notificationId < 1 then return false end

    MySQL.update.await(
        'UPDATE phone_social_notifications SET is_read = 1 WHERE id = ? AND account_identifier = ?',
        { notificationId, identifier }
    )

    return true
end)

lib.callback.register('gcphone:social:markAllNotificationsRead', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false end

    data = type(data) == 'table' and data or {}
    local appType = data.appType

    if appType == 'snap' or appType == 'chirp' then
        MySQL.update.await(
            'UPDATE phone_social_notifications SET is_read = 1 WHERE account_identifier = ? AND app_type = ?',
            { identifier, appType }
        )
    else
        MySQL.update.await(
            'UPDATE phone_social_notifications SET is_read = 1 WHERE account_identifier = ?',
            { identifier }
        )
    end

    return true
end)

lib.callback.register('gcphone:social:deleteNotification', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false end
    if type(data) ~= 'table' then return false end

    local notificationId = tonumber(data.notificationId)
    if not notificationId or notificationId < 1 then return false end

    MySQL.execute.await(
        'DELETE FROM phone_social_notifications WHERE id = ? AND account_identifier = ?',
        { notificationId, identifier }
    )

    return true
end)
