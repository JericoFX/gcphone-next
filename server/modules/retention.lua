-- Creado/Modificado por JericoFX
-- Retention cleanup is handled by the SQL event scheduler (ev_gcphone_cleanup_runner).
-- This module only ensures required indexes exist on startup.

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
    EnsureIndex('phone_darkrooms_posts', 'idx_darkrooms_posts_created', 'ALTER TABLE phone_darkrooms_posts ADD INDEX idx_darkrooms_posts_created (`created_at`)')
    EnsureIndex('phone_darkrooms_comments', 'idx_darkrooms_comments_created', 'ALTER TABLE phone_darkrooms_comments ADD INDEX idx_darkrooms_comments_created (`created_at`)')
    EnsureIndex('phone_social_notifications', 'idx_social_notifications_created', 'ALTER TABLE phone_social_notifications ADD INDEX idx_social_notifications_created (`created_at`)')
end

MySQL.ready(function()
    EnsureRetentionIndexes()
end)

return {}
