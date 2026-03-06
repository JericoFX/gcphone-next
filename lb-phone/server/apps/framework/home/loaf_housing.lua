if Config.HouseScript ~= "loaf_housing" then
    return
end

RegisterCallback("home:toggleLocked", function(source, id, uniqueId)
    local keyName = ("housing_key_%i_%s"):format(id, uniqueId)
    local hasKey = exports.loaf_keysystem:HasKey(source, keyName)

    if not hasKey then
        return false
    end

    local locked = exports.loaf_housing:IsDoorLocked(id, uniqueId)

    exports.loaf_housing:SetDoorLocked(id, uniqueId, not locked)

    return not locked
end)

RegisterCallback("home:getLocked", function(source, id, uniqueId)
    return exports.loaf_housing:IsDoorLocked(id, uniqueId)
end)
