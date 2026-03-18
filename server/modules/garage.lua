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

-- ══════════════════════════════════════════════════════════════════
-- Runtime location registry
-- Seeded from Config, extended at runtime via exports.
-- Other resources can call:
--   exports['gcphone-next']:RegisterGarageSpawnPoint(id, { label, x, y, z, h })
--   exports['gcphone-next']:RegisterImpoundLocation(id, { label, x, y, z })
--   exports['gcphone-next']:RemoveGarageSpawnPoint(id)
--   exports['gcphone-next']:RemoveImpoundLocation(id)
--   exports['gcphone-next']:GetGarageSpawnPoints()   → { [id] = point }
--   exports['gcphone-next']:GetImpoundLocations()     → { [id] = point }
--   exports['gcphone-next']:GetNearestSpawnPoint(source)  → point|nil
--   exports['gcphone-next']:GetNearestImpound(source)     → point|nil
-- ══════════════════════════════════════════════════════════════════

---@class GaragePoint
---@field label string
---@field x number
---@field y number
---@field z number
---@field h? number  heading (spawn points only)

---@type table<string, GaragePoint>
local SpawnPoints = {}

---@type table<string, GaragePoint>
local ImpoundLocations = {}

-- Seed from config
local function SeedFromConfig()
    local cfg = Config.Garage or {}

    if type(cfg.SpawnPoints) == 'table' then
        for i, p in ipairs(cfg.SpawnPoints) do
            if p.x and p.y and p.z then
                SpawnPoints['config_spawn_' .. i] = {
                    label = p.label or ('Garage ' .. i),
                    x = tonumber(p.x), y = tonumber(p.y), z = tonumber(p.z),
                    h = tonumber(p.h) or 0.0,
                }
            end
        end
    end

    if type(cfg.Impounds) == 'table' then
        for i, p in ipairs(cfg.Impounds) do
            if p.x and p.y and p.z then
                ImpoundLocations['config_impound_' .. i] = {
                    label = p.label or ('Deposito ' .. i),
                    x = tonumber(p.x), y = tonumber(p.y), z = tonumber(p.z),
                }
            end
        end
    end
end

SeedFromConfig()

-- Helpers

local function RegistryToList(registry)
    local list = {}
    for _, point in pairs(registry) do
        list[#list + 1] = point
    end
    return list
end

local function FindNearestPoint(source, registry)
    local list = RegistryToList(registry)
    if #list == 0 then return nil end

    local ped = GetPlayerPed(source)
    if not ped or ped <= 0 then return list[1] end

    local playerCoords = GetEntityCoords(ped)
    local nearest = list[1]
    local nearestDist = math.huge

    for i = 1, #list do
        local p = list[i]
        local dx = playerCoords.x - (p.x or 0)
        local dy = playerCoords.y - (p.y or 0)
        local dz = playerCoords.z - (p.z or 0)
        local dist = dx * dx + dy * dy + dz * dz
        if dist < nearestDist then
            nearestDist = dist
            nearest = p
        end
    end

    return nearest
end

-- ── Exports: Register / Remove ──

---Register a garage spawn point where vehicles will be delivered.
---@param id string Unique identifier (e.g. 'mygarage_legion')
---@param point GaragePoint { label, x, y, z, h }
exports('RegisterGarageSpawnPoint', function(id, point)
    if type(id) ~= 'string' or type(point) ~= 'table' then return end
    if not point.x or not point.y or not point.z then return end
    SpawnPoints[id] = {
        label = point.label or id,
        x = tonumber(point.x), y = tonumber(point.y), z = tonumber(point.z),
        h = tonumber(point.h) or 0.0,
    }
end)

---Register an impound lot location.
---@param id string Unique identifier (e.g. 'impound_lspd')
---@param point GaragePoint { label, x, y, z }
exports('RegisterImpoundLocation', function(id, point)
    if type(id) ~= 'string' or type(point) ~= 'table' then return end
    if not point.x or not point.y or not point.z then return end
    ImpoundLocations[id] = {
        label = point.label or id,
        x = tonumber(point.x), y = tonumber(point.y), z = tonumber(point.z),
    }
end)

---Remove a previously registered spawn point.
---@param id string
exports('RemoveGarageSpawnPoint', function(id)
    if type(id) == 'string' then SpawnPoints[id] = nil end
end)

---Remove a previously registered impound location.
---@param id string
exports('RemoveImpoundLocation', function(id)
    if type(id) == 'string' then ImpoundLocations[id] = nil end
end)

-- ── Exports: Query ──

---Get all registered spawn points.
---@return table<string, GaragePoint>
exports('GetGarageSpawnPoints', function()
    return SpawnPoints
end)

---Get all registered impound locations.
---@return table<string, GaragePoint>
exports('GetImpoundLocations', function()
    return ImpoundLocations
end)

---Get the nearest spawn point to a player.
---@param source number Server ID
---@return GaragePoint|nil
exports('GetNearestSpawnPoint', function(source)
    return FindNearestPoint(source, SpawnPoints)
end)

---Get the nearest impound location to a player.
---@param source number Server ID
---@return GaragePoint|nil
exports('GetNearestImpound', function(source)
    return FindNearestPoint(source, ImpoundLocations)
end)

-- ── Callbacks ──

-- Request vehicle (spawn at nearest garage spawn point)
lib.callback.register('gcphone:garage:requestVehicle', function(source, plate)
    local identifier = GetIdentifier(source)
    if not identifier or not plate then return false end

    local vehicle = MySQL.single.await(
        'SELECT * FROM phone_garage WHERE identifier = ? AND plate = ?',
        { identifier, plate }
    )

    if not vehicle then return false end

    if vehicle.impounded == 1 then
        return false, 'Vehicle is impounded'
    end

    local spawnPoint = FindNearestPoint(source, SpawnPoints)

    if spawnPoint then
        vehicle._spawnX = spawnPoint.x
        vehicle._spawnY = spawnPoint.y
        vehicle._spawnZ = spawnPoint.z
        vehicle._spawnH = spawnPoint.h or 0.0
        vehicle._spawnLabel = spawnPoint.label
    end

    TriggerClientEvent('gcphone:garage:spawnVehicle', source, vehicle)

    return true
end)

-- Get nearest impound location for GPS
lib.callback.register('gcphone:garage:getImpoundLocation', function(source)
    return FindNearestPoint(source, ImpoundLocations)
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
