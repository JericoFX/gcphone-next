-- Creado/Modificado por JericoFX

local function SafeText(value, maxLen)
    if type(value) ~= 'string' then return nil end
    local text = value:gsub('[%z\1-\31\127]', ''):gsub('^%s+', ''):gsub('%s+$', '')
    if text == '' then return nil end
    if #text > maxLen then
        text = text:sub(1, maxLen)
    end
    return text
end

local function IsHttpUrl(value)
    local url = SafeText(value, 500)
    if not url then return nil end
    if not url:match('^https?://') then return nil end
    return url
end

local function DetectMediaType(url)
    local base = (url:match('^[^?]+') or url):lower()
    if base:match('%.mp4$') or base:match('%.webm$') or base:match('%.mov$') or base:match('%.m3u8$') then
        return 'video'
    end
    if base:match('%.png$') or base:match('%.jpe?g$') or base:match('%.webp$') or base:match('%.gif$') then
        return 'image'
    end
    return nil
end

local function NormalizeProvider(value)
    local provider = SafeText(value, 32)
    if not provider then return 'custom' end
    provider = provider:lower()
    if provider == 'direct' then provider = 'custom' end
    return provider
end

local function JoinUrl(baseUrl, filePath)
    local base = tostring(baseUrl or ''):gsub('/+$', '')
    local path = tostring(filePath or ''):gsub('^/+', '')
    if base == '' or path == '' then return '' end
    return base .. '/' .. path
end

local function CleanRelativePath(value)
    local path = SafeText(value, 180)
    if not path then return nil end
    path = path:gsub('\\', '/')
    path = path:gsub('%.%./', '')
    path = path:gsub('^/+', '')
    path = path:gsub('/+', '/')
    if path == '' then return nil end
    return path
end

local function GetServerFolderConfig()
    local cfg = Config.Storage and Config.Storage.ServerFolder or {}
    local path = CleanRelativePath(GetConvar('gcphone_storage_server_folder_path', tostring(cfg.Path or 'cache/gcphone'))) or 'cache/gcphone'
    local publicBaseUrl = IsHttpUrl(GetConvar('gcphone_storage_server_folder_public_url', tostring(cfg.PublicBaseUrl or ''))) or ''
    local encoding = SafeText(GetConvar('gcphone_storage_server_folder_encoding', tostring(cfg.Encoding or 'jpg')), 8)
    if encoding ~= 'jpg' and encoding ~= 'png' and encoding ~= 'webp' then
        encoding = 'jpg'
    end
    local quality = tonumber(GetConvar('gcphone_storage_server_folder_quality', tostring(cfg.Quality or 0.92))) or 0.92
    if quality < 0.1 then quality = 0.1 end
    if quality > 1.0 then quality = 1.0 end
    return {
        path = path,
        publicBaseUrl = publicBaseUrl,
        encoding = encoding,
        quality = quality,
    }
end

local function BuildKnownProviders()
    local configured = type(Config.Storage and Config.Storage.KnownProviders) == 'table' and Config.Storage.KnownProviders or {}
    local providers = {}

    for _, entry in ipairs(configured) do
        if type(entry) == 'table' then
            local id = NormalizeProvider(entry.id)
            local label = SafeText(entry.label, 48) or id
            local uploadUrl = IsHttpUrl(entry.uploadUrl or '') or ''
            local uploadField = SafeText(entry.uploadField or 'files[]', 32) or 'files[]'

            if id and id ~= '' then
                providers[#providers + 1] = {
                    id = id,
                    label = label,
                    uploadUrl = uploadUrl,
                    uploadField = uploadField,
                }
            end
        end
    end

    return providers
end

local function ResolveUploadTarget(provider)
    local selected = NormalizeProvider(provider or ((Config.Storage and Config.Storage.Provider) or 'custom'))

    if selected == 'server_folder' then
        return selected, '', ''
    end

    if selected == 'fivemanage' then
        local cfg = Config.Storage and Config.Storage.FiveManage or {}
        local endpoint = IsHttpUrl(GetConvar('gcphone_storage_fivemanage_url', tostring(cfg.Endpoint or '')))
        local field = SafeText(GetConvar('gcphone_storage_fivemanage_field', tostring(cfg.UploadField or 'files[]')), 32) or 'files[]'
        return selected, endpoint or '', field
    end

    if selected == 'local' then
        local known = IsHttpUrl(GetConvar('gcphone_storage_local_url', ''))
        local field = SafeText(GetConvar('gcphone_storage_local_field', 'files[]'), 32) or 'files[]'
        return selected, known or '', field
    end

    local customCfg = Config.Storage and Config.Storage.Custom or {}
    local customUrl = IsHttpUrl(GetConvar('gcphone_storage_custom_url', tostring(customCfg.UploadUrl or '')))
    local customField = SafeText(GetConvar('gcphone_storage_custom_field', tostring(customCfg.UploadField or 'files[]')), 32) or 'files[]'
    return 'custom', customUrl or '', customField
end

local function CaptureScreenshotToServerFolder(source)
    if GetResourceState('screenshot-basic') ~= 'started' then
        return nil, 'SCREENSHOT_BASIC_NOT_STARTED'
    end

    local folderCfg = GetServerFolderConfig()
    if folderCfg.publicBaseUrl == '' then
        return nil, 'SERVER_FOLDER_PUBLIC_URL_MISSING'
    end

    local extension = folderCfg.encoding == 'jpg' and 'jpg' or folderCfg.encoding
    local fileName = ('%s/%d_%d.%s'):format(folderCfg.path, os.time(), math.random(100000, 999999), extension)

    local p = promise.new()
    exports['screenshot-basic']:requestClientScreenshot(source, {
        fileName = fileName,
        encoding = folderCfg.encoding,
        quality = folderCfg.quality,
    }, function(err, _data)
        if err and err ~= false then
            p:resolve({ ok = false, error = tostring(err) })
            return
        end
        p:resolve({ ok = true, fileName = fileName })
    end)

    local result = Citizen.Await(p)
    if type(result) ~= 'table' or not result.ok then
        return nil, (type(result) == 'table' and result.error) or 'SCREENSHOT_FAILED'
    end

    local url = JoinUrl(folderCfg.publicBaseUrl, result.fileName)
    if url == '' then
        return nil, 'INVALID_PUBLIC_URL'
    end

    return url, nil
end

lib.callback.register('gcphone:getStorageConfig', function(source)
    local identifier = GetIdentifier(source)
    local selectedProvider, uploadUrl, uploadField = ResolveUploadTarget()
    local knownProviders = BuildKnownProviders()
    local serverFolder = GetServerFolderConfig()

    if not identifier then
        return {
            provider = selectedProvider,
            uploadUrl = uploadUrl,
            uploadField = uploadField,
            customUploadUrl = uploadUrl,
            customUploadField = uploadField,
            serverFolderPath = serverFolder.path,
            serverFolderPublicUrl = serverFolder.publicBaseUrl,
            knownProviders = knownProviders,
            maxVideoSizeMB = 50,
            maxVideoDurationSeconds = 60,
        }
    end

    return {
        provider = selectedProvider,
        uploadUrl = uploadUrl,
        uploadField = uploadField,
        customUploadUrl = uploadUrl,
        customUploadField = uploadField,
        serverFolderPath = serverFolder.path,
        serverFolderPublicUrl = serverFolder.publicBaseUrl,
        knownProviders = knownProviders,
        maxVideoSizeMB = tonumber((Config.Storage and Config.Storage.MaxVideoSizeMB) or 50) or 50,
        maxVideoDurationSeconds = tonumber((Config.Storage and Config.Storage.MaxVideoDurationSeconds) or 60) or 60,
    }
end)

lib.callback.register('gcphone:wavechat:getStatusMediaConfig', function(source)
    local provider, uploadUrl, _uploadField = ResolveUploadTarget()
    local serverFolder = GetServerFolderConfig()
    local providerName = tostring(provider or 'custom')
    local imageReady = false

    if providerName == 'server_folder' then
        imageReady = type(serverFolder.publicBaseUrl) == 'string' and serverFolder.publicBaseUrl ~= ''
    else
        imageReady = type(uploadUrl) == 'string' and uploadUrl ~= ''
    end

    local maxVideo = tonumber((Config.Storage and Config.Storage.MaxVideoDurationSeconds) or 10) or 10
    if maxVideo > 10 then maxVideo = 10 end
    if maxVideo < 5 then maxVideo = 5 end

    return {
        provider = providerName,
        canUploadImage = imageReady,
        canUploadVideo = imageReady,
        maxVideoDurationSeconds = maxVideo,
    }
end)

lib.callback.register('gcphone:storeMediaUrl', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false, 'INVALID_SOURCE' end
    if type(data) ~= 'table' then return false, 'INVALID_DATA' end

    local url = IsHttpUrl(data.url)
    if not url then return false, 'INVALID_URL' end

    local mediaType = DetectMediaType(url)
    if not mediaType then return false, 'UNSUPPORTED_MEDIA' end

    local id = MySQL.insert.await(
        'INSERT INTO phone_gallery (identifier, url, type) VALUES (?, ?, ?)',
        { identifier, url, mediaType }
    )

    return true, { id = id, url = url, type = mediaType }
end)

lib.callback.register('gcphone:storage:capturePhoto', function(source)
    local identifier = GetIdentifier(source)
    if not identifier then return false, 'INVALID_SOURCE' end

    local provider = NormalizeProvider((Config.Storage and Config.Storage.Provider) or 'custom')
    if provider ~= 'server_folder' then
        return false, 'PROVIDER_NOT_SERVER_FOLDER'
    end

    local photoUrl, err = CaptureScreenshotToServerFolder(source)
    if not photoUrl then
        return false, err or 'CAPTURE_FAILED'
    end

    local id = MySQL.insert.await(
        'INSERT INTO phone_gallery (identifier, url, type) VALUES (?, ?, ?)',
        { identifier, photoUrl, 'image' }
    )

    return true, { id = id, url = photoUrl, type = 'image' }
end)
