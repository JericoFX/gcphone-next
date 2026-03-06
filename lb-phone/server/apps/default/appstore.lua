local RegisterAppPurchaseCallback = RegisterLegacyCallback

local function handleAppPurchase(playerId, callback, appPrice)
    local phoneNumber = GetEquippedPhoneNumber(playerId)

    if not phoneNumber then
        return callback(false)
    end

    local purchaseResult = RemoveMoney(playerId, appPrice)
    callback(purchaseResult)
end

RegisterAppPurchaseCallback("appstore:buyApp", handleAppPurchase)
