-- Creado/Modificado por JericoFX
-- Chirp (Twitter/X Clone) - Backend

local function SanitizeText(value, maxLength)
    if type(value) ~= 'string' then return '' end
    local text = value:gsub('[%z\1-\31\127]', '')
    text = text:gsub('<.->', '')
    text = text:gsub('^%s+', ''):gsub('%s+$', '')
    return text:sub(1, maxLength or 280)
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

local SecurityResource = GetCurrentResourceName()

local function HitRateLimit(source, key, windowMs, maxHits)
    local ok, blocked = pcall(function()
        return exports[SecurityResource]:HitRateLimit(source, key, windowMs, maxHits)
    end)
    if not ok then return false end
    return blocked == true
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

local function GenerateUsername(source)
    local name = GetName(source) or 'User'
    local cleanName = string.lower(string.gsub(name, '%s+', ''))
    local random = math.random(1000, 9999)
    return cleanName .. random
end

lib.callback.register('gcphone:chirp:getAccount', function(source)
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

lib.callback.register('gcphone:chirp:updateAccount', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false end

    if type(data) ~= 'table' then return false end

    local displayName = SanitizeText(data.displayName, 50)
    local avatar = SanitizeMediaUrl(data.avatar)
    local bio = SanitizeText(data.bio, 160)
    if displayName == '' then return false end
    
    MySQL.update.await(
        'UPDATE phone_chirp_accounts SET display_name = ?, avatar = ?, bio = ? WHERE identifier = ?',
        { displayName, avatar, bio, identifier }
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
    local account = identifier and GetAccount(identifier) or nil
    
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
    elseif tab == 'myActivity' and account then
        -- User's own tweets, likes, and comments
        local myTweets = MySQL.query.await([[
            SELECT t.*, a.username, a.display_name, a.avatar, a.verified,
                   (SELECT COUNT(*) FROM phone_chirp_comments WHERE tweet_id = t.id) as comments_count,
                   (SELECT COUNT(*) FROM phone_chirp_rechirps WHERE original_tweet_id = t.id) as rechirps_count,
                   1 as is_own
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
                   1 as liked
            FROM phone_chirp_tweets t
            JOIN phone_chirp_accounts a ON t.account_id = a.id
            JOIN phone_chirp_likes l ON l.tweet_id = t.id
            WHERE l.account_id = ?
            ORDER BY l.created_at DESC
            LIMIT ? OFFSET ?
        ]], { account.id, math.floor(limit / 2), offset }) or {}
        
        tweets = myTweets
        for _, tweet in ipairs(likedTweets) do
            table.insert(tweets, tweet)
        end
        
        -- Sort by created_at
        table.sort(tweets, function(a, b) return a.created_at > b.created_at end)
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
    end
    
    -- Check if user liked each tweet
    if account then
        for _, tweet in ipairs(tweets) do
            local liked = MySQL.scalar.await(
                'SELECT 1 FROM phone_chirp_likes WHERE tweet_id = ? AND account_id = ?',
                { tweet.id, account.id }
            )
            tweet.liked = liked ~= nil
            
            -- Check if rechirped
            local rechirped = MySQL.scalar.await(
                'SELECT 1 FROM phone_chirp_rechirps WHERE original_tweet_id = ? AND account_id = ?',
                { tweet.id, account.id }
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

    local chirpMs = (Config.Security and Config.Security.RateLimits and Config.Security.RateLimits.chirp) or 1400
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
    if not tweetId or tweetId < 1 then return false end
    
    local account = GetAccount(identifier)
    if not account then return false end
    
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
        MySQL.insert.await(
            'INSERT INTO phone_chirp_rechirps (original_tweet_id, account_id) VALUES (?, ?)',
            { tweetId, account.id }
        )
        
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
    
    local commentId = MySQL.insert.await(
        'INSERT INTO phone_chirp_comments (tweet_id, account_id, content) VALUES (?, ?, ?)',
        { tweetId, account.id, content }
    )
    
    -- Update tweet comments count
    MySQL.update.await(
        'UPDATE phone_chirp_tweets SET replies = replies + 1 WHERE id = ?',
        { tweetId }
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
    
    -- Update tweet comments count
    MySQL.update.await(
        'UPDATE phone_chirp_tweets SET replies = GREATEST(0, replies - 1) WHERE id = ?',
        { comment.tweet_id }
    )
    
    return true
end)

lib.callback.register('gcphone:chirp:deleteTweet', function(source, tweetId)
    local identifier = GetIdentifier(source)
    if not identifier then return false end
    
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
    
    if account.id == targetAccountId then
        return false, 'Cannot follow yourself'
    end
    
    local existing = MySQL.scalar.await(
        'SELECT id FROM phone_chirp_following WHERE follower_id = ? AND following_id = ?',
        { account.id, targetAccountId }
    )
    
    if existing then
        MySQL.execute.await(
            'DELETE FROM phone_chirp_following WHERE follower_id = ? AND following_id = ?',
            { account.id, targetAccountId }
        )
        
        return { following = false }
    else
        MySQL.insert.await(
            'INSERT INTO phone_chirp_following (follower_id, following_id) VALUES (?, ?)',
            { account.id, targetAccountId }
        )
        
        return { following = true }
    end
end)

lib.callback.register('gcphone:chirp:getProfile', function(source, data)
    local accountId = data.accountId
    
    local account = MySQL.single.await(
        'SELECT * FROM phone_chirp_accounts WHERE id = ?',
        { accountId }
    )
    
    if not account then return nil end
    
    local tweets = MySQL.query.await(
        'SELECT * FROM phone_chirp_tweets WHERE account_id = ? ORDER BY created_at DESC LIMIT 50',
        { accountId }
    ) or {}
    
    return {
        account = account,
        tweets = tweets
    }
end)
