RegisterNUICallback("Wallet", function(data, cb)
    local action = data.action
    debugprint("Wallet:" .. (action or ""))

    if action == "getBalance" then
        TriggerCallback("wallet:getBalance", cb)
    elseif action == "getTransactions" then
        TriggerCallback("wallet:getTransactions", cb, data.page, data.recent)
    elseif action == "doesNumberExist" then
        TriggerCallback("wallet:doesNumberExist", cb, data.number)
    elseif action == "sendPayment" then
        TriggerCallback("wallet:sendPayment", cb, {
            amount = data.amount,
            phoneNumber = data.number
        })
    end
end)

RegisterNetEvent("phone:wallet:addTransaction", function(transaction)
    debugprint("phone:wallet:addTransaction:", transaction)

    SendReactMessage("wallet:addTransaction", transaction)
end)
