local PendingTokenRequests = {}
local LastTokenRequestId = 0

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

local function RequestLiveKitToken(source, roomName, identity, participantName, grants)
    local requestId = NextRequestId()
    local p = promise.new()
    PendingTokenRequests[requestId] = p

    TriggerEvent('gcphone:livekit:requestToken', source, requestId, roomName, identity, participantName, grants)

    local startedAt = GetGameTimer()
    while PendingTokenRequests[requestId] do
        if GetGameTimer() - startedAt > 7000 then
            PendingTokenRequests[requestId] = nil
            return nil, 'TOKEN_TIMEOUT'
        end
        Wait(0)
    end

    local result = Citizen.Await(p)
    if type(result) == 'table' and result.ok then
        return result.token, nil
    end
    if type(result) == 'table' and result.error then
        return nil, result.error
    end
    return nil, 'TOKEN_ERROR'
end

AddEventHandler('gcphone:livekit:tokenResponse', function(requestId, token, errorCode)
    local id = tonumber(requestId)
    if not id then return end
    local p = PendingTokenRequests[id]
    if not p then return end
    PendingTokenRequests[id] = nil

    if type(token) == 'string' and token ~= '' then
        p:resolve({ ok = true, token = token })
        return
    end

    p:resolve({ ok = false, error = type(errorCode) == 'string' and errorCode or 'TOKEN_ERROR' })
end)

lib.callback.register('gcphone:livekit:getToken', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then
        return { success = false, error = 'INVALID_SOURCE' }
    end

    local roomName = SafeString(type(data) == 'table' and data.roomName or nil, 80)
    if not roomName then
        return { success = false, error = 'INVALID_ROOM' }
    end

    local identity = SafeString('player:' .. tostring(identifier), 64)
    local participantName = SafeString(GetName(source) or ('player-' .. tostring(source)), 64)

    local grants = {
        canPublish = not (type(data) == 'table' and data.publish == false),
        canSubscribe = true,
        canPublishData = true,
    }

    local token, err = RequestLiveKitToken(source, roomName, identity, participantName, grants)
    if not token then
        return { success = false, error = err or 'TOKEN_ERROR' }
    end

    return {
        success = true,
        url = tostring(GetConvar('livekit_host', tostring((Config.LiveKit and Config.LiveKit.Host) or ''))),
        token = token,
        roomName = roomName,
        identity = identity,
    }
end)
