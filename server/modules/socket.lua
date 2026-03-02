local PendingSocketTokenRequests = {}
local LastSocketTokenRequestId = 0

local function NextRequestId()
    LastSocketTokenRequestId = LastSocketTokenRequestId + 1
    if LastSocketTokenRequestId > 2147483000 then
        LastSocketTokenRequestId = 1
    end
    return LastSocketTokenRequestId
end

local function RequestSocketToken(phone, name)
    local requestId = NextRequestId()
    local p = promise.new()
    PendingSocketTokenRequests[requestId] = p

    TriggerEvent('gcphone:socket:requestToken', requestId, phone, name)

    local startedAt = GetGameTimer()
    while PendingSocketTokenRequests[requestId] do
        if GetGameTimer() - startedAt > 7000 then
            PendingSocketTokenRequests[requestId] = nil
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

AddEventHandler('gcphone:socket:tokenResponse', function(requestId, token, errorCode)
    local id = tonumber(requestId)
    if not id then return end
    local p = PendingSocketTokenRequests[id]
    if not p then return end
    PendingSocketTokenRequests[id] = nil

    if type(token) == 'string' and token ~= '' then
        p:resolve({ ok = true, token = token })
        return
    end

    p:resolve({ ok = false, error = type(errorCode) == 'string' and errorCode or 'TOKEN_ERROR' })
end)

lib.callback.register('gcphone:socket:getToken', function(source)
    local identifier = GetIdentifier(source)
    if not identifier then
        return { success = false, error = 'INVALID_SOURCE' }
    end

    local phone = GetPhoneNumber(identifier)
    if not phone then
        return { success = false, error = 'PHONE_NOT_FOUND' }
    end

    local token, err = RequestSocketToken(phone, GetName(source) or phone)
    if not token then
        return { success = false, error = err or 'TOKEN_ERROR' }
    end

    local host = tostring(GetConvar('gcphone_socket_host', tostring((Config.Socket and Config.Socket.Host) or '')))
    return {
        success = true,
        host = host,
        token = token,
    }
end)
