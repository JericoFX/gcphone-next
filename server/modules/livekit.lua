-- Creado/Modificado por JericoFX

local PendingTokenRequests = {}
local LastTokenRequestId = 0
local REQUEST_TIMEOUT_MS = 7000
local CLEANUP_INTERVAL_MS = 30000

local function SafeString(value, maxLen)
    if type(value) ~= 'string' then return nil end
    local normalized = value:gsub('[%z\1-\31\127]', ''):gsub('^%s+', ''):gsub('%s+$', '')
    if normalized == '' then return nil end
    if #normalized > maxLen then
        normalized = normalized:sub(1, maxLen)
    end
    return normalized
end

local function NextRequestId()
    LastTokenRequestId = LastTokenRequestId + 1
    if LastTokenRequestId > 2147483000 then
        LastTokenRequestId = 1
    end
    return LastTokenRequestId
end

local function IsParticipantOfCall(callId, source)
    local calls = GlobalState.gcphoneActiveCalls or {}
    local call = calls[callId]
    if not call then return false end
    return source == call.transmitterSrc or source == call.receiverSrc
end

local function CleanupExpiredRequests()
    local now = GetGameTimer()
    for id, data in pairs(PendingTokenRequests) do
        if now - data.createdAt > REQUEST_TIMEOUT_MS then
            data.p:resolve({ ok = false, error = 'TOKEN_TIMEOUT' })
            PendingTokenRequests[id] = nil
        end
    end
    SetTimeout(CLEANUP_INTERVAL_MS, CleanupExpiredRequests)
end

SetTimeout(CLEANUP_INTERVAL_MS, CleanupExpiredRequests)

AddEventHandler('gcphone:livekit:tokenResponse', function(requestId, token, errorCode)
    local id = tonumber(requestId)
    if not id then return end
    local data = PendingTokenRequests[id]
    if not data then return end
    PendingTokenRequests[id] = nil

    if type(token) == 'string' and token ~= '' then
        data.p:resolve({ ok = true, token = token })
        return
    end

    data.p:resolve({ ok = false, error = type(errorCode) == 'string' and errorCode or 'TOKEN_ERROR' })
end)

lib.callback.register('gcphone:livekit:getToken', function(source, data)
    if Config.LiveKit and Config.LiveKit.Enabled == false then
        return { success = false, error = 'LIVEKIT_DISABLED' }
    end

    local identifier = GetIdentifier(source)
    if not identifier then
        return { success = false, error = 'INVALID_SOURCE' }
    end

    local roomName = SafeString(type(data) == 'table' and data.roomName or nil, 80)
    if not roomName then
        return { success = false, error = 'INVALID_ROOM' }
    end

    local callId = roomName:match('^call%-(%d+)$')
    if not callId then
        return { success = false, error = 'INVALID_ROOM_FORMAT' }
    end
    callId = tonumber(callId)
    if not callId then
        return { success = false, error = 'INVALID_CALL_ID' }
    end

    if not IsParticipantOfCall(callId, source) then
        return { success = false, error = 'NOT_CALL_PARTICIPANT' }
    end

    local identity = SafeString('player:' .. tostring(identifier), 64)
    local participantName = SafeString(GetName(source) or ('player-' .. tostring(source)), 64)
    local maxDuration = tonumber(data and data.maxDuration) or 300

    local grants = {
        canPublish = not (type(data) == 'table' and data.publish == false),
        canSubscribe = true,
        canPublishData = true,
    }

    local requestId = NextRequestId()
    local p = promise.new()
    PendingTokenRequests[requestId] = {
        p = p,
        createdAt = GetGameTimer(),
    }

    TriggerEvent('gcphone:livekit:requestToken', source, requestId, roomName, identity, participantName, grants)

    local result = Citizen.Await(p)
    if type(result) == 'table' and result.ok then
        return {
            success = true,
            url = tostring(GetConvar('livekit_host', tostring((Config.LiveKit and Config.LiveKit.Host) or ''))),
            token = result.token,
            roomName = roomName,
            identity = identity,
            maxDuration = maxDuration,
        }
    end

    return { success = false, error = result and result.error or 'TOKEN_ERROR' }
end)
