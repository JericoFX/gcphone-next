local PhoneState = require 'client.state'

local PendingResults = {}
local RequestIdCounter = 0

local function NextRequestId()
    RequestIdCounter = RequestIdCounter + 1
    return ('sdk_%d_%d'):format(GetGameTimer(), RequestIdCounter)
end

local function SanitizeString(value, maxLen)
    if type(value) ~= 'string' then return '' end
    local text = value:gsub('[%z\1-\31\127]', '')
    text = text:gsub('<.->', '')
    text = text:gsub('^%s+', ''):gsub('%s+$', '')
    return text:sub(1, maxLen or 200)
end

local function SanitizeElements(elements, maxCount)
    if type(elements) ~= 'table' then return {} end
    local result = {}
    for i, el in ipairs(elements) do
        if i > (maxCount or 20) then break end
        if type(el) == 'table' and type(el.type) == 'string' then
            result[#result + 1] = el
        end
    end
    return result
end

local function SanitizeOptions(options, maxCount)
    if type(options) ~= 'table' then return {} end
    local result = {}
    for i, opt in ipairs(options) do
        if i > (maxCount or 4) then break end
        if type(opt) == 'table' and type(opt.id) == 'string' and type(opt.label) == 'string' then
            result[#result + 1] = {
                id = SanitizeString(opt.id, 32),
                label = SanitizeString(opt.label, 60),
                tone = type(opt.tone) == 'string' and opt.tone or 'default',
                navigateTo = type(opt.navigateTo) == 'string' and opt.navigateTo or nil,
            }
        end
    end
    return result
end

local function SanitizeItems(items, maxCount)
    if type(items) ~= 'table' then return {} end
    local result = {}
    for i, item in ipairs(items) do
        if i > (maxCount or 50) then break end
        if type(item) == 'table' and type(item.id) == 'string' and type(item.label) == 'string' then
            result[#result + 1] = {
                id = SanitizeString(item.id, 32),
                label = SanitizeString(item.label, 80),
                description = type(item.description) == 'string' and SanitizeString(item.description, 120) or nil,
                icon = type(item.icon) == 'string' and item.icon:sub(1, 8) or nil,
                tone = type(item.tone) == 'string' and item.tone or 'default',
                navigateTo = type(item.navigateTo) == 'string' and item.navigateTo or nil,
                disabled = item.disabled == true,
            }
        end
    end
    return result
end

local function WaitForResult(requestId, timeoutMs)
    local deadline = GetGameTimer() + (timeoutMs or 60000)
    while GetGameTimer() < deadline do
        local result = PendingResults[requestId]
        if result ~= nil then
            PendingResults[requestId] = nil
            if result.cancelled then return nil end
            return result
        end
        Wait(50)
    end
    PendingResults[requestId] = nil
    return nil
end

local function OpenSDKModal(payload)
    if not PhoneState.isOpen then return nil, 'PHONE_CLOSED' end

    SendNUIMessage({
        type = 'gcphone:sdk:open',
        payload = payload,
    })

    return WaitForResult(payload.requestId, 60000)
end

RegisterNUICallback('phoneSDKResult', function(data, cb)
    if type(data) ~= 'table' or not data.requestId then
        cb({ ok = true })
        return
    end
    PendingResults[data.requestId] = data
    cb({ ok = true })
end)

exports('phoneInput', function(title, elements, options)
    if type(title) ~= 'string' then return nil end
    options = type(options) == 'table' and options or {}

    local requestId = NextRequestId()
    local result = OpenSDKModal({
        requestId = requestId,
        mode = 'input',
        title = SanitizeString(title, 40),
        resourceName = GetInvokingResource() or 'unknown',
        elements = SanitizeElements(elements, 20),
        submitLabel = type(options.submitLabel) == 'string' and SanitizeString(options.submitLabel, 30) or nil,
        submitTone = type(options.submitTone) == 'string' and options.submitTone or 'primary',
        cancelLabel = type(options.cancelLabel) == 'string' and SanitizeString(options.cancelLabel, 30) or nil,
    })

    return result and result.formData or nil
end)

exports('phoneConfirm', function(title, options)
    if type(title) ~= 'string' then return false end
    options = type(options) == 'table' and options or {}

    local requestId = NextRequestId()
    local result = OpenSDKModal({
        requestId = requestId,
        mode = 'confirm',
        title = SanitizeString(title, 40),
        icon = type(options.icon) == 'string' and options.icon:sub(1, 8) or nil,
        resourceName = GetInvokingResource() or 'unknown',
        description = type(options.description) == 'string' and SanitizeString(options.description, 400) or nil,
        confirmLabel = type(options.confirmLabel) == 'string' and SanitizeString(options.confirmLabel, 30) or nil,
        confirmTone = type(options.confirmTone) == 'string' and options.confirmTone or 'primary',
        cancelLabel = type(options.cancelLabel) == 'string' and SanitizeString(options.cancelLabel, 30) or nil,
    })

    return result ~= nil and result.confirmed == true
end)

exports('phoneSelect', function(title, items, options)
    if type(title) ~= 'string' then return nil end
    options = type(options) == 'table' and options or {}

    local requestId = NextRequestId()
    local result = OpenSDKModal({
        requestId = requestId,
        mode = 'select',
        title = SanitizeString(title, 40),
        resourceName = GetInvokingResource() or 'unknown',
        items = SanitizeItems(items, 50),
        searchable = options.searchable == true,
        cancelLabel = type(options.cancelLabel) == 'string' and SanitizeString(options.cancelLabel, 30) or nil,
    })

    return result and result.selectedId or nil
end)

exports('openPhoneUI', function(id)
    if type(id) ~= 'string' then return nil end

    local definition = lib.callback.await('gcphone:sdk:getRegisteredUI', false, id)
    if not definition then return nil, 'NOT_FOUND' end

    local requestId = NextRequestId()
    return OpenSDKModal({
        requestId = requestId,
        mode = 'registered',
        title = SanitizeString(definition.title or id, 40),
        icon = type(definition.icon) == 'string' and definition.icon:sub(1, 8) or nil,
        resourceName = definition.resourceName or 'unknown',
        views = definition.views or {},
        startView = definition.startView or 'main',
    })
end)

lib.callback.register('gcphone:sdk:openUIFromServer', function(definition)
    if type(definition) ~= 'table' then return nil end

    local requestId = NextRequestId()
    return OpenSDKModal({
        requestId = requestId,
        mode = 'registered',
        title = SanitizeString(definition.title or '', 40),
        icon = type(definition.icon) == 'string' and definition.icon:sub(1, 8) or nil,
        resourceName = definition.resourceName or 'unknown',
        views = definition.views or {},
        startView = definition.startView or 'main',
    })
end)

RegisterNetEvent('gcphone:sdk:resourceStopped', function(resourceName)
    if type(resourceName) ~= 'string' then return end
    SendNUIMessage({
        type = 'gcphone:sdk:resourceStopped',
        payload = { resourceName = resourceName },
    })
end)

-- ── Client events for permission-gated actions ──

RegisterNetEvent('gcphone:sdk:setWaypoint', function(x, y, label)
    if type(x) ~= 'number' or type(y) ~= 'number' then return end
    SetNewWaypoint(x + 0.0, y + 0.0)
end)

RegisterNetEvent('gcphone:sdk:startCall', function(number)
    if type(number) ~= 'string' or number == '' then return end
    SendNUIMessage({
        type = 'gcphone:startCall',
        payload = { number = number },
    })
end)

RegisterNetEvent('gcphone:sdk:forceClose', function(appId)
    SendNUIMessage({
        type = 'gcphone:sdk:close',
        payload = {},
    })
end)

-- Check for promo notifications when phone opens.
-- NOTE: gcphone:phoneOpened is a local event that must be emitted
-- by client/phone.lua (ShowPhonePayload) to activate this handler.
AddEventHandler('gcphone:phoneOpened', function()
    CreateThread(function()
        lib.callback('gcphone:sdk:checkPromos', false)
    end)
end)
