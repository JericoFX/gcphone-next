-- Live Chat System for Clips
-- Handles real-time chat during live streams with Socket.IO

local ActiveLives = {}
local MutedUsers = {}
local MutedMessages = {
    es = 'Estas silenciado',
    en = 'You are muted',
    pt = 'Voce esta silenciado',
    fr = 'Vous etes muet',
}

local function SanitizeText(value, maxLength)
    if type(value) ~= 'string' then return '' end
    local text = value:gsub('[%z\1-\31\127]', '')
    text = text:gsub('<.->', '')
    text = text:gsub('^%s+', ''):gsub('%s+$', '')
    return text:sub(1, maxLength or 500)
end

local function GenerateMessageId()
    return string.format('%x-%x-%x', os.time(), math.random(1000, 9999), math.random(1000, 9999))
end

-- Create live room
RegisterNetEvent('gcphone:live:create')
AddEventHandler('gcphone:live:create', function(clipId, avatar)
    local source = source
    local identifier = GetIdentifier(source)
    
    if not identifier then return end
    
    ActiveLives[clipId] = {
        owner = source,
        ownerIdentifier = identifier,
        ownerAvatar = avatar or nil,
        users = {},
        messages = {},
        reactions = {},
        createdAt = os.time()
    }
    
    TriggerClientEvent('gcphone:live:created', source, clipId)
end)

-- Join live room
RegisterNetEvent('gcphone:live:join')
AddEventHandler('gcphone:live:join', function(clipId)
    local source = source
    local live = ActiveLives[clipId]
    
    if not live then return end
    
    local username = GetPlayerName(source) or 'Usuario'
    local account = MySQL.single.await('SELECT avatar FROM phone_snap_accounts WHERE identifier = ?', { GetIdentifier(source) })
    
    live.users[source] = {
        username = username,
        avatar = account and account.avatar or nil,
        joinedAt = os.time()
    }
    
    -- Send last 20 messages to new user
    local history = {}
    local startIdx = math.max(1, #live.messages - 19)
    for i = startIdx, #live.messages do
        history[#history + 1] = live.messages[i]
    end
    
    TriggerClientEvent('gcphone:live:joined', source, {
        clipId = clipId,
        history = history,
        isOwner = (source == live.owner),
        ownerAvatar = live.ownerAvatar
    })
end)

-- Leave live room
RegisterNetEvent('gcphone:live:leave')
AddEventHandler('gcphone:live:leave', function(clipId)
    local source = source
    local live = ActiveLives[clipId]
    
    if not live then return end
    
    live.users[source] = nil
end)

-- Send message
RegisterNetEvent('gcphone:live:message')
AddEventHandler('gcphone:live:message', function(clipId, content)
    local source = source
    local live = ActiveLives[clipId]
    
    if not live then return end
    
    -- Check if user is muted
    if MutedUsers[source] and MutedUsers[source][clipId] then
        local lang = type(GetPhoneLanguageForSource) == 'function' and GetPhoneLanguageForSource(source, true) or 'es'
        TriggerClientEvent('gcphone:live:error', source, MutedMessages[lang] or MutedMessages.es)
        return
    end
    
    content = SanitizeText(content, 500)
    if content == '' then return end
    
    local user = live.users[source]
    if not user then return end
    
    local message = {
        id = GenerateMessageId(),
        clipId = clipId,
        username = user.username,
        avatar = user.avatar,
        content = content,
        isMention = content:find('@' .. GetPlayerName(live.owner)) ~= nil,
        timestamp = os.time()
    }
    
    -- Add to history (keep only last 20)
    live.messages[#live.messages + 1] = message
    if #live.messages > 20 then
        table.remove(live.messages, 1)
    end
    
    -- Broadcast to all users in room
    for userSource, _ in pairs(live.users) do
        TriggerClientEvent('gcphone:live:message', userSource, message)
    end
    TriggerClientEvent('gcphone:live:message', live.owner, message)
end)

-- Send reaction (👍❤️😂)
RegisterNetEvent('gcphone:live:reaction')
AddEventHandler('gcphone:live:reaction', function(clipId, reaction)
    local source = source
    local live = ActiveLives[clipId]
    
    if not live then return end
    
    local validReactions = { '👍', '❤️', '😂', '🔥', '👏' }
    if not table.concat(validReactions):find(reaction) then return end
    
    local user = live.users[source]
    if not user then return end
    
    local reactionData = {
        id = GenerateMessageId(),
        clipId = clipId,
        username = user.username,
        avatar = user.avatar,
        reaction = reaction,
        timestamp = os.time()
    }
    
    -- Broadcast reaction (doesn't save to history)
    for userSource, _ in pairs(live.users) do
        TriggerClientEvent('gcphone:live:reaction', userSource, reactionData)
    end
    TriggerClientEvent('gcphone:live:reaction', live.owner, reactionData)
end)

-- Delete message (owner only)
RegisterNetEvent('gcphone:live:deleteMessage')
AddEventHandler('gcphone:live:deleteMessage', function(clipId, messageId)
    local source = source
    local live = ActiveLives[clipId]
    
    if not live then return end
    if source ~= live.owner then return end
    
    -- Remove from messages
    for i, msg in ipairs(live.messages) do
        if msg.id == messageId then
            table.remove(live.messages, i)
            break
        end
    end
    
    -- Broadcast deletion
    for userSource, _ in pairs(live.users) do
        TriggerClientEvent('gcphone:live:messageDeleted', userSource, messageId)
    end
    TriggerClientEvent('gcphone:live:messageDeleted', live.owner, messageId)
end)

-- Mute user (owner only)
RegisterNetEvent('gcphone:live:mute')
AddEventHandler('gcphone:live:mute', function(clipId, targetUsername)
    local source = source
    local live = ActiveLives[clipId]
    
    if not live then return end
    if source ~= live.owner then return end
    
    -- Find user by username
    for userSource, userData in pairs(live.users) do
        if userData.username == targetUsername then
            if not MutedUsers[userSource] then
                MutedUsers[userSource] = {}
            end
            MutedUsers[userSource][clipId] = true
            
            TriggerClientEvent('gcphone:live:muted', userSource, clipId)
            break
        end
    end
end)

-- Unmute user (owner only)
RegisterNetEvent('gcphone:live:unmute')
AddEventHandler('gcphone:live:unmute', function(clipId, targetUsername)
    local source = source
    local live = ActiveLives[clipId]
    
    if not live then return end
    if source ~= live.owner then return end
    
    for userSource, userData in pairs(live.users) do
        if userData.username == targetUsername then
            if MutedUsers[userSource] then
                MutedUsers[userSource][clipId] = nil
            end
            TriggerClientEvent('gcphone:live:unmuted', userSource, clipId)
            break
        end
    end
end)

-- End live (cleanup)
RegisterNetEvent('gcphone:live:end')
AddEventHandler('gcphone:live:end', function(clipId)
    local source = source
    local live = ActiveLives[clipId]
    
    if not live then return end
    if source ~= live.owner then return end
    
    -- Notify all users
    for userSource, _ in pairs(live.users) do
        TriggerClientEvent('gcphone:live:ended', userSource, clipId)
    end
    
    -- Cleanup
    ActiveLives[clipId] = nil
end)

-- Cleanup on resource stop
AddEventHandler('onResourceStop', function(resourceName)
    if resourceName == GetCurrentResourceName() then
        for clipId, live in pairs(ActiveLives) do
            for userSource, _ in pairs(live.users) do
                TriggerClientEvent('gcphone:live:ended', userSource, clipId)
            end
        end
        ActiveLives = {}
        MutedUsers = {}
    end
end)

-- Export for other modules
exports('GetLiveRoom', function(clipId)
    return ActiveLives[clipId]
end)
