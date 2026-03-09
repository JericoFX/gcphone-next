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

local function SafeAudioProfile(value)
    if value == 'normal' or value == 'street' or value == 'vehicle' or value == 'silent' then
        return value
    end
    return nil
end

local function SafeToneId(value)
    if type(value) ~= 'string' then return nil end
    local tone = value:gsub('[^%w%._%-]', '')
    if tone == '' then return nil end
    return tone:sub(1, 64)
end

local AllowedApps = {
    contacts = true,
    messages = true,
    mail = true,
    calls = true,
    settings = true,
    notifications = true,
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
    news = true,
    garage = true,
    clock = true,
    notes = true,
    maps = true,
    weather = true,
}

local DefaultLayout = {
    home = { 'contacts', 'messages', 'mail', 'notifications', 'calls', 'settings', 'gallery', 'camera', 'bank', 'wallet', 'documents', 'wavechat', 'music', 'chirp', 'snap', 'clips', 'darkrooms', 'yellowpages', 'news', 'garage', 'clock', 'notes', 'maps', 'weather' },
    menu = { 'appstore' }
}

local function GetFeatureFlags()
    local defaults = Config.Features or {}

    local function resolveConvarBool(name, fallback)
        local raw = GetConvar(name, fallback and '1' or '0')
        return raw == '1' or raw == 'true' or raw == 'TRUE'
    end

    local function hasClipStorageSupport()
        local provider = tostring(GetConvar('gcphone_storage_provider', tostring(Config.Storage and Config.Storage.Provider or 'custom'))):lower()
        if provider == 'direct' then provider = 'custom' end

        if provider == 'server_folder' then
            local publicUrl = tostring(GetConvar('gcphone_storage_server_folder_public_url', tostring(Config.Storage and Config.Storage.ServerFolder and Config.Storage.ServerFolder.PublicBaseUrl or '')))
            return publicUrl:match('^https?://') ~= nil
        end

        local uploadUrl = ''
        if provider == 'fivemanage' then
            uploadUrl = tostring(GetConvar('gcphone_storage_fivemanage_url', tostring(Config.Storage and Config.Storage.FiveManage and Config.Storage.FiveManage.Endpoint or '')))
        elseif provider == 'local' then
            uploadUrl = tostring(GetConvar('gcphone_storage_local_url', ''))
        else
            uploadUrl = tostring(GetConvar('gcphone_storage_custom_url', tostring(Config.Storage and Config.Storage.Custom and Config.Storage.Custom.UploadUrl or '')))
        end

        return uploadUrl:match('^https?://') ~= nil
    end

    return {
        appstore = resolveConvarBool('gcphone_feature_appstore', defaults.AppStore ~= false),
        wavechat = resolveConvarBool('gcphone_feature_wavechat', defaults.WaveChat ~= false),
        darkrooms = resolveConvarBool('gcphone_feature_darkrooms', defaults.DarkRooms ~= false),
        clips = resolveConvarBool('gcphone_feature_clips', defaults.Clips ~= false) and hasClipStorageSupport(),
        wallet = resolveConvarBool('gcphone_feature_wallet', defaults.Wallet ~= false),
        documents = resolveConvarBool('gcphone_feature_documents', defaults.Documents ~= false),
        music = resolveConvarBool('gcphone_feature_music', defaults.Music ~= false),
        yellowpages = resolveConvarBool('gcphone_feature_yellowpages', defaults.YellowPages ~= false),
        mail = resolveConvarBool('gcphone_feature_mail', defaults.Mail ~= false),
    }
end

local function SafeLanguage(value)
    if value == 'es' or value == 'en' or value == 'pt' or value == 'fr' then
        return value
    end
    return nil
end

local function SafePin(value)
    if type(value) ~= 'string' then return nil end
    local trimmed = value:gsub('%s+', '')
    if not trimmed:match('^%d+$') then return nil end

    local setup = Config.Phone and Config.Phone.Setup or {}
    local minLen = tonumber(setup.MinPinLength) or 4
    local maxLen = tonumber(setup.MaxPinLength) or 6
    if maxLen < minLen then maxLen = minLen end

    if #trimmed < minLen or #trimmed > maxLen then
        return nil
    end

    return trimmed
end

local function SafeUsername(value)
    if type(value) ~= 'string' then return nil end
    local username = value:lower():gsub('[%s]+', '')
    username = username:gsub('[^a-z0-9._-]', '')
    if username == '' then return nil end
    if #username < 3 or #username > 32 then return nil end
    if username:match('^[._-]') or username:match('[._-]$') then return nil end
    return username
end

local function MailDomain()
    local domain = SafeString(Config.Mail and Config.Mail.Domain or nil, 64)
    if not domain then return 'noimotors.gg' end
    return domain:lower()
end

local function SafeMailAlias(value)
    local alias = SafeString(value, (Config.Mail and Config.Mail.MaxAliasLength) or 24)
    if not alias then return nil end

    alias = alias:lower()
    if not alias:match('^[a-z0-9._-]+$') then return nil end
    if alias:match('^[._-]') or alias:match('[._-]$') then return nil end
    if alias:find('..', 1, true) then return nil end

    local minLen = math.max(3, tonumber(Config.Mail and Config.Mail.MinAliasLength) or 3)
    if #alias < minLen then return nil end

    return alias
end

local function UsernameExists(tableName, username, identifier)
    if not username then return true end
    local sql = string.format('SELECT 1 FROM `%s` WHERE username = ? AND identifier != ? LIMIT 1', tableName)
    return MySQL.scalar.await(sql, { username, identifier or '' }) ~= nil
end

local function MailEmailExists(alias, identifier)
    if not alias then return true end
    local email = alias .. '@' .. MailDomain()
    return MySQL.scalar.await(
        'SELECT 1 FROM phone_mail_accounts WHERE email = ? AND identifier != ? LIMIT 1',
        { email, identifier or '' }
    ) ~= nil
end

local function ResolveSetupState(identifier)
    if not identifier then return { requiresSetup = true } end

    local featureFlags = GetFeatureFlags()

    local phone = MySQL.single.await(
        'SELECT is_setup, clips_username FROM phone_numbers WHERE identifier = ? LIMIT 1',
        { identifier }
    )

    local snap = MySQL.scalar.await(
        'SELECT username FROM phone_snap_accounts WHERE identifier = ? LIMIT 1',
        { identifier }
    )
    local chirp = MySQL.scalar.await(
        'SELECT username FROM phone_chirp_accounts WHERE identifier = ? LIMIT 1',
        { identifier }
    )
    local mail = featureFlags.mail and MySQL.scalar.await(
        'SELECT email FROM phone_mail_accounts WHERE identifier = ? AND is_primary = 1 LIMIT 1',
        { identifier }
    ) or nil

    local hasSnap = type(snap) == 'string' and snap ~= ''
    local hasChirp = type(chirp) == 'string' and chirp ~= ''
    local hasClips = phone and type(phone.clips_username) == 'string' and phone.clips_username ~= ''
    local hasMail = not featureFlags.mail or (type(mail) == 'string' and mail ~= '')

    local explicitlySetup = phone and tonumber(phone.is_setup) == 1
    local complete = explicitlySetup and hasSnap and hasChirp and hasClips and hasMail

    return {
        requiresSetup = not complete,
        hasSnap = hasSnap,
        hasChirp = hasChirp,
        hasClips = hasClips,
        hasMail = hasMail,
        mailDomain = featureFlags.mail and MailDomain() or nil,
    }
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
    if not flags.mail then enabled.mail = nil end
    if not flags.documents then enabled.documents = nil end
    if not flags.music then enabled.music = nil end
    if not flags.yellowpages then enabled.yellowpages = nil end
    return enabled
end

local function EnabledList(enabledApps)
    local out = {}
    for appId, active in pairs(enabledApps) do
        if active then out[#out + 1] = appId end
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
                local list = result[listName]
                list[#list + 1] = appId
                used[appId] = true
            end
        end
    end

    pushUnique('home', layout.home)
    pushUnique('menu', layout.menu)

    for _, appId in ipairs(DefaultLayout.home) do
        if enabledApps[appId] and not used[appId] then
            result.home[#result.home + 1] = appId
            used[appId] = true
        end
    end

    for _, appId in ipairs(DefaultLayout.menu) do
        if enabledApps[appId] and not used[appId] then
            result.menu[#result.menu + 1] = appId
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
        'INSERT INTO phone_numbers (identifier, phone_number, imei, wallpaper, ringtone, call_ringtone, notification_tone, message_tone, volume, lock_code, pin_hash, is_setup, theme, language, audio_profile, clips_username) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, NULL)',
        { 
            identifier, 
            phoneNumber, 
            imei,
            Config.Phone.DefaultSettings.wallpaper,
            Config.Phone.DefaultSettings.ringtone,
            Config.Phone.DefaultSettings.callRingtone or Config.Phone.DefaultSettings.ringtone,
            Config.Phone.DefaultSettings.notificationTone or 'soft-ping.ogg',
            Config.Phone.DefaultSettings.messageTone or 'pop.ogg',
            Config.Phone.DefaultSettings.volume,
            Config.Phone.DefaultSettings.lockCode,
            (Config.Phone and Config.Phone.Setup and Config.Phone.Setup.RequireOnFirstUse ~= false) and 0 or 1,
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
    
    local setup = ResolveSetupState(phone.identifier)

    return {
        phoneNumber = phone.phone_number,
        imei = phone.imei,
        wallpaper = phone.wallpaper,
        ringtone = phone.ringtone,
        callRingtone = phone.call_ringtone or phone.ringtone,
        notificationTone = phone.notification_tone or (Config.Phone.DefaultSettings.notificationTone or 'soft-ping.ogg'),
        messageTone = phone.message_tone or (Config.Phone.DefaultSettings.messageTone or 'pop.ogg'),
        volume = phone.volume,
        lockCode = '',
        theme = phone.theme or 'light',
        language = phone.language or 'es',
        audioProfile = phone.audio_profile or 'normal',
        appLayout = appLayout,
        enabledApps = EnabledList(enabledApps),
        featureFlags = featureFlags,
        requiresSetup = setup.requiresSetup,
        setup = setup,
    }
end)

lib.callback.register('gcphone:phone:getSetupState', function(source)
    local identifier = GetIdentifier(source)
    if not identifier then
        return { success = false, error = 'MISSING_IDENTIFIER', requiresSetup = true }
    end

    local setup = ResolveSetupState(identifier)
    return {
        success = true,
        requiresSetup = setup.requiresSetup,
        setup = setup,
    }
end)

lib.callback.register('gcphone:phone:completeSetup', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then
        return { success = false, error = 'MISSING_IDENTIFIER' }
    end

    if type(data) ~= 'table' then
        return { success = false, error = 'INVALID_PAYLOAD' }
    end

    local featureFlags = GetFeatureFlags()
    local pin = SafePin(data.pin)
    local snapUsername = SafeUsername(data.snapUsername)
    local chirpUsername = SafeUsername(data.chirpUsername)
    local clipsUsername = SafeUsername(data.clipsUsername)
    local mailAlias = featureFlags.mail and SafeMailAlias(data.mailAlias) or nil
    local language = SafeLanguage(data.language) or (Config.Phone and Config.Phone.DefaultSettings and Config.Phone.DefaultSettings.language) or 'es'
    local theme = SafeTheme(data.theme) or (Config.Phone and Config.Phone.DefaultSettings and Config.Phone.DefaultSettings.theme) or 'light'
    local audioProfile = SafeAudioProfile(data.audioProfile) or (Config.Phone and Config.Phone.DefaultSettings and Config.Phone.DefaultSettings.audioProfile) or 'normal'

    if not pin or not snapUsername or not chirpUsername or not clipsUsername or (featureFlags.mail and not mailAlias) then
        return { success = false, error = 'INVALID_SETUP_DATA' }
    end

    if UsernameExists('phone_snap_accounts', snapUsername, identifier) then
        return { success = false, error = 'SNAP_USERNAME_TAKEN' }
    end
    if UsernameExists('phone_chirp_accounts', chirpUsername, identifier) then
        return { success = false, error = 'CHIRP_USERNAME_TAKEN' }
    end
    if UsernameExists('phone_clips_accounts', clipsUsername, identifier) then
        return { success = false, error = 'CLIPS_USERNAME_TAKEN' }
    end
    if featureFlags.mail and MailEmailExists(mailAlias, identifier) then
        return { success = false, error = 'EMAIL_IN_USE' }
    end

    local name = GetName(source) or 'User'
    local mailDomain = MailDomain()
    local mailEmail = mailAlias and (mailAlias .. '@' .. mailDomain) or nil

    local ok, err = pcall(function()
        MySQL.insert.await(
            [[
                INSERT INTO phone_snap_accounts (identifier, username, display_name, avatar)
                VALUES (?, ?, ?, NULL)
                ON DUPLICATE KEY UPDATE username = VALUES(username), display_name = VALUES(display_name)
            ]],
            { identifier, snapUsername, name }
        )
        MySQL.insert.await(
            [[
                INSERT INTO phone_chirp_accounts (identifier, username, display_name, avatar)
                VALUES (?, ?, ?, NULL)
                ON DUPLICATE KEY UPDATE username = VALUES(username), display_name = VALUES(display_name)
            ]],
            { identifier, chirpUsername, name }
        )
        MySQL.insert.await(
            [[
                INSERT INTO phone_clips_accounts (identifier, username, display_name, avatar)
                VALUES (?, ?, ?, NULL)
                ON DUPLICATE KEY UPDATE username = VALUES(username), display_name = VALUES(display_name)
            ]],
            { identifier, clipsUsername, name }
        )

        if featureFlags.mail and mailAlias and mailEmail then
            MySQL.insert.await(
                [[
                    INSERT INTO phone_mail_accounts (identifier, alias, domain, email, password_hash, is_primary, last_login_at)
                    VALUES (?, ?, ?, ?, SHA2(?, 256), 1, NOW())
                    ON DUPLICATE KEY UPDATE
                        alias = VALUES(alias),
                        domain = VALUES(domain),
                        email = VALUES(email),
                        password_hash = VALUES(password_hash),
                        is_primary = 1,
                        last_login_at = NOW()
                ]],
                { identifier, mailAlias, mailDomain, mailEmail, pin }
            )
        end

        MySQL.update.await(
            'UPDATE phone_numbers SET lock_code = ?, pin_hash = SHA2(?, 256), is_setup = 1, clips_username = ?, theme = ?, language = ?, audio_profile = ? WHERE identifier = ?',
            { pin, pin, clipsUsername, theme, language, audioProfile, identifier }
        )
    end)

    if not ok then
        return { success = false, error = 'SETUP_FAILED', detail = tostring(err) }
    end

    local setup = ResolveSetupState(identifier)
    return {
        success = true,
        requiresSetup = setup.requiresSetup,
        setup = setup,
    }
end)

lib.callback.register('gcphone:phone:verifyPin', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then
        return { success = false, unlocked = false, error = 'MISSING_IDENTIFIER' }
    end

    local pin = SafePin(type(data) == 'table' and data.pin or nil)
    if not pin then
        return { success = false, unlocked = false, error = 'INVALID_PIN' }
    end

    local phone = MySQL.single.await(
        'SELECT lock_code, pin_hash FROM phone_numbers WHERE identifier = ? LIMIT 1',
        { identifier }
    )
    if not phone then
        return { success = false, unlocked = false, error = 'PHONE_NOT_FOUND' }
    end

    local unlocked = false
    if type(phone.pin_hash) == 'string' and phone.pin_hash ~= '' then
        unlocked = MySQL.scalar.await(
            'SELECT 1 WHERE SHA2(?, 256) = ?',
            { pin, phone.pin_hash }
        ) ~= nil
    else
        unlocked = tostring(phone.lock_code or '') == pin
    end

    return {
        success = true,
        unlocked = unlocked,
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
        'UPDATE phone_numbers SET ringtone = ?, call_ringtone = ? WHERE identifier = ?',
        { ringtone, ringtone, identifier }
    )
    
    return true
end)

lib.callback.register('gcphone:setCallRingtone', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false end
    local ringtone = SafeToneId(type(data) == 'table' and data.ringtone or nil)
    if not ringtone then return false end

    MySQL.update.await(
        'UPDATE phone_numbers SET call_ringtone = ?, ringtone = ? WHERE identifier = ?',
        { ringtone, ringtone, identifier }
    )

    return true
end)

lib.callback.register('gcphone:setNotificationTone', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false end
    local tone = SafeToneId(type(data) == 'table' and data.tone or nil)
    if not tone then return false end

    MySQL.update.await(
        'UPDATE phone_numbers SET notification_tone = ? WHERE identifier = ?',
        { tone, identifier }
    )

    return true
end)

lib.callback.register('gcphone:setMessageTone', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false end
    local tone = SafeToneId(type(data) == 'table' and data.tone or nil)
    if not tone then return false end

    MySQL.update.await(
        'UPDATE phone_numbers SET message_tone = ? WHERE identifier = ?',
        { tone, identifier }
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
        'UPDATE phone_numbers SET lock_code = ?, pin_hash = SHA2(?, 256) WHERE identifier = ?',
        { code, code, identifier }
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
            callRingtone = phone.call_ringtone or phone.ringtone,
            notificationTone = phone.notification_tone or (Config.Phone.DefaultSettings.notificationTone or 'soft-ping.ogg'),
            messageTone = phone.message_tone or (Config.Phone.DefaultSettings.messageTone or 'pop.ogg'),
            volume = phone.volume,
            lockCode = '',
            theme = phone.theme or 'light',
            language = phone.language or 'es',
            audioProfile = phone.audio_profile or 'normal',
            appLayout = NormalizeLayout(savedLayout, enabledApps),
            enabledApps = EnabledList(enabledApps),
            featureFlags = featureFlags,
            requiresSetup = ResolveSetupState(phone.identifier).requiresSetup,
            setup = ResolveSetupState(phone.identifier),
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
