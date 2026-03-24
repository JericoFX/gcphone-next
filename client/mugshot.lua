local mugshotHandle = nil
local mugshotPromise = nil

RegisterNUICallback('mugshotResult', function(data, cb)
    cb('ok')
    if mugshotHandle then
        UnregisterPedheadshot(mugshotHandle)
        mugshotHandle = nil
    end
    if mugshotPromise then
        mugshotPromise:resolve(data.base64 or '')
        mugshotPromise = nil
    end
end)

RegisterNUICallback('captureMugshot', function(_, cb)
    local ped = PlayerPedId()
    local handle = RegisterPedheadshot(ped)
    local timer = 2000

    while (not IsPedheadshotReady(handle) or not IsPedheadshotValid(handle)) and timer > 0 do
        Wait(10)
        timer = timer - 10
    end

    if not IsPedheadshotReady(handle) or not IsPedheadshotValid(handle) then
        UnregisterPedheadshot(handle)
        cb({ success = false, error = 'HEADSHOT_FAILED' })
        return
    end

    mugshotHandle = handle
    local txd = GetPedheadshotTxdString(handle)
    local url = ('https://nui-img/%s/%s?t=%d'):format(txd, txd, GetGameTimer())

    SendNUIMessage({
        action = 'convertMugshot',
        url = url,
    })

    mugshotPromise = promise.new()
    local base64 = Citizen.Await(mugshotPromise)

    if base64 and base64 ~= '' then
        cb({ success = true, base64 = base64 })
    else
        cb({ success = false, error = 'CONVERSION_FAILED' })
    end
end)

AddEventHandler('onResourceStop', function(resourceName)
    if GetCurrentResourceName() ~= resourceName then return end
    if mugshotHandle then
        UnregisterPedheadshot(mugshotHandle)
        mugshotHandle = nil
    end
end)
