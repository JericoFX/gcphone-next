-- Snap live-streaming subsystem.
-- Extracted from server/modules/snap.lua (OPT-08) to reduce file size.
-- Owns ActiveStreams state and all live callbacks/event plumbing.

local Bridge = require 'server.bridge'
local Utils = require 'server.lib.utils'

local M = {}

local ActiveStreams = {}

local function SanitizeText(value, maxLength)
    return Utils.SanitizeText(value, maxLength or 2200, true)
end

local function SanitizeMediaUrl(value)
    return Utils.SanitizeMediaUrl(value, { '.png', '.jpg', '.jpeg', '.webp', '.gif', '.mp4', '.webm', '.mov', '.m3u8' }, 500)
end

local function HitRateLimit(source, key, windowMs, maxHits)
    return Utils.HitRateLimit(source, key, windowMs, maxHits)
end

local function GetRateLimitWindow(key, fallback)
    return Utils.GetRateLimitWindow(key, fallback)
end

local function GetLiveViewerCount(stream)
    if type(stream) ~= 'table' or type(stream.viewers) ~= 'table' then
        return 0
    end

    local count = 0
    for _ in pairs(stream.viewers) do
        count = count + 1
    end
    return count
end

local function TriggerLiveViewers(liveId, eventName, payload)
    local stream = ActiveStreams[liveId]
    if not stream or type(stream.viewers) ~= 'table' then return end

    local targets = {}
    for _, viewer in pairs(stream.viewers) do
        if viewer.source then
            targets[#targets + 1] = viewer.source
        end
    end
    if stream.source then
        targets[#targets + 1] = stream.source
    end

    if #targets > 0 then
        lib.triggerClientEvent(eventName, targets, payload)
    end
end

local function BroadcastLiveViewerCount(liveId)
    local stream = ActiveStreams[liveId]
    if not stream then return end

    local viewers = GetLiveViewerCount(stream)
    TriggerLiveViewers(liveId, 'gcphone:snap:liveViewersUpdated', {
        liveId = liveId,
        viewers = viewers,
    })
end

local function BuildLiveParticipantProfile(identifier, source)
    local account = identifier and MySQL.single.await(
        'SELECT username, display_name, avatar FROM phone_snap_accounts WHERE identifier = ? LIMIT 1',
        { identifier }
    ) or nil
    local username = SanitizeText(account and account.username or '', 32)
    local display = SanitizeText(account and account.display_name or Bridge.GetName(source) or username or 'Invitado', 50)
    local avatar = SanitizeMediaUrl(account and account.avatar or nil)

    return {
        authorId = identifier,
        username = username ~= '' and username or display,
        display = display ~= '' and display or username,
        avatar = avatar,
    }
end

local function PushLiveChatMessage(liveId, stream, message)
    if type(stream.messages) ~= 'table' then
        stream.messages = {}
    end

    stream.messages[#stream.messages + 1] = message
    while #stream.messages > 20 do
        table.remove(stream.messages, 1)
    end

    TriggerLiveViewers(liveId, 'gcphone:snap:liveMessage', {
        liveId = liveId,
        message = message,
    })
end

local function BroadcastLiveReaction(liveId, reaction)
    TriggerLiveViewers(liveId, 'gcphone:snap:liveReaction', {
        liveId = liveId,
        reaction = reaction,
    })
end

local function BroadcastLiveMessageRemoved(liveId, messageId)
    TriggerLiveViewers(liveId, 'gcphone:snap:liveMessageRemoved', {
        liveId = liveId,
        messageId = messageId,
    })
end

local function BroadcastLiveUserMuted(liveId, username)
    TriggerLiveViewers(liveId, 'gcphone:snap:liveUserMuted', {
        liveId = liveId,
        username = username,
    })
end

local function GetLiveChatMessages(stream)
    if type(stream) ~= 'table' or type(stream.messages) ~= 'table' then
        return {}
    end

    return stream.messages
end

local function RemoveViewerFromLive(liveId, source, identifier)
    local id = tonumber(liveId)
    if not id or id < 1 then return false end

    local stream = ActiveStreams[id]
    if not stream or type(stream.viewers) ~= 'table' then
        return false
    end

    local key = identifier or Bridge.GetIdentifier(source)
    if not key or key == '' then return false end
    if not stream.viewers[key] then return false end

    stream.viewers[key] = nil
    BroadcastLiveViewerCount(id)
    return true
end

local function RemoveViewerFromAllLives(source, identifier)
    for liveId in pairs(ActiveStreams) do
        RemoveViewerFromLive(liveId, source, identifier)
    end
end

local function GetSnapLiveAudioConfig()
    local config = Config.Snap and Config.Snap.LiveAudio or {}

    local listenDistance = tonumber(config.ListenDistance) or 25.0
    if listenDistance < 3.0 then listenDistance = 3.0 end
    if listenDistance > 80.0 then listenDistance = 80.0 end

    local minVolume = tonumber(config.MinVolume) or 0.08
    if minVolume < 0.0 then minVolume = 0.0 end
    if minVolume > 1.0 then minVolume = 1.0 end

    local maxVolume = tonumber(config.MaxVolume) or 1.0
    if maxVolume < 0.0 then maxVolume = 0.0 end
    if maxVolume > 1.0 then maxVolume = 1.0 end
    if maxVolume < minVolume then
        maxVolume = minVolume
    end

    local distanceCurve = tonumber(config.DistanceCurve) or 1.35
    if distanceCurve < 0.5 then distanceCurve = 0.5 end
    if distanceCurve > 3.0 then distanceCurve = 3.0 end

    local leaveBuffer = tonumber(config.LeaveBufferMeters) or 2.0
    if leaveBuffer < 0.0 then leaveBuffer = 0.0 end
    if leaveBuffer > 15.0 then leaveBuffer = 15.0 end

    local volumeSmoothing = tonumber(config.VolumeSmoothing) or 0.35
    if volumeSmoothing < 0.0 then volumeSmoothing = 0.0 end
    if volumeSmoothing > 1.0 then volumeSmoothing = 1.0 end

    local updateIntervalMs = tonumber(config.UpdateIntervalMs) or 220
    if updateIntervalMs < 120 then updateIntervalMs = 120 end
    if updateIntervalMs > 1500 then updateIntervalMs = 1500 end

    return {
        enabled = config.Enabled == true,
        listenDistance = listenDistance,
        leaveBuffer = leaveBuffer,
        minVolume = minVolume,
        maxVolume = maxVolume,
        distanceCurve = distanceCurve,
        volumeSmoothing = volumeSmoothing,
        useMumbleRangeClamp = config.UseMumbleRangeClamp == true,
        updateIntervalMs = math.floor(updateIntervalMs),
    }
end

function M.GetActiveStreams()
    return ActiveStreams
end

-- Called from snap.lua's playerDropped handler. Cleans up streams owned by
-- the dropped source and removes them from viewer lists.
function M.OnPlayerDropped(src, identifier)
    for liveId, stream in pairs(ActiveStreams) do
        if type(stream) == 'table' and stream.source == src then
            MySQL.update.await(
                'DELETE FROM phone_snap_posts WHERE id = ? AND is_live = 1',
                { liveId }
            )
            ActiveStreams[liveId] = nil
            TriggerClientEvent('gcphone:snap:liveEnded', -1, liveId)
        end
    end

    RemoveViewerFromAllLives(src, identifier)
end

---@param deps { GetAccount: fun(identifier: string): table|nil }
function M.RegisterCallbacks(deps)
    local GetAccount = deps.GetAccount

    lib.callback.register('gcphone:snap:startLive', function(source)
        local identifier = Bridge.GetIdentifier(source)
        if not identifier then
            print('[gcphone:snap] startLive failed: no identifier for source ' .. tostring(source))
            return false, 'NO_IDENTIFIER'
        end

        local account = GetAccount(identifier)
        if not account then
            print('[gcphone:snap] startLive failed: no snap account for ' .. identifier)
            return false, 'NO_ACCOUNT'
        end

        local snapMs = GetRateLimitWindow('snap', 1500)
        if HitRateLimit(source, 'snap_live', snapMs, 1) then
            return false, 'RATE_LIMITED'
        end

        for liveId, stream in pairs(ActiveStreams) do
            if stream.identifier == identifier then
                print('[gcphone:snap] startLive failed: player already has active stream #' .. tostring(liveId))
                return false, 'ALREADY_STREAMING'
            end
        end

        local postId = MySQL.insert.await(
            'INSERT INTO phone_snap_posts (account_id, media_url, media_type, caption, is_live, live_viewers) VALUES (?, ?, ?, ?, 1, 0)',
            { account.id, '', 'video', 'Live Stream' }
        )

        if not postId then
            print('[gcphone:snap] startLive failed: DB insert returned nil')
            return false, 'DB_ERROR'
        end

        ActiveStreams[postId] = {
            source = source,
            accountId = account.id,
            identifier = identifier,
            startTime = os.time(),
            viewers = {},
            messages = {},
            mutedUsers = {},
            sequence = 0,
        }

        local post = MySQL.single.await([[
            SELECT p.*, a.username, a.display_name, a.avatar
            FROM phone_snap_posts p
            JOIN phone_snap_accounts a ON p.account_id = a.id
            WHERE p.id = ?
        ]], { postId })

        TriggerClientEvent('gcphone:snap:liveStarted', -1, post)
        print(('[gcphone:snap] Live #%d started by %s (%s)'):format(postId, account.username or '?', identifier))

        return true, { postId = postId, stream = ActiveStreams[postId] }
    end)

    lib.callback.register('gcphone:snap:endLive', function(source, postId)
        local identifier = Bridge.GetIdentifier(source)
        if not identifier then return false end

        local id = tonumber(postId)
        if not id or id < 1 then return false end

        -- Ownership must be verified for every call, including the case where
        -- the in-memory stream has been evicted (restart, crash, race). Trusting
        -- the in-memory absence previously let any caller hard-delete a row
        -- that was still flagged is_live = 1 in the DB.
        local stream = ActiveStreams[id]
        if stream then
            if stream.identifier ~= identifier then return false end
        else
            local owner = MySQL.scalar.await([[
                SELECT a.identifier
                FROM phone_snap_posts p
                JOIN phone_snap_accounts a ON p.account_id = a.id
                WHERE p.id = ? AND p.is_live = 1 LIMIT 1
            ]], { id })
            if not owner or owner ~= identifier then return false end
        end

        MySQL.update.await(
            'DELETE FROM phone_snap_posts WHERE id = ? AND is_live = 1',
            { id }
        )

        ActiveStreams[id] = nil

        TriggerClientEvent('gcphone:snap:liveEnded', -1, id)

        return true
    end)

    lib.callback.register('gcphone:snap:getLiveStreams', function(source)
        return MySQL.query.await([[
            SELECT p.*, a.username, a.display_name, a.avatar
            FROM phone_snap_posts p
            JOIN phone_snap_accounts a ON p.account_id = a.id
            WHERE p.is_live = 1
            ORDER BY p.live_viewers DESC
        ]]) or {}
    end)

    lib.callback.register('gcphone:snap:joinLive', function(source, data)
        local identifier = Bridge.GetIdentifier(source)
        if not identifier then return false, 'MISSING_IDENTIFIER' end
        if type(data) ~= 'table' then return false, 'INVALID_PAYLOAD' end
        if HitRateLimit(source, 'snap_live_join', 1000, 4) then return false, 'RATE_LIMITED' end

        local liveId = tonumber(data.liveId)
        if not liveId or liveId < 1 then return false, 'INVALID_LIVE' end

        local stream = ActiveStreams[liveId]
        if not stream then return false, 'LIVE_UNAVAILABLE' end
        if stream.identifier == identifier then
            return true, { liveId = liveId, viewers = GetLiveViewerCount(stream), messages = GetLiveChatMessages(stream) }
        end

        if not GetPlayerName(stream.source) then
            return false, 'HOST_OFFLINE'
        end

        local liveStillActive = MySQL.scalar.await(
            'SELECT 1 FROM phone_snap_posts WHERE id = ? AND is_live = 1 LIMIT 1',
            { liveId }
        )
        if not liveStillActive then
            return false, 'LIVE_ENDED'
        end

        stream.viewers[identifier] = {
            source = source,
            joinedAt = os.time(),
        }
        BroadcastLiveViewerCount(liveId)

        return true, { liveId = liveId, viewers = GetLiveViewerCount(stream), messages = GetLiveChatMessages(stream) }
    end)

    lib.callback.register('gcphone:snap:leaveLive', function(source, data)
        if HitRateLimit(source, 'snap_live_leave', 750, 4) then return false, 'RATE_LIMITED' end

        local liveId = tonumber(type(data) == 'table' and data.liveId or data)
        if liveId and liveId > 0 then
            RemoveViewerFromLive(liveId, source)
            return true
        end

        RemoveViewerFromAllLives(source)
        return true
    end)

    lib.callback.register('gcphone:snap:joinLiveChat', function(source, data)
        local identifier = Bridge.GetIdentifier(source)
        if not identifier then
            print('[gcphone:snap] joinLiveChat failed: NO_IDENTIFIER')
            return { success = false, error = 'NO_IDENTIFIER' }
        end

        local liveId = tonumber(type(data) == 'table' and data.liveId or nil)
        if not liveId then
            print(('[gcphone:snap] joinLiveChat failed: INVALID_LIVE, data=%s'):format(json.encode(data)))
            return { success = false, error = 'INVALID_LIVE' }
        end

        local stream = ActiveStreams[liveId]
        if not stream then
            print(('[gcphone:snap] joinLiveChat failed: LIVE_NOT_FOUND liveId=%d, activeStreams=%s'):format(liveId, json.encode(ActiveStreams)))
            return { success = false, error = 'LIVE_NOT_FOUND' }
        end

        stream.viewers[identifier] = { source = source, joinedAt = os.time() }
        BroadcastLiveViewerCount(liveId)

        return {
            success = true,
            viewers = GetLiveViewerCount(stream),
            messages = GetLiveChatMessages(stream),
        }
    end)

    lib.callback.register('gcphone:snap:leaveLiveChat', function(source, data)
        local identifier = Bridge.GetIdentifier(source)
        if not identifier then return end

        local liveId = tonumber(type(data) == 'table' and data.liveId or nil)
        if not liveId then return end

        local stream = ActiveStreams[liveId]
        if not stream then return end

        stream.viewers[identifier] = nil
        BroadcastLiveViewerCount(liveId)
    end)

    lib.callback.register('gcphone:snap:sendLiveMessage', function(source, data)
        local identifier = Bridge.GetIdentifier(source)
        if not identifier then return false, 'MISSING_IDENTIFIER' end
        if type(data) ~= 'table' then return false, 'INVALID_PAYLOAD' end
        if HitRateLimit(source, 'snap_live_message', 1200, 6) then return false, 'RATE_LIMITED' end

        local liveId = tonumber(data.liveId)
        if not liveId or liveId < 1 then return false, 'INVALID_LIVE' end

        local stream = ActiveStreams[liveId]
        if not stream then return false, 'LIVE_UNAVAILABLE' end
        if stream.identifier ~= identifier and not stream.viewers[identifier] then
            return false, 'LIVE_UNAVAILABLE'
        end
        if stream.identifier ~= identifier and stream.mutedUsers and stream.mutedUsers[identifier] then
            return false, 'MUTED'
        end

        local content = SanitizeText(data.content, 180)
        if content == '' then return false, 'INVALID_MESSAGE' end

        stream.sequence = tonumber(stream.sequence or 0) + 1
        local profile = BuildLiveParticipantProfile(identifier, source)
        local message = {
            id = string.format('%d:%d', liveId, stream.sequence),
            liveId = tostring(liveId),
            authorId = profile.authorId,
            username = profile.username,
            display = profile.display,
            avatar = profile.avatar,
            content = content,
            isMention = false,
            createdAt = os.time() * 1000,
        }

        PushLiveChatMessage(liveId, stream, message)
        return true, { message = message }
    end)

    lib.callback.register('gcphone:snap:sendLiveReaction', function(source, data)
        local identifier = Bridge.GetIdentifier(source)
        if not identifier then return false, 'MISSING_IDENTIFIER' end
        if type(data) ~= 'table' then return false, 'INVALID_PAYLOAD' end
        if HitRateLimit(source, 'snap_live_reaction', 900, 8) then return false, 'RATE_LIMITED' end

        local liveId = tonumber(data.liveId)
        if not liveId or liveId < 1 then return false, 'INVALID_LIVE' end

        local stream = ActiveStreams[liveId]
        if not stream then return false, 'LIVE_UNAVAILABLE' end
        if stream.identifier ~= identifier and not stream.viewers[identifier] then
            return false, 'LIVE_UNAVAILABLE'
        end

        local emoji = SanitizeText(data.reaction, 8)
        if emoji == '' then return false, 'INVALID_REACTION' end

        local profile = BuildLiveParticipantProfile(identifier, source)
        local reaction = {
            id = string.format('%d:%d:%d', liveId, os.time(), math.random(100, 999)),
            liveId = tostring(liveId),
            reaction = emoji,
            username = profile.username,
            avatar = profile.avatar,
            createdAt = os.time() * 1000,
        }

        BroadcastLiveReaction(liveId, reaction)
        return true, { reaction = reaction }
    end)

    lib.callback.register('gcphone:snap:removeLiveMessage', function(source, data)
        local identifier = Bridge.GetIdentifier(source)
        if not identifier then return false, 'MISSING_IDENTIFIER' end
        if type(data) ~= 'table' then return false, 'INVALID_PAYLOAD' end
        if HitRateLimit(source, 'snap_live_moderation', 1000, 5) then return false, 'RATE_LIMITED' end

        local liveId = tonumber(data.liveId)
        local messageId = SanitizeText(data.messageId, 80)
        if not liveId or liveId < 1 or messageId == '' then return false, 'INVALID_MESSAGE' end

        local stream = ActiveStreams[liveId]
        if not stream or stream.identifier ~= identifier or type(stream.messages) ~= 'table' then
            return false, 'NOT_ALLOWED'
        end

        for index, message in ipairs(stream.messages) do
            if tostring(message.id or '') == messageId then
                table.remove(stream.messages, index)
                BroadcastLiveMessageRemoved(liveId, messageId)
                return true
            end
        end

        return false, 'MESSAGE_NOT_FOUND'
    end)

    lib.callback.register('gcphone:snap:muteLiveUser', function(source, data)
        local identifier = Bridge.GetIdentifier(source)
        if not identifier then return false, 'MISSING_IDENTIFIER' end
        if type(data) ~= 'table' then return false, 'INVALID_PAYLOAD' end
        if HitRateLimit(source, 'snap_live_moderation', 1000, 5) then return false, 'RATE_LIMITED' end

        local liveId = tonumber(data.liveId)
        local targetIdentifier = SanitizeText(data.targetIdentifier, 80)
        local username = SanitizeText(data.username, 40)
        if not liveId or liveId < 1 or targetIdentifier == '' or username == '' then return false, 'INVALID_USER' end

        local stream = ActiveStreams[liveId]
        if not stream or stream.identifier ~= identifier then
            return false, 'NOT_ALLOWED'
        end

        if targetIdentifier == identifier then
            return false, 'INVALID_USER'
        end

        stream.mutedUsers[targetIdentifier] = true
        BroadcastLiveUserMuted(liveId, username)
        return true
    end)

    lib.callback.register('gcphone:snap:getLiveAudioSession', function(source, data)
        if HitRateLimit(source, 'snap_live_audio_session', 1200, 8) then
            return { enabled = false, reason = 'rate_limited' }
        end

        local cfg = GetSnapLiveAudioConfig()
        if not cfg.enabled then
            return { enabled = false, reason = 'disabled' }
        end

        local identifier = Bridge.GetIdentifier(source)
        if not identifier then
            return { enabled = false, reason = 'missing_identity' }
        end

        local viewerAccount = GetAccount(identifier)
        if not viewerAccount then
            return { enabled = false, reason = 'missing_account' }
        end

        if type(data) ~= 'table' then
            return { enabled = false, reason = 'invalid_payload' }
        end

        local liveId = tonumber(data.liveId)
        if not liveId or liveId < 1 then
            return { enabled = false, reason = 'invalid_live' }
        end

        local stream = ActiveStreams[liveId]
        if not stream or type(stream.source) ~= 'number' then
            return { enabled = false, reason = 'stream_unavailable' }
        end

        if stream.source == source then
            return { enabled = false, reason = 'owner' }
        end

        if not GetPlayerName(stream.source) then
            return { enabled = false, reason = 'owner_offline' }
        end

        local liveStillActive = MySQL.scalar.await(
            'SELECT 1 FROM phone_snap_posts WHERE id = ? AND is_live = 1 LIMIT 1',
            { liveId }
        )
        if not liveStillActive then
            return { enabled = false, reason = 'stream_not_live' }
        end

        return {
            enabled = true,
            liveId = liveId,
            targetServerId = stream.source,
            listenDistance = cfg.listenDistance,
            leaveBuffer = cfg.leaveBuffer,
            minVolume = cfg.minVolume,
            maxVolume = cfg.maxVolume,
            distanceCurve = cfg.distanceCurve,
            volumeSmoothing = cfg.volumeSmoothing,
            useMumbleRangeClamp = cfg.useMumbleRangeClamp,
            updateIntervalMs = cfg.updateIntervalMs,
        }
    end)
end

return M
