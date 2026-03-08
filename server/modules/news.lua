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

local function IsPublishJobAllowed(source)
    local rules = Config.PublishJobs and Config.PublishJobs.news
    if type(rules) ~= 'table' or #rules == 0 then
        return true
    end

    local job = GetJob(source)
    local jobName = type(job) == 'table' and tostring(job.name or ''):lower() or ''
    if jobName == '' then
        return false
    end

    for _, allowed in ipairs(rules) do
        if tostring(allowed):lower() == jobName then
            return true
        end
    end

    return false
end

local function SanitizeScaleform(data)
    data = type(data) == 'table' and data or {}
    local preset = SanitizeText(data.preset, 20)
    if preset == '' then preset = 'breaking' end
    if preset ~= 'breaking' and preset ~= 'ticker' and preset ~= 'flash' then
        preset = 'breaking'
    end

    return {
        preset = preset,
        headline = SanitizeText(data.headline, 80),
        subtitle = SanitizeText(data.subtitle, 120),
        ticker = SanitizeText(data.ticker, 180),
    }
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

local function GetRateLimitWindow(key, fallback)
    local value = tonumber(Config.Security and Config.Security.RateLimits and Config.Security.RateLimits[key]) or fallback
    if not value or value < 100 then
        value = fallback
    end
    return math.floor(value)
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

    local newsMs = GetRateLimitWindow('news', 2500)
    if HitRateLimit(source, 'news_publish', newsMs, 1) then
        return false, 'RATE_LIMITED'
    end
    
    if not IsPublishJobAllowed(source) then
        return false, 'NOT_AUTHORIZED_JOB'
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

    local newsMs = GetRateLimitWindow('news', 2500)
    if HitRateLimit(source, 'news_live', newsMs, 1) then
        return false, 'RATE_LIMITED'
    end
    
    if not IsPublishJobAllowed(source) then
        return false, 'NOT_AUTHORIZED_JOB'
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

    local scaleform = SanitizeScaleform(data.scaleform)

    local articleId = MySQL.insert.await(
        'INSERT INTO phone_news (identifier, author_name, author_avatar, author_verified, title, content, category, is_live, live_viewers) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0)',
        { identifier, name, avatar, verified and 1 or 0, title, content, category, 1, 0 }
    )
    
    ActiveLiveNews[articleId] = {
        source = source,
        identifier = identifier,
        startTime = os.time(),
        scaleform = scaleform,
    }
    
    local article = MySQL.single.await(
        'SELECT * FROM phone_news WHERE id = ?',
        { articleId }
    )
    article.scaleform = scaleform
    
    TriggerClientEvent('gcphone:news:liveStarted', -1, article)
    
    return true, { articleId = articleId }
end)

lib.callback.register('gcphone:news:setScaleform', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false end
    if type(data) ~= 'table' then return false end

    local articleId = tonumber(data.articleId)
    if not articleId or articleId < 1 then return false end

    if HitRateLimit(source, 'news_scaleform', 1200, 8) then
        return false
    end

    local liveData = ActiveLiveNews[articleId]
    if not liveData or liveData.identifier ~= identifier then
        return false
    end

    local scaleform = SanitizeScaleform(data.scaleform)
    liveData.scaleform = scaleform
    TriggerClientEvent('gcphone:news:scaleformUpdated', -1, articleId, scaleform)
    return true
end)

lib.callback.register('gcphone:news:getScaleform', function(source, articleId)
    local id = tonumber(articleId)
    if not id or id < 1 then return nil end
    local liveData = ActiveLiveNews[id]
    if not liveData then return nil end
    return liveData.scaleform
end)

lib.callback.register('gcphone:news:endLive', function(source, articleId)
    local identifier = GetIdentifier(source)
    if not identifier then return false end

    local id = tonumber(articleId)
    if not id or id < 1 then return false end
    
    MySQL.execute.await(
        'UPDATE phone_news SET is_live = 0 WHERE id = ? AND identifier = ?',
        { id, identifier }
    )
    
    ActiveLiveNews[id] = nil
    
    TriggerClientEvent('gcphone:news:liveEnded', -1, id)
    
    return true
end)

lib.callback.register('gcphone:news:deleteArticle', function(source, articleId)
    local identifier = GetIdentifier(source)
    if not identifier then return false end

    local id = tonumber(articleId)
    if not id or id < 1 then return false end
    
    MySQL.execute.await(
        'DELETE FROM phone_news WHERE id = ? AND identifier = ?',
        { id, identifier }
    )
    
    return true
end)

lib.callback.register('gcphone:news:viewArticle', function(source, articleId)
    local id = tonumber(articleId)
    if not id or id < 1 then return false end

    MySQL.update.await(
        'UPDATE phone_news SET views = views + 1 WHERE id = ?',
        { id }
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
