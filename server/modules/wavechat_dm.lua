local Bridge = require 'server.bridge'
local Utils = require 'server.lib.utils'

local function GetPhoneNumber(source)
    local identifier = Bridge.GetIdentifier(source)
    if not identifier then return nil end
    return Bridge.GetPhoneNumber(identifier)
end

local function GetSourceByPhone(phone)
    if not phone then return nil end
    local identifier = Bridge.GetIdentifierByPhone(phone)
    if not identifier then return nil end
    return Bridge.GetSourceFromIdentifier(identifier)
end

local function CapConversationMessages(phoneA, phoneB)
    MySQL.query.await([[
        DELETE FROM phone_wavechat_dm_messages
        WHERE id IN (
            SELECT id FROM (
                SELECT id
                FROM phone_wavechat_dm_messages
                WHERE (sender = ? AND receiver = ?) OR (sender = ? AND receiver = ?)
                ORDER BY created_at DESC, id DESC
                LIMIT 18446744073709551615 OFFSET 50
            ) AS overflow
        )
    ]], { phoneA, phoneB, phoneB, phoneA })
end

-- Running MySQL.query.await at the top of the module races the oxmysql
-- handshake the same way phone_drop.lua did before it was gated. Defer
-- the defensive schema patch until MySQL.ready, and use ADD COLUMN IF
-- NOT EXISTS so we do not need pcall to swallow "duplicate column".
CreateThread(function()
    MySQL.ready(function()
        MySQL.query.await([[
            CREATE TABLE IF NOT EXISTS phone_wavechat_dm_hidden (
                phone VARCHAR(20) NOT NULL,
                partner VARCHAR(20) NOT NULL,
                hidden_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (phone, partner)
            )
        ]])

        MySQL.query.await(
            'ALTER TABLE phone_wavechat_dm_messages ADD COLUMN IF NOT EXISTS deleted_at DATETIME DEFAULT NULL'
        )
    end)
end)

lib.callback.register('gcphone:wavechat:dm:send', function(source, data)
    if type(data) ~= 'table' then return { success = false, error = 'INVALID_DATA' } end

    local identifier = Bridge.GetIdentifier(source)
    if not identifier then return { success = false, error = 'NOT_IDENTIFIED' } end

    local myPhone = GetPhoneNumber(source)
    if not myPhone then return { success = false, error = 'NO_PHONE' } end

    local targetPhone = Utils.SafePhone(data.targetPhone)
    if not targetPhone or targetPhone == '' then return { success = false, error = 'INVALID_TARGET' } end
    if targetPhone == myPhone then return { success = false, error = 'SELF_MESSAGE' } end

    local content = Utils.SanitizeText(data.content, 800, true)
    local mediaUrl = Utils.SanitizeMediaUrl(data.mediaUrl, nil, 500)

    if (not content or content == '') and not mediaUrl then
        return { success = false, error = 'EMPTY_MESSAGE' }
    end

    if Utils.HitRateLimit(source, 'wavechat_dm', 700, 3) then
        return { success = false, error = 'RATE_LIMITED' }
    end

    local messageType = 'text'
    local audioData = nil
    local audioDuration = nil

    if data.message_type == 'audio' then
        messageType = 'audio'
        audioData = Utils.SanitizeMediaUrl(data.audio_data, nil, 500)
        audioDuration = Utils.SafeNumber(data.audio_duration, 0, 127)
    end

    local messageId = MySQL.insert.await(
        'INSERT INTO phone_wavechat_dm_messages (sender, receiver, message, media_url, message_type, audio_data, audio_duration) VALUES (?, ?, ?, ?, ?, ?, ?)',
        { myPhone, targetPhone, content or '', mediaUrl, messageType, audioData, audioDuration }
    )

    if not messageId then
        return { success = false, error = 'DB_ERROR' }
    end

    CapConversationMessages(myPhone, targetPhone)

    local messageObj = MySQL.single.await(
        'SELECT id, sender, receiver, message, media_url, message_type, audio_data, audio_duration, is_read, created_at FROM phone_wavechat_dm_messages WHERE id = ?',
        { messageId }
    )

    local targetSource = GetSourceByPhone(targetPhone)
    if targetSource then
        TriggerClientEvent('gcphone:wavechat:dm:message', targetSource, messageObj)
    end

    return { success = true, message = messageObj }
end)

lib.callback.register('gcphone:wavechat:dm:getHistory', function(source, data)
    if Utils.HitRateLimit(source, 'wavechat_dm_history', 1000, 5) then
        return { success = false, error = 'RATE_LIMITED' }
    end

    if type(data) ~= 'table' then return { success = false, error = 'INVALID_DATA' } end

    local myPhone = GetPhoneNumber(source)
    if not myPhone then return { success = false, error = 'NO_PHONE' } end

    local targetPhone = Utils.SafePhone(data.targetPhone)
    if not targetPhone or targetPhone == '' then return { success = false, error = 'INVALID_TARGET' } end

    local rows = MySQL.query.await([[
        SELECT m.id, m.sender, m.receiver, m.message, m.media_url, m.message_type, m.audio_data, m.audio_duration, m.is_read, m.created_at, m.deleted_at
        FROM phone_wavechat_dm_messages m
        LEFT JOIN phone_wavechat_dm_hidden h ON h.phone = ? AND h.partner = ?
        WHERE ((m.sender = ? AND m.receiver = ?) OR (m.sender = ? AND m.receiver = ?))
          AND (h.hidden_at IS NULL OR m.created_at > h.hidden_at)
        ORDER BY m.created_at DESC
        LIMIT 50
    ]], { myPhone, targetPhone, myPhone, targetPhone, targetPhone, myPhone }) or {}

    local messages = {}
    for i = #rows, 1, -1 do
        messages[#messages + 1] = rows[i]
    end

    return { success = true, messages = messages }
end)

lib.callback.register('gcphone:wavechat:dm:getConversations', function(source)
    if Utils.HitRateLimit(source, 'wavechat_dm_convos', 2000, 3) then
        return { success = false, error = 'RATE_LIMITED' }
    end

    local myPhone = GetPhoneNumber(source)
    if not myPhone then return { success = false, error = 'NO_PHONE' } end

    -- Split OR into UNION ALL for index-friendly scans on sender and receiver separately.
    -- Step 1: get last message per partner. Step 2: count unreads separately.
    local rows = MySQL.query.await([[
        SELECT
            c.partner,
            c.last_message,
            c.last_media_url,
            c.last_message_type,
            c.last_created_at,
            COALESCE(u.unread_count, 0) AS unread_count
        FROM (
            SELECT partner, last_message, last_media_url, last_message_type, last_created_at,
                   ROW_NUMBER() OVER (PARTITION BY partner ORDER BY last_created_at DESC) AS rn
            FROM (
                SELECT receiver AS partner, message AS last_message, media_url AS last_media_url,
                       message_type AS last_message_type, created_at AS last_created_at
                FROM phone_wavechat_dm_messages WHERE sender = ?
                UNION ALL
                SELECT sender AS partner, message AS last_message, media_url AS last_media_url,
                       message_type AS last_message_type, created_at AS last_created_at
                FROM phone_wavechat_dm_messages WHERE receiver = ?
            ) combined
        ) c
        LEFT JOIN (
            SELECT sender AS partner, COUNT(*) AS unread_count
            FROM phone_wavechat_dm_messages
            WHERE receiver = ? AND is_read = 0
            GROUP BY sender
        ) u ON u.partner = c.partner
        LEFT JOIN phone_wavechat_dm_hidden h ON h.phone = ? AND h.partner = c.partner
        WHERE c.rn = 1
          AND (h.hidden_at IS NULL OR c.last_created_at > h.hidden_at)
        ORDER BY c.last_created_at DESC
        LIMIT 50
    ]], { myPhone, myPhone, myPhone, myPhone }) or {}

    return { success = true, conversations = rows }
end)

lib.callback.register('gcphone:wavechat:dm:markRead', function(source, data)
    if type(data) ~= 'table' then return { success = false, error = 'INVALID_DATA' } end
    if Utils.HitRateLimit(source, 'wavechat_dm_read', 1000, 5) then
        return { success = false, error = 'RATE_LIMITED' }
    end

    local myPhone = GetPhoneNumber(source)
    if not myPhone then return { success = false, error = 'NO_PHONE' } end

    local targetPhone = Utils.SafePhone(data.targetPhone)
    if not targetPhone or targetPhone == '' then return { success = false, error = 'INVALID_TARGET' } end

    MySQL.query.await(
        'UPDATE phone_wavechat_dm_messages SET is_read = 1 WHERE receiver = ? AND sender = ? AND is_read = 0',
        { myPhone, targetPhone }
    )

    return { success = true }
end)

lib.callback.register('gcphone:wavechat:dm:deleteConversation', function(source, data)
    if type(data) ~= 'table' then return { success = false, error = 'INVALID_DATA' } end

    local myPhone = GetPhoneNumber(source)
    if not myPhone then return { success = false, error = 'NO_PHONE' } end

    local targetPhone = Utils.SafePhone(data.targetPhone)
    if not targetPhone or targetPhone == '' then return { success = false, error = 'INVALID_TARGET' } end

    MySQL.query.await([[
        INSERT INTO phone_wavechat_dm_hidden (phone, partner, hidden_at)
        VALUES (?, ?, NOW())
        ON DUPLICATE KEY UPDATE hidden_at = NOW()
    ]], { myPhone, targetPhone })

    return { success = true }
end)

lib.callback.register('gcphone:wavechat:dm:deleteMessage', function(source, data)
    if type(data) ~= 'table' then return { success = false, error = 'INVALID_DATA' } end
    if Utils.HitRateLimit(source, 'wavechat_dm_del_msg', 1000, 5) then
        return { success = false, error = 'RATE_LIMITED' }
    end

    local myPhone = GetPhoneNumber(source)
    if not myPhone then return { success = false, error = 'NO_PHONE' } end

    local messageId = tonumber(data.messageId)
    if not messageId or messageId < 1 then return { success = false, error = 'INVALID_MESSAGE' } end

    local msg = MySQL.single.await(
        'SELECT id, sender, receiver, created_at FROM phone_wavechat_dm_messages WHERE id = ? LIMIT 1',
        { messageId }
    )
    if not msg then return { success = false, error = 'NOT_FOUND' } end

    local isSender = msg.sender == myPhone
    local isParticipant = isSender or msg.receiver == myPhone
    if not isParticipant then return { success = false, error = 'NOT_AUTHORIZED' } end

    local deleteForAllMinutes = tonumber(Config.WaveChatDM and Config.WaveChatDM.DeleteForAllMinutes) or 5
    local ageSeconds = os.difftime(os.time(), type(msg.created_at) == 'number' and msg.created_at or os.time())

    -- Sender can delete for everyone within the time window
    if isSender and ageSeconds <= (deleteForAllMinutes * 60) then
        MySQL.update.await(
            'UPDATE phone_wavechat_dm_messages SET deleted_at = NOW(), message = "", media_url = NULL, audio_data = NULL WHERE id = ? AND sender = ?',
            { messageId, myPhone }
        )

        local otherPhone = msg.sender == myPhone and msg.receiver or msg.sender
        local otherSource = GetSourceByPhone(otherPhone)
        if otherSource then
            TriggerClientEvent('gcphone:wavechat:dm:messageDeleted', otherSource, { messageId = messageId, phone = myPhone })
        end

        return { success = true, deletedForAll = true }
    end

    -- Otherwise: only hide for the requester (no DB change, client handles locally)
    return { success = true, deletedForAll = false }
end)

lib.callback.register('gcphone:wavechat:dm:typing', function(source, data)
    if type(data) ~= 'table' then return end

    local myPhone = GetPhoneNumber(source)
    if not myPhone then return end

    local targetPhone = Utils.SafePhone(data.targetPhone)
    if not targetPhone or targetPhone == '' or targetPhone == myPhone then return end

    local typing = data.typing == true

    local targetSource = GetSourceByPhone(targetPhone)
    if targetSource then
        TriggerClientEvent('gcphone:wavechat:dm:typing', targetSource, { phone = myPhone, typing = typing })
    end
end)

-- ── Retention cleanup ──
-- Hard-deletes messages older than Config.WaveChatDM.RetentionDays
-- Also cleans up stale hidden entries whose messages are all gone

local CLEANUP_INTERVAL_MS = 60 * 60 * 1000 -- 1 hour
local RetentionTimer = nil

local function RunRetentionCleanup()
    local days = tonumber(Config.WaveChatDM and Config.WaveChatDM.RetentionDays) or 30
    if days <= 0 then return end

    local deleted = MySQL.update.await(
        'DELETE FROM phone_wavechat_dm_messages WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)',
        { days }
    )
    if deleted and deleted > 0 then
        print(('[gcphone:wavechat:dm] Retention cleanup: deleted %d messages older than %d days'):format(deleted, days))
    end

    -- Clean hidden entries where no messages remain
    MySQL.query.await([[
        DELETE h FROM phone_wavechat_dm_hidden h
        LEFT JOIN phone_wavechat_dm_messages m
            ON (m.sender = h.phone AND m.receiver = h.partner)
            OR (m.sender = h.partner AND m.receiver = h.phone)
        WHERE m.id IS NULL
    ]])
end

RetentionTimer = lib.timer(CLEANUP_INTERVAL_MS, function()
    RunRetentionCleanup()
    RetentionTimer:restart()
end, true)

-- ── Server export: GetDMHistory ──
-- For external scripts (police MDT, admin panel) to read ALL messages
-- including those hidden by the user via soft-delete.
-- Usage: exports['gcphone-next']:GetDMHistory(phoneNumber, limit)

local function GetDMHistory(phoneNumber, limit)
    local phone = Utils.SafePhone(phoneNumber)
    if not phone or phone == '' then return nil end

    local maxRows = tonumber(limit) or 200
    if maxRows < 1 then maxRows = 1 end
    if maxRows > 1000 then maxRows = 1000 end

    local rows = MySQL.query.await([[
        SELECT id, sender, receiver, message, media_url, message_type, audio_data, audio_duration, is_read, created_at
        FROM phone_wavechat_dm_messages
        WHERE sender = ? OR receiver = ?
        ORDER BY created_at DESC
        LIMIT ?
    ]], { phone, phone, maxRows })

    return rows or {}
end

exports('GetDMHistory', GetDMHistory)

-- ── Server export: GetDMConversation ──
-- Get messages between two specific numbers (for police investigation)
-- Usage: exports['gcphone-next']:GetDMConversation(phoneA, phoneB, limit)

local function GetDMConversation(phoneA, phoneB, limit)
    local a = Utils.SafePhone(phoneA)
    local b = Utils.SafePhone(phoneB)
    if not a or a == '' or not b or b == '' then return nil end

    local maxRows = tonumber(limit) or 200
    if maxRows < 1 then maxRows = 1 end
    if maxRows > 1000 then maxRows = 1000 end

    local rows = MySQL.query.await([[
        SELECT id, sender, receiver, message, media_url, message_type, audio_data, audio_duration, is_read, created_at
        FROM phone_wavechat_dm_messages
        WHERE (sender = ? AND receiver = ?) OR (sender = ? AND receiver = ?)
        ORDER BY created_at DESC
        LIMIT ?
    ]], { a, b, b, a, maxRows })

    return rows or {}
end

exports('GetDMConversation', GetDMConversation)

AddEventHandler('onResourceStop', function(resourceName)
    if resourceName ~= cache.resource or not RetentionTimer then return end
    RetentionTimer:forceEnd(false)
end)

return {}
