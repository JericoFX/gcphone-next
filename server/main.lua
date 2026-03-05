local Bridge = nil

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
    Wait(500)
    
    while GetResourceState('qb-core') ~= 'started' and GetResourceState('qbx_core') ~= 'started' do
        Wait(100)
    end
    
    Wait(500)
    
    Bridge = {
        GetIdentifier = function(source) return bridgeCall('GetIdentifier', source) end,
        GetName = function(source) return bridgeCall('GetName', source) end,
        GetMoney = function(source, accountType) return bridgeCall('GetMoney', source, accountType) end,
        AddMoney = function(source, amount, accountType, reason) return bridgeCall('AddMoney', source, amount, accountType, reason) end,
        RemoveMoney = function(source, amount, accountType, reason) return bridgeCall('RemoveMoney', source, amount, accountType, reason) end,
        GetJob = function(source) return bridgeCall('GetJob', source) end,
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

exports('GetSourceFromIdentifier', function(identifier)
    return bridgeCall('GetSourceFromIdentifier', identifier)
end)

exports('IsPlayerActionAllowed', function(source)
    return bridgeCall('IsPlayerActionAllowed', source)
end)

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
