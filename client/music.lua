--[[
    Client-side music system using xSound API
    Handles: Play, Pause, Resume, Stop, Volume, Distance (3D positional audio)
]]

local xSound = exports['xsound']
local SOUND_NAME = 'gcphone_music_' .. GetPlayerServerId(PlayerId())
local isPlaying = false
local currentUrl = nil

local function GetPlayerPosition()
    local ped = PlayerPedId()
    local coords = GetEntityCoords(ped)
    return coords
end

local function UpdateSoundPosition()
    if not isPlaying then return end
    local pos = GetPlayerPosition()
    xSound:Position(SOUND_NAME, pos)
end

CreateThread(function()
    while true do
        Wait(300)
        UpdateSoundPosition()
    end
end)

RegisterNUICallback('musicPlay', function(data, cb)
    if not data or type(data.url) ~= 'string' then
        cb({ success = false })
        return
    end

    local url = data.url:match('^%s*(.-)%s*$')
    if url == '' then
        cb({ success = false })
        return
    end

    if xSound:soundExists(SOUND_NAME) then
        xSound:Destroy(SOUND_NAME)
    end

    local volume = tonumber(data.volume) or 0.5
    local distance = tonumber(data.distance) or 15
    local pos = GetPlayerPosition()

    xSound:PlayUrlPos(SOUND_NAME, url, volume, pos, false)
    xSound:Distance(SOUND_NAME, distance)

    isPlaying = true
    currentUrl = url

    cb({ success = true })
end)

RegisterNUICallback('musicPause', function(_, cb)
    if xSound:soundExists(SOUND_NAME) and xSound:isPlaying(SOUND_NAME) then
        xSound:Pause(SOUND_NAME)
        isPlaying = false
    end
    cb({ success = true })
end)

RegisterNUICallback('musicResume', function(_, cb)
    if xSound:soundExists(SOUND_NAME) and xSound:isPaused(SOUND_NAME) then
        xSound:Resume(SOUND_NAME)
        isPlaying = true
    end
    cb({ success = true })
end)

RegisterNUICallback('musicStop', function(_, cb)
    if xSound:soundExists(SOUND_NAME) then
        xSound:Destroy(SOUND_NAME)
    end
    isPlaying = false
    currentUrl = nil
    cb({ success = true })
end)

RegisterNUICallback('musicSetVolume', function(data, cb)
    if not xSound:soundExists(SOUND_NAME) then
        cb({ success = false })
        return
    end

    local volume = tonumber(data.volume) or 0.5
    local distance = tonumber(data.distance) or 15

    xSound:setVolumeMax(SOUND_NAME, volume)
    xSound:Distance(SOUND_NAME, distance)

    cb({ success = true })
end)

AddEventHandler('playerDropped', function()
    if xSound:soundExists(SOUND_NAME) then
        xSound:Destroy(SOUND_NAME)
    end
end)

exports('isPlayingMusic', function()
    return isPlaying
end)

exports('getCurrentMusicUrl', function()
    return currentUrl
end)
