if Config.Framework ~= "standalone" then
    return
end

function IsAdmin(source)
    return IsPlayerAceAllowed(source, "command.lbphone_admin") == 1
end

---@param source number
---@return string | nil
function GetIdentifier(source)
    ---@diagnostic disable-next-line: param-type-mismatch
    return GetPlayerIdentifierByType(source, "license")
end

---@param identifier string
---@return number?
function GetSourceFromIdentifier(identifier)
    local players = GetPlayers()

    for i = 1, #players do
        if GetPlayerIdentifierByType(players[i], "license") == identifier then
            ---@diagnostic disable-next-line: return-type-mismatch
            return players[i]
        end
    end
end

---@param source number
---@param itemName string
function HasItem(source, itemName)
    if GetResourceState("ox_inventory") == "started" then
        return (exports.ox_inventory:Search(source, "count", Config.Item.Name) or 0) > 0
    end

    return true
end

---Get a player's character name
---@param source number
---@return string # Firstname
---@return string # Lastname
function GetCharacterName(source)
    return GetPlayerName(source), ""
end
