local currentMail = nil

-- Função para obter o endereço de email do jogador
exports("GetEmailAddress", function(phoneNumber)
    return GetLoggedInAccount(phoneNumber, "Mail")
end)

-- Função wrapper para callbacks relacionados ao email
local function MailCallback(action, callbackFunc, defaultReturn)
    BaseCallback("mail:" .. action, function(source, cb, ...)
        local phoneNumber = GetEquippedPhoneNumber(source)
        if not phoneNumber then
            return defaultReturn
        end
        local account = GetLoggedInAccount(phoneNumber, "Mail")
        if not account then
            return defaultReturn
        end
        return callbackFunc(source, cb, account, ...)
    end, defaultReturn)
end

-- Função para notificar outros dispositivos logados
local function NotifyOtherDevices(username, notification, excludeNumber)
    local accounts = MySQL.query.await(
        "SELECT phone_number FROM phone_logged_in_accounts WHERE username = ? AND app = 'Mail' AND `active` = 1",
        { username }
    )

    notification.app = "Mail"

    for _, account in ipairs(accounts) do
        if account.phone_number ~= excludeNumber then
            SendNotification(account.phone_number, notification)
        end
    end
end

-- Callbacks para operações de email
MailCallback("isLoggedIn", function(_, cb, account)
    return account
end, false)

-- Função para criar conta de email
exports("CreateMailAccount", function(email, password, cb)
    if not email or not password or #email < 3 or #password < 3 then
        if cb then cb({ success = false, reason = "Invalid email/password" }) end
        return false, "Invalid email/password"
    end

    if MySQL.scalar.await("SELECT 1 FROM phone_mail_accounts WHERE address=?", { email }) then
        if cb then cb({ success = false, error = "Address already exists" }) end
        return false, "Address already exists"
    end

    local success = MySQL.update.await(
        "INSERT INTO phone_mail_accounts (address, `password`) VALUES (?, ?)",
        { email, GetPasswordHash(password) }
    ) == 1

    if not success then
        if cb then cb({ success = false, error = "Server error" }) end
        return false, "Server error"
    end

    if cb then cb({ success = true }) end
    return true
end)

-- Callback para criar conta via NUI
BaseCallback("mail:createAccount", function(source, cb, email, password)
    if #email < 3 or #password < 3 then
        return { success = false, error = "Invalid email/password" }
    end

    email = email .. "@" .. Config.EmailDomain
    local success, errorMsg = exports.CreateMailAccount(email, password)

    if success then
        AddLoggedInAccount(source, "Mail", email)
    end

    return { success = success, error = errorMsg }
end, { success = false, error = "No phone equipped" })

-- Callback para mudar senha
MailCallback("changePassword", function(source, cb, account, oldPassword, newPassword)
    if not Config.ChangePassword.Mail then
        infoprint("warning", ("%s tried to change password on Mail, but it's not enabled in the config."):format(source))
        return false
    end

    if oldPassword == newPassword or #newPassword < 3 then
        debugprint("same password/too short")
        return false
    end

    local currentHash = MySQL.scalar.await(
        "SELECT password FROM phone_mail_accounts WHERE address = ?",
        { account }
    )

    if not currentHash or not VerifyPasswordHash(oldPassword, currentHash) then
        return false
    end

    local updated = MySQL.update.await(
        "UPDATE phone_mail_accounts SET password = ? WHERE address = ?",
        { GetPasswordHash(newPassword), account }
    ) > 0

    if not updated then
        return false
    end

    -- Notificar outros dispositivos
    NotifyOtherDevices(account, {
        title = L("BACKEND.MISC.LOGGED_OUT_PASSWORD.TITLE"),
        content = L("BACKEND.MISC.LOGGED_OUT_PASSWORD.DESCRIPTION")
    }, source)

    -- Limpar outras sessões
    MySQL.update.await(
        "DELETE FROM phone_logged_in_accounts WHERE username = ? AND app = 'Mail' AND phone_number != ?",
        { account, source }
    )

    ClearActiveAccountsCache("Mail", account, source)

    Log("Mail", source, "info",
        L("BACKEND.LOGS.CHANGED_PASSWORD.TITLE"),
        L("BACKEND.LOGS.CHANGED_PASSWORD.DESCRIPTION", {
            number = source,
            username = account,
            app = "Mail"
        })
    )

    TriggerClientEvent("phone:logoutFromApp", -1, {
        username = account,
        app = "mail",
        reason = "password",
        number = source
    })

    return true
end, false)

-- Callback para deletar conta
MailCallback("deleteAccount", function(source, cb, account, password)
    if not Config.DeleteAccount.Mail then
        infoprint("warning",
            ("%s tried to delete their account on Mail, but it's not enabled in the config."):format(source))
        return false
    end

    local currentHash = MySQL.scalar.await(
        "SELECT password FROM phone_mail_accounts WHERE address = ?",
        { account }
    )

    if not currentHash or not VerifyPasswordHash(password, currentHash) then
        return false
    end

    local deleted = MySQL.update.await(
        "DELETE FROM phone_mail_accounts WHERE address = ?",
        { account }
    ) > 0

    if not deleted then
        return false
    end

    NotifyOtherDevices(account, {
        title = L("BACKEND.MISC.DELETED_NOTIFICATION.TITLE"),
        content = L("BACKEND.MISC.DELETED_NOTIFICATION.DESCRIPTION")
    })

    MySQL.update.await(
        "DELETE FROM phone_logged_in_accounts WHERE username = ? AND app = 'Mail'",
        { account }
    )

    ClearActiveAccountsCache("Mail", account)

    Log("Mail", source, "info",
        L("BACKEND.LOGS.DELETED_ACCOUNT.TITLE"),
        L("BACKEND.LOGS.DELETED_ACCOUNT.DESCRIPTION", {
            number = source,
            username = account,
            app = "Mail"
        })
    )

    TriggerClientEvent("phone:logoutFromApp", -1, {
        username = account,
        app = "mail",
        reason = "deleted"
    })

    return true
end, false)

-- Callback para login
BaseCallback("mail:login", function(source, cb, email, password)
    local passwordHash = MySQL.scalar.await(
        "SELECT `password` FROM phone_mail_accounts WHERE address=?",
        { email }
    )

    if not passwordHash then
        return { success = false, error = "Invalid address" }
    end

    if not VerifyPasswordHash(password, passwordHash) then
        return { success = false, error = "Invalid password" }
    end

    AddLoggedInAccount(source, "Mail", email)
    return { success = true }
end, { success = false, error = "No phone equipped" })

-- Callback para logout
MailCallback("logout", function(source, cb, account)
    RemoveLoggedInAccount(source, "Mail", account)
    return { success = true }
end, { success = false, error = "Not logged in" })

-- Função para enviar notificação de novo email
local function NotifyNewMail(mailData)
    if mailData.to == "all" then
        TriggerClientEvent("phone:mail:newMail", -1, mailData)
        return
    end

    local accounts = MySQL.query.await(
        "SELECT phone_number FROM phone_logged_in_accounts WHERE app = 'Mail' AND username = ? AND active = 1",
        { mailData.to }
    )

    for _, account in ipairs(accounts) do
        local target = GetSourceFromNumber(account.phone_number)
        if target then
            TriggerClientEvent("phone:mail:newMail", target, mailData)
        end

        SendNotification(account.phone_number, {
            app = "Mail",
            title = mailData.sender,
            content = mailData.subject,
            thumbnail = mailData.attachments[1]
        })
    end
end

-- Função para enviar email
local function SendMail(mail)
    if mail.to == "all" then
        TriggerClientEvent("phone:mail:newMail", -1, mail)
        return true
    end

    -- Validate recipient
    if mail.to ~= "all" and not MySQL.scalar.await("SELECT 1 FROM phone_mail_accounts WHERE address = ?", { mail.to }) then
        return false, "Invalid address"
    end

    -- Convert to markdown if enabled
    if Config.ConvertMailToMarkdown and ConvertHTMLToMarkdown then
        mail.message = ConvertHTMLToMarkdown(mail.message)
    end

    -- Ensure attachments and actions are tables
    mail.attachments = mail.attachments or {}
    mail.actions = mail.actions or {}

    -- Insert into database
    local id = MySQL.insert.await(
        "INSERT INTO phone_mail_messages (recipient, sender, subject, content, attachments, actions) " ..
        "VALUES (@recipient, @sender, @subject, @content, @attachments, @actions)",
        {
            ["@recipient"] = mail.to,
            ["@sender"] = mail.sender or "system",
            ["@subject"] = mail.subject or "System mail",
            ["@content"] = mail.message or "",
            ["@attachments"] = (#mail.attachments > 0) and json.encode(mail.attachments) or nil,
            ["@actions"] = (#mail.actions > 0) and json.encode(mail.actions) or nil
        }
    )

    -- Create mail object
    local mailObj = {
        id = id,
        to = mail.to,
        sender = mail.sender or "System",
        subject = mail.subject or "System mail",
        message = mail.message or "",
        attachments = mail.attachments,
        actions = mail.actions,
        read = false,
        timestamp = os.time() * 1000
    }

    -- Trigger events
    TriggerEvent("lb-phone:mail:mailSent", mailObj)
    NotifyNewMail(mailObj)

    return true, id
end

exports("SendMail", SendMail)

-- Função para gerar conta de email automaticamente
function GenerateEmailAccount(source, phoneNumber)
    if not Config.AutoCreateEmail or not phoneNumber then return end

    local firstName, lastName = GetCharacterName(source)
    firstName = firstName:gsub("[^%w]", "")
    lastName = lastName:gsub("[^%w]", "")

    if #firstName == 0 then firstName = GenerateString(5) end
    if #lastName == 0 then lastName = GenerateString(5) end

    local baseEmail = firstName .. "." .. lastName
    local count = MySQL.scalar.await(
        "SELECT COUNT(1) FROM phone_mail_accounts WHERE address LIKE ?",
        { baseEmail .. "%" }
    ) or 0

    if count > 0 then
        baseEmail = baseEmail .. (count + 1)
    end

    local email = baseEmail .. "@" .. Config.EmailDomain
    local attempts = 0

    while MySQL.scalar.await("SELECT 1 FROM phone_mail_accounts WHERE address=?", { email }) and attempts < 50 do
        email = firstName .. "." .. lastName .. math.random(1000, 9999) .. "@" .. Config.EmailDomain
        attempts = attempts + 1
        Wait(0)
    end

    if attempts >= 50 then
        debugprint("Failed to generate address for", source)
        return
    end

    email = email:lower()
    local password = GenerateString(5)

    if not exports.CreateMailAccount(email, password) then
        return
    end

    AddLoggedInAccount(phoneNumber, "Mail", email)

    SendMail({
        to = email,
        sender = L("BACKEND.MAIL.AUTOMATIC_PASSWORD.SENDER"),
        subject = L("BACKEND.MAIL.AUTOMATIC_PASSWORD.SUBJECT"),
        message = L("BACKEND.MAIL.AUTOMATIC_PASSWORD.MESSAGE", {
            address = email,
            password = password
        })
    })
end

-- Função para deletar email
exports("DeleteMail", function(mailId)
    local deleted = MySQL.Sync.execute(
        "DELETE FROM phone_mail_messages WHERE id=@id",
        { ["@id"] = mailId }
    ) > 0

    if deleted then
        TriggerClientEvent("phone:mail:mailDeleted", -1, mailId)
    end

    return deleted
end)

-- Callback para enviar email via NUI
MailCallback("sendMail", function(source, cb, account, mailData)
    if mailData.to == "all" then
        return false
    end

    if not mailData.to or not mailData.subject or not mailData.message or type(mailData.attachments) ~= "table" then
        return false
    end

    if ContainsBlacklistedWord(source, "Mail", mailData.subject) or
        ContainsBlacklistedWord(source, "Mail", mailData.message) then
        return false
    end

    local _, messageId = SendMail({
        to = mailData.to,
        sender = account,
        subject = mailData.subject,
        message = mailData.message,
        attachments = mailData.attachments
    })

    if not messageId then
        return false
    end

    Log("Mail", source, "info",
        L("BACKEND.LOGS.MAIL_TITLE"),
        L("BACKEND.LOGS.NEW_MAIL", {
            sender = account,
            recipient = mailData.to
        })
    )

    return messageId
end, false)

-- Callback para obter lista de emails
MailCallback("getMails", function(_, cb, account, page)
    local deletedCondition = Config.DeleteMail and
        "AND IF((SELECT 1 FROM phone_mail_deleted d WHERE d.message_id=m.id AND d.address=@address), FALSE, TRUE)" or ""

    return MySQL.query.await(([[
        SELECT id, recipient AS `to`, sender, subject, LEFT(content, 70) AS message, `read`, `timestamp`
        FROM phone_mail_messages m
        WHERE (
            recipient=@address
            OR recipient="all"
            OR sender=@address
        ) %s
        ORDER BY `timestamp` DESC
        LIMIT @page, @perPage
    ]]):format(deletedCondition), {
        ["@address"] = account,
        ["@page"] = (page or 0) * 10,
        ["@perPage"] = 10
    })
end, {})

-- Callback para obter email específico
MailCallback("getMail", function(_, _, account, mailId)
    local mail = MySQL.single.await([[
        SELECT
            id, recipient AS `to`, sender, subject, content as message,
            attachments, `read`, `timestamp`, actions
        FROM phone_mail_messages
        WHERE (
            recipient=@address
            OR recipient="all"
            OR sender=@address
        ) AND id=@id
    ]], {
        ["@address"] = account,
        ["@id"] = mailId
    })

    if not mail then
        return false
    end

    if not mail.read and mail.sender ~= account then
        MySQL.update.await(
            "UPDATE phone_mail_messages SET `read`=1 WHERE id=? AND sender != ?",
            { mailId, account }
        )
    end

    return mail
end)

-- Callback para deletar email
MailCallback("deleteMail", function(_, _, account, mailId)
    if not Config.DeleteMail then
        return
    end

    MySQL.update.await(
        "INSERT IGNORE INTO phone_mail_deleted (message_id, address) VALUES (?, ?)",
        { mailId, account }
    )

    return true
end)

-- Callback para buscar emails
MailCallback("search", function(_, _, account, query, page)
    local deletedCondition = Config.DeleteMail and
        "AND IF((SELECT 1 FROM phone_mail_deleted d WHERE d.message_id=m.id AND d.address=@address), FALSE, TRUE)" or ""

    return MySQL.query.await(([[
        SELECT id, recipient AS `to`, sender, subject, LEFT(content, 70) AS message, `read`, `timestamp`
        FROM phone_mail_messages m
        WHERE (
            recipient=@address
            OR recipient="all"
            OR sender=@address
        ) AND (
            recipient LIKE @query
            OR recipient="all"
            OR sender LIKE @query
            OR subject LIKE @query
            OR content LIKE @query
        ) %s
        ORDER BY `timestamp` DESC
        LIMIT @page, @perPage
    ]]):format(deletedCondition), {
        ["@address"] = account,
        ["@query"] = "%" .. query .. "%",
        ["@page"] = (page or 0) * 10,
        ["@perPage"] = 10
    })
end, {})

-- Eventos para notificar clientes
RegisterNetEvent("phone:mail:newMail", function(mailData)
    SendReactMessage("mail:newMail", mailData)
end)

RegisterNetEvent("phone:mail:mailDeleted", function(mailId)
    SendReactMessage("mail:deleteMail", mailId)
end)
