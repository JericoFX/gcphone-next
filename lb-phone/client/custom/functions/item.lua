local phoneVariation

---Check if the player has a phone
---@return boolean
function HasPhoneItem(number)
    if not Config.Item.Require then
        return true
    end

    if Config.Item.Unique then
        return HasPhoneNumber(number)
    end

    if Config.Item.Name then
        return HasItem(Config.Item.Name)
    end

    if phoneVariation and HasItem(Config.Item.Names[phoneVariation].name) then
        return true
    end

    if not phoneVariation then
        local storedVariation = GetResourceKvpInt("phone_variation")

        if storedVariation and Config.Item.Names[storedVariation] and HasItem(Config.Item.Names[storedVariation].name) then
            phoneVariation = storedVariation

            SetPhoneVariation(storedVariation)

            return true
        end
    end

    for i = 1, #Config.Item.Names do
        local item = Config.Item.Names[i]

        if HasItem(item.name) then
            phoneVariation = i

            SetPhoneVariation(i)

            return true
        end
    end

    return false
end

exports("HasPhoneItem", HasPhoneItem)

---@param variation number | string
RegisterNetEvent("phone:usedPhoneVariation", function(variation)
    local variationIndex

    if type(variation) == "number" then
        variationIndex = variation
    elseif type(variation) == "string" then
        for i = 1, #Config.Item.Names do
            if Config.Item.Names[i].name == variation then
                variationIndex = i
                break
            end
        end
    end

    if not variationIndex or not Config.Item.Names[variationIndex] then
        return
    end

    phoneVariation = variationIndex

    if phoneOpen then
        ToggleOpen(false)
        Wait(1000)
    end

    SetPhoneVariation(variationIndex)
    ToggleOpen(true)
end)
