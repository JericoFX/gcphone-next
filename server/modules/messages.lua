-- Creado/Modificado por JericoFX

local function SanitizeText(value, maxLength)
    if type(value) ~= 'string' then return '' end
    local text = value:gsub('[%z\1-\31\127]', '')
    text = text:gsub('<.->', '')
    text = text:gsub('^%s+', ''):gsub('%s+$', '')
    return text:sub(1, maxLength or 800)
end

local LastMessageSentBySource = {}
local LastStatusViewByIdentifier = {}
local SecurityResource = GetCurrentResourceName()
local STATUS_VIEW_DEBOUNCE_MS = 5 * 60 * 1000

local function HitRateLimit(source, key, windowMs, maxHits)
    local ok, blocked = pcall(function()
        return exports[SecurityResource]:HitRateLimit(source, key, windowMs, maxHits)
    end)
    if not ok then return false end
    return blocked == true
end

local function IsBlockedEither(sourceIdentifier, targetIdentifier, sourcePhone, targetPhone)
    local ok, blocked = pcall(function()
        return exports[SecurityResource]:IsBlockedEither(sourceIdentifier, targetIdentifier, sourcePhone, targetPhone)
    end)
    if not ok then return false end
    return blocked == true
end

local function CanSendMessage(source)
    local securityMs = (Config.Security and Config.Security.RateLimits and Config.Security.RateLimits.messages) or 900
    if HitRateLimit(source, 'messages', securityMs, 1) then
        return false
    end

    local now = GetGameTimer()
    local last = LastMessageSentBySource[source] or 0
    if (now - last) < 500 then
        return false
    end
    LastMessageSentBySource[source] = now
    return true
end

local function ToPositiveInt(value)
    local n = tonumber(value)
    if not n then return nil end
    if n < 1 then return nil end
    return math.floor(n)
end

local function SanitizePhoneNumber(value)
    if type(value) ~= 'string' then return '' end
    local number = value:gsub('[^%d%+%-%(%s%)]', '')
    number = number:gsub('^%s+', ''):gsub('%s+$', '')
    return number:sub(1, 20)
end

local function SanitizeMediaUrl(value)
    if type(value) ~= 'string' then return nil end
    local url = value:gsub('[%z\1-\31\127]', '')
    url = url:gsub('^%s+', ''):gsub('%s+$', '')
    if url == '' then return nil end
    if not url:match('^https?://') then return nil end
    local base = (url:match('^[^?]+') or url):lower()
    local allowed = { '.png', '.jpg', '.jpeg', '.webp', '.gif', '.mp4', '.webm', '.mov', '.m3u8', '.mp3', '.ogg', '.wav', '.m4a', '.aac' }
    for _, ext in ipairs(allowed) do
        if base:sub(-#ext) == ext then
            return url:sub(1, 500)
        end
    end
    return nil
end

local function IsGroupMember(groupId, identifier)
    if not groupId or not identifier then return false end
    local row = MySQL.single.await(
        'SELECT id FROM phone_chat_group_members WHERE group_id = ? AND identifier = ? LIMIT 1',
        { groupId, identifier }
    )
    return row ~= nil
end

local function AddPersistentNotification(identifier, payload)
    local ok, notificationId = pcall(function()
        return exports[GetCurrentResourceName()]:AddPersistentNotification(identifier, payload)
    end)
    if ok then return notificationId end
    return nil
end

local function GetPendingGroupInvites(identifier)
    if not identifier then return {} end

    return MySQL.query.await([[
        SELECT gi.id, gi.group_id, gi.created_at,
               g.name AS group_name,
               pn.phone_number AS inviter_number
        FROM phone_chat_group_invites gi
        INNER JOIN phone_chat_groups g ON g.id = gi.group_id
        LEFT JOIN phone_numbers pn ON pn.identifier = gi.inviter_identifier
        WHERE gi.target_identifier = ?
          AND gi.status = 'pending'
        ORDER BY gi.created_at DESC
    ]], { identifier }) or {}
end

local function ResolveStatusMediaType(url)
    if type(url) ~= 'string' or url == '' then return nil end
    local base = (url:match('^[^?]+') or url):lower()
    if base:match('%.mp4$') or base:match('%.webm$') or base:match('%.mov$') or base:match('%.m3u8$') then
        return 'video'
    end
    if base:match('%.png$') or base:match('%.jpg$') or base:match('%.jpeg$') or base:match('%.webp$') or base:match('%.gif$') then
        return 'image'
    end
    return nil
end

local function IsStatusUploadReady(mediaType)
    local provider = tostring(GetConvar('gcphone_storage_provider', tostring(Config.Storage and Config.Storage.Provider or 'custom'))):lower()
    if provider == 'direct' then provider = 'custom' end

    if provider == 'server_folder' then
        local publicUrl = tostring(GetConvar('gcphone_storage_server_folder_public_url', tostring(Config.Storage and Config.Storage.ServerFolder and Config.Storage.ServerFolder.PublicBaseUrl or '')))
        return publicUrl:match('^https?://') ~= nil
    end

    local uploadUrl = ''
    if provider == 'fivemanage' then
        uploadUrl = tostring(GetConvar('gcphone_storage_fivemanage_url', tostring(Config.Storage and Config.Storage.FiveManage and Config.Storage.FiveManage.Endpoint or '')))
    elseif provider == 'local' then
        uploadUrl = tostring(GetConvar('gcphone_storage_local_url', ''))
    else
        uploadUrl = tostring(GetConvar('gcphone_storage_custom_url', tostring(Config.Storage and Config.Storage.Custom and Config.Storage.Custom.UploadUrl or '')))
    end

    if uploadUrl:match('^https?://') == nil then
        return false
    end

    if mediaType == 'video' then
        local maxVideo = tonumber((Config.Storage and Config.Storage.MaxVideoDurationSeconds) or 10) or 10
        return maxVideo >= 10
    end

    return true
end

local function TrimGroupMessages(groupId)
    if not groupId then return end

    local count = MySQL.scalar.await(
        'SELECT COUNT(*) FROM phone_chat_group_messages WHERE group_id = ?',
        { groupId }
    ) or 0

    if count <= 30 then
        return
    end

    MySQL.query.await([[
        DELETE FROM phone_chat_group_messages
        WHERE group_id = ?
          AND id NOT IN (
              SELECT id FROM (
                  SELECT id
                  FROM phone_chat_group_messages
                  WHERE group_id = ?
                  ORDER BY id DESC
                  LIMIT 30
              ) recent
          )
    ]], { groupId, groupId })
end

local function ShouldCountStatusView(identifier, statusId)
    if not identifier or not statusId then return false end
    local key = string.format('%s:%s', identifier, statusId)
    local now = GetGameTimer()
    local last = LastStatusViewByIdentifier[key] or 0
    if now - last < STATUS_VIEW_DEBOUNCE_MS then
        return false
    end

    LastStatusViewByIdentifier[key] = now
    return true
end

local function GetMessages(identifier)
    if not identifier then return {} end
    
    local phoneNumber = GetPhoneNumber(identifier)
    if not phoneNumber then return {} end
    
    return MySQL.query.await(
        'SELECT * FROM phone_messages WHERE receiver = ? OR transmitter = ? ORDER BY time DESC',
        { phoneNumber, phoneNumber }
    ) or {}
end

local function GetWaveStatuses(identifier)
    if not identifier then return {} end

    local myNumber = GetPhoneNumber(identifier)
    if not myNumber then return {} end

    return MySQL.query.await([[
        SELECT ws.id, ws.identifier, ws.phone_number, ws.media_url, ws.media_type, ws.caption, ws.views, ws.created_at, ws.expires_at,
               pc.display AS contact_name
        FROM phone_wavechat_statuses ws
        LEFT JOIN phone_contacts pc
          ON pc.identifier = ? AND pc.number = ws.phone_number
        WHERE ws.expires_at > NOW()
          AND (
            ws.identifier = ?
            OR ws.phone_number IN (SELECT number FROM phone_contacts WHERE identifier = ?)
          )
        ORDER BY ws.created_at DESC
        LIMIT 60
    ]], { identifier, identifier, identifier }) or {}
end

local function GetConversation(identifier, phoneNumber)
    if not identifier or not phoneNumber then return {} end
    
    local myNumber = GetPhoneNumber(identifier)
    if not myNumber then return {} end
    
    return MySQL.query.await(
        'SELECT * FROM phone_messages WHERE (receiver = ? AND transmitter = ?) OR (receiver = ? AND transmitter = ?) ORDER BY time ASC',
        { myNumber, phoneNumber, phoneNumber, myNumber }
    ) or {}
end

lib.callback.register('gcphone:getMessages', function(source)
    local identifier = GetIdentifier(source)
    return GetMessages(identifier)
end)

lib.callback.register('gcphone:getConversation', function(source, phoneNumber)
    local identifier = GetIdentifier(source)
    return GetConversation(identifier, phoneNumber)
end)

lib.callback.register('gcphone:sendMessage', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false end
    
    local myNumber = GetPhoneNumber(identifier)
    if not myNumber then return false end

    if not CanSendMessage(source) then
        return false, 'Rate limited'
    end
    
    if type(data) ~= 'table' then
        return false, 'Invalid data'
    end

    local targetPhone = SanitizePhoneNumber(data.phoneNumber)
    local message = SanitizeText(data.message, 800)
    local mediaUrl = SanitizeMediaUrl(data.mediaUrl)

    if targetPhone == '' then
        return false, 'Invalid number'
    end

    if targetPhone == myNumber then
        return false, 'Invalid number'
    end

    if message == '' and not mediaUrl then
        return false, 'Invalid data'
    end

    if message == '%pos%' then
        local ped = GetPlayerPed(source)
        local coords = GetEntityCoords(ped)
        message = string.format('GPS: %.2f, %.2f', coords.x, coords.y)
    end
    
    local targetIdentifier = GetIdentifierByPhone(targetPhone)
    if IsBlockedEither(identifier, targetIdentifier, myNumber, targetPhone) then
        return false, 'BLOCKED_CONTACT'
    end
    
    local messageId = MySQL.insert.await(
        'INSERT INTO phone_messages (transmitter, receiver, message, media_url, owner) VALUES (?, ?, ?, ?, ?)',
        { myNumber, targetPhone, message, mediaUrl, 1 }
    )
    
    local sentMessage = MySQL.single.await(
        'SELECT * FROM phone_messages WHERE id = ?',
        { messageId }
    )
    
    TriggerClientEvent('gcphone:messageSent', source, sentMessage)
    
    if targetIdentifier then
        local targetSource = GetSourceFromIdentifier(targetIdentifier)
        
        if targetSource then
            local receivedId = MySQL.insert.await(
                'INSERT INTO phone_messages (transmitter, receiver, message, media_url, owner, is_read) VALUES (?, ?, ?, ?, ?, ?)',
                { myNumber, targetPhone, message, mediaUrl, 0, 0 }
            )
            
            local receivedMessage = MySQL.single.await(
                'SELECT * FROM phone_messages WHERE id = ?',
                { receivedId }
            )
            
            TriggerClientEvent('gcphone:messageReceived', targetSource, receivedMessage)
        end
    end
    
    return true
end)

lib.callback.register('gcphone:deleteMessage', function(source, messageId)
    local identifier = GetIdentifier(source)
    if not identifier then return false end
    
    local myNumber = GetPhoneNumber(identifier)
    if not myNumber then return false end

    local id = ToPositiveInt(messageId)
    if not id then return false end
    
    MySQL.execute.await(
        'DELETE FROM phone_messages WHERE id = ? AND (receiver = ? OR transmitter = ?)',
        { id, myNumber, myNumber }
    )
    
    return true
end)

lib.callback.register('gcphone:deleteConversation', function(source, phoneNumber)
    local identifier = GetIdentifier(source)
    if not identifier then return false end
    
    local myNumber = GetPhoneNumber(identifier)
    if not myNumber then return false end
    
    local targetPhone = SanitizePhoneNumber(phoneNumber)
    if targetPhone == '' then return false end

    MySQL.execute.await(
        'DELETE FROM phone_messages WHERE (receiver = ? AND transmitter = ?) OR (receiver = ? AND transmitter = ?)',
        { myNumber, targetPhone, targetPhone, myNumber }
    )
    
    return true
end)

lib.callback.register('gcphone:markAsRead', function(source, phoneNumber)
    local identifier = GetIdentifier(source)
    if not identifier then return false end
    
    local myNumber = GetPhoneNumber(identifier)
    if not myNumber then return false end
    
    local targetPhone = SanitizePhoneNumber(phoneNumber)
    if targetPhone == '' then return false end

    MySQL.update.await(
        'UPDATE phone_messages SET is_read = 1 WHERE receiver = ? AND transmitter = ? AND is_read = 0',
        { myNumber, targetPhone }
    )
    
    return true
end)

lib.callback.register('gcphone:getUnreadCount', function(source)
    local identifier = GetIdentifier(source)
    if not identifier then return 0 end
    
    local myNumber = GetPhoneNumber(identifier)
    if not myNumber then return 0 end
    
    local count = MySQL.scalar.await(
        'SELECT COUNT(*) FROM phone_messages WHERE receiver = ? AND is_read = 0 AND owner = 0',
        { myNumber }
    )
    
    return count or 0
end)

lib.callback.register('gcphone:wavechatGetGroups', function(source)
    local identifier = GetIdentifier(source)
    if not identifier then return {} end

    return MySQL.query.await(
        [[
            SELECT g.id, g.name, g.avatar, g.created_at,
                   COUNT(m.id) AS members
            FROM phone_chat_groups g
            INNER JOIN phone_chat_group_members gm ON gm.group_id = g.id
            LEFT JOIN phone_chat_group_members m ON m.group_id = g.id
            WHERE gm.identifier = ?
            GROUP BY g.id
            ORDER BY g.created_at DESC
        ]],
        { identifier }
    ) or {}
end)

lib.callback.register('gcphone:wavechatGetInvites', function(source)
    local identifier = GetIdentifier(source)
    if not identifier then return {} end
    return GetPendingGroupInvites(identifier)
end)

lib.callback.register('gcphone:wavechatCreateGroup', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false, 'Invalid source' end
    if type(data) ~= 'table' then return false, 'Invalid data' end

    local name = SanitizeText(data.name, 80)
    if name == '' then return false, 'Name required' end

    local members = type(data.members) == 'table' and data.members or {}
    local memberIdentifiers = {}
    local totalMembers = 1

    for _, entry in ipairs(members) do
        local number = SanitizePhoneNumber(tostring(entry or ''))
        if number ~= '' then
            local targetIdentifier = GetIdentifierByPhone(number)
            if targetIdentifier and targetIdentifier ~= identifier and not memberIdentifiers[targetIdentifier] then
                memberIdentifiers[targetIdentifier] = true
                totalMembers = totalMembers + 1
            end
        end
        if totalMembers >= 25 then break end
    end

    local groupId = MySQL.insert.await(
        'INSERT INTO phone_chat_groups (owner_identifier, name, avatar) VALUES (?, ?, ?)',
        { identifier, name, nil }
    )

    MySQL.insert.await(
        'INSERT INTO phone_chat_group_members (group_id, identifier, role) VALUES (?, ?, ?)',
        { groupId, identifier, 'owner' }
    )

    for memberIdentifier in pairs(memberIdentifiers) do
        MySQL.insert.await(
            [[INSERT INTO phone_chat_group_invites (group_id, inviter_identifier, target_identifier, status)
              VALUES (?, ?, ?, 'pending')
              ON DUPLICATE KEY UPDATE inviter_identifier = VALUES(inviter_identifier), status = 'pending', responded_at = NULL]],
            { groupId, identifier, memberIdentifier }
        )

        AddPersistentNotification(memberIdentifier, {
            appId = 'wavechat',
            title = 'Invitacion a grupo',
            content = string.format('Te invitaron a "%s"', name),
            meta = { type = 'wavechat_group_invite', groupId = groupId },
        })
    end

    return true, groupId
end)

lib.callback.register('gcphone:wavechatGetGroupMessages', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return {} end
    if type(data) ~= 'table' then return {} end

    local groupId = ToPositiveInt(data.groupId)
    if not groupId then return {} end
    if not IsGroupMember(groupId, identifier) then return {} end

    return MySQL.query.await(
        [[
            SELECT gm.id, gm.group_id, gm.sender_identifier, gm.sender_number, gm.message, gm.media_url, gm.created_at,
                   COALESCE(pn.phone_number, gm.sender_number) AS sender_phone
            FROM phone_chat_group_messages gm
            LEFT JOIN phone_numbers pn ON pn.identifier = gm.sender_identifier
            WHERE gm.group_id = ?
            ORDER BY gm.created_at ASC
            LIMIT 30
        ]],
        { groupId }
    ) or {}
end)

lib.callback.register('gcphone:wavechatRespondInvite', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false, 'Invalid source' end
    if type(data) ~= 'table' then return false, 'Invalid data' end

    local inviteId = ToPositiveInt(data.inviteId)
    local accept = data.accept == true
    if not inviteId then return false, 'Invalid invite' end

    local invite = MySQL.single.await(
        'SELECT id, group_id FROM phone_chat_group_invites WHERE id = ? AND target_identifier = ? AND status = ? LIMIT 1',
        { inviteId, identifier, 'pending' }
    )
    if not invite then return false, 'Invite not found' end

    if accept then
        MySQL.insert.await(
            'INSERT INTO phone_chat_group_members (group_id, identifier, role) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE role = role',
            { invite.group_id, identifier, 'member' }
        )
    end

    MySQL.update.await(
        'UPDATE phone_chat_group_invites SET status = ?, responded_at = NOW() WHERE id = ?',
        { accept and 'accepted' or 'declined', inviteId }
    )

    return true, {
        accepted = accept,
        groupId = invite.group_id,
    }
end)

lib.callback.register('gcphone:wavechatSendGroupMessage', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false, 'Invalid source' end
    if type(data) ~= 'table' then return false, 'Invalid data' end

    local groupId = ToPositiveInt(data.groupId)
    if not groupId then return false, 'Invalid group' end
    if not IsGroupMember(groupId, identifier) then return false, 'Not a member' end

    local waveMs = (Config.Security and Config.Security.RateLimits and Config.Security.RateLimits.wavechat) or 700
    if HitRateLimit(source, 'wavechat', waveMs, 1) then return false, 'RATE_LIMITED' end

    local message = SanitizeText(data.message, 800)
    local mediaUrl = SanitizeMediaUrl(data.mediaUrl)
    if message == '' and not mediaUrl then return false, 'Empty message' end

    local senderNumber = GetPhoneNumber(identifier)
    local messageId = MySQL.insert.await(
        'INSERT INTO phone_chat_group_messages (group_id, sender_identifier, sender_number, message, media_url) VALUES (?, ?, ?, ?, ?)',
        { groupId, identifier, senderNumber, message, mediaUrl }
    )

    local payload = MySQL.single.await(
        'SELECT id, group_id, sender_identifier, sender_number, message, media_url, created_at FROM phone_chat_group_messages WHERE id = ?',
        { messageId }
    )

    TrimGroupMessages(groupId)

    local members = MySQL.query.await('SELECT identifier FROM phone_chat_group_members WHERE group_id = ?', { groupId }) or {}
    for _, row in ipairs(members) do
        local memberSource = GetSourceFromIdentifier(row.identifier)
        if memberSource then
            TriggerClientEvent('gcphone:wavechatGroupMessage', memberSource, payload)
        end
    end

    return true, payload
end)

exports('GetMessages', GetMessages)
exports('GetConversation', GetConversation)

AddEventHandler('gcphone:wavechat:persistBatch', function(requestId, entries)
    local reqId = tonumber(requestId) or 0
    if reqId < 1 or type(entries) ~= 'table' then
        emit('gcphone:wavechat:persistBatchResult', reqId, false, 0, 'INVALID_BATCH')
        return
    end

    local placeholders = {}
    local params = {}
    local inserted = 0

    for _, entry in ipairs(entries) do
        if type(entry) == 'table' then
            local identifier = type(entry.senderIdentifier) == 'string' and entry.senderIdentifier or nil
            local groupId = ToPositiveInt(entry.groupId)
            local message = SanitizeText(entry.message, 800)
            local mediaUrl = SanitizeMediaUrl(entry.mediaUrl)

            if identifier and groupId and (message ~= '' or mediaUrl) and IsGroupMember(groupId, identifier) then
                local senderNumber = GetPhoneNumber(identifier)
                if senderNumber then
                    placeholders[#placeholders + 1] = '(?, ?, ?, ?, ?)'
                    params[#params + 1] = groupId
                    params[#params + 1] = identifier
                    params[#params + 1] = senderNumber
                    params[#params + 1] = message
                    params[#params + 1] = mediaUrl
                    inserted = inserted + 1
                end
            end
        end
    end

    if inserted > 0 then
        MySQL.query.await(
            'INSERT INTO phone_chat_group_messages (group_id, sender_identifier, sender_number, message, media_url) VALUES ' .. table.concat(placeholders, ', '),
            params
        )

        local trimmedGroups = {}
        for _, entry in ipairs(entries) do
            local groupId = type(entry) == 'table' and ToPositiveInt(entry.groupId) or nil
            if groupId and not trimmedGroups[groupId] then
                trimmedGroups[groupId] = true
                TrimGroupMessages(groupId)
            end
        end
    end

    emit('gcphone:wavechat:persistBatchResult', reqId, true, inserted, nil)
end)

lib.callback.register('gcphone:wavechatGetStatuses', function(source)
    local identifier = GetIdentifier(source)
    return GetWaveStatuses(identifier)
end)

lib.callback.register('gcphone:wavechatCreateStatus', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false, 'Invalid source' end
    if type(data) ~= 'table' then return false, 'Invalid data' end

    local phoneNumber = GetPhoneNumber(identifier)
    if not phoneNumber then return false, 'Invalid source' end

    local mediaUrl = SanitizeMediaUrl(data.mediaUrl)
    local mediaType = ResolveStatusMediaType(mediaUrl)
    local caption = SanitizeText(data.caption, 140)
    if not mediaUrl or not mediaType then
        return false, 'INVALID_MEDIA'
    end

    if not IsStatusUploadReady(mediaType) then
        return false, 'MEDIA_ENDPOINT_DISABLED'
    end

    local waveMs = (Config.Security and Config.Security.RateLimits and Config.Security.RateLimits.wavechat) or 700
    if HitRateLimit(source, 'wavechat_status', waveMs * 2, 1) then return false, 'RATE_LIMITED' end

    MySQL.insert.await(
        'INSERT INTO phone_wavechat_statuses (identifier, phone_number, media_url, media_type, caption, expires_at) VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR))',
        { identifier, phoneNumber, mediaUrl, mediaType, caption ~= '' and caption or nil }
    )

    MySQL.query.await([[
        DELETE FROM phone_wavechat_statuses
        WHERE identifier = ?
          AND id NOT IN (
              SELECT id FROM (
                  SELECT id FROM phone_wavechat_statuses WHERE identifier = ? ORDER BY id DESC LIMIT 30
              ) recent
          )
    ]], { identifier, identifier })

    return true
end)

lib.callback.register('gcphone:wavechatMarkStatusViewed', function(source, statusId)
    local identifier = GetIdentifier(source)
    local id = ToPositiveInt(statusId)
    if not identifier or not id then return false end
    if not ShouldCountStatusView(identifier, id) then return true end

    MySQL.update.await(
        'UPDATE phone_wavechat_statuses SET views = views + 1 WHERE id = ? AND identifier != ? AND expires_at > NOW()',
        { id, identifier }
    )

    return true
end)

AddEventHandler('playerDropped', function()
    LastMessageSentBySource[source] = nil
end)
