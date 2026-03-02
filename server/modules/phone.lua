local function GeneratePhoneNumber()
    local prefix = Config.Phone.NumberPrefix[math.random(1, #Config.Phone.NumberPrefix)]
    local suffix = math.random(1000, 9999)
    return string.format('%03d-%04d', prefix, suffix)
end

local function GenerateIMEI()
    local imei = ''
    for i = 1, 20 do
        imei = imei .. math.random(0, 9)
    end
    return imei
end

local function SafeString(value, maxLen)
    if type(value) ~= 'string' then return nil end
    local trimmed = value:gsub('%s+', ' '):gsub('^%s+', ''):gsub('%s+$', '')
    if trimmed == '' then return nil end
    if maxLen and #trimmed > maxLen then
        trimmed = trimmed:sub(1, maxLen)
    end
    return trimmed
end

local function SafeNumber(value, min, max)
    local num = tonumber(value)
    if not num then return nil end
    if min and num < min then num = min end
    if max and num > max then num = max end
    return num
end

local function SafeTheme(value)
    if value == 'auto' or value == 'light' or value == 'dark' then
        return value
    end
    return nil
end

local AllowedApps = {
    contacts = true,
    messages = true,
    calls = true,
    settings = true,
    gallery = true,
    camera = true,
    bank = true,
    wavechat = true,
    music = true,
    chirp = true,
    snap = true,
    yellowpages = true,
    market = true,
    news = true,
    garage = true,
    clock = true,
    notes = true,
    maps = true,
    weather = true,
}

local DefaultLayout = {
    home = { 'contacts', 'messages', 'calls', 'settings', 'gallery', 'camera', 'bank', 'wavechat', 'music', 'chirp', 'snap', 'yellowpages', 'market', 'news', 'garage', 'clock', 'notes', 'maps', 'weather' },
    menu = {}
}

local function NormalizeLayout(layout)
    if type(layout) ~= 'table' then
        return DefaultLayout
    end

    local used = {}
    local result = {
        home = {},
        menu = {}
    }

    local function pushUnique(listName, values)
        if type(values) ~= 'table' then return end
        for _, appId in ipairs(values) do
            if type(appId) == 'string' and AllowedApps[appId] and not used[appId] then
                table.insert(result[listName], appId)
                used[appId] = true
            end
        end
    end

    pushUnique('home', layout.home)
    pushUnique('menu', layout.menu)

    for _, appId in ipairs(DefaultLayout.home) do
        if not used[appId] then
            table.insert(result.home, appId)
            used[appId] = true
        end
    end

    for _, appId in ipairs(DefaultLayout.menu) do
        if not used[appId] then
            table.insert(result.menu, appId)
            used[appId] = true
        end
    end

    return result
end

local function PhoneExists(phoneNumber)
    return MySQL.scalar.await(
        'SELECT 1 FROM phone_numbers WHERE phone_number = ?',
        { phoneNumber }
    ) ~= nil
end

local function GetOrCreatePhone(source)
    local identifier = GetIdentifier(source)
    if not identifier then return nil end
    
    local phone = MySQL.single.await(
        'SELECT * FROM phone_numbers WHERE identifier = ?',
        { identifier }
    )
    
    if phone then
        return phone
    end
    
    local phoneNumber
    repeat
        phoneNumber = GeneratePhoneNumber()
    until not PhoneExists(phoneNumber)
    
    local imei = GenerateIMEI()
    
    MySQL.insert.await(
        'INSERT INTO phone_numbers (identifier, phone_number, imei, wallpaper, ringtone, volume, lock_code, coque, theme) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        { 
            identifier, 
            phoneNumber, 
            imei,
            Config.Phone.DefaultSettings.wallpaper,
            Config.Phone.DefaultSettings.ringtone,
            Config.Phone.DefaultSettings.volume,
            Config.Phone.DefaultSettings.lockCode,
            Config.Phone.DefaultSettings.coque,
            Config.Phone.DefaultSettings.theme
        }
    )
    
    return MySQL.single.await(
        'SELECT * FROM phone_numbers WHERE identifier = ?',
        { identifier }
    )
end

lib.callback.register('gcphone:getPhoneData', function(source)
    local phone = GetOrCreatePhone(source)
    if not phone then return nil end
    
    return {
        phoneNumber = phone.phone_number,
        imei = phone.imei,
        wallpaper = phone.wallpaper,
        ringtone = phone.ringtone,
        volume = phone.volume,
        lockCode = phone.lock_code,
        coque = phone.coque,
        theme = phone.theme or 'light'
    }
end)

lib.callback.register('gcphone:setWallpaper', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false end
    local url = SafeString(type(data) == 'table' and data.url or nil, 500)
    if not url then return false end
    
    MySQL.update.await(
        'UPDATE phone_numbers SET wallpaper = ? WHERE identifier = ?',
        { url, identifier }
    )
    
    return true
end)

lib.callback.register('gcphone:setRingtone', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false end
    local ringtone = SafeString(type(data) == 'table' and data.ringtone or nil, 64)
    if not ringtone then return false end
    
    MySQL.update.await(
        'UPDATE phone_numbers SET ringtone = ? WHERE identifier = ?',
        { ringtone, identifier }
    )
    
    return true
end)

lib.callback.register('gcphone:setVolume', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false end
    local volume = SafeNumber(type(data) == 'table' and data.volume or nil, 0.0, 1.0)
    if not volume then return false end
    
    MySQL.update.await(
        'UPDATE phone_numbers SET volume = ? WHERE identifier = ?',
        { volume, identifier }
    )
    
    return true
end)

lib.callback.register('gcphone:setLockCode', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false end
    local code = SafeString(type(data) == 'table' and data.code or nil, 16)
    if not code then return false end
    
    MySQL.update.await(
        'UPDATE phone_numbers SET lock_code = ? WHERE identifier = ?',
        { code, identifier }
    )
    
    return true
end)

lib.callback.register('gcphone:setCoque', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false end
    local coque = SafeString(type(data) == 'table' and data.coque or nil, 64)
    if not coque then return false end
    
    MySQL.update.await(
        'UPDATE phone_numbers SET coque = ? WHERE identifier = ?',
        { coque, identifier }
    )
    
    return true
end)

lib.callback.register('gcphone:setTheme', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false end
    local theme = SafeTheme(type(data) == 'table' and data.theme or nil)
    if not theme then return false end

    MySQL.update.await(
        'UPDATE phone_numbers SET theme = ? WHERE identifier = ?',
        { theme, identifier }
    )

    return true
end)

lib.callback.register('gcphone:getAppLayout', function(source)
    local identifier = GetIdentifier(source)
    if not identifier then return DefaultLayout end

    local layoutRaw = MySQL.scalar.await(
        'SELECT layout_json FROM phone_layouts WHERE identifier = ?',
        { identifier }
    )

    if not layoutRaw or layoutRaw == '' then
        return DefaultLayout
    end

    local decoded = json.decode(layoutRaw)
    return NormalizeLayout(decoded)
end)

lib.callback.register('gcphone:setAppLayout', function(source, layout)
    local identifier = GetIdentifier(source)
    if not identifier then return false end

    local normalized = NormalizeLayout(layout)
    local encoded = json.encode(normalized)

    MySQL.insert.await(
        'INSERT INTO phone_layouts (identifier, layout_json) VALUES (?, ?) ON DUPLICATE KEY UPDATE layout_json = VALUES(layout_json)',
        { identifier, encoded }
    )

    return true
end)

lib.callback.register('gcphone:getPhoneMetadata', function(source, phoneId)
    local identifier = GetIdentifier(source)
    if not identifier then return nil end
    
    local phone = MySQL.single.await(
        'SELECT phone_number, imei FROM phone_numbers WHERE identifier = ?',
        { identifier }
    )
    
    if not phone then return nil end
    
    local name = GetName(source)
    
    return {
        owner = name,
        phoneNumber = phone.phone_number,
        imei = phone.imei
    }
end)

RegisterNetEvent('QBCore:Server:PlayerLoaded', function(Player)
    if not Player then return end
    
    local phone = GetOrCreatePhone(Player.PlayerData.source)
    if phone then
        TriggerClientEvent('gcphone:init', Player.PlayerData.source, {
            phoneNumber = phone.phone_number,
            wallpaper = phone.wallpaper,
            ringtone = phone.ringtone,
            volume = phone.volume,
            lockCode = phone.lock_code,
            coque = phone.coque,
            theme = phone.theme or 'light'
        })
    end
end)

RegisterNetEvent('QBCore:Server:OnPlayerUnload', function(source)
end)

exports('GetPhoneNumber', function(identifier)
    return MySQL.scalar.await(
        'SELECT phone_number FROM phone_numbers WHERE identifier = ?',
        { identifier }
    )
end)

exports('GetIdentifierByPhone', function(phoneNumber)
    return MySQL.scalar.await(
        'SELECT identifier FROM phone_numbers WHERE phone_number = ?',
        { phoneNumber }
    )
end)
