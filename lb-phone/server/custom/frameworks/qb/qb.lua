if Config.Framework ~= "qb" then
    return
end

debugprint("Loading QB")

QB = exports["qb-core"]:GetCoreObject()

debugprint("QB loaded")

function IsAdmin(source)
    return QB.Functions.HasPermission(source, "admin") or IsPlayerAceAllowed(source, "command.lbphone_admin") == 1
end

---@param source number
---@return string | nil
function GetIdentifier(source)
    local qPlayer = QB.Functions.GetPlayer(tonumber(source))

    if not qPlayer?.PlayerData?.citizenid then
        debugprint("GetIdentifier: Failed to get player for source:", source)
        return
    end

    return qPlayer.PlayerData.citizenid
end

---@param identifier string
---@return number?
function GetSourceFromIdentifier(identifier)
    local qPlayer = QB.Functions.GetPlayerByCitizenId(identifier)

    if qPlayer?.PlayerData?.source then
        return qPlayer.PlayerData.source
    end
end

---@param source number
---@param itemName string
---@return boolean
function HasItem(source, itemName)
    if GetResourceState("ox_inventory") == "started" then
        return (exports.ox_inventory:Search(source, "count", itemName) or 0) > 0
    elseif GetResourceState("qs-inventory") == "started" then
        return (exports["qs-inventory"]:GetItemTotalAmount(source, itemName) or 0) > 0
    end

    local qPlayer = QB.Functions.GetPlayer(tonumber(source))

    if not qPlayer then
        debugprint("HasItem: Failed to get player for source:", source)
        return false
    end

    return (qPlayer.Functions.GetItemByName(itemName)?.amount or 0) > 0
end

---Register an item as usable
---@param item string
---@param cb function
function CreateUsableItem(item, cb)
    QB.Functions.CreateUseableItem(item, cb)
end

---Get a player's character name
---@param source any
---@return string # Firstname
---@return string # Lastname
function GetCharacterName(source)
    local qPlayer = QB.Functions.GetPlayer(tonumber(source))

    if not qPlayer then
        debugprint("GetCharacterName: Failed to get qPlayer for source:", source)

        return GetPlayerName(source), ""
    end

    local characterInfo = qPlayer.PlayerData.charinfo

    return characterInfo.firstname, characterInfo.lastname
end

if Config.Crypto.QBit then
    RegisterLegacyCallback("crypto:getOtherQBitWallet", function(source, cb, otherNumber)
        local otherSrc = GetSourceFromNumber(otherNumber)

        if not otherSrc then
            return cb(false)
        end

        local otherPlayer = QB.Functions.GetPlayer(tonumber(otherSrc))

        if not otherPlayer then
            debugprint("crypto:getOtherQBitWallet: Failed to get player for source:", otherSrc)
            return cb(false)
        end

        cb(otherPlayer.PlayerData.metadata.walletid)
    end)
end
