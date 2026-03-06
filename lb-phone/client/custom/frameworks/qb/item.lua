if Config.Framework ~= "qb" then
    return
end

while not QB do
    Wait(500)
    debugprint("Item: Waiting for QB to load")
end

---@param itemName string
---@return boolean
function HasItem(itemName)
    if GetResourceState("ox_inventory") == "started" then
        return (exports.ox_inventory:Search("count", itemName) or 0) > 0
    end

    return QB.Functions.HasItem(itemName)
end
