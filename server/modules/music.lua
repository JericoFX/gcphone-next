-- Creado/Modificado por JericoFX

local ActiveMusicBySource = {}
local LastMusicActionBySource = {}
local LastSearchBySource = {}
local MusicPositionTimer = nil

local function SafeString(value, maxLen)
    if type(value) ~= 'string' then return '' end
    local text = value:gsub('[%c]', '')
    text = text:gsub('^%s+', ''):gsub('%s+$', '')
    if maxLen and #text > maxLen then
        text = text:sub(1, maxLen)
    end
    return text
end

local function ClampNumber(value, minValue, maxValue, fallback)
    local num = tonumber(value)
    if not num then return fallback end
    if minValue and num < minValue then num = minValue end
    if maxValue and num > maxValue then num = maxValue end
    return num
end

local function GetPositionUpdateIntervalMs()
    return ClampNumber((Config.Music and Config.Music.UpdatePositionInterval), 100, 2000, 300)
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

local ForcePrivate = GetConvar('gcphone_music_force_private', 'false') == 'true'

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

local function BuildYoutubeWatchUrl(videoId)
    return 'https://www.youtube.com/watch?v=' .. videoId
end

local function EnsureOliSoundReady()
    return GetResourceState('olisound') == 'started'
end

local function BuildSoundName(source)
    return 'gcphone_music_' .. tostring(source)
end

local function MuteForStreamerPlayers(soundName)
    local streamers = GCPhone and GCPhone.StreamerModePlayers
    if not streamers then return end
    for src in pairs(streamers) do
        exports['olisound']:Destroy(src, soundName)
    end
end

local function DestroyForSource(source)
    local current = ActiveMusicBySource[source]
    if not current then return end
    if EnsureOliSoundReady() then
        local target = current.private and source or -1
        exports['olisound']:Destroy(target, current.name)
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
    if not EnsureOliSoundReady() then
        NotifyState(source, { success = false, error = 'OLISOUND_NOT_STARTED' })
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
        streamUrl = BuildYoutubeWatchUrl(videoId)
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
    local isPrivate = ForcePrivate or (type(data) == 'table' and data.private == true)

    if isPrivate then
        exports['olisound']:PlayUrl(source, soundName, streamUrl, volume, false)
    else
        exports['olisound']:PlayUrlPos(-1, soundName, streamUrl, volume, coords, false)
        exports['olisound']:Distance(-1, soundName, distance)
        MuteForStreamerPlayers(soundName)
    end
    exports['olisound']:setVolumeMax(isPrivate and source or -1, soundName, volume)

    ActiveMusicBySource[source] = {
        name = soundName,
        streamUrl = streamUrl,
        volume = volume,
        distance = distance,
        videoId = videoId,
        paused = false,
        private = isPrivate,
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
        private = isPrivate,
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

    local maxResults = ClampNumber(type(data) == 'table' and data.limit or nil, 1, 20, (Config.Music and Config.Music.MaxResults) or 12)

    local raw = exports[cache.resource]:youtubeSearch(query, maxResults)
    if type(raw) ~= 'string' or raw == '' then
        return {
            success = false,
            error = 'SEARCH_FAILED',
            results = {}
        }
    end

    local ok, payload = pcall(json.decode, raw)
    if not ok or type(payload) ~= 'table' then
        return {
            success = false,
            error = 'SEARCH_FAILED',
            results = {}
        }
    end

    return payload
end

lib.callback.register('gcphone:music:searchCatalog', function(source, data)
    return SearchCatalog(source, data)
end)

lib.callback.register('gcphone:music:searchITunes', function(source, data)
    return SearchCatalog(source, data)
end)

lib.callback.register('gcphone:music:canSearchCatalog', function()
    return {
        enabled = true
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
    if not current or not EnsureOliSoundReady() then return end
    local target = current.private and source or -1
    exports['olisound']:Pause(target, current.name)
    current.paused = true
    NotifyState(source, { success = true, isPlaying = true, isPaused = true })
end)

RegisterNetEvent('gcphone:music:resume', function()
    local source = source
    if not GetIdentifier(source) then return end
    if not CanRunMusicAction(source) then return end
    local current = ActiveMusicBySource[source]
    if not current or not EnsureOliSoundReady() then return end
    local target = current.private and source or -1
    exports['olisound']:Resume(target, current.name)
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
    if not current or not EnsureOliSoundReady() then return end

    local maxDistance = ClampNumber((Config.Music and Config.Music.MaxDistance), 5.0, 80.0, 30.0)
    local newVolume = ClampNumber(type(data) == 'table' and data.volume or nil, 0.0, 1.0, current.volume)
    local newDistance = ClampNumber(type(data) == 'table' and data.distance or nil, 5.0, maxDistance, current.distance)

    current.volume = newVolume
    current.distance = newDistance

    local target = current.private and source or -1
    exports['olisound']:setVolumeMax(target, current.name, newVolume)
    if not current.private then
        exports['olisound']:Distance(-1, current.name, newDistance)
    end

    NotifyState(source, {
        success = true,
        isPlaying = true,
        isPaused = current.paused,
        volume = newVolume,
        distance = newDistance,
    })
end)

local function UpdateActiveMusicPositions()
    if EnsureOliSoundReady() then
        for source, current in pairs(ActiveMusicBySource) do
            local srcNum = tonumber(source)
            if not srcNum or GetPlayerName(srcNum) == nil then
                DestroyForSource(source)
            elseif not current.private then
                local coords = GetPlayerCoords(srcNum)
                if coords then
                    exports['olisound']:Position(-1, current.name, coords)
                    MuteForStreamerPlayers(current.name)
                end
            end
        end
    end
end

local function ScheduleMusicPositionUpdate()
    -- Verified: CommunityOX ox_lib Timer/Shared exposes lib.timer(time, onEnd, async)
    MusicPositionTimer = lib.timer(GetPositionUpdateIntervalMs(), function()
        UpdateActiveMusicPositions()
        ScheduleMusicPositionUpdate()
    end, true)
end

ScheduleMusicPositionUpdate()

AddEventHandler('playerDropped', function()
    local source = source
    DestroyForSource(source)
    LastMusicActionBySource[source] = nil
    LastSearchBySource[source] = nil
end)

AddEventHandler('onResourceStop', function(resourceName)
    if resourceName ~= cache.resource or not MusicPositionTimer then return end
    MusicPositionTimer:forceEnd(false)
end)
