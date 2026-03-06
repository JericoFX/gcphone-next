if Config.Framework ~= "qbox" then
    return
end

while not QB do
    Wait(500)
    debugprint("Vehicles: Waiting for QBox to load")
end

---Apply vehicle mods
---@param vehicle number
---@param vehicleData table
function ApplyVehicleMods(vehicle, vehicleData)
    if type(vehicleData.mods) == "string" then
        vehicleData.mods = json.decode(vehicleData.mods)
    end

    SetVehicleNumberPlateText(vehicle, vehicleData.plate)

    QB.Functions.SetVehicleProperties(vehicle, vehicleData.mods)
    TriggerEvent("vehiclekeys:client:SetOwner", QB.Functions.GetPlate(vehicle))

    if GetResourceState("LegacyFuel") == "started" and vehicleData.fuel then
        exports.LegacyFuel:SetFuel(vehicle, vehicleData.fuel)
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
    local hash = tonumber(vehicleData.hash)

    if not hash then
        return
    end

    local model = LoadModel(hash)
    local vehicle = CreateVehicle(model, coords.x, coords.y, coords.z, 0.0, true, false)

    SetVehicleOnGroundProperly(vehicle)
    ApplyVehicleMods(vehicle, vehicleData)
    SetModelAsNoLongerNeeded(model)

    return vehicle
end
