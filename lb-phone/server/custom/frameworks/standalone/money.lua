if Config.Framework ~= "standalone" then
    return
end

---Get the bank balance of a player
---@param source number
---@return integer
function GetBalance(source)
    return 0
end

---Add money to a player's bank account
---@param source number
---@param amount integer
---@return boolean success
function AddMoney(source, amount)
    return true
end

---@param identifier string
---@param amount number
---@return boolean success
function AddMoneyOffline(identifier, amount)
    if amount <= 0 then
        return false
    end

    return true
end

---Remove money from a player's bank account
---@param source number
---@param amount integer
---@return boolean success
function RemoveMoney(source, amount)
    return true
end
