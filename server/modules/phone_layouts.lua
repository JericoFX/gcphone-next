-- Phone layout helpers and callbacks.
-- Extracted from server/modules/phone.lua (OPT-07) to reduce file size.
-- Holds pure helpers; phone.lua retains ownership of read-only context state.

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
    menu = { 'appstore' }
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

function M.NormalizeLayout(layout, enabledApps)
    enabledApps = enabledApps or M.AllowedApps
    if type(layout) ~= 'table' then
        layout = M.DefaultLayout
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

    for _, appId in ipairs(M.DefaultLayout.home) do
        if enabledApps[appId] and not used[appId] then
            result.home[#result.home + 1] = appId
            used[appId] = true
        end
    end

    for _, appId in ipairs(M.DefaultLayout.menu) do
        if enabledApps[appId] and not used[appId] then
            result.menu[#result.menu + 1] = appId
            used[appId] = true
        end
    end

    return result
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

-- Registers layout callbacks. phone.lua injects IsPhoneReadOnly since that
-- guard depends on state (ActivePhoneContexts) owned by phone.lua.
---@param deps { Bridge: table, IsPhoneReadOnly: fun(src: integer): boolean }
function M.RegisterCallbacks(deps)
    local Bridge = deps.Bridge
    local IsPhoneReadOnly = deps.IsPhoneReadOnly

    lib.callback.register('gcphone:getAppLayout', function(source)
        local identifier = Bridge.GetIdentifier(source)
        local enabledApps = M.BuildEnabledApps(M.GetFeatureFlags())
        if not identifier then return M.NormalizeLayout(M.DefaultLayout, enabledApps) end

        local layoutRaw = MySQL.scalar.await(
            'SELECT layout_json FROM phone_layouts WHERE identifier = ?',
            { identifier }
        )

        if not layoutRaw or layoutRaw == '' then
            return M.NormalizeLayout(M.DefaultLayout, enabledApps)
        end

        local decoded = json.decode(layoutRaw)
        return M.NormalizeLayout(decoded, enabledApps)
    end)

    lib.callback.register('gcphone:setAppLayout', function(source, layout)
        if IsPhoneReadOnly(source) then return false end
        local identifier = Bridge.GetIdentifier(source)
        if not identifier then return false end

        local normalized = M.NormalizeLayout(layout, M.BuildEnabledApps(M.GetFeatureFlags()))
        local encoded = json.encode(normalized)

        MySQL.insert.await(
            'INSERT INTO phone_layouts (identifier, layout_json) VALUES (?, ?) ON DUPLICATE KEY UPDATE layout_json = VALUES(layout_json)',
            { identifier, encoded }
        )

        return true
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

return M
