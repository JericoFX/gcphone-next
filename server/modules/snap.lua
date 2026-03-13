-- Creado/Modificado por JericoFX

local Utils = GcPhoneUtils

local function SanitizeText(value, maxLength)
    return Utils.SanitizeText(value, maxLength or 2200, true)
end

local function SanitizeMediaUrl(value)
    return Utils.SanitizeMediaUrl(value, { '.png', '.jpg', '.jpeg', '.webp', '.gif', '.mp4', '.webm', '.mov', '.m3u8' }, 500)
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

local function IsPublishJobAllowed(source)
    local rules = Config.PublishJobs and Config.PublishJobs.snap
    if type(rules) ~= 'table' or #rules == 0 then
        return true
    end

    local job = GetJob(source)
    local jobName = type(job) == 'table' and tostring(job.name or ''):lower() or ''
    if jobName == '' then
        return false
    end

    -- Verified: CommunityOX ox_lib Table/Shared exposes lib.table.contains(tbl, value)
    return lib.table.contains(lib.array.map(rules, function(allowed)
        return tostring(allowed):lower()
    end), jobName)
end

local function HitRateLimit(source, key, windowMs, maxHits)
    return Utils.HitRateLimit(source, key, windowMs, maxHits)
end

local ActiveStreams = {}
local RemoveViewerFromAllLives

local function EnsureSnapTables()
    MySQL.query.await([[
        ALTER TABLE `phone_snap_accounts`
            ADD COLUMN IF NOT EXISTS `verified` TINYINT(1) DEFAULT 0 AFTER `bio`
    ]])

    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS `phone_snap_likes` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `post_id` INT NOT NULL,
            `account_id` INT NOT NULL,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (`post_id`) REFERENCES `phone_snap_posts`(`id`) ON DELETE CASCADE,
            FOREIGN KEY (`account_id`) REFERENCES `phone_snap_accounts`(`id`) ON DELETE CASCADE,
            UNIQUE KEY `idx_snap_post_account` (`post_id`, `account_id`),
            KEY `idx_snap_likes_account` (`account_id`, `created_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ]])
end

CreateThread(function()
    EnsureSnapTables()
end)

AddEventHandler('playerDropped', function()
    local src = source
    local identifier = GetIdentifier(src)

    for liveId, stream in pairs(ActiveStreams) do
        if type(stream) == 'table' and stream.source == src then
            MySQL.execute.await(
                'DELETE FROM phone_snap_posts WHERE id = ? AND is_live = 1',
                { liveId }
            )
            ActiveStreams[liveId] = nil
            TriggerClientEvent('gcphone:snap:liveEnded', -1, liveId)
        end
    end

    RemoveViewerFromAllLives(src, identifier)
end)

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

local function BroadcastLiveViewerCount(liveId)
    local stream = ActiveStreams[liveId]
    if not stream then return end

    local viewers = GetLiveViewerCount(stream)
    TriggerClientEvent('gcphone:snap:liveViewersUpdated', -1, {
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
    local display = SanitizeText(account and account.display_name or GetName(source) or username or 'Invitado', 50)
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

    TriggerClientEvent('gcphone:snap:liveMessage', -1, {
        liveId = liveId,
        message = message,
    })
end

local function BroadcastLiveReaction(liveId, reaction)
    TriggerClientEvent('gcphone:snap:liveReaction', -1, {
        liveId = liveId,
        reaction = reaction,
    })
end

local function BroadcastLiveMessageRemoved(liveId, messageId)
    TriggerClientEvent('gcphone:snap:liveMessageRemoved', -1, {
        liveId = liveId,
        messageId = messageId,
    })
end

local function BroadcastLiveUserMuted(liveId, username)
    TriggerClientEvent('gcphone:snap:liveUserMuted', -1, {
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

    local key = identifier or GetIdentifier(source)
    if not key or key == '' then return false end
    if not stream.viewers[key] then return false end

    stream.viewers[key] = nil
    BroadcastLiveViewerCount(id)
    return true
end

RemoveViewerFromAllLives = function(source, identifier)
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

local function GetRateLimitWindow(key, fallback)
    return Utils.GetRateLimitWindow(key, fallback)
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

    return GetAccount(identifier)
end)

lib.callback.register('gcphone:clips:getAccount', function(source)
    local identifier = GetIdentifier(source)
    if not identifier then return nil end

    return GetAccount(identifier)
end)

lib.callback.register('gcphone:news:getAccount', function(source)
    local identifier = GetIdentifier(source)
    if not identifier then return nil end

    return GetAccount(identifier)
end)

lib.callback.register('gcphone:snap:getDiscoverAccounts', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return {} end

    local me = GetAccount(identifier)
    if not me then return {} end

    data = type(data) == 'table' and data or {}
    local limit = tonumber(data.limit) or 30
    local offset = tonumber(data.offset) or 0
    if limit < 1 then limit = 1 end
    if limit > 100 then limit = 100 end
    if offset < 0 then offset = 0 end

    return MySQL.query.await([[
        SELECT
            a.id as account_id,
            a.username,
            a.display_name,
            a.avatar,
            a.bio,
            a.verified,
            a.is_private,
            a.followers,
            a.following,
            CASE WHEN EXISTS (
                SELECT 1
                FROM phone_snap_following sf
                WHERE sf.follower_id = ?
                  AND sf.following_id = a.id
                LIMIT 1
            ) THEN 1 ELSE 0 END as is_following,
            CASE WHEN EXISTS (
                SELECT 1
                FROM phone_friend_requests fr
                WHERE fr.from_identifier = ?
                  AND fr.to_identifier = a.identifier
                  AND fr.type = 'snap'
                  AND fr.status = 'pending'
                LIMIT 1
            ) THEN 1 ELSE 0 END as requested_by_me
        FROM phone_snap_accounts a
        WHERE a.id <> ?
        ORDER BY a.verified DESC, a.followers DESC, a.display_name ASC
        LIMIT ? OFFSET ?
    ]], { me.id, identifier, me.id, limit, offset }) or {}
end)

lib.callback.register('gcphone:snap:getDiscoverFeed', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return {} end

    local me = GetAccount(identifier)
    if not me then return {} end

    data = type(data) == 'table' and data or {}
    local limit = tonumber(data.limit) or 30
    local offset = tonumber(data.offset) or 0
    local search = SanitizeText(tostring(data.search or ''), 60)

    if limit < 1 then limit = 1 end
    if limit > 100 then limit = 100 end
    if offset < 0 then offset = 0 end

    local viewerAccountId = me.id
    local rows
    if search ~= '' then
        local q = '%' .. search .. '%'
        rows = MySQL.query.await([[
            SELECT
                p.id,
                p.account_id,
                p.media_url,
                p.media_type,
                p.caption,
                p.likes,
                p.created_at,
                a.username,
                a.display_name,
                a.avatar,
                a.verified,
                a.is_private,
                a.followers,
                CASE WHEN EXISTS (
                    SELECT 1
                    FROM phone_snap_following sf
                    WHERE sf.follower_id = ?
                      AND sf.following_id = a.id
                    LIMIT 1
                ) THEN 1 ELSE 0 END as is_following,
                CASE WHEN EXISTS (
                    SELECT 1
                    FROM phone_friend_requests fr
                    WHERE fr.from_identifier = ?
                      AND fr.to_identifier = a.identifier
                      AND fr.type = 'snap'
                      AND fr.status = 'pending'
                    LIMIT 1
                ) THEN 1 ELSE 0 END as requested_by_me,
                CASE WHEN EXISTS (
                    SELECT 1
                    FROM phone_snap_likes sl
                    WHERE sl.post_id = p.id
                      AND sl.account_id = ?
                    LIMIT 1
                ) THEN 1 ELSE 0 END as liked
            FROM phone_snap_posts p
            INNER JOIN (
                SELECT account_id, MAX(id) AS latest_post_id
                FROM phone_snap_posts
                WHERE is_live = 0
                GROUP BY account_id
            ) latest ON latest.latest_post_id = p.id
            INNER JOIN phone_snap_accounts a ON a.id = p.account_id
            WHERE a.id <> ?
              AND (
                a.username LIKE ?
                OR a.display_name LIKE ?
                OR a.bio LIKE ?
                OR p.caption LIKE ?
              )
            ORDER BY a.verified DESC, p.created_at DESC
            LIMIT ? OFFSET ?
        ]], { me.id, identifier, viewerAccountId, me.id, q, q, q, q, limit, offset }) or {}
    else
        rows = MySQL.query.await([[
            SELECT
                p.id,
                p.account_id,
                p.media_url,
                p.media_type,
                p.caption,
                p.likes,
                p.created_at,
                a.username,
                a.display_name,
                a.avatar,
                a.verified,
                a.is_private,
                a.followers,
                CASE WHEN EXISTS (
                    SELECT 1
                    FROM phone_snap_following sf
                    WHERE sf.follower_id = ?
                      AND sf.following_id = a.id
                    LIMIT 1
                ) THEN 1 ELSE 0 END as is_following,
                CASE WHEN EXISTS (
                    SELECT 1
                    FROM phone_friend_requests fr
                    WHERE fr.from_identifier = ?
                      AND fr.to_identifier = a.identifier
                      AND fr.type = 'snap'
                      AND fr.status = 'pending'
                    LIMIT 1
                ) THEN 1 ELSE 0 END as requested_by_me,
                CASE WHEN EXISTS (
                    SELECT 1
                    FROM phone_snap_likes sl
                    WHERE sl.post_id = p.id
                      AND sl.account_id = ?
                    LIMIT 1
                ) THEN 1 ELSE 0 END as liked
            FROM phone_snap_posts p
            INNER JOIN (
                SELECT account_id, MAX(id) AS latest_post_id
                FROM phone_snap_posts
                WHERE is_live = 0
                GROUP BY account_id
            ) latest ON latest.latest_post_id = p.id
            INNER JOIN phone_snap_accounts a ON a.id = p.account_id
            WHERE a.id <> ?
            ORDER BY a.verified DESC, p.created_at DESC
            LIMIT ? OFFSET ?
        ]], { me.id, identifier, viewerAccountId, me.id, limit, offset }) or {}
    end

    return rows
end)

lib.callback.register('gcphone:snap:createAccount', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false, 'INVALID_PLAYER' end
    if type(data) ~= 'table' then return false, 'INVALID_PAYLOAD' end

    local username = SanitizeText(tostring(data.username or ''), 32):lower()
    username = username:gsub('[^a-z0-9._-]', '')
    if username == '' or #username < 3 then
        return false, 'INVALID_USERNAME'
    end

    local existing = GetAccount(identifier)
    if existing then
        return true, existing
    end

    local occupied = MySQL.scalar.await(
        'SELECT 1 FROM phone_snap_accounts WHERE username = ? LIMIT 1',
        { username }
    )
    if occupied then
        return false, 'USERNAME_TAKEN'
    end

    local name = GetName(source) or 'User'
    local created = CreateAccount(identifier, username, name, nil)
    return created ~= nil, created
end)

lib.callback.register('gcphone:clips:createAccount', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false, 'INVALID_PLAYER' end
    if type(data) ~= 'table' then return false, 'INVALID_PAYLOAD' end

    local username = SanitizeText(tostring(data.username or ''), 32):lower()
    username = username:gsub('[^a-z0-9._-]', '')
    if username == '' or #username < 3 then
        return false, 'INVALID_USERNAME'
    end

    local existing = GetAccount(identifier)
    if existing then
        return true, existing
    end

    local occupied = MySQL.scalar.await(
        'SELECT 1 FROM phone_snap_accounts WHERE username = ? LIMIT 1',
        { username }
    )
    if occupied then
        return false, 'USERNAME_TAKEN'
    end

    local name = GetName(source) or 'User'
    local created = CreateAccount(identifier, username, name, nil)
    return created ~= nil, created
end)

lib.callback.register('gcphone:news:createAccount', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false, 'INVALID_PLAYER' end
    if type(data) ~= 'table' then return false, 'INVALID_PAYLOAD' end

    local username = SanitizeText(tostring(data.username or ''), 32):lower()
    username = username:gsub('[^a-z0-9._-]', '')
    if username == '' or #username < 3 then
        return false, 'INVALID_USERNAME'
    end

    local existing = GetAccount(identifier)
    if existing then
        return true, existing
    end

    local occupied = MySQL.scalar.await(
        'SELECT 1 FROM phone_snap_accounts WHERE username = ? LIMIT 1',
        { username }
    )
    if occupied then
        return false, 'USERNAME_TAKEN'
    end

    local name = GetName(source) or 'User'
    local created = CreateAccount(identifier, username, name, nil)
    return created ~= nil, created
end)

lib.callback.register('gcphone:snap:updateAccount', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false end

    if type(data) ~= 'table' then return false end

    MySQL.update.await(
        'UPDATE phone_snap_accounts SET is_private = ? WHERE identifier = ?',
        { data.isPrivate and 1 or 0, identifier }
    )
    
    return true
end)

lib.callback.register('gcphone:clips:updateAccount', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false end

    if type(data) ~= 'table' then return false end

    MySQL.update.await(
        'UPDATE phone_snap_accounts SET is_private = ? WHERE identifier = ?',
        { data.isPrivate and 1 or 0, identifier }
    )

    return true
end)

lib.callback.register('gcphone:news:updateAccount', function(source, data)
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
    
    local viewerAccount = identifier and GetAccount(identifier) or nil
    local viewerAccountId = viewerAccount and viewerAccount.id or 0

    local posts = MySQL.query.await([[
        SELECT p.*, a.username, a.display_name, a.avatar,
               CASE WHEN EXISTS (
                   SELECT 1 FROM phone_snap_likes sl WHERE sl.post_id = p.id AND sl.account_id = ? LIMIT 1
               ) THEN 1 ELSE 0 END as liked
        FROM phone_snap_posts p
        JOIN phone_snap_accounts a ON p.account_id = a.id
        WHERE p.is_live = 0
        ORDER BY p.created_at DESC
        LIMIT ? OFFSET ?
    ]], { viewerAccountId, limit, offset }) or {}
    
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

    if not IsPublishJobAllowed(source) then
        return false, 'NOT_AUTHORIZED_JOB'
    end

    local snapMs = GetRateLimitWindow('snap', 1500)
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

    if not IsPublishJobAllowed(source) then
        return false, 'NOT_AUTHORIZED_JOB'
    end

    local snapMs = GetRateLimitWindow('snap', 1500)
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

    local account = GetAccount(identifier)
    if not account then return false end

    local snapMs = GetRateLimitWindow('snap', 1500)
    if HitRateLimit(source, 'snap_like', snapMs, 4) then
        return false, 'RATE_LIMITED'
    end

    local existing = MySQL.scalar.await(
        'SELECT id FROM phone_snap_likes WHERE post_id = ? AND account_id = ? LIMIT 1',
        { postId, account.id }
    )

    local liked = false
    if existing then
        MySQL.execute.await(
            'DELETE FROM phone_snap_likes WHERE post_id = ? AND account_id = ?',
            { postId, account.id }
        )
    else
        MySQL.insert.await(
            'INSERT IGNORE INTO phone_snap_likes (post_id, account_id) VALUES (?, ?)',
            { postId, account.id }
        )
        liked = true
    end

    local likes = MySQL.scalar.await(
        'SELECT COUNT(*) FROM phone_snap_likes WHERE post_id = ?',
        { postId }
    ) or 0

    MySQL.update.await(
        'UPDATE phone_snap_posts SET likes = ? WHERE id = ?',
        { likes, postId }
    )

    return true, { liked = liked, likes = likes }
end)

lib.callback.register('gcphone:snap:deletePost', function(source, postId)
    local identifier = GetIdentifier(source)
    if not identifier then return false end

    local snapMs = GetRateLimitWindow('snap', 1500)
    if HitRateLimit(source, 'snap_delete', snapMs, 2) then
        return false, 'RATE_LIMITED'
    end
    
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

    local snapMs = GetRateLimitWindow('snap', 1500)
    if HitRateLimit(source, 'snap_delete', snapMs, 2) then
        return false, 'RATE_LIMITED'
    end

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

    local snapMs = GetRateLimitWindow('snap', 1500)
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
    
    return true, { postId = postId, stream = ActiveStreams[postId] }
end)

lib.callback.register('gcphone:snap:endLive', function(source, postId)
    local identifier = GetIdentifier(source)
    if not identifier then return false end

    local id = tonumber(postId)
    if not id or id < 1 then return false end

    local stream = ActiveStreams[id]
    if stream and stream.identifier ~= identifier then
        return false
    end
    
    MySQL.execute.await(
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
    local identifier = GetIdentifier(source)
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

lib.callback.register('gcphone:snap:sendLiveMessage', function(source, data)
    local identifier = GetIdentifier(source)
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
    local identifier = GetIdentifier(source)
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
    local identifier = GetIdentifier(source)
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
    local identifier = GetIdentifier(source)
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

    local identifier = GetIdentifier(source)
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

lib.callback.register('gcphone:snap:follow', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false end

    if type(data) ~= 'table' then return false end
    local targetAccountId = tonumber(data.targetAccountId)
    if not targetAccountId or targetAccountId < 1 then return false end
    
    local account = GetAccount(identifier)
    if not account then return false end

    local snapMs = GetRateLimitWindow('snap', 1500)
    if HitRateLimit(source, 'snap_follow', snapMs, 2) then
        return { following = false, requested = false, error = 'rate_limited' }
    end

    if not IsPublishJobAllowed(source) then
        return false, 'NOT_AUTHORIZED_JOB'
    end

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

    local snapMs = GetRateLimitWindow('snap', 1500)
    if HitRateLimit(source, 'snap_follow_requests', snapMs, 3) then
        return false
    end

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

    local snapMs = GetRateLimitWindow('snap', 1500)
    if HitRateLimit(source, 'snap_follow_requests', snapMs, 3) then
        return false
    end

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
        posts = MySQL.query.await([[
            SELECT p.*,
                   CASE WHEN EXISTS (
                       SELECT 1 FROM phone_snap_likes sl WHERE sl.post_id = p.id AND sl.account_id = ? LIMIT 1
                   ) THEN 1 ELSE 0 END as liked
            FROM phone_snap_posts p
            WHERE p.account_id = ? AND p.is_live = 0
            ORDER BY p.created_at DESC
            LIMIT 50
        ]], { viewerAccount and viewerAccount.id or 0, accountId }) or {}
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
