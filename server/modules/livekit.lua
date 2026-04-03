-- Native WebRTC Signaling Relay
-- Relays SDP offer/answer and ICE candidates between peers via FiveM events.
-- No external signaling server — everything goes through the FiveM server.

local Bridge = require 'server.bridge'
local Utils = require 'server.lib.utils'

local MAX_VIEWERS_PER_LIVE = 30
local MAX_SIGNAL_SIZE = 8192

-- ── Peer Session Registry ──
local PeerSessions = {}       -- [source] = { sessionId, channel }
local SessionToSource = {}    -- [sessionId] = source (reverse map for O(1) lookup)

-- ── Helpers ──

local function GetActiveCall(callId)
    local ok, calls = pcall(function()
        return exports[GetCurrentResourceName()]:GetActiveCalls()
    end)
    if not ok or not calls then return nil end
    return calls[callId]
end

local function GetSnapActiveStreams()
    local ok, mod = pcall(require, 'server.modules.snap')
    if ok and mod and mod.GetActiveStreams then
        return mod.GetActiveStreams()
    end
    return nil
end

local function IsSnapLiveOwner(liveId, source)
    local streams = GetSnapActiveStreams()
    if not streams then return false end
    local stream = streams[liveId]
    return stream and stream.source == source
end

local function IsSnapLiveViewer(liveId, source)
    local streams = GetSnapActiveStreams()
    if not streams then return false end
    local stream = streams[liveId]
    if not stream or not stream.viewers then return false end
    local identifier = Bridge.GetIdentifier(source)
    if not identifier then return false end
    return stream.viewers[identifier] ~= nil
end

local function IsNewsLiveBroadcaster(articleId, source)
    local identifier = Bridge.GetIdentifier(source)
    if not identifier then return false end
    local article = MySQL.single.await(
        'SELECT author_id FROM phone_news_articles WHERE id = ? AND is_live = 1 LIMIT 1',
        { articleId }
    )
    if not article then return false end
    local account = MySQL.single.await(
        'SELECT id FROM phone_news_accounts WHERE identifier = ? LIMIT 1',
        { identifier }
    )
    return account and account.id == article.author_id
end

local function IsNewsLiveActive(articleId)
    local article = MySQL.single.await(
        'SELECT id FROM phone_news_articles WHERE id = ? AND is_live = 1 LIMIT 1',
        { articleId }
    )
    return article ~= nil
end

local function ClearSession(source)
    local old = PeerSessions[source]
    if old and old.sessionId then
        SessionToSource[old.sessionId] = nil
    end
    PeerSessions[source] = nil
end

-- ── Session Registration ──

lib.callback.register('gcphone:peer:register', function(source, data)
    if type(data) ~= 'table' then return { success = false } end
    if Utils.HitRateLimit(source, 'peer_register', 2000, 3) then return { success = false } end

    local peerSessionId = Utils.SafeString(data.sessionId, 64)
    local channel = Utils.SafeString(data.channel, 80)
    if not peerSessionId or not channel then return { success = false } end

    ClearSession(source)

    PeerSessions[source] = { sessionId = peerSessionId, channel = channel }
    SessionToSource[peerSessionId] = source

    return { success = true }
end)

-- ── Video Call Peer Relay ──

lib.callback.register('gcphone:peer:videoReady', function(source, data)
    if type(data) ~= 'table' then return { success = false } end
    if Utils.HitRateLimit(source, 'peer_video', 2000, 2) then return { success = false } end

    local callId = tonumber(data.callId)
    local peerSessionId = Utils.SafeString(data.sessionId, 64)
    if not callId or not peerSessionId then return { success = false } end

    local call = GetActiveCall(callId)
    if not call then return { success = false } end

    local otherSource = nil
    if source == call.transmitterSrc then
        otherSource = call.receiverSrc
    elseif source == call.receiverSrc then
        otherSource = call.transmitterSrc
    end
    if not otherSource then return { success = false } end

    TriggerClientEvent('gcphone:peer:videoConnected', otherSource, { sessionId = peerSessionId })
    return { success = true }
end)

-- ── Snap Live Peer Relay ──

local SnapLivePeers = {}

lib.callback.register('gcphone:peer:snapLiveReady', function(source, data)
    if type(data) ~= 'table' then return { success = false } end
    if Utils.HitRateLimit(source, 'peer_snap_live', 2000, 3) then return { success = false } end

    local liveId = tonumber(data.liveId)
    local peerSessionId = Utils.SafeString(data.sessionId, 64)
    if not liveId or not peerSessionId then return { success = false } end

    local isOwner = IsSnapLiveOwner(liveId, source)

    if isOwner then
        SnapLivePeers[liveId] = SnapLivePeers[liveId] or { viewers = {} }
        SnapLivePeers[liveId].ownerSessionId = peerSessionId
        SnapLivePeers[liveId].ownerSource = source

        for viewerSource, viewerData in pairs(SnapLivePeers[liveId].viewers) do
            TriggerClientEvent('gcphone:peer:snapLiveConnected', viewerSource, { sessionId = peerSessionId })
            TriggerClientEvent('gcphone:peer:snapLiveConnected', source, { sessionId = viewerData.sessionId })
        end
    else
        if not IsSnapLiveViewer(liveId, source) then
            return { success = false, error = 'NOT_VIEWER' }
        end

        SnapLivePeers[liveId] = SnapLivePeers[liveId] or { viewers = {} }

        local viewerCount = 0
        for _ in pairs(SnapLivePeers[liveId].viewers) do viewerCount = viewerCount + 1 end
        if viewerCount >= MAX_VIEWERS_PER_LIVE then
            return { success = false, error = 'MAX_VIEWERS' }
        end

        SnapLivePeers[liveId].viewers[source] = { sessionId = peerSessionId }

        if SnapLivePeers[liveId].ownerSessionId then
            TriggerClientEvent('gcphone:peer:snapLiveConnected', source, { sessionId = SnapLivePeers[liveId].ownerSessionId })
        end
        if SnapLivePeers[liveId].ownerSource then
            TriggerClientEvent('gcphone:peer:snapLiveConnected', SnapLivePeers[liveId].ownerSource, { sessionId = peerSessionId })
        end
    end

    return { success = true }
end)

local function CleanupSnapLivePeer(liveId)
    SnapLivePeers[liveId] = nil
end

-- ── News Live Peer Relay ──

local NewsLivePeers = {}

lib.callback.register('gcphone:peer:newsLiveReady', function(source, data)
    if type(data) ~= 'table' then return { success = false } end
    if Utils.HitRateLimit(source, 'peer_news_live', 2000, 3) then return { success = false } end

    local articleId = tonumber(data.articleId)
    local peerSessionId = Utils.SafeString(data.sessionId, 64)
    if not articleId or not peerSessionId then return { success = false } end

    local isBroadcaster = IsNewsLiveBroadcaster(articleId, source)

    if isBroadcaster then
        NewsLivePeers[articleId] = NewsLivePeers[articleId] or { viewers = {} }
        NewsLivePeers[articleId].broadcasterSessionId = peerSessionId
        NewsLivePeers[articleId].broadcasterSource = source

        for viewerSource, viewerData in pairs(NewsLivePeers[articleId].viewers) do
            TriggerClientEvent('gcphone:peer:newsLiveConnected', viewerSource, { sessionId = peerSessionId })
            TriggerClientEvent('gcphone:peer:newsLiveConnected', source, { sessionId = viewerData.sessionId })
        end
    else
        if not IsNewsLiveActive(articleId) then
            return { success = false, error = 'NOT_LIVE' }
        end

        NewsLivePeers[articleId] = NewsLivePeers[articleId] or { viewers = {} }

        local viewerCount = 0
        for _ in pairs(NewsLivePeers[articleId].viewers) do viewerCount = viewerCount + 1 end
        if viewerCount >= MAX_VIEWERS_PER_LIVE then
            return { success = false, error = 'MAX_VIEWERS' }
        end

        NewsLivePeers[articleId].viewers[source] = { sessionId = peerSessionId }

        if NewsLivePeers[articleId].broadcasterSessionId then
            TriggerClientEvent('gcphone:peer:newsLiveConnected', source, { sessionId = NewsLivePeers[articleId].broadcasterSessionId })
        end
        if NewsLivePeers[articleId].broadcasterSource then
            TriggerClientEvent('gcphone:peer:newsLiveConnected', NewsLivePeers[articleId].broadcasterSource, { sessionId = peerSessionId })
        end
    end

    return { success = true }
end)

local function CleanupNewsLivePeer(articleId)
    NewsLivePeers[articleId] = nil
end

-- ── WebRTC Signal Relay ──

lib.callback.register('gcphone:peer:signal', function(source, data)
    if type(data) ~= 'table' then return { success = false } end
    if Utils.HitRateLimit(source, 'peer_signal', 500, 60) then return { success = false } end

    local targetPeerId = Utils.SafeString(data.targetPeerId, 64)
    local signalType = Utils.SafeString(data.type, 16)
    local signalData = Utils.SafeString(data.data, MAX_SIGNAL_SIZE)
    local fromPeerId = Utils.SafeString(data.fromPeerId, 64)
    local channel = Utils.SafeString(data.channel, 80)

    if not targetPeerId or not signalType or not signalData or not fromPeerId or not channel then
        return { success = false }
    end

    if signalType ~= 'offer' and signalType ~= 'answer' and signalType ~= 'candidate' then
        return { success = false }
    end

    local senderSession = PeerSessions[source]
    if not senderSession or senderSession.sessionId ~= fromPeerId then
        return { success = false, error = 'SESSION_MISMATCH' }
    end

    local targetSource = SessionToSource[targetPeerId]
    if not targetSource then
        return { success = false, error = 'TARGET_NOT_FOUND' }
    end

    local targetSession = PeerSessions[targetSource]
    if not targetSession or targetSession.channel ~= senderSession.channel then
        return { success = false, error = 'CHANNEL_MISMATCH' }
    end

    TriggerClientEvent('gcphone:peer:signal', targetSource, {
        type = signalType,
        data = signalData,
        fromPeerId = fromPeerId,
        channel = channel,
    })

    return { success = true }
end)

-- ── Cleanup ──

AddEventHandler('playerDropped', function()
    local src = source
    ClearSession(src)

    for liveId, data in pairs(SnapLivePeers) do
        if data.ownerSource == src then
            CleanupSnapLivePeer(liveId)
        elseif data.viewers then
            data.viewers[src] = nil
        end
    end
    for articleId, data in pairs(NewsLivePeers) do
        if data.broadcasterSource == src then
            CleanupNewsLivePeer(articleId)
        elseif data.viewers then
            data.viewers[src] = nil
        end
    end
end)

AddEventHandler('onResourceStop', function(resourceName)
    if resourceName ~= cache.resource then return end
    PeerSessions = {}
    SessionToSource = {}
    SnapLivePeers = {}
    NewsLivePeers = {}
end)

return {
    CleanupSnapLivePeer = CleanupSnapLivePeer,
    CleanupNewsLivePeer = CleanupNewsLivePeer,
}
