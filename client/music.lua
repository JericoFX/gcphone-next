-- Creado/Modificado por JericoFX

local isPlaying = false
local isPaused = false
local currentUrl = nil

RegisterNetEvent('gcphone:music:playFromNUI', function(data)
    TriggerServerEvent('gcphone:music:play', data)

    if type(data) == 'table' then
        currentUrl = type(data.url) == 'string' and data.url or currentUrl
    end
    isPlaying = true
    isPaused = false
end)

RegisterNetEvent('gcphone:music:pauseFromNUI', function()
    TriggerServerEvent('gcphone:music:pause')
    if isPlaying then
        isPaused = true
    end
end)

RegisterNetEvent('gcphone:music:resumeFromNUI', function()
    TriggerServerEvent('gcphone:music:resume')
    if isPlaying then
        isPaused = false
    end
end)

RegisterNetEvent('gcphone:music:stopFromNUI', function()
    TriggerServerEvent('gcphone:music:stop')
    isPlaying = false
    isPaused = false
    currentUrl = nil
end)

RegisterNetEvent('gcphone:music:setVolumeFromNUI', function(payload)
    TriggerServerEvent('gcphone:music:setVolume', payload)
end)

RegisterNetEvent('gcphone:music:setState', function(state)
    if type(state) ~= 'table' then return end

    if state.isPlaying ~= nil then
        isPlaying = state.isPlaying and true or false
    end

    if state.isPaused ~= nil then
        isPaused = state.isPaused and true or false
    end

    if type(state.url) == 'string' and state.url ~= '' then
        currentUrl = state.url
    end

    SendNUIMessage({
        action = 'musicStateUpdated',
        data = state,
    })
end)

exports('isPlayingMusic', function()
    return isPlaying
end)

exports('isMusicPaused', function()
    return isPaused
end)

exports('getCurrentMusicUrl', function()
    return currentUrl
end)
