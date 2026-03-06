if Config.Framework ~= "qbox" then
    return
end

while not QB do
    Wait(500)
    debugprint("Money: Waiting for QBox to load")
end

---Get the bank balance of a player
---@param source any
---@return integer
function GetBalance(source)
    local qPlayer = QB.Functions.GetPlayer(tonumber(source))

    if not qPlayer then
        debugprint("GetBalance: Failed to get player for source:", source)
        return 0
    end

    return qPlayer.Functions.GetMoney("bank") or 0
end

---Add money to a player's bank account
---@param source any
---@param amount integer
---@return boolean
function AddMoney(source, amount)
    local qPlayer = QB.Functions.GetPlayer(tonumber(source))

    if not qPlayer or amount < 0 then
        return false
    end

    qPlayer.Functions.AddMoney("bank", math.floor(amount + 0.5), "lb-phone")
    return true
end

---@param identifier string
---@param amount number
---@return boolean
function AddMoneyOffline(identifier, amount)
    if amount <= 0 then
        return false
    end

    amount = math.floor(amount + 0.5)

    return MySQL.update.await(
    "UPDATE players SET money = JSON_SET(money, '$.bank', JSON_EXTRACT(money, '$.bank') + ?) WHERE citizenid = ?",
        { amount, identifier }) > 0
end

---Remove money from a player's bank account
---@param source any
---@param amount integer
---@return boolean
function RemoveMoney(source, amount)
    if amount < 0 or GetBalance(source) < amount then
        return false
    end

    local qPlayer = QB.Functions.GetPlayer(tonumber(source))

    if not qPlayer then
        debugprint("RemoveMoney: Failed to get player for source:", source)
        return false
    end

    qPlayer.Functions.RemoveMoney("bank", math.floor(amount + 0.5), "lb-phone")

    return true
end
