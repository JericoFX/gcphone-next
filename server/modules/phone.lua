-- Creado/Modificado por JericoFX

local Bridge = require 'server.bridge'
local Hooks = require 'server.modules.hooks'
local Utils = require 'server.lib.utils'
local Layouts = require 'server.modules.phone_layouts'
local Settings = require 'server.modules.phone_settings'

local PhoneExists
local RESOURCE_NAME = GetCurrentResourceName()

local isTruthy = Utils.isTruthy

local StreamerModePlayers = {}

-- Layout helpers extracted to server/modules/phone_layouts.lua (OPT-07).
-- Aliased locally so in-file references keep working.
local AllowedApps = Layouts.AllowedApps
local DefaultLayout = Layouts.DefaultLayout
local ForeignReadOnlyApps = Layouts.ForeignReadOnlyApps
local GetFeatureFlags = Layouts.GetFeatureFlags
local BuildEnabledApps = Layouts.BuildEnabledApps
local EnabledList = Layouts.EnabledList
local NormalizeLayout = Layouts.NormalizeLayout
local BuildReadOnlyEnabledApps = Layouts.BuildReadOnlyEnabledApps

---@class GCPhoneLookupOwner
---@field identifier string
---@field name string
---@field phoneNumber string
---@field imei string
---@field isStolen boolean
---@field stolenAt? string
---@field stolenReason? string
---@field stolenReporter? string

---@class GCPhoneLookupResponse
---@field success boolean
---@field error? string
---@field owner? GCPhoneLookupOwner

---@class GCPhoneStolenMutationResponse
---@field success boolean
---@field error? string
---@field phone? table<string, any>

local function GeneratePhoneNumber()
    local prefixes = Config.Phone and Config.Phone.NumberPrefix or { 555 }
    local prefix = prefixes[math.random(1, #prefixes)] or 555
    local suffix = math.random(1000, 9999)
    return string.format('%03d-%04d', prefix, suffix)
end

local function GenerateUniquePhoneNumber()
    for _ = 1, 40 do
        local phoneNumber = GeneratePhoneNumber()
        if not PhoneExists(phoneNumber) and not Bridge.GetIdentifierByPhone(phoneNumber) then
            return phoneNumber
        end
    end

    return nil
end

local function CanAccessIdentifierExport(identifier, requestSource)
    local src = tonumber(requestSource)
    if not src or src <= 0 or not identifier then
        return false
    end
    local ownerIdentifier = GetPhoneOwnerIdentifier(src, true) or Bridge.GetIdentifier(src)
    return ownerIdentifier ~= nil and ownerIdentifier == identifier
end

local function IsAuthorizedPhoneExportCaller()
    local invokingResource = type(GetInvokingResource) == 'function' and GetInvokingResource() or nil
    if invokingResource == RESOURCE_NAME then
        return true
    end

    local allowlist = Config.Phone and Config.Phone.ExportAllowlist or nil
    if type(allowlist) ~= 'table' or not invokingResource then
        return false
    end

    return allowlist[invokingResource] == true
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

-- Settings validators extracted to server/modules/phone_settings.lua (OPT-07 pass 2).
local SafeTheme = Settings.SafeTheme
local SafeAudioProfile = Settings.SafeAudioProfile
local ResolveToneId = Settings.ResolveToneId
local SafeLanguage = Settings.SafeLanguage

local ActivePhoneContexts = {}

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
    if not username:match('%a') then return nil end
    if username:match('^[._-]') then return nil end
    if username:match('[._-][._-]+') then return nil end
    return username
end

local function MailDomain()
    local domain = SafeString(Config.Mail and Config.Mail.Domain or nil, 64)
    if not domain then return 'noimotors.gg' end
    return domain:lower()
end

local function ResolveEmergencyContacts()
    local setup = Config.Phone and Config.Phone.Setup or {}
    local configured = type(setup.EmergencyContacts) == 'table' and setup.EmergencyContacts or {}
    local contacts = {}

    for i = 1, #configured do
        local entry = configured[i]
        if type(entry) == 'table' then
            local label = SafeString(entry.label or entry.name or 'Emergencia', 32)
            local number = SafeString(entry.number or '', 20)
            if label and number then
                contacts[#contacts + 1] = {
                    label = label,
                    number = number,
                }
            end
        end
    end

    return contacts
end

local function SafeMailAlias(value)
    local alias = SafeString(value, (Config.Mail and Config.Mail.MaxAliasLength) or 24)
    if not alias then return nil end

    alias = alias:lower()
    if not alias:match('^[a-z0-9._-]+$') then return nil end
    if not alias:match('%a') then return nil end
    if alias:match('^[._-]') or alias:match('[._-]$') then return nil end
    if alias:find('..', 1, true) then return nil end

    local minLen = math.max(3, tonumber(Config.Mail and Config.Mail.MinAliasLength) or 3)
    if #alias < minLen then return nil end

    return alias
end

local ALLOWED_USERNAME_TABLES = {
    phone_snap_accounts = true,
    phone_chirp_accounts = true,
    phone_clips_accounts = true,
}

local function UsernameExists(tableName, username, identifier)
    if not username then return true end
    if not ALLOWED_USERNAME_TABLES[tableName] then return false end
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
        'SELECT is_setup, clips_username, pin_hash FROM phone_numbers WHERE identifier = ? LIMIT 1',
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
    local hasPin = phone and type(phone.pin_hash) == 'string' and phone.pin_hash ~= ''

    local explicitlySetup = phone and isTruthy(phone.is_setup)
    local complete = explicitlySetup and hasPin and hasSnap and hasChirp and hasClips and hasMail


    return {
        requiresSetup = not complete,
        hasSnap = hasSnap,
        hasChirp = hasChirp,
        hasClips = hasClips,
        hasMail = hasMail,
        mailDomain = featureFlags.mail and MailDomain() or nil,
        emergencyContacts = ResolveEmergencyContacts(),
    }
end

PhoneExists = function(phoneNumber)
    return MySQL.scalar.await(
        'SELECT 1 FROM phone_numbers WHERE phone_number = ?',
        { phoneNumber }
    ) ~= nil
end

local function GetOrCreatePhone(source)
    local identifier = Bridge.GetIdentifier(source)
    if not identifier then return nil end

    local phone = MySQL.single.await(
        'SELECT * FROM phone_numbers WHERE identifier = ?',
        { identifier }
    )

    local framework = Bridge.GetFramework()
    local frameworkPhoneNumber = Bridge.GetFrameworkPhoneNumber(source, identifier)
    
    if phone then
        if framework == 'esx' and (not frameworkPhoneNumber or frameworkPhoneNumber == '') and phone.phone_number then
            Bridge.SetFrameworkPhoneNumber(source, identifier, phone.phone_number)
            frameworkPhoneNumber = phone.phone_number
        end

        if frameworkPhoneNumber and frameworkPhoneNumber ~= '' and phone.phone_number ~= frameworkPhoneNumber then
            MySQL.update.await(
                'UPDATE phone_numbers SET phone_number = ? WHERE identifier = ?',
                { frameworkPhoneNumber, identifier }
            )
            phone.phone_number = frameworkPhoneNumber
        end

        if type(phone.imei) ~= 'string' or not phone.imei:match('^%d%d%d%d%d%d%d%d%d%d%d%d%d%d%d$') then
            local updated = MySQL.update.await(
                'UPDATE phone_numbers SET imei = NULL WHERE identifier = ?',
                { identifier }
            )

            if updated and updated > 0 then
                phone = MySQL.single.await(
                    'SELECT * FROM phone_numbers WHERE identifier = ?',
                    { identifier }
                ) or phone
            end
        end

        return phone
    end

    local phoneNumber = frameworkPhoneNumber
    if (type(phoneNumber) ~= 'string' or phoneNumber == '') and framework == 'esx' then
        phoneNumber = GenerateUniquePhoneNumber()
        if phoneNumber then
            Bridge.SetFrameworkPhoneNumber(source, identifier, phoneNumber)
        end
    end

    if type(phoneNumber) ~= 'string' or phoneNumber == '' then
        return nil
    end

    MySQL.insert.await(
        'INSERT INTO phone_numbers (identifier, phone_number, wallpaper, ringtone, call_ringtone, notification_tone, message_tone, volume, lock_code, pin_hash, is_setup, theme, language, audio_profile, clips_username) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, NULL)',
        { 
            identifier, 
            phoneNumber, 
            Config.Phone.DefaultSettings.wallpaper,
            ResolveToneId(Config.Phone.DefaultSettings.ringtone, 'ringtone'),
            ResolveToneId(Config.Phone.DefaultSettings.callRingtone or Config.Phone.DefaultSettings.ringtone, 'ringtone'),
            ResolveToneId(Config.Phone.DefaultSettings.notificationTone, 'notification'),
            ResolveToneId(Config.Phone.DefaultSettings.messageTone, 'message'),
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

local function GetPhoneByIdentifier(identifier)
    if not identifier then return nil end
    return MySQL.single.await(
        'SELECT * FROM phone_numbers WHERE identifier = ?',
        { identifier }
    )
end

local function GetPhoneRecordByIdentifier(identifier)
    return GetPhoneByIdentifier(identifier)
end

local function ResolvePhoneOwnerName(source, identifier)
    if source then
        local name = Bridge.GetName(source)
        if type(name) == 'string' and name ~= '' then
            return name
        end
    end

    if not identifier then return nil end

    local playerResult = MySQL.single.await(
        'SELECT charinfo FROM players WHERE citizenid = ? LIMIT 1',
        { identifier }
    )
    if playerResult and playerResult.charinfo then
        local ok, charinfo = pcall(json.decode, playerResult.charinfo)
        if ok and charinfo and charinfo.firstname and charinfo.lastname then
            return (charinfo.firstname .. ' ' .. charinfo.lastname)
        end
    end

    return nil
end

local function VerifyPinForIdentifier(identifier, pin)
    if not identifier or not pin then return false, 'MISSING_IDENTIFIER' end

    local phone = MySQL.single.await(
        'SELECT lock_code, pin_hash FROM phone_numbers WHERE identifier = ? LIMIT 1',
        { identifier }
    )
    if not phone then
        return false, 'PHONE_NOT_FOUND'
    end

    if type(phone.pin_hash) == 'string' and phone.pin_hash ~= '' then
        local unlocked = MySQL.scalar.await(
            'SELECT 1 WHERE SHA2(?, 256) = ?',
            { pin, phone.pin_hash }
        ) ~= nil
        return unlocked, nil
    end

    return tostring(phone.lock_code or '') == pin, nil
end

local function VerifyPhonePinForIdentifier(identifier, pin)
    return VerifyPinForIdentifier(identifier, pin)
end

local function GetPhoneAccessContext(source)
    return ActivePhoneContexts[tonumber(source) or -1]
end

local function ClearPhoneAccessContext(source)
    ActivePhoneContexts[tonumber(source) or -1] = nil
end

local function SetPhoneAccessContext(source, context)
    local src = tonumber(source)
    if not src or src <= 0 then return end

    if type(context) ~= 'table' then
        ActivePhoneContexts[src] = nil
        return
    end

    ActivePhoneContexts[src] = {
        mode = context.mode,
        ownerIdentifier = context.ownerIdentifier,
        phoneId = context.phoneId,
        ownerName = context.ownerName,
        readOnly = context.readOnly == true,
        openedAt = os.time(),
    }
end

local function GetPhoneOwnerIdentifier(source, allowForeign)
    local context = GetPhoneAccessContext(source)
    if allowForeign and context and type(context.ownerIdentifier) == 'string' and context.ownerIdentifier ~= '' then
        return context.ownerIdentifier
    end

    return Bridge.GetIdentifier(source)
end

local function GetPhoneLanguageForSource(source, allowForeign)
    local identifier = GetPhoneOwnerIdentifier(source, allowForeign)
    if not identifier then return 'es' end

    local phone = GetPhoneByIdentifier(identifier)
    return SafeLanguage(phone and phone.language) or 'es'
end

local function IsPhoneReadOnly(source)
    local context = GetPhoneAccessContext(source)
    return context and context.readOnly == true or false
end

local function BuildPhonePayload(phone, source)
    if not phone then return nil end

    local context = source and GetPhoneAccessContext(source) or nil
    local isForeignReadOnly = context and context.mode == 'foreign-readonly'
    local framework = Bridge.GetFramework() or 'unknown'
    local featureFlags = GetFeatureFlags()
    local enabledApps = isForeignReadOnly and BuildReadOnlyEnabledApps() or BuildEnabledApps(featureFlags)
    local layoutRaw = MySQL.scalar.await(
        'SELECT layout_json FROM phone_layouts WHERE identifier = ?',
        { phone.identifier }
    )
    local savedLayout = layoutRaw and layoutRaw ~= '' and json.decode(layoutRaw) or nil
    local appLayout = NormalizeLayout(isForeignReadOnly and nil or savedLayout, enabledApps)
    local setup = ResolveSetupState(phone.identifier)
    local ownerName = isForeignReadOnly and context.ownerName or ResolvePhoneOwnerName(source, phone.identifier)

    local isStreamer = isTruthy(phone.streamer_mode)
    if source then
        StreamerModePlayers[source] = isStreamer or nil
    end

    return {
        phoneNumber = phone.phone_number,
        framework = framework,
        imei = phone.imei,
        deviceOwnerName = ownerName,
        isStolen = isTruthy(phone.is_stolen),
        stolenAt = phone.stolen_at,
        stolenReason = phone.stolen_reason,
        wallpaper = phone.wallpaper,
        ringtone = ResolveToneId(phone.ringtone, 'ringtone'),
        callRingtone = ResolveToneId(phone.call_ringtone or phone.ringtone, 'ringtone'),
        notificationTone = ResolveToneId(phone.notification_tone, 'notification'),
        messageTone = ResolveToneId(phone.message_tone, 'message'),
        volume = phone.volume,
        lockCode = '',
        theme = phone.theme or 'light',
        language = phone.language or 'es',
        audioProfile = phone.audio_profile or 'normal',
        streamerMode = isStreamer,
        appLayout = appLayout,
        enabledApps = EnabledList(enabledApps),
        featureFlags = featureFlags,
        requiresSetup = setup.requiresSetup,
        setup = setup,
        accessMode = isForeignReadOnly and 'foreign-readonly' or 'own',
        accessOwnerName = isForeignReadOnly and context.ownerName or nil,
        accessPhoneId = isForeignReadOnly and context.phoneId or nil,
        resourceVersion = GetResourceMetadata(GetCurrentResourceName(), 'version', 0) or '0.0.0',
        resourceAuthor = GetResourceMetadata(GetCurrentResourceName(), 'author', 0) or 'JericoFX',
    }
end

local function BuildPhonePayloadForSource(phone, source)
    return BuildPhonePayload(phone, source)
end

local function SetPhoneStolenStateByIMEI(imei, data)
    local safeImei = SafeString(imei, 32)
    if not safeImei then
        return false, 'INVALID_IMEI'
    end

    local isStolen = not not (type(data) == 'table' and data.isStolen ~= false)
    local reason = SafeString(type(data) == 'table' and data.reason or nil, 255)
    local reporter = SafeString(type(data) == 'table' and data.reporter or nil, 80)

    local changed = MySQL.update.await(
        [[
            UPDATE phone_numbers
            SET is_stolen = ?,
                stolen_at = CASE WHEN ? = 1 THEN NOW() ELSE NULL END,
                stolen_reason = CASE WHEN ? = 1 THEN ? ELSE NULL END,
                stolen_reporter = CASE WHEN ? = 1 THEN ? ELSE NULL END
            WHERE imei = ?
        ]],
        {
            isStolen and 1 or 0,
            isStolen and 1 or 0,
            isStolen and 1 or 0,
            reason,
            isStolen and 1 or 0,
            reporter,
            safeImei,
        }
    )

    if not changed or changed < 1 then
        return false, 'PHONE_NOT_FOUND'
    end

    local phone = MySQL.single.await(
        'SELECT identifier, phone_number, imei, is_stolen, stolen_at, stolen_reason, stolen_reporter FROM phone_numbers WHERE imei = ? LIMIT 1',
        { safeImei }
    )

    return true, {
        identifier = phone and phone.identifier or nil,
        phoneNumber = phone and phone.phone_number or nil,
        imei = phone and phone.imei or safeImei,
        isStolen = phone and isTruthy(phone.is_stolen) or isStolen,
        stolenAt = phone and phone.stolen_at or nil,
        stolenReason = phone and phone.stolen_reason or reason,
        stolenReporter = phone and phone.stolen_reporter or reporter,
    }
end

local function ResetPhone(identifier)
    if not identifier then return nil end

    local phone = MySQL.single.await(
        'SELECT phone_number, imei FROM phone_numbers WHERE identifier = ? LIMIT 1',
        { identifier }
    )
    if not phone then return nil end

    local initialBalance = tonumber(Config.Wallet and Config.Wallet.InitialBalance) or 2500

    MySQL.transaction.await({
        { query = 'DELETE FROM phone_contacts WHERE identifier = ?', values = { identifier } },
        { query = 'DELETE FROM phone_gallery WHERE identifier = ?', values = { identifier } },
        { query = 'DELETE FROM phone_layouts WHERE identifier = ?', values = { identifier } },
        { query = 'DELETE FROM phone_calls WHERE owner = ?', values = { phone.phone_number } },
        { query = 'DELETE FROM phone_messages WHERE transmitter = ? OR receiver = ?', values = { phone.phone_number, phone.phone_number } },
        { query = 'DELETE FROM phone_chat_group_members WHERE identifier = ?', values = { identifier } },
        { query = 'DELETE FROM phone_chat_group_invites WHERE inviter_identifier = ? OR target_identifier = ?', values = { identifier, identifier } },
        { query = 'DELETE FROM phone_chat_groups WHERE owner_identifier = ?', values = { identifier } },
        { query = 'DELETE FROM phone_wavechat_statuses WHERE identifier = ? OR phone_number = ?', values = { identifier, phone.phone_number } },

        { query = 'DELETE FROM phone_news WHERE identifier = ?', values = { identifier } },
        { query = 'DELETE FROM phone_friend_requests WHERE from_identifier = ? OR to_identifier = ?', values = { identifier, identifier } },
        { query = 'DELETE FROM phone_shared_locations WHERE from_identifier = ? OR to_identifier = ?', values = { identifier, identifier } },
        { query = 'DELETE FROM phone_live_locations WHERE sender_phone = ? OR recipient_phone = ?', values = { phone.phone_number, phone.phone_number } },
        { query = 'DELETE FROM phone_dropped WHERE owner_identifier = ? OR phone_number = ? OR imei = ?', values = { identifier, phone.phone_number, phone.imei } },
        { query = 'DELETE FROM phone_notes WHERE identifier = ?', values = { identifier } },
        { query = 'DELETE FROM phone_alarms WHERE identifier = ?', values = { identifier } },
        { query = 'DELETE FROM phone_garage WHERE identifier = ?', values = { identifier } },
        { query = 'DELETE FROM phone_wallet_cards WHERE identifier = ?', values = { identifier } },
        { query = 'DELETE FROM phone_wallet_transactions WHERE identifier = ?', values = { identifier } },
        { query = 'UPDATE phone_wallets SET balance = ? WHERE identifier = ?', values = { initialBalance, identifier } },
        { query = 'DELETE FROM phone_documents WHERE identifier = ?', values = { identifier } },
        { query = 'DELETE FROM phone_documents_nfc_scans WHERE scanner_identifier = ? OR target_identifier = ?', values = { identifier, identifier } },
        { query = 'DELETE FROM phone_notifications WHERE identifier = ?', values = { identifier } },
        { query = 'DELETE FROM phone_social_notifications WHERE account_identifier = ? OR from_identifier = ?', values = { identifier, identifier } },
        { query = 'DELETE FROM phone_mail_accounts WHERE identifier = ?', values = { identifier } },
        { query = 'DELETE FROM phone_chirp_accounts WHERE identifier = ?', values = { identifier } },
        { query = 'DELETE FROM phone_snap_accounts WHERE identifier = ?', values = { identifier } },
        { query = 'DELETE FROM phone_clips_accounts WHERE identifier = ?', values = { identifier } },
        {
            query = 'UPDATE phone_numbers SET wallpaper = ?, ringtone = ?, call_ringtone = ?, notification_tone = ?, message_tone = ?, volume = ?, lock_code = ?, pin_hash = NULL, is_setup = 0, clips_username = NULL, theme = ?, language = ?, audio_profile = ? WHERE identifier = ?',
            values = {
                Config.Phone.DefaultSettings.wallpaper,
                ResolveToneId(Config.Phone.DefaultSettings.ringtone, 'ringtone'),
                ResolveToneId(Config.Phone.DefaultSettings.callRingtone or Config.Phone.DefaultSettings.ringtone, 'ringtone'),
                ResolveToneId(Config.Phone.DefaultSettings.notificationTone, 'notification'),
                ResolveToneId(Config.Phone.DefaultSettings.messageTone, 'message'),
                Config.Phone.DefaultSettings.volume,
                Config.Phone.DefaultSettings.lockCode,
                Config.Phone.DefaultSettings.theme,
                Config.Phone.DefaultSettings.language or 'es',
                Config.Phone.DefaultSettings.audioProfile or 'normal',
                identifier,
            }
        },
    })

    return MySQL.single.await(
        'SELECT * FROM phone_numbers WHERE identifier = ? LIMIT 1',
        { identifier }
    )
end

local function PlayerHasPhoneItem(source)
    if not Config.Phone.RequireItem then return true end

    local itemName = Config.Phone.ItemName or 'phone'
    local hasOxInventory = GetResourceState('ox_inventory') == 'started'
    if not hasOxInventory then return true end

    local ok, count = pcall(exports.ox_inventory.Search, exports.ox_inventory, source, 'count', itemName)
    if not ok then return true end

    return type(count) == 'number' and count >= 1
end

lib.callback.register('gcphone:getPhoneData', function(source)
    if not PlayerHasPhoneItem(source) then
        return { blocked = true, error = 'NO_PHONE_ITEM' }
    end

    local identifier = GetPhoneOwnerIdentifier(source, true)
    local phone = identifier == Bridge.GetIdentifier(source) and GetOrCreatePhone(source) or GetPhoneByIdentifier(identifier)
    if not phone then return nil end
    return BuildPhonePayload(phone, source)
end)

lib.callback.register('gcphone:phone:getSetupState', function(source)
    local identifier = Bridge.GetIdentifier(source)
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
    local identifier = Bridge.GetIdentifier(source)
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

    local name = Bridge.GetName(source) or 'User'
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

        MySQL.insert.await(
            [[
                INSERT INTO phone_matchmylove_profiles (identifier, display_name, age, bio, gender, looking_for, photos, interests, is_active)
                VALUES (?, ?, 25, '', 'other', 'everyone', '[]', '[]', 1)
                ON DUPLICATE KEY UPDATE display_name = VALUES(display_name)
            ]],
            { identifier, name }
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

    Hooks.triggerHook('phoneSetupCompleted', {
        source = source,
        identifier = identifier,
        phoneNumber = Bridge.GetPhoneNumber(identifier),
        snapUsername = snapUsername,
        chirpUsername = chirpUsername,
        clipsUsername = clipsUsername,
        mail = mailEmail,
        language = language,
    })

    if mailEmail then
        Hooks.triggerHook('mailAccountCreated', {
            source = source,
            identifier = identifier,
            email = mailEmail,
            alias = mailAlias,
            domain = mailDomain,
        })
    end

    local setup = ResolveSetupState(identifier)
    return {
        success = true,
        requiresSetup = setup.requiresSetup,
        setup = setup,
    }
end)

lib.callback.register('gcphone:phone:verifyPin', function(source, data)
    local identifier = GetPhoneOwnerIdentifier(source, true)
    if not identifier then
        return { success = false, unlocked = false, error = 'MISSING_IDENTIFIER' }
    end

    local pin = SafePin(type(data) == 'table' and data.pin or nil)
    if not pin then
        return { success = false, unlocked = false, error = 'INVALID_PIN' }
    end

    local unlocked, err = VerifyPinForIdentifier(identifier, pin)
    if err then
        return { success = false, unlocked = false, error = err }
    end

    if unlocked then
        local phone = GetPhoneByIdentifier(identifier)
        Hooks.triggerHook('deviceUnlocked', {
            source = source,
            identifier = identifier,
            imei = phone and phone.imei or nil,
            phoneNumber = phone and phone.phone_number or Bridge.GetPhoneNumber(identifier),
        })
    end

    return {
        success = true,
        unlocked = unlocked,
    }
end)

lib.callback.register('gcphone:phone:reportImeiViewed', function(source, data)
    local identifier = GetPhoneOwnerIdentifier(source, true)
    if not identifier then
        return { success = false, error = 'MISSING_IDENTIFIER' }
    end

    local phone = GetPhoneByIdentifier(identifier)
    if not phone then
        return { success = false, error = 'PHONE_NOT_FOUND' }
    end

    Hooks.triggerHook('imeiViewed', {
        source = source,
        identifier = identifier,
        imei = phone.imei,
        context = SafeString(type(data) == 'table' and data.context or nil, 24) or 'unknown',
    })

    return { success = true, imei = phone.imei }
end)

-- OPT-05: unified phone-setting specs. Each entry maps an event name to a
-- validator + SQL + param builder. A single handler loop below registers
-- all of them, replacing ~180 lines of near-identical callbacks.
local PHONE_SETTING_SPECS = {
    { event = 'gcphone:setWallpaper',
      parse = function(data) return SafeString(type(data) == 'table' and data.url or nil, 500) end,
      sql = 'UPDATE phone_numbers SET wallpaper = ? WHERE identifier = ?' },
    { event = 'gcphone:setRingtone',
      parse = function(data) return ResolveToneId(type(data) == 'table' and data.ringtone or nil, 'ringtone') end,
      sql = 'UPDATE phone_numbers SET ringtone = ?, call_ringtone = ? WHERE identifier = ?',
      params = function(v) return { v, v } end },
    { event = 'gcphone:setCallRingtone',
      parse = function(data) return ResolveToneId(type(data) == 'table' and data.ringtone or nil, 'ringtone') end,
      sql = 'UPDATE phone_numbers SET call_ringtone = ?, ringtone = ? WHERE identifier = ?',
      params = function(v) return { v, v } end },
    { event = 'gcphone:setNotificationTone',
      parse = function(data) return ResolveToneId(type(data) == 'table' and data.tone or nil, 'notification') end,
      sql = 'UPDATE phone_numbers SET notification_tone = ? WHERE identifier = ?' },
    { event = 'gcphone:setMessageTone',
      parse = function(data) return ResolveToneId(type(data) == 'table' and data.tone or nil, 'message') end,
      sql = 'UPDATE phone_numbers SET message_tone = ? WHERE identifier = ?' },
    { event = 'gcphone:setVolume',
      parse = function(data) return Utils.SafeNumber(type(data) == 'table' and data.volume or nil, 0.0, 1.0) end,
      sql = 'UPDATE phone_numbers SET volume = ? WHERE identifier = ?' },
    { event = 'gcphone:setLockCode',
      parse = function(data) return SafeString(type(data) == 'table' and data.code or nil, 16) end,
      sql = 'UPDATE phone_numbers SET lock_code = ?, pin_hash = SHA2(?, 256) WHERE identifier = ?',
      params = function(v) return { v, v } end },
    { event = 'gcphone:setTheme',
      parse = function(data) return SafeTheme(type(data) == 'table' and data.theme or nil) end,
      sql = 'UPDATE phone_numbers SET theme = ? WHERE identifier = ?' },
    { event = 'gcphone:setLanguage',
      parse = function(data) return SafeLanguage(type(data) == 'table' and data.language or nil) end,
      sql = 'UPDATE phone_numbers SET language = ? WHERE identifier = ?' },
    { event = 'gcphone:setAudioProfile',
      parse = function(data)
          local profile = SafeString(type(data) == 'table' and data.audioProfile or nil, 16)
          if profile ~= 'normal' and profile ~= 'street' and profile ~= 'vehicle' and profile ~= 'silent' then return nil end
          return profile
      end,
      sql = 'UPDATE phone_numbers SET audio_profile = ? WHERE identifier = ?' },
    { event = 'gcphone:setStreamerMode',
      parse = function(data)
          local enabled = type(data) == 'table' and data.enabled == true
          return { enabled = enabled, db = enabled and 1 or 0 }
      end,
      sql = 'UPDATE phone_numbers SET streamer_mode = ? WHERE identifier = ?',
      params = function(v) return { v.db } end,
      after = function(source, v) StreamerModePlayers[source] = v.enabled or nil end },
}

for _, spec in ipairs(PHONE_SETTING_SPECS) do
    lib.callback.register(spec.event, function(source, data)
        if IsPhoneReadOnly(source) then return false end
        local identifier = Bridge.GetIdentifier(source)
        if not identifier then return false end
        local value = spec.parse(data)
        if value == nil or value == false then return false end
        local params = spec.params and spec.params(value) or { value }
        params[#params + 1] = identifier
        MySQL.update.await(spec.sql, params)
        if spec.after then spec.after(source, value) end
        return true
    end)
end

lib.callback.register('gcphone:factoryResetPhone', function(source)
    if IsPhoneReadOnly(source) then return { success = false, error = 'READ_ONLY' } end
    local identifier = Bridge.GetIdentifier(source)
    if not identifier then return { success = false, error = 'MISSING_IDENTIFIER' } end

    local phone = ResetPhone(identifier)
    if not phone then return { success = false, error = 'RESET_FAILED' } end

    local payload = BuildPhonePayload(phone, source) or {}
    payload.success = true
    return payload
end)

Layouts.RegisterCallbacks({ Bridge = Bridge, IsPhoneReadOnly = IsPhoneReadOnly })

lib.callback.register('gcphone:getPhoneMetadata', function(source, phoneId)
    local identifier = Bridge.GetIdentifier(source)
    if not identifier then return nil end
    
    local phone = MySQL.single.await(
        'SELECT phone_number, imei FROM phone_numbers WHERE identifier = ?',
        { identifier }
    )
    
    if not phone then return nil end
    
    local name = Bridge.GetName(source)
    
    return {
        owner = name,
        phoneNumber = phone.phone_number,
        imei = phone.imei
    }
end)

RegisterNetEvent('gcphone:clearPhoneAccessContext', function()
    ClearPhoneAccessContext(source)
end)

-- Dedupe a brief window so back-to-back playerLoaded signals (e.g. a server
-- that emits both qb-core legacy and qbx_core variants, or a multichar swap
-- that fires twice) do not rotate the NUI auth token mid-request.
local LastPhoneInitAt = {}
local PHONE_INIT_DEDUPE_MS = 2000

local function PushPhoneInit(source)
    if not source or source <= 0 then return end

    local now = GetGameTimer()
    local last = LastPhoneInitAt[source]
    if last and (now - last) < PHONE_INIT_DEDUPE_MS then return end
    LastPhoneInitAt[source] = now

    local phone = GetOrCreatePhone(source)
    if phone then
        TriggerClientEvent('gcphone:init', source, BuildPhonePayload(phone, source))
    end
end

-- qb-core emits `QBCore:Server:PlayerLoaded` with a Player table.
RegisterNetEvent('QBCore:Server:PlayerLoaded', function(Player)
    if not Player or not Player.PlayerData or not Player.PlayerData.source then return end
    PushPhoneInit(Player.PlayerData.source)
end)

-- qbx_core emits `QBCore:Server:OnPlayerLoaded` with no arguments; the
-- firing source is exposed via the event `source`. Verified: qbox-docs
-- /qbox-project/qbox-docs resources/qbx_core/events/server.mdx.
RegisterNetEvent('QBCore:Server:OnPlayerLoaded', function()
    PushPhoneInit(source)
end)

AddEventHandler('esx:playerLoaded', function(playerId)
    PushPhoneInit(tonumber(playerId))
end)

-- Rehydrate players whose character was already loaded when this resource restarts.
-- On first boot GetPlayers() is empty so this is a no-op; only matters on `/restart gcphone`.
AddEventHandler('onResourceStart', function(resourceName)
    if resourceName ~= RESOURCE_NAME then return end

    CreateThread(function()
        lib.waitFor(function()
            local fw = Bridge.GetFramework()
            if fw and fw ~= 'unknown' then return true end
        end, 'gcphone-next rehydrate: framework not ready', 15000)

        for _, playerId in ipairs(GetPlayers()) do
            local source = tonumber(playerId)
            if source and source > 0 then
                local identifier = Bridge.GetIdentifier(source)
                if identifier then
                    local phone = GetOrCreatePhone(source)
                    if phone then
                        TriggerClientEvent('gcphone:init', source, BuildPhonePayload(phone, source))
                    end
                end
            end
        end
    end)
end)

RegisterNetEvent('QBCore:Server:OnPlayerUnload', function(source)
    ClearPhoneAccessContext(source)
end)

AddEventHandler('esx:playerDropped', function(playerId)
    ClearPhoneAccessContext(playerId)
end)

AddEventHandler('playerDropped', function()
    ClearPhoneAccessContext(source)
    StreamerModePlayers[source] = nil
    LastPhoneInitAt[source] = nil
end)

---Get a phone number by owner identifier.
---@param identifier string
---@param requestSource integer
---@return string|nil
exports('GetPhoneNumber', function(identifier, requestSource)
    if not CanAccessIdentifierExport(identifier, requestSource) then
        return nil
    end

    local result = Bridge.GetPhoneNumber(identifier)
    if result then
        return result
    end

    return MySQL.scalar.await(
        'SELECT phone_number FROM phone_numbers WHERE identifier = ? LIMIT 1',
        { identifier }
    )
end)

---Resolve an identifier from a phone number.
---@param phoneNumber string
---@return string|nil
exports('GetIdentifierByPhone', function(phoneNumber)
    local result = Bridge.GetIdentifierByPhone(phoneNumber)
    if result then
        return result
    end

    return MySQL.scalar.await(
        'SELECT identifier FROM phone_numbers WHERE phone_number = ? LIMIT 1',
        { phoneNumber }
    )
end)

---Mark a phone as stolen using its IMEI.
---@param imei string
---@param reason? string
---@param reporter? string
---@return GCPhoneStolenMutationResponse
exports('MarkPhoneAsStolenByIMEI', function(imei, reason, reporter)
    if not IsAuthorizedPhoneExportCaller() then
        return {
            success = false,
            error = 'UNAUTHORIZED',
        }
    end

    local success, result = SetPhoneStolenStateByIMEI(imei, {
        isStolen = true,
        reason = reason,
        reporter = reporter,
    })

    if not success then
        return {
            success = false,
            error = result,
        }
    end

    -- Notify the owner if online
    if result and result.identifier then
        local ownerSource = Bridge.GetSourceFromIdentifier(result.identifier)
        if ownerSource then
            TriggerClientEvent('gcphone:phoneMarkedStolen', ownerSource, {
                isStolen = true,
                reason = reason or '',
            })
        end
    end

    return {
        success = true,
        phone = result,
    }
end)

---Clear stolen state for a phone using its IMEI.
---@param imei string
---@return GCPhoneStolenMutationResponse
exports('ClearPhoneStolenByIMEI', function(imei)
    if not IsAuthorizedPhoneExportCaller() then
        return {
            success = false,
            error = 'UNAUTHORIZED',
        }
    end

    local success, result = SetPhoneStolenStateByIMEI(imei, {
        isStolen = false,
    })

    if not success then
        return {
            success = false,
            error = result,
        }
    end

    return {
        success = true,
        phone = result,
    }
end)

local function BuildOwnerLookupResponse(phone)
    if not phone then
        return {
            success = false,
            error = 'PHONE_NOT_FOUND',
        }
    end

    return {
        success = true,
        owner = {
            identifier = phone.identifier,
            name = ResolvePhoneOwnerName(nil, phone.identifier),
            phoneNumber = phone.phone_number,
            imei = phone.imei,
            isStolen = isTruthy(phone.is_stolen),
            stolenAt = phone.stolen_at,
            stolenReason = phone.stolen_reason,
            stolenReporter = phone.stolen_reporter,
        }
    }
end

local function GetPhoneLookupRecordByIMEI(imei)
    local safeImei = SafeString(imei, 32)
    if not safeImei then
        return nil, 'INVALID_IMEI'
    end

    local phone = MySQL.single.await(
        [[
            SELECT identifier, phone_number, imei, is_stolen, stolen_at, stolen_reason, stolen_reporter
            FROM phone_numbers
            WHERE imei = ?
            LIMIT 1
        ]],
        { safeImei }
    )

    if not phone then
        return nil, 'PHONE_NOT_FOUND'
    end

    return phone, nil
end

local function GetPhoneLookupRecordByIdentifier(identifier)
    local safeIdentifier = SafeString(identifier, 80)
    if not safeIdentifier then
        return nil, 'INVALID_IDENTIFIER'
    end

    local phone = MySQL.single.await(
        [[
            SELECT identifier, phone_number, imei, is_stolen, stolen_at, stolen_reason, stolen_reporter
            FROM phone_numbers
            WHERE identifier = ?
            LIMIT 1
        ]],
        { safeIdentifier }
    )

    if not phone then
        return nil, 'PHONE_NOT_FOUND'
    end

    return phone, nil
end

local function GetPhoneLookupRecordByNumber(phoneNumber)
    local safePhone = SafeString(phoneNumber, 20)
    if not safePhone then
        return nil, 'INVALID_PHONE_NUMBER'
    end

    local identifier = Bridge.GetIdentifierByPhone(safePhone)
    if not identifier then
        return nil, 'PHONE_NOT_FOUND'
    end

    return GetPhoneLookupRecordByIdentifier(identifier)
end

---Get phone owner details by IMEI.
---@param imei string
---@return GCPhoneLookupResponse
exports('GetPhoneOwnerByIMEI', function(imei)
    if not IsAuthorizedPhoneExportCaller() then
        return {
            success = false,
            error = 'UNAUTHORIZED',
        }
    end

    local phone, err = GetPhoneLookupRecordByIMEI(imei)
    if err then
        return {
            success = false,
            error = err,
        }
    end

    return BuildOwnerLookupResponse(phone)
end)

---Get phone owner details by phone number.
---@param phoneNumber string
---@return GCPhoneLookupResponse
exports('GetPhoneOwnerByNumber', function(phoneNumber)
    if not IsAuthorizedPhoneExportCaller() then
        return {
            success = false,
            error = 'UNAUTHORIZED',
        }
    end

    local phone, err = GetPhoneLookupRecordByNumber(phoneNumber)
    if err then
        return {
            success = false,
            error = err,
        }
    end

    return BuildOwnerLookupResponse(phone)
end)

---Get phone owner details by identifier.
---@param identifier string
---@param requestSource integer
---@return GCPhoneLookupResponse
exports('GetPhoneByIdentifier', function(identifier, requestSource)
    if not CanAccessIdentifierExport(identifier, requestSource) then
        return {
            success = false,
            error = 'UNAUTHORIZED',
        }
    end

    local phone, err = GetPhoneLookupRecordByIdentifier(identifier)
    if err then
        return {
            success = false,
            error = err,
        }
    end

    return BuildOwnerLookupResponse(phone)
end)

---Mark a phone as stolen using its phone number.
---@param phoneNumber string
---@param reason? string
---@param reporter? string
---@return GCPhoneStolenMutationResponse
exports('MarkPhoneAsStolenByNumber', function(phoneNumber, reason, reporter)
    if not IsAuthorizedPhoneExportCaller() then
        return {
            success = false,
            error = 'UNAUTHORIZED',
        }
    end

    local phone, err = GetPhoneLookupRecordByNumber(phoneNumber)
    if err then
        return {
            success = false,
            error = err,
        }
    end

    local success, result = SetPhoneStolenStateByIMEI(phone.imei, {
        isStolen = true,
        reason = reason,
        reporter = reporter,
    })

    if not success then
        return {
            success = false,
            error = result,
        }
    end

    -- Notify the owner if online
    if result and result.identifier then
        local ownerSource = Bridge.GetSourceFromIdentifier(result.identifier)
        if ownerSource then
            TriggerClientEvent('gcphone:phoneMarkedStolen', ownerSource, {
                isStolen = true,
                reason = reason or '',
            })
        end
    end

    return {
        success = true,
        phone = result,
    }
end)

---Check if a player has a phone item (ox_inventory). Always true when RequireItem is false.
---@param source integer
---@return boolean
exports('PlayerHasPhoneItem', PlayerHasPhoneItem)

---Clear stolen state for a phone using its phone number.
---@param phoneNumber string
---@return GCPhoneStolenMutationResponse
exports('ClearPhoneStolenByNumber', function(phoneNumber)
    if not IsAuthorizedPhoneExportCaller() then
        return {
            success = false,
            error = 'UNAUTHORIZED',
        }
    end

    local phone, err = GetPhoneLookupRecordByNumber(phoneNumber)
    if err then
        return {
            success = false,
            error = err,
        }
    end

    local success, result = SetPhoneStolenStateByIMEI(phone.imei, {
        isStolen = false,
    })

    if not success then
        return {
            success = false,
            error = result,
        }
    end

    return {
        success = true,
        phone = result,
    }
end)

return {
    GetPhoneOwnerIdentifier = GetPhoneOwnerIdentifier,
    GetPhoneAccessContext = GetPhoneAccessContext,
    ClearPhoneAccessContext = ClearPhoneAccessContext,
    SetPhoneAccessContext = SetPhoneAccessContext,
    GetPhoneRecordByIdentifier = GetPhoneRecordByIdentifier,
    GetPhoneLanguageForSource = GetPhoneLanguageForSource,
    IsPhoneReadOnly = IsPhoneReadOnly,
    BuildPhonePayloadForSource = BuildPhonePayloadForSource,
    VerifyPhonePinForIdentifier = VerifyPhonePinForIdentifier,
    PlayerHasPhoneItem = PlayerHasPhoneItem,
    StreamerModePlayers = StreamerModePlayers,
}
