-- Creado/Modificado por JericoFX

local Bridge = require 'server.bridge'
local Phone = require 'server.modules.phone'
local Utils = require 'server.lib.utils'
local Hooks = require 'server.modules.hooks'

local ActiveCalls = {}
local CallHistory = {}

local function GenerateCallId()
    local id
    repeat
        id = math.random(100000, 999999)
    until not ActiveCalls[id]
    return id
end
local AirplaneModeBySource = {}
-- Re-evaluated on each call so that pma-voice starting or restarting after
-- gcphone does not leave us permanently thinking it is absent.
local function IsUsingPmaVoice()
    return GetResourceState('pma-voice') == 'started'
end
local LastCallStartBySource = {}

-- Publish a minimal snapshot of active calls so external resources and
-- admin tooling can see call state without a cross-resource export hop.
-- Full payload (rtcOffer, extraData, etc.) stays in the server-side table.
local ACTIVE_CALLS_BAG = 'gcphone_active_calls'

local function SyncActiveCallsToGlobalState()
    local snapshot = {}
    for callId, call in pairs(ActiveCalls) do
        snapshot[tostring(callId)] = {
            id = callId,
            transmitterSrc = call.transmitterSrc,
            receiverSrc = call.receiverSrc,
            accepts = call.accepts and true or false,
            startTime = call.startTime,
        }
    end
    GlobalState[ACTIVE_CALLS_BAG] = snapshot
end

-- Seed on load so late-joining clients always see a defined bag.
GlobalState[ACTIVE_CALLS_BAG] = {}

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
    local callMs = (Config.Security and Config.Security.RateLimits and Config.Security.RateLimits.calls) or 1200
    if Utils.HitRateLimit(source, 'calls_start', callMs, 1) then
        return false
    end

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
    if not IsUsingPmaVoice() then return end
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

local function ResolveEmergencyContactByNumber(number)
    local setup = Config.Phone and Config.Phone.Setup or {}
    local contacts = type(setup.EmergencyContacts) == 'table' and setup.EmergencyContacts or {}

    for i = 1, #contacts do
        local entry = contacts[i]
        if type(entry) == 'table' and tostring(entry.number or '') == tostring(number or '') then
            return {
                label = tostring(entry.label or entry.name or 'Emergencia'),
                number = tostring(entry.number or ''),
            }
        end
    end

    return nil
end

local function IncomingCallStateBagName()
    return (Config.NativeAudio and Config.NativeAudio.IncomingCallStateBag) or 'gcphoneIncomingCall'
end

local function ResolveToneId(value)
    if type(value) ~= 'string' then
        return NativeAudioDefaults().ringtone or 'call_1'
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

    return NativeAudioDefaults().ringtone or 'call_1'
end

local function BuildIncomingCallAudioState(targetSource, callId, fromNumber)
    local identifier = Bridge.GetIdentifier(targetSource)
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

    local phoneNumber = Bridge.GetPhoneNumber(identifier)
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
    local identifier = Phone.GetPhoneOwnerIdentifier(source, true)
    return GetCallHistory(identifier)
end)

lib.callback.register('gcphone:deleteCallHistory', function(source, phoneNumber)
    if Phone.IsPhoneReadOnly(source) then return false end
    local identifier = Bridge.GetIdentifier(source)
    if not identifier then return false end

    local myNumber = Bridge.GetPhoneNumber(identifier)
    if not myNumber then return false end

    MySQL.update.await(
        'DELETE FROM phone_calls WHERE owner = ? AND num = ?',
        { myNumber, phoneNumber }
    )

    return true
end)

lib.callback.register('gcphone:clearCallHistory', function(source)
    if Phone.IsPhoneReadOnly(source) then return false end
    local identifier = Bridge.GetIdentifier(source)
    if not identifier then return false end

    local myNumber = Bridge.GetPhoneNumber(identifier)
    if not myNumber then return false end

    MySQL.update.await(
        'DELETE FROM phone_calls WHERE owner = ?',
        { myNumber }
    )

    return true
end)

lib.callback.register('gcphone:startCall', function(source, data)
    if Phone.IsPhoneReadOnly(source) then
        return {
            error = 'READ_ONLY'
        }
    end
    local identifier = Bridge.GetIdentifier(source)
    if not identifier then return nil end
    if type(data) ~= 'table' then return nil end

    local myNumber = Bridge.GetPhoneNumber(identifier)
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

    local emergencyContact = ResolveEmergencyContactByNumber(targetNumber)

    Hooks.triggerHook('numberDialed', {
        source = source,
        identifier = identifier,
        phoneNumber = targetNumber,
        rawInput = tostring(data.phoneNumber or ''),
        isEmergency = emergencyContact ~= nil,
        isHidden = hidden,
        fromLockscreen = type(data.extraData) == 'table' and data.extraData.source == 'lockscreen' or false,
        context = type(data.extraData) == 'table' and data.extraData.source or 'app',
    })

    if Config.FixePhone[targetNumber] then
        local fixeCallId = GenerateCallId()
        local payload = {
            source = source,
            identifier = identifier,
            callId = fixeCallId,
            fromNumber = myNumber,
            toNumber = targetNumber,
            isEmergency = emergencyContact ~= nil,
            emergencyLabel = emergencyContact and emergencyContact.label or nil,
            isHidden = hidden,
            isValid = false,
            fromLockscreen = type(data.extraData) == 'table' and data.extraData.source == 'lockscreen' or false,
            context = type(data.extraData) == 'table' and data.extraData.source or 'app',
        }

        Hooks.triggerHook('callStarted', payload)

        if emergencyContact then
            Hooks.triggerHook('emergencyCallStarted', payload)
        end

        return {
            id = fixeCallId,
            transmitterNum = myNumber,
            receiverNum = targetNumber,
            isValid = false,
            isFixe = true,
            coords = Config.FixePhone[targetNumber].coords
        }
    end

    local targetIdentifier = Bridge.GetIdentifierByPhone(targetNumber)
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

    local callId = GenerateCallId()

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
        local targetSource = Bridge.GetSourceFromIdentifier(targetIdentifier)

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

    local payload = {
        source = source,
        identifier = identifier,
        callId = callId,
        fromNumber = myNumber,
        toNumber = targetNumber,
        isEmergency = emergencyContact ~= nil,
        emergencyLabel = emergencyContact and emergencyContact.label or nil,
        isHidden = hidden,
        isValid = isValid,
        fromLockscreen = type(data.extraData) == 'table' and data.extraData.source == 'lockscreen' or false,
        context = type(data.extraData) == 'table' and data.extraData.source or 'app',
    }

    Hooks.triggerHook('callStarted', payload)

    if emergencyContact then
        Hooks.triggerHook('emergencyCallStarted', payload)
    end

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
    if Utils.HitRateLimit(source, 'calls_accept', 1000, 2) then return nil end
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
    if Utils.HitRateLimit(source, 'calls_airplane_mode', 500, 4) then return end
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
    if Utils.HitRateLimit(source, 'calls_reject', 750, 3) then return end
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
    if Utils.HitRateLimit(source, 'calls_end', 750, 3) then return end
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
    if Utils.HitRateLimit(source, 'calls_ice', 250, 12) then return end
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

---@class GCActiveCallMap: table<integer, table<string, any>>

---Get the currently active calls indexed by call id.
---@return GCActiveCallMap
exports('GetActiveCalls', function()
    return ActiveCalls
end)

---Get call history rows for a player identifier.
---@param identifier string
---@param requestSource integer
---@return table[]
exports('GetCallHistory', function(identifier, requestSource)
    if not Utils.CanAccessIdentifierExport(identifier, requestSource, Phone.GetPhoneOwnerIdentifier, Bridge.GetIdentifier) then
        return {}
    end

    return GetCallHistory(identifier)
end)

lib.callback.register('gcphone:emergencySOS', function(source)
    local identifier = Bridge.GetIdentifier(source)
    if not identifier then return { success = false } end

    -- SOS fans out a high-priority notification to every configured emergency
    -- contact. Without a rate limit a bad client can spam global emergency
    -- notifications / false alarms.
    if Utils.HitRateLimit(source, 'emergency_sos', 60000, 2) then
        return { success = false, error = 'RATE_LIMITED' }
    end

    local myNumber = Bridge.GetPhoneNumber(identifier)
    if not myNumber then return { success = false } end

    local ped = GetPlayerPed(source)
    local coords = GetEntityCoords(ped)
    local playerName = Bridge.GetName(source) or 'Ciudadano'

    local emergencyNumbers = Config.Phone and Config.Phone.Setup and Config.Phone.Setup.EmergencyContacts or {}
    local notified = 0

    for _, entry in ipairs(emergencyNumbers) do
        local targetNumber = type(entry) == 'table' and entry.number or tostring(entry)
        local targetIdentifier = Bridge.GetIdentifierByPhone(targetNumber)
        if targetIdentifier then
            local targetSource = Bridge.GetSourceFromIdentifier(targetIdentifier)
            if targetSource then
                TriggerClientEvent('gcphone:notify', targetSource, {
                    appId = 'calls',
                    title = 'SOS EMERGENCIA',
                    message = string.format('%s necesita ayuda! GPS: %.1f, %.1f', playerName, coords.x, coords.y),
                    priority = 'high',
                    route = 'maps',
                    data = { x = coords.x, y = coords.y, label = 'SOS ' .. playerName },
                })
                notified = notified + 1
            end
        end
    end

    return { success = true, notified = notified, x = coords.x, y = coords.y }
end)

-- When the resource stops (restart, convar change, dev reload) pma-voice
-- keeps every call channel alive because it is a separate resource. Without
-- this cleanup the participants are stuck routed to a dead call channel
-- until they re-join. Reset channels, clear incoming-call state bags, and
-- persist open calls so history is not lost.
AddEventHandler('onResourceStop', function(resourceName)
    if resourceName ~= GetCurrentResourceName() then return end

    for callId, call in pairs(ActiveCalls) do
        ResetCallChannelForCall(call)
        if call.receiverSrc then ClearIncomingCallState(call.receiverSrc) end

        if call.accepts and call.startTime then
            call.duration = os.time() - call.startTime
            local ok, err = pcall(SaveCall, call)
            if not ok then
                print(('^3[gcphone-next] failed to persist call %s on resource stop: %s^7'):format(tostring(callId), tostring(err)))
            end
        end

        ActiveCalls[callId] = nil
    end

    GlobalState[ACTIVE_CALLS_BAG] = {}
end)

return {}
