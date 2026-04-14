-- Radio callbacks & events.
-- Extraído de client/nui_bridge.lua (OPT-04).

RegisterNUICallback('radioGetStations', function(_, cb)
    lib.callback('gcphone:radio:getStations', false, function(stations)
        cb(stations or {})
    end)
end)

RegisterNUICallback('radioCreateStation', function(data, cb)
    lib.callback('gcphone:radio:createStation', false, function(result)
        cb(result or { success = false })
    end, data or {})
end)

RegisterNUICallback('radioJoinStation', function(data, cb)
    lib.callback('gcphone:radio:joinStation', false, function(result)
        cb(result or { success = false })
    end, data or {})
end)

RegisterNUICallback('radioLeaveStation', function(data, cb)
    lib.callback('gcphone:radio:leaveStation', false, function(result)
        cb(result or { success = false })
    end, data or {})
end)

RegisterNUICallback('radioEndStation', function(data, cb)
    lib.callback('gcphone:radio:endStation', false, function(result)
        cb(result or { success = false })
    end, data or {})
end)

RegisterNUICallback('radioSearchMusic', function(data, cb)
    lib.callback('gcphone:radio:searchMusic', false, function(result)
        cb(result or { success = false, results = {} })
    end, data or {})
end)

RegisterNUICallback('radioPlayMusic', function(data, cb)
    lib.callback('gcphone:radio:playMusic', false, function(result)
        cb(result or { success = false })
    end, data or {})
end)

RegisterNUICallback('radioStopMusic', function(data, cb)
    lib.callback('gcphone:radio:stopMusic', false, function(result)
        cb(result or { success = false })
    end, data or {})
end)

RegisterNUICallback('radioSetMusicVolume', function(data, cb)
    lib.callback('gcphone:radio:setMusicVolume', false, function(result)
        cb(result or { success = false })
    end, data or {})
end)

RegisterNetEvent('gcphone:radio:stationEnded', function(stationId)
    SendNUIMessage({ action = 'gcphone:radio:stationEnded', data = stationId })
end)

RegisterNetEvent('gcphone:radio:musicUpdate', function(data)
    SendNUIMessage({ action = 'gcphone:radio:musicUpdate', data = data })
end)

RegisterNUICallback('radioSavePlaylist', function(data, cb)
    lib.callback('gcphone:radio:savePlaylist', false, function(payload)
        cb(payload or {})
    end, data)
end)

RegisterNUICallback('radioGetPlaylists', function(_, cb)
    lib.callback('gcphone:radio:getPlaylists', false, function(payload)
        cb(payload or {})
    end)
end)

RegisterNUICallback('radioDeletePlaylist', function(data, cb)
    lib.callback('gcphone:radio:deletePlaylist', false, function(payload)
        cb(payload or {})
    end, data)
end)

RegisterNUICallback('radioMusicDuck', function(data, cb)
    lib.callback('gcphone:radio:musicDuck', false, function(payload)
        cb(payload or {})
    end, data)
end)

RegisterNUICallback('radioMusicUnduck', function(data, cb)
    lib.callback('gcphone:radio:musicUnduck', false, function(payload)
        cb(payload or {})
    end, data)
end)

RegisterNetEvent('gcphone:radio:musicDucked', function(data)
    SendNUIMessage({ action = 'gcphone:radio:musicDucked', data = data })
end)

return {}
