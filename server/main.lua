GCPhone = GCPhone or {}

local Bridge = nil

-- Validate critical Config shapes at load time with safe fallbacks.
-- Prevents nil-index crashes when a config section is missing.
do
    Config = Config or {}
    Config.Phone = Config.Phone or {}
    Config.Phone.NumberPrefix = Config.Phone.NumberPrefix or { 555 }
    Config.Phone.DefaultSettings = Config.Phone.DefaultSettings or {
        wallpaper = './img/background/back001.jpg',
        ringtone = 'call_1',
        callRingtone = 'call_1',
        notificationTone = 'notif_1',
        messageTone = 'msg_1',
        volume = 0.5,
        lockCode = '0000',
        theme = 'light',
        language = 'es',
        audioProfile = 'normal',
    }
    Config.Phone.Setup = Config.Phone.Setup or { RequireOnFirstUse = true, MinPinLength = 4, MaxPinLength = 4, EmergencyContacts = {} }
    Config.Phone.ExportAllowlist = Config.Phone.ExportAllowlist or {}
    Config.Security = Config.Security or {}
    Config.Security.RateLimits = Config.Security.RateLimits or {}
    Config.Features = Config.Features or {}
    Config.Wallet = Config.Wallet or { InitialBalance = 2500, MaxTransferAmount = 500000, ProximityDistance = 3.0 }
    Config.NativeAudio = Config.NativeAudio or {}
    Config.NativeAudio.DefaultByCategory = Config.NativeAudio.DefaultByCategory or { ringtone = 'call_1', notification = 'notif_1', message = 'msg_1', vibrate = 'buzz_short_01' }
    Config.NativeAudio.Catalog = Config.NativeAudio.Catalog or {}
    Config.NativeAudio.LegacyMap = Config.NativeAudio.LegacyMap or {}
    Config.Contacts = Config.Contacts or {}
    Config.Messages = Config.Messages or {}
    Config.Calls = Config.Calls or {}
    Config.LiveKit = Config.LiveKit or {}
    Config.Camera = Config.Camera or {}
    Config.Gallery = Config.Gallery or {}
    Config.Storage = Config.Storage or {}
    Config.Mail = Config.Mail or {}
    Config.Garage = Config.Garage or {}
    Config.Market = Config.Market or {}
    Config.News = Config.News or {}
    Config.Proximity = Config.Proximity or {}
    Config.Chirp = Config.Chirp or {}
    Config.Snap = Config.Snap or {}
    Config.Music = Config.Music or {}
    Config.Documents = Config.Documents or {}
    Config.Bank = Config.Bank or {}
end

---@alias GCPhoneNotificationPriority 'low'|'normal'|'high'

---@class GCPhoneNotificationPayload
---@field id? string Stable notification id. Duplicates are ignored by the web queue.
---@field appId? string App identifier used for mute filters and app-specific unread state.
---@field title string Notification title.
---@field message string Notification message body.
---@field icon? string Short glyph or icon text rendered in the banner.
---@field durationMs? integer Auto-dismiss duration in milliseconds. Ignored when sticky is true.
---@field sticky? boolean Keeps the notification visible until manually dismissed.
---@field priority? GCPhoneNotificationPriority High bypasses DND/mute filters where supported by the UI.
---@field route? string Route opened when the user taps the notification.
---@field data? table<string, any> Optional route payload passed to the app router.
---@field createdAt? integer Unix ms timestamp used for ordering.

---@alias GCPhoneNotificationTarget integer|integer[]|'-1'|'all'

local function L(key, ...)
    if type(locale) == 'function' then
        local ok, value = pcall(locale, key, ...)
        if ok and type(value) == 'string' then
            return value
        end
    end

    return key
end

local function bridgeCall(name, ...)
    local fn = rawget(_G, name)
    if type(fn) ~= 'function' then return nil end
    return fn(...)
end

local function sanitizeText(value, maxLength)
    if type(value) ~= 'string' then return '' end
    local text = value:gsub('[%z\1-\31\127]', '')
    text = text:gsub('<.->', '')
    text = text:gsub('^%s+', ''):gsub('%s+$', '')
    return text:sub(1, maxLength or 120)
end

---@param payload GCPhoneNotificationPayload
---@return GCPhoneNotificationPayload|nil
local function normalizeNotification(payload)
    if type(payload) ~= 'table' then return nil end

    local title = sanitizeText(payload.title, 48)
    local message = sanitizeText(payload.message, 140)
    if title == '' and message == '' then return nil end

    return {
        id = sanitizeText(payload.id or ('srv-' .. tostring(os.time()) .. '-' .. tostring(math.random(1000, 9999))), 64),
        appId = sanitizeText(payload.appId or 'system', 24),
        title = title ~= '' and title or L('notification_default'),
        message = message,
        icon = sanitizeText(payload.icon, 8),
        durationMs = math.max(1200, math.min(tonumber(payload.durationMs) or 3200, 12000)),
        priority = payload.priority == 'high' and 'high' or (payload.priority == 'low' and 'low' or 'normal'),
        route = sanitizeText(payload.route, 40),
        data = type(payload.data) == 'table' and payload.data or nil,
        createdAt = tonumber(payload.createdAt) or (os.time() * 1000)
    }
end

local function toTargetList(target)
    if target == nil then return {} end
    if target == -1 or target == 'all' then return { -1 } end

    if type(target) == 'number' then
        if target > 0 then return { target } end
        return {}
    end

    if type(target) == 'table' then
        local list = {}
        for _, value in ipairs(target) do
            local src = tonumber(value)
            if src and src > 0 then list[#list + 1] = src end
        end
        return list
    end

    return {}
end

CreateThread(function()
    -- Verified: CommunityOX ox_lib WaitFor/Shared supports lib.waitFor(cb, errMessage, timeout)
    lib.waitFor(function()
        if GetResourceState('qb-core') == 'started' or GetResourceState('qbx_core') == 'started' or GetResourceState('es_extended') == 'started' then
            return true
        end
    end, 'gcphone-next failed to detect a supported framework', false)
    
    Bridge = {
        GetIdentifier = function(source) return bridgeCall('GetIdentifier', source) end,
        GetName = function(source) return bridgeCall('GetName', source) end,
        GetMoney = function(source, accountType) return bridgeCall('GetMoney', source, accountType) end,
        AddMoney = function(source, amount, accountType, reason) return bridgeCall('AddMoney', source, amount, accountType, reason) end,
        RemoveMoney = function(source, amount, accountType, reason) return bridgeCall('RemoveMoney', source, amount, accountType, reason) end,
        GetJob = function(source) return bridgeCall('GetJob', source) end,
        GetFramework = function() return bridgeCall('GetFramework') end,
        GetSourceFromIdentifier = function(identifier) return bridgeCall('GetSourceFromIdentifier', identifier) end,
        IsPlayerActionAllowed = function(source) return bridgeCall('IsPlayerActionAllowed', source) end,
    }

    print(('^2[gcphone-next]^7 %s'):format(L('server_initialized')))
    
    -- Check database version
    local dbVersion = exports['gcphone-next'].GetDatabaseVersion and exports['gcphone-next'].GetDatabaseVersion() or 0
    print(string.format('^2[gcphone-next]^7 %s', L('database_version', dbVersion)))
end)

exports('GetBridge', function()
    return Bridge
end)

exports('GetIdentifier', function(source)
    return bridgeCall('GetIdentifier', source)
end)

exports('GetName', function(source)
    return bridgeCall('GetName', source)
end)

exports('GetMoney', function(source, accountType)
    return bridgeCall('GetMoney', source, accountType) or 0
end)

exports('AddMoney', function(source, amount, accountType, reason)
    return bridgeCall('AddMoney', source, amount, accountType, reason) == true
end)

exports('RemoveMoney', function(source, amount, accountType, reason)
    return bridgeCall('RemoveMoney', source, amount, accountType, reason) == true
end)

exports('GetJob', function(source)
    return bridgeCall('GetJob', source)
end)

exports('GetFramework', function()
    return bridgeCall('GetFramework')
end)

exports('GetSourceFromIdentifier', function(identifier)
    return bridgeCall('GetSourceFromIdentifier', identifier)
end)

exports('IsPlayerActionAllowed', function(source)
    return bridgeCall('IsPlayerActionAllowed', source)
end)

---Send an ephemeral phone notification to one or more players.
---Use `route` + `data` if tapping the notification should open an app.
---Muted apps and DND are enforced client-side unless the payload uses `priority = 'high'`.
---@param target GCPhoneNotificationTarget
---@param payload GCPhoneNotificationPayload
---@return boolean
exports('SendPhoneNotification', function(target, payload)
    local notification = normalizeNotification(payload)
    if not notification then return false end

    local targets = toTargetList(target)
    if #targets == 0 then return false end

    if #targets == 1 and targets[1] == -1 then
        TriggerClientEvent('gcphone:notify', -1, notification)
        return true
    end

    for _, src in ipairs(targets) do
        TriggerClientEvent('gcphone:notify', src, notification)
    end

    return true
end)
