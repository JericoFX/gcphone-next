local function processVideoData(videoData)
    if videoData.metadata then
        videoData.metadata = json.decode(videoData.metadata)
    end

    if videoData.music then
        videoData.music = json.decode(videoData.music)
        local songData = Music.Songs[videoData.music.path]

        if songData then
            local albumData = Music.Albums[songData.album]
            if albumData and albumData.Cover then
                songData.Cover = albumData.Cover
            end

            videoData.music = {
                title = songData.Title,
                artist = songData.Artist,
                cover = songData.Cover,
                volume = videoData.music.volume,
                path = videoData.music.path
            }
        end
    end

    videoData.liked = videoData.liked == 1
    videoData.saved = videoData.saved == 1
    videoData.viewed = videoData.viewed == 1

    return videoData
end

RegisterNUICallback("TikTok", function(requestData, callback)
    if not currentPhone then return end

    local action = requestData.action
    debugprint("Trendy:" .. (action or ""))

    local actionHandlers = {
        login = function()
            TriggerCallback("tiktok:login", callback, requestData.data.username, requestData.data.password)
        end,

        signup = function()
            TriggerCallback("tiktok:signup", callback, requestData.data.username, requestData.data.password,
                requestData.data.name)
        end,

        changePassword = function()
            TriggerCallback("tiktok:changePassword", callback, requestData.oldPassword, requestData.newPassword)
        end,

        deleteAccount = function()
            TriggerCallback("tiktok:deleteAccount", callback, requestData.password)
        end,

        logout = function()
            TriggerCallback("tiktok:logout", callback)
        end,

        isLoggedIn = function()
            TriggerCallback("tiktok:isLoggedIn", callback)
        end,

        getProfile = function()
            TriggerCallback("tiktok:getProfile", callback, requestData.username)
        end,

        updateProfile = function()
            TriggerCallback("tiktok:updateProfile", callback, requestData.data)
        end,

        searchAccounts = function()
            TriggerCallback("tiktok:searchAccounts", callback, requestData.query, requestData.page)
        end,

        toggleFollow = function()
            TriggerCallback("tiktok:toggleFollow", callback, requestData.data.username, requestData.data.follow)
        end,

        getFollowing = function()
            TriggerCallback("tiktok:getFollowing", callback, requestData.username, requestData.page)
        end,

        getFollowers = function()
            TriggerCallback("tiktok:getFollowers", callback, requestData.username, requestData.page)
        end,

        uploadVideo = function()
            local videoData = requestData.data
            if not videoData.src or not videoData.caption then
                return callback({ success = false, error = "invalid_caption" })
            end

            if videoData.music and (not videoData.music.path or not videoData.music.volume) then
                return callback({ success = false, error = "invalid_music" })
            end

            if videoData.music then
                videoData.music = json.encode(videoData.music)
            end

            if videoData.metadata then
                if type(videoData.metadata) == "table" and next(videoData.metadata) then
                    videoData.metadata = json.encode(videoData.metadata)
                else
                    videoData.metadata = nil
                end
            end

            TriggerCallback("tiktok:uploadVideo", callback, videoData)
        end,

        deleteVideo = function()
            TriggerCallback("tiktok:deleteVideo", callback, requestData.id)
        end,

        togglePinnedVideo = function()
            TriggerCallback("tiktok:togglePinnedVideo", callback, requestData.id, requestData.toggle)
        end,

        getVideos = function()
            TriggerCallback("tiktok:getVideos", function(videos)
                for i, video in ipairs(videos) do
                    videos[i] = processVideoData(video)
                end
                callback(videos)
            end, requestData.data, requestData.page or 0)
        end,

        getVideo = function()
            TriggerCallback("tiktok:getVideo", function(result)
                if result.video then
                    result.video = processVideoData(result.video)
                end
                callback(result)
            end, requestData.id)
        end,

        setViewed = function()
            TriggerServerEvent("phone:tiktok:setViewed", requestData.id)
            callback("ok")
        end,

        toggleLike = function()
            TriggerCallback("tiktok:toggleVideoAction", callback, "like", requestData.id, requestData.toggle)
        end,

        toggleSave = function()
            TriggerCallback("tiktok:toggleVideoAction", callback, "save", requestData.id, requestData.toggle)
        end,

        postComment = function()
            TriggerCallback("tiktok:postComment", callback, requestData.data.id, requestData.data.replyTo,
                requestData.data.comment)
        end,

        getComments = function()
            TriggerCallback("tiktok:getComments", callback, requestData.data.id, requestData.data.replyTo,
                requestData.data.creator, requestData.page)
        end,

        deleteComment = function()
            TriggerCallback("tiktok:deleteComment", callback, requestData.id, requestData.videoId)
        end,

        setPinnedComment = function()
            TriggerCallback("tiktok:setPinnedComment", callback, requestData.commentId, requestData.videoId)
        end,

        toggleLikeComment = function()
            TriggerCallback("tiktok:toggleLikeComment", callback, requestData.id, requestData.toggle)
        end,

        getRecentMessages = function()
            TriggerCallback("tiktok:getRecentMessages", callback)
        end,

        getMessages = function()
            TriggerCallback("tiktok:getMessages", callback, requestData.id, requestData.page)
        end,

        sendMessage = function()
            if not CanInteract() then
                return callback(false)
            end
            TriggerCallback("tiktok:sendMessage", callback, requestData.data)
        end,

        getChannelId = function()
            TriggerCallback("tiktok:getChannelId", callback, requestData.username)
        end,

        getNotifications = function()
            TriggerCallback("tiktok:getNotifications", callback, requestData.page)
        end,

        getUnreadMessages = function()
            TriggerCallback("tiktok:getUnreadMessages", callback)
        end,

        clearUnreadMessages = function()
            TriggerServerEvent("phone:tiktok:clearUnreadMessages", requestData.id)
        end
    }

    if actionHandlers[action] then
        actionHandlers[action]()
    end
end)

RegisterNetEvent("phone:tiktok:updateFollowers", function(username, method)
    SendReactMessage("tiktok:updateFollowers", { username = username, method = method })
end)

RegisterNetEvent("phone:tiktok:updateFollowing", function(username, method)
    SendReactMessage("tiktok:updateFollowing", { username = username, method = method })
end)

RegisterNetEvent("phone:tiktok:updateVideoStats", function(actionType, videoId, method, count)
    local data = { id = videoId, method = method, count = count }
    local eventMap = {
        like = "tiktok:updateLikes",
        save = "tiktok:updateSaves",
        comment = "tiktok:updateComments"
    }

    if eventMap[actionType] then
        SendReactMessage(eventMap[actionType], data)
    end
end)

RegisterNetEvent("phone:tiktok:updateCommentStats", function(actionType, commentId, method)
    local data = { id = commentId, method = method }
    local eventMap = {
        reply = "tiktok:updateReplies",
        like = "tiktok:updateCommentLikes"
    }

    if eventMap[actionType] then
        SendReactMessage(eventMap[actionType], data)
    end
end)

RegisterNetEvent("phone:tiktok:receivedMessage", function(messageData)
    SendReactMessage("tiktok:receivedMessage", messageData)
end)

RegisterNetEvent("phone:tiktok:newVideo", function(videoData)
    TriggerEvent("lb-phone:trendy:newPost", videoData)
end)
