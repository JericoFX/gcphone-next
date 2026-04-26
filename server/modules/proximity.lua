-- Creado/Modificado por JericoFX

local Bridge = require 'server.bridge'
local Phone = require 'server.modules.phone'
local Utils = require 'server.lib.utils'

local SharedLocationLabels = {
    es = 'Ubicacion compartida',
    en = 'Shared location',
    pt = 'Localizacao compartilhada',
    fr = 'Position partagee',
}

-- Pending contact shares, keyed by the target source. A sender can only
-- register one pending share per target at a time; the receiver must echo
-- `fromServerId` back when accepting so the server can pair the request with
-- a server-derived phone number instead of trusting the client payload.
local PendingShares = {}
local PENDING_SHARE_TTL = 60

local function PurgeSharesForTarget(targetSource)
    local bucket = PendingShares[targetSource]
    if not bucket then return end
    local now = os.time()
    for senderSource, entry in pairs(bucket) do
        if entry.expiresAt < now then bucket[senderSource] = nil end
    end
    if next(bucket) == nil then PendingShares[targetSource] = nil end
end

AddEventHandler('playerDropped', function()
    local src = source
    PendingShares[src] = nil
    for _, bucket in pairs(PendingShares) do
        bucket[src] = nil
    end
end)

local function LocaleText(source, labels, fallback)
    local lang = Phone.GetPhoneLanguageForSource(source, true) or 'es'
    return labels[lang] or labels.es or fallback
end

local function IsWithinPlayerDistance(sourceA, sourceB, maxDistance)
    sourceA = tonumber(sourceA)
    sourceB = tonumber(sourceB)
    maxDistance = tonumber(maxDistance) or 3.0
    if not sourceA or sourceA <= 0 or not sourceB or sourceB <= 0 then return false, nil end

    local pedA = GetPlayerPed(sourceA)
    local pedB = GetPlayerPed(sourceB)
    if not pedA or pedA <= 0 or not pedB or pedB <= 0 then return false, nil end

    local coordsA = GetEntityCoords(pedA)
    local coordsB = GetEntityCoords(pedB)
    if not coordsA or not coordsB then return false, nil end

    local dx = coordsA.x - coordsB.x
    local dy = coordsA.y - coordsB.y
    local dz = coordsA.z - coordsB.z
    local distance = math.sqrt((dx * dx) + (dy * dy) + (dz * dz))

    return distance <= maxDistance, distance
end

local AllowedNfcPayloadRoutes = {
    chirp = true,
    snap = true,
    clips = true,
    notes = true,
    maps = true,
    radio = true,
    services = true,
    gallery = true,
    contacts = true,
    documents = true,
    wallet = true,
}

local function SanitizePayloadRoute(value, fallback)
    local route = Utils.SafeString(value, 32)
    if route and AllowedNfcPayloadRoutes[route] then return route end
    return fallback
end

lib.callback.register('gcphone:proximity:shareContact', function(source, data)
    local identifier = Bridge.GetIdentifier(source)
    if not identifier then return false, 'Invalid source' end

    local targetSource = data.targetServerId
    local contact = data.contact

    if not targetSource or not contact then
        return false, 'Invalid data'
    end

    local targetIdentifier = Bridge.GetIdentifier(targetSource)
    if not targetIdentifier then
        return false, 'Target not found'
    end

    local nearby = IsWithinPlayerDistance(source, targetSource, tonumber(Config.Proximity and Config.Proximity.ShareContactDistance) or 3.0)
    if not nearby then
        return false, 'TOO_FAR'
    end

    if Utils.HitRateLimit(source, 'proximity_share_contact', 1500, 2) then
        return false, 'RATE_LIMITED'
    end

    -- The phone number to be saved must come from the sender's record, not
    -- from client-supplied `contact.number`. Previously a nearby attacker
    -- could craft `acceptContact` with any `display`/`number` pair to inject
    -- a spoofed contact ("Police Chief" -> enemy's real number) into the
    -- victim's phonebook.
    local senderPhone = Bridge.GetPhoneNumber(identifier)
    if not senderPhone then return false, 'NO_PHONE' end

    PurgeSharesForTarget(targetSource)
    PendingShares[targetSource] = PendingShares[targetSource] or {}
    PendingShares[targetSource][source] = {
        senderPhone = senderPhone,
        senderIdentifier = identifier,
        expiresAt = os.time() + PENDING_SHARE_TTL,
    }

    local name = Bridge.GetName(source)

    TriggerClientEvent('gcphone:receiveContactRequest', targetSource, {
        fromPlayer = name,
        fromServerId = source,
        contact = {
            display = contact.display,
            number = senderPhone,
            avatar = contact.avatar
        }
    })

    return true
end)

lib.callback.register('gcphone:proximity:acceptContact', function(source, data)
    local identifier = Bridge.GetIdentifier(source)
    if not identifier then return false end
    if type(data) ~= 'table' then return false, 'Invalid data' end

    local senderSource = tonumber(data.fromServerId)
    if not senderSource then return false, 'INVALID_SENDER' end

    PurgeSharesForTarget(source)
    local bucket = PendingShares[source]
    local pending = bucket and bucket[senderSource]
    if not pending then return false, 'NO_PENDING_SHARE' end

    local number = pending.senderPhone
    local display = Utils.SafeText(data.display, 64)
    local avatar = Utils.SanitizeMediaUrl(data.avatar, {'.png','.jpg','.jpeg','.webp','.gif'}, 500)

    if not number or not display or display == '' then
        return false, 'Invalid data'
    end

    local existing = MySQL.scalar.await(
        'SELECT id FROM phone_contacts WHERE identifier = ? AND number = ?',
        { identifier, number }
    )

    if existing then
        bucket[senderSource] = nil
        return false, 'Contact already exists'
    end

    MySQL.insert.await(
        'INSERT INTO phone_contacts (identifier, number, display, avatar) VALUES (?, ?, ?, ?)',
        { identifier, number, display, avatar }
    )

    bucket[senderSource] = nil
    return true
end)

lib.callback.register('gcphone:proximity:shareLocation', function(source, data)
    local identifier = Bridge.GetIdentifier(source)
    if not identifier then return false, 'Invalid source' end

    local targetSource = data.targetServerId
    if not targetSource then
        return false, 'Invalid target'
    end

    local targetIdentifier = Bridge.GetIdentifier(targetSource)
    if not targetIdentifier then
        return false, 'Target not found'
    end

    local nearby = IsWithinPlayerDistance(source, targetSource, tonumber(Config.Proximity and Config.Proximity.ShareLocationDistance) or 5.0)
    if not nearby then
        return false, 'TOO_FAR'
    end

    if Utils.HitRateLimit(source, 'proximity_share_location', 2000, 2) then
        return false, 'RATE_LIMITED'
    end

    local name = Bridge.GetName(source)
    local sourceCoords = GetEntityCoords(GetPlayerPed(source))
    if not sourceCoords then
        return false, 'COORDS_UNAVAILABLE'
    end

    local expiresAt = os.time() + 300

    MySQL.insert.await(
        'INSERT INTO phone_shared_locations (from_identifier, to_identifier, x, y, z, message, expires_at) VALUES (?, ?, ?, ?, ?, ?, FROM_UNIXTIME(?))',
        { identifier, targetIdentifier, sourceCoords.x, sourceCoords.y, sourceCoords.z, data.message, expiresAt }
    )

    TriggerClientEvent('gcphone:receiveSharedLocation', targetSource, {
        from = name,
        fromServerId = source,
        x = sourceCoords.x,
        y = sourceCoords.y,
        z = sourceCoords.z,
        message = data.message or LocaleText(source, SharedLocationLabels, 'Ubicacion compartida'),
        expiresAt = expiresAt
    })

    return true
end)

lib.callback.register('gcphone:proximity:sharePayloadNfc', function(source, data)
    if type(data) ~= 'table' then return { success = false, error = 'INVALID_DATA' } end
    local identifier = Bridge.GetIdentifier(source)
    if not identifier then return { success = false, error = 'INVALID_SOURCE' } end

    local targetSource = tonumber(data.targetServerId)
    local payload = type(data.payload) == 'table' and data.payload or nil
    if not targetSource or not payload then
        return { success = false, error = 'INVALID_DATA' }
    end

    local targetIdentifier = Bridge.GetIdentifier(targetSource)
    if not targetIdentifier then return { success = false, error = 'TARGET_OFFLINE' } end

    local nearby = IsWithinPlayerDistance(source, targetSource, tonumber(Config.Proximity and Config.Proximity.ShareContactDistance) or 3.0)
    if not nearby then return { success = false, error = 'TOO_FAR' } end

    if Utils.HitRateLimit(source, 'proximity_share_nfc_payload', 2000, 2) then
        return { success = false, error = 'RATE_LIMITED' }
    end

    local route = SanitizePayloadRoute(payload.route or payload.appId, 'notes')
    local appId = SanitizePayloadRoute(payload.appId or route, route)
    local safePayload = {
        appId = appId,
        route = route,
        title = Utils.SafeText(payload.title, 80) or 'NFC',
        message = Utils.SafeText(payload.message, 140) or 'Contenido compartido',
        text = Utils.SafeText(payload.text, 1000),
        subject = Utils.SafeText(payload.subject, 120),
        mediaUrl = Utils.SanitizeMediaUrl(payload.mediaUrl, {'.png','.jpg','.jpeg','.webp','.gif','.mp4','.webm','.mov'}, 500),
        attachmentType = Utils.SafeString(payload.attachmentType, 24),
        attachmentName = Utils.SafeText(payload.attachmentName, 80),
        nfcAction = Utils.SafeString(payload.nfcAction, 40) or 'received_payload',
        priority = payload.priority == 'high' and 'high' or 'normal',
        x = tonumber(payload.x),
        y = tonumber(payload.y),
        z = tonumber(payload.z),
    }

    TriggerClientEvent('gcphone:receiveNfcPayload', targetSource, {
        from = Bridge.GetName(source) or 'Alguien',
        fromServerId = source,
        payload = safePayload,
    })

    return { success = true }
end)

lib.callback.register('gcphone:proximity:getSharedLocations', function(source)
    local identifier = Bridge.GetIdentifier(source)
    if not identifier then return {} end

    return MySQL.query.await(
        'SELECT id, from_identifier, from_name, to_identifier, x, y, z, label, expires_at, created_at FROM phone_shared_locations WHERE to_identifier = ? AND (expires_at IS NULL OR expires_at > NOW()) LIMIT 100',
        { identifier }
    ) or {}
end)

lib.callback.register('gcphone:proximity:sendFriendRequest', function(source, data)
    local identifier = Bridge.GetIdentifier(source)
    if not identifier then return false, 'Invalid source' end

    local targetSource = data.targetServerId
    local requestType = data.type or 'chirp'

    if not targetSource then
        return false, 'Invalid target'
    end

    local targetIdentifier = Bridge.GetIdentifier(targetSource)
    if not targetIdentifier then
        return false, 'Target not found'
    end

    local nearby = IsWithinPlayerDistance(source, targetSource, tonumber(Config.Proximity and Config.Proximity.FriendRequestDistance) or 5.0)
    if not nearby then
        return false, 'TOO_FAR'
    end

    if Utils.HitRateLimit(source, 'proximity_friend_request', 2500, 2) then
        return false, 'RATE_LIMITED'
    end

    if identifier == targetIdentifier then
        return false, 'Cannot send request to yourself'
    end

    local existing = MySQL.scalar.await(
        'SELECT status FROM phone_friend_requests WHERE from_identifier = ? AND to_identifier = ? AND type = ?',
        { identifier, targetIdentifier, requestType }
    )

    if existing then
        if existing == 'pending' then
            return false, 'Request already sent'
        elseif existing == 'accepted' then
            return false, 'Already friends'
        end
    end

    local reverseRequest = MySQL.scalar.await(
        'SELECT status FROM phone_friend_requests WHERE from_identifier = ? AND to_identifier = ? AND type = ?',
        { targetIdentifier, identifier, requestType }
    )

    if reverseRequest == 'pending' then
        MySQL.update.await(
            'UPDATE phone_friend_requests SET status = "accepted" WHERE from_identifier = ? AND to_identifier = ? AND type = ?',
            { targetIdentifier, identifier, requestType }
        )

        MySQL.insert.await(
            'INSERT INTO phone_friend_requests (from_identifier, to_identifier, type, status) VALUES (?, ?, ?, "accepted")',
            { identifier, targetIdentifier, requestType }
        )

        local name = Bridge.GetName(source)
        local targetName = Bridge.GetName(targetSource)

        TriggerClientEvent('gcphone:friendRequestAccepted', source, {
            type = requestType,
            name = targetName
        })

        TriggerClientEvent('gcphone:friendRequestAccepted', targetSource, {
            type = requestType,
            name = name
        })

        return true, 'accepted'
    end

    MySQL.insert.await(
        'INSERT INTO phone_friend_requests (from_identifier, to_identifier, type, status) VALUES (?, ?, ?, "pending")',
        { identifier, targetIdentifier, requestType }
    )

    local name = Bridge.GetName(source)

    TriggerClientEvent('gcphone:receiveFriendRequest', targetSource, {
        fromPlayer = name,
        fromServerId = source,
        type = requestType
    })

    return true, 'sent'
end)

lib.callback.register('gcphone:proximity:acceptFriendRequest', function(source, data)
    local identifier = Bridge.GetIdentifier(source)
    if not identifier then return false end
    if type(data) ~= 'table' then return false end

    local fromServerId = tonumber(data.fromServerId)
    if not fromServerId then return false end
    local fromIdentifier = Bridge.GetIdentifier(fromServerId)
    local requestType = data.type
    if not fromIdentifier or not requestType then return false end

    local affected = MySQL.update.await(
        'UPDATE phone_friend_requests SET status = "accepted" WHERE from_identifier = ? AND to_identifier = ? AND type = ? AND status = "pending"',
        { fromIdentifier, identifier, requestType }
    )
    if not affected or affected < 1 then return false end

    local fromSource = Bridge.GetSourceFromIdentifier(fromIdentifier)
    if fromSource then
        local name = Bridge.GetName(source)
        TriggerClientEvent('gcphone:friendRequestAccepted', fromSource, {
            type = requestType,
            name = name
        })
    end

    return true
end)

lib.callback.register('gcphone:proximity:rejectFriendRequest', function(source, data)
    local identifier = Bridge.GetIdentifier(source)
    if not identifier then return false end
    if type(data) ~= 'table' then return false end

    local fromServerId = tonumber(data.fromServerId)
    if not fromServerId then return false end
    local fromIdentifier = Bridge.GetIdentifier(fromServerId)
    local requestType = data.type
    if not fromIdentifier or not requestType then return false end

    local affected = MySQL.update.await(
        'UPDATE phone_friend_requests SET status = "rejected" WHERE from_identifier = ? AND to_identifier = ? AND type = ? AND status = "pending"',
        { fromIdentifier, identifier, requestType }
    )
    if not affected or affected < 1 then return false end

    return true
end)

lib.callback.register('gcphone:proximity:sharePost', function(source, data)
    local identifier = Bridge.GetIdentifier(source)
    if not identifier then return false, 'Invalid source' end

    local targetSource = data.targetServerId
    local postType = data.postType
    local postId = data.postId

    if not targetSource or not postType or not postId then
        return false, 'Invalid data'
    end

    local targetIdentifier = Bridge.GetIdentifier(targetSource)
    if not targetIdentifier then
        return false, 'Target not found'
    end

    local nearby = IsWithinPlayerDistance(source, targetSource, tonumber(Config.Proximity and Config.Proximity.ShareContactDistance) or 3.0)
    if not nearby then
        return false, 'TOO_FAR'
    end

    if Utils.HitRateLimit(source, 'proximity_share_post', 1500, 2) then
        return false, 'RATE_LIMITED'
    end

    local name = Bridge.GetName(source)

    TriggerClientEvent('gcphone:receiveSharedPost', targetSource, {
        from = name,
        fromServerId = source,
        postType = postType,
        postId = postId
    })

    return true
end)

return {}
