-- Creado/Modificado por JericoFX
-- Clips (TikTok Clone) - Backend

local function SanitizeText(value, maxLength)
    if type(value) ~= 'string' then return '' end
    local text = value:gsub('[%z\1-\31\127]', '')
    text = text:gsub('<.->', '')
    text = text:gsub('^%s+', ''):gsub('%s+$', '')
    return text:sub(1, maxLength or 500)
end

local function SanitizeVideoUrl(value)
    if type(value) ~= 'string' then return nil end
    local url = value:gsub('[%z\1-\31\127]', '')
    url = url:gsub('^%s+', ''):gsub('%s+$', '')
    if url == '' then return nil end
    if not url:match('^https?://') then return nil end
    local base = (url:match('^[^?]+') or url):lower()
    local allowed = { '.mp4', '.webm', '.mov', '.m3u8' }
    for _, ext in ipairs(allowed) do
        if base:sub(-#ext) == ext then
            return url:sub(1, 500)
        end
    end
    return nil
end

local function GetSnapAccount(identifier)
    if not identifier then return nil end
    return MySQL.single.await('SELECT id, username, display_name, avatar FROM phone_snap_accounts WHERE identifier = ?', { identifier })
end

-- Get clips feed
lib.callback.register('gcphone:clips:getFeed', function(source, data)
    local identifier = GetIdentifier(source)
    data = type(data) == 'table' and data or {}
    local limit = tonumber(data.limit) or 30
    local offset = tonumber(data.offset) or 0
    if limit < 1 then limit = 1 end
    if limit > 100 then limit = 100 end
    if offset < 0 then offset = 0 end

    local account = identifier and GetSnapAccount(identifier) or nil

    local clips = MySQL.query.await([[
        SELECT c.*, a.username, a.display_name, a.avatar,
               (SELECT COUNT(*) FROM phone_clips_comments WHERE clip_id = c.id) as comments_count,
               CASE WHEN c.account_id = ? THEN 1 ELSE 0 END as is_own
        FROM phone_clips_posts c
        JOIN phone_snap_accounts a ON c.account_id = a.id
        ORDER BY c.created_at DESC
        LIMIT ? OFFSET ?
    ]], { account and account.id or 0, limit, offset }) or {}
    
    -- Check if user liked each clip
    if account then
        for _, clip in ipairs(clips) do
            local liked = MySQL.scalar.await(
                'SELECT 1 FROM phone_clips_likes WHERE clip_id = ? AND account_id = ?',
                { clip.id, account.id }
            )
            clip.liked = liked ~= nil
        end
    end
    
    return clips
end)

-- Get my clips only
lib.callback.register('gcphone:clips:getMyClips', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return {} end
    
    data = type(data) == 'table' and data or {}
    local limit = tonumber(data.limit) or 30
    local offset = tonumber(data.offset) or 0
    if limit < 1 then limit = 1 end
    if limit > 100 then limit = 100 end
    if offset < 0 then offset = 0 end

    local account = GetSnapAccount(identifier)
    if not account then return {} end

    local clips = MySQL.query.await([[
        SELECT c.*, a.username, a.display_name, a.avatar,
               (SELECT COUNT(*) FROM phone_clips_comments WHERE clip_id = c.id) as comments_count,
               1 as is_own
        FROM phone_clips_posts c
        JOIN phone_snap_accounts a ON c.account_id = a.id
        WHERE c.account_id = ?
        ORDER BY c.created_at DESC
        LIMIT ? OFFSET ?
    ]], { account.id, limit, offset }) or {}
    
    -- Check if user liked each clip
    for _, clip in ipairs(clips) do
        local liked = MySQL.scalar.await(
            'SELECT 1 FROM phone_clips_likes WHERE clip_id = ? AND account_id = ?',
            { clip.id, account.id }
        )
        clip.liked = liked ~= nil
    end
    
    return clips
end)
lib.callback.register('gcphone:clips:publish', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false end
    if type(data) ~= 'table' then return false end

    local account = GetSnapAccount(identifier)
    if not account then return false, 'Account not found' end

    local mediaUrl = SanitizeVideoUrl(data.mediaUrl)
    local caption = SanitizeText(data.caption, 500)
    if not mediaUrl then return false, 'Invalid video' end

    local postId = MySQL.insert.await(
        'INSERT INTO phone_clips_posts (account_id, media_url, caption, likes) VALUES (?, ?, ?, 0)',
        { account.id, mediaUrl, caption ~= '' and caption or nil }
    )

    local post = MySQL.single.await([[
        SELECT c.*, a.username, a.display_name, a.avatar, 0 as comments_count, 1 as is_own
        FROM phone_clips_posts c
        JOIN phone_snap_accounts a ON c.account_id = a.id
        WHERE c.id = ?
    ]], { postId })

    return true, post
end)

-- Delete clip (only own)
lib.callback.register('gcphone:clips:deletePost', function(source, postId)
    local identifier = GetIdentifier(source)
    if not identifier then return false end

    local account = GetSnapAccount(identifier)
    if not account then return false end

    local id = tonumber(postId)
    if not id then return false end

    MySQL.execute.await('DELETE FROM phone_clips_posts WHERE id = ? AND account_id = ?', { id, account.id })
    return true
end)

-- Toggle like (add/remove)
lib.callback.register('gcphone:clips:toggleLike', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false end
    if type(data) ~= 'table' then return false end
    local postId = tonumber(data.postId)
    if not postId then return false end

    local account = GetSnapAccount(identifier)
    if not account then return false end

    -- Check if already liked
    local existing = MySQL.scalar.await(
        'SELECT id FROM phone_clips_likes WHERE clip_id = ? AND account_id = ?',
        { postId, account.id }
    )
    
    if existing then
        -- Unlike
        MySQL.execute.await(
            'DELETE FROM phone_clips_likes WHERE clip_id = ? AND account_id = ?',
            { postId, account.id }
        )
        MySQL.update.await(
            'UPDATE phone_clips_posts SET likes = GREATEST(0, likes - 1) WHERE id = ?',
            { postId }
        )
        return { liked = false }
    else
        -- Like
        MySQL.insert.await(
            'INSERT INTO phone_clips_likes (clip_id, account_id) VALUES (?, ?)',
            { postId, account.id }
        )
        MySQL.update.await(
            'UPDATE phone_clips_posts SET likes = likes + 1 WHERE id = ?',
            { postId }
        )
        return { liked = true }
    end
end)

-- Get comments
lib.callback.register('gcphone:clips:getComments', function(source, data)
    if type(data) ~= 'table' then return {} end
    local clipId = tonumber(data.clipId)
    if not clipId then return {} end

    return MySQL.query.await([[
        SELECT c.*, a.username, a.display_name, a.avatar
        FROM phone_clips_comments c
        JOIN phone_snap_accounts a ON c.account_id = a.id
        WHERE c.clip_id = ?
        ORDER BY c.created_at ASC
    ]], { clipId }) or {}
end)

-- Add comment
lib.callback.register('gcphone:clips:addComment', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false end
    if type(data) ~= 'table' then return false end
    
    local clipId = tonumber(data.clipId)
    local content = SanitizeText(data.content, 500)
    if not clipId or content == '' then return false end

    local account = GetSnapAccount(identifier)
    if not account then return false end

    local commentId = MySQL.insert.await(
        'INSERT INTO phone_clips_comments (clip_id, account_id, content) VALUES (?, ?, ?)',
        { clipId, account.id, content }
    )

    local comment = MySQL.single.await([[
        SELECT c.*, a.username, a.display_name, a.avatar
        FROM phone_clips_comments c
        JOIN phone_snap_accounts a ON c.account_id = a.id
        WHERE c.id = ?
    ]], { commentId })

    return true, comment
end)

-- Delete comment
lib.callback.register('gcphone:clips:deleteComment', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false end
    if type(data) ~= 'table' then return false end
    
    local commentId = tonumber(data.commentId)
    if not commentId then return false end

    local account = GetSnapAccount(identifier)
    if not account then return false end

    MySQL.execute.await(
        'DELETE FROM phone_clips_comments WHERE id = ? AND account_id = ?',
        { commentId, account.id }
    )

    return true
end)
