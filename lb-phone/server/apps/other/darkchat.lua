local Config = Config.DarkChat or {}
local DarkChat = {}

-- Helper function to notify users
function DarkChat.notifyUsers(username, notificationData, excludeNumber)
    local query = "SELECT phone_number FROM phone_logged_in_accounts " ..
        "WHERE app = 'DarkChat' AND `active` = 1 AND username = ?"

    if excludeNumber then
        query = query .. " AND phone_number != ?"
    end

    local params = { username }
    if excludeNumber then
        table.insert(params, excludeNumber)
    end

    local users = MySQL.query.await(query, params)

    for _, user in ipairs(users) do
        SendNotification(user.phone_number, notificationData)
    end
end

-- Callback to get username
BaseCallback("darkchat:getUsername", function(source, phoneNumber)
    local username = GetLoggedInAccount(phoneNumber, "DarkChat")

    if not username then
        username = MySQL.scalar.await(
            "SELECT username FROM phone_darkchat_accounts WHERE phone_number = ? AND `password` IS NULL",
            { phoneNumber }
        )

        if username then
            AddLoggedInAccount(phoneNumber, "DarkChat", username)
        else
            return false
        end
    end

    local hasPassword = MySQL.scalar.await(
        "SELECT TRUE FROM phone_darkchat_accounts WHERE username = ? AND `password` IS NOT NULL",
        { username }
    )

    return {
        username = username,
        password = hasPassword and true or false
    }
end)

-- Callback to set password
BaseCallback("darkchat:setPassword", function(source, phoneNumber, password)
    if #password < 3 then
        debugprint("DarkChat: password < 3 characters")
        return false
    end

    local username = GetLoggedInAccount(phoneNumber, "DarkChat")
    if not username then
        return false
    end

    local hasPassword = MySQL.scalar.await(
        "SELECT TRUE FROM phone_darkchat_accounts WHERE username = ? AND `password` IS NOT NULL",
        { username }
    )

    if hasPassword then
        return false
    end

    local passwordHash = GetPasswordHash(password)
    local success = MySQL.update.await(
        "UPDATE phone_darkchat_accounts SET `password` = ? WHERE username = ?",
        { passwordHash, username }
    ) > 0

    return success
end)

-- Callback to login
BaseCallback("darkchat:login", function(source, phoneNumber, username, password)
    local storedHash = MySQL.scalar.await(
        "SELECT `password` FROM phone_darkchat_accounts WHERE username = ?",
        { username }
    )

    if not storedHash then
        return { success = false, reason = "invalid_username" }
    end

    if not VerifyPasswordHash(password, storedHash) then
        return { success = false, reason = "incorrect_password" }
    end

    AddLoggedInAccount(phoneNumber, "DarkChat", username)
    return { success = true }
end)

-- Callback to register
BaseCallback("darkchat:register", function(source, phoneNumber, username, password)
    username = username:lower()

    if not IsUsernameValid(username) then
        return { success = false, reason = "USERNAME_NOT_ALLOWED" }
    end

    local exists = MySQL.scalar.await(
        "SELECT 1 FROM phone_darkchat_accounts WHERE username = ?",
        { username }
    )

    if exists then
        return { success = false, reason = "username_taken" }
    end

    local passwordHash = GetPasswordHash(password)
    local success = MySQL.update.await(
        "INSERT INTO phone_darkchat_accounts (phone_number, username, `password`) VALUES (?, ?, ?)",
        { phoneNumber, username, passwordHash }
    ) > 0

    if not success then
        return { success = false, reason = "unknown" }
    end

    AddLoggedInAccount(phoneNumber, "DarkChat", username)
    return { success = true }
end)

-- Helper function to create authenticated callbacks
function DarkChat.createAuthCallback(name, callback, defaultReturn)
    BaseCallback("darkchat:" .. name, function(source, phoneNumber, ...)
        local username = GetLoggedInAccount(phoneNumber, "DarkChat")
        if not username then
            return defaultReturn
        end
        return callback(source, phoneNumber, username, ...)
    end, defaultReturn)
end

-- Change password callback
DarkChat.createAuthCallback("changePassword", function(source, phoneNumber, username, oldPassword, newPassword)
    if not Config.ChangePassword then
        infoprint("warning",
            ("%s tried to change password on DarkChat, but it's not enabled in the config."):format(source))
        return false
    end

    if oldPassword == newPassword or #newPassword < 3 then
        debugprint("same password / too short")
        return false
    end

    local storedHash = MySQL.scalar.await(
        "SELECT `password` FROM phone_darkchat_accounts WHERE username = ?",
        { username }
    )

    if not storedHash or not VerifyPasswordHash(oldPassword, storedHash) then
        return false
    end

    local success = MySQL.update.await(
        "UPDATE phone_darkchat_accounts SET `password` = ? WHERE username = ?",
        { GetPasswordHash(newPassword), username }
    ) > 0

    if not success then
        return false
    end

    -- Notify other sessions to logout
    DarkChat.notifyUsers(username, {
        title = L("BACKEND.MISC.LOGGED_OUT_PASSWORD.TITLE"),
        content = L("BACKEND.MISC.LOGGED_OUT_PASSWORD.DESCRIPTION")
    }, phoneNumber)

    MySQL.update.await(
        "DELETE FROM phone_logged_in_accounts WHERE username = ? AND app = 'DarkChat' AND phone_number != ?",
        { username, phoneNumber }
    )

    ClearActiveAccountsCache("DarkChat", username, phoneNumber)

    TriggerClientEvent("phone:logoutFromApp", -1, {
        username = username,
        app = "darkchat",
        reason = "password",
        number = phoneNumber
    })

    return true
end)

-- Delete account callback
DarkChat.createAuthCallback("deleteAccount", function(source, phoneNumber, username, password)
    if not Config.DeleteAccount then
        infoprint("warning",
            ("%s tried to delete their account on DarkChat, but it's not enabled in the config."):format(source))
        return false
    end

    local storedHash = MySQL.scalar.await(
        "SELECT `password` FROM phone_darkchat_accounts WHERE username = ?",
        { username }
    )

    if not storedHash or not VerifyPasswordHash(password, storedHash) then
        return false
    end

    -- Notify user
    DarkChat.notifyUsers(username, {
        title = L("BACKEND.MISC.DELETED_NOTIFICATION.TITLE"),
        content = L("BACKEND.MISC.DELETED_NOTIFICATION.DESCRIPTION")
    })

    -- Remove from logged in accounts
    MySQL.update.await(
        "DELETE FROM phone_logged_in_accounts WHERE username = ? AND app = 'DarkChat'",
        { username }
    )

    ClearActiveAccountsCache("DarkChat", username)

    TriggerClientEvent("phone:logoutFromApp", -1, {
        username = username,
        app = "darkchat",
        reason = "deleted"
    })

    return true
end)

-- Logout callback
DarkChat.createAuthCallback("logout", function(source, phoneNumber, username)
    RemoveLoggedInAccount(phoneNumber, "DarkChat", username)
    return true
end)

-- Join channel callback
DarkChat.createAuthCallback("joinChannel", function(source, phoneNumber, username, channelName)
    local alreadyMember = MySQL.scalar.await(
        "SELECT TRUE FROM phone_darkchat_members WHERE channel_name = ? AND username = ?",
        { channelName, username }
    )

    if alreadyMember then
        debugprint("darkchat: already in channel")
        return false
    end

    local channelExists = MySQL.scalar.await(
        "SELECT TRUE FROM phone_darkchat_channels WHERE `name` = ?",
        { channelName }
    )

    if not channelExists then
        MySQL.update.await(
            "INSERT INTO phone_darkchat_channels (`name`) VALUES (?)",
            { channelName }
        )

        Log("DarkChat", source, "info",
            L("BACKEND.LOGS.DARKCHAT_CREATED_TITLE"),
            L("BACKEND.LOGS.DARKCHAT_CREATED_DESCRIPTION", {
                creator = username,
                channel = channelName
            })
        )
    end

    local success = MySQL.update.await(
        "INSERT INTO phone_darkchat_members (channel_name, username) VALUES (?, ?)",
        { channelName, username }
    ) > 0

    if not success then
        debugprint("darkchat: failed to insert into members")
        return false
    end

    if not channelExists then
        return {
            name = channelName,
            members = 1
        }
    end

    local channelData = MySQL.single.await([[
        SELECT
            `name`,
            (SELECT COUNT(username) FROM phone_darkchat_members WHERE channel_name = `name`) AS members
        FROM phone_darkchat_channels c
        WHERE `name` = ?
    ]], { channelName })

    local lastMessage = MySQL.single.await([[
        SELECT sender, content, `timestamp`
        FROM phone_darkchat_messages
        WHERE `channel` = ?
        ORDER BY `timestamp` DESC
        LIMIT 1
    ]], { channelName })

    if lastMessage then
        channelData.sender = lastMessage.sender
        channelData.lastMessage = lastMessage.content
        channelData.timestamp = lastMessage.timestamp
    end

    TriggerClientEvent("phone:darkChat:updateChannel", -1, channelName, username, "joined")
    return channelData
end)

-- Leave channel callback
DarkChat.createAuthCallback("leaveChannel", function(source, phoneNumber, username, channelName)
    local success = MySQL.update.await(
        "DELETE FROM phone_darkchat_members WHERE channel_name = ? AND username = ?",
        { channelName, username }
    ) > 0

    if not success then
        return false
    end

    TriggerClientEvent("phone:darkChat:updateChannel", -1, channelName, username, "left")
    return true
end)

-- Get channels callback
DarkChat.createAuthCallback("getChannels", function(source, phoneNumber, username)
    return MySQL.query.await([[
        SELECT
            `name`,
            (SELECT COUNT(username) FROM phone_darkchat_members WHERE channel_name = `name`) AS members,
            m.sender AS sender,
            m.content AS lastMessage,
            m.`timestamp` AS `timestamp`
        FROM phone_darkchat_channels c
        LEFT JOIN phone_darkchat_messages m ON m.`channel` = c.name
        WHERE EXISTS (SELECT TRUE FROM phone_darkchat_members WHERE channel_name = c.name AND username = ?)
        AND COALESCE(m.`timestamp`, '1970-01-01 00:00:00') = (
            SELECT COALESCE(MAX(`timestamp`), '1970-01-01 00:00:00') FROM phone_darkchat_messages WHERE `channel` = c.`name`
        )
    ]], { username })
end, {})

-- Get messages callback
DarkChat.createAuthCallback("getMessages", function(source, phoneNumber, username, channelName, page)
    return MySQL.query.await([[
        SELECT sender, content, `timestamp`
        FROM phone_darkchat_messages
        WHERE `channel` = ?
        ORDER BY `timestamp` DESC
        LIMIT ?, ?
    ]], { channelName, page * 15, 15 })
end)

-- Function to send a message
function DarkChat.sendMessage(sender, channel, content)
    local messageId = MySQL.insert.await(
        "INSERT INTO phone_darkchat_messages (sender, `channel`, content) VALUES (?, ?, ?)",
        { sender, channel, content }
    )

    if not messageId then
        return false
    end

    TriggerClientEvent("phone:darkChat:newMessage", -1, channel, sender, content)
    return true
end

-- Send message callback
DarkChat.createAuthCallback("sendMessage", function(source, phoneNumber, username, channel, message)
    if ContainsBlacklistedWord(source, "DarkChat", message) then
        return false
    end

    local success = DarkChat.sendMessage(username, channel, message)
    if not success then
        return false
    end

    Log("DarkChat", source, "info",
        L("BACKEND.LOGS.DARKCHAT_MESSAGE_TITLE"),
        L("BACKEND.LOGS.DARKCHAT_MESSAGE_DESCRIPTION", {
            sender = username,
            channel = channel,
            message = message
        })
    )

    return true
end)

-- Export functions
exports("SendDarkChatMessage", function(username, channel, message, callback)
    assert(type(username) == "string", "username must be a string")
    assert(type(channel) == "string", "channel must be a string")
    assert(type(message) == "string", "message must be a string")

    local success = DarkChat.sendMessage(username, channel, message)
    if callback then
        callback(success)
    end
    return success
end)

exports("SendDarkChatLocation", function(username, channel, location, callback)
    assert(type(username) == "string", "Expected string for argument 1, got " .. type(username))
    assert(type(channel) == "string", "Expected string for argument 2, got " .. type(channel))
    assert(type(location) == "vector2", "Expected vector2 for argument 3, got " .. type(location))

    local message = "<!SENT-LOCATION-X=" .. location.x .. "Y=" .. location.y .. "!>"
    local success = DarkChat.sendMessage(username, channel, message)

    if callback then
        callback(success)
    end
    return success
end)
