-- OPT-10: Live Location Sharing Client Module
-- Handles periodic position updates for live location sharing

local isSharingLocation = false
local updateInterval = 10000
local locationThread = nil

local function StartLocationUpdates()
    if locationThread then return end

    isSharingLocation = true

    locationThread = CreateThread(function()
        while isSharingLocation do
            Wait(updateInterval)
            if isSharingLocation then
                TriggerServerEvent('gcphone:liveLocation:updatePosition')
            end
        end
    end)
end

local function StopLocationUpdates()
    isSharingLocation = false
    if locationThread then
        locationThread = nil
    end
end

RegisterNetEvent('gcphone:liveLocation:started', function(data)
    if not data or not data.senderPhone then return end

    lib.notify({
        title = 'Ubicacion en vivo',
        description = ('%s esta compartiendo su ubicacion contigo'):format(data.senderName or data.senderPhone),
        type = 'info',
    })
end)

RegisterNetEvent('gcphone:liveLocation:updated', function(data)
    -- Este evento es para que el frontend sepa que hay una actualización
    -- La UI consultará getActive para obtener las coordenadas actualizadas
end)

RegisterNUICallback('startLiveLocation', function(data, cb)
    lib.callback('gcphone:liveLocation:start', false, function(result)
        if result and result.success then
            StartLocationUpdates()
        end
        cb(result or { success = false, error = 'UNKNOWN_ERROR' })
    end, data)
end)

RegisterNUICallback('stopLiveLocation', function(_, cb)
    lib.callback('gcphone:liveLocation:stop', false, function(result)
        StopLocationUpdates()
        cb(result or { success = false, error = 'UNKNOWN_ERROR' })
    end)
end)

RegisterNUICallback('getActiveLiveLocations', function(_, cb)
    lib.callback('gcphone:liveLocation:getActive', false, function(result)
        cb(result or { success = false, locations = {} })
    end)
end)
