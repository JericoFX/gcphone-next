---@param event string
---@param handler fun(source: number, ...) : ...
function RegisterCallback(event, handler)
    RegisterNetEvent("lb-phone:cb:" .. event, function(requestId, ...)
        local src = source
        local params = { ... }
        local startTime = os.nanotime()

        local success, errorMessage = pcall(function()
            TriggerClientEvent("lb-phone:cb:response", src, requestId, handler(src, table.unpack(params)))

            local finishTime = os.nanotime()
            local ms = (finishTime - startTime) / 1e6

            debugprint(("Callback ^5%s^7 took %.4fms"):format(event, ms))
        end)

        if not success then
            local stackTrace = Citizen.InvokeNative(`FORMAT_STACK_TRACE` & 0xFFFFFFFF, nil, 0, Citizen.ResultAsString())

            print(("^1SCRIPT ERROR: Callback '%s' failed: %s^7\n%s"):format(event, errorMessage or "", stackTrace or ""))
            TriggerClientEvent("lb-phone:cb:response", src, requestId, nil)
        end
    end)
end

exports("RegisterCallback", RegisterCallback)

---@param event string
---@param handler fun(source: number, cb: fun(...), ...)
function RegisterLegacyCallback(event, handler)
    RegisterNetEvent("lb-phone:cb:" .. event, function(requestId, ...)
        local src = source
        local params = { ... }
        local startTime = os.nanotime()

        local success, errorMessage = pcall(function()
            handler(src, function(...)
                TriggerClientEvent("lb-phone:cb:response", src, requestId, ...)

                local finishTime = os.nanotime()
                local ms = (finishTime - startTime) / 1e6

                debugprint(("Callback ^5%s^7 took %.4fms"):format(event, ms))
            end, table.unpack(params))
        end)

        if not success then
            local stackTrace = Citizen.InvokeNative(`FORMAT_STACK_TRACE` & 0xFFFFFFFF, nil, 0, Citizen.ResultAsString())

            print(("^1SCRIPT ERROR: Callback '%s' failed: %s^7\n%s"):format(event, errorMessage or "", stackTrace or ""))
            TriggerClientEvent("lb-phone:cb:response", src, requestId, nil)
        end
    end)
end

---@param event string
---@param callback fun(source: number, phoneNumber: string, ...) : ...
---@param defaultReturn any
function BaseCallback(event, callback, defaultReturn)
    RegisterCallback(event, function(source, ...)
        local phoneNumber = GetEquippedPhoneNumber(source)

        if not phoneNumber then
            debugprint(("^1%s^7: no phone number found for %s | %s"):format(event, GetPlayerName(source), source))
            return defaultReturn
        end

        return callback(source, phoneNumber, ...)
    end)
end

exports("BaseCallback", BaseCallback)
