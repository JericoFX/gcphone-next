local NearbyVoiceSession = nil
local NearbyVoiceLastState = nil
local NearbyVoiceLastVolume = nil
-- Verified: CommunityOX ox_lib Math/Shared exposes lib.math.clamp and lib.math.round
local libmath = lib.math

local function ComputeVoiceVolume(distance, maxDistance, minVolume, maxVolume, curve)
    if not distance or distance < 0.0 or distance >= maxDistance then
        return 0.0
    end

    local ratio = 1.0 - (distance / maxDistance)
    local shaped = ratio ^ curve
    return libmath.clamp(minVolume + ((maxVolume - minVolume) * shaped), 0.0, 1.0)
end

local function SmoothVolume(previous, target, factor)
    local clampedFactor = libmath.clamp(tonumber(factor) or 0.0, 0.0, 1.0)
    return previous + ((target - previous) * clampedFactor)
end

local function GetMumbleRange()
    local ok, range = pcall(MumbleGetTalkerProximity)
    if ok and type(range) == 'number' and range > 0.0 then
        return range + 0.0
    end

    return nil
end

local function PushNearbyVoiceState()
    local session = NearbyVoiceSession
    if not session then
        if NearbyVoiceLastState == 'inactive' then
            return
        end

        NearbyVoiceLastState = 'inactive'
        SendNUIMessage({
            action = 'gcphone:nearbyVoiceState',
            data = {
                active = false,
                listening = false,
                peerId = nil,
                targetOnline = false,
                distance = -1,
            }
        })
        return
    end

    local roundedDistance = session.distance and libmath.round(session.distance, 1) or -1
    local stateKey = ('%s|%s|%s|%s'):format(
        tostring(session.peerId),
        tostring(session.listening == true),
        tostring(session.targetOnline == true),
        tostring(roundedDistance)
    )
    if stateKey == NearbyVoiceLastState then
        return
    end

    NearbyVoiceLastState = stateKey

    SendNUIMessage({
        action = 'gcphone:nearbyVoiceState',
        data = {
            active = true,
            listening = session.listening == true,
            peerId = session.peerId,
            targetOnline = session.targetOnline == true,
            distance = roundedDistance,
        }
    })
end

local function PushNearbyVoiceVolume(volume)
    local session = NearbyVoiceSession
    local roundedVolume = libmath.round(libmath.clamp(tonumber(volume) or 0.0, 0.0, 1.0), 2)
    local volumeKey = ('%s|%s'):format(tostring(session and session.peerId or false), tostring(roundedVolume))
    if volumeKey == NearbyVoiceLastVolume then
        return
    end

    NearbyVoiceLastVolume = volumeKey
    SendNUIMessage({
        action = 'gcphone:nearbyVoiceVolume',
        data = {
            active = session ~= nil,
            peerId = session and session.peerId or nil,
            volume = roundedVolume,
        }
    })
end

local function StopNearbyVoiceSession(notifyServer)
    NearbyVoiceSession = nil
    NearbyVoiceLastState = nil
    NearbyVoiceLastVolume = nil
    PushNearbyVoiceState()
    PushNearbyVoiceVolume(0.0)

    if notifyServer ~= false then
        TriggerServerEvent('gcphone:nearbyVoice:setPeerId', nil)
    end
end

RegisterNUICallback('setListeningPeerId', function(data, cb)
    local peerId = nil
    local targetServerId = nil

    if type(data) == 'table' then
        if data.peerId ~= nil then
            local value = tostring(data.peerId)
            if value ~= '' then
                peerId = value
            end
        end

        targetServerId = tonumber(data.targetServerId or data.serverId)
    end

    if not peerId or not targetServerId or targetServerId <= 0 then
        StopNearbyVoiceSession(true)
        cb({ success = true, active = false, peerId = nil })
        return
    end

    NearbyVoiceSession = {
        peerId = peerId,
        targetServerId = targetServerId,
        listenDistance = libmath.clamp(tonumber(type(data) == 'table' and data.listenDistance or nil) or 5.0, 5.0, 40.0),
        leaveBuffer = libmath.clamp(tonumber(type(data) == 'table' and data.leaveBuffer or nil) or 0.0, 0.0, 10.0),
        minVolume = libmath.clamp(tonumber(type(data) == 'table' and data.minVolume or nil) or 0.0, 0.0, 1.0),
        maxVolume = libmath.clamp(tonumber(type(data) == 'table' and data.maxVolume or nil) or 1.0, 0.0, 1.0),
        distanceCurve = libmath.clamp(tonumber(type(data) == 'table' and data.distanceCurve or nil) or 1.0, 0.5, 4.0),
        volumeSmoothing = libmath.clamp(tonumber(type(data) == 'table' and data.volumeSmoothing or nil) or 0.1, 0.05, 1.0),
        useMumbleRangeClamp = not (type(data) == 'table' and data.useMumbleRangeClamp == false),
        updateIntervalMs = math.floor(libmath.clamp(tonumber(type(data) == 'table' and data.updateIntervalMs or nil) or 80.0, 80.0, 1500.0)),
        currentVolume = 0.0,
        listening = false,
        targetOnline = false,
        distance = -1,
    }

    TriggerServerEvent('gcphone:nearbyVoice:setPeerId', peerId)
    PushNearbyVoiceState()
    cb({ success = true, active = true, peerId = peerId })
end)

RegisterNUICallback('getListeningPeerId', function(_, cb)
    local session = NearbyVoiceSession
    cb({
        active = session ~= nil,
        peerId = session and session.peerId or nil,
        targetServerId = session and session.targetServerId or nil,
        listening = session and session.listening == true or false,
        volume = session and session.currentVolume or 0.0,
    })
end)

CreateThread(function()
    while true do
        local session = NearbyVoiceSession
        if not session then
            Wait(500)
        else
            local targetPlayer = GetPlayerFromServerId(session.targetServerId)
            local targetOnline = targetPlayer ~= -1 and NetworkIsPlayerActive(targetPlayer)
            local currentDistance = -1.0
            local activeDistance = session.listenDistance

            if session.useMumbleRangeClamp then
                local mumbleRange = GetMumbleRange()
                if mumbleRange then
                    activeDistance = math.min(activeDistance, mumbleRange)
                end
            end

            if targetOnline then
                local myCoords = GetEntityCoords(cache.ped)
                local targetPed = GetPlayerPed(targetPlayer)
                if targetPed ~= 0 and DoesEntityExist(targetPed) then
                    currentDistance = #(myCoords - GetEntityCoords(targetPed))
                else
                    targetOnline = false
                end
            end

            session.targetOnline = targetOnline
            session.distance = targetOnline and currentDistance or -1.0

            if not targetOnline then
                session.listening = false
            elseif session.listening then
                session.listening = currentDistance <= (activeDistance + session.leaveBuffer)
            else
                session.listening = currentDistance <= activeDistance
            end

            local targetVolume = 0.0
            if session.listening then
                targetVolume = ComputeVoiceVolume(currentDistance, activeDistance, session.minVolume, session.maxVolume, session.distanceCurve)
            end

            session.currentVolume = SmoothVolume(session.currentVolume, targetVolume, session.volumeSmoothing)
            PushNearbyVoiceState()
            PushNearbyVoiceVolume(session.currentVolume)

            Wait(session.updateIntervalMs)
        end
    end
end)

RegisterNetEvent('gcphone:nearbyVoice:started', function(_serverId, peerId)
    SendNUIMessage({
        action = 'gcphone:nearbyVoiceStarted',
        data = { peerId = peerId }
    })
end)

RegisterNetEvent('gcphone:nearbyVoice:stopped', function(peerId)
    SendNUIMessage({
        action = 'gcphone:nearbyVoiceStopped',
        data = { peerId = peerId }
    })
end)

AddEventHandler('onResourceStop', function(resourceName)
    if resourceName ~= GetCurrentResourceName() then return end
    StopNearbyVoiceSession(true)
end)
