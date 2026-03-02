-- gcphone-next Server Module: Garage
-- Vehicle management
-- Verified: ox_lib callback pattern

lib.callback.register('gcphone:getGarage', function(source)
    local identifier = GetIdentifier(source)
    if not identifier then return {} end
    
    return MySQL.query.await(
        'SELECT * FROM phone_garage WHERE identifier = ? ORDER BY created_at DESC',
        { identifier }
    ) or {}
end)

lib.callback.register('gcphone:setVehicleLocation', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false end
    
    MySQL.update.await(
        'UPDATE phone_garage SET garage_name = ?, impounded = ? WHERE identifier = ? AND plate = ?',
        { data.garageName, data.impounded and 1 or 0, identifier, data.plate }
    )
    
    return true
end)

lib.callback.register('gcphone:requestVehicle', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false end
    
    local vehicle = MySQL.single.await(
        'SELECT * FROM phone_garage WHERE identifier = ? AND plate = ?',
        { identifier, data.plate }
    )
    
    if not vehicle then return false end
    
    TriggerClientEvent('gcphone:garage:requestVehicle', source, vehicle)
    
    return true
end)

lib.callback.register('gcphone:shareVehicleLocation', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false end
    
    local targetIdentifier = GetIdentifierByPhone(data.phoneNumber)
    if not targetIdentifier then return false end
    
    local targetSource = GetSourceFromIdentifier(targetIdentifier)
    if not targetSource then return false end
    
    local name = GetName(source)
    
    TriggerClientEvent('gcphone:receiveSharedLocation', targetSource, {
        from = name,
        x = data.x,
        y = data.y,
        z = data.z,
        message = data.message or 'Ubicación de vehículo'
    })
    
    return true
end)

exports('SyncVehicle', function(identifier, plate, model, modelName, garageName, impounded, properties)
    local existing = MySQL.single.await(
        'SELECT id FROM phone_garage WHERE identifier = ? AND plate = ?',
        { identifier, plate }
    )
    
    if existing then
        MySQL.update.await(
            'UPDATE phone_garage SET model = ?, model_name = ?, garage_name = ?, impounded = ?, properties = ? WHERE id = ?',
            { model, modelName, garageName, impounded and 1 or 0, json.encode(properties), existing.id }
        )
    else
        MySQL.insert.await(
            'INSERT INTO phone_garage (identifier, plate, model, model_name, garage_name, impounded, properties) VALUES (?, ?, ?, ?, ?, ?, ?)',
            { identifier, plate, model, modelName, garageName, impounded and 1 or 0, json.encode(properties) }
        )
    end
end)
