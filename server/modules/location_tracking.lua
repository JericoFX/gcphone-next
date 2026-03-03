-- Creado/Modificado por JericoFX

local MySQL = exports.oxmysql

local function GetPlayerByPhone(phoneNumber)
    if not phoneNumber then return nil end
    local players = GetPlayers()
    for _, playerSrc in ipairs(players) do
        local src = tonumber(playerSrc)
        if src then
            local identifier = GetIdentifier(src)
            if identifier then
                local phone = GetPhoneNumber(identifier)
                if phone and phone == phoneNumber then
                    return src
                end
            end
        end
    end
    return nil
end

local function CleanExpiredLocations()
    MySQL.query_async('DELETE FROM phone_live_locations WHERE expires_at < NOW()')
end

SetTimeout(60000, CleanExpiredLocations)

lib.callback.register('gcphone:liveLocation:start', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then
        return { success = false, error = 'INVALID_SOURCE' }
    end

    local senderPhone = GetPhoneNumber(identifier)
    if not senderPhone then
        return { success = false, error = 'PHONE_NOT_FOUND' }
    end

    local recipients = type(data) == 'table' and data.recipients or {}
    local durationMinutes = tonumber(data and data.durationMinutes) or 15
    durationMinutes = math.min(math.max(durationMinutes, 1), 15)

    if #recipients == 0 then
        return { success = false, error = 'NO_RECIPIENTS' }
    end

    local senderName = GetName(source) or senderPhone
    local expiresAt = os.date('%Y-%m-%d %H:%M:%S', os.time() + (durationMinutes * 60))

    local coords = GetEntityCoords(GetPlayerPed(source))
    local x, y = coords.x, coords.y

    local inserted = 0
    for _, recipientPhone in ipairs(recipients) do
        if type(recipientPhone) == 'string' and recipientPhone ~= '' then
            MySQL.insert_async(
                'INSERT INTO phone_live_locations (sender_phone, sender_name, recipient_phone, x, y, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
                { senderPhone, senderName, recipientPhone, x, y, expiresAt }
            )
            inserted = inserted + 1

            local recipientSrc = GetPlayerByPhone(recipientPhone)
            if recipientSrc then
                TriggerClientEvent('gcphone:liveLocation:started', recipientSrc, {
                    senderPhone = senderPhone,
                    senderName = senderName,
                    x = x,
                    y = y,
                    expiresAt = expiresAt,
                })
            end
        end
    end

    return {
        success = true,
        inserted = inserted,
        expiresAt = expiresAt,
    }
end)

lib.callback.register('gcphone:liveLocation:stop', function(source)
    local identifier = GetIdentifier(source)
    if not identifier then
        return { success = false, error = 'INVALID_SOURCE' }
    end

    local senderPhone = GetPhoneNumber(identifier)
    if not senderPhone then
        return { success = false, error = 'PHONE_NOT_FOUND' }
    end

    MySQL.query_async('DELETE FROM phone_live_locations WHERE sender_phone = ?', { senderPhone })

    return { success = true }
end)

lib.callback.register('gcphone:liveLocation:getActive', function(source)
    local identifier = GetIdentifier(source)
    if not identifier then
        return { success = false, locations = {} }
    end

    local myPhone = GetPhoneNumber(identifier)
    if not myPhone then
        return { success = false, locations = {} }
    end

    CleanExpiredLocations()

    local locations = MySQL.query_async(
        'SELECT sender_phone, sender_name, x, y, expires_at FROM phone_live_locations WHERE recipient_phone = ? AND expires_at > NOW()',
        { myPhone }
    ) or {}

    return { success = true, locations = locations }
end)

RegisterNetEvent('gcphone:liveLocation:updatePosition', function()
    local src = source
    local identifier = GetIdentifier(src)
    if not identifier then return end

    local senderPhone = GetPhoneNumber(identifier)
    if not senderPhone then return end

    local coords = GetEntityCoords(GetPlayerPed(src))
    local x, y = coords.x, coords.y

    MySQL.query_async(
        'UPDATE phone_live_locations SET x = ?, y = ?, updated_at = NOW() WHERE sender_phone = ? AND expires_at > NOW()',
        { x, y, senderPhone }
    )

    local activeShares = MySQL.query_async(
        'SELECT recipient_phone FROM phone_live_locations WHERE sender_phone = ? AND expires_at > NOW()',
        { senderPhone }
    ) or {}

    for _, share in ipairs(activeShares) do
        local recipientSrc = GetPlayerByPhone(share.recipient_phone)
        if recipientSrc then
            TriggerClientEvent('gcphone:liveLocation:updated', recipientSrc, {
                senderPhone = senderPhone,
                x = x,
                y = y,
            })
        end
    end
end)
