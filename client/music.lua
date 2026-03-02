--[[
    Client-side music system for gcphone-next
    Based on xsound by Xogy - MIT License
    
    Handles:
    - Sending player position to NUI for 3D audio calculation
    - Receiving music events from server (other players' music)
    - Broadcasting local music to nearby players
]]

local MusicState = {
    currentTrack = nil,
    playing = false,
    volume = 0.15,
    distance = 15.0,
    position = vector3(0, 0, 0),
    startTime = 0,
}

local RemoteMusic = {}

local function GetPlayerPosition()
    local ped = PlayerPedId()
    local coords = GetEntityCoords(ped)
    return coords
end

local function SendPositionToNUI()
    local pos = GetPlayerPosition()
    SendNUIMessage({
        action = 'music:playerPosition',
        x = pos.x,
        y = pos.y,
        z = pos.z
    })
end

local function UpdateRemoteMusicPositions()
    local myPos = GetPlayerPosition()
    
    for serverId, music in pairs(RemoteMusic) do
        local player = GetPlayerFromServerId(serverId)
        if player ~= -1 then
            local ped = GetPlayerPed(player)
            if DoesEntityExist(ped) then
                local pedPos = GetEntityCoords(ped)
                local distance = #(myPos - pedPos)
                
                if distance < (music.distance + 40) then
                    SendNUIMessage({
                        action = 'music:updateRemotePosition',
                        serverId = serverId,
                        x = pedPos.x,
                        y = pedPos.y,
                        z = pedPos.z
                    })
                end
            end
        else
            RemoteMusic[serverId] = nil
        end
    end
end

CreateThread(function()
    while true do
        Wait(300)
        SendPositionToNUI()
        UpdateRemoteMusicPositions()
    end
end)

RegisterNetEvent('gcphone:music:remotePlay', function(data)
    if not data then return end
    
    local source = data.source
    if source == GetPlayerServerId(PlayerId()) then return end
    
    RemoteMusic[source] = {
        youtubeId = data.youtubeId,
        previewUrl = data.previewUrl,
        title = data.title,
        artist = data.artist,
        position = data.position,
        volume = data.volume or 0.15,
        distance = data.distance or 15.0,
        playing = true,
    }
    
    SendNUIMessage({
        action = 'music:remotePlay',
        source = source,
        youtubeId = data.youtubeId,
        previewUrl = data.previewUrl,
        title = data.title,
        artist = data.artist,
        x = data.position and data.position.x or 0,
        y = data.position and data.position.y or 0,
        z = data.position and data.position.z or 0,
        volume = data.volume or 0.15,
        distance = data.distance or 15.0,
    })
end)

RegisterNetEvent('gcphone:music:remotePause', function(sourceId)
    if sourceId == GetPlayerServerId(PlayerId()) then return end
    
    if RemoteMusic[sourceId] then
        RemoteMusic[sourceId].playing = false
    end
    
    SendNUIMessage({
        action = 'music:remotePause',
        source = sourceId
    })
end)

RegisterNetEvent('gcphone:music:remoteResume', function(sourceId)
    if sourceId == GetPlayerServerId(PlayerId()) then return end
    
    if RemoteMusic[sourceId] then
        RemoteMusic[sourceId].playing = true
    end
    
    SendNUIMessage({
        action = 'music:remoteResume',
        source = sourceId
    })
end)

RegisterNetEvent('gcphone:music:remoteStop', function(sourceId)
    if sourceId == GetPlayerServerId(PlayerId()) then return end
    
    RemoteMusic[sourceId] = nil
    
    SendNUIMessage({
        action = 'music:remoteStop',
        source = sourceId
    })
end)

RegisterNetEvent('gcphone:music:remoteVolume', function(sourceId, volume)
    if sourceId == GetPlayerServerId(PlayerId()) then return end
    
    if RemoteMusic[sourceId] then
        RemoteMusic[sourceId].volume = volume
    end
    
    SendNUIMessage({
        action = 'music:remoteVolume',
        source = sourceId,
        volume = volume
    })
end)

AddEventHandler('gcphone:music:playFromNUI', function(data)
    if not data then return end
    
    local ped = PlayerPedId()
    local pos = GetEntityCoords(ped)
    
    MusicState.currentTrack = {
        youtubeId = data.youtubeId,
        previewUrl = data.previewUrl,
        title = data.title,
        artist = data.artist,
        duration = data.duration,
    }
    MusicState.playing = true
    MusicState.position = pos
    MusicState.startTime = GetGameTimer()
    
    TriggerServerEvent('gcphone:music:play', {
        youtubeId = data.youtubeId,
        previewUrl = data.previewUrl,
        title = data.title,
        artist = data.artist,
        duration = data.duration,
        position = { x = pos.x, y = pos.y, z = pos.z },
        volume = MusicState.volume,
        distance = MusicState.distance,
    })
end)

AddEventHandler('gcphone:music:pauseFromNUI', function()
    MusicState.playing = false
    TriggerServerEvent('gcphone:music:pause')
end)

AddEventHandler('gcphone:music:resumeFromNUI', function()
    if MusicState.currentTrack then
        MusicState.playing = true
        TriggerServerEvent('gcphone:music:resume')
    end
end)

AddEventHandler('gcphone:music:stopFromNUI', function()
    MusicState.currentTrack = nil
    MusicState.playing = false
    TriggerServerEvent('gcphone:music:stop')
end)

AddEventHandler('gcphone:music:setVolumeFromNUI', function(volume)
    if volume then
        MusicState.volume = tonumber(volume) or 0.15
        TriggerServerEvent('gcphone:music:setVolume', MusicState.volume)
    end
end)

AddEventHandler('playerDropped', function()
    TriggerServerEvent('gcphone:music:stop')
end)

exports('getMusicState', function()
    return MusicState
end)

exports('isPlayingMusic', function()
    return MusicState.playing and MusicState.currentTrack ~= nil
end)
