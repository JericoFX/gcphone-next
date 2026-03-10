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

exports('GetGallery', function(identifier)
    return MySQL.query.await(
        'SELECT id, url, type, created_at FROM phone_gallery WHERE identifier = ? ORDER BY created_at DESC',
        { identifier }
    ) or {}
end)
