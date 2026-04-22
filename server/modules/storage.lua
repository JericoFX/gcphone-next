-- Creado/Modificado por JericoFX

local Bridge = require 'server.bridge'
local Utils = require 'server.lib.utils'

local function IsHttpUrl(value)
    local url = Utils.SafeText(value, 500)
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
    local provider = Utils.SafeText(value, 32)
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
    local path = Utils.SafeText(value, 180)
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
    local encoding = Utils.SafeText(GetConvar('gcphone_storage_server_folder_encoding', tostring(cfg.Encoding or 'jpg')), 8)
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

-- ── Provider resolution (2 convars only) ──

local FIVEMANAGE_ENDPOINT = 'https://api.fivemanage.com/api/v3/file'

local function GetProvider()
    return NormalizeProvider(GetConvar('gcphone_provider', 'fivemanage'))
end

local function GetProviderToken()
    local token = GetConvar('gcphone_provider_token', '')
    return token ~= '' and token or nil
end

local function GetMediaHost()
    local host = GetConvar('gcphone_media_host', '')
    if host == '' then return nil end
    return host:gsub('/+$', '')
end

--- Build the upload config for a given media type.
--- Returns: provider, url, field, headers, successPath
local function ResolveUploadConfig(mediaType)
    local provider = GetProvider()
    local token = GetProviderToken()

    if provider == 'server_folder' then
        return provider, '', '', {}, nil
    end

    if provider == 'local' then
        local host = GetMediaHost()
        if not host then
            print('[gcphone:storage] WARNING: provider is "local" but gcphone_media_host is not set')
            return provider, '', 'file', {}, nil
        end
        return provider, host .. '/upload', 'file', {
            ['x-api-key'] = token or '',
        }, 'data.url'
    end

    if provider == 'fivemanage' then
        return provider, FIVEMANAGE_ENDPOINT, 'file', {
            ['Authorization'] = token or '',
        }, 'data.url'
    end

    if provider == 'discord' then
        -- token is the webhook URL
        return provider, token or '', 'file', {}, nil
    end

    -- custom: token is the upload URL
    return provider, token or '', 'file', {}, nil
end

--- Legacy compat wrapper
local function ResolveUploadTarget(provider)
    local p, url, field = ResolveUploadConfig()
    return p, url, field
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
    local identifier = Bridge.GetIdentifier(source)
    if not identifier then return {} end

    local provider, uploadUrl, uploadField = ResolveUploadTarget()
    local serverFolder = GetServerFolderConfig()

    return {
        provider = provider,
        uploadUrl = uploadUrl,
        uploadField = uploadField,
        customUploadUrl = uploadUrl,
        customUploadField = uploadField,
        serverFolderPath = serverFolder.path,
        serverFolderPublicUrl = serverFolder.publicBaseUrl,
        maxVideoSizeMB = tonumber((Config.Storage and Config.Storage.MaxVideoSizeMB) or 50) or 50,
        maxVideoDurationSeconds = tonumber((Config.Storage and Config.Storage.MaxVideoDurationSeconds) or 30) or 30,
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
    local identifier = Bridge.GetIdentifier(source)
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

lib.callback.register('gcphone:storage:getUploadConfig', function(source, data)
    local identifier = Bridge.GetIdentifier(source)
    if not identifier then return nil end

    local mediaType = type(data) == 'table' and data.mediaType or 'image'
    local provider, url, field, _headers, successPath = ResolveUploadConfig(mediaType)

    if provider == 'server_folder' and mediaType ~= 'image' then
        return { url = '', field = '', error = 'server_folder only supports images' }
    end

    if provider == 'fivemanage' or provider == 'local' then
        return { provider = provider, useProxy = true, field = field, successPath = successPath }
    end

    return {
        provider = provider,
        url = url,
        field = field,
        successPath = successPath,
    }
end)

lib.callback.register('gcphone:storage:proxyUpload', function(source, data)
    local identifier = Bridge.GetIdentifier(source)
    if not identifier then return { error = 'INVALID_SOURCE' } end

    if type(data) ~= 'table' or type(data.base64) ~= 'string' or data.base64 == '' then
        return { error = 'INVALID_DATA' }
    end

    if #data.base64 > 10485760 then
        return { error = 'PAYLOAD_TOO_LARGE' }
    end

    if Utils.HitRateLimit(source, 'proxyUpload', 5000, 3) then
        return { error = 'RATE_LIMITED' }
    end

    local provider = GetProvider()
    local token = GetProviderToken()

    if provider ~= 'fivemanage' and provider ~= 'local' then
        return { error = 'PROVIDER_NOT_CONFIGURED' }
    end
    if not token then
        return { error = 'PROVIDER_TOKEN_MISSING' }
    end

    -- Reject any path-traversal tokens before the filename reaches a disk-backed
    -- provider (`local`). Previously only `\r\n"\\` were stripped, leaving `/`
    -- and `..` intact so `../../etc/foo.png` could escape the upload directory.
    local rawFilename = (Utils.SafeText(data.filename or 'upload', 100) or 'upload'):gsub('[\r\n"\\]', '')
    if rawFilename:find('[/\\]') or rawFilename:find('%.%.') then
        return { error = 'INVALID_FILENAME' }
    end
    local filename = rawFilename
    local contentType = (Utils.SafeText(data.contentType or 'application/octet-stream', 60) or 'application/octet-stream'):gsub('[\r\n"\\]', '')
    if not contentType:match('^[%w]+/[%w%-%+%.]+$') then
        contentType = 'application/octet-stream'
    end

    if provider == 'local' then
        local host = GetMediaHost()
        if not host then return { error = 'MEDIA_HOST_NOT_SET' } end

        local jsonBody = json.encode({
            data = data.base64,
            mimeType = contentType,
            filename = filename,
        })

        local p = promise.new()
        PerformHttpRequest(host .. '/upload', function(statusCode, responseBody)
            if statusCode >= 200 and statusCode < 300 and responseBody then
                local ok, parsed = pcall(json.decode, responseBody)
                if ok and parsed then
                    local uploadedUrl = parsed.data and parsed.data.url or parsed.url or ''
                    p:resolve({ url = uploadedUrl })
                else
                    p:resolve({ error = 'PARSE_ERROR' })
                end
            else
                p:resolve({ error = 'UPLOAD_FAILED_' .. tostring(statusCode) })
            end
        end, 'POST', jsonBody, {
            ['x-api-key'] = token,
            ['Content-Type'] = 'application/json',
        })

        return Citizen.Await(p)
    end

    -- Fivemanage: multipart upload
    local boundary = 'gcphone' .. tostring(os.time()) .. tostring(math.random(100000, 999999))
    local decoded = data.base64

    local body = '--' .. boundary .. '\r\n'
        .. 'Content-Disposition: form-data; name="file"; filename="' .. filename .. '"\r\n'
        .. 'Content-Type: ' .. contentType .. '\r\n'
        .. 'Content-Transfer-Encoding: base64\r\n\r\n'
        .. decoded .. '\r\n'
        .. '--' .. boundary .. '--\r\n'

    local p = promise.new()
    PerformHttpRequest(FIVEMANAGE_ENDPOINT, function(statusCode, responseBody)
        if statusCode >= 200 and statusCode < 300 and responseBody then
            local ok, parsed = pcall(json.decode, responseBody)
            if ok and parsed then
                local uploadedUrl = parsed.data and parsed.data.url or parsed.url or ''
                p:resolve({ url = uploadedUrl })
            else
                p:resolve({ error = 'PARSE_ERROR' })
            end
        else
            p:resolve({ error = 'UPLOAD_FAILED_' .. tostring(statusCode) })
        end
    end, 'POST', body, {
        ['Authorization'] = token,
        ['Content-Type'] = 'multipart/form-data; boundary=' .. boundary,
    })

    return Citizen.Await(p)
end)

lib.callback.register('gcphone:storage:capturePhoto', function(source)
    local identifier = Bridge.GetIdentifier(source)
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

return {}
