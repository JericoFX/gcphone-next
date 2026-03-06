if Config.HouseScript ~= "qs-housing" then
    return
end

local function QuasarHousingCallback(event, cb, ...)
    if QB then
        QB.Functions.TriggerCallback(event, cb, ...)
    elseif ESX then
        ESX.TriggerServerCallback(event, cb, ...)
    end
end

RegisterNUICallback("Home", function(data, cb)
    local action, houseData = data.action, data.houseData
    debugprint("qs-housing - Home:" .. (action or ""))

    if action == "getHomes" then
        TriggerCallback("home:getOwnedHouses", cb)
    elseif action == "removeKeyholder" then
        QuasarHousingCallback("housing:takeKey", function(success)
            if not success then
                return cb(false)
            end

            TriggerCallback("home:getKeyHolders", cb, houseData.house)
        end, houseData.house, {
            firstname = "",
            lastname = "",
            citizenid = data.identifier
        })
    elseif action == "addKeyholder" then
        QuasarHousingCallback("housing:giveKey", function(success)
            if not success then
                return cb(false)
            end

            TriggerCallback("home:getKeyHolders", cb, houseData.house)
        end, tonumber(data.source), houseData.house)
    elseif action == "setWaypoint" then
        if houseData.coords then
            SetNewWaypoint(houseData.coords.x, houseData.coords.y)
        end

        cb(true)
    end
end)
