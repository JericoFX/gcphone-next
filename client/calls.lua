-- gcphone-next Client: Calls
-- Handles WebRTC calls and voice/video

local inCall = false
local useRTC = false
local currentCallId = nil
local peerConnection = nil
local usingPmaVoice = GetResourceState('pma-voice') == 'started'

local function IsPhoneOpenSafe()
    local resource = GetCurrentResourceName()
    local ok, open = pcall(function()
        return exports[resource]:IsPhoneOpen()
    end)
    if ok then return open and true or false end
    return PhoneState and PhoneState.isOpen or false
end

local function SetCallVoice(callId)
    if not callId then return end
    if usingPmaVoice then
        -- Verified: AvarianKnight/pma-voice client/module/phone.lua export setCallChannel(call)
        exports['pma-voice']:setCallChannel(callId)
        return
    end

    NetworkSetVoiceChannel(callId + 1)
    NetworkSetTalkerProximity(0.0)
end

local function ResetCallVoice()
    if usingPmaVoice then
        -- Verified: AvarianKnight/pma-voice client/module/phone.lua setCallChannel(0) removes from call
        exports['pma-voice']:setCallChannel(0)
        return
    end

    NetworkSetTalkerProximity(2.5)
end

local soundList = {}

function PlaySoundJS(sound, volume)
    SendNUIMessage({
        action = 'playSound',
        data = { sound = sound, volume = volume or 1.0 }
    })
end

function StopSoundJS(sound)
    SendNUIMessage({
        action = 'stopSound',
        data = { sound = sound }
    })
end

function SetSoundVolumeJS(sound, volume)
    SendNUIMessage({
        action = 'setSoundVolume',
        data = { sound = sound, volume = volume }
    })
end

RegisterNetEvent('gcphone:incomingCall', function(callData)
    currentCallId = callData.id
    
    SendNUIMessage({
        action = 'incomingCall',
        data = callData
    })
    
    PlaySoundJS('Phone_Call_Sound_Effect.ogg', 0.5)
    
    if not IsPhoneOpenSafe() then
        TogglePhone()
    end
end)

RegisterNetEvent('gcphone:callAccepted', function(callData)
    inCall = true
    currentCallId = callData.id
    
    StopSoundJS('Phone_Call_Sound_Effect.ogg')
    
    if not useRTC then SetCallVoice(currentCallId) end
    
    SendNUIMessage({
        action = 'callAccepted',
        data = callData
    })
    
    if not IsPhoneOpenSafe() then
        TogglePhone()
    end
    
    PlayPhoneAnimation('call')
end)

RegisterNetEvent('gcphone:callRejected', function(callId)
    inCall = false
    currentCallId = nil
    
    StopSoundJS('Phone_Call_Sound_Effect.ogg')
    
    if not useRTC then ResetCallVoice() end
    
    SendNUIMessage({
        action = 'callRejected',
        data = { callId = callId }
    })
    
    PlayPhoneAnimation('text')
end)

RegisterNetEvent('gcphone:callEnded', function(callId)
    inCall = false
    currentCallId = nil
    
    StopSoundJS('Phone_Call_Sound_Effect.ogg')
    
    if not useRTC then ResetCallVoice() end
    
    SendNUIMessage({
        action = 'callEnded',
        data = { callId = callId }
    })
    
    PlayPhoneAnimation('text')
end)

RegisterNetEvent('gcphone:receiveIceCandidate', function(candidates)
    SendNUIMessage({
        action = 'receiveIceCandidate',
        data = { candidates = candidates }
    })
end)

RegisterNUICallback('startCall', function(data, cb)
    lib.callback('gcphone:startCall', false, function(callData)
        if callData then
            currentCallId = callData.id
            PlayPhoneAnimation('call')
        end
        cb(callData)
    end, data)
end)

RegisterNUICallback('acceptCall', function(data, cb)
    lib.callback('gcphone:acceptCall', false, function(callData)
        cb(callData)
    end, data)
end)

RegisterNUICallback('rejectCall', function(data, cb)
    local callId = data and tonumber(data.callId)
    if not callId then
        cb(false)
        return
    end

    TriggerServerEvent('gcphone:rejectCall', callId)
    cb(true)
end)

RegisterNUICallback('endCall', function(data, cb)
    local callId = data and tonumber(data.callId)
    if not callId then
        cb(false)
        return
    end

    TriggerServerEvent('gcphone:endCall', callId)
    cb(true)
end)

RegisterNUICallback('sendIceCandidate', function(data, cb)
    local callId = data and tonumber(data.callId)
    if not callId or type(data.candidates) ~= 'table' then
        cb(false)
        return
    end

    TriggerServerEvent('gcphone:sendIceCandidate', callId, data.candidates)
    cb(true)
end)

RegisterNUICallback('setUseRTC', function(data, cb)
    useRTC = data and data.useRTC and true or false
    cb(true)
end)

RegisterNUICallback('getCallHistory', function(_, cb)
    lib.callback('gcphone:getCallHistory', false, function(history)
        cb(history or {})
    end)
end)

RegisterNUICallback('deleteCallHistory', function(data, cb)
    local phoneNumber = type(data) == 'table' and type(data.phoneNumber) == 'string' and data.phoneNumber or nil
    if not phoneNumber or phoneNumber == '' then
        cb(false)
        return
    end

    lib.callback('gcphone:deleteCallHistory', false, function(success)
        cb(success)
    end, phoneNumber)
end)

RegisterNUICallback('clearCallHistory', function(_, cb)
    lib.callback('gcphone:clearCallHistory', false, function(success)
        cb(success)
    end)
end)

CreateThread(function()
    while true do
        Wait(1000)
        
        if not inCall and not useRTC and not usingPmaVoice then
            NetworkSetTalkerProximity(2.5)
        end
    end
end)

exports('IsInCall', function() return inCall end)
exports('GetCurrentCallId', function() return currentCallId end)
