local activeCallTone = nil
local activePreviewTone = nil
local activeNotifTone = nil
local activeMessageTone = nil
local activeOutgoingTone = nil

local function NativeAudioConfig()
    return Config.NativeAudio or {}
end

local function NotifyNativeCallToneState(active, toneId)
    SendNUIMessage({
        action = 'gcphone:nativeCallToneState',
        data = {
            active = active == true,
            toneId = toneId,
            placeholder = NativeAudioConfig().PlaceholderMode == true,
        }
    })
end

local function NativeAudioCatalog()
    return NativeAudioConfig().Catalog or {}
end

local function IncomingCallStateBagName()
    return NativeAudioConfig().IncomingCallStateBag or 'gcphoneIncomingCall'
end

local function IsNativeCallToneEnabled()
    local config = NativeAudioConfig()
    return config.Enabled ~= false and config.PlaceholderMode ~= true
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

local function GetBank()
    local bank = NativeAudioConfig().Bank
    return type(bank) == 'string' and bank ~= '' and bank or nil
end

local function GetSoundSetName()
    local ss = NativeAudioConfig().SoundSet
    return type(ss) == 'string' and ss ~= '' and ss or nil
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

local function WaitForSoundFinished(handle, activeRef, setter, maxMs)
    CreateThread(function()
        local elapsed = 0
        local interval = 200
        while elapsed < maxMs do
            Wait(interval)
            elapsed = elapsed + interval
            if activeRef() ~= handle then return end
            if handle.soundId and HasSoundFinished(handle.soundId) then break end
        end
        if activeRef() == handle then
            StopTone(handle)
            setter(nil)
        end
    end)
end

local function ResolveToneForProfile(toneId)
    local profile = PhoneState and PhoneState.audioProfile or 'normal'
    local entry = GetToneConfig(toneId)
    if not entry then return nil, toneId end

    if profile == 'silent' and entry.vibrando then
        return entry, toneId
    end

    return entry, toneId
end

local function RequestToneBank(bank)
    if type(bank) ~= 'string' or bank == '' then return false end
    if lib and lib.requestAudioBank then
        local ok, loaded = pcall(lib.requestAudioBank, bank)
        return ok and loaded == true
    end

    return RequestScriptAudioBank(bank, false)
end

local function PlayTone(toneId, mode)
    if not IsNativeCallToneEnabled() then
        return false
    end

    local entry, resolvedToneId = ResolveToneForProfile(toneId)
    if not entry then return false end

    local bank = GetBank()
    local soundSet = GetSoundSetName()
    local soundName = type(entry.soundName) == 'string' and entry.soundName or ''

    if not bank or soundName == '' then
        return false
    end

    local profile = PhoneState and PhoneState.audioProfile or 'normal'
    if profile == 'silent' and entry.vibrando then
        soundName = entry.vibrando
    end

    if not RequestToneBank(bank) then
        return false
    end

    local soundId = GetSoundId()

    if mode == 'preview' then
        PlaySoundFrontend(soundId, soundName, soundSet or bank, true)
    else
        PlaySoundFromEntity(soundId, soundName, cache.ped, soundSet or bank, false, 0)
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
        NotifyNativeCallToneState(true, resolvedToneId)
    elseif mode == 'notification' then
        StopTone(activeNotifTone)
        activeNotifTone = handle
        WaitForSoundFinished(handle, function() return activeNotifTone end, function(v) activeNotifTone = v end, 5000)
    elseif mode == 'message' then
        StopTone(activeMessageTone)
        activeMessageTone = handle
        WaitForSoundFinished(handle, function() return activeMessageTone end, function(v) activeMessageTone = v end, 5000)
    elseif mode == 'outgoing' then
        StopTone(activeOutgoingTone)
        activeOutgoingTone = handle
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
    if activeCallTone then
        NotifyNativeCallToneState(false, activeCallTone.toneId)
    end
    StopTone(activeCallTone)
    activeCallTone = nil
end

local function StopPreviewTone()
    StopTone(activePreviewTone)
    activePreviewTone = nil
end

local function StopOutgoingTone()
    StopTone(activeOutgoingTone)
    activeOutgoingTone = nil
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

RegisterNUICallback('playNativeNotification', function(data, cb)
    local toneId = type(data) == 'table' and data.toneId or nil
    cb({ success = PlayTone(toneId, 'notification') })
end)

RegisterNUICallback('playNativeMessage', function(data, cb)
    local toneId = type(data) == 'table' and data.toneId or nil
    cb({ success = PlayTone(toneId, 'message') })
end)

RegisterNUICallback('playNativeOutgoing', function(data, cb)
    local sound = type(data) == 'table' and data.sound or nil
    local toneId
    if sound == 'calling_loop' then
        toneId = 'sonando'
    elseif sound == 'calling_short' then
        toneId = 'sonando_corto'
    end
    if not toneId then
        cb({ success = false })
        return
    end
    cb({ success = PlayTone(toneId, 'outgoing') })
end)

RegisterNUICallback('stopNativeOutgoing', function(_, cb)
    StopOutgoingTone()
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
    StopOutgoingTone()
    StopTone(activeNotifTone)
    activeNotifTone = nil
    StopTone(activeMessageTone)
    activeMessageTone = nil
end)

---Play a native phone tone by logical tone id.
---@param toneId string
---@param mode? 'call'|'preview'|'notification'|'message'|'outgoing'
---@return boolean
exports('PlayPhoneNativeTone', PlayTone)

---Stop the currently active native incoming-call tone.
---@return nil
exports('StopPhoneNativeCallTone', StopCallTone)

---Stop the currently active native preview tone.
---@return nil
exports('StopPhoneNativePreviewTone', StopPreviewTone)

---Stop the currently active native outgoing-call tone.
---@return nil
exports('StopPhoneNativeOutgoingTone', StopOutgoingTone)

---Check whether native call tones are fully enabled and not in placeholder mode.
---@return boolean
exports('IsPhoneNativeCallToneEnabled', IsNativeCallToneEnabled)
