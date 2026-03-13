-- Creado/Modificado por JericoFX

local USE_SQL_CLEANUP_EVENTS = GetConvar('gcphone_sql_cleanup_events', '0') == '1'
local SecurityResource = GetCurrentResourceName()
local SharedLocationLabels = {
    es = 'Ubicacion compartida',
    en = 'Shared location',
    pt = 'Localizacao compartilhada',
    fr = 'Position partagee',
}

local function LocaleText(source, labels, fallback)
    local lang = type(GetPhoneLanguageForSource) == 'function' and GetPhoneLanguageForSource(source, true) or 'es'
    return labels[lang] or labels.es or fallback
end

local function HitRateLimit(source, key, windowMs, maxHits)
    local ok, blocked = pcall(function()
        return exports[SecurityResource]:HitRateLimit(source, key, windowMs, maxHits)
    end)

    if not ok then return false end
    return blocked == true
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

lib.callback.register('gcphone:proximity:shareContact', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false, 'Invalid source' end
    
    local targetSource = data.targetServerId
    local contact = data.contact
    
    if not targetSource or not contact then
        return false, 'Invalid data'
    end
    
    local targetIdentifier = GetIdentifier(targetSource)
    if not targetIdentifier then
        return false, 'Target not found'
    end

    local nearby = IsWithinPlayerDistance(source, targetSource, tonumber(Config.Proximity and Config.Proximity.ShareContactDistance) or 3.0)
    if not nearby then
        return false, 'TOO_FAR'
    end

    if HitRateLimit(source, 'proximity_share_contact', 1500, 2) then
        return false, 'RATE_LIMITED'
    end
    
    local name = GetName(source)
    
    TriggerClientEvent('gcphone:receiveContactRequest', targetSource, {
        fromPlayer = name,
        fromServerId = source,
        contact = {
            display = contact.display,
            number = contact.number,
            avatar = contact.avatar
        }
    })
    
    return true
end)

lib.callback.register('gcphone:proximity:acceptContact', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false end
    
    if not data.display or not data.number then
        return false, 'Invalid data'
    end
    
    local existing = MySQL.scalar.await(
        'SELECT id FROM phone_contacts WHERE identifier = ? AND number = ?',
        { identifier, data.number }
    )
    
    if existing then
        return false, 'Contact already exists'
    end
    
    MySQL.insert.await(
        'INSERT INTO phone_contacts (identifier, number, display, avatar) VALUES (?, ?, ?, ?)',
        { identifier, data.number, data.display, data.avatar or nil }
    )
    
    return true
end)

lib.callback.register('gcphone:proximity:shareLocation', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false, 'Invalid source' end
    
    local targetSource = data.targetServerId
    if not targetSource then
        return false, 'Invalid target'
    end
    
    local targetIdentifier = GetIdentifier(targetSource)
    if not targetIdentifier then
        return false, 'Target not found'
    end

    local nearby = IsWithinPlayerDistance(source, targetSource, tonumber(Config.Proximity and Config.Proximity.ShareLocationDistance) or 5.0)
    if not nearby then
        return false, 'TOO_FAR'
    end

    if HitRateLimit(source, 'proximity_share_location', 2000, 2) then
        return false, 'RATE_LIMITED'
    end
    
    local name = GetName(source)
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

lib.callback.register('gcphone:proximity:getSharedLocations', function(source)
    local identifier = GetIdentifier(source)
    if not identifier then return {} end
    
    return MySQL.query.await(
        'SELECT * FROM phone_shared_locations WHERE to_identifier = ? AND (expires_at IS NULL OR expires_at > NOW())',
        { identifier }
    ) or {}
end)

lib.callback.register('gcphone:proximity:sendFriendRequest', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false, 'Invalid source' end
    
    local targetSource = data.targetServerId
    local requestType = data.type or 'chirp'
    
    if not targetSource then
        return false, 'Invalid target'
    end
    
    local targetIdentifier = GetIdentifier(targetSource)
    if not targetIdentifier then
        return false, 'Target not found'
    end

    local nearby = IsWithinPlayerDistance(source, targetSource, tonumber(Config.Proximity and Config.Proximity.FriendRequestDistance) or 5.0)
    if not nearby then
        return false, 'TOO_FAR'
    end

    if HitRateLimit(source, 'proximity_friend_request', 2500, 2) then
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
        
        local name = GetName(source)
        local targetName = GetName(targetSource)
        
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
    
    local name = GetName(source)
    
    TriggerClientEvent('gcphone:receiveFriendRequest', targetSource, {
        fromPlayer = name,
        fromServerId = source,
        type = requestType
    })
    
    return true, 'sent'
end)

lib.callback.register('gcphone:proximity:acceptFriendRequest', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false end
    if type(data) ~= 'table' then return false end
    
    local fromIdentifier = data.fromIdentifier
    if not fromIdentifier and data.fromServerId then
        fromIdentifier = GetIdentifier(tonumber(data.fromServerId))
    end
    local requestType = data.type
    if not fromIdentifier or not requestType then return false end
    
    MySQL.update.await(
        'UPDATE phone_friend_requests SET status = "accepted" WHERE from_identifier = ? AND to_identifier = ? AND type = ?',
        { fromIdentifier, identifier, requestType }
    )
    
    local fromSource = GetSourceFromIdentifier(fromIdentifier)
    if fromSource then
        local name = GetName(source)
        TriggerClientEvent('gcphone:friendRequestAccepted', fromSource, {
            type = requestType,
            name = name
        })
    end
    
    return true
end)

lib.callback.register('gcphone:proximity:rejectFriendRequest', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false end
    if type(data) ~= 'table' then return false end
    
    local fromIdentifier = data.fromIdentifier
    if not fromIdentifier and data.fromServerId then
        fromIdentifier = GetIdentifier(tonumber(data.fromServerId))
    end
    local requestType = data.type
    if not fromIdentifier or not requestType then return false end
    
    MySQL.update.await(
        'UPDATE phone_friend_requests SET status = "rejected" WHERE from_identifier = ? AND to_identifier = ? AND type = ?',
        { fromIdentifier, identifier, requestType }
    )
    
    return true
end)

lib.callback.register('gcphone:proximity:sharePost', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false, 'Invalid source' end
    
    local targetSource = data.targetServerId
    local postType = data.postType
    local postId = data.postId
    
    if not targetSource or not postType or not postId then
        return false, 'Invalid data'
    end
    
    local targetIdentifier = GetIdentifier(targetSource)
    if not targetIdentifier then
        return false, 'Target not found'
    end

    local nearby = IsWithinPlayerDistance(source, targetSource, tonumber(Config.Proximity and Config.Proximity.ShareContactDistance) or 3.0)
    if not nearby then
        return false, 'TOO_FAR'
    end

    if HitRateLimit(source, 'proximity_share_post', 1500, 2) then
        return false, 'RATE_LIMITED'
    end
    
    local name = GetName(source)
    
    TriggerClientEvent('gcphone:receiveSharedPost', targetSource, {
        from = name,
        fromServerId = source,
        postType = postType,
        postId = postId
    })
    
    return true
end)

if not USE_SQL_CLEANUP_EVENTS then
    -- Verified: CommunityOX ox_lib Cron/Server runs cron expressions with minute precision
    lib.cron.new('* * * * *', function()
        MySQL.execute.await(
            'DELETE FROM phone_shared_locations WHERE expires_at IS NOT NULL AND expires_at < NOW()'
        )
    end)
end
