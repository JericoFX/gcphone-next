if Config.Item.Inventory ~= "qs-inventory" or not Config.Item.Unique or not Config.Item.Require then
    return
end

---@param source number
---@param phoneNumber? string
---@return number | false index
---@return table? items
local function FindPhoneItemWithNumber(source, phoneNumber)
    local items = {}

    if Config.Framework == "esx" then
        items = ESX.GetPlayerFromId(source).getInventory()
    elseif Config.Framework == "qb" then
        items = QB.Functions.GetPlayer(source).PlayerData.items
    end

    for k, item in pairs(items) do
        if item?.name == Config.Item.Name and item.info.lbPhoneNumber == phoneNumber then
            return k, items
        end
    end

    return false
end

function HasPhoneNumber(source, phoneNumber)
    local hasItem = FindPhoneItemWithNumber(source, phoneNumber) ~= false

    debugprint(("does %i have item with number %s?: %s"):format(source, phoneNumber, hasItem))

    return hasItem
end

function SetPhoneNumber(source, phoneNumber)
    local index, items = FindPhoneItemWithNumber(source, nil)

    if not index or not items then
        return false
    end

    local item = items[index]

    item.info.lbPhoneNumber = phoneNumber
    item.info.lbFormattedNumber = FormatNumber(phoneNumber)

    if Config.Framework == "esx" then
        exports["qs-inventory"]:SetInventory(source, items)
    elseif Config.Framework == "qb" then
        local qPlayer = QB.Functions.GetPlayer(source)
        qPlayer.Functions.SetInventory(items, true)
    end

    return true
end

function SetItemName(source, phoneNumber, name)
    local index, items = FindPhoneItemWithNumber(source, phoneNumber)

    if not index or not items then
        return false
    end

    local item = items[index]

    item.info.lbPhoneName = name
    item.info.lbFormattedNumber = FormatNumber(phoneNumber)
    item.info.label = name

    if Config.Framework == "esx" then
        exports["qs-inventory"]:SetInventory(source, items)
    elseif Config.Framework == "qb" then
        local qPlayer = QB.Functions.GetPlayer(source)
        qPlayer.Functions.SetInventory(items, true)
    end
end

if Config.Framework == "esx" then
    exports["qs-inventory"]:CreateUsableItem(Config.Item.Name, function(source, item)
        if item then
            TriggerClientEvent("lb-phone:usePhoneItem", source, item)
        end
    end)
elseif Config.Framework == "qb" then
    QB.Functions.CreateUseableItem(Config.Item.Name, function(source, item)
        if item then
            TriggerClientEvent("lb-phone:usePhoneItem", source, item)
        end
    end)
end
