--[[
    Server-side music system for gcphone-next
    Based on xsound by Xogy - MIT License
    
    Handles:
    - Broadcasting music to nearby players
    - Managing music state per player
    - Cleaning up on player disconnect
]]

local MusicPlayers = {}

local function GetPlayersInRange(coords, range)
    local players = {}
    local sortedPlayers = GetPlayers()
    
    for _, playerId in ipairs(sortedPlayers) do
        local ped = GetPlayerPed(playerId)
        if DoesEntityExist(ped) then
            local playerCoords = GetEntityCoords(ped)
            local distance = #(coords - playerCoords)
            if distance <= range then
                table.insert(players, tonumber(playerId))
            end
        end
    end
    
    return players
end

local function BroadcastToNearby(source, event, data, range)
    local ped = GetPlayerPed(source)
    if not DoesEntityExist(ped) then return end
    
    local coords = GetEntityCoords(ped)
    local players = GetPlayersInRange(coords, range or 30.0)
    
    for _, playerId in ipairs(players) do
        if playerId ~= source then
            TriggerClientEvent(event, playerId, data)
        end
    end
end

RegisterNetEvent('gcphone:music:play', function(data)
    local source = source
    if not data then return end
    
    MusicPlayers[source] = {
        youtubeId = data.youtubeId,
        previewUrl = data.previewUrl,
        title = data.title,
        artist = data.artist,
        duration = data.duration,
        position = data.position,
        volume = data.volume or 0.15,
        distance = data.distance or 15.0,
        playing = true,
    }
    
    local broadcastData = {
        source = source,
        youtubeId = data.youtubeId,
        previewUrl = data.previewUrl,
        title = data.title,
        artist = data.artist,
        position = data.position,
        volume = data.volume or 0.15,
        distance = data.distance or 15.0,
    }
    
    BroadcastToNearby(source, 'gcphone:music:remotePlay', broadcastData, data.distance + 10)
end)

RegisterNetEvent('gcphone:music:pause', function()
    local source = source
    
    if MusicPlayers[source] then
        MusicPlayers[source].playing = false
    end
    
    BroadcastToNearby(source, 'gcphone:music:remotePause', source, 40)
end)

RegisterNetEvent('gcphone:music:resume', function()
    local source = source
    
    if MusicPlayers[source] then
        MusicPlayers[source].playing = true
    end
    
    BroadcastToNearby(source, 'gcphone:music:remoteResume', source, 40)
end)

RegisterNetEvent('gcphone:music:stop', function()
    local source = source
    
    MusicPlayers[source] = nil
    
    BroadcastToNearby(source, 'gcphone:music:remoteStop', source, 40)
end)

RegisterNetEvent('gcphone:music:setVolume', function(volume)
    local source = source
    
    if MusicPlayers[source] then
        MusicPlayers[source].volume = volume
    end
    
    BroadcastToNearby(source, 'gcphone:music:remoteVolume', { source, volume }, 40)
end)

AddEventHandler('playerDropped', function(reason)
    local source = source
    
    if MusicPlayers[source] then
        BroadcastToNearby(source, 'gcphone:music:remoteStop', source, 40)
        MusicPlayers[source] = nil
    end
end)

exports('getMusicPlayers', function()
    return MusicPlayers
end)

exports('getPlayerMusic', function(source)
    return MusicPlayers[source]
end)

exports('getNearbyMusic', function(coords, range)
    local nearby = {}
    
    for source, music in pairs(MusicPlayers) do
        if music.playing and music.position then
            local musicPos = vector3(music.position.x, music.position.y, music.position.z)
            local distance = #(coords - musicPos)
            if distance <= range then
                nearby[source] = music
            end
        end
    end
    
    return nearby
end)
