-- Creado/Modificado por JericoFX

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

local SecurityResource = GetCurrentResourceName()

local function HitRateLimit(source, key, windowMs, maxHits)
    local ok, blocked = pcall(function()
        return exports[SecurityResource]:HitRateLimit(source, key, windowMs, maxHits)
    end)
    if not ok then return false end
    return blocked == true
end

lib.callback.register('gcphone:clips:getFeed', function(source, data)
    local _ = GetIdentifier(source)
    data = type(data) == 'table' and data or {}
    local limit = tonumber(data.limit) or 30
    local offset = tonumber(data.offset) or 0
    if limit < 1 then limit = 1 end
    if limit > 100 then limit = 100 end
    if offset < 0 then offset = 0 end

    return MySQL.query.await([[
        SELECT c.*, a.username, a.display_name, a.avatar
        FROM phone_clips_posts c
        JOIN phone_snap_accounts a ON c.account_id = a.id
        ORDER BY c.created_at DESC
        LIMIT ? OFFSET ?
    ]], { limit, offset }) or {}
end)

lib.callback.register('gcphone:clips:publish', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false end
    if type(data) ~= 'table' then return false end

    local account = GetSnapAccount(identifier)
    if not account then return false, 'Account not found' end

    local clipsMs = (Config.Security and Config.Security.RateLimits and Config.Security.RateLimits.clips) or 1500
    if HitRateLimit(source, 'clips_publish', clipsMs, 1) then
        return false, 'RATE_LIMITED'
    end

    local mediaUrl = SanitizeVideoUrl(data.mediaUrl)
    local caption = SanitizeText(data.caption, 500)
    if not mediaUrl then return false, 'Invalid video' end

    local postId = MySQL.insert.await(
        'INSERT INTO phone_clips_posts (account_id, media_url, caption) VALUES (?, ?, ?)',
        { account.id, mediaUrl, caption ~= '' and caption or nil }
    )

    local post = MySQL.single.await([[
        SELECT c.*, a.username, a.display_name, a.avatar
        FROM phone_clips_posts c
        JOIN phone_snap_accounts a ON c.account_id = a.id
        WHERE c.id = ?
    ]], { postId })

    return true, post
end)

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

lib.callback.register('gcphone:clips:toggleLike', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false end
    if type(data) ~= 'table' then return false end
    local postId = tonumber(data.postId)
    if not postId then return false end

    MySQL.update.await('UPDATE phone_clips_posts SET likes = likes + 1 WHERE id = ?', { postId })
    return true
end)
