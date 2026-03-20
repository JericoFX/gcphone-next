-- Creado/Modificado por JericoFX
-- Garage - Backend Mejorado

local SecurityResource = GetCurrentResourceName()
local function HitRateLimit(source, key, windowMs, maxHits)
    local ok, blocked = pcall(function()
        return exports[SecurityResource]:HitRateLimit(source, key, windowMs, maxHits)
    end)
    if not ok then return false end
    return blocked == true
end

local VehicleLocationMessages = {
    es = 'Ubicacion del vehiculo',
    en = 'Vehicle location',
    pt = 'Localizacao do veiculo',
    fr = 'Position du vehicule',
}

-- Get vehicles with location info
lib.callback.register('gcphone:garage:getVehicles', function(source)
    if HitRateLimit(source, 'garage_vehicles', 2000, 3) then return {} end
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


---@class GaragePoint
---@field id? string
---@field label string
---@field x number
---@field y number
---@field z number
---@field h? number

---@type table<string, GaragePoint>
local SpawnPoints = {}

---@type table<string, GaragePoint>
local ImpoundLocations = {}

---@type fun(source: number): GaragePoint[]|nil
local SpawnPointProvider = nil

---@type fun(source: number): GaragePoint[]|nil
local ImpoundProvider = nil

-- ── Internal helpers ──

local function ValidatePoint(point)
    return type(point) == 'table' and point.x and point.y and point.z
end

local function NormalizePoint(id, point)
    return {
        label = point.label or tostring(id),
        x = tonumber(point.x), y = tonumber(point.y), z = tonumber(point.z),
        h = tonumber(point.h) or 0.0,
    }
end

local function InsertOne(registry, id, point)
    if type(id) ~= 'string' or not ValidatePoint(point) then return end
    registry[id] = NormalizePoint(id, point)
end

local function InsertBatch(registry, list, prefix)
    if type(list) ~= 'table' then return 0 end
    local count = 0
    for i = 1, #list do
        local entry = list[i]
        if ValidatePoint(entry) then
            local id = entry.id or ((prefix or 'batch') .. '_' .. i)
            registry[tostring(id)] = NormalizePoint(id, entry)
            count = count + 1
        end
    end
    return count
end

local function ClearByPrefix(registry, prefix)
    if not prefix then
        for k in pairs(registry) do registry[k] = nil end
        return
    end
    for k in pairs(registry) do
        if k:sub(1, #prefix) == prefix then
            registry[k] = nil
        end
    end
end

local function MergeProviderResults(registry, provider, source)
    local merged = {}
    for k, v in pairs(registry) do merged[k] = v end

    if provider then
        local ok, extra = pcall(provider, source)
        if ok and type(extra) == 'table' then
            for i = 1, #extra do
                local p = extra[i]
                if ValidatePoint(p) then
                    local id = p.id or ('provider_' .. i)
                    merged[tostring(id)] = NormalizePoint(id, p)
                end
            end
        end
    end

    return merged
end

local function RegistryToList(map)
    local list = {}
    for _, point in pairs(map) do
        list[#list + 1] = point
    end
    return list
end

local function FindNearestInMap(source, map)
    local list = RegistryToList(map)
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

-- Resolved maps (static + provider) for a given source
local function ResolveSpawnPoints(source)
    return MergeProviderResults(SpawnPoints, SpawnPointProvider, source)
end

local function ResolveImpounds(source)
    return MergeProviderResults(ImpoundLocations, ImpoundProvider, source)
end

-- ── Seed from config ──

local function SeedFromConfig()
    local cfg = Config.Garage or {}
    if type(cfg.SpawnPoints) == 'table' then
        InsertBatch(SpawnPoints, cfg.SpawnPoints, 'config_spawn')
    end
    if type(cfg.Impounds) == 'table' then
        InsertBatch(ImpoundLocations, cfg.Impounds, 'config_impound')
    end
end

SeedFromConfig()

-- ══════════════════════════════════════════════════════════════════
-- Exports: Register
-- ══════════════════════════════════════════════════════════════════

---Register a single garage spawn point.
---@param id string
---@param point GaragePoint
exports('RegisterGarageSpawnPoint', function(id, point)
    InsertOne(SpawnPoints, id, point)
end)

---Register a single impound location.
---@param id string
---@param point GaragePoint
exports('RegisterImpoundLocation', function(id, point)
    InsertOne(ImpoundLocations, id, point)
end)

---Register multiple spawn points at once.
---Each entry: { id?, label, x, y, z, h? }
---If id is omitted, auto-generates from prefix + index.
---@param list GaragePoint[]
---@param prefix? string  ID prefix (default 'batch')
---@return number count  How many were registered
exports('RegisterGarageSpawnPoints', function(list, prefix)
    return InsertBatch(SpawnPoints, list, prefix)
end)

---Register multiple impound locations at once.
---@param list GaragePoint[]
---@param prefix? string
---@return number count
exports('RegisterImpoundLocations', function(list, prefix)
    return InsertBatch(ImpoundLocations, list, prefix)
end)

-- ══════════════════════════════════════════════════════════════════
-- Exports: Remove / Clear
-- ══════════════════════════════════════════════════════════════════

---@param id string
exports('RemoveGarageSpawnPoint', function(id)
    if type(id) == 'string' then SpawnPoints[id] = nil end
end)

---@param id string
exports('RemoveImpoundLocation', function(id)
    if type(id) == 'string' then ImpoundLocations[id] = nil end
end)

---Clear spawn points. If prefix given, only clears IDs starting with it.
---@param prefix? string
exports('ClearGarageSpawnPoints', function(prefix)
    ClearByPrefix(SpawnPoints, prefix)
end)

---Clear impound locations. If prefix given, only clears IDs starting with it.
---@param prefix? string
exports('ClearImpoundLocations', function(prefix)
    ClearByPrefix(ImpoundLocations, prefix)
end)

-- ══════════════════════════════════════════════════════════════════
-- Exports: Provider callbacks (dynamic/DB-based locations)
-- ══════════════════════════════════════════════════════════════════

---Set a callback that provides additional spawn points per-request.
---Called with (source) when the phone needs to resolve the nearest spawn.
---Return an array of { id?, label, x, y, z, h? }.
---Set to nil to remove the provider.
---@param fn fun(source: number): GaragePoint[]|nil
exports('SetSpawnPointProvider', function(fn)
    SpawnPointProvider = type(fn) == 'function' and fn or nil
end)

---Set a callback that provides additional impound locations per-request.
---@param fn fun(source: number): GaragePoint[]|nil
exports('SetImpoundProvider', function(fn)
    ImpoundProvider = type(fn) == 'function' and fn or nil
end)

-- ══════════════════════════════════════════════════════════════════
-- Exports: Query
-- ══════════════════════════════════════════════════════════════════

---@return table<string, GaragePoint>
exports('GetGarageSpawnPoints', function()
    return SpawnPoints
end)

---@return table<string, GaragePoint>
exports('GetImpoundLocations', function()
    return ImpoundLocations
end)

---@param source number
---@return GaragePoint|nil
exports('GetNearestSpawnPoint', function(source)
    return FindNearestInMap(source, ResolveSpawnPoints(source))
end)

---@param source number
---@return GaragePoint|nil
exports('GetNearestImpound', function(source)
    return FindNearestInMap(source, ResolveImpounds(source))
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

    local spawnPoint = FindNearestInMap(source, ResolveSpawnPoints(source))

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
    return FindNearestInMap(source, ResolveImpounds(source))
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
