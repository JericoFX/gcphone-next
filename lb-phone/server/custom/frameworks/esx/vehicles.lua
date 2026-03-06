if Config.Framework ~= "esx" then
    return
end

while not ESX do
    Wait(500)
    debugprint("Vehicles: Waiting for ESX to load")
end

---@param source number
---@return VehicleData[] vehicles # An array of vehicles that the player owns
function GetPlayerVehicles(source)
    local toSend = {}
    local vehicles = MySQL.query.await("SELECT * FROM owned_vehicles WHERE owner = ? ", { GetIdentifier(source) })

    for i = 1, #vehicles do
        local vehicle = vehicles[i] or {}

        if vehicle.stored == nil then
            vehicle.stored = vehicle.state
        end

        local impounded = false

        if type(vehicle.stored) ~= "boolean" then
            impounded = vehicle.stored == 2
            vehicle.stored = vehicle.stored == 1
        end

        if GetResourceState("cd_garage") == "started" then
            debugprint("Using cd_garage")

            impounded = vehicle.in_garage == 2
            vehicle.stored = vehicle.in_garage or vehicle.in_garage == 1
            vehicle.garage = vehicle.garage_id
            vehicle.type = vehicle.garage_type
        elseif GetResourceState("loaf_garage") == "started" then
            vehicle.stored = 1
        elseif GetResourceState("jg-advancedgarages") == "started" then
            debugprint("Using jg-advancedgarages")

            vehicle.stored = vehicle.in_garage
            vehicle.garage = vehicle.garage_id

            impounded = vehicle.impound == 1

            if impounded and vehicle.impound_data then
                vehicle.stored = false
                vehicle.pound = "Impound"

                local impoundInfo = json.decode(vehicle.impound_data)

                vehicle.impoundReason = impoundInfo and {
                    reason = impoundInfo.reason and #impoundInfo.reason > 0 and impoundInfo.reason or nil,
                    retrievable = ConvertJSTimestamp and ConvertJSTimestamp(impoundInfo.retrieval_date) or nil,
                    price = impoundInfo.retrieval_cost,
                    impounder = impoundInfo.charname
                }
            end
        end

        if GetResourceState("qs-advancedgarages") == "started" then
            vehicle.stored = vehicle.garage ~= "OUT"
        end

        local location = vehicle.stored and (vehicle.garage or "Garage") or "out"

        if impounded and vehicle.pound then
            location = vehicle.pound
        end

        ---@type VehicleData
        local newCar = {
            plate = vehicle.plate,
            type = vehicle.type,
            location = location,
            impounded = impounded,
            statistics = {},
            impoundReason = vehicle.impoundReason
        }

        if vehicle.damages then
            local damages = json.decode(vehicle.damages)

            if damages?.engineHealth then
                newCar.statistics.engine = math.floor(damages.engineHealth / 10 + 0.5)
            end

            if damages?.bodyHealth then
                newCar.statistics.body = math.floor(damages.bodyHealth / 10 + 0.5)
            end
        end

        local vehicleMods = json.decode(vehicle.vehicle)

        if vehicleMods.fuel then
            newCar.statistics.fuel = math.floor(vehicleMods.fuel + 0.5)
        end

        newCar.model = vehicleMods.model

        toSend[#toSend + 1] = newCar
    end

    return toSend
end

---Get a specific vehicle
---@param source number
---@param plate string
---@return table? vehicleData
function GetVehicle(source, plate)
    local storedCheck = "`%s` = ?"
    local storedColumn = "stored"

    ---@type any
    local storedValue = 1

    ---@type any
    local outValue = 0

    if GetResourceState("cd_garage") == "started" or GetResourceState("jg-advancedgarages") == "started" then
        storedColumn = "in_garage"
    elseif GetResourceState("qs-advancedgarages") == "started" then
        storedCheck = "`%s` != ?"
        storedColumn = "garage"
        storedValue = "OUT"
        outValue = "OUT"
    end

    storedCheck = storedCheck:format(storedColumn)

    local vehicle = MySQL.single.await(
        "SELECT * FROM owned_vehicles WHERE owner = ? AND plate = ? AND " .. storedCheck,
        { GetIdentifier(source), plate, storedValue }
    )

    if not vehicle then
        return
    end

    MySQL.update(
        "UPDATE owned_vehicles SET `" .. storedColumn .. "` = ? WHERE plate = ?",
        { outValue, plate }
    )

    vehicle.model = json.decode(vehicle.vehicle).model

    return vehicle
end
