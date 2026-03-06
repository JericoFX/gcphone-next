if Config.Framework ~= "qbox" then
    return
end

debugprint("Loading Qbox")

QB = exports["qb-core"]:GetCoreObject()

PlayerJob = {}
PlayerData = {}

while not LocalPlayer.state.isLoggedIn do
    Wait(500)
end

FrameworkLoaded = true

debugprint("Qbox loaded")

PlayerJob = QB.Functions.GetPlayerData().job
PlayerData = QB.Functions.GetPlayerData()

RegisterNetEvent("QBCore:Client:OnPlayerLoaded", function()
    PlayerData = QB.Functions.GetPlayerData()

    FetchPhone()
end)

RegisterNetEvent("QBCore:Client:OnPlayerUnload", function()
    PlayerData = {}

    LogOut()
end)

RegisterNetEvent("QBCore:Player:SetPlayerData", function(newData)
    PlayerData = newData

    if not Config.Item.Require or Config.Item.Unique then
        return
    end

    Wait(500)

    if currentPhone and not HasPhoneItem() then
        OnDeath()
    end
end)

RegisterNetEvent("QBCore:Client:OnMoneyChange", function(moneyType)
    if moneyType ~= "bank" then
        return
    end

    SendReactMessage("wallet:setBalance", math.floor(PlayerData.money.bank))
end)

function CanOpenPhone()
    local metadata = QB.Functions.GetPlayerData().metadata

    if metadata.ishandcuffed or metadata.isdead or metadata.inlaststand then
        return false
    end

    return true
end
