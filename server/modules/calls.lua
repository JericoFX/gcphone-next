-- Creado/Modificado por JericoFX

local ActiveCalls = {}
local CallHistory = {}
local LastCallId = 10
local AirplaneModeBySource = {}
local UsingPmaVoice = GetResourceState('pma-voice') == 'started'
local LastCallStartBySource = {}

local function SyncActiveCallsToGlobalState()
    GlobalState.gcphoneActiveCalls = ActiveCalls
end

local function IsValidCallId(value)
    local callId = tonumber(value)
    if not callId then return nil end
    if callId < 1 then return nil end
    return math.floor(callId)
end

local function SanitizeCallSignal(value, maxLen)
    if type(value) ~= 'string' then return nil end
    local text = value:gsub('[%z\1-\31\127]', '')
    if text == '' then return nil end
    if #text > maxLen then
        return text:sub(1, maxLen)
    end
    return text
end

local function CanStartCall(source)
    local now = GetGameTimer()
    local last = LastCallStartBySource[source] or 0
    if (now - last) < 1200 then
        return false
    end
    LastCallStartBySource[source] = now
    return true
end

local function SetPlayerCallChannel(source, channel)
    if not source or source <= 0 then return end
    if not UsingPmaVoice then return end
    exports['pma-voice']:setPlayerCall(source, channel)
end

local function ResetCallChannelForCall(callData)
    if not callData then return end
    if callData.transmitterSrc then SetPlayerCallChannel(callData.transmitterSrc, 0) end
    if callData.receiverSrc then SetPlayerCallChannel(callData.receiverSrc, 0) end
end

local function IsCallParticipant(callData, source)
    if not callData or not source then return false end
    return source == callData.transmitterSrc or source == callData.receiverSrc
end

local function IsAirplaneModeEnabled(source)
    return AirplaneModeBySource[source] == true
end

local function NativeAudioCatalog()
    return (Config.NativeAudio and Config.NativeAudio.Catalog) or {}
end

local function NativeAudioDefaults()
    return (Config.NativeAudio and Config.NativeAudio.DefaultByCategory) or {}
end

local function NativeAudioLegacyMap()
    return (Config.NativeAudio and Config.NativeAudio.LegacyMap) or {}
end

local function IncomingCallStateBagName()
    return (Config.NativeAudio and Config.NativeAudio.IncomingCallStateBag) or 'gcphoneIncomingCall'
end

local function ResolveToneId(value)
    if type(value) ~= 'string' then
        return NativeAudioDefaults().ringtone or 'call_main_01'
    end

    local toneId = value:gsub('[^%w%._%-]', ''):sub(1, 64)
    local catalog = NativeAudioCatalog()
    local legacy = NativeAudioLegacyMap()
    if toneId ~= '' and catalog[toneId] then
        return toneId
    end

    local mapped = legacy[toneId]
    if mapped and catalog[mapped] then
        return mapped
    end

    return NativeAudioDefaults().ringtone or 'call_main_01'
end

local function BuildIncomingCallAudioState(targetSource, callId, fromNumber)
    local identifier = GetIdentifier(targetSource)
    local settings = identifier and MySQL.single.await(
        'SELECT call_ringtone, audio_profile FROM phone_numbers WHERE identifier = ? LIMIT 1',
        { identifier }
    ) or nil

    return {
        callId = callId,
        toneId = ResolveToneId(settings and settings.call_ringtone or nil),
        fromNumber = fromNumber,
        audioProfile = settings and settings.audio_profile or (Config.Phone and Config.Phone.DefaultSettings and Config.Phone.DefaultSettings.audioProfile) or 'normal',
        startedAt = os.time(),
    }
end

local function SetIncomingCallState(targetSource, callData)
    if not targetSource or targetSource <= 0 then return end
    local player = Player(targetSource)
    if not player or not player.state then return end
    player.state:set(IncomingCallStateBagName(), BuildIncomingCallAudioState(targetSource, callData.id, callData.hidden and '###-####' or callData.transmitterNum), true)
end

local function ClearIncomingCallState(targetSource)
    if not targetSource or targetSource <= 0 then return end
    local player = Player(targetSource)
    if not player or not player.state then return end
    player.state:set(IncomingCallStateBagName(), false, true)
end

local function GetCallHistory(identifier)
    if not identifier then return {} end
    
    local phoneNumber = GetPhoneNumber(identifier)
    if not phoneNumber then return {} end
    
    return MySQL.query.await(
        'SELECT * FROM phone_calls WHERE owner = ? ORDER BY time DESC LIMIT 100',
        { phoneNumber }
    ) or {}
end

local function SaveCall(callData)
    if not callData then return end
    
    MySQL.insert.await(
        'INSERT INTO phone_calls (owner, num, incoming, accepts, duration, hidden) VALUES (?, ?, ?, ?, ?, ?)',
        { 
            callData.transmitterNum, 
            callData.receiverNum, 
            1, 
            callData.accepts and 1 or 0,
            callData.duration or 0,
            callData.hidden and 1 or 0
        }
    )
    
    if callData.isValid then
        local displayNum = callData.hidden and '###-####' or callData.transmitterNum
        
        MySQL.insert.await(
            'INSERT INTO phone_calls (owner, num, incoming, accepts, duration, hidden) VALUES (?, ?, ?, ?, ?, ?)',
            { 
                callData.receiverNum, 
                displayNum, 
                0, 
                callData.accepts and 1 or 0,
                callData.duration or 0,
                callData.hidden and 1 or 0
            }
        )
    end
end

lib.callback.register('gcphone:getCallHistory', function(source)
    local identifier = GetPhoneOwnerIdentifier(source, true)
    return GetCallHistory(identifier)
end)

lib.callback.register('gcphone:deleteCallHistory', function(source, phoneNumber)
    if IsPhoneReadOnly(source) then return false end
    local identifier = GetIdentifier(source)
    if not identifier then return false end
    
    local myNumber = GetPhoneNumber(identifier)
    if not myNumber then return false end
    
    MySQL.execute.await(
        'DELETE FROM phone_calls WHERE owner = ? AND num = ?',
        { myNumber, phoneNumber }
    )
    
    return true
end)

lib.callback.register('gcphone:clearCallHistory', function(source)
    if IsPhoneReadOnly(source) then return false end
    local identifier = GetIdentifier(source)
    if not identifier then return false end
    
    local myNumber = GetPhoneNumber(identifier)
    if not myNumber then return false end
    
    MySQL.execute.await(
        'DELETE FROM phone_calls WHERE owner = ?',
        { myNumber }
    )
    
    return true
end)

lib.callback.register('gcphone:startCall', function(source, data)
    if IsPhoneReadOnly(source) then
        return {
            error = 'READ_ONLY'
        }
    end
    local identifier = GetIdentifier(source)
    if not identifier then return nil end
    if type(data) ~= 'table' then return nil end
    
    local myNumber = GetPhoneNumber(identifier)
    if not myNumber then return nil end

    if not CanStartCall(source) then
        return {
            error = 'RATE_LIMIT'
        }
    end

    if IsAirplaneModeEnabled(source) then
        return {
            error = 'AIRPLANE_MODE_CALL_BLOCKED'
        }
    end
    
    local targetNumber = tostring(data.phoneNumber or '')
    targetNumber = targetNumber:gsub('[^%d#%-%+%(%s%)]', ''):sub(1, 20)
    if not targetNumber or targetNumber == '' then
        return nil
    end
    
    local hidden = false
    if string.sub(targetNumber, 1, 1) == '#' then
        hidden = true
        targetNumber = string.sub(targetNumber, 2)
    end
    
    if Config.FixePhone[targetNumber] then
        return {
            id = LastCallId,
            transmitterNum = myNumber,
            receiverNum = targetNumber,
            isValid = false,
            isFixe = true,
            coords = Config.FixePhone[targetNumber].coords
        }
    end
    
    local targetIdentifier = GetIdentifierByPhone(targetNumber)
    local isValid = targetIdentifier ~= nil and targetIdentifier ~= identifier

    if isValid then
        local blocked = false
        local okBlocked, blockedResult = pcall(function()
            return exports[GetCurrentResourceName()]:IsBlockedEither(identifier, targetIdentifier, myNumber, targetNumber)
        end)
        if okBlocked and blockedResult == true then
            blocked = true
        end

        if blocked then
            return {
                error = 'BLOCKED_CONTACT'
            }
        end
    end

    local callId = LastCallId
    LastCallId = LastCallId + 1
    
    local callData = {
        id = callId,
        transmitterSrc = source,
        transmitterNum = myNumber,
        receiverSrc = nil,
        receiverNum = targetNumber,
        isValid = isValid,
        accepts = false,
        hidden = hidden,
        rtcOffer = SanitizeCallSignal(data.rtcOffer, 20000),
        extraData = type(data.extraData) == 'table' and data.extraData or nil,
        startTime = nil
    }
    
    if isValid then
        local targetSource = GetSourceFromIdentifier(targetIdentifier)
        
        if targetSource then
            if IsAirplaneModeEnabled(targetSource) then
                return {
                    error = 'TARGET_AIRPLANE_MODE'
                }
            end

            callData.receiverSrc = targetSource
            
            ActiveCalls[callId] = callData
            SyncActiveCallsToGlobalState()
            SetIncomingCallState(targetSource, callData)
            
            TriggerClientEvent('gcphone:incomingCall', targetSource, {
                id = callId,
                transmitterNum = hidden and '###-####' or myNumber,
                receiverNum = targetNumber,
                hidden = hidden
            })
        end
    end
    
    ActiveCalls[callId] = callData
    SyncActiveCallsToGlobalState()
    
    return {
        id = callId,
        transmitterNum = myNumber,
        receiverNum = targetNumber,
        isValid = isValid,
        hidden = hidden
    }
end)

lib.callback.register('gcphone:acceptCall', function(source, data)
    if IsAirplaneModeEnabled(source) then
        return {
            error = 'AIRPLANE_MODE_CALL_BLOCKED'
        }
    end

    if type(data) ~= 'table' then return nil end
    local callId = IsValidCallId(data.callId)
    if not callId then return nil end
    local callData = ActiveCalls[callId]
    
    if not callData or source ~= callData.receiverSrc then
        return nil
    end
    
    callData.accepts = true
    callData.startTime = os.time()
    callData.rtcAnswer = SanitizeCallSignal(data.rtcAnswer, 20000)
    
    ActiveCalls[callId] = callData
    SyncActiveCallsToGlobalState()
    SetPlayerCallChannel(callData.transmitterSrc, callId)
    SetPlayerCallChannel(callData.receiverSrc, callId)
    ClearIncomingCallState(callData.receiverSrc)
    
    TriggerClientEvent('gcphone:callAccepted', callData.transmitterSrc, {
        id = callId,
        rtcAnswer = callData.rtcAnswer
    })
    
    return {
        id = callId,
        rtcAnswer = callData.rtcAnswer
    }
end)

RegisterNetEvent('gcphone:setAirplaneMode', function(enabled)
    local source = source
    AirplaneModeBySource[source] = enabled and true or nil
end)

AddEventHandler('playerDropped', function()
    local source = source
    AirplaneModeBySource[source] = nil
    LastCallStartBySource[source] = nil

    for callId, callData in pairs(ActiveCalls) do
        if IsCallParticipant(callData, source) then
            callData.accepts = false
            callData.duration = callData.startTime and (os.time() - callData.startTime) or 0
            ResetCallChannelForCall(callData)
            SaveCall(callData)

            if callData.transmitterSrc and callData.transmitterSrc ~= source then
                TriggerClientEvent('gcphone:callEnded', callData.transmitterSrc, callId)
            end
            if callData.receiverSrc and callData.receiverSrc ~= source then
                ClearIncomingCallState(callData.receiverSrc)
                TriggerClientEvent('gcphone:callEnded', callData.receiverSrc, callId)
            end

            if callData.receiverSrc == source then
                ClearIncomingCallState(source)
            end

            ActiveCalls[callId] = nil
            SyncActiveCallsToGlobalState()
        end
    end
    SyncActiveCallsToGlobalState()
end)

RegisterNetEvent('gcphone:rejectCall', function(callId)
    local source = source
    callId = IsValidCallId(callId)
    if not callId then return end
    local callData = ActiveCalls[callId]
    
    if not callData or not IsCallParticipant(callData, source) then return end
    
    local duration = callData.startTime and (os.time() - callData.startTime) or 0
    
    callData.accepts = false
    callData.duration = duration
    ResetCallChannelForCall(callData)
    SaveCall(callData)
    ClearIncomingCallState(callData.receiverSrc)
    
    if callData.transmitterSrc then
        TriggerClientEvent('gcphone:callRejected', callData.transmitterSrc, callId)
    end
    
    if callData.receiverSrc then
        TriggerClientEvent('gcphone:callRejected', callData.receiverSrc, callId)
    end
    
    ActiveCalls[callId] = nil
    SyncActiveCallsToGlobalState()
end)

RegisterNetEvent('gcphone:endCall', function(callId)
    local source = source
    callId = IsValidCallId(callId)
    if not callId then return end
    local callData = ActiveCalls[callId]
    
    if not callData or not IsCallParticipant(callData, source) then return end
    
    local duration = callData.startTime and (os.time() - callData.startTime) or 0
    
    callData.duration = duration
    ResetCallChannelForCall(callData)
    SaveCall(callData)
    ClearIncomingCallState(callData.receiverSrc)
    
    if callData.transmitterSrc then
        TriggerClientEvent('gcphone:callEnded', callData.transmitterSrc, callId)
    end
    
    if callData.receiverSrc then
        TriggerClientEvent('gcphone:callEnded', callData.receiverSrc, callId)
    end
    
    ActiveCalls[callId] = nil
    SyncActiveCallsToGlobalState()
end)

RegisterNetEvent('gcphone:sendIceCandidate', function(callId, candidates)
    local source = source
    callId = IsValidCallId(callId)
    if not callId then return end
    local callData = ActiveCalls[callId]
    
    if not callData or not IsCallParticipant(callData, source) then return end
    if type(candidates) ~= 'table' then return end
    if #candidates > 40 then return end
    
    local targetSrc
    if source == callData.transmitterSrc then
        targetSrc = callData.receiverSrc
    else
        targetSrc = callData.transmitterSrc
    end
    
    if targetSrc then
        TriggerClientEvent('gcphone:receiveIceCandidate', targetSrc, candidates)
    end
end)

exports('GetActiveCalls', function()
    return ActiveCalls
end)

exports('GetCallHistory', GetCallHistory)
