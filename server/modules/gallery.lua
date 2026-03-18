-- Creado/Modificado por JericoFX

lib.callback.register('gcphone:getGallery', function(source)
    local identifier = GetPhoneOwnerIdentifier(source, true)
    if not identifier then return {} end
    
    return MySQL.query.await(
        'SELECT id, url, type, created_at FROM phone_gallery WHERE identifier = ? ORDER BY created_at DESC',
        { identifier }
    ) or {}
end)

lib.callback.register('gcphone:savePhoto', function(source, data)
    if IsPhoneReadOnly(source) then return false end
    local identifier = GetIdentifier(source)
    if not identifier then return false end
    
    if not data.url then
        return false, 'No photo URL provided'
    end
    
    local id = MySQL.insert.await(
        'INSERT INTO phone_gallery (identifier, url, type) VALUES (?, ?, ?)',
        { identifier, data.url, data.type or 'image' }
    )
    
    return true, id
end)

lib.callback.register('gcphone:deletePhoto', function(source, photoId)
    if IsPhoneReadOnly(source) then return false end
    local identifier = GetIdentifier(source)
    if not identifier then return false end
    
    MySQL.execute.await(
        'DELETE FROM phone_gallery WHERE id = ? AND identifier = ?',
        { photoId, identifier }
    )
    
    return true
end)

lib.callback.register('gcphone:setPhotoAsWallpaper', function(source, data)
    if IsPhoneReadOnly(source) then return false end
    local identifier = GetIdentifier(source)
    if not identifier then return false end
    
    local photo = MySQL.single.await(
        'SELECT url FROM phone_gallery WHERE id = ? AND identifier = ?',
        { data.photoId, identifier }
    )
    
    if not photo then return false end
    
    MySQL.update.await(
        'UPDATE phone_numbers SET wallpaper = ? WHERE identifier = ?',
        { photo.url, identifier }
    )
    
    TriggerClientEvent('gcphone:wallpaperUpdated', source, photo.url)
    
    return true
end)

lib.callback.register('gcphone:gallery:shareNfc', function(source, data)
    if IsPhoneReadOnly(source) then return { success = false, error = 'READONLY' } end
    local identifier = GetIdentifier(source)
    if not identifier then return { success = false, error = 'INVALID_SOURCE' } end

    local photoId = tonumber(type(data) == 'table' and data.photoId or nil)
    local targetServerId = tonumber(type(data) == 'table' and data.targetServerId or nil)
    if not photoId or not targetServerId then
        return { success = false, error = 'INVALID_DATA' }
    end

    local targetIdentifier = GetIdentifier(targetServerId)
    if not targetIdentifier then
        return { success = false, error = 'TARGET_OFFLINE' }
    end

    if type(IsPlayerActionAllowed) == 'function' then
        local allowed = IsPlayerActionAllowed(targetServerId)
        if not allowed then return { success = false, error = 'TARGET_UNAVAILABLE' } end
    end

    local shareDistance = tonumber(Config.Proximity and Config.Proximity.SharePhotoDistance) or 3.0
    local near = IsWithinPlayerDistance(source, targetServerId, shareDistance)
    if not near then
        return { success = false, error = 'TOO_FAR' }
    end

    local photo = MySQL.single.await(
        'SELECT id, url, type FROM phone_gallery WHERE id = ? AND identifier = ?',
        { photoId, identifier }
    )
    if not photo then
        return { success = false, error = 'PHOTO_NOT_FOUND' }
    end

    local senderName = GetName(source) or 'Ciudadano'

    TriggerClientEvent('gcphone:receiveSharedPhoto', targetServerId, {
        url = photo.url,
        type = photo.type or 'image',
        from = senderName,
        shared_at = os.date('%Y-%m-%d %H:%M:%S'),
    })

    return { success = true }
end)

local function CanAccessIdentifierExport(identifier, requestSource)
    local src = tonumber(requestSource)
    if not src or src <= 0 or not identifier then
        return false
    end

    local ownerIdentifier = GetPhoneOwnerIdentifier and GetPhoneOwnerIdentifier(src, true) or GetIdentifier(src)
    return ownerIdentifier ~= nil and ownerIdentifier == identifier
end

---Get gallery media for a phone owner identifier.
---@param identifier string
---@param requestSource integer
---@return table[]
exports('GetGallery', function(identifier, requestSource)
    if not CanAccessIdentifierExport(identifier, requestSource) then
        return {}
    end

    return MySQL.query.await(
        'SELECT id, url, type, created_at FROM phone_gallery WHERE identifier = ? ORDER BY created_at DESC',
        { identifier }
    ) or {}
end)
