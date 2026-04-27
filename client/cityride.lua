local function SetWaypointSafe(coords)
    if type(coords) ~= 'table' then return end
    local x = tonumber(coords.x)
    local y = tonumber(coords.y)
    if not x or not y then return end
    SetNewWaypoint(x, y)
end

RegisterNetEvent('gcphone:cityride:newRequest', function(rideData)
    SendNUIMessage({
        action = 'cityRideNewRequest',
        data = rideData
    })
end)

RegisterNetEvent('gcphone:cityride:rideAccepted', function(rideData)
    SendNUIMessage({
        action = 'cityRideAccepted',
        data = rideData
    })
    if rideData and rideData.pickup then
        SetWaypointSafe(rideData.pickup)
    end
end)

RegisterNetEvent('gcphone:cityride:rideUpdate', function(rideData)
    SendNUIMessage({
        action = 'cityRideUpdate',
        data = rideData
    })
    if rideData and rideData.status == 'in_progress' and rideData.dest then
        SetWaypointSafe(rideData.dest)
    end
end)

RegisterNetEvent('gcphone:cityride:rideCancelled', function(rideId)
    SendNUIMessage({
        action = 'cityRideCancelled',
        data = { rideId = rideId }
    })
end)

RegisterNetEvent('gcphone:cityride:rideCompleted', function(rideData)
    SendNUIMessage({
        action = 'cityRideCompleted',
        data = rideData
    })
end)

RegisterNetEvent('gcphone:cityride:setWaypoint', function(coords)
    SetWaypointSafe(coords)
end)

return {}
