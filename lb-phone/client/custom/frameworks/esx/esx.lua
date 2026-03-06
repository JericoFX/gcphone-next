if Config.Framework ~= "esx" then
    return
end

debugprint("Loading ESX")

local export, obj = pcall(function()
    return exports.es_extended:getSharedObject()
end)

if export then
    ESX = obj
else
    while not ESX do
        TriggerEvent("esx:getSharedObject", function(obj)
            ESX = obj
        end)

        Wait(500)
    end
end

local isFirstPlayerLoaded = true

RegisterNetEvent("esx:playerLoaded", function(playerData)
    ESX.PlayerData = playerData
    ESX.PlayerLoaded = true

    if not isFirstPlayerLoaded then
        FetchPhone()
    end

    isFirstPlayerLoaded = false
end)

RegisterNetEvent("esx:onPlayerLogout", function()
    LogOut()
end)

while not ESX.PlayerLoaded do
    Wait(500)
end

FrameworkLoaded = true

debugprint("ESX loaded")

RegisterNetEvent("esx:setAccountMoney", function(account)
    if account.name ~= "bank" then
        return
    end

    SendReactMessage("wallet:setBalance", math.floor(account.money))
end)
