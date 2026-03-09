-- Creado/Modificado por JericoFX

local USE_SQL_CLEANUP_EVENTS = GetConvar('gcphone_sql_cleanup_events', '0') == '1'

local function ClampNumber(value, minValue, maxValue, fallback)
    local num = tonumber(value)
    if not num then return fallback end
    if num < minValue then num = minValue end
    if num > maxValue then num = maxValue end
    return math.floor(num)
end

local function GetRetentionDays()
    local defaultDays = 7
    local configured = GetConvar('gcphone_retention_days', tostring(defaultDays))
    return ClampNumber(configured, 1, 90, defaultDays)
end

local function GetIntervalMs()
    local defaultMinutes = 30
    local configured = GetConvar('gcphone_retention_interval_minutes', tostring(defaultMinutes))
    local minutes = ClampNumber(configured, 5, 240, defaultMinutes)
    return minutes * 60 * 1000
end

local function EnsureIndex(tableName, indexName, ddl)
    local exists = MySQL.scalar.await(
        'SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ? LIMIT 1',
        { tableName, indexName }
    )

    if exists then return end

    local ok = pcall(function()
        MySQL.query.await(ddl)
    end)

    if ok then
        print(('[gcphone-retention] created index %s on %s'):format(indexName, tableName))
    end
end

local function EnsureRetentionIndexes()
    EnsureIndex('phone_messages', 'idx_phone_messages_time', 'ALTER TABLE phone_messages ADD INDEX idx_phone_messages_time (`time`)')
    EnsureIndex('phone_chat_group_messages', 'idx_group_messages_created', 'ALTER TABLE phone_chat_group_messages ADD INDEX idx_group_messages_created (`created_at`)')
    EnsureIndex('phone_contacts', 'idx_identifier_number', 'ALTER TABLE phone_contacts ADD INDEX idx_identifier_number (`identifier`, `number`)')
    EnsureIndex('phone_wavechat_statuses', 'idx_wavechat_status_expires', 'ALTER TABLE phone_wavechat_statuses ADD INDEX idx_wavechat_status_expires (`expires_at`)')
    EnsureIndex('phone_wavechat_statuses', 'idx_wavechat_status_feed', 'ALTER TABLE phone_wavechat_statuses ADD INDEX idx_wavechat_status_feed (`expires_at`, `phone_number`, `created_at`)')
    EnsureIndex('phone_calls', 'idx_phone_calls_time', 'ALTER TABLE phone_calls ADD INDEX idx_phone_calls_time (`time`)')
    EnsureIndex('phone_chirp_tweets', 'idx_chirp_tweets_created', 'ALTER TABLE phone_chirp_tweets ADD INDEX idx_chirp_tweets_created (`created_at`)')
    EnsureIndex('phone_snap_posts', 'idx_snap_posts_created', 'ALTER TABLE phone_snap_posts ADD INDEX idx_snap_posts_created (`created_at`)')
    EnsureIndex('phone_clips_posts', 'idx_clips_posts_created', 'ALTER TABLE phone_clips_posts ADD INDEX idx_clips_posts_created (`created_at`)')
    EnsureIndex('phone_news', 'idx_phone_news_created', 'ALTER TABLE phone_news ADD INDEX idx_phone_news_created (`created_at`)')
    EnsureIndex('phone_news', 'idx_news_live_created', 'ALTER TABLE phone_news ADD INDEX idx_news_live_created (`is_live`, `created_at`)')
    EnsureIndex('phone_market', 'idx_market_created', 'ALTER TABLE phone_market ADD INDEX idx_market_created (`created_at`)')
    EnsureIndex('phone_darkrooms_posts', 'idx_darkrooms_posts_created', 'ALTER TABLE phone_darkrooms_posts ADD INDEX idx_darkrooms_posts_created (`created_at`)')
    EnsureIndex('phone_darkrooms_comments', 'idx_darkrooms_comments_created', 'ALTER TABLE phone_darkrooms_comments ADD INDEX idx_darkrooms_comments_created (`created_at`)')
    EnsureIndex('phone_social_notifications', 'idx_social_notifications_created', 'ALTER TABLE phone_social_notifications ADD INDEX idx_social_notifications_created (`created_at`)')
end

local function PurgeOldRows()
    local days = GetRetentionDays()

    MySQL.query_async('DELETE FROM phone_messages WHERE `time` < (NOW() - INTERVAL ? DAY)', { days })
    MySQL.query_async('DELETE FROM phone_chat_group_messages WHERE created_at < (NOW() - INTERVAL ? DAY)', { days })
    MySQL.query_async("DELETE FROM phone_chat_group_invites WHERE (status != 'pending' AND created_at < (NOW() - INTERVAL 14 DAY)) OR created_at < (NOW() - INTERVAL 30 DAY)", {})
    MySQL.query_async('DELETE FROM phone_wavechat_statuses WHERE expires_at < NOW()', {})
    MySQL.query_async('DELETE FROM phone_calls WHERE `time` < (NOW() - INTERVAL ? DAY)', { days })
    MySQL.query_async('DELETE FROM phone_chirp_tweets WHERE created_at < (NOW() - INTERVAL ? DAY)', { days })
    MySQL.query_async('DELETE FROM phone_snap_posts WHERE created_at < (NOW() - INTERVAL ? DAY)', { days })
    MySQL.query_async('DELETE FROM phone_snap_stories WHERE expires_at < NOW() OR created_at < (NOW() - INTERVAL ? DAY)', { days })
    MySQL.query_async('DELETE FROM phone_clips_posts WHERE created_at < (NOW() - INTERVAL ? DAY)', { days })
    MySQL.query_async('DELETE FROM phone_news WHERE is_live = 0 AND created_at < (NOW() - INTERVAL 10 DAY)', {})
    MySQL.query_async('DELETE FROM phone_market WHERE created_at < (NOW() - INTERVAL ? DAY)', { days })
    MySQL.query_async('DELETE FROM phone_darkrooms_posts WHERE created_at < (NOW() - INTERVAL ? DAY)', { days })
    MySQL.query_async('DELETE FROM phone_darkrooms_comments WHERE created_at < (NOW() - INTERVAL ? DAY)', { days })
    MySQL.query_async('DELETE FROM phone_social_notifications WHERE created_at < (NOW() - INTERVAL ? DAY)', { days })
end

CreateThread(function()
    Wait(3000)
    EnsureRetentionIndexes()

    if USE_SQL_CLEANUP_EVENTS then
        return
    end

    while true do
        PurgeOldRows()
        Wait(GetIntervalMs())
    end
end)
