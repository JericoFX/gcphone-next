-- CityRide callbacks.
-- Extraído de client/nui_bridge.lua (OPT-04).
-- Reutiliza cbSuccess definido en client/nui_bridge.lua (cargado antes que este módulo).

RegisterNUICallback('cityrideRegisterDriver', function(data, cb)
    lib.callback('gcphone:cityride:registerDriver', false, function(payload)
        cb(payload or { success = false, error = 'NO_RESPONSE' })
    end, data or {})
end)

RegisterNUICallback('cityrideGetDriverProfile', function(_, cb)
    lib.callback('gcphone:cityride:getDriverProfile', false, function(payload)
        cb(payload or false)
    end)
end)

RegisterNUICallback('cityrideUpdateDriver', function(data, cb)
    lib.callback('gcphone:cityride:updateDriver', false, function(payload)
        cb(payload or { success = false, error = 'NO_RESPONSE' })
    end, data or {})
end)

RegisterNUICallback('cityrideSetDriverAvailability', function(data, cb)
    lib.callback('gcphone:cityride:setDriverAvailability', false, function(payload)
        cb(payload or { success = false, error = 'NO_RESPONSE' })
    end, data or {})
end)

RegisterNUICallback('cityrideRequestRide', function(data, cb)
    lib.callback('gcphone:cityride:requestRide', false, function(payload)
        cb(payload or { success = false, error = 'NO_RESPONSE' })
    end, data or {})
end)

RegisterNUICallback('cityrideGetAvailableRides', function(_, cb)
    lib.callback('gcphone:cityride:getAvailableRides', false, function(payload)
        cb(payload or {})
    end)
end)

RegisterNUICallback('cityrideAcceptRide', function(data, cb)
    lib.callback('gcphone:cityride:acceptRide', false, function(payload)
        cb(payload or { success = false, error = 'NO_RESPONSE' })
    end, data or {})
end)

RegisterNUICallback('cityrideConfirmPickup', function(data, cb)
    lib.callback('gcphone:cityride:confirmPickup', false, function(payload)
        cb(payload or { success = false, error = 'NO_RESPONSE' })
    end, data or {})
end)

RegisterNUICallback('cityrideCompleteRide', function(data, cb)
    lib.callback('gcphone:cityride:completeRide', false, function(payload)
        cb(payload or { success = false, error = 'NO_RESPONSE' })
    end, data or {})
end)

RegisterNUICallback('cityrideCancelRide', function(data, cb)
    lib.callback('gcphone:cityride:cancelRide', false, function(payload)
        cb(payload or { success = false, error = 'NO_RESPONSE' })
    end, data or {})
end)

RegisterNUICallback('cityrideGetActiveRide', function(_, cb)
    lib.callback('gcphone:cityride:getActiveRide', false, function(payload)
        cb(payload or false)
    end)
end)

RegisterNUICallback('cityrideGetRideHistory', function(_, cb)
    lib.callback('gcphone:cityride:getRideHistory', false, function(payload)
        cb(payload or {})
    end)
end)

RegisterNUICallback('cityrideGetRouteHistory', function(_, cb)
    lib.callback('gcphone:cityride:getRouteHistory', false, function(routes)
        cb(routes or {})
    end)
end)

RegisterNUICallback('cityrideRateDriver', function(data, cb)
    lib.callback('gcphone:cityride:rateDriver', false, function(payload)
        cb(payload or { success = false, error = 'NO_RESPONSE' })
    end, data or {})
end)

RegisterNUICallback('cityrideEstimatePrice', function(data, cb)
    lib.callback('gcphone:cityride:estimatePrice', false, function(payload)
        cb(payload or { price = 0, distance = 0 })
    end, data or {})
end)

RegisterNUICallback('cityrideGetAvailableDriverCount', function(_, cb)
    lib.callback('gcphone:cityride:getAvailableDriverCount', false, function(payload)
        cb(payload or { count = 0 })
    end)
end)

RegisterNUICallback('cityrideSetWaypoint', function(data, cb)
    if type(data) == 'table' and data.x and data.y then
        SetNewWaypoint(tonumber(data.x) + 0.0, tonumber(data.y) + 0.0)
        cb({ success = true })
    else
        cb({ success = false })
    end
end)

RegisterNUICallback('cityrideGetPlayerCoords', function(_, cb)
    local ped = cache.ped
    local coords = GetEntityCoords(ped)
    cb({
        x = coords.x,
        y = coords.y,
        z = coords.z,
    })
end)

return {}
