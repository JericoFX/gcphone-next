local isLiveActive = false
local currentWatchingLive = nil
local watchingSources = {}

local allowedActions = {
    "sendLiveMessage",
    "logIn",
    "toggleFollow",
    "toggleLike",
    "postComment",
    "sendMessage"
}

RegisterNUICallback("Instagram", function(data, cb)
    if not currentPhone then return end

    local action = data.action
    debugprint("InstaPic:" .. (action or ""))

    if table.contains(allowedActions, action) and not CanInteract() then
        return cb(false)
    end

    -- Live streaming functions
    if action == "getLives" then
        TriggerCallback("instagram:getLives", cb)
    elseif action == "getLiveViewers" then
        TriggerCallback("instagram:getLiveViewers", cb, data.username)
    elseif action == "goLive" then
        local canGoLive = AwaitCallback("instagram:canGoLive")
        if not canGoLive then
            debugprint("not allowed to go live")
            return cb(false)
        end
        debugprint("allowed to go live; setting live stream on ui")
        cb(true)
    elseif action == "setLive" then
        debugprint("sending server event to start livestream")
        TriggerServerEvent("phone:instagram:startLive", data.id)
        isLiveActive = true
        EnableWalkableCam()
    elseif action == "endLive" then
        EndLive()
        cb(true)
    elseif action == "viewLive" then
        local liveData = AwaitCallback("instagram:viewLive", data.username)
        if not liveData then return cb(false) end

        local volume = settings and settings.sound and settings.sound.volume or 0.5
        currentWatchingLive = data.username

        -- Add host and participants to watching sources
        watchingSources[#watchingSources + 1] = liveData.host
        for i = 1, #liveData.participants do
            watchingSources[#watchingSources + 1] = liveData.participants[i].source
        end

        debugprint("InstaPic: adding voice targets. Volume:", volume)
        MumbleClearVoiceTargetPlayers(1)

        for i = 1, #watchingSources do
            local sourceId = watchingSources[i]
            MumbleAddVoiceTargetPlayerByServerId(1, sourceId)
            MumbleSetVolumeOverrideByServerId(sourceId, volume)
            debugprint("started listening to", sourceId)
        end

        cb(#liveData.viewers)
    elseif action == "stopViewing" then
        AwaitCallback("instagram:stopViewing", data.username)
        MumbleClearVoiceTargetPlayers(1)

        for i = 1, #watchingSources do
            local sourceId = watchingSources[i]
            MumbleSetVolumeOverrideByServerId(sourceId, -1.0)
            debugprint("stopped listening to", sourceId)
        end

        currentWatchingLive = nil
        watchingSources = {}
    elseif action == "sendLiveMessage" then
        TriggerServerEvent("phone:instagram:sendLiveMessage", data.data)
    elseif action == "addCall" then
        TriggerServerEvent("phone:instagram:addCall", data.id)
    elseif action == "inviteLive" then
        TriggerServerEvent("phone:instagram:inviteLive", data.username)
    elseif action == "removeLive" then
        TriggerServerEvent("phone:instagram:removeLive", data.username)
    elseif action == "joinLive" then
        local success = AwaitCallback("instagram:joinLive", data.username, data.streamId)
        cb(success)
        if not success then return end
        isLiveActive = true
        EnableWalkableCam()
    end

    -- Story functions
    if action == "addToStory" then
        local canCreate = AwaitCallback("instagram:canCreateStory")
        if not canCreate then
            debugprint("not allowed to go create story")
            return cb(false)
        end
        debugprint("allowed to create story")
        TriggerCallback("instagram:addToStory", cb, data.media, data.metadata)
    elseif action == "removeFromStory" then
        TriggerCallback("instagram:removeFromStory", cb, data.id)
    elseif action == "getStories" then
        TriggerCallback("instagram:getStories", cb)
    elseif action == "getStory" then
        TriggerCallback("instagram:getStory", cb, data.username)
    elseif action == "getViewers" then
        TriggerCallback("instagram:getViewers", cb, data.id, data.page or 0)
    elseif action == "viewedStory" then
        TriggerCallback("instagram:viewedStory", cb, data.id)
    end

    -- Account functions
    if action == "flipCamera" then
        ToggleSelfieCam(not IsSelfieCam())
    elseif action == "createAccount" then
        TriggerCallback("instagram:createAccount", cb, data.name, data.username, data.password)
    elseif action == "changePassword" then
        TriggerCallback("instagram:changePassword", cb, data.oldPassword, data.newPassword)
    elseif action == "deleteAccount" then
        TriggerCallback("instagram:deleteAccount", cb, data.password)
    elseif action == "logIn" then
        TriggerCallback("instagram:logIn", cb, data.username, data.password)
    elseif action == "signOut" then
        TriggerCallback("instagram:signOut", cb)
    elseif action == "isLoggedIn" then
        TriggerCallback("instagram:isLoggedIn", cb)
    elseif action == "getProfile" then
        TriggerCallback("instagram:getProfile", cb, data.username)
    end

    -- Post functions
    if action == "newPost" then
        TriggerCallback("instagram:createPost", cb, json.encode(data.data.images), data.data.caption, data.data.location)
    elseif action == "deletePost" then
        TriggerCallback("instagram:deletePost", cb, data.id)
    elseif action == "getPosts" then
        TriggerCallback("instagram:getPosts", cb, data.filters, data.page or 0)
    elseif action == "getPost" then
        TriggerCallback("instagram:getPost", cb, data.id)
    elseif action == "updateProfile" then
        TriggerCallback("instagram:updateProfile", cb, data.data)
    elseif action == "getFollowers" then
        TriggerCallback("instagram:getData", cb, "followers", data.data)
    elseif action == "getFollowing" then
        TriggerCallback("instagram:getData", cb, "following", data.data)
    elseif action == "getLikes" then
        TriggerCallback("instagram:getData", cb, "likes", data.data)
    elseif action == "toggleFollow" then
        TriggerCallback("instagram:toggleFollow", cb, data.data.username, data.data.following)
    elseif action == "toggleLike" then
        TriggerCallback("instagram:toggleLike", cb, data.data.postId, data.data.toggle, data.data.isComment)
    elseif action == "getComments" then
        local comments = AwaitCallback("instagram:getComments", data.postId, data.page or 0)
        local formattedComments = {}

        for i = 1, #comments do
            local comment = comments[i]
            formattedComments[i] = {
                user = {
                    username = comment.username,
                    avatar = comment.profile_image,
                    verified = comment.verified
                },
                comment = {
                    content = comment.comment,
                    timestamp = comment.timestamp,
                    likes = comment.like_count,
                    liked = comment.liked,
                    id = comment.id
                }
            }
        end

        cb(formattedComments)
    elseif action == "postComment" then
        TriggerCallback("instagram:postComment", cb, data.data.postId, data.data.comment)
    elseif action == "getNotifications" then
        TriggerCallback("instagram:getNotifications", cb, data.page or 0)
    elseif action == "getFollowRequests" then
        TriggerCallback("instagram:getFollowRequests", cb, data.page or 0)
    elseif action == "handleFollowRequest" then
        TriggerCallback("instagram:handleFollowRequest", cb, data.username, data.accept)
    end

    -- Messaging functions
    if action == "getRecentMessages" then
        local messages = AwaitCallback("instagram:getRecentMessages", data.page or 0)

        for i = 1, #messages do
            if messages[i].attachments then
                messages[i].attachments = json.decode(messages[i].attachments)
            end
        end

        cb(messages)
    elseif action == "getMessages" then
        local messages = AwaitCallback("instagram:getMessages", data.username, data.page or 0)

        for i = 1, #messages do
            if messages[i].attachments then
                messages[i].attachments = json.decode(messages[i].attachments)
            end
        end

        cb(messages)
    elseif action == "sendMessage" then
        TriggerCallback("instagram:sendMessage", cb, data.username, data.message)
    elseif action == "search" then
        TriggerCallback("instagram:search", cb, data.query)
    end
end)

-- Event handlers
RegisterNetEvent("phone:instagram:addLiveMessage", function(data)
    SendReactMessage("instagram:addMessage", data)
end)

RegisterNetEvent("phone:instagram:updateLives", function(data)
    SendReactMessage("instagram:updateLives", data)
end)

RegisterNetEvent("phone:instagram:endLive", function(username)
    if username == currentWatchingLive then
        MumbleClearVoiceTargetPlayers(1)

        for i = 1, #watchingSources do
            local sourceId = watchingSources[i]
            MumbleSetVolumeOverrideByServerId(sourceId, -1.0)
            debugprint("InstaPic endLive: stopped listening to", sourceId)
        end

        currentWatchingLive = nil
        watchingSources = {}
    end

    SendReactMessage("instagram:liveEnded", username)
end)

RegisterNetEvent("phone:instagram:joinedLive", function(data)
    SendReactMessage("instagram:joinedLive", data)

    if data.source == GetPlayerServerId(PlayerId()) then return end

    watchingSources[#watchingSources + 1] = data.source
    local volume = settings and settings.sound and settings.sound.volume or 0.5

    MumbleAddVoiceTargetPlayerByServerId(1, data.source)
    MumbleSetVolumeOverrideByServerId(data.source, volume)
    debugprint("InstaPic joinedLive: started listening to", data.source, "volume:", volume)
end)

AddEventHandler("lb-phone:settingsUpdated", function()
    if not currentWatchingLive or #watchingSources == 0 then return end

    local volume = settings and settings.sound and settings.sound.volume or 0.5

    for i = 1, #watchingSources do
        local sourceId = watchingSources[i]
        if sourceId ~= GetPlayerServerId(PlayerId()) then
            MumbleSetVolumeOverrideByServerId(sourceId, volume)
            debugprint("InstaPic settingsUpdated: set volume to", volume, "for", sourceId)
        end
    end
end)

RegisterNetEvent("phone:instagram:leftLive", function(host, participant, sourceId)
    SendReactMessage("instagram:leftLive", { host = host, participant = participant })

    if sourceId == GetPlayerServerId(PlayerId()) then return end

    for i = 1, #watchingSources do
        if watchingSources[i] == sourceId then
            MumbleSetVolumeOverrideByServerId(sourceId, -1.0)
            MumbleRemoveVoiceTargetPlayerByServerId(1, sourceId)
            debugprint("InstaPic leftLive: stopped listening to", sourceId)
            table.remove(watchingSources, i)
            break
        end
    end
end)

RegisterNetEvent("phone:instagram:endCall", function(data)
    SendReactMessage("instagram:endCall", data)
end)

RegisterNetEvent("phone:instagram:updateViewers", function(username, viewers)
    SendReactMessage("instagram:updateViewers", { username = username, viewers = viewers })
end)

RegisterNetEvent("phone:instagram:updateProfileData", function(username, data, increment)
    debugprint("updateProfileData", username, data, increment)
    SendReactMessage("instagram:updateProfileData", { username = username, data = data, increment = increment })
end)

RegisterNetEvent("phone:instagram:updatePostData", function(postId, data, increment)
    debugprint("updatePostData", postId, data, increment)
    SendReactMessage("instagram:updatePostData", { postId = postId, data = data, increment = increment })
end)

RegisterNetEvent("phone:instagram:updateCommentLikes", function(commentId, increment)
    debugprint("updateCommentLikes", commentId, increment)
    SendReactMessage("instagram:updateCommentLikes", { commentId = commentId, increment = increment })
end)

RegisterNetEvent("phone:instagram:newMessage", function(data)
    SendReactMessage("instagram:newMessage", data)
end)

RegisterNetEvent("phone:instagram:invitedLive", function(data)
    SendReactMessage("instagram:invitedLive", data)
end)

RegisterNetEvent("phone:instagram:removedLive", function()
    EndLive()
end)

RegisterNetEvent("phone:instagram:newPost", function(data)
    TriggerEvent("lb-phone:instapic:newPost", data)
end)

-- Helper functions
function EndLive()
    if not isLiveActive then return end

    isLiveActive = false
    DisableWalkableCam()
    AwaitCallback("instagram:endLive")
end

function IsLive()
    return isLiveActive
end

function IsWatchingLive()
    return currentWatchingLive
end

exports("IsLive", IsLive)
