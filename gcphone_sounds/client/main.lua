local function loadAudioFile()
    if not RequestScriptAudioBank('audiodirectory/sounds', false) then
        while not RequestScriptAudioBank('audiodirectory/sounds', false) do
            Wait(0)
        end
    end

    return true
end

RegisterCommand('testaudio', function()
    if loadAudioFile() then
        local sounds = {
            ["call_1"] = true,
            ["call_2"] = true,
            ["call_3"] = true,
            ["call_4"] = true,
            ["call_5"] = true,
            ["call_6"] = true,
            ["call_7"] = true,
            ["call_8"] = true,
            ["call_9"] = true,
            ["call_10"] = true,
            ["call_11"] = true,
            ["call_12"] = true,
            ["call_13"] = true,
            ["call_vibrando"] = true,
            ["sonando"] = true,
            ["sonando_corto"] = true,
            ["nueva_notificacion"] = true,
            ["nueva_notificacion_vibrando"] = true,
            ["nueva_notificacion2"] = true,
            ["nueva_notificacion3"] = true,
            ["pop"] = true,
            ["pop2"] = true,
        }

        for sound in pairs(sounds) do
            print("Playing sound " .. sound)
             local soundId = GetSoundId()
            PlaySoundFromEntity(soundId, sound, PlayerPedId(), 'gcphone', 0, 0)
            while not HasSoundFinished(soundId) do
              Wait(0)
            end
             ReleaseSoundId(soundId)
        end
    end
end, false)
