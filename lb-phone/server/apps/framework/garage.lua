---@alias VehicleStatistics { engine?: number, body?: number, fuel?: number }
---@alias ImpoundReason { reason?: string, retrievable?: number, price?: number, impounder?: string }
---@alias VehicleData { plate: string, type: string, location: string, model: number, impounded: boolean, statistics: VehicleStatistics, impoundReason?: ImpoundReason }

---Check if a vehicle is out
---@param plate string
---@param vehicles any
---@return boolean out
---@return number | nil vehicle
local function IsVehicleOut(plate, vehicles)
    if not vehicles then
        vehicles = GetAllVehicles()
    end

    for i = 1, #vehicles do
        local vehicle = vehicles[i]
        if DoesEntityExist(vehicle) and GetVehicleNumberPlateText(vehicle):gsub("%s+", "") == plate:gsub("%s+", "") then
            return true, vehicle
        end
    end

    return false
end

---@param plate string
BaseCallback("garage:findCar", function(source, phoneNumber, plate)
    local out, vehicle = IsVehicleOut(plate)

    if out and vehicle then
        return GetEntityCoords(vehicle)
    end

    SendNotification(phoneNumber, {
        source = source,
        app = "Garage",
        title = L("BACKEND.GARAGE.VALET"),
        content = L("BACKEND.GARAGE.COULDNT_FIND"),
    })

    return false
end)

BaseCallback("garage:getVehicles", function(source, phoneNumber)
    local vehicles = GetPlayerVehicles(source)
    local allVehicles = #vehicles > 0 and GetAllVehicles() or {}

    for i = 1, #vehicles do
        if IsVehicleOut(vehicles[i].plate, allVehicles) then
            vehicles[i].location = "out"
        end
    end

    return vehicles
end)

---@param plate string
---@param coords vector3
---@param heading number
BaseCallback("garage:valetVehicle", function(source, phoneNumber, plate, coords, heading)
    if IsVehicleOut(plate) then
        SendNotification(phoneNumber, {
            app = "Garage",
            title = L("BACKEND.GARAGE.VALET"),
            content = L("BACKEND.GARAGE.ALREADY_OUT"),
        })

        return
    end

    if Config.Valet.Price and GetBalance(source) < Config.Valet.Price then
        SendNotification(phoneNumber, {
            app = "Garage",
            title = L("BACKEND.GARAGE.VALET"),
            content = L("BACKEND.GARAGE.NO_MONEY"),
        })

        return
    end

    local vehicleData = GetVehicle(source, plate)

    if not vehicleData then
        return
    end

    if Config.Valet.Price and not RemoveMoney(source, Config.Valet.Price) then
        SendNotification(phoneNumber, {
            app = "Garage",
            title = L("BACKEND.GARAGE.VALET"),
            content = L("BACKEND.GARAGE.NO_MONEY"),
        })

        return
    end

    SendNotification(phoneNumber, {
        app = "Garage",
        title = L("BACKEND.GARAGE.VALET"),
        content = L("BACKEND.GARAGE.ON_WAY"),
    })

    if not Config.ServerSideSpawn then
        GiveVehicleKey(source, plate)

        return vehicleData
    end

    local vehicle = CreateServerVehicle(vehicleData.model, coords, heading)

    if not vehicle then
        AddMoney(source, Config.Valet.Price)
        debugprint("Failed to create vehicle")

        return
    end

    vehicleData.vehNetId = NetworkGetNetworkIdFromEntity(vehicle)

    if Config.Valet.Drive then
        ---@diagnostic disable-next-line: param-type-mismatch
        local ped = CreateServerPed(Config.Valet.Model, coords + vector3(0.0, 1.0, 1.0), heading)

        if not ped then
            AddMoney(source, Config.Valet.Price)
            DeleteEntity(vehicle)
            debugprint("Failed to create ped")
            return
        end

        vehicleData.pedNetId = NetworkGetNetworkIdFromEntity(ped)
    end

    Entity(vehicle).state.plate = plate

    GiveVehicleKey(source, plate, vehicle)

    return vehicleData
end)
