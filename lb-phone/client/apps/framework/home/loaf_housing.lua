if Config.HouseScript ~= "loaf_housing" then
    return
end

RegisterNUICallback("Home", function(data, cb)
    local action = data.action
    debugprint("loaf_housing - Home:" .. (action or ""))

    if action == "getHomes" then
        local ownedHouses = exports.loaf_housing:GetOwnedHouses()
        local toSend = {}

        for _, v in pairs(ownedHouses) do
            if v then
                toSend[#toSend + 1] = {
                    label = v.label .. " (" .. v.uniqueId .. ")",
                    id = v.id,
                    uniqueId = v.uniqueId,
                    locked = AwaitCallback("home:getLocked", v.id, v.uniqueId),
                    keyholders = v.keyHolders
                }
            end
        end

        cb(toSend)
    elseif action == "removeKeyholder" then
        cb(exports.loaf_housing:RemoveKeyHolder(data.id, data.identifier))
    elseif action == "addKeyholder" then
        if exports.loaf_housing:GiveKey(data.id, tonumber(data.source)) then
            SetTimeout(500, function()
                cb(exports.loaf_housing:GetKeyHolders(data.id))
            end)
        end
    elseif action == "toggleLocked" then
        local locked = AwaitCallback("home:toggleLocked", data.id, data.uniqueId)

        cb(locked)
    elseif action == "setWaypoint" then
        exports.loaf_housing:MarkProperty(data.id)
        cb(true)
    end
end)
