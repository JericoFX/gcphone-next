-- Creado/Modificado por JericoFX

local Bridge = require 'server.bridge'
local Phone = require 'server.modules.phone'
local Utils = require 'server.lib.utils'

local function SafeString(value, maxLen)
    return Utils.SafeString(value, maxLen)
end

local function RequirePlayerIdentifier(source)
    local src = tonumber(source)
    if not src or src <= 0 then return nil end
    if not Bridge.GetPlayer(src) then return nil end
    if not Bridge.IsPlayerActionAllowed(src) then return nil end
    return Bridge.GetIdentifier(src)
end

local function SanitizeText(value, maxLen)
    return Utils.SanitizeText(value, maxLen, true)
end

local function HitRateLimit(source, key, windowMs, maxHits)
    return Utils.HitRateLimit(source, key, windowMs, maxHits)
end

local VALID_CATEGORIES = {
    music = true,
    news = true,
    talk = true,
    emergency = true,
    community = true,
    other = true,
}

local ForcePrivate = GetConvar('gcphone_music_force_private', 'false') == 'true'
local RadioMusicPositionTimer = nil

local ActiveStations = {}
local NextStationId = 0

local function NextId()
    NextStationId = NextStationId + 1
    if NextStationId > 2147483000 then
        NextStationId = 1
    end
    return NextStationId
end

local function GetStationByHost(source)
    for id, station in pairs(ActiveStations) do
        if station.hostSource == source then
            return id, station
        end
    end
    return nil, nil
end

local function GetStationByListener(source)
    for id, station in pairs(ActiveStations) do
        if station.listeners[source] then
            return id, station
        end
    end
    return nil, nil
end

local function CountListeners(station)
    local count = 0
    for _ in pairs(station.listeners) do
        count = count + 1
    end
    return count
end

local function ClampNumber(value, minValue, maxValue, fallback)
    local num = tonumber(value)
    if not num then return fallback end
    if minValue and num < minValue then num = minValue end
    if maxValue and num > maxValue then num = maxValue end
    return num
end

local function EnsureOliSoundReady()
    return GetResourceState('olisound') == 'started'
end

local function BuildRadioSoundName(stationId)
    return 'gcphone_radio_' .. tostring(stationId)
end

local function BuildYoutubeWatchUrl(videoId)
    return 'https://www.youtube.com/watch?v=' .. videoId
end

local function GetPlayerCoords(source)
    local ped = GetPlayerPed(source)
    if not ped or ped <= 0 then return nil end
    return GetEntityCoords(ped)
end

local function MuteForStreamerPlayers(soundName)
    local streamers = Phone.StreamerModePlayers
    if not streamers then return end
    for src in pairs(streamers) do
        exports['olisound']:Destroy(src, soundName)
    end
end

local function DestroyRadioMusic(stationId)
    local station = ActiveStations[stationId]
    if not station or not station.music then return end
    if not station.music.isPlaying then return end
    if EnsureOliSoundReady() then
        local target = station.music.private and station.hostSource or -1
        exports['olisound']:Destroy(target, station.music.soundName)
    end
    station.music.isPlaying = false
    station.music.videoId = ''
    station.music.title = ''
    station.music.private = false
end

local function BuildStationList()
    local list = {}
    for id, station in pairs(ActiveStations) do
        list[#list + 1] = {
            id = id,
            hostName = station.hostName,
            stationName = station.stationName,
            description = station.description,
            category = station.category,
            livekitRoom = station.livekitRoom,
            listenerCount = CountListeners(station),
            createdAt = station.createdAt,
        }
    end
    return list
end

local function BuildStationInfo(station)
    if not station then return nil end
    return {
        id = station.id,
        hostName = station.hostName,
        stationName = station.stationName,
        description = station.description,
        category = station.category,
        livekitRoom = station.livekitRoom,
        listenerCount = CountListeners(station),
        createdAt = station.createdAt,
        music = station.music and {
            title = station.music.title or '',
            isPlaying = station.music.isPlaying or false,
        } or nil,
    }
end

lib.callback.register('gcphone:radio:getStations', function(source)
    return BuildStationList()
end)

lib.callback.register('gcphone:radio:createStation', function(source, data)
    if Phone.IsPhoneReadOnly(source) then
        return { success = false, error = 'READ_ONLY' }
    end

    if HitRateLimit(source, 'radio_create', 3000, 1) then
        return { success = false, error = 'RATE_LIMITED' }
    end

    local identifier = Bridge.GetIdentifier(source)
    if not identifier then
        return { success = false, error = 'INVALID_SOURCE' }
    end

    if type(data) ~= 'table' then
        return { success = false, error = 'INVALID_DATA' }
    end

    -- Check if already hosting
    local existingId = GetStationByHost(source)
    if existingId then
        return { success = false, error = 'ALREADY_HOSTING' }
    end

    local stationName = SanitizeText(data.stationName, 60)
    if not stationName or stationName == '' then
        return { success = false, error = 'INVALID_NAME' }
    end

    local description = SanitizeText(data.description, 200) or ''
    local category = SafeString(data.category, 20)
    if not category or not VALID_CATEGORIES[category] then
        category = 'other'
    end

    local hostName = SafeString(Bridge.GetName(source) or ('Player-' .. tostring(source)), 64) or 'Unknown'

    local stationId = NextId()
    local livekitRoom = 'radio-' .. tostring(stationId)

    ActiveStations[stationId] = {
        id = stationId,
        hostSource = source,
        hostIdentifier = identifier,
        hostName = hostName,
        stationName = stationName,
        description = description,
        category = category,
        livekitRoom = livekitRoom,
        listeners = {},
        createdAt = os.time(),
        music = {
            soundName = BuildRadioSoundName(stationId),
            videoId = '',
            title = '',
            volume = 0.5,
            distance = 25.0,
            isPlaying = false,
        },
    }

    return {
        success = true,
        station = BuildStationInfo(ActiveStations[stationId]),
    }
end)

lib.callback.register('gcphone:radio:joinStation', function(source, data)
    if type(data) ~= 'table' then
        return { success = false, error = 'INVALID_DATA' }
    end

    local stationId = tonumber(data.stationId)
    if not stationId then
        return { success = false, error = 'INVALID_STATION' }
    end

    local station = ActiveStations[stationId]
    if not station then
        return { success = false, error = 'STATION_NOT_FOUND' }
    end

    -- Cannot join own station as listener
    if station.hostSource == source then
        return { success = false, error = 'IS_HOST' }
    end

    -- Remove from any other station first
    local prevId = GetStationByListener(source)
    if prevId and ActiveStations[prevId] then
        ActiveStations[prevId].listeners[source] = nil
    end

    station.listeners[source] = true

    return {
        success = true,
        station = BuildStationInfo(station),
    }
end)

lib.callback.register('gcphone:radio:leaveStation', function(source, data)
    if type(data) ~= 'table' then
        return { success = false, error = 'INVALID_DATA' }
    end

    local stationId = tonumber(data.stationId)
    if not stationId then
        return { success = false, error = 'INVALID_STATION' }
    end

    local station = ActiveStations[stationId]
    if not station then
        return { success = false, error = 'STATION_NOT_FOUND' }
    end

    station.listeners[source] = nil

    return { success = true }
end)

lib.callback.register('gcphone:radio:endStation', function(source, data)
    if type(data) ~= 'table' then
        return { success = false, error = 'INVALID_DATA' }
    end

    local stationId = tonumber(data.stationId)
    if not stationId then
        return { success = false, error = 'INVALID_STATION' }
    end

    local station = ActiveStations[stationId]
    if not station then
        return { success = false, error = 'STATION_NOT_FOUND' }
    end

    if station.hostSource ~= source then
        return { success = false, error = 'NOT_HOST' }
    end

    -- Notify all listeners
    for listenerSrc in pairs(station.listeners) do
        TriggerClientEvent('gcphone:radio:stationEnded', listenerSrc, stationId)
    end

    DestroyRadioMusic(stationId)
    ActiveStations[stationId] = nil

    return { success = true }
end)

lib.callback.register('gcphone:radio:getStationInfo', function(source, data)
    if type(data) ~= 'table' then
        return nil
    end

    local stationId = tonumber(data.stationId)
    if not stationId then
        return nil
    end

    local station = ActiveStations[stationId]
    if not station then
        return nil
    end

    return BuildStationInfo(station)
end)

lib.callback.register('gcphone:radio:searchMusic', function(source, data)
    if type(data) ~= 'table' then
        return { success = false, error = 'INVALID_DATA', results = {} }
    end

    local stationId = tonumber(data.stationId)
    if not stationId then
        return { success = false, error = 'INVALID_STATION', results = {} }
    end

    local station = ActiveStations[stationId]
    if not station or station.hostSource ~= source then
        return { success = false, error = 'NOT_HOST', results = {} }
    end

    if HitRateLimit(source, 'radio_search', 500, 1) then
        return { success = false, error = 'RATE_LIMITED', results = {} }
    end

    local query = SafeString(data.query, 80)
    if not query or query == '' then
        return { success = true, results = {} }
    end

    local maxResults = 8
    local raw = exports[cache.resource]:youtubeSearch(query, maxResults)
    if type(raw) ~= 'string' or raw == '' then
        return { success = false, error = 'SEARCH_FAILED', results = {} }
    end

    local ok, payload = pcall(json.decode, raw)
    if not ok or type(payload) ~= 'table' then
        return { success = false, error = 'SEARCH_FAILED', results = {} }
    end

    return payload
end)

lib.callback.register('gcphone:radio:playMusic', function(source, data)
    if type(data) ~= 'table' then
        return { success = false, error = 'INVALID_DATA' }
    end

    local stationId = tonumber(data.stationId)
    if not stationId then
        return { success = false, error = 'INVALID_STATION' }
    end

    local station = ActiveStations[stationId]
    if not station or station.hostSource ~= source then
        return { success = false, error = 'NOT_HOST' }
    end

    if not EnsureOliSoundReady() then
        return { success = false, error = 'OLISOUND_NOT_STARTED' }
    end

    local videoId = type(data.videoId) == 'string' and data.videoId:match('^[%w%-_]+$') or nil
    if not videoId or #videoId < 8 or #videoId > 16 then
        return { success = false, error = 'INVALID_VIDEO' }
    end

    local title = SafeString(data.title, 160) or ''
    local volume = ClampNumber(data.volume, 0.0, 1.0, 0.5)
    local distance = ClampNumber(data.distance, 5.0, 50.0, 25.0)

    -- Destroy previous music if any
    DestroyRadioMusic(stationId)

    local coords = GetPlayerCoords(station.hostSource)
    if not coords then
        return { success = false, error = 'INVALID_POSITION' }
    end

    local soundName = station.music.soundName
    local youtubeUrl = BuildYoutubeWatchUrl(videoId)
    local isPrivate = ForcePrivate or (data.private == true)

    if isPrivate then
        exports['olisound']:PlayUrl(source, soundName, youtubeUrl, volume, false)
    else
        exports['olisound']:PlayUrlPos(-1, soundName, youtubeUrl, volume, coords, false)
        exports['olisound']:Distance(-1, soundName, distance)
        MuteForStreamerPlayers(soundName)
    end
    exports['olisound']:setVolumeMax(isPrivate and source or -1, soundName, volume)

    station.music.videoId = videoId
    station.music.title = title
    station.music.volume = volume
    station.music.distance = distance
    station.music.isPlaying = true
    station.music.private = isPrivate

    -- Notify listeners
    for listenerSrc in pairs(station.listeners) do
        TriggerClientEvent('gcphone:radio:musicUpdate', listenerSrc, {
            stationId = stationId,
            title = title,
            isPlaying = true,
        })
    end

    return { success = true, title = title, isPlaying = true }
end)

lib.callback.register('gcphone:radio:stopMusic', function(source, data)
    if type(data) ~= 'table' then
        return { success = false, error = 'INVALID_DATA' }
    end

    local stationId = tonumber(data.stationId)
    if not stationId then
        return { success = false, error = 'INVALID_STATION' }
    end

    local station = ActiveStations[stationId]
    if not station or station.hostSource ~= source then
        return { success = false, error = 'NOT_HOST' }
    end

    DestroyRadioMusic(stationId)

    -- Notify listeners
    for listenerSrc in pairs(station.listeners) do
        TriggerClientEvent('gcphone:radio:musicUpdate', listenerSrc, {
            stationId = stationId,
            title = '',
            isPlaying = false,
        })
    end

    return { success = true }
end)

lib.callback.register('gcphone:radio:setMusicVolume', function(source, data)
    if type(data) ~= 'table' then
        return { success = false, error = 'INVALID_DATA' }
    end

    local stationId = tonumber(data.stationId)
    if not stationId then
        return { success = false, error = 'INVALID_STATION' }
    end

    local station = ActiveStations[stationId]
    if not station or station.hostSource ~= source then
        return { success = false, error = 'NOT_HOST' }
    end

    if not station.music or not station.music.isPlaying then
        return { success = false, error = 'NO_MUSIC' }
    end

    if not EnsureOliSoundReady() then
        return { success = false, error = 'OLISOUND_NOT_STARTED' }
    end

    local volume = ClampNumber(data.volume, 0.0, 1.0, station.music.volume)
    local distance = ClampNumber(data.distance, 5.0, 50.0, station.music.distance)

    station.music.volume = volume
    station.music.distance = distance

    local target = station.music.private and source or -1
    exports['olisound']:setVolumeMax(target, station.music.soundName, volume)
    if not station.music.private then
        exports['olisound']:Distance(-1, station.music.soundName, distance)
    end

    return { success = true, volume = volume, distance = distance }
end)

local function UpdateRadioMusicPositions()
    if not EnsureOliSoundReady() then return end
    for id, station in pairs(ActiveStations) do
        if station.music and station.music.isPlaying then
            local srcNum = tonumber(station.hostSource)
            if not srcNum or GetPlayerName(srcNum) == nil then
                DestroyRadioMusic(id)
            elseif not station.music.private then
                local coords = GetPlayerCoords(srcNum)
                if coords then
                    exports['olisound']:Position(-1, station.music.soundName, coords)
                    MuteForStreamerPlayers(station.music.soundName)
                end
            end
        end
    end
end

local function ScheduleRadioMusicPositionUpdate()
    RadioMusicPositionTimer = lib.timer(300, function()
        UpdateRadioMusicPositions()
        ScheduleRadioMusicPositionUpdate()
    end, true)
end

ScheduleRadioMusicPositionUpdate()

AddEventHandler('playerDropped', function()
    local src = source
    for id, station in pairs(ActiveStations) do
        if station.hostSource == src then
            -- Notify listeners that station ended
            for listenerSrc in pairs(station.listeners) do
                TriggerClientEvent('gcphone:radio:stationEnded', listenerSrc, id)
            end
            DestroyRadioMusic(id)
            ActiveStations[id] = nil
        else
            -- Remove from listeners
            station.listeners[src] = nil
        end
    end
end)

AddEventHandler('onResourceStop', function(resourceName)
    if resourceName ~= cache.resource or not RadioMusicPositionTimer then return end
    RadioMusicPositionTimer:forceEnd(false)
end)

-- ── Playlist callbacks ──

lib.callback.register('gcphone:radio:savePlaylist', function(source, data)
    local identifier = RequirePlayerIdentifier(source)
    if not identifier then return { success = false, error = 'INVALID_SOURCE' } end
    if type(data) ~= 'table' then return { success = false, error = 'INVALID_DATA' } end

    local name = Utils.SafeString(data.name, 64)
    if not name or name == '' then return { success = false, error = 'MISSING_NAME' } end

    local songs = data.songs
    if type(songs) ~= 'table' or #songs == 0 then return { success = false, error = 'EMPTY_PLAYLIST' } end
    if #songs > 10 then return { success = false, error = 'MAX_10_SONGS' } end

    -- Validate and sanitize each song
    local sanitized = {}
    for i, song in ipairs(songs) do
        if type(song) == 'table' and type(song.videoId) == 'string' and song.videoId ~= '' then
            sanitized[#sanitized + 1] = {
                videoId = Utils.SafeString(song.videoId, 32),
                title = Utils.SafeString(song.title, 120) or 'Untitled',
                channel = Utils.SafeString(song.channel, 60) or '',
                thumbnail = Utils.SafeString(song.thumbnail, 300) or '',
            }
        end
    end

    if #sanitized == 0 then return { success = false, error = 'INVALID_SONGS' } end

    local songsJson = json.encode(sanitized)
    local expiresAt = os.date('%Y-%m-%d %H:%M:%S', os.time() + (10 * 24 * 3600)) -- 10 days

    -- Check if playlist with same name exists for this user, update it
    local existing = MySQL.single.await(
        'SELECT id FROM phone_radio_playlists WHERE identifier = ? AND name = ?',
        { identifier, name }
    )

    if existing then
        MySQL.update.await(
            'UPDATE phone_radio_playlists SET songs = ?, expires_at = ? WHERE id = ?',
            { songsJson, expiresAt, existing.id }
        )
        return { success = true, id = existing.id }
    end

    local id = MySQL.insert.await(
        'INSERT INTO phone_radio_playlists (identifier, name, songs, expires_at) VALUES (?, ?, ?, ?)',
        { identifier, name, songsJson, expiresAt }
    )

    return { success = true, id = id }
end)

lib.callback.register('gcphone:radio:getPlaylists', function(source)
    local identifier = RequirePlayerIdentifier(source)
    if not identifier then return {} end

    -- Clean expired
    MySQL.update.await('DELETE FROM phone_radio_playlists WHERE expires_at < NOW()')

    local rows = MySQL.query.await(
        'SELECT id, name, songs, created_at, expires_at FROM phone_radio_playlists WHERE identifier = ? ORDER BY created_at DESC',
        { identifier }
    ) or {}

    -- Parse songs JSON
    for _, row in ipairs(rows) do
        local ok, parsed = pcall(json.decode, row.songs)
        row.songs = ok and parsed or {}
    end

    return rows
end)

lib.callback.register('gcphone:radio:deletePlaylist', function(source, data)
    local identifier = RequirePlayerIdentifier(source)
    if not identifier then return { success = false, error = 'INVALID_SOURCE' } end
    local id = tonumber(type(data) == 'table' and data.id or nil)
    if not id then return { success = false, error = 'INVALID_ID' } end

    MySQL.update.await('DELETE FROM phone_radio_playlists WHERE id = ? AND identifier = ?', { id, identifier })
    return { success = true }
end)

-- ── Music duck/unduck callbacks ──

lib.callback.register('gcphone:radio:musicDuck', function(source, data)
    local stationId = tonumber(type(data) == 'table' and data.stationId or nil)
    if not stationId then return { success = false } end
    local station = ActiveStations[stationId]
    if not station then return { success = false } end
    if station.hostSource ~= source and not station.listeners[source] then
        return { success = false }
    end
    TriggerClientEvent('gcphone:radio:musicDucked', -1, { stationId = stationId, ducked = true })
    return { success = true }
end)

lib.callback.register('gcphone:radio:musicUnduck', function(source, data)
    local stationId = tonumber(type(data) == 'table' and data.stationId or nil)
    if not stationId then return { success = false } end
    local station = ActiveStations[stationId]
    if not station then return { success = false } end
    if station.hostSource ~= source and not station.listeners[source] then
        return { success = false }
    end
    TriggerClientEvent('gcphone:radio:musicDucked', -1, { stationId = stationId, ducked = false })
    return { success = true }
end)

return {}
