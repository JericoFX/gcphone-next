-- Creado/Modificado por JericoFX

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

local Utils = GcPhoneUtils

local function SafeString(value, maxLen)
    return Utils.SafeString(value, maxLen)
end

local function GetSocketHost()
    local host = SafeString(GetConvar('gcphone_socket_host', ''), 240)
    if not host then
        return nil, 'MISSING_SOCKET_HOST'
    end

    local lowered = string.lower(host)
    if lowered:sub(1, 5) ~= 'ws://' and lowered:sub(1, 6) ~= 'wss://' then
        return nil, 'INVALID_SOCKET_HOST_SCHEME'
    end

    return host
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

local function GetUserGroupIds(identifier)
    if not identifier then return {} end
    local rows = MySQL.query.await(
        'SELECT group_id FROM phone_chat_group_members WHERE identifier = ?',
        { identifier }
    )
    if not rows then return {} end
    local ids = {}
    for _, row in ipairs(rows) do
        ids[#ids + 1] = tostring(row.group_id)
    end
    return ids
end

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
    if Config.Socket and Config.Socket.Enabled == false then
        return { success = false, error = 'SOCKET_DISABLED' }
    end

    local identifier = GetIdentifier(source)
    if not identifier then
        return { success = false, error = 'INVALID_SOURCE' }
    end

    local phone = GetPhoneNumber(identifier)
    if not phone then
        return { success = false, error = 'PHONE_NOT_FOUND' }
    end

    local groupIds = GetUserGroupIds(identifier)
    local host, hostError = GetSocketHost()
    if not host then
        return { success = false, error = hostError or 'MISSING_SOCKET_HOST' }
    end

    local requestId = NextRequestId()
    local p = promise.new()
    PendingSocketTokenRequests[requestId] = {
        p = p,
        createdAt = GetGameTimer(),
    }

    TriggerEvent('gcphone:socket:requestToken', requestId, phone, GetName(source) or phone, groupIds)

    local result = Citizen.Await(p)
    if type(result) == 'table' and result.ok then
        return {
            success = true,
            host = host,
            token = result.token,
        }
    end

    return { success = false, error = result and result.error or 'TOKEN_ERROR' }
end)
