local MySQL = MySQL
local BaseCallback = BaseCallback

local function findExistingChannel(sender, recipient)
    return MySQL.scalar.await([[
      SELECT c.id FROM phone_message_channels c
      WHERE c.is_group = 0
          AND EXISTS (SELECT TRUE FROM phone_message_members m WHERE m.channel_id = c.id AND m.phone_number = ?)
          AND EXISTS (SELECT TRUE FROM phone_message_members m WHERE m.channel_id = c.id AND m.phone_number = ?)
  ]], { sender, recipient })
end

-- Main message sending function
local function SendMessage(source, sender, recipient, message, attachments, callback, channelId)
    -- Input validation and early returns
    if not (channelId or recipient) or not sender then
        if callback and type(callback) == "function" then
            callback(false)
        end
        return nil
    end

    if not message and (not attachments or #attachments == 0) then
        debugprint("No message or attachments provided")
        if callback and type(callback) == "function" then
            callback(false)
        end
        return nil
    end

    if message and #message == 0 then
        message = nil
        if not attachments or #attachments == 0 then
            debugprint("No attachments provided")
            if callback and type(callback) == "function" then
                callback(false)
            end
            return nil
        end
    end

    -- Find or create channel
    if not channelId then
        channelId = findExistingChannel(sender, recipient)
    end

    local senderSource = GetSourceFromNumber(sender)

    -- Create new channel if needed
    if not channelId then
        channelId = MySQL.insert.await("INSERT INTO phone_message_channels (is_group) VALUES (0)")

        MySQL.update.await(
            "INSERT INTO phone_message_members (channel_id, phone_number) VALUES (?, ?), (?, ?)",
            { channelId, sender, channelId, recipient }
        )

        local recipientSource = GetSourceFromNumber(recipient)

        -- Notify sender
        if senderSource then
            TriggerClientEvent("phone:messages:newChannel", senderSource, {
                id = channelId,
                lastMessage = message,
                timestamp = os.time() * 1000,
                number = recipient,
                isGroup = false,
                unread = false
            })
        end

        -- Notify recipient
        if recipientSource then
            TriggerClientEvent("phone:messages:newChannel", recipientSource, {
                id = channelId,
                lastMessage = message,
                timestamp = os.time() * 1000,
                number = sender,
                isGroup = false,
                unread = true
            })
        end
    end

    -- Log the message
    if senderSource then
        Log("Messages", senderSource, "info",
            L("BACKEND.LOGS.MESSAGE_TITLE"),
            L("BACKEND.LOGS.NEW_MESSAGE", {
                sender = FormatNumber(sender),
                recipient = FormatNumber(recipient),
                message = message or "Attachment"
            })
        )
    end

    -- Prepare attachments
    if type(attachments) == "table" then
        attachments = json.encode(attachments)
    end

    -- Insert the message
    local messageId = MySQL.insert.await(
        "INSERT INTO phone_message_messages (channel_id, sender, content, attachments) VALUES (@channelId, @sender, @content, @attachments)",
        {
            ["@channelId"] = channelId,
            ["@sender"] = sender,
            ["@content"] = message,
            ["@attachments"] = attachments
        }
    )

    if not messageId then
        if callback and type(callback) == "function" then
            callback(false)
        end
        return nil
    end

    -- Update channel with last message
    MySQL.update.await(
        "UPDATE phone_message_channels SET last_message = ? WHERE id = ?",
        { string.sub(message or "Attachment", 1, 50), channelId }
    )

    -- Mark as unread for recipients
    MySQL.update.await(
        "UPDATE phone_message_members SET unread = unread + 1 WHERE channel_id = ? AND phone_number != ?",
        { channelId, sender }
    )

    -- Undelete conversation for all participants
    MySQL.update.await(
        "UPDATE phone_message_members SET deleted = 0 WHERE channel_id = ?",
        { channelId }
    )

    -- Notify all participants
    local recipients = MySQL.query.await(
        "SELECT phone_number FROM phone_message_members WHERE channel_id = ? AND phone_number != ?",
        { channelId, sender }
    )

    for _, recipientData in ipairs(recipients) do
        local recipientNumber = recipientData.phone_number
        if recipientNumber ~= sender then
            local recipientSource = GetSourceFromNumber(recipientNumber)

            if recipientSource then
                TriggerClientEvent("phone:messages:newMessage", recipientSource,
                    channelId, messageId, sender, message, attachments)
            end

            -- Send notification (unless it's a call no answer)
            if message ~= "<!CALL-NO-ANSWER!>" then
                local contact = GetContact(sender, recipientNumber)
                SendNotification(recipientNumber, {
                    app = "Messages",
                    title = contact and contact.name or sender,
                    content = message,
                    thumbnail = attachments and json.decode(attachments)[1],
                    avatar = contact and contact.avatar,
                    showAvatar = true
                })
            end
        end
    end

    -- Call callback if provided
    if callback and type(callback) == "function" then
        callback(channelId)
    end

    -- Trigger event
    TriggerEvent("lb-phone:messages:messageSent", {
        channelId = channelId,
        messageId = messageId,
        sender = sender,
        recipient = recipient,
        message = message,
        attachments = attachments
    })

    return {
        channelId = channelId,
        messageId = messageId
    }
end

-- Export functions
exports("SentMoney", function(sender, recipient, amount)
    assert(type(sender) == "string", "Expected string for argument 1, got " .. type(sender))
    assert(type(recipient) == "string", "Expected string for argument 2, got " .. type(recipient))
    assert(type(amount) == "number", "Expected number for argument 3, got " .. type(amount))

    SendMessage(sender, recipient, "<!SENT-PAYMENT-" .. math.floor(amount + 0.5) .. "!>")
end)

exports("SendCoords", function(sender, recipient, coords)
    assert(type(sender) == "string", "Expected string for argument 1, got " .. type(sender))
    assert(type(recipient) == "string", "Expected string for argument 2, got " .. type(recipient))
    assert(type(coords) == "vector2", "Expected vector2 for argument 3, got " .. type(coords))

    SendMessage(sender, recipient, "<!SENT-LOCATION-X=" .. coords.x .. "Y=" .. coords.y .. "!>")
end)

exports("SendMessage", function(sender, recipient, message, attachments, callback, channelId)
    assert(type(sender) == "string", "Expected string for argument 1, got " .. type(sender))
    assert(type(recipient) == "string" or recipient == nil,
        "Expected string or nil for argument 2, got " .. type(recipient))
    assert(type(message) == "string" or message == nil, "Expected string or nil for argument 3, got " .. type(message))
    assert(type(attachments) == "table" or attachments == nil,
        "Expected table or nil for argument 4, got " .. type(attachments))
    assert(type(callback) == "function" or callback == nil,
        "Expected function or nil for argument 5, got " .. type(callback))
    assert(type(channelId) == "string" or channelId == nil,
        "Expected string or nil for argument 6, got " .. type(channelId))

    return SendMessage(nil, sender, recipient, message, attachments, callback, channelId)
end)

-- Base callbacks
BaseCallback("messages:sendMessage", function(source, sender, recipient, message, attachments, channelId)
    if ContainsBlacklistedWord(source, "Messages", message) then
        return false
    end
    return SendMessage(source, sender, recipient, message, attachments, nil, channelId)
end)

BaseCallback("messages:createGroup", function(source, sender, members, initialMessage, initialAttachments)
    local channelId = MySQL.insert.await("INSERT INTO phone_message_channels (is_group) VALUES (1)")
    if not channelId then return false end

    -- Prepare members data
    local membersData = {
        { number = sender, isOwner = true }
    }

    -- Add owner
    MySQL.update.await(
        "INSERT INTO phone_message_members (channel_id, phone_number, is_owner) VALUES (?, ?, 1)",
        { channelId, sender }
    )

    -- Add other members
    for i, member in ipairs(members) do
        MySQL.update.await(
            "INSERT INTO phone_message_members (channel_id, phone_number, is_owner) VALUES (?, ?, 0)",
            { channelId, member }
        )
        table.insert(membersData, { number = member, isOwner = false })
    end

    -- Prepare channel data
    local channelData = {
        id = channelId,
        lastMessage = initialMessage,
        timestamp = os.time() * 1000,
        name = nil,
        isGroup = true,
        members = membersData,
        unread = false
    }

    -- Notify all members
    for _, member in ipairs(members) do
        local memberSource = GetSourceFromNumber(member)
        if memberSource then
            TriggerClientEvent("phone:messages:newChannel", memberSource, channelData)
        end
    end

    -- Notify creator
    TriggerClientEvent("phone:messages:newChannel", source, channelData)

    -- Send initial message
    return SendMessage(source, sender, nil, initialMessage, initialAttachments, nil, channelId)
end)

BaseCallback("messages:getRecentMessages", function(source, phoneNumber)
    return MySQL.query.await([[
      SELECT
          c.id AS channel_id, c.is_group, c.`name`, c.last_message, c.last_message_timestamp,
          m.phone_number, m.is_owner, m.unread, m.deleted
      FROM phone_message_channels c
      INNER JOIN phone_message_members m ON m.channel_id = c.id
      WHERE EXISTS (SELECT TRUE FROM phone_message_members m WHERE m.channel_id = c.id AND m.phone_number = ?)
      ORDER BY c.last_message_timestamp DESC
  ]], { phoneNumber })
end)

BaseCallback("messages:getMessages", function(source, phoneNumber, channelId, page)
    return MySQL.query.await([[
      SELECT id, sender, content, attachments, `timestamp`
      FROM phone_message_messages
      WHERE channel_id = ? AND EXISTS (SELECT TRUE FROM phone_message_members m WHERE m.channel_id = ? AND m.phone_number = ?)
      ORDER BY `timestamp` DESC
      LIMIT ?, ?
  ]], { channelId, channelId, phoneNumber, page * 25, 25 })
end)

BaseCallback("messages:renameGroup", function(source, sender, channelId, newName)
    local affectedRows = MySQL.update.await(
        "UPDATE phone_message_channels SET `name` = ? WHERE id = ? AND is_group = 1",
        { newName, channelId }
    )

    local success = affectedRows > 0
    if success then
        TriggerClientEvent("phone:messages:renameGroup", -1, channelId, newName)
    end
    return success
end)

BaseCallback("messages:deleteMessage", function(source, sender, messageId, channelId)
    if not Config.DeleteMessages then
        return false
    end

    -- Check if this is the last message
    local isLastMessage = MySQL.scalar.await(
        "SELECT MAX(id) FROM phone_message_messages WHERE channel_id = ?",
        { channelId }
    ) == messageId

    -- Delete the message
    local affectedRows = MySQL.update.await(
        "DELETE FROM phone_message_messages WHERE id = ? AND sender = ? AND channel_id = ?",
        { messageId, sender, channelId }
    )
    local success = affectedRows > 0

    -- Update last message if needed
    if success and isLastMessage then
        MySQL.update.await(
            "UPDATE phone_message_channels SET last_message = ? WHERE id = ?",
            { L("APPS.MESSAGES.MESSAGE_DELETED"), channelId }
        )
    end

    -- Notify clients
    if success then
        TriggerClientEvent("phone:messages:messageDeleted", -1, channelId, messageId, isLastMessage)
    end

    return success
end)


BaseCallback("messages:addMember", function(source, sender, channelId, newMember)
    local affectedRows = MySQL.update.await(
        "INSERT IGNORE INTO phone_message_members (channel_id, phone_number) VALUES (?, ?)",
        { channelId, newMember }
    )
    local success = affectedRows > 0

    if not success then
        return false
    end

    -- Notify all clients
    TriggerClientEvent("phone:messages:memberAdded", -1, channelId, newMember)

    local newMemberSource = GetSourceFromNumber(newMember)
    if not newMemberSource then
        return true
    end

    -- Get channel info for the new member
    local members = MySQL.Sync.fetchAll(
        "SELECT phone_number AS `number`, is_owner AS isOwner FROM phone_message_members WHERE channel_id = ?",
        { channelId }
    )

    local channelInfo = MySQL.single.await(
        "SELECT `name`, last_message, last_message_timestamp FROM phone_message_channels WHERE id = ?",
        { channelId }
    )

    -- Send channel data to new member
    if #members > 0 and channelInfo then
        TriggerClientEvent("phone:messages:newChannel", newMemberSource, {
            id = channelId,
            lastMessage = channelInfo.last_message,
            timestamp = channelInfo.last_message_timestamp,
            name = channelInfo.name,
            isGroup = true,
            members = members,
            unread = false
        })
    end

    return true
end)

BaseCallback("messages:leaveGroup", function(source, sender, channelId)
    -- Check if leaving member is owner
    local isOwner = MySQL.scalar.await(
        "SELECT is_owner FROM phone_message_members WHERE channel_id = ? AND phone_number = ?",
        { channelId, sender }
    )

    -- Transfer ownership if needed
    if isOwner then
        MySQL.update.await([[
          UPDATE phone_message_members m
          SET is_owner = TRUE
          WHERE m.channel_id = ?
          AND m.phone_number != ?
          LIMIT 1
      ]], { channelId, sender })

        local newOwner = MySQL.scalar.await(
            "SELECT phone_number FROM phone_message_members WHERE channel_id = ? AND is_owner = TRUE",
            { channelId }
        )

        TriggerClientEvent("phone:messages:ownerChanged", -1, channelId, newOwner)
    end

    -- Remove member
    local affectedRows = MySQL.update.await(
        "DELETE FROM phone_message_members WHERE channel_id = ? AND phone_number = ?",
        { channelId, sender }
    )
    local success = affectedRows > 0

    -- Check if group is now empty
    local memberCount = MySQL.scalar.await(
        "SELECT COUNT(1) FROM phone_message_members WHERE channel_id = ?",
        { channelId }
    )
    local isEmpty = memberCount == 0

    -- Notify clients
    if success then
        TriggerClientEvent("phone:messages:memberRemoved", -1, channelId, sender)
    end

    -- Delete empty group
    if isEmpty then
        MySQL.update.await(
            "DELETE FROM phone_message_channels WHERE id = ?",
            { channelId }
        )
        debugprint("Deleted group " .. channelId .. " due to it being empty")
    end

    return success
end)

BaseCallback("messages:markRead", function(source, phoneNumber, channelId)
    MySQL.update.await(
        "UPDATE phone_message_members SET unread = 0 WHERE channel_id = ? AND phone_number = ?",
        { channelId, phoneNumber }
    )
    return true
end)

BaseCallback("messages:deleteConversations", function(source, phoneNumber, channelIds)
    if type(channelIds) ~= "table" then
        debugprint("expected table, got " .. type(channelIds))
        return false
    end

    MySQL.update.await(
        "UPDATE phone_message_members SET deleted = 1 WHERE channel_id IN (?) AND phone_number = ?",
        { channelIds, phoneNumber }
    )
    return true
end)
