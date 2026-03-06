---Check if a player has a phone with a specific number
---@param source number
---@param number string
---@return boolean
function HasPhoneItem(source, number)
    if not Config.Item.Require then
        return true
    end

    if Config.Item.Unique then
        return HasPhoneNumber(source, number)
    end

    local hasItem = false

    if Config.Item.Name then
        hasItem = HasItem(source, Config.Item.Name)
    elseif Config.Item.Names then
        for i = 1, #Config.Item.Names do
            if HasItem(source, Config.Item.Names[i].name) then
                hasItem = true

                break
            end
        end
    end

    if not hasItem then
        return false
    end

    if not number then
        return hasItem
    end

    local equippedNumber = GetEquippedPhoneNumber(source)

    if equippedNumber then
        return equippedNumber == number
    end

    return MySQL.scalar.await(
        "SELECT 1 FROM phone_phones WHERE id = ? AND phone_number = ?",
        { GetIdentifier(source), number }
    ) ~= nil
end

exports("HasPhoneItem", HasPhoneItem)
