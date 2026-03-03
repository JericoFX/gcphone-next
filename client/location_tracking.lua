-- OPT-10: Live Location Sharing Client Module
-- Handles periodic position updates for live location sharing

local isSharingLocation = false
local configSeconds = (Config and Config.LiveLocation and tonumber(Config.LiveLocation.UpdateIntervalSeconds)) or 10
local updateInterval = math.floor(math.max(5, configSeconds) * 1000)
local locationThread = nil

local function NormalizeIntervalMs(value)
    local ms = tonumber(value) or 10000
    if ms <= 5000 then
        return 5000
    end
    return 10000
end

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
    if type(data) == 'table' then
        updateInterval = NormalizeIntervalMs((tonumber(data.updateIntervalSeconds) or 10) * 1000)
    end

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

RegisterNUICallback('setLiveLocationInterval', function(data, cb)
    local seconds = tonumber(type(data) == 'table' and data.seconds or nil)
    if not seconds then
        cb({ success = false, error = 'INVALID_INTERVAL' })
        return
    end

    updateInterval = NormalizeIntervalMs(seconds * 1000)
    cb({ success = true, intervalSeconds = math.floor(updateInterval / 1000) })
end)

RegisterNUICallback('getLiveLocationState', function(_, cb)
    cb({
        success = true,
        active = isSharingLocation,
        intervalSeconds = math.floor(updateInterval / 1000),
    })
end)
