-- Creado/Modificado por JericoFX

local Bridge = require 'server.bridge'

local ActiveLocationRecipients = {}
local LastLocationUpdateAt = {}

local function RebuildRecipientCache()
    local rows = MySQL.query.await(
        'SELECT sender_phone, recipient_phone FROM phone_live_locations WHERE expires_at > NOW()'
    ) or {}

    ActiveLocationRecipients = {}
    for _, row in ipairs(rows) do
        local senderPhone = type(row.sender_phone) == 'string' and row.sender_phone or nil
        local recipientPhone = type(row.recipient_phone) == 'string' and row.recipient_phone or nil
        if senderPhone and recipientPhone then
            local recipients = ActiveLocationRecipients[senderPhone]
            if not recipients then
                recipients = {}
                ActiveLocationRecipients[senderPhone] = recipients
            end

            recipients[#recipients + 1] = recipientPhone
        end
    end
end

local function SetRecipientsForSender(senderPhone, recipients)
    if not senderPhone then return end
    ActiveLocationRecipients[senderPhone] = recipients or {}
end

local function ClearRecipientsForSender(senderPhone)
    if not senderPhone then return end
    ActiveLocationRecipients[senderPhone] = nil
end

local PhoneToSourceCache = {}

local function RebuildPhoneToSourceCache()
    PhoneToSourceCache = {}
    local players = GetPlayers()
    for _, playerSrc in ipairs(players) do
        local src = tonumber(playerSrc)
        if src then
            local identifier = Bridge.GetIdentifier(src)
            if identifier then
                local phone = Bridge.GetPhoneNumber(identifier)
                if phone then
                    PhoneToSourceCache[phone] = src
                end
            end
        end
    end
end

local function GetPlayerByPhone(phoneNumber)
    if not phoneNumber then return nil end
    local cached = PhoneToSourceCache[phoneNumber]
    if cached and GetPlayerName(cached) then
        return cached
    end
    PhoneToSourceCache[phoneNumber] = nil
    local players = GetPlayers()
    for _, playerSrc in ipairs(players) do
        local src = tonumber(playerSrc)
        if src then
            local identifier = Bridge.GetIdentifier(src)
            if identifier then
                local phone = Bridge.GetPhoneNumber(identifier)
                if phone then
                    PhoneToSourceCache[phone] = src
                    if phone == phoneNumber then
                        return src
                    end
                end
            end
        end
    end
    return nil
end

RebuildRecipientCache()

lib.cron.new('* * * * *', function()
    RebuildRecipientCache()
end)

lib.callback.register('gcphone:liveLocation:start', function(source, data)
    local identifier = Bridge.GetIdentifier(source)
    if not identifier then
        return { success = false, error = 'INVALID_SOURCE' }
    end

    local senderPhone = Bridge.GetPhoneNumber(identifier)
    if not senderPhone then
        return { success = false, error = 'PHONE_NOT_FOUND' }
    end

    local recipients = type(data) == 'table' and data.recipients or {}
    local durationMinutes = tonumber(data and data.durationMinutes) or 15
    durationMinutes = math.min(math.max(durationMinutes, 1), 15)

    if #recipients == 0 then
        return { success = false, error = 'NO_RECIPIENTS' }
    end

    local senderName = Bridge.GetName(source) or senderPhone
    local expiresAt = os.date('%Y-%m-%d %H:%M:%S', os.time() + (durationMinutes * 60))

    local coords = GetEntityCoords(GetPlayerPed(source))
    local x, y = coords.x, coords.y

    local uniqueRecipients = {}
    local recipientList = {}
    for _, recipientPhone in ipairs(recipients) do
        if type(recipientPhone) == 'string' and recipientPhone ~= '' and recipientPhone ~= senderPhone and not uniqueRecipients[recipientPhone] then
            uniqueRecipients[recipientPhone] = true
            recipientList[#recipientList + 1] = recipientPhone
        end
    end

    if #recipientList == 0 then
        return { success = false, error = 'NO_RECIPIENTS' }
    end

    MySQL.query.await('DELETE FROM phone_live_locations WHERE sender_phone = ?', { senderPhone })

    local inserted = 0
    for _, recipientPhone in ipairs(recipientList) do
        MySQL.insert.await(
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

    SetRecipientsForSender(senderPhone, recipientList)

    return {
        success = true,
        inserted = inserted,
        expiresAt = expiresAt,
    }
end)

lib.callback.register('gcphone:liveLocation:stop', function(source)
    local identifier = Bridge.GetIdentifier(source)
    if not identifier then
        return { success = false, error = 'INVALID_SOURCE' }
    end

    local senderPhone = Bridge.GetPhoneNumber(identifier)
    if not senderPhone then
        return { success = false, error = 'PHONE_NOT_FOUND' }
    end

    MySQL.query.await('DELETE FROM phone_live_locations WHERE sender_phone = ?', { senderPhone })
    ClearRecipientsForSender(senderPhone)

    return { success = true }
end)

lib.callback.register('gcphone:liveLocation:getActive', function(source)
    local identifier = Bridge.GetIdentifier(source)
    if not identifier then
        return { success = false, locations = {} }
    end

    local myPhone = Bridge.GetPhoneNumber(identifier)
    if not myPhone then
        return { success = false, locations = {} }
    end

    local locations = MySQL.query.await(
        'SELECT sender_phone, sender_name, x, y, expires_at FROM phone_live_locations WHERE recipient_phone = ? AND expires_at > NOW()',
        { myPhone }
    ) or {}

    return { success = true, locations = locations }
end)

RegisterNetEvent('gcphone:liveLocation:updatePosition', function()
    local src = source
    local now = GetGameTimer()
    local lastUpdate = LastLocationUpdateAt[src] or 0
    if now - lastUpdate < 1000 then return end
    LastLocationUpdateAt[src] = now

    local identifier = Bridge.GetIdentifier(src)
    if not identifier then return end

    local senderPhone = Bridge.GetPhoneNumber(identifier)
    if not senderPhone then return end

    local activeShares = ActiveLocationRecipients[senderPhone] or {}
    if #activeShares == 0 then return end

    local coords = GetEntityCoords(GetPlayerPed(src))
    local x, y = coords.x, coords.y

    MySQL.query.await(
        'UPDATE phone_live_locations SET x = ?, y = ?, updated_at = NOW() WHERE sender_phone = ? AND expires_at > NOW()',
        { x, y, senderPhone }
    )

    for _, recipientPhone in ipairs(activeShares) do
        local recipientSrc = GetPlayerByPhone(recipientPhone)
        if recipientSrc then
            TriggerClientEvent('gcphone:liveLocation:updated', recipientSrc, {
                senderPhone = senderPhone,
                x = x,
                y = y,
            })
        end
    end
end)

AddEventHandler('playerDropped', function()
    local src = source
    LastLocationUpdateAt[src] = nil
    for phone, cachedSrc in pairs(PhoneToSourceCache) do
        if cachedSrc == src then
            PhoneToSourceCache[phone] = nil
            break
        end
    end
end)

return {}
