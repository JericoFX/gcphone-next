local SecurityResource = GetCurrentResourceName()

local function HitRateLimit(source, key, windowMs, maxHits)
    local ok, limited = pcall(function()
        return exports[SecurityResource]:HitRateLimit(source, key, windowMs, maxHits)
    end)

    if ok then
        return limited == true
    end

    return false
end

local function SafeText(value, maxLen)
    if type(value) ~= 'string' then return nil end
    local normalized = value:gsub('[%c]', ''):gsub('^%s+', ''):gsub('%s+$', '')
    if normalized == '' then return nil end
    if maxLen and #normalized > maxLen then
        normalized = normalized:sub(1, maxLen)
    end
    return normalized
end

local function SafeAlias(value)
    local alias = SafeText(value, (Config.Mail and Config.Mail.MaxAliasLength) or 24)
    if not alias then return nil end

    alias = alias:lower()
    if not alias:match('^[a-z0-9._-]+$') then return nil end
    if alias:match('^[._-]') or alias:match('[._-]$') then return nil end
    if alias:find('..', 1, true) then return nil end

    local minLen = math.max(3, tonumber(Config.Mail and Config.Mail.MinAliasLength) or 3)
    if #alias < minLen then return nil end
    return alias
end

local function SafeEmail(value)
    local email = SafeText(value, 128)
    if not email then return nil end

    email = email:lower()
    if not email:match('^[a-z0-9._%%+-]+@[a-z0-9.-]+%.[a-z]+$') then
        return nil
    end

    return email
end

local function MailDomain()
    local domain = SafeText(Config.Mail and Config.Mail.Domain or nil, 64)
    if not domain then
        return 'noimotors.gg'
    end

    return domain:lower()
end

local function GetPrimaryAccount(identifier)
    if not identifier then return nil end
    return MySQL.single.await(
        [[
            SELECT id, identifier, alias, domain, email, is_primary, created_at, updated_at
            FROM phone_mail_accounts
            WHERE identifier = ?
            ORDER BY is_primary DESC, id ASC
            LIMIT 1
        ]],
        { identifier }
    )
end

local function BuildInbox(accountId, limit, offset)
    return MySQL.query.await(
        [[
            SELECT
                m.id,
                m.sender_account_id,
                m.recipient_email,
                m.subject,
                m.body,
                m.attachments,
                m.is_read,
                UNIX_TIMESTAMP(m.created_at) * 1000 AS created_at,
                s.email AS sender_email,
                s.alias AS sender_alias
            FROM phone_mail_messages m
            LEFT JOIN phone_mail_accounts s ON s.id = m.sender_account_id
            WHERE m.recipient_account_id = ?
              AND m.is_deleted_recipient = 0
            ORDER BY m.created_at DESC
            LIMIT ? OFFSET ?
        ]],
        { accountId, limit, offset }
    ) or {}
end

local function BuildSent(accountId, limit, offset)
    return MySQL.query.await(
        [[
            SELECT
                m.id,
                m.sender_account_id,
                m.recipient_email,
                m.subject,
                m.body,
                m.attachments,
                m.is_read,
                UNIX_TIMESTAMP(m.created_at) * 1000 AS created_at,
                r.alias AS recipient_alias
            FROM phone_mail_messages m
            LEFT JOIN phone_mail_accounts r ON r.id = m.recipient_account_id
            WHERE m.sender_account_id = ?
              AND m.is_deleted_sender = 0
            ORDER BY m.created_at DESC
            LIMIT ? OFFSET ?
        ]],
        { accountId, limit, offset }
    ) or {}
end

local function GetMailBox(accountId)
    return MySQL.single.await(
        'SELECT unread_count, total_count FROM phone_mail_boxes WHERE account_id = ? LIMIT 1',
        { accountId }
    )
end

lib.callback.register('gcphone:mail:getState', function(source, data)
    if Config.Mail and Config.Mail.Enabled == false then
        return { success = false, error = 'MAIL_DISABLED' }
    end

    local identifier = GetIdentifier(source)
    if not identifier then
        return { success = false, error = 'MISSING_IDENTIFIER' }
    end

    local account = GetPrimaryAccount(identifier)
    if not account then
        return {
            success = true,
            hasAccount = false,
            account = nil,
            inbox = {},
            sent = {},
            unread = 0,
            total = 0,
            domain = MailDomain(),
        }
    end

    local limit = math.floor(tonumber(type(data) == 'table' and data.limit or 25) or 25)
    if limit < 1 then limit = 1 end
    if limit > 100 then limit = 100 end

    local offset = math.floor(tonumber(type(data) == 'table' and data.offset or 0) or 0)
    if offset < 0 then offset = 0 end

    local inbox = BuildInbox(account.id, limit, offset)
    local sent = BuildSent(account.id, limit, offset)
    local box = GetMailBox(account.id) or {}

    return {
        success = true,
        hasAccount = true,
        account = account,
        inbox = inbox,
        sent = sent,
        unread = tonumber(box.unread_count) or 0,
        total = tonumber(box.total_count) or #inbox,
        domain = MailDomain(),
    }
end)

lib.callback.register('gcphone:mail:createAccount', function(source, data)
    if Config.Mail and Config.Mail.Enabled == false then
        return { success = false, error = 'MAIL_DISABLED' }
    end

    if HitRateLimit(source, 'mail_create_account', 20000, 4) then
        return { success = false, error = 'RATE_LIMITED' }
    end

    local identifier = GetIdentifier(source)
    if not identifier then
        return { success = false, error = 'MISSING_IDENTIFIER' }
    end

    local existing = GetPrimaryAccount(identifier)
    if existing then
        return { success = false, error = 'ACCOUNT_EXISTS' }
    end

    local alias = SafeAlias(type(data) == 'table' and data.alias or nil)
    local password = SafeText(type(data) == 'table' and data.password or nil, 120)
    if not alias or not password or #password < 4 then
        return { success = false, error = 'INVALID_DATA' }
    end

    local email = alias .. '@' .. MailDomain()
    local inserted = MySQL.insert.await(
        [[
            INSERT INTO phone_mail_accounts (identifier, alias, domain, email, password_hash, is_primary, last_login_at)
            VALUES (?, ?, ?, ?, SHA2(?, 256), 1, NOW())
        ]],
        { identifier, alias, MailDomain(), email, password }
    )

    if not inserted then
        return { success = false, error = 'EMAIL_IN_USE' }
    end

    local account = GetPrimaryAccount(identifier)
    return {
        success = account ~= nil,
        hasAccount = account ~= nil,
        account = account,
        domain = MailDomain(),
    }
end)

lib.callback.register('gcphone:mail:send', function(source, data)
    if Config.Mail and Config.Mail.Enabled == false then
        return { success = false, error = 'MAIL_DISABLED' }
    end

    if HitRateLimit(source, 'mail_send', 3000, 6) then
        return { success = false, error = 'RATE_LIMITED' }
    end

    local identifier = GetIdentifier(source)
    if not identifier then
        return { success = false, error = 'MISSING_IDENTIFIER' }
    end

    local account = GetPrimaryAccount(identifier)
    if not account then
        return { success = false, error = 'ACCOUNT_REQUIRED' }
    end

    local recipientEmail = SafeEmail(type(data) == 'table' and data.to or nil)
    local subject = SafeText(type(data) == 'table' and data.subject or nil, (Config.Mail and Config.Mail.MaxSubjectLength) or 120)
    local body = SafeText(type(data) == 'table' and data.body or nil, (Config.Mail and Config.Mail.MaxBodyLength) or 4000)

    if not recipientEmail or not body then
        return { success = false, error = 'INVALID_DATA' }
    end

    local recipient = MySQL.single.await(
        'SELECT id, email FROM phone_mail_accounts WHERE email = ? LIMIT 1',
        { recipientEmail }
    )

    local mailId = MySQL.insert.await(
        [[
            INSERT INTO phone_mail_messages (sender_account_id, recipient_email, recipient_account_id, subject, body, attachments, is_read)
            VALUES (?, ?, ?, ?, ?, NULL, 0)
        ]],
        { account.id, recipientEmail, recipient and recipient.id or nil, subject, body }
    )

    if not mailId then
        return { success = false, error = 'SEND_FAILED' }
    end

    return { success = true, id = mailId }
end)

lib.callback.register('gcphone:mail:markRead', function(source, data)
    if HitRateLimit(source, 'mail_mark_read', 1500, 12) then
        return { success = false, error = 'RATE_LIMITED' }
    end

    local identifier = GetIdentifier(source)
    if not identifier then
        return { success = false, error = 'MISSING_IDENTIFIER' }
    end

    local account = GetPrimaryAccount(identifier)
    if not account then
        return { success = false, error = 'ACCOUNT_REQUIRED' }
    end

    local messageId = tonumber(type(data) == 'table' and data.messageId or nil)
    if not messageId or messageId < 1 then
        return { success = false, error = 'INVALID_MESSAGE' }
    end

    local changed = MySQL.update.await(
        [[
            UPDATE phone_mail_messages
            SET is_read = 1
            WHERE id = ?
              AND recipient_account_id = ?
              AND is_deleted_recipient = 0
              AND is_read = 0
        ]],
        { messageId, account.id }
    )

    return { success = changed ~= nil }
end)

lib.callback.register('gcphone:mail:getMessages', function(source, data)
    if Config.Mail and Config.Mail.Enabled == false then
        return { success = false, error = 'MAIL_DISABLED' }
    end

    local identifier = GetIdentifier(source)
    if not identifier then
        return { success = false, error = 'MISSING_IDENTIFIER' }
    end

    local account = GetPrimaryAccount(identifier)
    if not account then
        return { success = false, error = 'ACCOUNT_REQUIRED' }
    end

    local folder = tostring(type(data) == 'table' and data.folder or 'inbox')
    if folder ~= 'sent' then folder = 'inbox' end

    local limit = math.floor(tonumber(type(data) == 'table' and data.limit or 25) or 25)
    if limit < 1 then limit = 1 end
    if limit > 100 then limit = 100 end

    local offset = math.floor(tonumber(type(data) == 'table' and data.offset or 0) or 0)
    if offset < 0 then offset = 0 end

    local rows = folder == 'sent' and BuildSent(account.id, limit, offset) or BuildInbox(account.id, limit, offset)
    return {
        success = true,
        folder = folder,
        messages = rows,
    }
end)
