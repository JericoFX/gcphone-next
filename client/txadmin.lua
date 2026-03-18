-- txAdmin restart notifications → push to phone NUI
-- Verified: txAdmin fires these events on scheduled restarts

AddEventHandler('txAdmin:events:scheduledRestart', function(data)
    if type(data) ~= 'table' then return end
    local seconds = tonumber(data.secondsRemaining) or 0
    if seconds <= 0 then return end

    local label
    if seconds >= 60 then
        label = string.format('Reinicio del servidor en %d minuto%s', math.ceil(seconds / 60), seconds >= 120 and 's' or '')
    else
        label = string.format('Reinicio del servidor en %d segundo%s', seconds, seconds ~= 1 and 's' or '')
    end

    SendNUIMessage({
        action = 'phone:notification',
        data = {
            id = 'txadmin-restart-' .. tostring(seconds),
            appId = 'system',
            title = 'Aviso del servidor',
            message = label,
            icon = './img/icons_ios/ui-warning.svg',
            priority = 'high',
            duration = math.min(seconds * 1000, 10000),
        }
    })
end)

AddEventHandler('txAdmin:events:serverShuttingDown', function()
    SendNUIMessage({
        action = 'phone:notification',
        data = {
            id = 'txadmin-shutdown',
            appId = 'system',
            title = 'Servidor',
            message = 'El servidor se esta reiniciando ahora...',
            icon = './img/icons_ios/ui-warning.svg',
            priority = 'high',
            duration = 8000,
        }
    })
end)
