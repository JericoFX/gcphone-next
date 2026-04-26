local Bridge = require 'server.bridge'
local Phone = require 'server.modules.phone'
local Utils = require 'server.lib.utils'

local Registry = {}
local ResultHandlers = {}
local OpenHandlers = {}
local VisibilityOverrides = {}
local RateLimits = {}

local MAX_REGISTERED_PER_RESOURCE = (Config.SDK and Config.SDK.MaxRegisteredPerResource) or 20
local RATE_WINDOW_MS = (Config.SDK and Config.SDK.RateWindowMs) or 10000
local RATE_MAX_PER_RESOURCE = (Config.SDK and Config.SDK.RateMaxPerResource) or 3
local RATE_MAX_PER_PLAYER = (Config.SDK and Config.SDK.RateMaxPerPlayer) or 5

local function SanitizeString(value, maxLen)
    if type(value) ~= 'string' then return '' end
    local text = value:gsub('[%z\1-\31\127]', '')
    text = text:gsub('<.->', '')
    text = text:gsub('^%s+', ''):gsub('%s+$', '')
    return text:sub(1, maxLen or 200)
end

local function CheckRateLimit(source, resourceName)
    local now = GetGameTimer()
    if not RateLimits[source] then
        RateLimits[source] = { timestamps = {}, perResource = {} }
    end
    local limits = RateLimits[source]

    -- Check per-resource first (fail fast without affecting global counter)
    if not limits.perResource[resourceName] then
        limits.perResource[resourceName] = {}
    end
    local resCleaned = {}
    for _, ts in ipairs(limits.perResource[resourceName]) do
        if now - ts < RATE_WINDOW_MS then resCleaned[#resCleaned + 1] = ts end
    end
    limits.perResource[resourceName] = resCleaned

    if #limits.perResource[resourceName] >= RATE_MAX_PER_RESOURCE then
        return false, 'RATE_LIMITED'
    end

    -- Then check global per-player
    local cleaned = {}
    for _, ts in ipairs(limits.timestamps) do
        if now - ts < RATE_WINDOW_MS then cleaned[#cleaned + 1] = ts end
    end
    limits.timestamps = cleaned

    if #limits.timestamps >= RATE_MAX_PER_PLAYER then
        return false, 'RATE_LIMITED'
    end

    -- Both passed, record timestamps
    limits.timestamps[#limits.timestamps + 1] = now
    limits.perResource[resourceName][#limits.perResource[resourceName] + 1] = now

    return true
end

local VALID_ELEMENT_TYPES = {
    input = true, number = true, textarea = true, select = true,
    checkbox = true, header = true, label = true, divider = true,
    image = true, list = true,
}

local function SanitizeUrl(value)
    if type(value) ~= 'string' then return nil end
    local url = value:gsub('[%z\1-\31\127]', ''):gsub('^%s+', ''):gsub('%s+$', '')
    if url == '' then return nil end
    if not url:match('^https://') then return nil end
    return url:sub(1, 500)
end

local function SanitizeSelectOptions(options)
    if type(options) ~= 'table' then return {} end
    local result = {}
    for i, opt in ipairs(options) do
        if i > 30 then break end
        if type(opt) == 'table' then
            result[#result + 1] = {
                value = SanitizeString(opt.value, 64),
                label = SanitizeString(opt.label, 80),
            }
        end
    end
    return result
end

local function SanitizeListItems(items)
    if type(items) ~= 'table' then return {} end
    local result = {}
    for i, item in ipairs(items) do
        if i > 50 then break end
        if type(item) == 'table' and type(item.id) == 'string' then
            result[#result + 1] = {
                id = SanitizeString(item.id, 32),
                label = SanitizeString(item.label, 80),
                description = type(item.description) == 'string' and SanitizeString(item.description, 120) or nil,
                icon = type(item.icon) == 'string' and item.icon:sub(1, 8) or nil,
                tone = type(item.tone) == 'string' and item.tone or 'default',
                navigateTo = type(item.navigateTo) == 'string' and SanitizeString(item.navigateTo, 32) or nil,
                disabled = item.disabled == true,
            }
        end
    end
    return result
end

local function SanitizeElement(el)
    if type(el) ~= 'table' or type(el.type) ~= 'string' then return nil end
    if not VALID_ELEMENT_TYPES[el.type] then return nil end

    local safe = { type = el.type }

    if el.type == 'input' or el.type == 'number' or el.type == 'textarea' or el.type == 'select' or el.type == 'checkbox' then
        safe.id = SanitizeString(el.id, 32)
        safe.label = SanitizeString(el.label, 80)
        safe.required = el.required == true
    end

    if el.type == 'input' then
        safe.placeholder = type(el.placeholder) == 'string' and SanitizeString(el.placeholder, 80) or nil
        safe.maxLength = type(el.maxLength) == 'number' and math.min(math.max(el.maxLength, 1), 500) or 200
        safe.default = type(el.default) == 'string' and SanitizeString(el.default, 200) or nil
    elseif el.type == 'number' then
        safe.placeholder = type(el.placeholder) == 'string' and SanitizeString(el.placeholder, 80) or nil
        safe.min = type(el.min) == 'number' and el.min or nil
        safe.max = type(el.max) == 'number' and el.max or nil
        safe.default = type(el.default) == 'number' and el.default or nil
    elseif el.type == 'textarea' then
        safe.placeholder = type(el.placeholder) == 'string' and SanitizeString(el.placeholder, 80) or nil
        safe.maxLength = type(el.maxLength) == 'number' and math.min(math.max(el.maxLength, 1), 500) or 500
        safe.rows = type(el.rows) == 'number' and math.min(math.max(el.rows, 1), 10) or 3
        safe.default = type(el.default) == 'string' and SanitizeString(el.default, 500) or nil
    elseif el.type == 'select' then
        safe.options = SanitizeSelectOptions(el.options)
        safe.default = type(el.default) == 'string' and SanitizeString(el.default, 64) or nil
    elseif el.type == 'checkbox' then
        safe.default = el.default == true
    elseif el.type == 'header' then
        safe.text = SanitizeString(el.text, 120)
    elseif el.type == 'label' then
        safe.text = SanitizeString(el.text, 400)
        safe.tone = type(el.tone) == 'string' and el.tone or 'default'
    elseif el.type == 'image' then
        safe.url = SanitizeUrl(el.url)
        safe.height = type(el.height) == 'number' and math.min(math.max(el.height, 100), 400) or 200
        if not safe.url then return nil end
    elseif el.type == 'list' then
        safe.id = SanitizeString(el.id, 32)
        safe.items = SanitizeListItems(el.items)
    end

    return safe
end

local function SanitizeViewElements(elements)
    if type(elements) ~= 'table' then return {} end
    local result = {}
    for i, el in ipairs(elements) do
        if i > 20 then break end
        local safe = SanitizeElement(el)
        if safe then result[#result + 1] = safe end
    end
    return result
end

local function SanitizeViewOptions(options)
    if type(options) ~= 'table' then return {} end
    local result = {}
    for i, opt in ipairs(options) do
        if i > 4 then break end
        if type(opt) == 'table' and type(opt.id) == 'string' then
            result[#result + 1] = {
                id = SanitizeString(opt.id, 32),
                label = SanitizeString(opt.label, 60),
                tone = type(opt.tone) == 'string' and opt.tone or 'default',
                navigateTo = type(opt.navigateTo) == 'string' and SanitizeString(opt.navigateTo, 32) or nil,
            }
        end
    end
    return result
end

local function SanitizeViews(views)
    if type(views) ~= 'table' then return {} end
    local result = {}
    local count = 0
    for viewId, view in pairs(views) do
        if count >= 10 then break end
        if type(view) == 'table' then
            result[SanitizeString(viewId, 32)] = {
                title = type(view.title) == 'string' and SanitizeString(view.title, 40) or nil,
                elements = SanitizeViewElements(view.elements),
                options = SanitizeViewOptions(view.options),
            }
            count = count + 1
        end
    end
    return result
end

local VALID_PERMISSIONS = {
    location = true, contacts = true, messages = true, notifications = true,
    camera = true, microphone = true, gallery = true, calls = true,
    maps = true, storage = true,
}

local function GetIdentifierForSource(source)
    return Bridge.GetIdentifier(source)
end

local function IsAppBlocked(identifier, appId)
    if not identifier or not appId then return false end
    local row = MySQL.single.await(
        'SELECT id FROM phone_app_blocks WHERE identifier = ? AND app_id = ? LIMIT 1',
        { identifier, appId }
    )
    return row ~= nil
end

local function GetAppPermissions(identifier, appId)
    if not identifier or not appId then return {} end
    local rows = MySQL.query.await(
        'SELECT permission, granted FROM phone_app_permissions WHERE identifier = ? AND app_id = ?',
        { identifier, appId }
    ) or {}
    local result = {}
    for _, row in ipairs(rows) do
        result[row.permission] = row.granted == 1
    end
    return result
end

local function HasPermission(identifier, appId, permission)
    if not identifier or not appId or not permission then return false end
    if not VALID_PERMISSIONS[permission] then return false end
    local row = MySQL.single.await(
        'SELECT granted FROM phone_app_permissions WHERE identifier = ? AND app_id = ? AND permission = ? LIMIT 1',
        { identifier, appId, permission }
    )
    if not row then return nil end
    return row.granted == 1
end

local function SetPermissions(identifier, appId, permissions, granted)
    if not identifier or not appId or type(permissions) ~= 'table' then return false end
    for _, perm in ipairs(permissions) do
        if VALID_PERMISSIONS[perm] then
            MySQL.query.await(
                [[INSERT INTO phone_app_permissions (identifier, app_id, permission, granted)
                  VALUES (?, ?, ?, ?)
                  ON DUPLICATE KEY UPDATE granted = VALUES(granted), updated_at = CURRENT_TIMESTAMP]],
                { identifier, appId, perm, granted and 1 or 0 }
            )
        end
    end
    return true
end

local function BlockApp(identifier, appId)
    if not identifier or not appId then return false end
    MySQL.query.await(
        'INSERT IGNORE INTO phone_app_blocks (identifier, app_id) VALUES (?, ?)',
        { identifier, appId }
    )
    MySQL.update.await(
        'UPDATE phone_app_permissions SET granted = 0, updated_at = CURRENT_TIMESTAMP WHERE identifier = ? AND app_id = ?',
        { identifier, appId }
    )
    return true
end

local function UnblockApp(identifier, appId)
    if not identifier or not appId then return false end
    MySQL.update.await(
        'DELETE FROM phone_app_blocks WHERE identifier = ? AND app_id = ?',
        { identifier, appId }
    )
    return true
end

local function HasSeenPromo(identifier, appId)
    if not identifier or not appId then return true end
    local row = MySQL.single.await(
        'SELECT id FROM phone_app_promo_seen WHERE identifier = ? AND app_id = ? LIMIT 1',
        { identifier, appId }
    )
    return row ~= nil
end

local function MarkPromoSeen(identifier, appId)
    if not identifier or not appId then return end
    MySQL.query.await(
        'INSERT IGNORE INTO phone_app_promo_seen (identifier, app_id) VALUES (?, ?)',
        { identifier, appId }
    )
end

local function SendPromoNotification(source, appId, def)
    if not def.promoNotification or type(def.promoNotification) ~= 'table' then return end
    local identifier = GetIdentifierForSource(source)
    if not identifier then return end
    if HasSeenPromo(identifier, appId) then return end

    MarkPromoSeen(identifier, appId)

    local ok, err = pcall(function()
        exports[GetCurrentResourceName()]:SendPhoneNotification(source, {
            id = 'sdk_promo_' .. appId,
            appId = 'directorio',
            title = SanitizeString(def.promoNotification.title or 'Nueva app disponible', 60),
            content = SanitizeString(def.promoNotification.content or def.title, 200),
            icon = def.icon or '📱',
            route = 'directorio',
        })
    end)
    if not ok then
        warn(('[gcphone-next] sdk promo notification failed (%s): %s'):format(appId, tostring(err)))
    end
end

local function CreateController(appId)
    local controller = {}

    function controller.open(source)
        if not source then return nil, 'INVALID_SOURCE' end
        local def = Registry[appId]
        if not def then return nil, 'NOT_FOUND' end

        local callerResource = def.resourceName or 'unknown'
        local allowed, err = CheckRateLimit(source, callerResource)
        if not allowed then
            print(('[gcphone] [sdk] RATE_LIMITED: "%s" for player %s'):format(appId, source))
            return nil, err
        end

        local identifier = GetIdentifierForSource(source)
        if identifier and IsAppBlocked(identifier, appId) then
            return nil, 'APP_BLOCKED'
        end

        print(('[gcphone] [sdk] "%s" opened for player %s'):format(appId, source))

        local result = lib.callback.await('gcphone:sdk:openUIFromServer', source, def)
        if not result or result.cancelled then return nil end

        print(('[gcphone] [sdk] "%s" result: view=%s option=%s'):format(appId, result.view or '-', result.optionId or '-'))
        return result
    end

    function controller.close(source)
        if not source then return false end
        TriggerClientEvent('gcphone:sdk:forceClose', source, appId)
        return true
    end

    function controller.notify(source, payload)
        if not source or type(payload) ~= 'table' then return false, 'INVALID_ARGS' end
        local identifier = GetIdentifierForSource(source)
        if not identifier then return false, 'INVALID_SOURCE' end

        local granted = HasPermission(identifier, appId, 'notifications')
        if granted == false then return false, 'PERMISSION_DENIED' end

        local ok = pcall(function()
            exports[GetCurrentResourceName()]:AddPersistentNotification(identifier, {
                appId = appId,
                title = SanitizeString(payload.title, 60),
                content = SanitizeString(payload.content, 200),
                icon = type(payload.icon) == 'string' and payload.icon:sub(1, 8) or nil,
            })
        end)

        return ok
    end

    function controller.setVisible(source, visible)
        if not source then return false end
        if not Registry[appId] then return false end
        if not VisibilityOverrides[appId] then VisibilityOverrides[appId] = {} end
        VisibilityOverrides[appId][source] = visible == true
        return true
    end

    function controller.setVisibleAll(visible)
        if not Registry[appId] then return false end
        if not Registry[appId].shortcut then return false end
        Registry[appId].shortcut.visible = visible == true
        return true
    end

    function controller.onOpened(handler)
        if type(handler) ~= 'function' then return false end
        OpenHandlers[appId] = handler
        return true
    end

    function controller.onResult(handler)
        if type(handler) ~= 'function' then return false end
        ResultHandlers[appId] = handler
        return true
    end

    function controller.unregister()
        Registry[appId] = nil
        ResultHandlers[appId] = nil
        OpenHandlers[appId] = nil
        VisibilityOverrides[appId] = nil
        print(('[gcphone] [sdk] Unregistered "%s"'):format(appId))
        return true
    end

    return controller
end

exports('registerPhoneUI', function(id, definition)
    if type(id) ~= 'string' or id == '' then return nil, 'INVALID_ID' end
    if type(definition) ~= 'table' then return nil, 'INVALID_DEFINITION' end

    local callerResource = GetInvokingResource() or 'unknown'

    local count = 0
    for _, reg in pairs(Registry) do
        if reg.resourceName == callerResource then count = count + 1 end
    end
    if count >= MAX_REGISTERED_PER_RESOURCE then return nil, 'MAX_REGISTRATIONS' end

    local safeId = SanitizeString(id, 64)
    Registry[safeId] = {
        id = safeId,
        title = SanitizeString(definition.title or id, 40),
        icon = type(definition.icon) == 'string' and definition.icon:sub(1, 8) or nil,
        resourceName = callerResource,
        shortcut = type(definition.shortcut) == 'table' and {
            visible = definition.shortcut.visible == true,
            category = SanitizeString(definition.shortcut.category or 'other', 20),
            description = SanitizeString(definition.shortcut.description or '', 120),
        } or nil,
        permissions = type(definition.permissions) == 'table' and definition.permissions or nil,
        promoNotification = type(definition.promoNotification) == 'table' and definition.promoNotification or nil,
        views = SanitizeViews(definition.views),
        startView = type(definition.startView) == 'string' and definition.startView or 'main',
    }

    print(('[gcphone] [sdk] Registered UI "%s" from resource "%s"'):format(safeId, callerResource))
    return CreateController(safeId)
end)

exports('unregisterPhoneUI', function(id)
    if type(id) ~= 'string' then return false end
    local safeId = SanitizeString(id, 64)
    if not Registry[safeId] then return false end
    local callerResource = GetInvokingResource() or 'unknown'
    if Registry[safeId].resourceName ~= callerResource then return false end
    Registry[safeId] = nil
    ResultHandlers[safeId] = nil
    OpenHandlers[safeId] = nil
    VisibilityOverrides[safeId] = nil
    return true
end)

exports('openPhoneUI', function(id, source)
    if type(id) ~= 'string' or not source then return nil, 'INVALID_ARGS' end
    local safeId = SanitizeString(id, 64)
    local def = Registry[safeId]
    if not def then return nil, 'NOT_FOUND' end

    local callerResource = GetInvokingResource() or 'unknown'
    local allowed, err = CheckRateLimit(source, callerResource)
    if not allowed then
        print(('[gcphone] [sdk] RATE_LIMITED: resource "%s" for player %s'):format(callerResource, source))
        return nil, err
    end

    local identifier = GetIdentifierForSource(source)
    if identifier and IsAppBlocked(identifier, safeId) then
        return nil, 'APP_BLOCKED'
    end

    print(('[gcphone] [sdk] "%s" (resource: %s) opened UI for player %s'):format(safeId, callerResource, source))

    local result = lib.callback.await('gcphone:sdk:openUIFromServer', source, def)
    if not result or result.cancelled then return nil end

    print(('[gcphone] [sdk] "%s" result: view=%s option=%s'):format(safeId, result.view or '-', result.optionId or '-'))
    return result
end)

lib.callback.register('gcphone:sdk:getRegisteredUI', function(source, id)
    if type(id) ~= 'string' then return nil end
    local def = Registry[SanitizeString(id, 64)]
    if not def then return nil end
    return def
end)

lib.callback.register('gcphone:sdk:getShortcuts', function(source)
    local shortcuts = {}
    for appId, def in pairs(Registry) do
        if def.shortcut then
            local visible = def.shortcut.visible
            if VisibilityOverrides[appId] and VisibilityOverrides[appId][source] ~= nil then
                visible = VisibilityOverrides[appId][source]
            end
            if visible then
                shortcuts[#shortcuts + 1] = {
                    id = appId,
                    title = def.title,
                    icon = def.icon,
                    category = def.shortcut.category,
                    description = def.shortcut.description,
                    resourceName = def.resourceName,
                }
            end
        end
    end
    return shortcuts
end)

lib.callback.register('gcphone:sdk:getOpenData', function(source, appId)
    if type(appId) ~= 'string' then return nil end
    local handler = OpenHandlers[SanitizeString(appId, 64)]
    if not handler then return nil end
    local ok, result = pcall(handler, source)
    if not ok then
        print(('[gcphone] [sdk] Error in onPhoneUIOpened for "%s": %s'):format(appId, tostring(result)))
        return nil
    end
    return result
end)

lib.callback.register('gcphone:sdk:shortcutResult', function(source, appId, result)
    if type(appId) ~= 'string' then return false end
    local handler = ResultHandlers[SanitizeString(appId, 64)]
    if handler and result then
        local ok, err = pcall(handler, source, result)
        if not ok then
            print(('[gcphone] [sdk] Error in onPhoneUIResult for "%s": %s'):format(appId, tostring(err)))
        end
    end
    return true
end)

AddEventHandler('onResourceStop', function(resource)
    local removed = {}
    for appId, def in pairs(Registry) do
        if def.resourceName == resource then
            removed[#removed + 1] = appId
        end
    end
    for _, appId in ipairs(removed) do
        Registry[appId] = nil
        ResultHandlers[appId] = nil
        OpenHandlers[appId] = nil
        VisibilityOverrides[appId] = nil
        print(('[gcphone] [sdk] Unregistered "%s" (resource "%s" stopped)'):format(appId, resource))
    end

    if #removed > 0 then
        TriggerClientEvent('gcphone:sdk:resourceStopped', -1, resource)
    end
end)

AddEventHandler('playerDropped', function()
    local src = source
    RateLimits[src] = nil
    for appId in pairs(VisibilityOverrides) do
        if VisibilityOverrides[appId] then
            VisibilityOverrides[appId][src] = nil
        end
    end
end)

-- ── Permission-gated API exports ──

exports('hasPhonePermission', function(source, appId, permission)
    if not source or type(appId) ~= 'string' or type(permission) ~= 'string' then return nil end
    local identifier = GetIdentifierForSource(source)
    if not identifier then return nil end
    return HasPermission(identifier, SanitizeString(appId, 64), permission)
end)

exports('phoneNotify', function(source, appId, payload)
    if not source or type(appId) ~= 'string' or type(payload) ~= 'table' then return false, 'INVALID_ARGS' end
    local identifier = GetIdentifierForSource(source)
    if not identifier then return false, 'INVALID_SOURCE' end
    local safeAppId = SanitizeString(appId, 64)
    local granted = HasPermission(identifier, safeAppId, 'notifications')
    if granted == false then return false, 'PERMISSION_DENIED' end
    local ok = pcall(function()
        exports[GetCurrentResourceName()]:AddPersistentNotification(identifier, {
            appId = safeAppId,
            title = SanitizeString(payload.title, 60),
            content = SanitizeString(payload.content, 200),
            icon = type(payload.icon) == 'string' and payload.icon:sub(1, 8) or nil,
        })
    end)
    return ok
end)

exports('phoneWaypoint', function(source, appId, payload)
    if not source or type(appId) ~= 'string' or type(payload) ~= 'table' then return false, 'INVALID_ARGS' end
    local identifier = GetIdentifierForSource(source)
    if not identifier then return false, 'INVALID_SOURCE' end
    local granted = HasPermission(identifier, SanitizeString(appId, 64), 'maps')
    if granted == false then return false, 'PERMISSION_DENIED' end
    local x = tonumber(payload.x)
    local y = tonumber(payload.y)
    if not x or not y then return false, 'INVALID_COORDS' end
    TriggerClientEvent('gcphone:sdk:setWaypoint', source, x, y, SanitizeString(payload.label or '', 60))
    return true
end)

exports('phoneSendMessage', function(source, appId, payload)
    if not source or type(appId) ~= 'string' or type(payload) ~= 'table' then return false, 'INVALID_ARGS' end
    local identifier = GetIdentifierForSource(source)
    if not identifier then return false, 'INVALID_SOURCE' end
    local granted = HasPermission(identifier, SanitizeString(appId, 64), 'messages')
    if granted == false then return false, 'PERMISSION_DENIED' end
    local myNumber = Bridge.GetPhoneNumber(identifier)
    if not myNumber then return false, 'NO_PHONE' end
    local targetNumber = SanitizeString(payload.to, 20):gsub('[^%d%+%-%(%s%)]', '')
    local message = SanitizeString(payload.message, 800)
    if targetNumber == '' or message == '' then return false, 'INVALID_DATA' end
    if not targetNumber:match('%d') then return false, 'INVALID_NUMBER' end
    MySQL.insert.await(
        'INSERT INTO phone_messages (transmitter, receiver, message, owner, status) VALUES (?, ?, ?, 1, ?)',
        { myNumber, targetNumber, message, 'sent' }
    )
    return true
end)

exports('phoneGetContacts', function(source, appId)
    if not source or type(appId) ~= 'string' then return false, 'INVALID_ARGS' end
    local identifier = GetIdentifierForSource(source)
    if not identifier then return false, 'INVALID_SOURCE' end
    local granted = HasPermission(identifier, SanitizeString(appId, 64), 'contacts')
    if granted == false then return false, 'PERMISSION_DENIED' end
    local rows = MySQL.query.await(
        'SELECT display, number FROM phone_contacts WHERE identifier = ? ORDER BY display ASC LIMIT 200',
        { identifier }
    ) or {}
    return rows
end)

exports('phoneGetLocation', function(source, appId)
    if not source or type(appId) ~= 'string' then return false, 'INVALID_ARGS' end
    local identifier = GetIdentifierForSource(source)
    if not identifier then return false, 'INVALID_SOURCE' end
    local granted = HasPermission(identifier, SanitizeString(appId, 64), 'location')
    if granted == false then return false, 'PERMISSION_DENIED' end
    local ped = GetPlayerPed(source)
    if not ped or ped == 0 then return false, 'NO_PED' end
    local coords = GetEntityCoords(ped)
    return { x = coords.x, y = coords.y, z = coords.z }
end)

exports('phoneStartCall', function(source, appId, payload)
    if not source or type(appId) ~= 'string' or type(payload) ~= 'table' then return false, 'INVALID_ARGS' end
    local identifier = GetIdentifierForSource(source)
    if not identifier then return false, 'INVALID_SOURCE' end
    local granted = HasPermission(identifier, SanitizeString(appId, 64), 'calls')
    if granted == false then return false, 'PERMISSION_DENIED' end
    local number = SanitizeString(payload.number, 20)
    if number == '' then return false, 'INVALID_NUMBER' end
    TriggerClientEvent('gcphone:sdk:startCall', source, number)
    return true
end)

-- ── Permission management callbacks ──

lib.callback.register('gcphone:sdk:getPermissions', function(source, appId)
    local identifier = GetIdentifierForSource(source)
    if not identifier or type(appId) ~= 'string' then return {} end
    return GetAppPermissions(identifier, SanitizeString(appId, 64))
end)

lib.callback.register('gcphone:sdk:getAllAppPermissions', function(source)
    local identifier = GetIdentifierForSource(source)
    if not identifier then return {} end
    return MySQL.query.await(
        [[SELECT p.app_id, p.permission, p.granted
          FROM phone_app_permissions p
          LEFT JOIN phone_app_blocks b ON b.identifier = p.identifier AND b.app_id = p.app_id
          WHERE p.identifier = ? AND b.app_id IS NULL
          ORDER BY p.app_id]],
        { identifier }
    ) or {}
end)

lib.callback.register('gcphone:sdk:getBlockedApps', function(source)
    local identifier = GetIdentifierForSource(source)
    if not identifier then return {} end
    return MySQL.query.await(
        'SELECT app_id, blocked_at FROM phone_app_blocks WHERE identifier = ?',
        { identifier }
    ) or {}
end)

lib.callback.register('gcphone:sdk:setPermission', function(source, appId, permission, granted)
    local identifier = GetIdentifierForSource(source)
    if not identifier or type(appId) ~= 'string' or type(permission) ~= 'string' then return false end
    if not VALID_PERMISSIONS[permission] then return false end
    SetPermissions(identifier, SanitizeString(appId, 64), { permission }, granted == true)
    return true
end)

lib.callback.register('gcphone:sdk:grantAllPermissions', function(source, appId, permissions)
    local identifier = GetIdentifierForSource(source)
    if not identifier or type(appId) ~= 'string' or type(permissions) ~= 'table' then return false end
    SetPermissions(identifier, SanitizeString(appId, 64), permissions, true)
    return true
end)

lib.callback.register('gcphone:sdk:denyAllPermissions', function(source, appId, permissions)
    local identifier = GetIdentifierForSource(source)
    if not identifier or type(appId) ~= 'string' or type(permissions) ~= 'table' then return false end
    SetPermissions(identifier, SanitizeString(appId, 64), permissions, false)
    return true
end)

lib.callback.register('gcphone:sdk:blockApp', function(source, appId)
    local identifier = GetIdentifierForSource(source)
    if not identifier or type(appId) ~= 'string' then return false end
    return BlockApp(identifier, SanitizeString(appId, 64))
end)

lib.callback.register('gcphone:sdk:unblockApp', function(source, appId)
    local identifier = GetIdentifierForSource(source)
    if not identifier or type(appId) ~= 'string' then return false end
    return UnblockApp(identifier, SanitizeString(appId, 64))
end)

lib.callback.register('gcphone:sdk:checkPromos', function(source)
    local identifier = GetIdentifierForSource(source)
    if not identifier then return end
    for appId, def in pairs(Registry) do
        if def.shortcut and def.promoNotification then
            local visible = def.shortcut.visible
            if VisibilityOverrides[appId] and VisibilityOverrides[appId][source] ~= nil then
                visible = VisibilityOverrides[appId][source]
            end
            if visible and not IsAppBlocked(identifier, appId) then
                SendPromoNotification(source, appId, def)
            end
        end
    end
end)

return {}
