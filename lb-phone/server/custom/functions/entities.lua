if not Config.ServerSideSpawn then
    return
end

local allowedModels = {
    [`prop_amp_phone`] = true,
    [Config.PhoneModel] = true,
}

if Config.Item.Names then
    for i = 1, #Config.Item.Names do
        allowedModels[Config.Item.Names[i].model] = true
    end
end

---@param entity number
---@return boolean exists
local function WaitForEntity(entity)
    local timer = GetGameTimer() + 5000

    while not DoesEntityExist(entity) and timer > GetGameTimer() do
        Wait(0)
    end

    return DoesEntityExist(entity)
end

---@param source any
---@param model number
---@return number? phoneEntity
function CreatePhoneObject(source, model)
    local playerPed = GetPlayerPed(source)
    local coords = GetEntityCoords(playerPed)
    local phone = CreateObjectNoOffset(model, coords.x, coords.y, coords.z, true, true, false)

    if not WaitForEntity(phone) then
        return
    end

    -- allow the player to take control of the phone, so they can attach it
    SetEntityIgnoreRequestControlFilter(phone, true)

    return phone
end

RegisterLegacyCallback("createPhoneObject", function(source, cb, model)
    if not allowedModels[model] then
        infoprint("warning",
            ("%s | %i tried to create a phone object with a model (%s) that's not allowed"):format(GetPlayerName(source),
                source, tostring(model)))
        cb(false)
        return
    end

    debugprint("Creating phone object for", source)
    local phone = CreatePhoneObject(source, model)

    if phone then
        cb(NetworkGetNetworkIdFromEntity(phone))
    else
        cb(false)
    end
end)

RegisterNetEvent("phone:failedControl", function(netId)
    local src = source
    local entity = NetworkGetEntityFromNetworkId(netId)
    local entityModel = entity and GetEntityModel(entity)

    if entityModel and allowedModels[entityModel] then
        debugprint(src .. " failed to take control of phone object, deleting it.")
        DeleteEntity(entity)
    end
end)

---@param model number
---@param coords vector3
---@param heading? number
---@return number? vehicle
function CreateServerVehicle(model, coords, heading)
    heading = heading or 0
    local vehicle = CreateVehicle(model, coords.x, coords.y, coords.z, heading, true, true)

    if not WaitForEntity(vehicle) then
        return
    end

    -- allow the player to take control of the vehicle, so they can set mods
    SetEntityIgnoreRequestControlFilter(vehicle, true)

    return vehicle
end

---@param model number
---@param coords vector3
---@param heading? number
---@return number? ped
function CreateServerPed(model, coords, heading)
    heading = heading or 0

    local ped = CreatePed(4, model, coords.x, coords.y, coords.z, heading, true, true)

    if not WaitForEntity(ped) then
        return
    end

    SetEntityIgnoreRequestControlFilter(ped, true)

    return ped
end
