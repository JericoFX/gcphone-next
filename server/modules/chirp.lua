-- Creado/Modificado por JericoFX

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

lib.callback.register('gcphone:chirp:getTweets', function(source, data)
    local identifier = GetIdentifier(source)

    data = type(data) == 'table' and data or {}
    local tab = data.tab == 'following' and 'following' or 'forYou'
    local limit = tonumber(data.limit) or 50
    local offset = tonumber(data.offset) or 0
    if limit < 1 then limit = 1 end
    if limit > 100 then limit = 100 end
    if offset < 0 then offset = 0 end
    
    local tweets
    
    if tab == 'following' then
        local account = GetAccount(identifier)
        if not account then
            tweets = {}
        else
            tweets = MySQL.query.await([[
                SELECT t.*, a.username, a.display_name, a.avatar, a.verified
                FROM phone_chirp_tweets t
                JOIN phone_chirp_accounts a ON t.account_id = a.id
                JOIN phone_chirp_following f ON f.following_id = t.account_id
                WHERE f.follower_id = ?
                ORDER BY t.created_at DESC
                LIMIT ? OFFSET ?
            ]], { account.id, limit, offset }) or {}
        end
    else
        tweets = MySQL.query.await([[
            SELECT t.*, a.username, a.display_name, a.avatar, a.verified
            FROM phone_chirp_tweets t
            JOIN phone_chirp_accounts a ON t.account_id = a.id
            ORDER BY t.created_at DESC
            LIMIT ? OFFSET ?
        ]], { limit, offset }) or {}
    end
    
    if identifier then
        local account = GetAccount(identifier)
        if account then
            for _, tweet in ipairs(tweets) do
                local liked = MySQL.scalar.await(
                    'SELECT 1 FROM phone_chirp_likes WHERE tweet_id = ? AND account_id = ?',
                    { tweet.id, account.id }
                )
                tweet.liked = liked ~= nil
            end
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
        SELECT t.*, a.username, a.display_name, a.avatar, a.verified
        FROM phone_chirp_tweets t
        JOIN phone_chirp_accounts a ON t.account_id = a.id
        WHERE t.id = ?
    ]], { tweetId })
    
    tweet.liked = false
    
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
