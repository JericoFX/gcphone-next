-- Creado/Modificado por JericoFX
-- Garage - Backend Mejorado

local VehicleLocationMessages = {
    es = 'Ubicacion del vehiculo',
    en = 'Vehicle location',
    pt = 'Localizacao do veiculo',
    fr = 'Position du vehicule',
}

-- Get vehicles with location info
lib.callback.register('gcphone:garage:getVehicles', function(source)
    local identifier = GetIdentifier(source)
    if not identifier then return {} end
    
    return MySQL.query.await([[
        SELECT g.*, 
               v.location_x, v.location_y, v.location_z,
               v.location_updated,
               CASE WHEN v.id IS NOT NULL THEN 1 ELSE 0 END as has_location
        FROM phone_garage g
        LEFT JOIN phone_garage_locations v ON g.plate = v.plate AND g.identifier = v.identifier
        WHERE g.identifier = ?
        ORDER BY g.created_at DESC
    ]], { identifier }) or {}
end)

-- Get single vehicle with full details
lib.callback.register('gcphone:garage:getVehicle', function(source, plate)
    local identifier = GetIdentifier(source)
    if not identifier or not plate then return nil end
    
    local vehicle = MySQL.single.await([[
        SELECT g.*,
               v.location_x, v.location_y, v.location_z,
               v.location_updated
        FROM phone_garage g
        LEFT JOIN phone_garage_locations v ON g.plate = v.plate AND g.identifier = v.identifier
        WHERE g.identifier = ? AND g.plate = ?
    ]], { identifier, plate })
    
    return vehicle
end)

-- Update vehicle location (when parked)
lib.callback.register('gcphone:garage:updateLocation', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier or type(data) ~= 'table' then return false end
    
    local plate = data.plate
    local x, y, z = tonumber(data.x), tonumber(data.y), tonumber(data.z)
    
    if not plate or not x or not y or not z then return false end
    
    -- Update or insert location
    local existing = MySQL.single.await(
        'SELECT id FROM phone_garage_locations WHERE identifier = ? AND plate = ?',
        { identifier, plate }
    )
    
    if existing then
        MySQL.update.await([[
            UPDATE phone_garage_locations 
            SET location_x = ?, location_y = ?, location_z = ?, location_updated = NOW()
            WHERE identifier = ? AND plate = ?
        ]], { x, y, z, identifier, plate })
    else
        MySQL.insert.await([[
            INSERT INTO phone_garage_locations (identifier, plate, location_x, location_y, location_z)
            VALUES (?, ?, ?, ?, ?)
        ]], { identifier, plate, x, y, z })
    end
    
    -- Add to history
    MySQL.insert.await([[
        INSERT INTO phone_garage_location_history (identifier, plate, location_x, location_y, location_z)
        VALUES (?, ?, ?, ?, ?)
    ]], { identifier, plate, x, y, z })
    
    return true
end)

-- Get location history
lib.callback.register('gcphone:garage:getLocationHistory', function(source, plate)
    local identifier = GetIdentifier(source)
    if not identifier or not plate then return {} end
    
    return MySQL.query.await([[
        SELECT * FROM phone_garage_location_history
        WHERE identifier = ? AND plate = ?
        ORDER BY created_at DESC
        LIMIT 20
    ]], { identifier, plate }) or {}
end)

-- Request vehicle (spawn)
lib.callback.register('gcphone:garage:requestVehicle', function(source, plate)
    local identifier = GetIdentifier(source)
    if not identifier or not plate then return false end
    
    local vehicle = MySQL.single.await(
        'SELECT * FROM phone_garage WHERE identifier = ? AND plate = ?',
        { identifier, plate }
    )
    
    if not vehicle then return false end
    
    -- Check if vehicle is not impounded
    if vehicle.impounded == 1 then
        return false, 'Vehicle is impounded'
    end
    
    TriggerClientEvent('gcphone:garage:spawnVehicle', source, vehicle)
    
    return true
end)

-- Share vehicle location with contact
lib.callback.register('gcphone:garage:shareLocation', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier or type(data) ~= 'table' then return false end
    
    local plate = data.plate
    local targetPhone = data.phoneNumber
    
    if not plate or not targetPhone then return false end
    
    -- Get current vehicle location
    local location = MySQL.single.await([[
        SELECT g.*, l.location_x, l.location_y, l.location_z
        FROM phone_garage g
        LEFT JOIN phone_garage_locations l ON g.plate = l.plate AND g.identifier = l.identifier
        WHERE g.identifier = ? AND g.plate = ?
    ]], { identifier, plate })
    
    if not location then return false end
    
    -- Get target player
    local targetIdentifier = GetIdentifierByPhone(targetPhone)
    if not targetIdentifier then return false end
    
    local targetSource = GetSourceFromIdentifier(targetIdentifier)
    if not targetSource then return false end
    
    local senderName = GetName(source)
    
    -- Send shared location
    TriggerClientEvent('gcphone:receiveSharedLocation', targetSource, {
        from = senderName,
        fromPhone = GetPhoneNumber(identifier),
        plate = plate,
        model = location.model_name or 'Vehiculo',
        x = location.location_x or data.x,
        y = location.location_y or data.y,
        z = location.location_z or data.z,
        message = data.message or VehicleLocationMessages[type(GetPhoneLanguageForSource) == 'function' and GetPhoneLanguageForSource(source, true) or 'es'] or VehicleLocationMessages.es
    })
    
    return true
end)

-- Store vehicle (return to garage)
lib.callback.register('gcphone:garage:storeVehicle', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier or type(data) ~= 'table' then return false end
    
    local plate = data.plate
    local garageName = data.garageName
    
    if not plate then return false end
    
    MySQL.update.await(
        'UPDATE phone_garage SET garage_name = ?, impounded = 0 WHERE identifier = ? AND plate = ?',
        { garageName or 'Garage', identifier, plate }
    )
    
    return true
end)

-- Get vehicle statistics
lib.callback.register('gcphone:garage:getStats', function(source, plate)
    local identifier = GetIdentifier(source)
    if not identifier or not plate then return nil end
    
    local stats = MySQL.single.await([[
        SELECT 
            COUNT(*) as total_requests,
            MAX(created_at) as last_request
        FROM phone_garage_location_history
        WHERE identifier = ? AND plate = ?
    ]], { identifier, plate })
    
    return stats or { total_requests = 0, last_request = nil }
end)

-- Export to sync vehicle from external garage systems
---Insert or update a vehicle entry for the garage app from an external garage resource.
---@param identifier string
---@param plate string
---@param model string|number
---@param modelName? string
---@param garageName? string
---@param impounded? boolean
---@param properties? table<string, any>
---@param coords? vector3|table<string, any>
---@return boolean
exports('SyncVehicle', function(identifier, plate, model, modelName, garageName, impounded, properties, coords)
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
    
    -- Update location if coords provided
    if coords and coords.x and coords.y and coords.z then
        local locationExists = MySQL.single.await(
            'SELECT id FROM phone_garage_locations WHERE identifier = ? AND plate = ?',
            { identifier, plate }
        )
        
        if locationExists then
            MySQL.update.await(
                'UPDATE phone_garage_locations SET location_x = ?, location_y = ?, location_z = ?, location_updated = NOW() WHERE id = ?',
                { coords.x, coords.y, coords.z, locationExists.id }
            )
        else
            MySQL.insert.await(
                'INSERT INTO phone_garage_locations (identifier, plate, location_x, location_y, location_z) VALUES (?, ?, ?, ?, ?)',
                { identifier, plate, coords.x, coords.y, coords.z }
            )
        end
    end
end)
