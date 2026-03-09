-- Creado/Modificado por JericoFX

local Utils = GcPhoneUtils

local function SanitizeText(value, maxLength)
    return Utils.SanitizeText(value, maxLength or 3000, true)
end

local function SanitizeMediaUrl(value)
    return Utils.SanitizeMediaUrl(value, { '.png', '.jpg', '.jpeg', '.webp', '.gif', '.mp4', '.webm', '.mov', '.m3u8' }, 500)
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

local function GetViewerCount(liveData)
    if type(liveData) ~= 'table' or type(liveData.viewers) ~= 'table' then
        return 0
    end

    local count = 0
    for _ in pairs(liveData.viewers) do
        count = count + 1
    end
    return count
end

local function BroadcastViewerCount(articleId)
    local id = tonumber(articleId)
    if not id or id < 1 then return end

    local liveData = ActiveLiveNews[id]
    local viewers = GetViewerCount(liveData)

    MySQL.update.await(
        'UPDATE phone_news SET live_viewers = ? WHERE id = ? AND is_live = 1',
        { viewers, id }
    )

    TriggerClientEvent('gcphone:news:viewersUpdated', -1, {
        articleId = id,
        viewers = viewers,
    })
end

local function RemoveViewerFromLive(articleId, source, identifier)
    local id = tonumber(articleId)
    if not id or id < 1 then return false end

    local liveData = ActiveLiveNews[id]
    if not liveData or type(liveData.viewers) ~= 'table' then
        return false
    end

    local key = identifier or GetIdentifier(source)
    if not key or key == '' then return false end
    if not liveData.viewers[key] then return false end

    liveData.viewers[key] = nil
    BroadcastViewerCount(id)
    return true
end

local function RemoveViewerFromAllLives(source, identifier)
    for articleId in pairs(ActiveLiveNews) do
        RemoveViewerFromLive(articleId, source, identifier)
    end
end

local function BuildLiveParticipantProfile(identifier, source)
    local display, _ = ResolveAuthorProfile(identifier, source)
    local account = MySQL.single.await(
        'SELECT username FROM phone_snap_accounts WHERE identifier = ? LIMIT 1',
        { identifier }
    )

    return {
        username = SanitizeText(account and account.username or '', 30),
        display = display,
    }
end

local function GetLiveChatMessages(liveData)
    if type(liveData) ~= 'table' or type(liveData.messages) ~= 'table' then
        return {}
    end

    return liveData.messages
end

local function PushLiveChatMessage(articleId, liveData, message)
    if type(liveData.messages) ~= 'table' then
        liveData.messages = {}
    end

    liveData.messages[#liveData.messages + 1] = message
    while #liveData.messages > 20 do
        table.remove(liveData.messages, 1)
    end

    TriggerClientEvent('gcphone:news:liveMessage', -1, {
        articleId = articleId,
        message = message,
    })
end

local function BroadcastLiveReaction(articleId, reaction)
    TriggerClientEvent('gcphone:news:liveReaction', -1, {
        articleId = articleId,
        reaction = reaction,
    })
end

local function CanInteractWithLive(liveData, identifier)
    if type(liveData) ~= 'table' or type(identifier) ~= 'string' or identifier == '' then
        return false
    end

    if liveData.identifier == identifier then
        return true
    end

    return type(liveData.viewers) == 'table' and liveData.viewers[identifier] ~= nil
end

local function HitRateLimit(source, key, windowMs, maxHits)
    return Utils.HitRateLimit(source, key, windowMs, maxHits)
end

local function GetRateLimitWindow(key, fallback)
    return Utils.GetRateLimitWindow(key, fallback)
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
        viewers = {},
        messages = {},
        sequence = 0,
    }
    
    local article = MySQL.single.await(
        'SELECT * FROM phone_news WHERE id = ?',
        { articleId }
    )
    article.scaleform = scaleform
    
    TriggerClientEvent('gcphone:news:liveStarted', -1, article)
    
    return true, { articleId = articleId }
end)

lib.callback.register('gcphone:news:joinLive', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false, 'MISSING_IDENTIFIER' end
    if type(data) ~= 'table' then return false, 'INVALID_PAYLOAD' end

    local articleId = tonumber(data.articleId)
    if not articleId or articleId < 1 then return false, 'INVALID_LIVE' end

    local liveData = ActiveLiveNews[articleId]
    if not liveData then return false, 'LIVE_UNAVAILABLE' end
    if liveData.identifier == identifier then
        return true, { articleId = articleId, viewers = GetViewerCount(liveData), messages = GetLiveChatMessages(liveData) }
    end

    if not GetPlayerName(liveData.source) then
        return false, 'HOST_OFFLINE'
    end

    local liveStillActive = MySQL.scalar.await(
        'SELECT 1 FROM phone_news WHERE id = ? AND is_live = 1 LIMIT 1',
        { articleId }
    )
    if not liveStillActive then
        return false, 'LIVE_ENDED'
    end

    liveData.viewers[identifier] = {
        source = source,
        joinedAt = os.time(),
    }
    BroadcastViewerCount(articleId)

    return true, { articleId = articleId, viewers = GetViewerCount(liveData), messages = GetLiveChatMessages(liveData) }
end)

lib.callback.register('gcphone:news:leaveLive', function(source, data)
    local articleId = tonumber(type(data) == 'table' and data.articleId or data)
    if articleId and articleId > 0 then
        RemoveViewerFromLive(articleId, source)
        return true
    end

    RemoveViewerFromAllLives(source)
    return true
end)

lib.callback.register('gcphone:news:sendLiveMessage', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false, 'MISSING_IDENTIFIER' end
    if type(data) ~= 'table' then return false, 'INVALID_PAYLOAD' end
    if HitRateLimit(source, 'news_live_message', 1200, 6) then return false, 'RATE_LIMITED' end

    local articleId = tonumber(data.articleId)
    if not articleId or articleId < 1 then return false, 'INVALID_LIVE' end

    local liveData = ActiveLiveNews[articleId]
    if not liveData or not CanInteractWithLive(liveData, identifier) then
        return false, 'LIVE_UNAVAILABLE'
    end

    local content = SanitizeText(data.content, 180)
    if content == '' then return false, 'INVALID_MESSAGE' end

    liveData.sequence = tonumber(liveData.sequence or 0) + 1
    local profile = BuildLiveParticipantProfile(identifier, source)
    local message = {
        id = string.format('%d:%d', articleId, liveData.sequence),
        username = profile.username ~= '' and profile.username or profile.display,
        display = profile.display,
        content = content,
        createdAt = os.time() * 1000,
    }

    PushLiveChatMessage(articleId, liveData, message)
    return true, { message = message }
end)

lib.callback.register('gcphone:news:sendLiveReaction', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false, 'MISSING_IDENTIFIER' end
    if type(data) ~= 'table' then return false, 'INVALID_PAYLOAD' end
    if HitRateLimit(source, 'news_live_reaction', 900, 8) then return false, 'RATE_LIMITED' end

    local articleId = tonumber(data.articleId)
    if not articleId or articleId < 1 then return false, 'INVALID_LIVE' end

    local liveData = ActiveLiveNews[articleId]
    if not liveData or not CanInteractWithLive(liveData, identifier) then
        return false, 'LIVE_UNAVAILABLE'
    end

    local emoji = SanitizeText(data.reaction, 8)
    if emoji == '' then return false, 'INVALID_REACTION' end

    local profile = BuildLiveParticipantProfile(identifier, source)
    local reaction = {
        id = string.format('%d:%d:%d', articleId, os.time(), math.random(100, 999)),
        reaction = emoji,
        username = profile.username ~= '' and profile.username or profile.display,
        createdAt = os.time() * 1000,
    }

    BroadcastLiveReaction(articleId, reaction)
    return true, { reaction = reaction }
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

AddEventHandler('playerDropped', function()
    RemoveViewerFromAllLives(source)
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
