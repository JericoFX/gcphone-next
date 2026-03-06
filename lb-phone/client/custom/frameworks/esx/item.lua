if Config.Framework ~= "esx" then
    return
end

while not ESX do
    Wait(500)
    debugprint("Item: Waiting for ESX to load")
end

---@param itemName string
---@return boolean
function HasItem(itemName)
    if GetResourceState("ox_inventory") == "started" then
        return (exports.ox_inventory:Search("count", itemName) or 0) > 0
    elseif GetResourceState("qs-inventory") == "started" then
        return (exports["qs-inventory"]:Search(itemName) or 0) > 0
    end

    if ESX.SearchInventory then
        return (ESX.SearchInventory(itemName, 1) or 0) > 0
    end

    local inventory = ESX.GetPlayerData()?.inventory

    if not inventory then
        infoprint("warning", "Unsupported inventory, tell the inventory author to add support for it.")
        return false
    end

    debugprint("inventory", inventory)

    for i = 1, #inventory do
        local item = inventory[i]

        if item.name == itemName and item.count > 0 then
            return true
        end
    end

    return false
end

RegisterNetEvent("esx:removeInventoryItem", function(item, count)
    if not Config.Item.Require or Config.Item.Unique or item ~= Config.Item.Name or count > 0 then
        return
    end

    Wait(500)

    if not HasPhoneItem() then
        OnDeath()
    end
end)
