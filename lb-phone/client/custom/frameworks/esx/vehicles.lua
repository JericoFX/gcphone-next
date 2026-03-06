if Config.Framework ~= "esx" then
    return
end

while not ESX do
    Wait(500)
    debugprint("Vehicles: Waiting for ESX to load")
end

---Apply vehicle mods
---@param vehicle number
---@param vehicleData table
function ApplyVehicleMods(vehicle, vehicleData)
    if type(vehicleData.vehicle) == "string" then
        vehicleData.vehicle = json.decode(vehicleData.vehicle)
    end

    SetVehicleOnGroundProperly(vehicle)
    SetVehicleNumberPlateText(vehicle, vehicleData.vehicle.plate)

    ESX.Game.SetVehicleProperties(vehicle, vehicleData.vehicle)

    if vehicleData.damages and not Config.Valet.DisableDamages then
        SetVehicleEngineHealth(vehicle, vehicleData.damages.engineHealth)
        SetVehicleBodyHealth(vehicle, vehicleData.damages.bodyHealth)
    end

    if vehicleData.vehicle.fuel then
        SetVehicleFuelLevel(vehicle, vehicleData.vehicle.fuel)
    end

    if Config.Valet.FixTakeOut then
        SetVehicleFixed(vehicle)
    end
end

---Create a vehicle and apply vehicle mods
---@param vehicleData table
---@param coords vector3
---@return number? vehicle
function CreateFrameworkVehicle(vehicleData, coords)
    vehicleData.vehicle = json.decode(vehicleData.vehicle)
    if vehicleData.damages then
        vehicleData.damages = json.decode(vehicleData.damages)
    end

    local model = LoadModel(vehicleData.vehicle.model)
    local vehicle = CreateVehicle(model, coords.x, coords.y, coords.z, 0.0, true, false)

    SetVehicleOnGroundProperly(vehicle)
    ApplyVehicleMods(vehicle, vehicleData)
    SetModelAsNoLongerNeeded(model)

    return vehicle
end
