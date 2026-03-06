local CALLBACK_TIMEOUT <const> = 120

---@type { [number]: { cb: fun(...), event: string } }
local waitingCallbacks = {}

local function GenerateRequestId()
    local requestId = math.random(999999999)

    while waitingCallbacks[requestId] do
        requestId = math.random(999999999)
    end

    return requestId
end

function TriggerCallback(event, cb, ...)
    local requestId = GenerateRequestId()

    if not cb then
        debugprint(("Callback '%s' was triggered without a callback function^7"):format(event))
        cb = function() end
    end

    waitingCallbacks[requestId] = { cb = cb, event = event }

    SetTimeout(CALLBACK_TIMEOUT * 1000, function()
        if waitingCallbacks[requestId] then
            infoprint("error", ("Callback ^1%s^7 timed out after %is"):format(event, CALLBACK_TIMEOUT))
            waitingCallbacks[requestId].cb(nil)
            waitingCallbacks[requestId] = nil
        end
    end)

    TriggerServerEvent("lb-phone:cb:" .. event, requestId, ...)
end

exports("TriggerCallback", TriggerCallback)

function AwaitCallback(event, ...)
    local responsePromise = promise.new()

    TriggerCallback(event, function(...)
        responsePromise:resolve({ ... })
    end, ...)

    local result = Citizen.Await(responsePromise)

    return table.unpack(result)
end

exports("AwaitCallback", AwaitCallback)

RegisterNetEvent("lb-phone:cb:response", function(requestId, ...)
    local callback = waitingCallbacks[requestId]

    if callback then
        local success, errorMessage = pcall(callback.cb, ...)

        if not success then
            local stackTrace = Citizen.InvokeNative(`FORMAT_STACK_TRACE` & 0xFFFFFFFF, nil, 0, Citizen.ResultAsString())

            print(("^1SCRIPT ERROR: Callback '%s' failed: %s^7\n%s"):format(callback.event, errorMessage or "",
                stackTrace or ""))
        end

        waitingCallbacks[requestId] = nil
    end
end)
