local PhoneState = require 'client.state'

local pendingCallbacks = {}

--- Open a mini app inside the phone
--- @param options table { title: string, url?: string, height?: number, options?: table[], callbackEvent?: string }
exports('openMiniApp', function(options)
    if type(options) ~= 'table' then return end

    local url = type(options.url) == 'string' and options.url or nil
    local hasOptions = type(options.options) == 'table' and #options.options > 0

    if not url and not hasOptions then return end
    if url and not url:match('^https?://') then return end

    local title = type(options.title) == 'string' and options.title or 'App'
    local height = type(options.height) == 'number' and options.height or 400
    local callerResource = GetInvokingResource() or 'unknown'
    local callbackEvent = type(options.callbackEvent) == 'string' and options.callbackEvent or nil

    if not PhoneState.isOpen then return end

    local sanitizedOptions = {}
    if hasOptions then
        for _, opt in ipairs(options.options) do
            if type(opt) == 'table' and type(opt.label) == 'string' then
                sanitizedOptions[#sanitizedOptions + 1] = {
                    id = type(opt.id) == 'string' and opt.id or ('opt_' .. #sanitizedOptions),
                    label = opt.label,
                    icon = type(opt.icon) == 'string' and opt.icon or nil,
                    tone = type(opt.tone) == 'string' and opt.tone or 'default',
                }
            end
            if #sanitizedOptions >= 10 then break end
        end
    end

    SendNUIMessage({
        type = 'gcphone:openMiniApp',
        payload = {
            title = title,
            url = url,
            height = height,
            resourceName = callerResource,
            options = #sanitizedOptions > 0 and sanitizedOptions or nil,
            callbackEvent = callbackEvent,
        }
    })
end)

exports('closeMiniApp', function()
    SendNUIMessage({
        type = 'gcphone:closeMiniApp',
        payload = {}
    })
end)

RegisterNUICallback('gcphone:miniAppCallback', function(data, cb)
    if type(data) ~= 'table' or not data.optionId then
        cb({ ok = true })
        return
    end

    local resourceName = data.resourceName or 'unknown'
    local optionId = data.optionId

    TriggerEvent('gcphone:miniAppOptionSelected', resourceName, optionId)

    cb({ ok = true })
end)
