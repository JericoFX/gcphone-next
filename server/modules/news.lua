-- Creado/Modificado por JericoFX

local function SanitizeText(value, maxLength)
    if type(value) ~= 'string' then return '' end
    local text = value:gsub('[%z\1-\31\127]', '')
    text = text:gsub('<.->', '')
    text = text:gsub('^%s+', ''):gsub('%s+$', '')
    return text:sub(1, maxLength or 3000)
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

local function ResolveAuthorProfile(identifier, source)
    local fallback = GetName(source) or 'Unknown'
    local account = MySQL.single.await(
        'SELECT username, display_name, avatar FROM phone_snap_accounts WHERE identifier = ? LIMIT 1',
        { identifier }
    )
    if not account then
        return fallback, nil
    end

    local display = SanitizeText(account.display_name, 80)
    local username = SanitizeText(account.username, 30)
    local avatar = SanitizeMediaUrl(account.avatar)

    if display ~= '' then
        return display, avatar
    end
    if username ~= '' then
        return username, avatar
    end
    return fallback, avatar
end

local ActiveLiveNews = {}
local SecurityResource = GetCurrentResourceName()

local function HitRateLimit(source, key, windowMs, maxHits)
    local ok, blocked = pcall(function()
        return exports[SecurityResource]:HitRateLimit(source, key, windowMs, maxHits)
    end)
    if not ok then return false end
    return blocked == true
end

lib.callback.register('gcphone:news:getArticles', function(source, data)
    data = type(data) == 'table' and data or {}
    local category = SanitizeText(data.category, 30)
    if category == '' then category = 'all' end
    local limit = tonumber(data.limit) or 50
    local offset = tonumber(data.offset) or 0
    if limit < 1 then limit = 1 end
    if limit > 100 then limit = 100 end
    if offset < 0 then offset = 0 end
    
    local articles
    
    if category == 'all' then
        articles = MySQL.query.await(
            'SELECT * FROM phone_news ORDER BY created_at DESC LIMIT ? OFFSET ?',
            { limit, offset }
        )
    else
        articles = MySQL.query.await(
            'SELECT * FROM phone_news WHERE category = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
            { category, limit, offset }
        )
    end
    
    return articles or {}
end)

lib.callback.register('gcphone:news:getLiveNews', function(source)
    return MySQL.query.await(
        'SELECT * FROM phone_news WHERE is_live = 1 ORDER BY live_viewers DESC'
    ) or {}
end)

lib.callback.register('gcphone:news:publishArticle', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false end

    if type(data) ~= 'table' then return false end
    
    local name, avatar = ResolveAuthorProfile(identifier, source)

    local newsMs = (Config.Security and Config.Security.RateLimits and Config.Security.RateLimits.news) or 2500
    if HitRateLimit(source, 'news_publish', newsMs, 1) then
        return false, 'RATE_LIMITED'
    end
    
    local verified = false
    local job = GetJob(source)
    if job and (job.name == 'police' or job.name == 'news') then
        verified = true
    end
    
    local title = SanitizeText(data.title, 200)
    local content = SanitizeText(data.content, 3000)
    local mediaUrl = SanitizeMediaUrl(data.mediaUrl)
    local mediaType = NormalizeMediaType(data.mediaType)
    local category = SanitizeText(data.category, 30)
    if category == '' then category = 'general' end

    if title == '' or content == '' then
        return false, 'Invalid data'
    end
    
    local articleId = MySQL.insert.await(
        'INSERT INTO phone_news (identifier, author_name, author_avatar, author_verified, title, content, media_url, media_type, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        { identifier, name, avatar, verified and 1 or 0, title, content, mediaUrl, mediaType, category }
    )
    
    local article = MySQL.single.await(
        'SELECT * FROM phone_news WHERE id = ?',
        { articleId }
    )
    
    TriggerClientEvent('gcphone:news:newArticle', -1, article)
    
    return true, article
end)

lib.callback.register('gcphone:news:startLive', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false end

    data = type(data) == 'table' and data or {}
    
    local name, avatar = ResolveAuthorProfile(identifier, source)

    local newsMs = (Config.Security and Config.Security.RateLimits and Config.Security.RateLimits.news) or 2500
    if HitRateLimit(source, 'news_live', newsMs, 1) then
        return false, 'RATE_LIMITED'
    end
    
    local verified = false
    local job = GetJob(source)
    if job and (job.name == 'police' or job.name == 'news') then
        verified = true
    end
    
    local title = SanitizeText(data.title, 200)
    local content = SanitizeText(data.content, 3000)
    local category = SanitizeText(data.category, 30)
    if title == '' then title = 'Transmision en vivo' end
    if content == '' then content = 'Cobertura en vivo' end
    if category == '' then category = 'general' end

    local articleId = MySQL.insert.await(
        'INSERT INTO phone_news (identifier, author_name, author_avatar, author_verified, title, content, category, is_live, live_viewers) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0)',
        { identifier, name, avatar, verified and 1 or 0, title, content, category, 1, 0 }
    )
    
    ActiveLiveNews[articleId] = {
        source = source,
        identifier = identifier,
        startTime = os.time()
    }
    
    local article = MySQL.single.await(
        'SELECT * FROM phone_news WHERE id = ?',
        { articleId }
    )
    
    TriggerClientEvent('gcphone:news:liveStarted', -1, article)
    
    return true, { articleId = articleId }
end)

lib.callback.register('gcphone:news:endLive', function(source, articleId)
    local identifier = GetIdentifier(source)
    if not identifier then return false end
    
    MySQL.execute.await(
        'UPDATE phone_news SET is_live = 0 WHERE id = ? AND identifier = ?',
        { articleId, identifier }
    )
    
    ActiveLiveNews[articleId] = nil
    
    TriggerClientEvent('gcphone:news:liveEnded', -1, articleId)
    
    return true
end)

lib.callback.register('gcphone:news:deleteArticle', function(source, articleId)
    local identifier = GetIdentifier(source)
    if not identifier then return false end
    
    MySQL.execute.await(
        'DELETE FROM phone_news WHERE id = ? AND identifier = ?',
        { articleId, identifier }
    )
    
    return true
end)

lib.callback.register('gcphone:news:viewArticle', function(source, articleId)
    MySQL.update.await(
        'UPDATE phone_news SET views = views + 1 WHERE id = ?',
        { articleId }
    )
    
    return true
end)

lib.callback.register('gcphone:news:getCategories', function(source)
    return Config.News.Categories
end)

CreateThread(function()
    while true do
        Wait(60000)
        
        for articleId, liveData in pairs(ActiveLiveNews) do
            local currentTime = os.time()
            if currentTime - liveData.startTime > Config.News.MaxLiveDuration then
                MySQL.execute.await(
                    'UPDATE phone_news SET is_live = 0 WHERE id = ?',
                    { articleId }
                )
                
                TriggerClientEvent('gcphone:news:liveEnded', -1, articleId)
                
                ActiveLiveNews[articleId] = nil
            end
        end
    end
end)
