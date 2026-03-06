local actions = {
    "sendMessage",
    "createGroup",
    "renameGroup"
}

RegisterNUICallback("Messages", function(data, cb)
    if not currentPhone then return end

    local action = data.action
    debugprint("Messages:" .. (action or ""))

    if table.contains(actions, action) and not CanInteract() then
        return cb(false)
    end

    -- Processar anexos
    if data.attachments and #data.attachments == 0 then
        data.attachments = nil
    elseif data.attachments then
        data.attachments = json.encode(data.attachments)
    end

    -- Handlers para cada ação
    if action == "sendMessage" then
        TriggerServerEvent("phone:messages:messageSent", data.number, data.content, data.attachments)
        TriggerCallback("messages:sendMessage", cb, data.number, data.content, data.attachments, data.id)
    elseif action == "createGroup" then
        local members = {}
        for i = 1, #data.members do
            members[i] = data.members[i].number
        end
        TriggerCallback("messages:createGroup", cb, members, data.content, data.attachments)
    elseif action == "renameGroup" then
        TriggerCallback("messages:renameGroup", cb, data.id, data.name)
    elseif action == "getRecentMessages" then
        local recentMessages = AwaitCallback("messages:getRecentMessages")
        local conversations = {}

        local function findConversation(channelId)
            for i = 1, #conversations do
                if conversations[i].id == channelId then
                    return i
                end
            end
            return false
        end

        -- Processar mensagens recentes
        for i = 1, #recentMessages do
            local message = recentMessages[i]
            local convIndex = findConversation(message.channel_id)

            if not convIndex then
                if message.is_group then
                    local newConv = {
                        id = message.channel_id,
                        lastMessage = message.last_message,
                        timestamp = message.last_message_timestamp,
                        name = message.name,
                        isGroup = true,
                        members = {
                            {
                                isOwner = message.is_owner,
                                number = message.phone_number
                            }
                        }
                    }
                    table.insert(conversations, newConv)
                elseif message.phone_number ~= currentPhone then
                    local newConv = {
                        id = message.channel_id,
                        lastMessage = message.last_message,
                        timestamp = message.last_message_timestamp,
                        number = message.phone_number,
                        isGroup = false
                    }
                    table.insert(conversations, newConv)
                end
            elseif message.is_group then
                table.insert(conversations[convIndex].members, {
                    isOwner = message.is_owner,
                    number = message.phone_number
                })
            end
        end

        -- Marcar conversas como lidas/não lidas
        for i = 1, #recentMessages do
            local message = recentMessages[i]
            local convIndex = findConversation(message.channel_id)

            if convIndex and message.phone_number == currentPhone then
                conversations[convIndex].deleted = message.deleted
                conversations[convIndex].unread = message.unread > 0
            end
        end

        cb(conversations)
    elseif action == "getMessages" then
        TriggerCallback("messages:getMessages", function(messages)
            for i = 1, #messages do
                messages[i].attachments = json.decode(messages[i].attachments or "[]")
            end
            cb(messages)
        end, data.id, data.page)
    elseif action == "deleteMessage" then
        if Config.DeleteMessages then
            TriggerCallback("messages:deleteMessage", cb, data.id, data.channel)
        end
    elseif action == "addMember" then
        TriggerCallback("messages:addMember", cb, data.id, data.number)
    elseif action == "removeMember" then
        TriggerCallback("messages:removeMember", cb, data.id, data.number)
    elseif action == "leaveGroup" then
        TriggerCallback("messages:leaveGroup", cb, data.id)
    elseif action == "markRead" then
        TriggerCallback("messages:markRead", cb, data.id)
    elseif action == "deleteConversations" then
        TriggerCallback("messages:deleteConversations", cb, data.channels)
    end
end)

-- Eventos de mensagens
RegisterNetEvent("phone:messages:newMessage", function(channelId, messageId, sender, content, attachments)
    SendReactMessage("messages:newMessage", {
        channelId = channelId,
        messageId = messageId,
        sender = sender,
        content = content,
        attachments = attachments and json.decode(attachments) or {}
    })
end)

RegisterNetEvent("phone:messages:messageDeleted", function(channelId, messageId, isLastMessage)
    SendReactMessage("messages:messageDeleted", {
        channelId = channelId,
        messageId = messageId,
        isLastMessage = isLastMessage
    })
end)

RegisterNetEvent("phone:messages:renameGroup", function(channelId, name)
    SendReactMessage("messages:renameGroup", {
        channelId = channelId,
        name = name
    })
end)

RegisterNetEvent("phone:messages:memberAdded", function(channelId, number)
    SendReactMessage("messages:addMember", {
        channelId = channelId,
        number = number
    })
end)

RegisterNetEvent("phone:messages:memberRemoved", function(channelId, number)
    SendReactMessage("messages:removeMember", {
        channelId = channelId,
        number = number
    })
end)

RegisterNetEvent("phone:messages:ownerChanged", function(channelId, number)
    SendReactMessage("messages:changeOwner", {
        channelId = channelId,
        number = number
    })
end)

RegisterNetEvent("phone:messages:newChannel", function(channelData)
    SendReactMessage("messages:newChannel", channelData)
end)
