-- Creado/Modificado por JericoFX

local Bridge = require 'server.bridge'
local Utils = require 'server.lib.utils'
local Live = require 'server.modules.snap_live'

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
    local name = Bridge.GetName(source) or 'User'
    local cleanName = string.lower(string.gsub(name, '%s+', ''))
    local random = math.random(1000, 9999)
    return cleanName .. random
end

local function IsPublishJobAllowed(source)
    local rules = Config.PublishJobs and Config.PublishJobs.snap
    if type(rules) ~= 'table' or #rules == 0 then
        return true
    end

    local job = Bridge.GetJob(source)
    local jobName = type(job) == 'table' and tostring(job.name or ''):lower() or ''
    if jobName == '' then
        return false
    end

    return lib.table.contains(lib.array.map(rules, function(allowed)
        return tostring(allowed):lower()
    end), jobName)
end

local function HitRateLimit(source, key, windowMs, maxHits)
    return Utils.HitRateLimit(source, key, windowMs, maxHits)
end

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

    local orphaned = MySQL.scalar.await('SELECT COUNT(*) FROM phone_snap_posts WHERE is_live = 1')
    if orphaned and orphaned > 0 then
        MySQL.update.await('DELETE FROM phone_snap_posts WHERE is_live = 1')
        print(('[gcphone:snap] Cleaned up %d orphaned live posts from previous session'):format(orphaned))
    end
end)

AddEventHandler('playerDropped', function()
    local src = source
    local identifier = Bridge.GetIdentifier(src)
    Live.OnPlayerDropped(src, identifier)
end)

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
    local identifier = Bridge.GetIdentifier(source)
    if not identifier then return nil end

    return GetAccount(identifier)
end)

lib.callback.register('gcphone:clips:getAccount', function(source)
    local identifier = Bridge.GetIdentifier(source)
    if not identifier then return nil end

    return GetAccount(identifier)
end)

lib.callback.register('gcphone:news:getAccount', function(source)
    local identifier = Bridge.GetIdentifier(source)
    if not identifier then return nil end

    return GetAccount(identifier)
end)

lib.callback.register('gcphone:snap:getDiscoverAccounts', function(source, data)
    local identifier = Bridge.GetIdentifier(source)
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
    local identifier = Bridge.GetIdentifier(source)
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
    local identifier = Bridge.GetIdentifier(source)
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

    local name = Bridge.GetName(source) or 'User'
    local created = CreateAccount(identifier, username, name, nil)
    return created ~= nil, created
end)

lib.callback.register('gcphone:clips:createAccount', function(source, data)
    local identifier = Bridge.GetIdentifier(source)
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

    local name = Bridge.GetName(source) or 'User'
    local avatar = SanitizeMediaUrl(data.avatar)
    local created = CreateAccount(identifier, username, name, avatar ~= '' and avatar or nil)
    return created ~= nil, created
end)

lib.callback.register('gcphone:news:createAccount', function(source, data)
    local identifier = Bridge.GetIdentifier(source)
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

    local name = Bridge.GetName(source) or 'User'
    local created = CreateAccount(identifier, username, name, nil)
    return created ~= nil, created
end)

lib.callback.register('gcphone:snap:updateAccount', function(source, data)
    local identifier = Bridge.GetIdentifier(source)
    if not identifier then return false end

    if type(data) ~= 'table' then return false end

    MySQL.update.await(
        'UPDATE phone_snap_accounts SET is_private = ? WHERE identifier = ?',
        { data.isPrivate and 1 or 0, identifier }
    )
    
    return true
end)

lib.callback.register('gcphone:clips:updateAccount', function(source, data)
    local identifier = Bridge.GetIdentifier(source)
    if not identifier then return false end

    if type(data) ~= 'table' then return false end

    local avatar = SanitizeMediaUrl(data.avatar)
    local bio = SanitizeText(data.bio, 160)

    if avatar and avatar ~= '' then
        MySQL.update.await(
            'UPDATE phone_snap_accounts SET avatar = ?, bio = ?, is_private = ? WHERE identifier = ?',
            { avatar, bio ~= '' and bio or nil, data.isPrivate and 1 or 0, identifier }
        )
    else
        MySQL.update.await(
            'UPDATE phone_snap_accounts SET bio = ?, is_private = ? WHERE identifier = ?',
            { bio ~= '' and bio or nil, data.isPrivate and 1 or 0, identifier }
        )
    end

    return true
end)

lib.callback.register('gcphone:news:updateAccount', function(source, data)
    local identifier = Bridge.GetIdentifier(source)
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
    local identifier = Bridge.GetIdentifier(source)

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
    local identifier = Bridge.GetIdentifier(source)
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
    local identifier = Bridge.GetIdentifier(source)
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
    local identifier = Bridge.GetIdentifier(source)
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
        MySQL.update.await(
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
    local identifier = Bridge.GetIdentifier(source)
    if not identifier then return false end

    local snapMs = GetRateLimitWindow('snap', 1500)
    if HitRateLimit(source, 'snap_delete', snapMs, 2) then
        return false, 'RATE_LIMITED'
    end
    
    local account = GetAccount(identifier)
    if not account then return false end
    
    MySQL.update.await(
        'DELETE FROM phone_snap_posts WHERE id = ? AND account_id = ?',
        { postId, account.id }
    )
    
    return true
end)

lib.callback.register('gcphone:snap:deleteStory', function(source, storyId)
    local identifier = Bridge.GetIdentifier(source)
    if not identifier then return false end

    local snapMs = GetRateLimitWindow('snap', 1500)
    if HitRateLimit(source, 'snap_delete', snapMs, 2) then
        return false, 'RATE_LIMITED'
    end

    local account = GetAccount(identifier)
    if not account then return false end

    local id = tonumber(storyId)
    if not id then return false end

    MySQL.update.await(
        'DELETE FROM phone_snap_stories WHERE id = ? AND account_id = ?',
        { id, account.id }
    )

    return true
end)

Live.RegisterCallbacks({ GetAccount = GetAccount })

lib.callback.register('gcphone:snap:follow', function(source, data)
    local identifier = Bridge.GetIdentifier(source)
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
        MySQL.update.await(
            'DELETE FROM phone_snap_following WHERE follower_id = ? AND following_id = ?',
            { account.id, targetAccountId }
        )

        RefreshFollowCounts(account.id, targetAccountId)

        return { following = false, requested = false }
    end

    if Utils.isTruthy(targetAccount.is_private) then
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
    local identifier = Bridge.GetIdentifier(source)
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
    local identifier = Bridge.GetIdentifier(source)
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
    local identifier = Bridge.GetIdentifier(source)
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
    local identifier = Bridge.GetIdentifier(source)
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
    local identifier = Bridge.GetIdentifier(source)
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

return {
    GetActiveStreams = Live.GetActiveStreams,
}
