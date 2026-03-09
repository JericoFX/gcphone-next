-- Creado/Modificado por JericoFX

local PendingTokenRequests = {}
local LastTokenRequestId = 0
local REQUEST_TIMEOUT_MS = 7000
local CLEANUP_INTERVAL_MS = 30000

local Utils = GcPhoneUtils

local function SafeString(value, maxLen)
    return Utils.SafeString(value, maxLen)
end

local function GetRateLimitWindow(key, fallback)
    return Utils.GetRateLimitWindow(key, fallback)
end

local function HitRateLimit(source, key, windowMs, maxHits)
    return Utils.HitRateLimit(source, key, windowMs, maxHits)
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

local function GetLiveKitHost()
    local host = SafeString(GetConvar('livekit_host', ''), 240)
    if not host then
        return nil, 'MISSING_HOST'
    end

    local lowered = string.lower(host)
    if lowered:sub(1, 5) ~= 'ws://' and lowered:sub(1, 6) ~= 'wss://' then
        return nil, 'INVALID_HOST_SCHEME'
    end

    return host
end

local function IsSnapLiveParticipant(liveId, source)
    local identifier = GetIdentifier(source)
    if not identifier then return false, false end

    local stream = MySQL.single.await([[
        SELECT p.account_id, a.identifier
        FROM phone_snap_posts p
        JOIN phone_snap_accounts a ON a.id = p.account_id
        WHERE p.id = ? AND p.is_live = 1
        LIMIT 1
    ]], { liveId })

    if not stream then
        return false, false
    end

    local isOwner = stream.identifier == identifier
    return true, isOwner
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

    local livekitMs = GetRateLimitWindow('livekit_token', 1500)
    if HitRateLimit(source, 'livekit_token', livekitMs, 2) then
        return { success = false, error = 'RATE_LIMITED' }
    end

    local identifier = GetIdentifier(source)
    if not identifier then
        return { success = false, error = 'INVALID_SOURCE' }
    end

    local roomName = SafeString(type(data) == 'table' and data.roomName or nil, 80)
    if not roomName then
        return { success = false, error = 'INVALID_ROOM' }
    end

    local grants = {
        canPublish = not (type(data) == 'table' and data.publish == false),
        canSubscribe = true,
        canPublishData = true,
    }

    local callId = roomName:match('^call%-(%d+)$')
    if callId then
        callId = tonumber(callId)
        if not callId then
            return { success = false, error = 'INVALID_CALL_ID' }
        end

        if not IsParticipantOfCall(callId, source) then
            return { success = false, error = 'NOT_CALL_PARTICIPANT' }
        end
    else
        local liveId = roomName:match('^snaplive%-(%d+)$')
        if not liveId then
            return { success = false, error = 'INVALID_ROOM_FORMAT' }
        end

        liveId = tonumber(liveId)
        if not liveId then
            return { success = false, error = 'INVALID_LIVE_ID' }
        end

        local valid, isOwner = IsSnapLiveParticipant(liveId, source)
        if not valid then
            return { success = false, error = 'NOT_LIVE_PARTICIPANT' }
        end

        -- Verified: only stream owner can publish in snap live room
        grants.canPublish = isOwner
    end

    local identity = SafeString('player:' .. tostring(identifier), 64)
    local participantName = SafeString(GetName(source) or ('player-' .. tostring(source)), 64)
    local configuredDuration = tonumber(Config.LiveKit and Config.LiveKit.MaxCallDurationSeconds) or 300
    if configuredDuration < 30 then configuredDuration = 30 end
    if configuredDuration > 3600 then configuredDuration = 3600 end

    local requestedDuration = tonumber(data and data.maxDuration) or configuredDuration
    if requestedDuration < 30 then requestedDuration = 30 end
    if requestedDuration > configuredDuration then requestedDuration = configuredDuration end
    local maxDuration = math.floor(requestedDuration)

    local host, hostError = GetLiveKitHost()
    if not host then
        return { success = false, error = hostError or 'MISSING_HOST' }
    end

    local requestId = NextRequestId()
    local p = promise.new()
    PendingTokenRequests[requestId] = {
        p = p,
        createdAt = GetGameTimer(),
    }

    TriggerEvent('gcphone:livekit:requestToken', source, requestId, roomName, identity, participantName, grants, maxDuration)

    local result = Citizen.Await(p)
    if type(result) == 'table' and result.ok then
        return {
            success = true,
            url = host,
            token = result.token,
            roomName = roomName,
            identity = identity,
            maxDuration = maxDuration,
        }
    end

    return { success = false, error = result and result.error or 'TOKEN_ERROR' }
end)
