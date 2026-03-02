-- Implements: OPT-01 – Eliminar busy-wait, OPT-04 – Cleanup requests pendientes

local PendingSocketTokenRequests = {}
local LastSocketTokenRequestId = 0
local REQUEST_TIMEOUT_MS = 7000
local CLEANUP_INTERVAL_MS = 30000

local function NextRequestId()
    LastSocketTokenRequestId = LastSocketTokenRequestId + 1
    if LastSocketTokenRequestId > 2147483000 then
        LastSocketTokenRequestId = 1
    end
    return LastSocketTokenRequestId
end

local function CleanupExpiredRequests()
    local now = GetGameTimer()
    for id, data in pairs(PendingSocketTokenRequests) do
        if now - data.createdAt > REQUEST_TIMEOUT_MS then
            data.p:resolve({ ok = false, error = 'TOKEN_TIMEOUT' })
            PendingSocketTokenRequests[id] = nil
        end
    end
    SetTimeout(CLEANUP_INTERVAL_MS, CleanupExpiredRequests)
end

SetTimeout(CLEANUP_INTERVAL_MS, CleanupExpiredRequests)

AddEventHandler('gcphone:socket:tokenResponse', function(requestId, token, errorCode)
    local id = tonumber(requestId)
    if not id then return end
    local data = PendingSocketTokenRequests[id]
    if not data then return end
    PendingSocketTokenRequests[id] = nil

    if type(token) == 'string' and token ~= '' then
        data.p:resolve({ ok = true, token = token })
        return
    end

    data.p:resolve({ ok = false, error = type(errorCode) == 'string' and errorCode or 'TOKEN_ERROR' })
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

    local requestId = NextRequestId()
    local p = promise.new()
    PendingSocketTokenRequests[requestId] = {
        p = p,
        createdAt = GetGameTimer(),
    }

    TriggerEvent('gcphone:socket:requestToken', requestId, phone, GetName(source) or phone)

    local result = Citizen.Await(p)
    if type(result) == 'table' and result.ok then
        local host = tostring(GetConvar('gcphone_socket_host', tostring((Config.Socket and Config.Socket.Host) or '')))
        return {
            success = true,
            host = host,
            token = result.token,
        }
    end

    return { success = false, error = result and result.error or 'TOKEN_ERROR' }
end)
