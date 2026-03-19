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
        SetNewWaypoint(rideData.pickup.x + 0.0, rideData.pickup.y + 0.0)
    end
end)

RegisterNetEvent('gcphone:cityride:rideUpdate', function(rideData)
    SendNUIMessage({
        action = 'cityRideUpdate',
        data = rideData
    })
    if rideData and rideData.status == 'in_progress' and rideData.dest then
        SetNewWaypoint(rideData.dest.x + 0.0, rideData.dest.y + 0.0)
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
    if coords and coords.x and coords.y then
        SetNewWaypoint(coords.x + 0.0, coords.y + 0.0)
    end
end)
