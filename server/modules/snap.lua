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

lib.callback.register('gcphone:snap:follow', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false end

    if type(data) ~= 'table' then return false end
    local targetAccountId = tonumber(data.targetAccountId)
    if not targetAccountId or targetAccountId < 1 then return false end
    
    local account = GetAccount(identifier)
    if not account then return false end
    
    local existing = MySQL.scalar.await(
        'SELECT 1 FROM phone_chirp_following WHERE follower_id = ? AND following_id = ?',
        { account.id, targetAccountId }
    )
    
    if existing then
        MySQL.execute.await(
            'DELETE FROM phone_chirp_following WHERE follower_id = ? AND following_id = ?',
            { account.id, targetAccountId }
        )
        
        MySQL.update.await(
            'UPDATE phone_snap_accounts SET following = GREATEST(0, following - 1) WHERE id = ?',
            { account.id }
        )
        
        MySQL.update.await(
            'UPDATE phone_snap_accounts SET followers = GREATEST(0, followers - 1) WHERE id = ?',
            { targetAccountId }
        )
        
        return { following = false }
    else
        MySQL.insert.await(
            'INSERT INTO phone_chirp_following (follower_id, following_id) VALUES (?, ?)',
            { account.id, targetAccountId }
        )
        
        MySQL.update.await(
            'UPDATE phone_snap_accounts SET following = following + 1 WHERE id = ?',
            { account.id }
        )
        
        MySQL.update.await(
            'UPDATE phone_snap_accounts SET followers = followers + 1 WHERE id = ?',
            { targetAccountId }
        )
        
        return { following = true }
    end
end)

lib.callback.register('gcphone:snap:getProfile', function(source, data)
    local accountId = data.accountId
    
    local account = MySQL.single.await(
        'SELECT * FROM phone_snap_accounts WHERE id = ?',
        { accountId }
    )
    
    if not account then return nil end
    
    local posts = MySQL.query.await(
        'SELECT * FROM phone_snap_posts WHERE account_id = ? AND is_live = 0 ORDER BY created_at DESC LIMIT 50',
        { accountId }
    ) or {}
    
    return {
        account = account,
        posts = posts
    }
end)
