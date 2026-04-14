-- Phone layout helpers and callbacks.
-- Extracted from server/modules/phone.lua (OPT-07) to reduce file size.
-- Extended with folder support, optimistic concurrency (version) and
-- per-source rate-limiting on setAppLayout.

local M = {}

M.AllowedApps = {
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
    matchmylove = true,
    radio = true,
    services = true,
    cityride = true,
}

M.DefaultLayout = {
    home = { 'contacts', 'messages', 'mail', 'notifications', 'calls', 'settings', 'gallery', 'camera', 'bank', 'wallet', 'documents', 'wavechat', 'music', 'chirp', 'snap', 'clips', 'darkrooms', 'yellowpages', 'news', 'garage', 'clock', 'notes', 'maps', 'weather', 'matchmylove', 'radio', 'services', 'cityride' },
    menu = { 'appstore' },
    folders = {},
}

M.ForeignReadOnlyApps = {
    contacts = true,
    messages = true,
    notifications = true,
    calls = true,
    settings = true,
    gallery = true,
    documents = true,
}

M.PinnedHomeIds = { 'contacts', 'messages', 'mail' }

M.AllowedFolderColors = {
    blue = true, purple = true, pink = true, red = true,
    orange = true, green = true, teal = true, gray = true,
}

M.DefaultFolderColor = 'blue'

M.MAX_FOLDERS = 4
M.MAX_APPS_PER_FOLDER = 4
M.MAX_LAYOUT_BYTES = 16384
M.FOLDER_NAME_MAX_BYTES = 60

local RATE_LIMIT_MS = 1500
local lastSetAt = {}

local function isPinned(appId)
    for _, id in ipairs(M.PinnedHomeIds) do
        if id == appId then return true end
    end
    return false
end

local function trim(value)
    if type(value) ~= 'string' then return nil end
    return (value:gsub('^%s+', ''):gsub('%s+$', ''))
end

local function hasControlChars(value)
    return value:find('[%z\1-\31\127]') ~= nil
end

function M.ValidateFolderName(raw)
    local trimmed = trim(raw)
    if not trimmed or trimmed == '' then return nil end
    if #trimmed > M.FOLDER_NAME_MAX_BYTES then return nil end
    if hasControlChars(trimmed) then return nil end
    return trimmed
end

function M.ValidateFolderColor(raw)
    if type(raw) ~= 'string' then return nil end
    if M.AllowedFolderColors[raw] then return raw end
    return nil
end

function M.ValidateFolderId(raw)
    if type(raw) ~= 'string' then return nil end
    if #raw ~= 17 then return nil end
    if raw:sub(1, 7) ~= 'folder_' then return nil end
    local suffix = raw:sub(8)
    if not suffix:match('^[a-z0-9]+$') then return nil end
    return raw
end

function M.GetFeatureFlags()
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

function M.BuildEnabledApps(flags)
    local enabled = {}
    for appId, _ in pairs(M.AllowedApps) do
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

function M.EnabledList(enabledApps)
    local out = {}
    for appId, active in pairs(enabledApps) do
        if active then out[#out + 1] = appId end
    end
    table.sort(out)
    return out
end

-- Full normalizer. Mirrors web/src/utils/folderOps.ts:normalizeLayout.
function M.NormalizeLayout(layout, enabledApps)
    enabledApps = enabledApps or M.AllowedApps
    if type(layout) ~= 'table' then
        layout = M.DefaultLayout
    end

    local rawFolders = type(layout.folders) == 'table' and layout.folders or {}
    local rawHome = type(layout.home) == 'table' and layout.home or {}
    local rawMenu = type(layout.menu) == 'table' and layout.menu or {}

    local folders = {}
    local foldersById = {}
    local usedApps = {}

    for _, f in ipairs(rawFolders) do
        if #folders >= M.MAX_FOLDERS then break end
        if type(f) == 'table' then
            local id = M.ValidateFolderId(f.id)
            if id and not foldersById[id] then
                local name = M.ValidateFolderName(f.name) or 'Folder'
                local color = M.ValidateFolderColor(f.color) or M.DefaultFolderColor
                local apps = {}
                local seen = {}
                local rawApps = type(f.apps) == 'table' and f.apps or {}
                for _, appId in ipairs(rawApps) do
                    if #apps >= M.MAX_APPS_PER_FOLDER then break end
                    if type(appId) == 'string'
                        and not seen[appId]
                        and not usedApps[appId]
                        and M.AllowedApps[appId]
                        and enabledApps[appId]
                        and not isPinned(appId)
                    then
                        apps[#apps + 1] = appId
                        seen[appId] = true
                        usedApps[appId] = true
                    end
                end

                if #apps > 0 then
                    local folder = { id = id, name = name, color = color, apps = apps }
                    folders[#folders + 1] = folder
                    foldersById[id] = folder
                end
            end
        end
    end

    local home = {}
    local menu = {}
    local homeSeen = {}

    for _, entry in ipairs(rawHome) do
        if type(entry) == 'string' and not homeSeen[entry] then
            if entry:sub(1, 7) == 'folder:' then
                local ref = entry:sub(8)
                if foldersById[ref] then
                    home[#home + 1] = entry
                    homeSeen[entry] = true
                end
            elseif M.AllowedApps[entry] and enabledApps[entry] and not usedApps[entry] then
                home[#home + 1] = entry
                homeSeen[entry] = true
                usedApps[entry] = true
            end
        end
    end

    for _, folder in ipairs(folders) do
        local ref = 'folder:' .. folder.id
        if not homeSeen[ref] then
            home[#home + 1] = ref
            homeSeen[ref] = true
        end
    end

    for _, entry in ipairs(rawMenu) do
        if type(entry) == 'string'
            and M.AllowedApps[entry]
            and enabledApps[entry]
            and not usedApps[entry]
        then
            menu[#menu + 1] = entry
            usedApps[entry] = true
        end
    end

    local defaultHomeLookup = {}
    for _, appId in ipairs(M.DefaultLayout.home) do
        defaultHomeLookup[appId] = true
    end

    for appId, _ in pairs(M.AllowedApps) do
        if enabledApps[appId] and not usedApps[appId] then
            if defaultHomeLookup[appId] then
                home[#home + 1] = appId
            else
                menu[#menu + 1] = appId
            end
            usedApps[appId] = true
        end
    end

    local pinnedSet = {}
    local orderedHome = {}
    for _, id in ipairs(M.PinnedHomeIds) do
        if enabledApps[id] then
            pinnedSet[id] = true
            orderedHome[#orderedHome + 1] = id
        end
    end
    for _, entry in ipairs(home) do
        if not pinnedSet[entry] then
            orderedHome[#orderedHome + 1] = entry
        end
    end

    local filteredMenu = {}
    for _, entry in ipairs(menu) do
        if not pinnedSet[entry] then
            filteredMenu[#filteredMenu + 1] = entry
        end
    end

    return { home = orderedHome, menu = filteredMenu, folders = folders }
end

function M.BuildReadOnlyEnabledApps()
    local enabled = {}
    for appId, active in pairs(M.ForeignReadOnlyApps) do
        if active then
            enabled[appId] = true
        end
    end
    return enabled
end

local function ReadLayoutRow(identifier)
    local row = MySQL.single.await(
        'SELECT layout_json, version FROM phone_layouts WHERE identifier = ?',
        { identifier }
    )
    if not row then return nil, 0 end
    local ok, decoded = pcall(json.decode, row.layout_json or '')
    if not ok then return nil, tonumber(row.version) or 0 end
    return decoded, tonumber(row.version) or 0
end

-- Registers layout callbacks. phone.lua injects IsPhoneReadOnly since that
-- guard depends on state (ActivePhoneContexts) owned by phone.lua.
---@param deps { Bridge: table, IsPhoneReadOnly: fun(src: integer): boolean }
function M.RegisterCallbacks(deps)
    local Bridge = deps.Bridge
    local IsPhoneReadOnly = deps.IsPhoneReadOnly

    lib.callback.register('gcphone:getAppLayout', function(source)
        local enabledApps = M.BuildEnabledApps(M.GetFeatureFlags())
        local identifier = Bridge.GetIdentifier(source)
        if not identifier then
            return { layout = M.NormalizeLayout(M.DefaultLayout, enabledApps), version = 0 }
        end

        local decoded, version = ReadLayoutRow(identifier)
        if not decoded then
            return { layout = M.NormalizeLayout(M.DefaultLayout, enabledApps), version = version }
        end

        return { layout = M.NormalizeLayout(decoded, enabledApps), version = version }
    end)

    lib.callback.register('gcphone:setAppLayout', function(source, payload)
        if IsPhoneReadOnly(source) then
            return { ok = false, reason = 'read_only' }
        end

        local now = GetGameTimer()
        local last = lastSetAt[source] or 0
        if now - last < RATE_LIMIT_MS then
            return { ok = false, reason = 'rate_limited' }
        end

        if type(payload) ~= 'table' then
            return { ok = false, reason = 'invalid_payload' }
        end

        local clientVersion = tonumber(payload.version)
        if not clientVersion or clientVersion < 0 then
            return { ok = false, reason = 'invalid_version' }
        end

        local identifier = Bridge.GetIdentifier(source)
        if not identifier then
            return { ok = false, reason = 'no_identity' }
        end

        local enabledApps = M.BuildEnabledApps(M.GetFeatureFlags())
        local normalized = M.NormalizeLayout(payload.layout, enabledApps)
        local encoded = json.encode(normalized)
        if type(encoded) ~= 'string' or #encoded > M.MAX_LAYOUT_BYTES then
            return { ok = false, reason = 'too_large' }
        end

        local currentLayout, currentVersion = ReadLayoutRow(identifier)

        if currentVersion == 0 and not currentLayout then
            local ok = pcall(function()
                MySQL.insert.await(
                    'INSERT INTO phone_layouts (identifier, layout_json, version) VALUES (?, ?, 1)',
                    { identifier, encoded }
                )
            end)
            if not ok then
                local raceLayout, raceVersion = ReadLayoutRow(identifier)
                return {
                    ok = false,
                    reason = 'version_conflict',
                    version = raceVersion,
                    layout = M.NormalizeLayout(raceLayout, enabledApps),
                }
            end
            lastSetAt[source] = now
            return { ok = true, version = 1, layout = normalized }
        end

        if clientVersion ~= currentVersion then
            return {
                ok = false,
                reason = 'version_conflict',
                version = currentVersion,
                layout = M.NormalizeLayout(currentLayout, enabledApps),
            }
        end

        local affected = MySQL.update.await(
            'UPDATE phone_layouts SET layout_json = ?, version = version + 1 WHERE identifier = ? AND version = ?',
            { encoded, identifier, clientVersion }
        )

        if not affected or affected < 1 then
            local raceLayout, raceVersion = ReadLayoutRow(identifier)
            return {
                ok = false,
                reason = 'version_conflict',
                version = raceVersion,
                layout = M.NormalizeLayout(raceLayout, enabledApps),
            }
        end

        lastSetAt[source] = now
        return { ok = true, version = clientVersion + 1, layout = normalized }
    end)

    lib.callback.register('gcphone:getWidgetLayout', function(source)
        local identifier = Bridge.GetIdentifier(source)
        if not identifier then return nil end

        local raw = MySQL.scalar.await(
            'SELECT widget_json FROM phone_layouts WHERE identifier = ?',
            { identifier }
        )

        if not raw or raw == '' then return nil end

        local ok, decoded = pcall(json.decode, raw)
        if not ok or type(decoded) ~= 'table' then return nil end
        return decoded
    end)

    lib.callback.register('gcphone:setWidgetLayout', function(source, layout)
        if IsPhoneReadOnly(source) then return false end
        local identifier = Bridge.GetIdentifier(source)
        if not identifier then return false end

        if type(layout) ~= 'table' then return false end
        local encoded = json.encode(layout)

        MySQL.update.await(
            'UPDATE phone_layouts SET widget_json = ? WHERE identifier = ?',
            { encoded, identifier }
        )

        return true
    end)
end

AddEventHandler('playerDropped', function()
    lastSetAt[source] = nil
end)

return M
