local Instagram = {}
local LiveStreams = {}
local CallData = {}

-- Helper function to get logged in Instagram account for a player
local function GetPlayerInstagramAccount(source)
    local phoneNumber = GetEquippedPhoneNumber(source)
    if not phoneNumber then return false end
    return GetLoggedInAccount(phoneNumber, "Instagram")
end

-- Function to get all phone numbers associated with an Instagram username
local function GetPhoneNumbersForUsername(username)
    local phoneNumbers = {}
    local result = MySQL.query.await(
        "SELECT phone_number FROM phone_logged_in_accounts WHERE app = 'Instagram' AND `active` = 1 AND username = ?",
        { username }
    )

    for _, row in ipairs(result) do
        table.insert(phoneNumbers, row.phone_number)
    end

    return phoneNumbers
end

-- Wrapper for Instagram callbacks with authentication
local function InstagramCallback(name, callback, defaultReturn)
    BaseCallback("instagram:" .. name, function(source, cb, ...)
        local account = GetPlayerInstagramAccount(source)
        if not account then return cb(defaultReturn) end
        return callback(source, cb, account, ...)
    end, defaultReturn)
end

-- Send notification to all devices logged into an Instagram account
local function SendInstagramNotification(username, notification, excludePhoneNumber)
    notification.app = "Instagram"
    local phoneNumbers = GetPhoneNumbersForUsername(username)

    for _, phoneNumber in ipairs(phoneNumbers) do
        if phoneNumber ~= excludePhoneNumber then
            SendNotification(phoneNumber, notification)
        end
    end
end

-- Live Stream Functions
RegisterLegacyCallback("instagram:getLives", function(source, cb)
    local account = GetPlayerInstagramAccount(source)
    if not account then return cb({}) end

    local visibleStreams = {}

    for username, streamData in pairs(LiveStreams) do
        if streamData.private then
            local isFollowing = MySQL.Sync.fetchScalar(
                "SELECT TRUE FROM phone_instagram_follows WHERE follower=@follower AND followed=@followed",
                { ["@follower"] = account, ["@followed"] = username }
            )

            if isFollowing then
                visibleStreams[username] = streamData
            end
        else
            visibleStreams[username] = streamData
        end
    end

    cb(visibleStreams)
end)

RegisterLegacyCallback("instagram:getLiveViewers", function(source, cb, streamUsername)
    local stream = LiveStreams[streamUsername]
    if not stream then return cb({}) end

    local viewerData = {}

    for _, viewerSource in ipairs(stream.viewers) do
        local phoneNumber = GetEquippedPhoneNumber(viewerSource)
        if phoneNumber then
            local result = MySQL.Sync.fetchAll([[
                SELECT
                    a.profile_image AS avatar, a.verified, a.display_name AS `name`, a.username
                FROM phone_logged_in_accounts l
                INNER JOIN phone_instagram_accounts a ON l.username = a.username
                WHERE l.phone_number = ? AND l.active = 1 AND l.app = 'Instagram'
            ]], { phoneNumber })

            if result and result[1] then
                table.insert(viewerData, result[1])
            end
        end
    end

    cb(viewerData)
end)

RegisterLegacyCallback("instagram:canGoLive", function(source, cb)
    local account = GetPlayerInstagramAccount(source)
    if not account then return cb(false) end

    local canGoLive, errorMessage = CanGoLive(source, account)

    if not canGoLive then
        local phoneNumber = GetEquippedPhoneNumber(source)
        if phoneNumber then
            SendNotification(phoneNumber, {
                app = "Instagram",
                title = errorMessage or L("BACKEND.INSTAGRAM.NOT_ALLOWED_LIVE")
            })
        end
    end

    cb(canGoLive)
end)

RegisterLegacyCallback("instagram:canCreateStory", function(source, cb)
    local account = GetPlayerInstagramAccount(source)
    if not account then return cb(false) end

    local canCreate, errorMessage = CanCreateStory(source, account)

    if not canCreate then
        local phoneNumber = GetEquippedPhoneNumber(source)
        if phoneNumber then
            SendNotification(phoneNumber, {
                app = "Instagram",
                title = errorMessage or L("BACKEND.INSTAGRAM.NOT_ALLOWED_STORY")
            })
        end
    end

    cb(canCreate)
end)

RegisterNetEvent("phone:instagram:startLive")
AddEventHandler("phone:instagram:startLive", function(streamId)
    local source = source
    local account = GetPlayerInstagramAccount(source)

    if not account or LiveStreams[account] then return end

    local canGoLive = CanGoLive(source, account)
    if not canGoLive then return end

    local accountData = MySQL.single.await(
        "SELECT profile_image, verified, display_name, private FROM phone_instagram_accounts WHERE username = ?",
        { account }
    )

    if not accountData then return end

    LiveStreams[account] = {
        id = streamId,
        avatar = accountData.profile_image,
        verified = accountData.verified,
        name = accountData.display_name,
        private = accountData.private,
        host = source,
        viewers = {},
        nearby = {},
        invites = {},
        participants = {}
    }

    local player = Player(source).state
    player.instapicIsLive = account

    TriggerClientEvent("phone:instagram:updateLives", -1, LiveStreams)

    Log("InstaPic", source, "success", L("BACKEND.LOGS.LIVE_TITLE"), L("BACKEND.LOGS.STARTED_LIVE", { username = account }))
    TrackSimpleEvent("go_live")

    local notification = {
        title = L("APPS.INSTAGRAM.TITLE"),
        content = L("BACKEND.INSTAGRAM.STARTED_LIVE", { username = account })
    }

    if Config.InstaPicLiveNotifications then
        local notifyType = Config.InstaPicLiveNotifications == "all" and "all" or "online"
        NotifyEveryone(notifyType, {
            app = "Instagram",
            title = notification.title,
            content = notification.content
        })
    else
        local followers = MySQL.query.await(
            "SELECT follower FROM phone_instagram_follows WHERE followed = ?",
            { account }
        )

        for _, follower in ipairs(followers) do
            SendInstagramNotification(follower.follower, notification)
        end
    end
end)

local function CleanupLiveStream(streamData)
    if not streamData.participants then return end

    local voiceTargets = table.clone(streamData.viewers)
    table.insert(voiceTargets, streamData.host)

    -- Clean up participants
    for _, participant in ipairs(streamData.participants) do
        if participant.username then
            local participantStream = LiveStreams[participant.username]
            if participantStream then
                TriggerClientEvent("phone:phone:removeVoiceTarget", participantStream.host, voiceTargets)

                local participantPlayer = Player(participantStream.host).state
                participantPlayer.instapicIsLive = nil

                LiveStreams[participant.username] = nil
                TriggerClientEvent("phone:instagram:endLive", -1, participant.username)
            end
        end
    end

    -- Clean up nearby viewers
    for _, nearbySource in ipairs(streamData.nearby) do
        if nearbySource then
            TriggerClientEvent("phone:phone:removeVoiceTarget", nearbySource, voiceTargets)
            TriggerClientEvent("phone:instagram:leftProximity", -1, nearbySource, streamData.host)
        end
    end

    -- Clean up host
    TriggerClientEvent("phone:phone:removeVoiceTarget", streamData.host, streamData.viewers)
end

local function RemoveParticipantFromStream(hostUsername, participantUsername)
    local stream = LiveStreams[hostUsername]
    if not stream or not stream.participants then return end

    local found = false
    local participantSource = nil

    for i, participant in ipairs(stream.participants) do
        if participant.username == participantUsername then
            participantSource = participant.source
            table.remove(stream.participants, i)
            found = true
            break
        end
    end

    if not found then return end

    local voiceTargets = table.clone(stream.viewers)
    table.insert(voiceTargets, stream.host)

    for _, target in ipairs(voiceTargets) do
        TriggerClientEvent("phone:instagram:leftLive", target, hostUsername, participantUsername, participantSource)
    end

    -- Update voice targets for remaining participants
    local remainingVoiceTargets = table.clone(stream.viewers)
    for _, participant in ipairs(stream.participants) do
        for i, viewer in ipairs(remainingVoiceTargets) do
            if viewer == participant.source then
                table.remove(remainingVoiceTargets, i)
                break
            end
        end
    end

    TriggerClientEvent("phone:phone:removeVoiceTarget", participantSource, remainingVoiceTargets)
end

RegisterLegacyCallback("instagram:endLive", function(source, cb)
    local account = GetPlayerInstagramAccount(source)
    if not account then return cb(true) end

    local stream = LiveStreams[account]
    if not stream then return cb(true) end

    if stream.participant then
        RemoveParticipantFromStream(stream.participant, account)
    else
        CleanupLiveStream(stream)
    end

    LiveStreams[account] = nil
    local player = Player(source).state
    player.instapicIsLive = nil

    TriggerClientEvent("phone:instagram:updateLives", -1, LiveStreams)
    TriggerClientEvent("phone:instagram:endLive", -1, account, stream.participant)

    Log("InstaPic", source, "error", L("BACKEND.LOGS.LIVE_TITLE"), L("BACKEND.LOGS.ENDED_LIVE", { username = account }))
    cb(true)
end)

AddEventHandler("playerDropped", function()
    local source = source

    for username, streamData in pairs(LiveStreams) do
        -- Check viewers
        for i, viewerSource in ipairs(streamData.viewers) do
            if viewerSource == source then
                if CallData[source] then
                    TriggerClientEvent("phone:endCall", streamData.host, CallData[source])
                    CallData[source] = nil
                end

                table.remove(streamData.viewers, i)
                TriggerClientEvent("phone:instagram:updateViewers", -1, username, #streamData.viewers)
            end
        end

        -- Check host
        if streamData.host == source then
            if streamData.participant then
                RemoveParticipantFromStream(streamData.participant, username)
            else
                CleanupLiveStream(streamData)
            end

            LiveStreams[username] = nil
            TriggerClientEvent("phone:instagram:updateLives", -1, LiveStreams)
            TriggerClientEvent("phone:instagram:endLive", -1, username, streamData.participant)
            return
        end
    end
end)

RegisterNetEvent("phone:instagram:addCall")
AddEventHandler("phone:instagram:addCall", function(callId)
    local source = source
    local inLiveStream = false

    -- Check if player is viewing any live stream
    for _, streamData in pairs(LiveStreams) do
        for _, viewerSource in ipairs(streamData.viewers) do
            if viewerSource == source then
                inLiveStream = true
                break
            end
        end
        if inLiveStream then break end
    end

    -- Add call data if not already present and in a live stream
    if not CallData[source] and inLiveStream then
        CallData[source] = callId
    end
end)

RegisterLegacyCallback("instagram:viewLive", function(source, cb, streamUsername)
    local viewerSource = source
    local stream = LiveStreams[streamUsername]
    if not stream then return cb(false) end

    local alreadyViewing = false

    -- Check if already viewing
    for _, viewer in ipairs(stream.viewers) do
        if viewer == viewerSource then
            alreadyViewing = true
            break
        end
    end

    if not alreadyViewing then
        table.insert(stream.viewers, viewerSource)

        -- Add voice target for host
        TriggerClientEvent("phone:phone:addVoiceTarget", stream.host, viewerSource)

        -- Update viewers count
        TriggerClientEvent("phone:instagram:updateViewers", -1, streamUsername, #stream.viewers)

        -- Add voice targets for participants
        for _, participant in ipairs(stream.participants) do
            TriggerClientEvent("phone:phone:addVoiceTarget", participant.source, viewerSource)
        end

        -- Handle nearby viewers after a short delay
        SetTimeout(500, function()
            if not stream.nearby then stream.nearby = {} end

            for _, nearbySource in ipairs(stream.nearby) do
                TriggerClientEvent("phone:phone:addVoiceTarget", nearbySource, viewerSource)
                TriggerClientEvent("phone:instagram:enteredProximity", viewerSource, nearbySource, stream.host)
            end
        end)
    end

    cb(stream)
end)

RegisterLegacyCallback("instagram:stopViewing", function(source, cb, streamUsername)
    local viewerSource = source
    local stream = LiveStreams[streamUsername]
    if not stream then return cb() end

    local wasViewing = false

    -- Remove from viewers list
    for i, viewer in ipairs(stream.viewers) do
        if viewer == viewerSource then
            if CallData[viewerSource] then
                TriggerClientEvent("phone:instagram:endCall", stream.host, CallData[viewerSource])
                CallData[viewerSource] = nil
            end

            table.remove(stream.viewers, i)
            wasViewing = true
            break
        end
    end

    -- Remove voice targets for nearby viewers
    for _, nearbySource in ipairs(stream.nearby) do
        if nearbySource then
            TriggerClientEvent("phone:phone:removeVoiceTarget", nearbySource, viewerSource)
            TriggerClientEvent("phone:instagram:leftProximity", viewerSource, nearbySource, stream.host)
        end
    end

    if wasViewing then
        -- Remove voice target from host
        TriggerClientEvent("phone:phone:removeVoiceTarget", stream.host, viewerSource)

        -- Update viewers count
        TriggerClientEvent("phone:instagram:updateViewers", -1, streamUsername, #stream.viewers)

        -- Remove voice targets from participants
        for _, participant in ipairs(stream.participants) do
            TriggerClientEvent("phone:phone:removeVoiceTarget", participant.source, viewerSource)
        end
    end

    cb()
end)

RegisterNetEvent("phone:instagram:inviteLive")
AddEventHandler("phone:instagram:inviteLive", function(targetUsername)
    local source = source
    local account = GetPlayerInstagramAccount(source)
    if not account then return end

    local stream = LiveStreams[account]
    if not stream or not stream.participants then return end

    -- Check if target already has a live stream
    if LiveStreams[targetUsername] then return end

    -- Check participant limit
    if #stream.participants >= 3 then return end

    -- Check if already a participant
    for _, participant in ipairs(stream.participants) do
        if participant.username == targetUsername then return end
    end

    -- Add to invites if not already invited
    if not stream.invites[targetUsername] then
        stream.invites[targetUsername] = true
    end

    -- Send invite to all active devices for the target account
    local activeAccounts = GetActiveAccounts("Instagram")

    for phoneNumber, username in pairs(activeAccounts) do
        if targetUsername == username then
            local targetSource = GetSourceFromNumber(phoneNumber)
            if targetSource then
                TriggerClientEvent("phone:instagram:invitedLive", targetSource, account)
            end
        end
    end
end)

RegisterNetEvent("phone:instagram:removeLive")
AddEventHandler("phone:instagram:removeLive", function(targetUsername)
    local source = source
    local account = GetPlayerInstagramAccount(source)
    if not account then return end

    local stream = LiveStreams[account]
    if not stream then return end

    local found = false
    local participantSource = nil

    -- Find and remove participant
    for i, participant in ipairs(stream.participants) do
        if participant.username == targetUsername then
            participantSource = participant.source
            found = true
            table.remove(stream.participants, i)
            break
        end
    end

    if found and participantSource then
        RemoveParticipantFromStream(account, targetUsername)

        LiveStreams[targetUsername] = nil
        local participantPlayer = Player(participantSource).state
        participantPlayer.instapicIsLive = nil

        TriggerClientEvent("phone:instagram:updateLives", -1, LiveStreams)
        TriggerClientEvent("phone:instagram:endLive", -1, targetUsername, account)
        TriggerClientEvent("phone:instagram:removedLive", participantSource)
    end

    TriggerClientEvent("phone:instagram:updateLives", -1, LiveStreams)
end)

RegisterLegacyCallback("instagram:joinLive", function(source, cb, hostUsername, streamId)
    local participantSource = source
    local participantAccount = GetPlayerInstagramAccount(participantSource)

    if not participantAccount then return cb(false) end

    local hostStream = LiveStreams[hostUsername]
    if not hostStream or not hostStream.participants then return cb(false) end

    -- Check if already has a live stream
    if LiveStreams[participantAccount] then return cb(false) end

    -- Remove from invites if invited
    if hostStream.invites[participantAccount] then
        hostStream.invites[participantAccount] = nil
    end

    -- Check participant limit
    if #hostStream.participants >= 3 then return cb(false) end

    -- Get participant account data
    local accountData = MySQL.Sync.fetchAll(
        "SELECT profile_image, verified, display_name FROM phone_instagram_accounts WHERE username=@username",
        { ["@username"] = participantAccount }
    )

    if not accountData or not accountData[1] then return cb(false) end

    -- Add as participant
    table.insert(hostStream.participants, {
        username = participantAccount,
        name = accountData[1].display_name,
        avatar = accountData[1].profile_image,
        verified = accountData[1].verified,
        id = streamId,
        source = participantSource
    })

    -- Create participant stream data
    LiveStreams[participantAccount] = {
        id = streamId,
        avatar = accountData[1].profile_image,
        verified = accountData[1].verified,
        name = accountData[1].display_name,
        host = participantSource,
        nearby = {},
        viewers = {},
        participant = hostUsername
    }

    local participantPlayer = Player(participantSource).state
    participantPlayer.instapicIsLive = participantAccount

    TriggerClientEvent("phone:instagram:updateLives", -1, LiveStreams)

    -- Notify followers
    local followers = MySQL.Sync.fetchAll(
        "SELECT follower FROM phone_instagram_follows WHERE followed = @username",
        { ["@username"] = participantAccount }
    )

    for _, follower in ipairs(followers) do
        SendInstagramNotification(follower.follower, {
            title = L("APPS.INSTAGRAM.TITLE"),
            content = L("BACKEND.INSTAGRAM.JOINED_LIVE", {
                invitee = participantAccount,
                inviter = hostUsername
            })
        })
    end

    -- Setup voice targets
    local voiceTargets = table.clone(hostStream.viewers)
    table.insert(voiceTargets, hostStream.host)

    TriggerClientEvent("phone:phone:addVoiceTarget", participantSource, voiceTargets)

    -- Notify viewers
    for _, target in ipairs(voiceTargets) do
        TriggerClientEvent("phone:instagram:joinedLive", target, {
            username = participantAccount,
            name = accountData[1].name,
            avatar = accountData[1].profile_image,
            verified = accountData[1].verified,
            id = streamId,
            host = hostUsername,
            source = participantSource
        })
    end

    cb(true)
end)

RegisterNetEvent("phone:instagram:sendLiveMessage")
AddEventHandler("phone:instagram:sendLiveMessage", function(messageData)
    if messageData and messageData.live and LiveStreams[messageData.live] then
        TriggerClientEvent("phone:instagram:addLiveMessage", -1, messageData)
    end
end)

RegisterNetEvent("phone:instagram:enteredLiveProximity")
AddEventHandler("phone:instagram:enteredLiveProximity", function(streamUsername)
    local source = source
    local isParticipant = LiveStreams[streamUsername] and LiveStreams[streamUsername].participant
    local streamData = isParticipant and LiveStreams[streamUsername] or nil

    local actualStreamUsername = isParticipant and LiveStreams[streamUsername].participant or streamUsername
    local stream = LiveStreams[actualStreamUsername]

    if not stream then return end

    -- Check if already in nearby list
    if table.contains(stream.nearby, source) then return end

    -- Check if is a participant
    for _, participant in ipairs(stream.participants) do
        if participant.source == source then return end
    end

    -- Add to nearby list
    table.insert(stream.nearby, source)

    -- Setup voice targets
    local voiceTargets = table.clone(stream.viewers)
    if isParticipant then
        table.insert(voiceTargets, stream.host)
    end

    debugprint("shouldHear (joined)", json.encode(voiceTargets, { indent = true }))

    TriggerClientEvent("phone:phone:addVoiceTarget", source, voiceTargets)
    TriggerClientEvent("phone:instagram:enteredProximity", -1, source, streamData and streamData.host or stream.host)
end)

RegisterNetEvent("phone:instagram:leftLiveProximity")
AddEventHandler("phone:instagram:leftLiveProximity", function(streamUsername, isParticipant)
    local source = source
    local streamData = isParticipant and LiveStreams[streamUsername] or nil
    local actualStreamUsername = isParticipant and LiveStreams[streamUsername].participant or streamUsername
    local stream = LiveStreams[actualStreamUsername]

    if not stream then return end

    -- Remove from nearby list
    for i, nearbySource in ipairs(stream.nearby) do
        if nearbySource == source then
            stream.nearby[i] = nil
            break
        end
    end

    -- Setup voice targets to remove
    local voiceTargets = table.clone(stream.viewers)
    if isParticipant or isParticipant then
        table.insert(voiceTargets, stream.host)
    end

    debugprint("shouldHear (left)", json.encode(voiceTargets, { indent = true }))

    TriggerClientEvent("phone:phone:removeVoiceTarget", source, voiceTargets)
    TriggerClientEvent("phone:instagram:leftProximity", -1, source, streamData and streamData.host or stream.host)
end)

-- Story Functions
RegisterLegacyCallback("instagram:addToStory", function(source, cb, image, metadata)
    local account = GetPlayerInstagramAccount(source)
    if not account then return cb(false) end

    local storyId = GenerateId("phone_instagram_stories", "id")

    MySQL.Async.execute(
        "INSERT INTO phone_instagram_stories (id, username, image, metadata) VALUES (@id, @username, @image, @metadata)",
        {
            ["@id"] = storyId,
            ["@username"] = account,
            ["@image"] = image,
            ["@metadata"] = metadata and json.encode(metadata) or nil
        },
        function(rowsChanged)
            cb(rowsChanged > 0)
        end
    )

    MySQL.Async.fetchAll(
        "SELECT profile_image, verified FROM phone_instagram_accounts WHERE username=@username",
        { ["@username"] = account },
        function(result)
            if result and result[1] then
                TriggerClientEvent("phone:instagram:addStory", -1, {
                    username = account,
                    avatar = result[1].profile_image,
                    verified = result[1].verified,
                    seen = false
                })

                Log("InstaPic", source, "info", L("BACKEND.LOGS.ADDED_STORY", { username = account }), image)
            end
        end
    )
end)

RegisterLegacyCallback("instagram:removeFromStory", function(source, cb, storyId)
    local account = GetPlayerInstagramAccount(source)
    if not account then return cb(false) end

    MySQL.Async.execute(
        "DELETE FROM phone_instagram_stories WHERE id=@id AND username=@username",
        {
            ["@id"] = storyId,
            ["@username"] = account
        },
        function(rowsChanged)
            cb(rowsChanged > 0)
        end
    )
end)

CreateThread(function()
    while true do
        MySQL.Async.execute(
            "DELETE FROM phone_instagram_stories WHERE `timestamp` < DATE_SUB(NOW(), INTERVAL 24 HOUR)",
            {},
            function() end
        )
        Wait(3600000) -- 1 hour
    end
end)

-- Notification system
local NotificationMessages = {
    like_photo = "BACKEND.INSTAGRAM.LIKED_PHOTO",
    like_comment = "BACKEND.INSTAGRAM.LIKED_COMMENT",
    comment = "BACKEND.INSTAGRAM.COMMENTED",
    follow = "BACKEND.INSTAGRAM.NEW_FOLLOWER"
}

local function SendInstagramNotificationToUser(targetUsername, senderUsername, notificationType, postId)
    if targetUsername == senderUsername then return end

    local messageKey = NotificationMessages[notificationType]
    if not messageKey then return end

    local notificationMessage = L(messageKey, { username = senderUsername })

    if notificationType == "follow" or notificationType == "like_photo" or notificationType == "like_comment" then
        local exists = MySQL.Sync.fetchScalar(
            "SELECT TRUE FROM phone_instagram_notifications WHERE username=@username AND `from`=@from AND `type`=@type" ..
            (notificationType ~= "follow" and " AND post_id=@post_id" or ""),
            {
                ["@username"] = targetUsername,
                ["@from"] = senderUsername,
                ["@type"] = notificationType,
                ["@post_id"] = postId
            }
        )

        if exists then return end
    end

    MySQL.Async.execute(
        "INSERT INTO phone_instagram_notifications (id, username, `from`, `type`, post_id) VALUES (@id, @username, @from, @type, @postId)",
        {
            ["@id"] = GenerateId("phone_instagram_notifications", "id"),
            ["@username"] = targetUsername,
            ["@from"] = senderUsername,
            ["@type"] = notificationType,
            ["@postId"] = postId
        }
    )

    local thumbnail = nil
    if notificationType == "like_photo" or notificationType == "comment" then
        thumbnail = MySQL.Sync.fetchScalar(
            "SELECT TRIM(BOTH '\"' FROM JSON_EXTRACT(media, '$[0]')) FROM phone_instagram_posts WHERE id=@id",
            { ["@id"] = postId }
        )
    end

    local phoneNumbers = GetPhoneNumbersForUsername(targetUsername)

    for _, phoneNumber in ipairs(phoneNumbers) do
        SendNotification(phoneNumber, {
            app = "Instagram",
            title = L("APPS.INSTAGRAM.TITLE"),
            content = notificationMessage,
            thumbnail = thumbnail
        })
    end
end

-- Account Management
RegisterLegacyCallback("instagram:createAccount", function(source, cb, displayName, username, password)
    local phoneNumber = GetEquippedPhoneNumber(source)
    if not phoneNumber then
        return cb({ success = false, error = "UNKNOWN" })
    end

    username = username:lower()

    if not IsUsernameValid(username) then
        return cb({ success = false, error = "USERNAME_NOT_ALLOWED" })
    end

    debugprint("INSTAGRAM", ("%s wants to create an account"):format(phoneNumber))

    local existing = MySQL.Sync.fetchScalar(
        "SELECT username FROM phone_instagram_accounts WHERE username=@username",
        { ["@username"] = username }
    )

    if existing then
        debugprint("INSTAGRAM", ("%s tried to create an account with an existing username"):format(phoneNumber))
        return cb({ success = false, error = "USERNAME_TAKEN" })
    end

    MySQL.Sync.execute(
        "INSERT INTO phone_instagram_accounts (display_name, username, password, phone_number) VALUES (@displayName, @username, @password, @phonenumber)",
        {
            ["@displayName"] = displayName,
            ["@username"] = username,
            ["@password"] = GetPasswordHash(password),
            ["@phonenumber"] = phoneNumber
        }
    )

    debugprint("INSTAGRAM", ("%s created an account"):format(phoneNumber))

    AddLoggedInAccount(phoneNumber, "Instagram", username)
    cb({ success = true })

    -- Auto-follow accounts if configured
    if Config.AutoFollow and Config.AutoFollow.Enabled and Config.AutoFollow.InstaPic and Config.AutoFollow.InstaPic.Enabled then
        for _, accountToFollow in ipairs(Config.AutoFollow.InstaPic.Accounts) do
            MySQL.update.await(
                "INSERT INTO phone_instagram_follows (followed, follower) VALUES (?, ?)",
                { accountToFollow, username }
            )
        end
    end
end)

InstagramCallback("changePassword", function(source, cb, account, currentPassword, newPassword)
    if not Config.ChangePassword or not Config.ChangePassword.InstaPic then
        infoprint("warning",
            ("%s tried to change password on InstaPic, but it's not enabled in the config."):format(source))
        return false
    end

    if newPassword == currentPassword or #newPassword < 3 then
        debugprint("same password / too short")
        return false
    end

    -- Can't change password while live
    if LiveStreams[account] then
        debugprint("Can't change password when live")
        return false
    end

    local storedHash = MySQL.scalar.await(
        "SELECT password FROM phone_instagram_accounts WHERE username = ?",
        { account }
    )

    if not storedHash or not VerifyPasswordHash(currentPassword, storedHash) then
        return false
    end

    local phoneNumber = GetEquippedPhoneNumber(source)
    local success = MySQL.update.await(
        "UPDATE phone_instagram_accounts SET password = ? WHERE username = ?",
        { GetPasswordHash(newPassword), account }
    ) > 0

    if not success then return false end

    -- Notify user
    SendInstagramNotification(account, {
        title = L("BACKEND.MISC.LOGGED_OUT_PASSWORD.TITLE"),
        content = L("BACKEND.MISC.LOGGED_OUT_PASSWORD.DESCRIPTION")
    }, phoneNumber)

    -- Log out from other devices
    MySQL.update.await(
        "DELETE FROM phone_logged_in_accounts WHERE username = ? AND app = 'Instagram' AND phone_number != ?",
        { account, phoneNumber }
    )

    ClearActiveAccountsCache("Instagram", account, phoneNumber)

    Log("InstaPic", source, "info", L("BACKEND.LOGS.CHANGED_PASSWORD.TITLE"),
        L("BACKEND.LOGS.CHANGED_PASSWORD.DESCRIPTION", {
            number = phoneNumber,
            username = account,
            app = "InstaPic"
        })
    )

    TriggerClientEvent("phone:logoutFromApp", -1, {
        username = account,
        app = "instagram",
        reason = "password",
        number = phoneNumber
    })

    return true
end, false)

InstagramCallback("deleteAccount", function(source, cb, account, password)
    if not Config.DeleteAccount or not Config.DeleteAccount.InstaPic then
        infoprint("warning",
            ("%s tried to delete their account on InstaPic, but it's not enabled in the config."):format(source))
        return false
    end

    -- Can't delete account while live
    if LiveStreams[account] then
        debugprint("Can't delete account when live")
        return false
    end

    local storedHash = MySQL.scalar.await(
        "SELECT password FROM phone_instagram_accounts WHERE username = ?",
        { account }
    )

    if not storedHash or not VerifyPasswordHash(password, storedHash) then
        return false
    end

    local phoneNumber = GetEquippedPhoneNumber(source)
    local success = MySQL.update.await(
        "DELETE FROM phone_instagram_accounts WHERE username = ?",
        { account }
    ) > 0

    if not success then return false end

    -- Notify user
    SendInstagramNotification(account, {
        title = L("BACKEND.MISC.DELETED_NOTIFICATION.TITLE"),
        content = L("BACKEND.MISC.DELETED_NOTIFICATION.DESCRIPTION")
    })

    -- Log out from all devices
    MySQL.update.await(
        "DELETE FROM phone_logged_in_accounts WHERE username = ? AND app = 'Instagram'",
        { account }
    )

    ClearActiveAccountsCache("Instagram", account)

    Log("InstaPic", source, "info", L("BACKEND.LOGS.DELETED_ACCOUNT.TITLE"),
        L("BACKEND.LOGS.DELETED_ACCOUNT.DESCRIPTION", {
            number = phoneNumber,
            username = account,
            app = "InstaPic"
        })
    )

    TriggerClientEvent("phone:logoutFromApp", -1, {
        username = account,
        app = "instagram",
        reason = "deleted"
    })

    return true
end, false)

RegisterLegacyCallback("instagram:logIn", function(source, cb, username, password)
    local phoneNumber = GetEquippedPhoneNumber(source)
    if not phoneNumber then
        return cb({ success = false, error = "UNKNOWN" })
    end

    debugprint("INSTAGRAM", ("%s wants to log in on account %s"):format(phoneNumber, username))
    debugprint("INSTAGRAM", ("%s is not logged in, checking if account exists"):format(phoneNumber))

    username = username:lower()

    MySQL.Async.fetchScalar(
        "SELECT password FROM phone_instagram_accounts WHERE username=@username",
        { ["@username"] = username },
        function(storedHash)
            if not storedHash then
                debugprint("INSTAGRAM", ("%s tried to log in on non-existing account %s"):format(phoneNumber, username))
                return cb({ success = false, error = "UNKNOWN_ACCOUNT" })
            end

            if not VerifyPasswordHash(password, storedHash) then
                debugprint("INSTAGRAM",
                    ("%s tried to log in on account %s with wrong password"):format(phoneNumber, username))
                return cb({ success = false, error = "INCORRECT_PASSWORD" })
            end

            debugprint("INSTAGRAM", ("%s logged in on account %s"):format(phoneNumber, username))

            AddLoggedInAccount(phoneNumber, "Instagram", username)

            MySQL.Async.fetchAll(
                [[
                    SELECT
                        display_name AS name, username, profile_image AS avatar, verified
                    FROM phone_instagram_accounts
                    WHERE username = @username
                ]],
                { ["@username"] = username },
                function(result)
                    debugprint("INSTAGRAM", ("%s got account data"):format(phoneNumber))
                    cb({ success = true, account = result and result[1] })
                end
            )
        end
    )
end)

RegisterLegacyCallback("instagram:isLoggedIn", function(source, cb)
    local phoneNumber = GetEquippedPhoneNumber(source)
    if not phoneNumber then return cb(false) end

    local account = GetLoggedInAccount(phoneNumber, "Instagram")
    if not account then return cb(false) end

    local accountData = MySQL.single.await(
        [[
            SELECT display_name AS `name`, username, profile_image AS avatar, verified
            FROM phone_instagram_accounts
            WHERE username = ?
        ]],
        { account }
    )

    cb(accountData or false)
end)

RegisterLegacyCallback("instagram:signOut", function(source, cb)
    local phoneNumber = GetEquippedPhoneNumber(source)
    if not phoneNumber then return cb(false) end

    local account = GetLoggedInAccount(phoneNumber, "Instagram")
    if not account then return cb(false) end

    RemoveLoggedInAccount(phoneNumber, "Instagram", account)
    cb(true)
end)

-- Profile Functions
RegisterLegacyCallback("instagram:getProfile", function(source, cb, username)
    local account = GetPlayerInstagramAccount(source)
    if not account then return cb(false) end

    MySQL.Async.fetchAll(
        [[
            SELECT display_name AS name, username, profile_image AS avatar, bio, verified, private,
                   follower_count as followers, following_count as following, post_count as posts,
                (
                    IF((SELECT TRUE FROM phone_instagram_follows f WHERE f.followed=@username AND f.follower=@loggedInAs), TRUE, FALSE)
                ) AS isFollowing,
                (
                    IF((SELECT TRUE FROM phone_instagram_follow_requests fr WHERE fr.requester=@loggedInAs AND fr.requestee=@username), TRUE, FALSE)
                ) AS requested,
                (SELECT a.story_count > 0) AS hasStory,
                (SELECT a.story_count = (
                    SELECT COUNT(*) FROM phone_instagram_stories_views
                    WHERE viewer=@loggedInAs
                        AND story_id IN (SELECT id FROM phone_instagram_stories WHERE username=@username)
                )) AS seenStory
            FROM phone_instagram_accounts a
            WHERE a.username=@username
        ]],
        {
            ["@username"] = username,
            ["@loggedInAs"] = account
        },
        function(result)
            if result and result[1] then
                result[1].isLive = LiveStreams[username] and true or false
            end
            cb(result and result[1] or false)
        end
    )
end)

-- Post Functions
RegisterLegacyCallback("instagram:createPost", function(source, cb, media, caption, location)
    local account = GetPlayerInstagramAccount(source)
    if not account then return cb(false) end

    if ContainsBlacklistedWord(source, "InstaPic", caption) then
        return cb(false)
    end

    local postId = GenerateId("phone_instagram_posts", "id")

    MySQL.Sync.execute(
        "INSERT INTO phone_instagram_posts (id, username, media, caption, location) VALUES (@id, @username, @media, @caption, @location)",
        {
            ["@id"] = postId,
            ["@username"] = account,
            ["@media"] = media,
            ["@caption"] = caption,
            ["@location"] = location
        }
    )

    cb(true)

    local postData = {
        username = account,
        media = media,
        caption = caption,
        location = location,
        id = postId
    }

    TriggerClientEvent("phone:instagram:newPost", -1, postData)
    TriggerEvent("lb-phone:instapic:newPost", postData)

    -- Logging and webhook
    local mediaData = json.decode(media)
    local logMessage = "**Caption**: " .. (caption or "") .. "\n**Photos**:\n"

    for i, photo in ipairs(mediaData) do
        logMessage = logMessage .. string.format("[Photo %s](%s)\n", i, photo)
    end

    logMessage = logMessage .. "**ID:** " .. postId

    Log("InstaPic", source, "info", "New post", logMessage)
    TrackSocialMediaPost("instapic", mediaData)

    -- Send to webhook if configured
    if Config.Post and Config.Post.InstaPic and INSTAPIC_WEBHOOK then
        local profileImage = MySQL.Sync.fetchScalar(
            "SELECT profile_image FROM phone_instagram_accounts WHERE username=@username",
            { ["@username"] = account }
        )

        PerformHttpRequest(INSTAPIC_WEBHOOK, nil, "POST", json.encode({
            username = Config.Post.Accounts and Config.Post.Accounts.InstaPic and Config.Post.Accounts.InstaPic.Username or
            "InstaPic",
            avatar_url = Config.Post.Accounts and Config.Post.Accounts.InstaPic and Config.Post.Accounts.InstaPic.Avatar or
            "https://loaf-scripts.com/fivem/lb-phone/icons/InstaPic.png",
            embeds = { {
                title = L("APPS.INSTAGRAM.NEW_POST"),
                description = caption and #caption > 0 and caption or nil,
                color = 9059001,
                timestamp = GetTimestampISO(),
                author = {
                    name = "@" .. account,
                    icon_url = profileImage or "https://cdn.discordapp.com/embed/avatars/5.png"
                },
                image = {
                    url = mediaData[1]
                },
                footer = {
                    text = "LB Phone",
                    icon_url = "https://docs.lbscripts.com/images/icons/icon.png"
                }
            } }
        }), { ["Content-Type"] = "application/json" })
    end
end)

RegisterLegacyCallback("instagram:deletePost", function(source, cb, postId)
    local account = GetPlayerInstagramAccount(source)
    if not account then return cb(false) end

    local isAdmin = IsAdmin(source)
    local isOwner = isAdmin or MySQL.Sync.fetchScalar(
        "SELECT TRUE FROM phone_instagram_posts WHERE id=@id AND username=@username",
        {
            ["@id"] = postId,
            ["@username"] = account
        }
    )

    if not isOwner then return cb(false) end

    local params = { ["@id"] = postId }

    MySQL.Sync.execute("DELETE FROM phone_instagram_likes WHERE id=@id", params)
    MySQL.Sync.execute("DELETE FROM phone_instagram_notifications WHERE post_id=@id", params)
    MySQL.Sync.execute("DELETE FROM phone_instagram_comments WHERE post_id=@id", params)
    local success = MySQL.Sync.execute("DELETE FROM phone_instagram_posts WHERE id=@id", params) > 0

    if success then
        Log("InstaPic", source, "error", "Deleted post", "**ID**: " .. postId)
    end

    cb(success)
end)

RegisterLegacyCallback("instagram:getPost", function(source, cb, postId)
    local account = GetPlayerInstagramAccount(source)
    if not account then return cb(false) end

    MySQL.Async.fetchAll(
        [[
            SELECT
                p.id, p.media, p.caption, p.username, p.timestamp, p.like_count, p.comment_count, p.location,
                a.verified, a.profile_image AS avatar,
                (IF((
                    SELECT TRUE FROM phone_instagram_likes l
                    WHERE l.id=p.id AND l.username=@loggedInAs AND l.is_comment=FALSE
                ), TRUE, FALSE)) AS liked
            FROM phone_instagram_posts p
            INNER JOIN phone_instagram_accounts a ON p.username = a.username
            WHERE p.id=@id
        ]],
        {
            ["@id"] = postId,
            ["@loggedInAs"] = account
        },
        function(result)
            cb(result and result[1] or false)
        end
    )
end)

RegisterLegacyCallback("instagram:getPosts", function(source, cb, filters, page)
    local account = GetPlayerInstagramAccount(source)
    if not account then return cb({}) end

    if not filters then filters = {} end

    local whereClause = ""
    local orderBy = "p.timestamp DESC"

    if filters.following then
        whereClause = [[
          JOIN phone_instagram_follows f
          WHERE f.follower=@loggedInAs
              AND f.followed=p.username
      ]]
    elseif filters.profile then
        whereClause = "WHERE p.username=@username"
    else
        whereClause = "WHERE a.private=FALSE"
    end

    local query = string.format([[
      SELECT
          p.id, p.media, p.caption, p.username, p.timestamp, p.like_count, p.comment_count, p.location,
          a.verified, a.profile_image AS avatar,
          (IF((
              SELECT TRUE FROM phone_instagram_likes l
              WHERE l.id=p.id AND l.username=@loggedInAs AND l.is_comment=FALSE
          ), TRUE, FALSE)) AS liked
      FROM phone_instagram_posts p
      INNER JOIN phone_instagram_accounts a ON p.username = a.username
      %s
      ORDER BY %s
      LIMIT @page, @perPage
  ]], whereClause, orderBy)

    MySQL.Async.fetchAll(
        query,
        {
            ["@page"] = (page or 0) * 15,
            ["@perPage"] = 15,
            ["@loggedInAs"] = account,
            ["@username"] = filters.username
        },
        cb
    )
end)

-- Comment Functions
RegisterLegacyCallback("instagram:getComments", function(source, cb, postId, page)
    local account = GetPlayerInstagramAccount(source)
    if not account then return cb({}) end

    MySQL.Async.fetchAll(
        [[
            SELECT
                c.id, c.comment, c.`timestamp`, c.like_count,
                a.username, a.profile_image, a.verified,
                (IF((
                    SELECT TRUE FROM phone_instagram_likes l
                    WHERE l.id=c.id AND l.username=@loggedInAs AND l.is_comment=TRUE
                ), TRUE, FALSE)) AS liked,
                (IF((
                    SELECT TRUE FROM phone_instagram_follows f
                    WHERE f.follower=@loggedInAs AND f.followed=a.username
                ), TRUE, FALSE)) AS following
            FROM phone_instagram_comments c
            INNER JOIN phone_instagram_accounts a ON c.username = a.username
            WHERE c.post_id=@postId
            ORDER BY following DESC, c.like_count DESC, c.`timestamp` DESC
            LIMIT @page, @perPage
        ]],
        {
            ["@page"] = (page or 0) * 20,
            ["@perPage"] = 20,
            ["@postId"] = postId,
            ["@loggedInAs"] = account
        },
        cb
    )
end)

RegisterLegacyCallback("instagram:postComment", function(source, cb, postId, comment)
    local account = GetPlayerInstagramAccount(source)
    if not account then return cb(false) end

    if ContainsBlacklistedWord(source, "InstaPic", comment) then
        return cb(false)
    end

    local commentId = GenerateId("phone_instagram_comments", "id")

    MySQL.Async.execute(
        "INSERT INTO phone_instagram_comments (id, post_id, username, comment) VALUES (@id, @postId, @username, @comment)",
        {
            ["@id"] = commentId,
            ["@postId"] = postId,
            ["@username"] = account,
            ["@comment"] = comment
        },
        function()
            -- Notify post owner
            MySQL.Async.fetchScalar(
                "SELECT username FROM phone_instagram_posts WHERE id=@id",
                { ["@id"] = postId },
                function(postOwner)
                    if postOwner then
                        SendInstagramNotificationToUser(postOwner, account, "comment", commentId)
                    end
                end
            )

            -- Update comment count
            TriggerClientEvent("phone:instagram:updatePostData", -1, postId, "comment_count", true)
            cb(commentId)
        end
    )
end)

-- Profile Update
RegisterLegacyCallback("instagram:updateProfile", function(source, cb, updates)
    local account = GetPlayerInstagramAccount(source)
    if not account then return cb(false) end

    local setClause = ""
    local params = {
        ["@displayName"] = updates.name,
        ["@bio"] = updates.bio,
        ["@avatar"] = updates.avatar,
        ["@username"] = account,
        ["@private"] = updates.private
    }

    if updates.name then setClause = setClause .. "display_name=@displayName," end
    if updates.bio then setClause = setClause .. "bio=@bio," end
    if updates.avatar then setClause = setClause .. "profile_image=@avatar," end
    if type(updates.private) == "boolean" then setClause = setClause .. "private=@private," end

    -- Remove trailing comma
    setClause = setClause:sub(1, -2)

    MySQL.Async.execute(
        "UPDATE phone_instagram_accounts SET " .. setClause .. " WHERE username=@username",
        params,
        function()
            cb(true)
        end
    )
end)

-- Follow System
RegisterLegacyCallback("instagram:toggleFollow", function(source, cb, targetUsername, shouldFollow)
    local account = GetPlayerInstagramAccount(source)
    if not account or targetUsername == account then return cb(not shouldFollow) end

    local function callback(rowsChanged)
        if rowsChanged == 0 then
            return cb(shouldFollow)
        end

        TriggerClientEvent("phone:instagram:updateProfileData", -1, targetUsername, "followers", shouldFollow)
        TriggerClientEvent("phone:instagram:updateProfileData", -1, account, "following", shouldFollow)

        cb(shouldFollow)

        if shouldFollow then
            SendInstagramNotificationToUser(targetUsername, account, "follow")
        end
    end

    local params = {
        ["@username"] = targetUsername,
        ["@loggedInAs"] = account
    }

    -- Check if target is private
    local isPrivate = MySQL.Sync.fetchScalar(
        "SELECT private FROM phone_instagram_accounts WHERE username=@username",
        params
    )

    if isPrivate and shouldFollow then
        -- Handle follow request for private accounts
        MySQL.Async.execute(
            "INSERT IGNORE INTO phone_instagram_follow_requests (requester, requestee) VALUES (@loggedInAs, @username)",
            params,
            function()
                cb(shouldFollow)

                -- Notify target
                local requesterName = MySQL.Sync.fetchScalar(
                    "SELECT display_name FROM phone_instagram_accounts WHERE username=@loggedInAs",
                    params
                )

                local phoneNumbers = GetPhoneNumbersForUsername(targetUsername)

                for _, phoneNumber in ipairs(phoneNumbers) do
                    SendNotification(phoneNumber, {
                        app = "Instagram",
                        title = L("BACKEND.INSTAGRAM.NEW_FOLLOW_REQUEST_TITLE"),
                        content = L("BACKEND.INSTAGRAM.NEW_FOLLOW_REQUEST_DESCRIPTION", {
                            displayName = requesterName,
                            username = account
                        })
                    })
                end
            end
        )
        return
    elseif isPrivate and not shouldFollow then
        -- Remove follow request if unfollowing a private account
        MySQL.Async.execute(
            "DELETE FROM phone_instagram_follow_requests WHERE requester=@loggedInAs AND requestee=@username",
            params
        )
    end

    -- Handle regular follow/unfollow
    local query = "INSERT IGNORE INTO phone_instagram_follows (followed, follower) VALUES (@username, @loggedInAs)"
    if not shouldFollow then
        query = "DELETE FROM phone_instagram_follows WHERE followed=@username AND follower=@loggedInAs"
    end

    MySQL.Async.execute(query, params, callback)
end)

-- Like System
RegisterLegacyCallback("instagram:toggleLike", function(source, cb, postId, shouldLike, isComment)
    if not postId then return cb(false) end

    local account = GetPlayerInstagramAccount(source)
    if not account then return cb(false) end

    local function callback(rowsChanged)
        if rowsChanged == 0 then
            return cb(shouldLike)
        end

        cb(shouldLike)

        if isComment then
            TriggerClientEvent("phone:instagram:updateCommentLikes", -1, postId, shouldLike)
        else
            TriggerClientEvent("phone:instagram:updatePostData", -1, postId, "like_count", shouldLike)
        end

        if shouldLike then
            MySQL.Async.fetchScalar(
                "SELECT username FROM " ..
                (isComment and "phone_instagram_comments" or "phone_instagram_posts") .. " WHERE id=@postId",
                { ["@postId"] = postId },
                function(postOwner)
                    if postOwner then
                        SendInstagramNotificationToUser(
                            postOwner,
                            account,
                            "like_" .. (isComment and "comment" or "photo"),
                            postId
                        )
                    end
                end
            )
        end
    end

    local query =
    "INSERT IGNORE INTO phone_instagram_likes (id, username, is_comment) VALUES (@postId, @loggedInAs, @isComment)"
    if not shouldLike then
        query = "DELETE FROM phone_instagram_likes WHERE id=@postId AND username=@loggedInAs AND is_comment=@isComment"
    end

    MySQL.Async.execute(
        query,
        {
            ["@postId"] = postId,
            ["@loggedInAs"] = account,
            ["@isComment"] = isComment
        },
        callback
    )
end)

-- Data Retrieval
RegisterLegacyCallback("instagram:getData", function(source, cb, dataType, params)
    local account = GetPlayerInstagramAccount(source)
    if not account then return cb({}) end

    local tableName, columnName, whereClause, orderBy

    if dataType == "likes" then
        tableName = "phone_instagram_likes"
        columnName = "username"
        whereClause = "id=@postId AND is_comment=@isComment"
        orderBy = "a.username"
    elseif dataType == "followers" then
        tableName = "phone_instagram_follows"
        columnName = "follower"
        whereClause = "q.followed=@username"
        orderBy = "q.follower"
    elseif dataType == "following" then
        tableName = "phone_instagram_follows"
        columnName = "followed"
        whereClause = "q.follower=@username"
        orderBy = "q.followed"
    else
        return cb({}) -- Retorna vazio se o dataType for inválido
    end

    local query = string.format([[
      SELECT
          a.username,
          a.display_name AS name,
          a.profile_image AS avatar,
          a.verified,
          (IF((
              SELECT TRUE FROM phone_instagram_follows f
              WHERE f.followed = a.username AND f.follower = @loggedInAs
          ), TRUE, FALSE)) AS isFollowing
      FROM phone_instagram_accounts a
      INNER JOIN %s q ON q.%s = a.username
      WHERE %s
      ORDER BY %s DESC
      LIMIT @page, @perPage
  ]], tableName, columnName, whereClause, orderBy)

    MySQL.Async.fetchAll(
        query,
        {
            ["@username"] = params.username or account,
            ["@postId"] = params.postId,
            ["@isComment"] = params.isComment == true,
            ["@loggedInAs"] = account,
            ["@page"] = (params.page or 0) * 20,
            ["@perPage"] = 20
        },
        cb
    )
end)

-- Notification System
RegisterLegacyCallback("instagram:getNotifications", function(source, cb, page)
    local account = GetPlayerInstagramAccount(source)
    if not account then return cb({ notifications = {}, requests = { recent = {}, total = 0 } }) end

    if page > 0 then
        MySQL.Async.fetchAll(
            [[
                SELECT
                    (
                        SELECT CASE WHEN f.followed IS NULL THEN FALSE ELSE TRUE END
                            FROM phone_instagram_follows f
                            WHERE f.follower=@username AND f.followed=n.`from`
                    ) AS isFollowing,
                    n.`from` AS username,
                    n.`type`,
                    n.`timestamp`,
                    TRIM(BOTH '"' FROM JSON_EXTRACT(p.media, '$[0]')) AS photo,
                    p.id AS postId,
                    c.`comment`,
                    c.id AS commentId,
                    a.profile_image AS avatar,
                    a.verified
                FROM phone_instagram_notifications n
                LEFT JOIN phone_instagram_comments c ON n.post_id = c.id
                LEFT JOIN phone_instagram_posts p ON p.id = (CASE
                    WHEN n.`type`="like_photo" THEN n.post_id
                    WHEN n.`type`="comment" THEN c.post_id
                    WHEN n.`type`="like_comment" THEN c.post_id
                    ELSE NULL END)
                LEFT JOIN phone_instagram_accounts a ON a.username=n.`from`
                WHERE n.username=@username
                ORDER BY n.`timestamp` DESC
                LIMIT @page, @perPage
            ]],
            {
                ["@username"] = account,
                ["@page"] = page * 15,
                ["@perPage"] = 15
            },
            function(result)
                cb({ notifications = result })
            end
        )
        return
    end

    -- First page also gets follow requests
    MySQL.Async.fetchAll(
        [[
            SELECT a.username, a.profile_image AS avatar
            FROM phone_instagram_follow_requests r
            INNER JOIN phone_instagram_accounts a ON a.username = r.requester
            WHERE r.requestee=@username
            ORDER BY r.`timestamp` DESC
            LIMIT 2
        ]],
        { ["@username"] = account },
        function(recentRequests)
            local totalRequests = MySQL.Sync.fetchScalar(
                "SELECT COUNT(1) FROM phone_instagram_follow_requests WHERE requestee=@username",
                { ["@username"] = account }
            )

            MySQL.Async.fetchAll(
                [[
                    SELECT
                        (
                            SELECT CASE WHEN f.followed IS NULL THEN FALSE ELSE TRUE END
                                FROM phone_instagram_follows f
                                WHERE f.follower=@username AND f.followed=n.`from`
                        ) AS isFollowing,
                        n.`from` AS username,
                        n.`type`,
                        n.`timestamp`,
                        TRIM(BOTH '"' FROM JSON_EXTRACT(p.media, '$[0]')) AS photo,
                        p.id AS postId,
                        c.`comment`,
                        c.id AS commentId,
                        a.profile_image AS avatar,
                        a.verified
                    FROM phone_instagram_notifications n
                    LEFT JOIN phone_instagram_comments c ON n.post_id = c.id
                    LEFT JOIN phone_instagram_posts p ON p.id = (CASE
                        WHEN n.`type`="like_photo" THEN n.post_id
                        WHEN n.`type`="comment" THEN c.post_id
                        WHEN n.`type`="like_comment" THEN c.post_id
                        ELSE NULL END)
                    LEFT JOIN phone_instagram_accounts a ON a.username=n.`from`
                    WHERE n.username=@username
                    ORDER BY n.`timestamp` DESC
                    LIMIT @page, @perPage
                ]],
                {
                    ["@username"] = account,
                    ["@page"] = 0,
                    ["@perPage"] = 15
                },
                function(notifications)
                    cb({
                        notifications = notifications,
                        requests = {
                            recent = recentRequests,
                            total = totalRequests
                        }
                    })
                end
            )
        end
    )
end)

RegisterLegacyCallback("instagram:getFollowRequests", function(source, cb, page)
    local account = GetPlayerInstagramAccount(source)
    if not account then return cb({}) end

    MySQL.Async.fetchAll(
        [[
            SELECT a.username, a.display_name AS `name`, a.profile_image AS avatar, a.verified
            FROM phone_instagram_follow_requests r
            INNER JOIN phone_instagram_accounts a ON a.username = r.requester
            WHERE r.requestee=@loggedInAs
            ORDER BY r.`timestamp` DESC
            LIMIT @page, @perPage
        ]],
        {
            ["@loggedInAs"] = account,
            ["@page"] = (page or 0) * 15,
            ["@perPage"] = 15
        },
        cb
    )
end)

RegisterLegacyCallback("instagram:handleFollowRequest", function(source, cb, username, shouldAccept)
    local account = GetPlayerInstagramAccount(source)
    if not account then return cb(false) end

    local params = {
        ["@loggedInAs"] = account,
        ["@username"] = username
    }

    local rowsChanged = MySQL.Sync.execute(
        "DELETE FROM phone_instagram_follow_requests WHERE requestee=@loggedInAs AND requester=@username",
        params
    )

    if rowsChanged == 0 then
        return cb(false)
    end

    if not shouldAccept then
        return cb(true)
    end

    MySQL.Sync.execute(
        "INSERT IGNORE INTO phone_instagram_follows (follower, followed) VALUES (@username, @loggedInAs)",
        params
    )

    TriggerClientEvent("phone:instagram:updateProfileData", -1, account, "followers", true)
    TriggerClientEvent("phone:instagram:updateProfileData", -1, username, "following", true)

    -- Notify requester
    local displayName = MySQL.Sync.fetchScalar(
        "SELECT display_name FROM phone_instagram_accounts WHERE username=@loggedInAs",
        params
    )

    local phoneNumbers = GetPhoneNumbersForUsername(username)

    for _, phoneNumber in ipairs(phoneNumbers) do
        SendNotification(phoneNumber, {
            app = "Instagram",
            title = L("BACKEND.INSTAGRAM.FOLLOW_REQUEST_ACCEPTED_TITLE"),
            content = L("BACKEND.INSTAGRAM.FOLLOW_REQUEST_ACCEPTED_DESCRIPTION", {
                displayName = displayName,
                username = account
            })
        })
    end

    cb(true)
end)

-- Search Function
RegisterLegacyCallback("instagram:search", function(source, cb, searchTerm)
    MySQL.Async.fetchAll(
        [[
            SELECT username, display_name AS name, profile_image AS avatar, verified, private
            FROM phone_instagram_accounts
            WHERE
                username LIKE CONCAT(@search, "%")
                OR
                display_name LIKE CONCAT("%", @search, "%")
        ]],
        { ["@search"] = searchTerm },
        cb
    )
end)

-- Messaging System
RegisterLegacyCallback("instagram:getRecentMessages", function(source, cb, page)
    local account = GetPlayerInstagramAccount(source)
    if not account then return cb({}) end

    MySQL.Async.fetchAll(
        [[
            SELECT
                m.content, m.attachments, m.sender, f_m.username, m.`timestamp`,
                a.display_name AS `name`, a.profile_image AS avatar, a.verified
            FROM phone_instagram_messages m
            JOIN ((
                SELECT (
                    CASE WHEN recipient!=@loggedInAs THEN recipient ELSE sender END
                ) AS username, MAX(`timestamp`) AS `timestamp`
                FROM phone_instagram_messages
                WHERE sender=@loggedInAs OR recipient=@loggedInAs
                GROUP BY username
            ) f_m)
            ON m.`timestamp`=f_m.`timestamp`
            INNER JOIN phone_instagram_accounts a ON a.username=f_m.username
            WHERE m.sender=@loggedInAs OR m.recipient=@loggedInAs
            GROUP BY f_m.username
            ORDER BY m.`timestamp` DESC
            LIMIT @page, @perPage
        ]],
        {
            ["@loggedInAs"] = account,
            ["@page"] = (page or 0) * 15,
            ["@perPage"] = 15
        },
        cb
    )
end)

RegisterLegacyCallback("instagram:getMessages", function(source, cb, username, page)
    local account = GetPlayerInstagramAccount(source)
    if not account then return cb({}) end

    MySQL.Async.fetchAll(
        [[
            SELECT sender, recipient, content, attachments, `timestamp`
            FROM phone_instagram_messages
            WHERE (sender=@loggedInAs AND recipient=@username) OR (sender=@username AND recipient=@loggedInAs)
            ORDER BY `timestamp` DESC
            LIMIT @page, @perPage
        ]],
        {
            ["@loggedInAs"] = account,
            ["@username"] = username,
            ["@page"] = (page or 0) * 25,
            ["@perPage"] = 25
        },
        cb
    )
end)

RegisterLegacyCallback("instagram:sendMessage", function(requestData, callback, recipientUsername, messageData)
    -- Obter o nome de usuário do remetente
    local senderUsername = GetPlayerInstagramAccount(requestData)

    -- Validar se o remetente existe
    if not senderUsername then
        callback(false)
        return
    end

    -- Verificar se a mensagem contém palavras bloqueadas
    if ContainsBlacklistedWord(requestData, "InstaPic", messageData) then
        callback(false)
        return
    end

    -- Preparar dados da mensagem
    local messageToInsert = {
        ["@id"] = GenerateId("phone_instagram_messages", "id"),
        ["@sender"] = senderUsername,
        ["@recipient"] = recipientUsername,
        ["@content"] = messageData.content,
        ["@attachments"] = messageData.attachments and json.encode(messageData.attachments) or nil
    }

    -- Inserir a mensagem no banco de dados
    MySQL.Async.execute(
        "INSERT INTO phone_instagram_messages (id, sender, recipient, content, attachments) VALUES (@id, @sender, @recipient, @content, @attachments)",
        messageToInsert,
        function(affectedRows)
            if affectedRows == 0 then
                callback(false)
                return
            end

            callback(true)

            -- Notificar o destinatário se estiver online
            local onlineRecipientAccounts = MySQL.query.await(
                "SELECT phone_number FROM phone_logged_in_accounts WHERE username = ? AND app = 'Instagram' AND `active` = 1",
                { recipientUsername }
            )

            if not onlineRecipientAccounts or #onlineRecipientAccounts == 0 then
                return
            end

            -- Obter informações do perfil do remetente
            MySQL.single(
                "SELECT display_name, username, profile_image FROM phone_instagram_accounts WHERE username = ?",
                { senderUsername },
                function(senderProfile)
                    if not senderProfile then
                        return
                    end

                    -- Processar cada conta de destinatário
                    for _, account in ipairs(onlineRecipientAccounts) do
                        local recipientSource = GetSourceFromNumber(account.phone_number)

                        if recipientSource then
                            -- Enviar evento de cliente para a nova mensagem
                            TriggerClientEvent("phone:instagram:newMessage", recipientSource, {
                                sender = senderUsername,
                                recipient = recipientUsername,
                                content = messageData.content,
                                attachments = messageData.attachments,
                                timestamp = os.time() * 1000
                            })
                        end

                        -- Preparar conteúdo da notificação
                        local notificationContent = messageData.content
                        if string.find(notificationContent, "<!REPLIED_STORY-DATA=", nil, true) then
                            notificationContent = L("APPS.INSTAGRAM.REPLIED_TO_YOUR_STORY")
                        end

                        -- Enviar notificação ao destinatário
                        SendNotification(account.phone_number, {
                            app = "Instagram",
                            title = senderProfile.display_name,
                            content = notificationContent,
                            thumbnail = messageData.attachments and messageData.attachments[1] or nil,
                            avatar = senderProfile.profile_image,
                            showAvatar = true
                        })
                    end
                end
            )
        end
    )
end)

-- Função para obter a lista de stories disponíveis
RegisterLegacyCallback("instagram:getStories", function(source, cb)
    local account = GetPlayerInstagramAccount(source)
    if not account then return cb({}) end

    MySQL.Async.fetchAll([[
      SELECT
          s.username,
          a.verified,
          a.profile_image AS avatar,
          (SELECT
              (SELECT COUNT(*) FROM phone_instagram_stories s2
                  WHERE s2.username = s.username AND NOT EXISTS (
                  SELECT TRUE FROM phone_instagram_stories_views v
                  WHERE v.viewer = @loggedInAs AND v.story_id = s2.id
              )
          ) = 0) AS seen
      FROM phone_instagram_stories s
      INNER JOIN phone_instagram_accounts a ON a.username = s.username
      WHERE a.private = FALSE OR EXISTS (
          SELECT TRUE FROM phone_instagram_follows f
          WHERE f.followed = s.username AND f.follower = @loggedInAs
      )
      GROUP BY s.username
      ORDER BY s.`timestamp` DESC
  ]], {
        ["@loggedInAs"] = account
    }, cb)
end)

-- Função para obter um story específico de um usuário
RegisterLegacyCallback("instagram:getStory", function(source, cb, username)
    local account = GetPlayerInstagramAccount(source)
    if not account then return cb(false) end

    MySQL.Async.fetchAll([[
      SELECT
          s.id,
          s.image,
          s.metadata,
          s.`timestamp`,
          (IF((
              SELECT TRUE FROM phone_instagram_stories_views v
              WHERE v.viewer = @loggedInAs AND v.story_id = s.id
          ), TRUE, FALSE)) AS seen
      FROM phone_instagram_stories s
      WHERE s.username = @username
      ORDER BY s.timestamp ASC
  ]], {
        ["@loggedInAs"] = account,
        ["@username"] = username
    }, function(result)
        if account == username and result and #result > 0 then
            -- Processar metadata e informações adicionais apenas para o próprio usuário
            for _, story in ipairs(result) do
                -- Decodificar metadata se existir
                if story.metadata then
                    story.metadata = json.decode(story.metadata) or nil
                end

                -- Obter contagem de visualizações (excluindo o próprio usuário)
                story.views = MySQL.Sync.fetchScalar(
                    "SELECT COUNT(1) FROM phone_instagram_stories_views WHERE story_id = @id AND viewer != @loggedInAs",
                    { ["@id"] = story.id, ["@loggedInAs"] = account }
                )

                -- Obter últimos 3 visualizadores (excluindo o próprio usuário)
                story.viewers = MySQL.Sync.fetchAll([[
                  SELECT a.profile_image AS avatar, a.verified
                  FROM phone_instagram_stories_views v
                  INNER JOIN phone_instagram_accounts a ON a.username = v.viewer
                  WHERE v.story_id = @id AND v.viewer != @loggedInAs
                  ORDER BY v.`timestamp` DESC
                  LIMIT 3
              ]], {
                    ["@id"] = story.id,
                    ["@loggedInAs"] = account
                })
            end
        end

        cb(result)
    end)
end)

RegisterLegacyCallback("instagram:viewedStory", function(source, cb, storyId)
    local account = GetPlayerInstagramAccount(source)
    if not account then return cb(false) end

    MySQL.Async.execute(
        "INSERT IGNORE INTO phone_instagram_stories_views (story_id, viewer) VALUES (@id, @loggedInAs)",
        {
            ["@id"] = storyId,
            ["@loggedInAs"] = account
        },
        function(rowsChanged)
            cb(rowsChanged > 0)
        end
    )
end)
