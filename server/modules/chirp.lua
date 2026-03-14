-- Creado/Modificado por JericoFX
-- Chirp (Twitter/X Clone) - Backend

local Utils = GcPhoneUtils

local function SanitizeText(value, maxLength)
    return Utils.SanitizeText(value, maxLength or 280, true)
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

local function RefreshFollowCounts(accountId, targetAccountId)
    if accountId then
        MySQL.update.await(
            'UPDATE phone_chirp_accounts SET following = (SELECT COUNT(*) FROM phone_chirp_following WHERE follower_id = ?) WHERE id = ?',
            { accountId, accountId }
        )
    end

    if targetAccountId then
        MySQL.update.await(
            'UPDATE phone_chirp_accounts SET followers = (SELECT COUNT(*) FROM phone_chirp_following WHERE following_id = ?) WHERE id = ?',
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

local function GetAccount(identifier)
    if not identifier then return nil end
    
    return MySQL.single.await(
        'SELECT * FROM phone_chirp_accounts WHERE identifier = ?',
        { identifier }
    )
end

local function CreateAccount(identifier, username, displayName, avatar)
    MySQL.insert.await(
        'INSERT INTO phone_chirp_accounts (identifier, username, display_name, avatar) VALUES (?, ?, ?, ?)',
        { identifier, username, displayName, avatar }
    )
    
    return GetAccount(identifier)
end

local function GetTweetOwner(tweetId)
    if not tweetId then return nil end

    return MySQL.single.await([[
        SELECT t.id, t.account_id, a.identifier, a.display_name, a.username
        FROM phone_chirp_tweets t
        JOIN phone_chirp_accounts a ON a.id = t.account_id
        WHERE t.id = ?
        LIMIT 1
    ]], { tweetId })
end

local function GetRechirpRows(account, scope, limit, offset)
    local viewerAccountId = account and account.id or 0

    if scope == 'following' and account then
        return MySQL.query.await([[
            SELECT t.*, a.username, a.display_name, a.avatar, a.verified,
                   (SELECT COUNT(*) FROM phone_chirp_comments WHERE tweet_id = t.id) as comments_count,
                   (SELECT COUNT(*) FROM phone_chirp_rechirps WHERE original_tweet_id = t.id) as rechirps_count,
                   CASE WHEN t.account_id = ? THEN 1 ELSE 0 END as is_own,
                   'rechirp' as activity_type,
                   r.created_at as activity_created_at,
                   ar.display_name as activity_actor_display_name,
                   ar.username as activity_actor_username,
                   r.content as rechirp_comment,
                   r.media_url as rechirp_media_url,
                   t.id as original_tweet_id,
                   t.content as original_content,
                   t.media_url as original_media_url,
                   a.username as original_username,
                   a.display_name as original_display_name,
                   a.avatar as original_avatar,
                   a.verified as original_verified
            FROM phone_chirp_rechirps r
            JOIN phone_chirp_tweets t ON t.id = r.original_tweet_id
            JOIN phone_chirp_accounts a ON t.account_id = a.id
            JOIN phone_chirp_accounts ar ON r.account_id = ar.id
            JOIN phone_chirp_following f ON f.following_id = r.account_id
            WHERE f.follower_id = ?
            ORDER BY r.created_at DESC
            LIMIT ? OFFSET ?
        ]], { viewerAccountId, account.id, limit, offset }) or {}
    end

    if scope == 'forYou' then
        return MySQL.query.await([[
            SELECT t.*, a.username, a.display_name, a.avatar, a.verified,
                   (SELECT COUNT(*) FROM phone_chirp_comments WHERE tweet_id = t.id) as comments_count,
                   (SELECT COUNT(*) FROM phone_chirp_rechirps WHERE original_tweet_id = t.id) as rechirps_count,
                   CASE WHEN t.account_id = ? THEN 1 ELSE 0 END as is_own,
                   'rechirp' as activity_type,
                   r.created_at as activity_created_at,
                   ar.display_name as activity_actor_display_name,
                   ar.username as activity_actor_username,
                   r.content as rechirp_comment,
                   t.id as original_tweet_id,
                   t.content as original_content,
                   t.media_url as original_media_url,
                   a.username as original_username,
                   a.display_name as original_display_name,
                   a.avatar as original_avatar,
                   a.verified as original_verified
            FROM phone_chirp_rechirps r
            JOIN phone_chirp_tweets t ON t.id = r.original_tweet_id
            JOIN phone_chirp_accounts a ON t.account_id = a.id
            JOIN phone_chirp_accounts ar ON r.account_id = ar.id
            ORDER BY r.created_at DESC
            LIMIT ? OFFSET ?
        ]], { viewerAccountId, limit, offset }) or {}
    end

    if scope == 'myActivity' and account then
        return MySQL.query.await([[
            SELECT t.*, a.username, a.display_name, a.avatar, a.verified,
                   (SELECT COUNT(*) FROM phone_chirp_comments WHERE tweet_id = t.id) as comments_count,
                   (SELECT COUNT(*) FROM phone_chirp_rechirps WHERE original_tweet_id = t.id) as rechirps_count,
                   'rechirp' as activity_type,
                   r.created_at as activity_created_at,
                   ? as activity_actor_display_name,
                   ? as activity_actor_username,
                   r.content as rechirp_comment,
                   r.media_url as rechirp_media_url,
                   t.id as original_tweet_id,
                   t.content as original_content,
                   t.media_url as original_media_url,
                   a.username as original_username,
                   a.display_name as original_display_name,
                   a.avatar as original_avatar,
                   a.verified as original_verified
            FROM phone_chirp_rechirps r
            JOIN phone_chirp_tweets t ON t.id = r.original_tweet_id
            JOIN phone_chirp_accounts a ON t.account_id = a.id
            WHERE r.account_id = ?
            ORDER BY r.created_at DESC
            LIMIT ? OFFSET ?
        ]], {
            account.display_name or account.username or 'Tu cuenta',
            account.username or 'tu-cuenta',
            account.id,
            math.floor(limit / 2),
            offset
        }) or {}
    end

    return {}
end

local function GenerateUsername(source)
    local name = GetName(source) or 'User'
    local cleanName = string.lower(string.gsub(name, '%s+', ''))
    local random = math.random(1000, 9999)
    return cleanName .. random
end

local function IsPublishJobAllowed(source)
    local rules = Config.PublishJobs and Config.PublishJobs.chirp
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

lib.callback.register('gcphone:chirp:getAccount', function(source)
    local identifier = GetIdentifier(source)
    if not identifier then return nil end

    return GetAccount(identifier)
end)

lib.callback.register('gcphone:chirp:createAccount', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false, 'INVALID_PLAYER' end
    if type(data) ~= 'table' then return false, 'INVALID_PAYLOAD' end

    local username = SanitizeText(tostring(data.username or ''), 32):lower()
    username = username:gsub('[^a-z0-9._-]', '')
    if username == '' or #username < 3 then
        return false, 'INVALID_USERNAME'
    end

    local account = GetAccount(identifier)
    if account then
        return true, account
    end

    local occupied = MySQL.scalar.await(
        'SELECT 1 FROM phone_chirp_accounts WHERE username = ? LIMIT 1',
        { username }
    )
    if occupied then
        return false, 'USERNAME_TAKEN'
    end

    local name = GetName(source) or 'User'
    local created = CreateAccount(identifier, username, name, nil)
    return created ~= nil, created
end)

lib.callback.register('gcphone:chirp:updateAccount', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false end

    if type(data) ~= 'table' then return false end

    local isPrivate = data.isPrivate == true and 1 or 0
    
    MySQL.update.await(
        'UPDATE phone_chirp_accounts SET is_private = ? WHERE identifier = ?',
        { isPrivate, identifier }
    )
    
    return true
end)

-- Get tweets with optional filters
lib.callback.register('gcphone:chirp:getTweets', function(source, data)
    local identifier = GetIdentifier(source)

    data = type(data) == 'table' and data or {}
    local tab = data.tab or 'forYou'
    local limit = tonumber(data.limit) or 50
    local offset = tonumber(data.offset) or 0
    if limit < 1 then limit = 1 end
    if limit > 100 then limit = 100 end
    if offset < 0 then offset = 0 end
    
    local tweets = {}
    local account = nil

    if identifier then
        account = GetAccount(identifier)
    end

    if (tab == 'following' or tab == 'myActivity') and not account then
        return {}
    end
    
    if tab == 'following' and account then
        -- Tweets from followed accounts
        tweets = MySQL.query.await([[
            SELECT t.*, a.username, a.display_name, a.avatar, a.verified,
                   (SELECT COUNT(*) FROM phone_chirp_comments WHERE tweet_id = t.id) as comments_count,
                   (SELECT COUNT(*) FROM phone_chirp_rechirps WHERE original_tweet_id = t.id) as rechirps_count,
                   CASE WHEN t.account_id = ? THEN 1 ELSE 0 END as is_own
            FROM phone_chirp_tweets t
            JOIN phone_chirp_accounts a ON t.account_id = a.id
            JOIN phone_chirp_following f ON f.following_id = t.account_id
            WHERE f.follower_id = ?
            ORDER BY t.created_at DESC
            LIMIT ? OFFSET ?
        ]], { account.id, account.id, limit, offset }) or {}

        local rechirpRows = GetRechirpRows(account, 'following', math.floor(limit / 2), offset)
        for _, tweet in ipairs(rechirpRows) do
            tweets[#tweets + 1] = tweet
        end

        table.sort(tweets, function(a, b)
            local aDate = a.activity_created_at or a.created_at or ''
            local bDate = b.activity_created_at or b.created_at or ''
            return aDate > bDate
        end)
    elseif tab == 'myActivity' and account then
        -- User's own tweets, likes, and comments
        local myTweets = MySQL.query.await([[
            SELECT t.*, a.username, a.display_name, a.avatar, a.verified,
                   (SELECT COUNT(*) FROM phone_chirp_comments WHERE tweet_id = t.id) as comments_count,
                   (SELECT COUNT(*) FROM phone_chirp_rechirps WHERE original_tweet_id = t.id) as rechirps_count,
                   1 as is_own,
                   'tweet' as activity_type,
                   t.created_at as activity_created_at
            FROM phone_chirp_tweets t
            JOIN phone_chirp_accounts a ON t.account_id = a.id
            WHERE t.account_id = ?
            ORDER BY t.created_at DESC
            LIMIT ? OFFSET ?
        ]], { account.id, limit, offset }) or {}
        
        -- Liked tweets
        local likedTweets = MySQL.query.await([[
            SELECT t.*, a.username, a.display_name, a.avatar, a.verified,
                   (SELECT COUNT(*) FROM phone_chirp_comments WHERE tweet_id = t.id) as comments_count,
                   (SELECT COUNT(*) FROM phone_chirp_rechirps WHERE original_tweet_id = t.id) as rechirps_count,
                   1 as liked,
                   'like' as activity_type,
                   l.created_at as activity_created_at
            FROM phone_chirp_tweets t
            JOIN phone_chirp_accounts a ON t.account_id = a.id
            JOIN phone_chirp_likes l ON l.tweet_id = t.id
            WHERE l.account_id = ?
            ORDER BY l.created_at DESC
            LIMIT ? OFFSET ?
        ]], { account.id, math.floor(limit / 2), offset }) or {}

        local rechirpedTweets = GetRechirpRows(account, 'myActivity', limit, offset)
        
        tweets = myTweets
        for _, tweet in ipairs(likedTweets) do
            tweets[#tweets + 1] = tweet
        end
        for _, tweet in ipairs(rechirpedTweets) do
            tweets[#tweets + 1] = tweet
        end
        
        table.sort(tweets, function(a, b)
            local aDate = a.activity_created_at or a.created_at or ''
            local bDate = b.activity_created_at or b.created_at or ''
            return aDate > bDate
        end)
    else
        -- For you - all tweets
        local forYouAccountId = account and account.id or 0
        tweets = MySQL.query.await([[
            SELECT t.*, a.username, a.display_name, a.avatar, a.verified,
                   (SELECT COUNT(*) FROM phone_chirp_comments WHERE tweet_id = t.id) as comments_count,
                   (SELECT COUNT(*) FROM phone_chirp_rechirps WHERE original_tweet_id = t.id) as rechirps_count,
                   CASE WHEN t.account_id = ? THEN 1 ELSE 0 END as is_own
            FROM phone_chirp_tweets t
            JOIN phone_chirp_accounts a ON t.account_id = a.id
            ORDER BY t.created_at DESC
            LIMIT ? OFFSET ?
        ]], { forYouAccountId, limit, offset }) or {}

        local rechirpRows = GetRechirpRows(account, 'forYou', math.floor(limit / 2), offset)
        for _, tweet in ipairs(rechirpRows) do
            tweets[#tweets + 1] = tweet
        end

        table.sort(tweets, function(a, b)
            local aDate = a.activity_created_at or a.created_at or ''
            local bDate = b.activity_created_at or b.created_at or ''
            return aDate > bDate
        end)
    end
    
    -- Check if user liked each tweet
    if account then
        for _, tweet in ipairs(tweets) do
            local targetTweetId = tonumber(tweet.original_tweet_id) or tweet.id
            local liked = MySQL.scalar.await(
                'SELECT 1 FROM phone_chirp_likes WHERE tweet_id = ? AND account_id = ?',
                { targetTweetId, account.id }
            )
            tweet.liked = liked ~= nil
            
            -- Check if rechirped
            local rechirped = MySQL.scalar.await(
                'SELECT 1 FROM phone_chirp_rechirps WHERE original_tweet_id = ? AND account_id = ?',
                { targetTweetId, account.id }
            )
            tweet.rechirped = rechirped ~= nil
        end
    end
    
    return tweets
end)

lib.callback.register('gcphone:chirp:publishTweet', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false end

    if type(data) ~= 'table' then return false end
    
    local account = GetAccount(identifier)
    if not account then return false end

    local chirpMs = GetRateLimitWindow('chirp', 1400)
    if HitRateLimit(source, 'chirp', chirpMs, 1) then
        return false, 'RATE_LIMITED'
    end

    local content = SanitizeText(data.content, Config.Chirp.MaxTweetLength)
    local mediaUrl = SanitizeMediaUrl(data.mediaUrl)
    
    if content == '' then
        return false, 'Invalid content'
    end
    
    local tweetId = MySQL.insert.await(
        'INSERT INTO phone_chirp_tweets (account_id, content, media_url) VALUES (?, ?, ?)',
        { account.id, content, mediaUrl }
    )
    
    local tweet = MySQL.single.await([[
        SELECT t.*, a.username, a.display_name, a.avatar, a.verified,
               0 as comments_count, 0 as rechirps_count
        FROM phone_chirp_tweets t
        JOIN phone_chirp_accounts a ON t.account_id = a.id
        WHERE t.id = ?
    ]], { tweetId })
    
    tweet.liked = false
    tweet.rechirped = false
    
    TriggerClientEvent('gcphone:chirp:newTweet', -1, tweet)
    
    return true, tweet
end)

lib.callback.register('gcphone:chirp:toggleLike', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false end

    if type(data) ~= 'table' then return false end
    local tweetId = tonumber(data.tweetId)
    if not tweetId or tweetId < 1 then return false end
    
    local account = GetAccount(identifier)
    if not account then return false end

    local chirpMs = GetRateLimitWindow('chirp', 1400)
    if HitRateLimit(source, 'chirp_like', chirpMs, 4) then
        return false, 'RATE_LIMITED'
    end
    
    local existing = MySQL.scalar.await(
        'SELECT id FROM phone_chirp_likes WHERE tweet_id = ? AND account_id = ?',
        { tweetId, account.id }
    )
    
    if existing then
        MySQL.execute.await(
            'DELETE FROM phone_chirp_likes WHERE tweet_id = ? AND account_id = ?',
            { tweetId, account.id }
        )
        
        return { liked = false }
    else
        MySQL.insert.await(
            'INSERT INTO phone_chirp_likes (tweet_id, account_id) VALUES (?, ?)',
            { tweetId, account.id }
        )
        
        return { liked = true }
    end
end)

-- ReChirp functionality
lib.callback.register('gcphone:chirp:toggleRechirp', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false end

    if type(data) ~= 'table' then return false end
    local tweetId = tonumber(data.tweetId)
    local content = SanitizeText(data.content, Config.Chirp.MaxTweetLength)
    local mediaUrl = SanitizeMediaUrl(data.mediaUrl)
    if not tweetId or tweetId < 1 then return false end
    
    local account = GetAccount(identifier)
    if not account then return false end

    local chirpMs = GetRateLimitWindow('chirp', 1400)
    if HitRateLimit(source, 'chirp_rechirp', chirpMs, 3) then
        return false, 'RATE_LIMITED'
    end
    
    -- Check if already rechirped
    local existing = MySQL.scalar.await(
        'SELECT id FROM phone_chirp_rechirps WHERE original_tweet_id = ? AND account_id = ?',
        { tweetId, account.id }
    )
    
    if existing then
        -- Remove rechirp
        MySQL.execute.await(
            'DELETE FROM phone_chirp_rechirps WHERE original_tweet_id = ? AND account_id = ?',
            { tweetId, account.id }
        )
        
        return { rechirped = false }
    else
        -- Create rechirp
        local tweetOwner = GetTweetOwner(tweetId)

        MySQL.insert.await(
            'INSERT INTO phone_chirp_rechirps (original_tweet_id, account_id, content, media_url) VALUES (?, ?, ?, ?)',
            { tweetId, account.id, content ~= '' and content or nil, mediaUrl }
        )

        if tweetOwner and tweetOwner.identifier and tweetOwner.identifier ~= identifier then
            UpsertSocialNotification(
                tweetOwner.identifier,
                identifier,
                'chirp',
                'mention',
                tweetId,
                'tweet',
                ('%s hizo rechirp de tu chirp'):format(account.display_name or account.username or 'Alguien')
            )
        end
        
        return { rechirped = true }
    end
end)

-- Comments functionality
lib.callback.register('gcphone:chirp:getComments', function(source, data)
    if type(data) ~= 'table' then return {} end
    local tweetId = tonumber(data.tweetId)
    if not tweetId or tweetId < 1 then return {} end
    
    local comments = MySQL.query.await([[
        SELECT c.*, a.username, a.display_name, a.avatar
        FROM phone_chirp_comments c
        JOIN phone_chirp_accounts a ON c.account_id = a.id
        WHERE c.tweet_id = ?
        ORDER BY c.created_at ASC
    ]], { tweetId }) or {}
    
    return comments
end)

lib.callback.register('gcphone:chirp:addComment', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false end

    if type(data) ~= 'table' then return false end
    local tweetId = tonumber(data.tweetId)
    local content = SanitizeText(data.content, 500)
    
    if not tweetId or tweetId < 1 or content == '' then return false end
    
    local account = GetAccount(identifier)
    if not account then return false end

    local chirpMs = GetRateLimitWindow('chirp', 1400)
    if HitRateLimit(source, 'chirp_comment', chirpMs, 2) then
        return false, 'RATE_LIMITED'
    end
    
    local commentId = MySQL.insert.await(
        'INSERT INTO phone_chirp_comments (tweet_id, account_id, content) VALUES (?, ?, ?)',
        { tweetId, account.id, content }
    )
    
    local comment = MySQL.single.await([[
        SELECT c.*, a.username, a.display_name, a.avatar
        FROM phone_chirp_comments c
        JOIN phone_chirp_accounts a ON c.account_id = a.id
        WHERE c.id = ?
    ]], { commentId })
    
    return true, comment
end)

lib.callback.register('gcphone:chirp:deleteComment', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false end

    local chirpMs = GetRateLimitWindow('chirp', 1400)
    if HitRateLimit(source, 'chirp_delete', chirpMs, 3) then
        return false, 'RATE_LIMITED'
    end

    if type(data) ~= 'table' then return false end
    local commentId = tonumber(data.commentId)
    if not commentId or commentId < 1 then return false end
    
    local account = GetAccount(identifier)
    if not account then return false end
    
    -- Get tweet_id before deleting
    local comment = MySQL.single.await(
        'SELECT tweet_id FROM phone_chirp_comments WHERE id = ? AND account_id = ?',
        { commentId, account.id }
    )
    
    if not comment then return false end
    
    MySQL.execute.await(
        'DELETE FROM phone_chirp_comments WHERE id = ? AND account_id = ?',
        { commentId, account.id }
    )
    
    return true
end)

lib.callback.register('gcphone:chirp:deleteTweet', function(source, tweetId)
    local identifier = GetIdentifier(source)
    if not identifier then return false end

    local chirpMs = GetRateLimitWindow('chirp', 1400)
    if HitRateLimit(source, 'chirp_delete', chirpMs, 3) then
        return false, 'RATE_LIMITED'
    end
    
    local account = GetAccount(identifier)
    if not account then return false end
    
    MySQL.execute.await(
        'DELETE FROM phone_chirp_tweets WHERE id = ? AND account_id = ?',
        { tweetId, account.id }
    )
    
    return true
end)

lib.callback.register('gcphone:chirp:follow', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false end

    if type(data) ~= 'table' then return false end
    local targetAccountId = tonumber(data.targetAccountId)
    if not targetAccountId or targetAccountId < 1 then return false end
    
    local account = GetAccount(identifier)
    if not account then return false end

    local chirpMs = GetRateLimitWindow('chirp', 1400)
    if HitRateLimit(source, 'chirp_follow', chirpMs, 2) then
        return { following = false, requested = false, error = 'rate_limited' }
    end

    if not IsPublishJobAllowed(source) then
        return false, 'NOT_AUTHORIZED_JOB'
    end
    
    if account.id == targetAccountId then
        return { following = false, requested = false, error = 'self_target' }
    end

    local targetAccount = MySQL.single.await(
        'SELECT id, identifier, is_private FROM phone_chirp_accounts WHERE id = ?',
        { targetAccountId }
    )
    if not targetAccount then
        return { following = false, requested = false, error = 'target_not_found' }
    end
    
    local existing = MySQL.scalar.await(
        'SELECT 1 FROM phone_chirp_following WHERE follower_id = ? AND following_id = ?',
        { account.id, targetAccountId }
    )
    
    if existing then
        MySQL.execute.await(
            'DELETE FROM phone_chirp_following WHERE follower_id = ? AND following_id = ?',
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
              AND type = 'chirp'
              AND status = 'pending'
        ]], { identifier, targetAccount.identifier })

        if pendingRequest then
            MySQL.update.await([[
                UPDATE phone_friend_requests
                SET status = 'cancelled', responded_at = CURRENT_TIMESTAMP
                WHERE from_identifier = ?
                  AND to_identifier = ?
                  AND type = 'chirp'
                  AND status = 'pending'
            ]], { identifier, targetAccount.identifier })

            return { following = false, requested = false, cancelled = true }
        end

        MySQL.insert.await([[
            INSERT INTO phone_friend_requests (from_identifier, to_identifier, type, status, created_at, responded_at)
            VALUES (?, ?, 'chirp', 'pending', CURRENT_TIMESTAMP, NULL)
            ON DUPLICATE KEY UPDATE
                status = 'pending',
                responded_at = NULL,
                created_at = CURRENT_TIMESTAMP
        ]], { identifier, targetAccount.identifier })

        UpsertSocialNotification(targetAccount.identifier, identifier, 'chirp', 'follow_request', account.id, 'account', account.display_name)

        return { following = false, requested = true }
    end

    MySQL.insert.await(
        'INSERT IGNORE INTO phone_chirp_following (follower_id, following_id) VALUES (?, ?)',
        { account.id, targetAccountId }
    )

    MySQL.update.await([[
        UPDATE phone_friend_requests
        SET status = 'accepted', responded_at = CURRENT_TIMESTAMP
        WHERE from_identifier = ?
          AND to_identifier = ?
          AND type = 'chirp'
          AND status = 'pending'
    ]], { identifier, targetAccount.identifier })

    RefreshFollowCounts(account.id, targetAccountId)

    return { following = true, requested = false }
end)

lib.callback.register('gcphone:chirp:getPendingFollowRequests', function(source)
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
        JOIN phone_chirp_accounts a ON a.identifier = fr.from_identifier
        WHERE fr.to_identifier = ?
          AND fr.type = 'chirp'
          AND fr.status = 'pending'
        ORDER BY fr.created_at DESC
    ]], { identifier }) or {}
end)

lib.callback.register('gcphone:chirp:getSentFollowRequests', function(source)
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
        JOIN phone_chirp_accounts a ON a.identifier = fr.to_identifier
        WHERE fr.from_identifier = ?
          AND fr.type = 'chirp'
          AND fr.status = 'pending'
        ORDER BY fr.created_at DESC
    ]], { identifier }) or {}
end)

lib.callback.register('gcphone:chirp:respondFollowRequest', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false end
    if type(data) ~= 'table' then return false end

    local requestId = tonumber(data.requestId)
    local accept = data.accept == true
    if not requestId or requestId < 1 then return false end

    local chirpMs = GetRateLimitWindow('chirp', 1400)
    if HitRateLimit(source, 'chirp_follow_requests', chirpMs, 3) then
        return false
    end

    local request = MySQL.single.await([[
        SELECT id, from_identifier, to_identifier
        FROM phone_friend_requests
        WHERE id = ?
          AND to_identifier = ?
          AND type = 'chirp'
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
        'INSERT IGNORE INTO phone_chirp_following (follower_id, following_id) VALUES (?, ?)',
        { requesterAccount.id, targetAccount.id }
    )

    RefreshFollowCounts(requesterAccount.id, targetAccount.id)
    UpsertSocialNotification(request.from_identifier, identifier, 'chirp', 'follow_accepted', targetAccount.id, 'account', targetAccount.display_name)

    return true
end)

lib.callback.register('gcphone:chirp:cancelFollowRequest', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false end
    if type(data) ~= 'table' then return false end

    local targetAccountId = tonumber(data.targetAccountId)
    if not targetAccountId or targetAccountId < 1 then return false end

    local chirpMs = GetRateLimitWindow('chirp', 1400)
    if HitRateLimit(source, 'chirp_follow_requests', chirpMs, 3) then
        return false
    end

    local targetAccount = MySQL.single.await(
        'SELECT identifier FROM phone_chirp_accounts WHERE id = ?',
        { targetAccountId }
    )
    if not targetAccount then return false end

    MySQL.update.await([[
        UPDATE phone_friend_requests
        SET status = 'cancelled', responded_at = CURRENT_TIMESTAMP
        WHERE from_identifier = ?
          AND to_identifier = ?
          AND type = 'chirp'
          AND status = 'pending'
    ]], { identifier, targetAccount.identifier })

    return true
end)

lib.callback.register('gcphone:chirp:getProfile', function(source, data)
    local identifier = GetIdentifier(source)
    if type(data) ~= 'table' then return nil end

    local accountId = tonumber(data.accountId)
    if not accountId or accountId < 1 then return nil end
    
    local account = MySQL.single.await(
        'SELECT * FROM phone_chirp_accounts WHERE id = ?',
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
            'SELECT 1 FROM phone_chirp_following WHERE follower_id = ? AND following_id = ? LIMIT 1',
            { viewerAccount.id, account.id }
        ) and true or false

        requestedByMe = MySQL.scalar.await([[
            SELECT 1
            FROM phone_friend_requests
            WHERE from_identifier = ?
              AND to_identifier = ?
              AND type = 'chirp'
              AND status = 'pending'
            LIMIT 1
        ]], { viewerAccount.identifier, account.identifier }) and true or false

        requestedFromThem = MySQL.scalar.await([[
            SELECT 1
            FROM phone_friend_requests
            WHERE from_identifier = ?
              AND to_identifier = ?
              AND type = 'chirp'
              AND status = 'pending'
            LIMIT 1
        ]], { account.identifier, viewerAccount.identifier }) and true or false
    end

    local canViewTweets = (tonumber(account.is_private) ~= 1) or isOwnProfile or isFollowing
    
    local tweets = {}
    if canViewTweets then
        tweets = MySQL.query.await(
            'SELECT * FROM phone_chirp_tweets WHERE account_id = ? ORDER BY created_at DESC LIMIT 50',
            { accountId }
        ) or {}
    end
    
    return {
        account = account,
        tweets = tweets,
        relationship = {
            isFollowing = isFollowing,
            requestedByMe = requestedByMe,
            requestedFromThem = requestedFromThem,
            isOwnProfile = isOwnProfile,
            canViewTweets = canViewTweets,
        }
    }
end)
