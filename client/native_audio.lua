local activeCallTone = nil
local activePreviewTone = nil

local function NativeAudioConfig()
    return Config.NativeAudio or {}
end

local function NativeAudioCatalog()
    return NativeAudioConfig().Catalog or {}
end

local function IncomingCallStateBagName()
    return NativeAudioConfig().IncomingCallStateBag or 'gcphoneIncomingCall'
end

local function PreviewDurationMs()
    local duration = tonumber(NativeAudioConfig().PreviewDurationMs)
    if not duration or duration < 250 then return 5000 end
    return duration
end

local function GetToneConfig(toneId)
    if type(toneId) ~= 'string' then return nil end
    return NativeAudioCatalog()[toneId]
end

local function ReleaseToneBank(bank)
    if type(bank) ~= 'string' or bank == '' then return end
    ReleaseNamedScriptAudioBank(bank)
end

local function StopTone(handle)
    if not handle then return end

    if handle.soundId then
        StopSound(handle.soundId)
        ReleaseSoundId(handle.soundId)
    end

    ReleaseToneBank(handle.bank)
end

local function ResolveToneForProfile(toneId)
    local profile = PhoneState and PhoneState.audioProfile or 'normal'
    if profile == 'silent' then
        local vibrateId = NativeAudioConfig().DefaultByCategory and NativeAudioConfig().DefaultByCategory.vibrate or 'buzz_short_01'
        return GetToneConfig(vibrateId), vibrateId
    end

    return GetToneConfig(toneId), toneId
end

local function RequestToneBank(bank)
    if type(bank) ~= 'string' or bank == '' then return false end

    -- Verified: /communityox/ox_lib requestAudioBank uses RequestScriptAudioBank and waits for the bank to load.
    if lib and lib.requestAudioBank then
        local ok = pcall(function()
            lib.requestAudioBank(bank)
        end)
        return ok
    end

    return RequestScriptAudioBank(bank, false)
end

local function PlayTone(toneId, mode)
    local entry, resolvedToneId = ResolveToneForProfile(toneId)
    if not entry then return false end

    local bank = type(entry.bank) == 'string' and entry.bank or ''
    local soundName = type(entry.soundName) == 'string' and entry.soundName or ''
    local soundSet = type(entry.soundSet) == 'string' and entry.soundSet or ''
    local playback = type(entry.playback) == 'string' and entry.playback or 'frontend'

    if bank == '' or soundName == '' then
        return false
    end

    if not RequestToneBank(bank) then
        return false
    end

    local soundId = GetSoundId()

    -- TODO: Verify final playback native against the generated Audiotool resource once the real bank and soundset are available.
    if playback == 'entity' then
        PlaySoundFromEntity(soundId, soundName, cache.ped, soundSet ~= '' and soundSet or bank, false, 0)
    else
        PlaySoundFrontend(soundId, soundName, soundSet ~= '' and soundSet or bank, true)
    end

    local handle = {
        soundId = soundId,
        bank = bank,
        toneId = resolvedToneId,
        mode = mode,
    }

    if mode == 'call' then
        StopTone(activeCallTone)
        activeCallTone = handle
    else
        StopTone(activePreviewTone)
        activePreviewTone = handle
        SetTimeout(PreviewDurationMs(), function()
            if activePreviewTone == handle then
                StopTone(activePreviewTone)
                activePreviewTone = nil
            end
        end)
    end

    return true
end

local function StopCallTone()
    StopTone(activeCallTone)
    activeCallTone = nil
end

local function StopPreviewTone()
    StopTone(activePreviewTone)
    activePreviewTone = nil
end

RegisterNUICallback('previewNativeTone', function(data, cb)
    local toneId = type(data) == 'table' and data.toneId or nil
    cb({
        success = PlayTone(toneId, 'preview'),
        placeholder = NativeAudioConfig().PlaceholderMode == true,
    })
end)

RegisterNUICallback('stopNativeTonePreview', function(_, cb)
    StopPreviewTone()
    cb(true)
end)

RegisterNetEvent('gcphone:stopIncomingCallTone', function()
    StopCallTone()
end)

AddStateBagChangeHandler(IncomingCallStateBagName(), nil, function(bagName, _, value)
    local entity = GetEntityFromStateBagName(bagName)
    if entity == 0 then return end

    local player = NetworkGetPlayerIndexFromPed(entity)
    if player ~= PlayerId() then return end

    if type(value) ~= 'table' or not value.callId then
        StopCallTone()
        return
    end

    PlayTone(value.toneId, 'call')
end)

AddEventHandler('onResourceStop', function(resourceName)
    if resourceName ~= GetCurrentResourceName() then return end
    StopCallTone()
    StopPreviewTone()
end)

exports('PlayPhoneNativeTone', PlayTone)
exports('StopPhoneNativeCallTone', StopCallTone)
exports('StopPhoneNativePreviewTone', StopPreviewTone)
