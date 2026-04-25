local Nui = {}

local NO_PAYLOAD = {}

function Nui.cbSuccess(success, message, extra)
    local payload = {
        success = success and true or false
    }

    if message ~= nil then
        payload.message = message
    end

    if type(extra) == 'table' then
        for k, v in pairs(extra) do
            payload[k] = v
        end
    elseif extra ~= nil then
        payload.error = tostring(extra)
    end

    return payload
end

local function resolveData(mapper, data)
    if mapper == nil then
        return true, data
    end

    if mapper == false then
        return false, nil
    end

    return true, mapper(data)
end

local function callback(eventName, hasPayload, payload, handler)
    if hasPayload then
        lib.callback(eventName, false, handler, payload)
        return
    end

    lib.callback(eventName, false, handler)
end

function Nui.proxy(name, eventName, fallback, mapper)
    RegisterNUICallback(name, function(data, cb)
        local hasPayload, payload = resolveData(mapper, data)

        callback(eventName, hasPayload, payload, function(result)
            if result == nil and fallback ~= NO_PAYLOAD then
                cb(fallback)
                return
            end

            cb(result)
        end)
    end)
end

function Nui.proxySuccess(name, eventName, mapper)
    RegisterNUICallback(name, function(data, cb)
        local hasPayload, payload = resolveData(mapper, data)

        callback(eventName, hasPayload, payload, function(success, message)
            cb(Nui.cbSuccess(success, message))
        end)
    end)
end

function Nui.noFallback()
    return NO_PAYLOAD
end

return Nui
