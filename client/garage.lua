-- Garage vehicle spawn handler
-- Receives vehicle data from server after gcphone:garage:requestVehicle validates ownership

local function LoadModel(model)
    local hash = type(model) == 'number' and model or joaat(model)
    if not IsModelValid(hash) then return nil end

    RequestModel(hash)
    local timeout = 50
    while not HasModelLoaded(hash) and timeout > 0 do
        Wait(100)
        timeout = timeout - 1
    end

    if not HasModelLoaded(hash) then return nil end
    return hash
end

local function ApplyVehicleProperties(vehicle, properties)
    if not properties or properties == '' then return end

    local props = type(properties) == 'string' and json.decode(properties) or properties
    if type(props) ~= 'table' then return end

    -- QBCore / QBox
    if Config.Framework == 'qbcore' or Config.Framework == 'qbox' then
        local ok, QBCore = pcall(exports['qb-core'].GetCoreObject, exports['qb-core'])
        if ok and QBCore and QBCore.Functions and QBCore.Functions.SetVehicleProperties then
            QBCore.Functions.SetVehicleProperties(vehicle, props)
            return
        end
    end

    -- ESX (uses ox_lib setVehicleProperties if available)
    if Config.Framework == 'esx' then
        local ok = pcall(lib.setVehicleProperties, vehicle, props)
        if ok then return end
    end

    -- Fallback: apply basic properties with natives
    if props.color1 and props.color2 then
        SetVehicleColours(vehicle, props.color1, props.color2)
    end
    if props.dirtLevel then
        SetVehicleDirtLevel(vehicle, props.dirtLevel + 0.0)
    end
end

local function GiveVehicleKeys(vehicle, plate)
    if Config.Framework == 'qbcore' or Config.Framework == 'qbox' then
        pcall(function()
            TriggerEvent('vehiclekeys:client:SetOwner', plate)
        end)
    end
end

local function SetGpsWaypoint(x, y)
    SetNewWaypoint(x + 0.0, y + 0.0)
end

RegisterNetEvent('gcphone:garage:spawnVehicle', function(vehicle)
    if type(vehicle) ~= 'table' or not vehicle.model then return end

    local hash = LoadModel(vehicle.model)
    if not hash then
        lib.notify({
            title = 'Garage',
            description = 'No se pudo cargar el modelo del vehiculo',
            type = 'error',
        })
        return
    end

    -- Use spawn point from server (nearest garage) or fallback to player position
    local spawnX = tonumber(vehicle._spawnX)
    local spawnY = tonumber(vehicle._spawnY)
    local spawnZ = tonumber(vehicle._spawnZ)
    local spawnH = tonumber(vehicle._spawnH) or 0.0
    local spawnLabel = vehicle._spawnLabel

    if not spawnX or not spawnY or not spawnZ then
        -- Fallback: 3m in front of the player
        local ped = cache.ped
        local coords = GetEntityCoords(ped)
        local heading = GetEntityHeading(ped)
        local rad = heading * math.pi / 180.0
        spawnX = coords.x + (-math.sin(rad) * 3.0)
        spawnY = coords.y + (math.cos(rad) * 3.0)
        spawnZ = coords.z
        spawnH = heading
        spawnLabel = nil
    end

    local veh = CreateVehicle(hash, spawnX, spawnY, spawnZ, spawnH, true, false)

    if not DoesEntityExist(veh) then
        SetModelAsNoLongerNeeded(hash)
        lib.notify({
            title = 'Garage',
            description = 'No se pudo crear el vehiculo',
            type = 'error',
        })
        return
    end

    if vehicle.plate then
        SetVehicleNumberPlateText(veh, vehicle.plate)
    end

    ApplyVehicleProperties(veh, vehicle.properties)
    GiveVehicleKeys(veh, vehicle.plate)
    SetVehicleOnGroundProperly(veh)
    SetModelAsNoLongerNeeded(hash)

    -- Set GPS waypoint to the spawn point so the player can find it
    if spawnLabel then
        SetGpsWaypoint(spawnX, spawnY)
        lib.notify({
            title = 'Garage',
            description = ('Tu %s te espera en %s'):format(vehicle.model_name or vehicle.plate or 'vehiculo', spawnLabel),
            type = 'success',
        })
    else
        lib.notify({
            title = 'Garage',
            description = ('Vehiculo %s listo'):format(vehicle.model_name or vehicle.plate or ''),
            type = 'success',
        })
    end
end)
