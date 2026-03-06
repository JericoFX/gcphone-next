if Config.Framework ~= "esx" then
    return
end

while not ESX do
    Wait(500)
    debugprint("Money: Waiting for ESX to load")
end

---Get the bank balance of a player
---@param source any
---@return integer
function GetBalance(source)
    local xPlayer = ESX.GetPlayerFromId(source)

    return xPlayer?.getAccount("bank")?.money or 0
end

---Add money to a player's bank account
---@param source any
---@param amount integer
---@return boolean
function AddMoney(source, amount)
    local xPlayer = ESX.GetPlayerFromId(source)

    if not xPlayer or amount < 0 then
        return false
    end

    xPlayer.addAccountMoney("bank", amount)

    return true
end

---Add money to an offline player's bank account
---@param identifier string
---@param amount number
---@return boolean
function AddMoneyOffline(identifier, amount)
    if amount <= 0 then
        return false
    end

    amount = math.floor(amount + 0.5)

    return MySQL.update.await(
    "UPDATE users SET accounts = JSON_SET(accounts, '$.bank', JSON_EXTRACT(accounts, '$.bank') + ?) WHERE identifier = ?",
        { amount, identifier }) > 0
end

---Remove money from a player's bank account
---@param source any
---@param amount integer
---@return boolean
function RemoveMoney(source, amount)
    local xPlayer = ESX.GetPlayerFromId(source)

    if not xPlayer or amount < 0 or GetBalance(source) < amount then
        return false
    end

    xPlayer.removeAccountMoney("bank", amount)

    return true
end
