-- Creado/Modificado por JericoFX

local function SanitizeText(value, maxLength)
    if type(value) ~= 'string' then return '' end
    local text = value:gsub('[%z\1-\31\127]', '')
    text = text:gsub('<.->', '')
    text = text:gsub('^%s+', ''):gsub('%s+$', '')
    return text:sub(1, maxLength or 2200)
end

local function SanitizeMediaUrl(value)
    if type(value) ~= 'string' then return nil end
    local url = value:gsub('[%z\1-\31\127]', '')
    url = url:gsub('^%s+', ''):gsub('%s+$', '')
    if url == '' then return nil end
    if not url:match('^https?://') then return nil end
    local base = (url:match('^[^?]+') or url):lower()
    local allowed = { '.png', '.jpg', '.jpeg', '.webp', '.gif', '.mp4', '.webm', '.mov', '.m3u8' }
    for _, ext in ipairs(allowed) do
        if base:sub(-#ext) == ext then
            return url:sub(1, 500)
        end
    end
    return nil
end

local function NormalizeMediaType(value)
    if value == 'video' then return 'video' end
    return 'image'
end

local function GetAccount(identifier)
    if not identifier then return nil end
    
    return MySQL.single.await(
        'SELECT * FROM phone_snap_accounts WHERE identifier = ?',
        { identifier }
    )
end

local function CreateAccount(identifier, username, displayName, avatar)
    MySQL.insert.await(
        'INSERT INTO phone_snap_accounts (identifier, username, display_name, avatar) VALUES (?, ?, ?, ?)',
        { identifier, username, displayName, avatar }
    )
    
    return GetAccount(identifier)
end

local function GenerateUsername(source)
    local name = GetName(source) or 'User'
    local cleanName = string.lower(string.gsub(name, '%s+', ''))
    local random = math.random(1000, 9999)
    return cleanName .. random
end

local SecurityResource = GetCurrentResourceName()

local function HitRateLimit(source, key, windowMs, maxHits)
    local ok, blocked = pcall(function()
        return exports[SecurityResource]:HitRateLimit(source, key, windowMs, maxHits)
    end)
    if not ok then return false end
    return blocked == true
end

local ActiveStreams = {}

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
        volumeSmoothing = volumeSmoothing,
        updateIntervalMs = math.floor(updateIntervalMs),
    }
end

local function RefreshFollowCounts(accountId, targetAccountId)
    if accountId then
        MySQL.update.await(
            'UPDATE phone_snap_accounts SET following = (SELECT COUNT(*) FROM phone_snap_following WHERE follower_id = ?) WHERE id = ?',
            { accountId, accountId }
        )
    end

    if targetAccountId then
        MySQL.update.await(
            'UPDATE phone_snap_accounts SET followers = (SELECT COUNT(*) FROM phone_snap_following WHERE following_id = ?) WHERE id = ?',
            { targetAccountId, targetAccountId }
        )
    end
end

local function UpsertSocialNotification(accountIdentifier, fromIdentifier, appType, notificationType, referenceId, referenceType, contentPreview)
    if not accountIdentifier or not fromIdentifier then return end

    MySQL.insert.await([[
        INSERT INTO phone_social_notifications
            (account_identifier, from_identifier, app_type, notification_type, reference_id, reference_type, content_preview)
        VALUES
            (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            is_read = 0,
            created_at = CURRENT_TIMESTAMP,
            content_preview = VALUES(content_preview)
    ]], {
        accountIdentifier,
        fromIdentifier,
        appType,
        notificationType,
        referenceId,
        referenceType,
        contentPreview,
    })
end

lib.callback.register('gcphone:snap:getAccount', function(source)
    local identifier = GetIdentifier(source)
    if not identifier then return nil end
    
    local account = GetAccount(identifier)
    
    if not account then
        local name = GetName(source) or 'User'
        local username = GenerateUsername(source)
        account = CreateAccount(identifier, username, name, nil)
    end
    
    return account
end)

lib.callback.register('gcphone:snap:updateAccount', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false end

    if type(data) ~= 'table' then return false end

    local displayName = SanitizeText(data.displayName, 50)
    local avatar = SanitizeMediaUrl(data.avatar)
    local bio = SanitizeText(data.bio, 160)
    if displayName == '' then return false end
    
    MySQL.update.await(
        'UPDATE phone_snap_accounts SET display_name = ?, avatar = ?, bio = ?, is_private = ? WHERE identifier = ?',
        { displayName, avatar, bio, data.isPrivate and 1 or 0, identifier }
    )
    
    return true
end)

lib.callback.register('gcphone:snap:getFeed', function(source, data)
    local identifier = GetIdentifier(source)

    data = type(data) == 'table' and data or {}
    local limit = tonumber(data.limit) or 30
    local offset = tonumber(data.offset) or 0
    if limit < 1 then limit = 1 end
    if limit > 100 then limit = 100 end
    if offset < 0 then offset = 0 end
    
    local posts = MySQL.query.await([[
        SELECT p.*, a.username, a.display_name, a.avatar
        FROM phone_snap_posts p
        JOIN phone_snap_accounts a ON p.account_id = a.id
        WHERE p.is_live = 0
        ORDER BY p.created_at DESC
        LIMIT ? OFFSET ?
    ]], { limit, offset }) or {}
    
    return posts
end)

lib.callback.register('gcphone:snap:getStories', function(source)
    local currentTime = os.time()
    
    return MySQL.query.await([[
        SELECT s.*, a.username, a.display_name, a.avatar
        FROM phone_snap_stories s
        JOIN phone_snap_accounts a ON s.account_id = a.id
        WHERE s.expires_at > FROM_UNIXTIME(?)
        ORDER BY s.created_at DESC
    ]], { currentTime }) or {}
end)

lib.callback.register('gcphone:snap:publishPost', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false end

    if type(data) ~= 'table' then return false end
    
    local account = GetAccount(identifier)
    if not account then return false end

    local snapMs = (Config.Security and Config.Security.RateLimits and Config.Security.RateLimits.snap) or 1500
    if HitRateLimit(source, 'snap_post', snapMs, 1) then
        return false, 'RATE_LIMITED'
    end

    local mediaUrl = SanitizeMediaUrl(data.mediaUrl)
    local mediaType = NormalizeMediaType(data.mediaType)
    local caption = SanitizeText(data.caption, 2200)
    if not mediaUrl then return false, 'Invalid media' end
    
    local postId = MySQL.insert.await(
        'INSERT INTO phone_snap_posts (account_id, media_url, media_type, caption) VALUES (?, ?, ?, ?)',
        { account.id, mediaUrl, mediaType, caption ~= '' and caption or nil }
    )
    
    local post = MySQL.single.await([[
        SELECT p.*, a.username, a.display_name, a.avatar
        FROM phone_snap_posts p
        JOIN phone_snap_accounts a ON p.account_id = a.id
        WHERE p.id = ?
    ]], { postId })
    
    TriggerClientEvent('gcphone:snap:newPost', -1, post)
    
    return true, post
end)

lib.callback.register('gcphone:snap:publishStory', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false end

    if type(data) ~= 'table' then return false end
    
    local account = GetAccount(identifier)
    if not account then return false end

    local snapMs = (Config.Security and Config.Security.RateLimits and Config.Security.RateLimits.snap) or 1500
    if HitRateLimit(source, 'snap_story', snapMs, 1) then
        return false, 'RATE_LIMITED'
    end

    local mediaUrl = SanitizeMediaUrl(data.mediaUrl)
    local mediaType = NormalizeMediaType(data.mediaType)
    if not mediaUrl then return false, 'Invalid media' end
    
    local expiresAt = os.time() + Config.Snap.StoryDuration
    
    local storyId = MySQL.insert.await(
        'INSERT INTO phone_snap_stories (account_id, media_url, media_type, expires_at) VALUES (?, ?, ?, FROM_UNIXTIME(?))',
        { account.id, mediaUrl, mediaType, expiresAt }
    )
    
    local story = MySQL.single.await([[
        SELECT s.*, a.username, a.display_name, a.avatar
        FROM phone_snap_stories s
        JOIN phone_snap_accounts a ON s.account_id = a.id
        WHERE s.id = ?
    ]], { storyId })
    
    TriggerClientEvent('gcphone:snap:newStory', -1, story)
    
    return true, story
end)

lib.callback.register('gcphone:snap:toggleLike', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false end

    if type(data) ~= 'table' then return false end
    local postId = tonumber(data.postId)
    if not postId or postId < 1 then return false end
    
    MySQL.update.await(
        'UPDATE phone_snap_posts SET likes = likes + 1 WHERE id = ?',
        { postId }
    )
    
    return true
end)

lib.callback.register('gcphone:snap:deletePost', function(source, postId)
    local identifier = GetIdentifier(source)
    if not identifier then return false end
    
    local account = GetAccount(identifier)
    if not account then return false end
    
    MySQL.execute.await(
        'DELETE FROM phone_snap_posts WHERE id = ? AND account_id = ?',
        { postId, account.id }
    )
    
    return true
end)

lib.callback.register('gcphone:snap:deleteStory', function(source, storyId)
    local identifier = GetIdentifier(source)
    if not identifier then return false end

    local account = GetAccount(identifier)
    if not account then return false end

    local id = tonumber(storyId)
    if not id then return false end

    MySQL.execute.await(
        'DELETE FROM phone_snap_stories WHERE id = ? AND account_id = ?',
        { id, account.id }
    )

    return true
end)

lib.callback.register('gcphone:snap:startLive', function(source)
    local identifier = GetIdentifier(source)
    if not identifier then return false end
    
    local account = GetAccount(identifier)
    if not account then return false end

    local snapMs = (Config.Security and Config.Security.RateLimits and Config.Security.RateLimits.snap) or 1500
    if HitRateLimit(source, 'snap_live', snapMs, 1) then
        return false, 'RATE_LIMITED'
    end
    
    local postId = MySQL.insert.await(
        'INSERT INTO phone_snap_posts (account_id, media_url, media_type, caption, is_live, live_viewers) VALUES (?, ?, ?, ?, 1, 0)',
        { account.id, '', 'video', 'Live Stream', 1, 0 }
    )
    
    ActiveStreams[postId] = {
        source = source,
        accountId = account.id,
        startTime = os.time()
    }
    
    local post = MySQL.single.await([[
        SELECT p.*, a.username, a.display_name, a.avatar
        FROM phone_snap_posts p
        JOIN phone_snap_accounts a ON p.account_id = a.id
        WHERE p.id = ?
    ]], { postId })
    
    TriggerClientEvent('gcphone:snap:liveStarted', -1, post)
    
    return true, { postId = postId, stream = ActiveStreams[postId] }
end)

lib.callback.register('gcphone:snap:endLive', function(source, postId)
    local identifier = GetIdentifier(source)
    if not identifier then return false end
    
    MySQL.execute.await(
        'DELETE FROM phone_snap_posts WHERE id = ? AND is_live = 1',
        { postId }
    )
    
    ActiveStreams[postId] = nil
    
    TriggerClientEvent('gcphone:snap:liveEnded', -1, postId)
    
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

lib.callback.register('gcphone:snap:getLiveAudioSession', function(source, data)
    local cfg = GetSnapLiveAudioConfig()
    if not cfg.enabled then
        return { enabled = false, reason = 'disabled' }
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

    return {
        enabled = true,
        liveId = liveId,
        targetServerId = stream.source,
        listenDistance = cfg.listenDistance,
        leaveBuffer = cfg.leaveBuffer,
        minVolume = cfg.minVolume,
        maxVolume = cfg.maxVolume,
        volumeSmoothing = cfg.volumeSmoothing,
        updateIntervalMs = cfg.updateIntervalMs,
    }
end)

lib.callback.register('gcphone:snap:follow', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false end

    if type(data) ~= 'table' then return false end
    local targetAccountId = tonumber(data.targetAccountId)
    if not targetAccountId or targetAccountId < 1 then return false end
    
    local account = GetAccount(identifier)
    if not account then return false end

    if account.id == targetAccountId then
        return { following = false, requested = false, error = 'self_target' }
    end

    local targetAccount = MySQL.single.await(
        'SELECT id, identifier, is_private FROM phone_snap_accounts WHERE id = ?',
        { targetAccountId }
    )
    if not targetAccount then
        return { following = false, requested = false, error = 'target_not_found' }
    end
    
    local existing = MySQL.scalar.await(
        'SELECT 1 FROM phone_snap_following WHERE follower_id = ? AND following_id = ?',
        { account.id, targetAccountId }
    )
    
    if existing then
        MySQL.execute.await(
            'DELETE FROM phone_snap_following WHERE follower_id = ? AND following_id = ?',
            { account.id, targetAccountId }
        )

        RefreshFollowCounts(account.id, targetAccountId)

        return { following = false, requested = false }
    end

    if tonumber(targetAccount.is_private) == 1 then
        local pendingRequest = MySQL.scalar.await([[
            SELECT 1
            FROM phone_friend_requests
            WHERE from_identifier = ?
              AND to_identifier = ?
              AND type = 'snap'
              AND status = 'pending'
        ]], { identifier, targetAccount.identifier })

        if pendingRequest then
            MySQL.update.await([[
                UPDATE phone_friend_requests
                SET status = 'cancelled', responded_at = CURRENT_TIMESTAMP
                WHERE from_identifier = ?
                  AND to_identifier = ?
                  AND type = 'snap'
                  AND status = 'pending'
            ]], { identifier, targetAccount.identifier })

            return { following = false, requested = false, cancelled = true }
        end

        MySQL.insert.await([[
            INSERT INTO phone_friend_requests (from_identifier, to_identifier, type, status, created_at, responded_at)
            VALUES (?, ?, 'snap', 'pending', CURRENT_TIMESTAMP, NULL)
            ON DUPLICATE KEY UPDATE
                status = 'pending',
                responded_at = NULL,
                created_at = CURRENT_TIMESTAMP
        ]], { identifier, targetAccount.identifier })

        UpsertSocialNotification(targetAccount.identifier, identifier, 'snap', 'follow_request', account.id, 'account', account.display_name)

        return { following = false, requested = true }
    end

    MySQL.insert.await(
        'INSERT IGNORE INTO phone_snap_following (follower_id, following_id) VALUES (?, ?)',
        { account.id, targetAccountId }
    )

    MySQL.update.await([[
        UPDATE phone_friend_requests
        SET status = 'accepted', responded_at = CURRENT_TIMESTAMP
        WHERE from_identifier = ?
          AND to_identifier = ?
          AND type = 'snap'
          AND status = 'pending'
    ]], { identifier, targetAccount.identifier })

    RefreshFollowCounts(account.id, targetAccountId)

    return { following = true, requested = false }
end)

lib.callback.register('gcphone:snap:getPendingFollowRequests', function(source)
    local identifier = GetIdentifier(source)
    if not identifier then return {} end

    return MySQL.query.await([[
        SELECT
            fr.id,
            fr.from_identifier,
            fr.created_at,
            a.id as account_id,
            a.username,
            a.display_name,
            a.avatar,
            a.bio,
            a.verified
        FROM phone_friend_requests fr
        JOIN phone_snap_accounts a ON a.identifier = fr.from_identifier
        WHERE fr.to_identifier = ?
          AND fr.type = 'snap'
          AND fr.status = 'pending'
        ORDER BY fr.created_at DESC
    ]], { identifier }) or {}
end)

lib.callback.register('gcphone:snap:getSentFollowRequests', function(source)
    local identifier = GetIdentifier(source)
    if not identifier then return {} end

    return MySQL.query.await([[
        SELECT
            fr.id,
            fr.to_identifier,
            fr.created_at,
            a.id as account_id,
            a.username,
            a.display_name,
            a.avatar,
            a.bio,
            a.verified
        FROM phone_friend_requests fr
        JOIN phone_snap_accounts a ON a.identifier = fr.to_identifier
        WHERE fr.from_identifier = ?
          AND fr.type = 'snap'
          AND fr.status = 'pending'
        ORDER BY fr.created_at DESC
    ]], { identifier }) or {}
end)

lib.callback.register('gcphone:snap:respondFollowRequest', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false end
    if type(data) ~= 'table' then return false end

    local requestId = tonumber(data.requestId)
    local accept = data.accept == true
    if not requestId or requestId < 1 then return false end

    local request = MySQL.single.await([[
        SELECT id, from_identifier, to_identifier
        FROM phone_friend_requests
        WHERE id = ?
          AND to_identifier = ?
          AND type = 'snap'
          AND status = 'pending'
    ]], { requestId, identifier })

    if not request then
        return false
    end

    local status = accept and 'accepted' or 'rejected'
    MySQL.update.await(
        'UPDATE phone_friend_requests SET status = ?, responded_at = CURRENT_TIMESTAMP WHERE id = ?',
        { status, request.id }
    )

    if not accept then
        return true
    end

    local targetAccount = GetAccount(identifier)
    local requesterAccount = GetAccount(request.from_identifier)
    if not targetAccount or not requesterAccount then
        return false
    end

    MySQL.insert.await(
        'INSERT IGNORE INTO phone_snap_following (follower_id, following_id) VALUES (?, ?)',
        { requesterAccount.id, targetAccount.id }
    )

    RefreshFollowCounts(requesterAccount.id, targetAccount.id)
    UpsertSocialNotification(request.from_identifier, identifier, 'snap', 'follow_accepted', targetAccount.id, 'account', targetAccount.display_name)

    return true
end)

lib.callback.register('gcphone:snap:cancelFollowRequest', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false end
    if type(data) ~= 'table' then return false end

    local targetAccountId = tonumber(data.targetAccountId)
    if not targetAccountId or targetAccountId < 1 then return false end

    local targetAccount = MySQL.single.await(
        'SELECT identifier FROM phone_snap_accounts WHERE id = ?',
        { targetAccountId }
    )
    if not targetAccount then return false end

    MySQL.update.await([[
        UPDATE phone_friend_requests
        SET status = 'cancelled', responded_at = CURRENT_TIMESTAMP
        WHERE from_identifier = ?
          AND to_identifier = ?
          AND type = 'snap'
          AND status = 'pending'
    ]], { identifier, targetAccount.identifier })

    return true
end)

lib.callback.register('gcphone:snap:getProfile', function(source, data)
    local identifier = GetIdentifier(source)
    if type(data) ~= 'table' then return nil end

    local accountId = tonumber(data.accountId)
    if not accountId or accountId < 1 then return nil end
    
    local account = MySQL.single.await(
        'SELECT * FROM phone_snap_accounts WHERE id = ?',
        { accountId }
    )
    
    if not account then return nil end
    
    local viewerAccount = identifier and GetAccount(identifier) or nil

    local isOwnProfile = viewerAccount and viewerAccount.id == account.id
    local isFollowing = false
    local requestedByMe = false
    local requestedFromThem = false

    if viewerAccount and not isOwnProfile then
        isFollowing = MySQL.scalar.await(
            'SELECT 1 FROM phone_snap_following WHERE follower_id = ? AND following_id = ? LIMIT 1',
            { viewerAccount.id, account.id }
        ) and true or false

        requestedByMe = MySQL.scalar.await([[
            SELECT 1
            FROM phone_friend_requests
            WHERE from_identifier = ?
              AND to_identifier = ?
              AND type = 'snap'
              AND status = 'pending'
            LIMIT 1
        ]], { viewerAccount.identifier, account.identifier }) and true or false

        requestedFromThem = MySQL.scalar.await([[
            SELECT 1
            FROM phone_friend_requests
            WHERE from_identifier = ?
              AND to_identifier = ?
              AND type = 'snap'
              AND status = 'pending'
            LIMIT 1
        ]], { account.identifier, viewerAccount.identifier }) and true or false
    end

    local canViewPosts = (tonumber(account.is_private) ~= 1) or isOwnProfile or isFollowing
    local posts = {}
    if canViewPosts then
        posts = MySQL.query.await(
            'SELECT * FROM phone_snap_posts WHERE account_id = ? AND is_live = 0 ORDER BY created_at DESC LIMIT 50',
            { accountId }
        ) or {}
    end
    
    return {
        account = account,
        posts = posts,
        relationship = {
            isFollowing = isFollowing,
            requestedByMe = requestedByMe,
            requestedFromThem = requestedFromThem,
            isOwnProfile = isOwnProfile,
            canViewPosts = canViewPosts,
        }
    }
end)
