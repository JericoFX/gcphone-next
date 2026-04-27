-- Creado/Modificado por JericoFX

local isPlaying = false
local isPaused = false
local currentUrl = nil

AddEventHandler('gcphone:music:playFromNUI', function(data)
    TriggerServerEvent('gcphone:music:play', data)
end)

AddEventHandler('gcphone:music:pauseFromNUI', function()
    TriggerServerEvent('gcphone:music:pause')
end)

AddEventHandler('gcphone:music:resumeFromNUI', function()
    TriggerServerEvent('gcphone:music:resume')
end)

AddEventHandler('gcphone:music:stopFromNUI', function()
    TriggerServerEvent('gcphone:music:stop')
end)

AddEventHandler('gcphone:music:setVolumeFromNUI', function(payload)
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

    if state.isPlaying == false then
        currentUrl = nil
    end

    SendNUIMessage({
        action = 'musicStateUpdated',
        data = state,
    })
end)

---Check whether any phone music is currently playing.
---@return boolean
exports('isPlayingMusic', function()
    return isPlaying
end)

---Check whether current phone music playback is paused.
---@return boolean
exports('isMusicPaused', function()
    return isPaused
end)

---Get the current music URL loaded in the phone player.
---@return string|nil
exports('getCurrentMusicUrl', function()
    return currentUrl
end)

return {}
