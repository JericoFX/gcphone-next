-- Creado/Modificado por JericoFX

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
    wallet = true,
    documents = true,
    appstore = true,
    wavechat = true,
    music = true,
    chirp = true,
    snap = true,
    clips = true,
    darkrooms = true,
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
    home = { 'contacts', 'messages', 'calls', 'settings', 'gallery', 'camera', 'bank', 'wallet', 'documents', 'wavechat', 'music', 'chirp', 'snap', 'clips', 'darkrooms', 'yellowpages', 'market', 'news', 'garage', 'clock', 'notes', 'maps', 'weather' },
    menu = { 'appstore' }
}

local function GetFeatureFlags()
    local defaults = Config.Features or {}

    local function resolveConvarBool(name, fallback)
        local raw = GetConvar(name, fallback and '1' or '0')
        return raw == '1' or raw == 'true' or raw == 'TRUE'
    end

    return {
        appstore = resolveConvarBool('gcphone_feature_appstore', defaults.AppStore ~= false),
        wavechat = resolveConvarBool('gcphone_feature_wavechat', defaults.WaveChat ~= false),
        darkrooms = resolveConvarBool('gcphone_feature_darkrooms', defaults.DarkRooms ~= false),
        clips = resolveConvarBool('gcphone_feature_clips', defaults.Clips ~= false),
        wallet = resolveConvarBool('gcphone_feature_wallet', defaults.Wallet ~= false),
        documents = resolveConvarBool('gcphone_feature_documents', defaults.Documents ~= false),
        music = resolveConvarBool('gcphone_feature_music', defaults.Music ~= false),
        yellowpages = resolveConvarBool('gcphone_feature_yellowpages', defaults.YellowPages ~= false),
    }
end

local function SafeLanguage(value)
    if value == 'es' or value == 'en' or value == 'pt' or value == 'fr' then
        return value
    end
    return nil
end

local function BuildEnabledApps(flags)
    local enabled = {}
    for appId, _ in pairs(AllowedApps) do
        enabled[appId] = true
    end

    if not flags.appstore then enabled.appstore = nil end
    if not flags.wavechat then enabled.wavechat = nil end
    if not flags.darkrooms then enabled.darkrooms = nil end
    if not flags.clips then enabled.clips = nil end
    if not flags.wallet then enabled.wallet = nil end
    if not flags.documents then enabled.documents = nil end
    if not flags.music then enabled.music = nil end
    if not flags.yellowpages then enabled.yellowpages = nil end

    return enabled
end

local function EnabledList(enabledApps)
    local out = {}
    for appId, active in pairs(enabledApps) do
        if active then table.insert(out, appId) end
    end
    table.sort(out)
    return out
end

local function NormalizeLayout(layout, enabledApps)
    enabledApps = enabledApps or AllowedApps
    if type(layout) ~= 'table' then
        layout = DefaultLayout
    end

    local used = {}
    local result = {
        home = {},
        menu = {}
    }

    local function pushUnique(listName, values)
        if type(values) ~= 'table' then return end
        for _, appId in ipairs(values) do
            if type(appId) == 'string' and enabledApps[appId] and not used[appId] then
                table.insert(result[listName], appId)
                used[appId] = true
            end
        end
    end

    pushUnique('home', layout.home)
    pushUnique('menu', layout.menu)

    for _, appId in ipairs(DefaultLayout.home) do
        if enabledApps[appId] and not used[appId] then
            table.insert(result.home, appId)
            used[appId] = true
        end
    end

    for _, appId in ipairs(DefaultLayout.menu) do
        if enabledApps[appId] and not used[appId] then
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
        'INSERT INTO phone_numbers (identifier, phone_number, imei, wallpaper, ringtone, volume, lock_code, coque, theme, language, audio_profile) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        { 
            identifier, 
            phoneNumber, 
            imei,
            Config.Phone.DefaultSettings.wallpaper,
            Config.Phone.DefaultSettings.ringtone,
            Config.Phone.DefaultSettings.volume,
            Config.Phone.DefaultSettings.lockCode,
            Config.Phone.DefaultSettings.coque,
            Config.Phone.DefaultSettings.theme,
            Config.Phone.DefaultSettings.language or 'es',
            Config.Phone.DefaultSettings.audioProfile or 'normal'
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

    local featureFlags = GetFeatureFlags()
    local enabledApps = BuildEnabledApps(featureFlags)
    local layoutRaw = MySQL.scalar.await(
        'SELECT layout_json FROM phone_layouts WHERE identifier = ?',
        { phone.identifier }
    )
    local savedLayout = layoutRaw and layoutRaw ~= '' and json.decode(layoutRaw) or nil
    local appLayout = NormalizeLayout(savedLayout, enabledApps)
    
    return {
        phoneNumber = phone.phone_number,
        imei = phone.imei,
        wallpaper = phone.wallpaper,
        ringtone = phone.ringtone,
        volume = phone.volume,
        lockCode = phone.lock_code,
        coque = phone.coque,
        theme = phone.theme or 'light',
        language = phone.language or 'es',
        audioProfile = phone.audio_profile or 'normal',
        appLayout = appLayout,
        enabledApps = EnabledList(enabledApps),
        featureFlags = featureFlags,
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

lib.callback.register('gcphone:setLanguage', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false end
    local language = SafeLanguage(type(data) == 'table' and data.language or nil)
    if not language then return false end

    MySQL.update.await(
        'UPDATE phone_numbers SET language = ? WHERE identifier = ?',
        { language, identifier }
    )

    return true
end)

lib.callback.register('gcphone:setAudioProfile', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false end
    local profile = SafeString(type(data) == 'table' and data.audioProfile or nil, 16)
    if profile ~= 'normal' and profile ~= 'street' and profile ~= 'vehicle' and profile ~= 'silent' then
        return false
    end

    MySQL.update.await(
        'UPDATE phone_numbers SET audio_profile = ? WHERE identifier = ?',
        { profile, identifier }
    )

    return true
end)

lib.callback.register('gcphone:getAppLayout', function(source)
    local identifier = GetIdentifier(source)
    local enabledApps = BuildEnabledApps(GetFeatureFlags())
    if not identifier then return NormalizeLayout(DefaultLayout, enabledApps) end

    local layoutRaw = MySQL.scalar.await(
        'SELECT layout_json FROM phone_layouts WHERE identifier = ?',
        { identifier }
    )

    if not layoutRaw or layoutRaw == '' then
        return NormalizeLayout(DefaultLayout, enabledApps)
    end

    local decoded = json.decode(layoutRaw)
    return NormalizeLayout(decoded, enabledApps)
end)

lib.callback.register('gcphone:setAppLayout', function(source, layout)
    local identifier = GetIdentifier(source)
    if not identifier then return false end

    local normalized = NormalizeLayout(layout, BuildEnabledApps(GetFeatureFlags()))
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
        local featureFlags = GetFeatureFlags()
        local enabledApps = BuildEnabledApps(featureFlags)
        local layoutRaw = MySQL.scalar.await(
            'SELECT layout_json FROM phone_layouts WHERE identifier = ?',
            { phone.identifier }
        )
        local savedLayout = layoutRaw and layoutRaw ~= '' and json.decode(layoutRaw) or nil
        TriggerClientEvent('gcphone:init', Player.PlayerData.source, {
            phoneNumber = phone.phone_number,
            wallpaper = phone.wallpaper,
            ringtone = phone.ringtone,
            volume = phone.volume,
            lockCode = phone.lock_code,
            coque = phone.coque,
            theme = phone.theme or 'light',
            language = phone.language or 'es',
            audioProfile = phone.audio_profile or 'normal',
            appLayout = NormalizeLayout(savedLayout, enabledApps),
            enabledApps = EnabledList(enabledApps),
            featureFlags = featureFlags,
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
