-- Creado/Modificado por JericoFX

local ActiveMusicBySource = {}
local LastMusicActionBySource = {}
local LastSearchBySource = {}

local function SafeString(value, maxLen)
    if type(value) ~= 'string' then return '' end
    local text = value:gsub('[%c]', '')
    text = text:gsub('^%s+', ''):gsub('%s+$', '')
    if maxLen and #text > maxLen then
        text = text:sub(1, maxLen)
    end
    return text
end

local function UrlEncode(str)
    return (str:gsub('([^%w%-_%.~])', function(c)
        return string.format('%%%02X', string.byte(c))
    end))
end

local function ClampNumber(value, minValue, maxValue, fallback)
    local num = tonumber(value)
    if not num then return fallback end
    if minValue and num < minValue then num = minValue end
    if maxValue and num > maxValue then num = maxValue end
    return num
end

local function IsSafeHttpUrl(value)
    if type(value) ~= 'string' then return false end
    local url = value:lower()
    if url:sub(1, 8) ~= 'https://' and url:sub(1, 7) ~= 'http://' then
        return false
    end
    if url:find('localhost', 1, true) then return false end
    if url:find('127.0.0.1', 1, true) then return false end
    if url:find('0.0.0.0', 1, true) then return false end
    return true
end

local function CanSearch(source)
    local now = GetGameTimer()
    local last = LastSearchBySource[source] or 0
    if (now - last) < 350 then
        return false
    end
    LastSearchBySource[source] = now
    return true
end

local function CanRunMusicAction(source)
    local now = GetGameTimer()
    local last = LastMusicActionBySource[source] or 0
    if (now - last) < 120 then
        return false
    end
    LastMusicActionBySource[source] = now
    return true
end

local function HttpGetJson(url)
    local p = promise.new()
    PerformHttpRequest(url, function(statusCode, body)
        if statusCode < 200 or statusCode >= 300 or type(body) ~= 'string' or body == '' then
            p:resolve(nil)
            return
        end

        local ok, payload = pcall(function()
            return json.decode(body)
        end)

        p:resolve(ok and payload or nil)
    end, 'GET', '', {
        ['Content-Type'] = 'application/json'
    })

    return Citizen.Await(p)
end

local function ExtractYoutubeVideoId(value)
    if type(value) ~= 'string' or value == '' then return nil end
    local text = value:match('^%s*(.-)%s*$')
    if not text or text == '' then return nil end

    local direct = text:match('^[%w%-_]+$')
    if direct and #direct >= 8 and #direct <= 16 then
        return direct
    end

    local watchId = text:match('[%?&]v=([%w%-_]+)')
    if watchId and #watchId >= 8 and #watchId <= 16 then
        return watchId
    end

    local shortId = text:match('youtu%.be/([%w%-_]+)')
    if shortId and #shortId >= 8 and #shortId <= 16 then
        return shortId
    end

    local embedId = text:match('/embed/([%w%-_]+)')
    if embedId and #embedId >= 8 and #embedId <= 16 then
        return embedId
    end

    return nil
end

local function GetYoutubeApiKey()
    return SafeString(GetConvar('gcphone_youtube_api_key', ''), 200)
end

local function GetPipedApiBaseUrl()
    local configured = SafeString(GetConvar('gcphone_music_piped_api_url', ''), 200)
    if configured ~= '' and IsSafeHttpUrl(configured) then
        return configured:gsub('/+$', '')
    end

    local cfgDefault = Config and Config.APIs and Config.APIs.Piped and Config.APIs.Piped.BaseUrl or ''
    cfgDefault = SafeString(cfgDefault, 200)
    if cfgDefault == '' then
        return 'https://pipedapi.kavin.rocks'
    end

    cfgDefault = cfgDefault:gsub('/+$', '')
    if cfgDefault:find('piped.video', 1, true) then
        return cfgDefault .. '/api/v1'
    end

    return cfgDefault
end

local function BuildYoutubeSearchUrl(query, maxResults)
    local apiKey = GetYoutubeApiKey()
    if apiKey == '' then return nil end

    return ('https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=%d&q=%s&key=%s')
        :format(maxResults, UrlEncode(query), UrlEncode(apiKey))
end

local function ResolveYoutubeAudioStream(videoId)
    local baseUrl = GetPipedApiBaseUrl()
    if baseUrl == '' then return nil end

    local payload = HttpGetJson(('%s/streams/%s'):format(baseUrl, UrlEncode(videoId)))
    if type(payload) ~= 'table' or type(payload.audioStreams) ~= 'table' then
        return nil
    end

    local bestUrl = nil
    local bestBitrate = -1

    for _, stream in ipairs(payload.audioStreams) do
        local streamUrl = type(stream) == 'table' and stream.url or nil
        local mimeType = type(stream) == 'table' and tostring(stream.mimeType or '') or ''
        local bitrate = tonumber(stream and stream.bitrate) or 0
        local videoOnly = stream and stream.videoOnly == true

        if streamUrl and IsSafeHttpUrl(streamUrl) and not videoOnly and mimeType:find('audio/', 1, true) then
            if bitrate > bestBitrate then
                bestBitrate = bitrate
                bestUrl = streamUrl
            end
        end
    end

    return bestUrl
end

local function EnsureXSoundReady()
    return GetResourceState('xsound') == 'started'
end

local function BuildSoundName(source)
    return 'gcphone_music_' .. tostring(source)
end

local function DestroyForSource(source)
    local current = ActiveMusicBySource[source]
    if not current then return end
    if EnsureXSoundReady() then
        exports['xsound']:Destroy(-1, current.name)
    end
    ActiveMusicBySource[source] = nil
end

local function GetPlayerCoords(source)
    local ped = GetPlayerPed(source)
    if not ped or ped <= 0 then return nil end
    return GetEntityCoords(ped)
end

local function NotifyState(source, payload)
    TriggerClientEvent('gcphone:music:setState', source, payload)
end

local function PlayForSource(source, data)
    if not EnsureXSoundReady() then
        NotifyState(source, { success = false, error = 'XSOUND_NOT_STARTED' })
        return
    end

    local volume = ClampNumber(data and data.volume, 0.0, 1.0, (Config.Music and Config.Music.DefaultVolume) or 0.15)
    local maxDistance = ClampNumber((Config.Music and Config.Music.MaxDistance), 5.0, 80.0, 30.0)
    local distance = ClampNumber(data and data.distance, 5.0, maxDistance, (Config.Music and Config.Music.DefaultDistance) or 15.0)

    local rawUrl = SafeString(type(data) == 'table' and data.url or '', 500)
    local rawVideoId = SafeString(type(data) == 'table' and data.videoId or '', 32)

    local videoId = ExtractYoutubeVideoId(rawVideoId)
    if not videoId then
        videoId = ExtractYoutubeVideoId(rawUrl)
    end

    local streamUrl = nil
    if videoId then
        streamUrl = ResolveYoutubeAudioStream(videoId)
        if not streamUrl then
            NotifyState(source, { success = false, error = 'STREAM_RESOLVE_FAILED' })
            return
        end
    else
        if not IsSafeHttpUrl(rawUrl) then
            NotifyState(source, { success = false, error = 'INVALID_URL' })
            return
        end
        streamUrl = rawUrl
    end

    local coords = GetPlayerCoords(source)
    if not coords then
        NotifyState(source, { success = false, error = 'INVALID_POSITION' })
        return
    end

    DestroyForSource(source)

    local soundName = BuildSoundName(source)

    exports['xsound']:PlayUrlPos(-1, soundName, streamUrl, volume, coords, false)
    exports['xsound']:Distance(-1, soundName, distance)
    exports['xsound']:setVolumeMax(-1, soundName, volume)

    ActiveMusicBySource[source] = {
        name = soundName,
        streamUrl = streamUrl,
        volume = volume,
        distance = distance,
        videoId = videoId,
        paused = false,
        title = SafeString(type(data) == 'table' and data.title or '', 120),
    }

    NotifyState(source, {
        success = true,
        isPlaying = true,
        isPaused = false,
        title = ActiveMusicBySource[source].title,
        videoId = videoId,
        volume = volume,
        distance = distance,
    })
end

local function SearchCatalog(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then
        return {
            success = false,
            error = 'INVALID_SOURCE',
            results = {}
        }
    end

    if not CanSearch(source) then
        return {
            success = false,
            error = 'RATE_LIMIT',
            results = {}
        }
    end

    local query = SafeString(type(data) == 'table' and data.query or '', 80)
    if query == '' then
        return {
            success = true,
            results = {}
        }
    end

    local apiKey = GetYoutubeApiKey()
    if apiKey == '' then
        return {
            success = false,
            error = 'YOUTUBE_API_KEY_MISSING',
            results = {}
        }
    end

    local maxResults = ClampNumber(type(data) == 'table' and data.limit or nil, 1, 20, (Config.Music and Config.Music.MaxResults) or 12)
    local requestUrl = BuildYoutubeSearchUrl(query, maxResults)
    if not requestUrl then
        return {
            success = false,
            error = 'INVALID_REQUEST',
            results = {}
        }
    end

    local payload = HttpGetJson(requestUrl)
    if type(payload) ~= 'table' or type(payload.items) ~= 'table' then
        return {
            success = false,
            error = 'SEARCH_FAILED',
            results = {}
        }
    end

    local out = {}
    local count = 0
    for _, item in ipairs(payload.items) do
        local id = item and item.id
        local snippet = item and item.snippet
        local videoId = type(id) == 'table' and SafeString(id.videoId or '', 32) or ''
        if videoId ~= '' and type(snippet) == 'table' then
            local thumbs = snippet.thumbnails or {}
            local thumb = (thumbs.medium and thumbs.medium.url) or (thumbs.default and thumbs.default.url) or (thumbs.high and thumbs.high.url) or ''

            count = count + 1
            out[count] = {
                videoId = videoId,
                title = SafeString(snippet.title or '', 160),
                channel = SafeString(snippet.channelTitle or '', 80),
                thumbnail = SafeString(thumb, 500),
                publishedAt = SafeString(snippet.publishedAt or '', 40),
                url = 'https://www.youtube.com/watch?v=' .. videoId,
            }
            if count >= maxResults then
                break
            end
        end
    end

    return {
        success = true,
        results = out
    }
end

lib.callback.register('gcphone:music:searchCatalog', function(source, data)
    return SearchCatalog(source, data)
end)

lib.callback.register('gcphone:music:searchITunes', function(source, data)
    return SearchCatalog(source, data)
end)

lib.callback.register('gcphone:music:canSearchCatalog', function()
    return {
        enabled = GetYoutubeApiKey() ~= ''
    }
end)

RegisterNetEvent('gcphone:music:play', function(data)
    local source = source
    if not GetIdentifier(source) then return end
    if not CanRunMusicAction(source) then return end
    if type(data) ~= 'table' then
        NotifyState(source, { success = false, error = 'INVALID_PAYLOAD' })
        return
    end
    PlayForSource(source, data)
end)

RegisterNetEvent('gcphone:music:pause', function()
    local source = source
    if not GetIdentifier(source) then return end
    if not CanRunMusicAction(source) then return end
    local current = ActiveMusicBySource[source]
    if not current or not EnsureXSoundReady() then return end
    exports['xsound']:Pause(-1, current.name)
    current.paused = true
    NotifyState(source, { success = true, isPlaying = true, isPaused = true })
end)

RegisterNetEvent('gcphone:music:resume', function()
    local source = source
    if not GetIdentifier(source) then return end
    if not CanRunMusicAction(source) then return end
    local current = ActiveMusicBySource[source]
    if not current or not EnsureXSoundReady() then return end
    exports['xsound']:Resume(-1, current.name)
    current.paused = false
    NotifyState(source, { success = true, isPlaying = true, isPaused = false })
end)

RegisterNetEvent('gcphone:music:stop', function()
    local source = source
    if not GetIdentifier(source) then return end
    if not CanRunMusicAction(source) then return end
    DestroyForSource(source)
    NotifyState(source, { success = true, isPlaying = false, isPaused = false })
end)

RegisterNetEvent('gcphone:music:setVolume', function(data)
    local source = source
    if not GetIdentifier(source) then return end
    if not CanRunMusicAction(source) then return end
    local current = ActiveMusicBySource[source]
    if not current or not EnsureXSoundReady() then return end

    local maxDistance = ClampNumber((Config.Music and Config.Music.MaxDistance), 5.0, 80.0, 30.0)
    local newVolume = ClampNumber(type(data) == 'table' and data.volume or nil, 0.0, 1.0, current.volume)
    local newDistance = ClampNumber(type(data) == 'table' and data.distance or nil, 5.0, maxDistance, current.distance)

    current.volume = newVolume
    current.distance = newDistance

    exports['xsound']:setVolumeMax(-1, current.name, newVolume)
    exports['xsound']:Distance(-1, current.name, newDistance)

    NotifyState(source, {
        success = true,
        isPlaying = true,
        isPaused = current.paused,
        volume = newVolume,
        distance = newDistance,
    })
end)

CreateThread(function()
    while true do
        local waitMs = ClampNumber((Config.Music and Config.Music.UpdatePositionInterval), 100, 2000, 300)
        Wait(waitMs)

        if EnsureXSoundReady() then
            for source, current in pairs(ActiveMusicBySource) do
                local srcNum = tonumber(source)
                if not srcNum or GetPlayerName(srcNum) == nil then
                    DestroyForSource(source)
                else
                    local coords = GetPlayerCoords(srcNum)
                    if coords then
                        exports['xsound']:Position(-1, current.name, coords)
                    end
                end
            end
        end
    end
end)

AddEventHandler('playerDropped', function()
    local source = source
    DestroyForSource(source)
    LastMusicActionBySource[source] = nil
    LastSearchBySource[source] = nil
end)
