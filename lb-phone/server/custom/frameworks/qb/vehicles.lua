if Config.Framework ~= "qb" then
    return
end

while not QB do
    Wait(500)
    debugprint("Vehicles: Waiting for QB to load")
end

---@param source number
---@return VehicleData[] vehicles An array of vehicles that the player owns
function GetPlayerVehicles(source)
    local toSend = {}
    local vehicles = MySQL.query.await(
        "SELECT * FROM player_vehicles WHERE citizenid = ?",
        { GetIdentifier(source) }
    )

    for i = 1, #vehicles do
        local vehicle = vehicles[i] or {}

        if GetResourceState("cd_garage") == "started" then
            vehicle.state = vehicle.in_garage
            vehicle.garage = vehicle.garage_id
            vehicle.type = vehicle.garage_type
        elseif GetResourceState("loaf_garage") == "started" then
            vehicle.state = 1
        elseif GetResourceState("jg-advancedgarages") == "started" then
            vehicle.state = vehicle.in_garage
            vehicle.garage = vehicle.garage_id

            if vehicle.impound == 1 and vehicle.impound_data then
                vehicle.state = 2
                vehicle.garage = "Impound"

                local impoundInfo = json.decode(vehicle.impound_data)

                vehicle.impoundReason = impoundInfo and {
                    reason = impoundInfo.reason and #impoundInfo.reason > 0 and impoundInfo.reason or nil,
                    retrievable = ConvertJSTimestamp and ConvertJSTimestamp(impoundInfo.retrieval_date) or nil,
                    price = impoundInfo.retrieval_cost,
                    impounder = impoundInfo.charname
                }
            end
        elseif GetResourceState("qs-advancedgarages") == "started" then
            if vehicle.type == "vehicle" then
                vehicle.type = "car"
            end
        end

        local location = "unknown"

        if vehicle.state == 0 then
            location = "out"
        elseif vehicle.state == 1 or vehicle.state == true then
            location = vehicle.garage or "Garage"
        elseif vehicle.state == 2 then
            location = vehicle.garage or "Impound"
        end

        ---@type VehicleData
        local newCar = {
            plate = vehicle.plate,
            type = QB.Shared.Vehicles[vehicle.hash]?.category or vehicle.type or "car",
            location = location,
            impounded = vehicle.state == 2,
            statistics = {
                engine = math.floor(vehicle.engine / 10 + 0.5),
                body = math.floor(vehicle.body / 10 + 0.5),
                fuel = vehicle.fuel
            },
            impoundReason = vehicle.impoundReason
        }

        newCar.model = tonumber(vehicle.hash) --[[@as number]]

        toSend[#toSend + 1] = newCar
    end

    return toSend
end

---Get a specific vehicle
---@param source number
---@param plate string
---@return table? vehicleData
function GetVehicle(source, plate)
    local storedColumn = "state"
    local storedValue = 1
    local outValue = 0

    if GetResourceState("cd_garage") == "started" or GetResourceState("jg-advancedgarages") == "started" then
        storedColumn = "in_garage"
    end

    local vehicle = MySQL.single.await(([[
        SELECT plate, mods, `hash`, fuel
        FROM player_vehicles
        WHERE citizenid = ? AND plate = ? AND `%s` = ?
    ]]):format(storedColumn), { GetIdentifier(source), plate, storedValue })

    if not vehicle then
        return
    end

    MySQL.update(
        "UPDATE player_vehicles SET `" .. storedColumn .. "` = ? WHERE plate = ?",
        { outValue, plate }
    )

    vehicle.model = tonumber(vehicle.hash)

    return vehicle
end
