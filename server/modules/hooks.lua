local eventHooks = {}
local hookId = 0
local microtime = os.microtime or function()
    return math.floor(os.clock() * 1000000)
end

local AllowedHooks = {
    numberDialed = true,
    callStarted = true,
    emergencyCallStarted = true,
    contactAdded = true,
    contactUpdated = true,
    contactDeleted = true,
    messageSent = true,
    mailAccountCreated = true,
    phoneSetupCompleted = true,
    deviceUnlocked = true,
    imeiViewed = true,
}

local function isAllowedHook(event)
    return type(event) == 'string' and AllowedHooks[event] == true
end

local function registerHook(event, cb, options)
    if not isAllowedHook(event) or type(cb) ~= 'function' then return false end

    if not eventHooks[event] then
        eventHooks[event] = {}
    end

    hookId = hookId + 1
    local entry = {
        cb = cb,
        resource = GetInvokingResource() or GetCurrentResourceName(),
        hookId = hookId,
    }

    if type(options) == 'table' then
        for key, value in pairs(options) do
            entry[key] = value
        end
    end

    eventHooks[event][#eventHooks[event] + 1] = entry
    return hookId
end

local function triggerHook(event, payload)
    if not isAllowedHook(event) then return false end

    local hooks = eventHooks[event]
    if not hooks or #hooks == 0 then
        return true
    end

    for i = 1, #hooks do
        local hook = hooks[i]

        if hook.print then
            print(('[gcphone-next] triggering hook %s:%s:%s'):format(hook.resource or 'unknown', event, hook.hookId or i))
        end

        local startTime = microtime()
        local ok, response = pcall(hook.cb, payload)
        local executionTime = microtime() - startTime

        if not ok then
            warn(('[gcphone-next] hook error %s:%s:%s -> %s'):format(hook.resource or 'unknown', event, hook.hookId or i, tostring(response)))
        elseif response == false then
            return false
        end

        if executionTime >= 100000 then
            warn(('[gcphone-next] hook %s:%s:%s took %.2fms'):format(hook.resource or 'unknown', event, hook.hookId or i, executionTime / 1000))
        end
    end

    return true
end

local function removeResourceHooks(resource, id)
    if type(resource) ~= 'string' or resource == '' then return end

    for _, hooks in pairs(eventHooks) do
        for i = #hooks, 1, -1 do
            local hook = hooks[i]
            if hook.resource == resource and (not id or hook.hookId == id) then
                table.remove(hooks, i)
            end
        end
    end
end

AddEventHandler('onResourceStop', function(resourceName)
    removeResourceHooks(resourceName)
end)

exports('registerHook', function(event, cb, options)
    return registerHook(event, cb, options)
end)

exports('removeHooks', function(id)
    removeResourceHooks(GetInvokingResource() or GetCurrentResourceName(), id)
end)

exports('triggerHook', function(event, payload)
    return triggerHook(event, payload)
end)

rawset(_G, 'RegisterPhoneHook', registerHook)
rawset(_G, 'TriggerPhoneHook', triggerHook)
rawset(_G, 'RemovePhoneHooks', removeResourceHooks)
