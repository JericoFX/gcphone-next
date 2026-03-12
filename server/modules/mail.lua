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

local function ParseAttachmentList(raw)
    if type(raw) == 'table' then
        return raw
    end

    if type(raw) ~= 'string' or raw == '' then
        return {}
    end

    local ok, decoded = pcall(json.decode, raw)
    if not ok or type(decoded) ~= 'table' then
        return {}
    end

    return decoded
end

local function SafeAttachments(value)
    if value == nil then
        return '[]', 0
    end

    local items = ParseAttachmentList(value)
    local cfg = Config.Mail and Config.Mail.Attachments or {}
    local maxCount = math.floor(tonumber(cfg.MaxCount) or 5)
    if maxCount < 0 then maxCount = 0 end
    if maxCount > 15 then maxCount = 15 end

    local maxTotalSize = math.floor(tonumber(cfg.MaxTotalSize) or 31457280)
    if maxTotalSize < 0 then maxTotalSize = 0 end

    local allowed = {}
    if type(cfg.AllowedTypes) == 'table' then
        for _, kind in ipairs(cfg.AllowedTypes) do
            if type(kind) == 'string' and kind ~= '' then
                allowed[kind:lower()] = true
            end
        end
    end

    local cleaned = {}
    local totalSize = 0
    for _, entry in ipairs(items) do
        if #cleaned >= maxCount then
            return nil, 'ATTACHMENT_LIMIT_REACHED'
        end

        if type(entry) ~= 'table' then
            return nil, 'INVALID_ATTACHMENTS'
        end

        local kind = SafeText(tostring(entry.type or ''), 20)
        local url = SafeText(tostring(entry.url or ''), 1000)
        if not kind or not url then
            return nil, 'INVALID_ATTACHMENTS'
        end

        kind = kind:lower()
        if next(allowed) ~= nil and not allowed[kind] then
            return nil, 'ATTACHMENT_TYPE_NOT_ALLOWED'
        end

        if not url:match('^https?://') and not url:match('^/%w') then
            return nil, 'INVALID_ATTACHMENT_URL'
        end

        local size = math.floor(tonumber(entry.size) or 0)
        if size < 0 then size = 0 end
        if size > 0 then
            totalSize = totalSize + size
            if totalSize > maxTotalSize then
                return nil, 'ATTACHMENT_TOO_LARGE'
            end
        end

        cleaned[#cleaned + 1] = {
            type = kind,
            url = url,
            name = SafeText(tostring(entry.name or ''), 120),
            mime = SafeText(tostring(entry.mime or ''), 80),
            size = size,
            sourceApp = SafeText(tostring(entry.sourceApp or ''), 32),
        }
    end

    return json.encode(cleaned), #cleaned
end

local function InflateAttachments(rows)
    for _, row in ipairs(rows) do
        row.attachments = ParseAttachmentList(row.attachments)
    end
    return rows
end

local function GetRecipientByEmail(email)
    return MySQL.single.await(
        'SELECT id, email, identifier FROM phone_mail_accounts WHERE email = ? LIMIT 1',
        { email }
    )
end

local function SendMailFromAccount(account, payload)
    local recipientEmail = SafeEmail(type(payload) == 'table' and payload.to or nil)
    local subject = SafeText(type(payload) == 'table' and payload.subject or nil, (Config.Mail and Config.Mail.MaxSubjectLength) or 120)
    local body = SafeText(type(payload) == 'table' and payload.body or nil, (Config.Mail and Config.Mail.MaxBodyLength) or 4000)

    if not recipientEmail or not body then
        return { success = false, error = 'INVALID_DATA' }
    end

    local attachmentsJson, attachmentCountOrError = SafeAttachments(type(payload) == 'table' and payload.attachments or nil)
    if not attachmentsJson then
        return { success = false, error = attachmentCountOrError or 'INVALID_ATTACHMENTS' }
    end

    local attachmentCount = tonumber(attachmentCountOrError) or 0
    local recipient = GetRecipientByEmail(recipientEmail)

    local mailId = MySQL.insert.await(
        [[
            INSERT INTO phone_mail_messages (sender_account_id, recipient_email, recipient_account_id, subject, body, attachments, is_read)
            VALUES (?, ?, ?, ?, ?, ?, 0)
        ]],
        { account.id, recipientEmail, recipient and recipient.id or nil, subject, body, attachmentsJson }
    )

    if not mailId then
        return { success = false, error = 'SEND_FAILED' }
    end

    if recipient and recipient.identifier then
        pcall(function()
            exports[GetCurrentResourceName()]:AddPersistentNotification(recipient.identifier, {
                appId = 'mail',
                title = 'Nuevo mail',
                content = attachmentCount > 0
                    and string.format('%s te envio un correo (%d adjunto%s)', account.email or 'Alguien', attachmentCount, attachmentCount == 1 and '' or 's')
                    or string.format('%s te envio un correo', account.email or 'Alguien'),
                meta = {
                    mailId = mailId,
                    sender = account.email,
                    attachments = attachmentCount,
                }
            })
        end)
    end

    return { success = true, id = mailId }
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

    local inbox = InflateAttachments(BuildInbox(account.id, limit, offset))
    local sent = InflateAttachments(BuildSent(account.id, limit, offset))
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

    return SendMailFromAccount(account, data)
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

    return { success = (tonumber(changed) or 0) > 0 }
end)

lib.callback.register('gcphone:mail:getMessages', function(source, data)
    if Config.Mail and Config.Mail.Enabled == false then
        return { success = false, error = 'MAIL_DISABLED' }
    end

    if HitRateLimit(source, 'mail_get_messages', 500, 8) then
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

    local folder = tostring(type(data) == 'table' and data.folder or 'inbox')
    if folder ~= 'sent' then folder = 'inbox' end

    local limit = math.floor(tonumber(type(data) == 'table' and data.limit or 25) or 25)
    if limit < 1 then limit = 1 end
    if limit > 100 then limit = 100 end

    local offset = math.floor(tonumber(type(data) == 'table' and data.offset or 0) or 0)
    if offset < 0 then offset = 0 end

    local rows = folder == 'sent' and BuildSent(account.id, limit, offset) or BuildInbox(account.id, limit, offset)
    rows = InflateAttachments(rows)
    return {
        success = true,
        folder = folder,
        messages = rows,
    }
end)

lib.callback.register('gcphone:mail:delete', function(source, data)
    if Config.Mail and Config.Mail.Enabled == false then
        return { success = false, error = 'MAIL_DISABLED' }
    end

    if HitRateLimit(source, 'mail_delete', 1500, 12) then
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

    local folder = tostring(type(data) == 'table' and data.folder or 'inbox')
    if folder ~= 'sent' then folder = 'inbox' end

    local changed
    if folder == 'sent' then
        changed = MySQL.update.await(
            [[
                UPDATE phone_mail_messages
                SET is_deleted_sender = 1
                WHERE id = ?
                  AND sender_account_id = ?
                  AND is_deleted_sender = 0
            ]],
            { messageId, account.id }
        )
    else
        changed = MySQL.update.await(
            [[
                UPDATE phone_mail_messages
                SET is_deleted_recipient = 1
                WHERE id = ?
                  AND recipient_account_id = ?
                  AND is_deleted_recipient = 0
            ]],
            { messageId, account.id }
        )
    end

    return { success = changed ~= nil }
end)

---Send in-game mail from an identifier using an external resource.
---@param fromIdentifier string
---@param payload table<string, any>
---@return table<string, any>
exports('SendInGameMail', function(fromIdentifier, payload)
    if Config.Mail and Config.Mail.Enabled == false then
        return { success = false, error = 'MAIL_DISABLED' }
    end

    local identifier = SafeText(fromIdentifier, 50)
    if not identifier then
        return { success = false, error = 'INVALID_IDENTIFIER' }
    end

    local account = GetPrimaryAccount(identifier)
    if not account then
        return { success = false, error = 'ACCOUNT_REQUIRED' }
    end

    return SendMailFromAccount(account, payload)
end)
