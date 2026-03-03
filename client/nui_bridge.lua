local function cbSuccess(success, message, extra)
    local payload = {
        success = success and true or false
    }

    if message ~= nil then
        payload.message = message
    end

    if extra ~= nil then
        for k, v in pairs(extra) do
            payload[k] = v
        end
    end

    return payload
end

RegisterNUICallback('getContacts', function(_, cb)
    lib.callback('gcphone:getContacts', false, function(contacts)
        cb(contacts or {})
    end)
end)

RegisterNUICallback('addContact', function(data, cb)
    lib.callback('gcphone:addContact', false, function(success, value)
        if success then
            cb(cbSuccess(true, nil, { id = value }))
            return
        end

        cb(cbSuccess(false, value))
    end, data)
end)

RegisterNUICallback('updateContact', function(data, cb)
    lib.callback('gcphone:updateContact', false, function(success, message)
        cb(cbSuccess(success, message))
    end, data)
end)

RegisterNUICallback('deleteContact', function(data, cb)
    lib.callback('gcphone:deleteContact', false, function(success)
        cb(cbSuccess(success))
    end, tonumber(data.id))
end)

RegisterNUICallback('toggleFavorite', function(data, cb)
    lib.callback('gcphone:toggleFavorite', false, function(success)
        cb(cbSuccess(success))
    end, tonumber(data.id))
end)

RegisterNUICallback('getMessages', function(_, cb)
    lib.callback('gcphone:getMessages', false, function(messages)
        cb(messages or {})
    end)
end)

RegisterNUICallback('sendMessage', function(data, cb)
    lib.callback('gcphone:sendMessage', false, function(success, message)
        cb(cbSuccess(success, message))
    end, data)
end)

RegisterNUICallback('deleteMessage', function(data, cb)
    lib.callback('gcphone:deleteMessage', false, function(success)
        cb(cbSuccess(success))
    end, tonumber(data.id))
end)

RegisterNUICallback('deleteConversation', function(data, cb)
    lib.callback('gcphone:deleteConversation', false, function(success)
        cb(cbSuccess(success))
    end, data.phoneNumber)
end)

RegisterNUICallback('markAsRead', function(data, cb)
    lib.callback('gcphone:markAsRead', false, function(success)
        cb(cbSuccess(success))
    end, data.phoneNumber)
end)

RegisterNUICallback('setWallpaper', function(data, cb)
    lib.callback('gcphone:setWallpaper', false, function(success)
        cb(success)
    end, data)
end)

RegisterNUICallback('setRingtone', function(data, cb)
    lib.callback('gcphone:setRingtone', false, function(success)
        cb(success)
    end, data)
end)

RegisterNUICallback('setVolume', function(data, cb)
    lib.callback('gcphone:setVolume', false, function(success)
        cb(success)
    end, data)
end)

RegisterNUICallback('setTheme', function(data, cb)
    lib.callback('gcphone:setTheme', false, function(success)
        cb(success)
    end, data)
end)

RegisterNUICallback('setLockCode', function(data, cb)
    lib.callback('gcphone:setLockCode', false, function(success)
        cb(success)
    end, data)
end)

RegisterNUICallback('setCoque', function(data, cb)
    lib.callback('gcphone:setCoque', false, function(success)
        cb(success)
    end, data)
end)

RegisterNUICallback('setAirplaneMode', function(data, cb)
    local enabled = data and data.enabled and true or false
    PhoneState.airplaneMode = enabled
    TriggerServerEvent('gcphone:setAirplaneMode', enabled)
    cb(true)
end)

RegisterNUICallback('getAppLayout', function(_, cb)
    lib.callback('gcphone:getAppLayout', false, function(layout)
        cb(layout)
    end)
end)

RegisterNUICallback('setAppLayout', function(data, cb)
    lib.callback('gcphone:setAppLayout', false, function(success)
        cb(success)
    end, data and data.layout or nil)
end)

RegisterNUICallback('getGallery', function(_, cb)
    lib.callback('gcphone:getGallery', false, function(photos)
        cb(photos or {})
    end)
end)

RegisterNUICallback('getUploadConfig', function(_, cb)
    cb({
        uploadUrl = (Config.Gallery and Config.Gallery.UploadUrl) or '',
        uploadField = (Config.Gallery and Config.Gallery.UploadField) or 'files[]'
    })
end)

RegisterNUICallback('getStorageConfig', function(_, cb)
    lib.callback('gcphone:getStorageConfig', false, function(payload)
        cb(payload or {})
    end)
end)

RegisterNUICallback('storeMediaUrl', function(data, cb)
    lib.callback('gcphone:storeMediaUrl', false, function(success, payload)
        cb(cbSuccess(success, success and nil or payload, success and payload or nil))
    end, data)
end)

RegisterNUICallback('deletePhoto', function(data, cb)
    local photoId = tonumber(data.photoId) or tonumber(data.id)
    lib.callback('gcphone:deletePhoto', false, function(success)
        cb(success)
    end, photoId)
end)

RegisterNUICallback('openGallery', function(_, cb)
    cb(true)
end)

RegisterNUICallback('getBankBalance', function(_, cb)
    lib.callback('gcphone:getBankBalance', false, function(balance)
        cb(balance or 0)
    end)
end)

RegisterNUICallback('getBankTransactions', function(_, cb)
    lib.callback('gcphone:getBankTransactions', false, function(transactions)
        cb(transactions or {})
    end)
end)

RegisterNUICallback('getContactsForTransfer', function(_, cb)
    lib.callback('gcphone:getContactsForTransfer', false, function(contacts)
        cb(contacts or {})
    end)
end)

RegisterNUICallback('transferMoney', function(data, cb)
    lib.callback('gcphone:transferMoney', false, function(success, message)
        cb(cbSuccess(success, message))
    end, data)
end)

RegisterNUICallback('chirpGetAccount', function(_, cb)
    lib.callback('gcphone:chirp:getAccount', false, function(account)
        cb(account)
    end)
end)

RegisterNUICallback('chirpGetTweets', function(data, cb)
    lib.callback('gcphone:chirp:getTweets', false, function(tweets)
        cb(tweets or {})
    end, data or {})
end)

RegisterNUICallback('chirpPublishTweet', function(data, cb)
    lib.callback('gcphone:chirp:publishTweet', false, function(success, tweet)
        cb(cbSuccess(success, nil, { tweet = tweet }))
    end, data)
end)

RegisterNUICallback('chirpToggleLike', function(data, cb)
    lib.callback('gcphone:chirp:toggleLike', false, function(result)
        cb(result or { liked = false })
    end, data)
end)

RegisterNUICallback('snapGetAccount', function(_, cb)
    lib.callback('gcphone:snap:getAccount', false, function(account)
        cb(account)
    end)
end)

RegisterNUICallback('snapGetFeed', function(data, cb)
    lib.callback('gcphone:snap:getFeed', false, function(feed)
        cb(feed or {})
    end, data or {})
end)

RegisterNUICallback('snapPublishPost', function(data, cb)
    lib.callback('gcphone:snap:publishPost', false, function(success, post)
        cb(cbSuccess(success, nil, { post = post }))
    end, data)
end)

RegisterNUICallback('snapToggleLike', function(data, cb)
    lib.callback('gcphone:snap:toggleLike', false, function(success)
        cb(cbSuccess(success))
    end, data)
end)

RegisterNUICallback('marketGetListings', function(data, cb)
    lib.callback('gcphone:market:getListings', false, function(listings)
        cb(listings or {})
    end, data or {})
end)

RegisterNUICallback('marketCreateListing', function(data, cb)
    lib.callback('gcphone:market:createListing', false, function(success, id)
        cb(cbSuccess(success, nil, { id = id }))
    end, data)
end)

RegisterNUICallback('marketGetMyListings', function(_, cb)
    lib.callback('gcphone:market:getMyListings', false, function(listings)
        cb(listings or {})
    end)
end)

RegisterNUICallback('marketMarkAsSold', function(data, cb)
    lib.callback('gcphone:market:markAsSold', false, function(success)
        cb(cbSuccess(success))
    end, tonumber(data.listingId))
end)

RegisterNUICallback('marketDeleteListing', function(data, cb)
    lib.callback('gcphone:market:deleteListing', false, function(success)
        cb(cbSuccess(success))
    end, tonumber(data.listingId))
end)

RegisterNUICallback('marketContactSeller', function(data, cb)
    lib.callback('gcphone:market:contactSeller', false, function(result)
        cb(result)
    end, data)
end)

RegisterNUICallback('newsGetArticles', function(data, cb)
    lib.callback('gcphone:news:getArticles', false, function(articles)
        cb(articles or {})
    end, data or {})
end)

RegisterNUICallback('newsPublishArticle', function(data, cb)
    lib.callback('gcphone:news:publishArticle', false, function(success, article)
        cb(cbSuccess(success, nil, { article = article }))
    end, data)
end)

RegisterNUICallback('newsGetCategories', function(_, cb)
    lib.callback('gcphone:news:getCategories', false, function(categories)
        cb(categories or {})
    end)
end)

RegisterNUICallback('newsDeleteArticle', function(data, cb)
    lib.callback('gcphone:news:deleteArticle', false, function(success)
        cb(cbSuccess(success))
    end, tonumber(data.articleId))
end)

RegisterNUICallback('newsViewArticle', function(data, cb)
    lib.callback('gcphone:news:viewArticle', false, function(success)
        cb(cbSuccess(success))
    end, tonumber(data.articleId))
end)

RegisterNUICallback('newsStartLive', function(data, cb)
    lib.callback('gcphone:news:startLive', false, function(success, payload)
        cb(cbSuccess(success, nil, payload))
    end, data)
end)

RegisterNUICallback('newsEndLive', function(data, cb)
    lib.callback('gcphone:news:endLive', false, function(success)
        cb(cbSuccess(success))
    end, tonumber(data.articleId))
end)

RegisterNUICallback('musicSearchCatalog', function(data, cb)
    lib.callback('gcphone:music:searchCatalog', false, function(results)
        cb(results or {})
    end, data or {})
end)

RegisterNUICallback('musicSearchITunes', function(data, cb)
    lib.callback('gcphone:music:searchITunes', false, function(results)
        cb(results or {})
    end, data or {})
end)

RegisterNUICallback('musicPlay', function(data, cb)
    TriggerEvent('gcphone:music:playFromNUI', data)
    cb(true)
end)

RegisterNUICallback('musicPause', function(_, cb)
    TriggerEvent('gcphone:music:pauseFromNUI')
    cb(true)
end)

RegisterNUICallback('musicResume', function(_, cb)
    TriggerEvent('gcphone:music:resumeFromNUI')
    cb(true)
end)

RegisterNUICallback('musicStop', function(_, cb)
    TriggerEvent('gcphone:music:stopFromNUI')
    cb(true)
end)

RegisterNUICallback('musicSetVolume', function(data, cb)
    TriggerEvent('gcphone:music:setVolumeFromNUI', {
        volume = data and data.volume,
        distance = data and data.distance,
    })
    cb(true)
end)

RegisterNUICallback('wavechatSearchGifs', function(data, cb)
    lib.callback('gcphone:wavechat:searchGifs', false, function(results)
        cb(results or {})
    end, data or {})
end)

RegisterNUICallback('clipsGetFeed', function(data, cb)
    lib.callback('gcphone:clips:getFeed', false, function(posts)
        cb(posts or {})
    end, data or {})
end)

RegisterNUICallback('clipsPublish', function(data, cb)
    lib.callback('gcphone:clips:publish', false, function(success, post)
        cb(cbSuccess(success, nil, { post = post }))
    end, data)
end)

RegisterNUICallback('clipsDeletePost', function(data, cb)
    lib.callback('gcphone:clips:deletePost', false, function(success)
        cb(cbSuccess(success))
    end, tonumber(data.postId))
end)

RegisterNUICallback('clipsToggleLike', function(data, cb)
    lib.callback('gcphone:clips:toggleLike', false, function(success)
        cb(cbSuccess(success))
    end, data)
end)

RegisterNUICallback('garageGetVehicles', function(_, cb)
    lib.callback('gcphone:getGarage', false, function(vehicles)
        cb(vehicles or {})
    end)
end)

RegisterNUICallback('garageRequestVehicle', function(data, cb)
    lib.callback('gcphone:requestVehicle', false, function(success)
        cb(cbSuccess(success))
    end, data)
end)

RegisterNUICallback('garageShareLocation', function(data, cb)
    lib.callback('gcphone:shareVehicleLocation', false, function(success)
        cb(cbSuccess(success))
    end, data)
end)

RegisterNUICallback('snapGetStories', function(_, cb)
    lib.callback('gcphone:snap:getStories', false, function(stories)
        cb(stories or {})
    end)
end)

RegisterNUICallback('snapPublishStory', function(data, cb)
    lib.callback('gcphone:snap:publishStory', false, function(success, story)
        cb(cbSuccess(success, nil, { story = story }))
    end, data)
end)

RegisterNUICallback('snapGetLiveStreams', function(_, cb)
    lib.callback('gcphone:snap:getLiveStreams', false, function(streams)
        cb(streams or {})
    end)
end)

RegisterNUICallback('snapStartLive', function(_, cb)
    lib.callback('gcphone:snap:startLive', false, function(success, payload)
        cb(cbSuccess(success, nil, payload))
    end)
end)

RegisterNUICallback('snapEndLive', function(data, cb)
    lib.callback('gcphone:snap:endLive', false, function(success)
        cb(cbSuccess(success))
    end, tonumber(data.postId))
end)

RegisterNUICallback('snapDeletePost', function(data, cb)
    lib.callback('gcphone:snap:deletePost', false, function(success)
        cb(cbSuccess(success))
    end, tonumber(data.postId))
end)

RegisterNUICallback('snapDeleteStory', function(data, cb)
    lib.callback('gcphone:snap:deleteStory', false, function(success)
        cb(cbSuccess(success))
    end, tonumber(data.storyId))
end)

RegisterNUICallback('chirpDeleteTweet', function(data, cb)
    lib.callback('gcphone:chirp:deleteTweet', false, function(success)
        cb(cbSuccess(success))
    end, tonumber(data.tweetId))
end)

RegisterNUICallback('setGPS', function(data, cb)
    local x = tonumber(data.x)
    local y = tonumber(data.y)

    if x and y then
        SetNewWaypoint(x, y)
        cb(true)
        return
    end

    cb(false)
end)

RegisterNUICallback('livekitGetToken', function(data, cb)
    lib.callback('gcphone:livekit:getToken', false, function(payload)
        cb(payload or { success = false, error = 'TOKEN_ERROR' })
    end, data)
end)

RegisterNUICallback('socketGetToken', function(_, cb)
    lib.callback('gcphone:socket:getToken', false, function(payload)
        cb(payload or { success = false, error = 'TOKEN_ERROR' })
    end)
end)

RegisterNetEvent('gcphone:contactsUpdated', function(contacts)
    SendNUIMessage({
        action = 'contactsUpdated',
        data = contacts or {}
    })
end)

RegisterNetEvent('gcphone:messageSent', function(message)
    SendNUIMessage({
        action = 'messageSent',
        data = message
    })
end)

RegisterNetEvent('gcphone:messageReceived', function(message)
    SendNUIMessage({
        action = 'messageReceived',
        data = message
    })
end)

RegisterNetEvent('gcphone:wallpaperUpdated', function(url)
    SendNUIMessage({
        action = 'phone:show',
        data = {
            wallpaper = url
        }
    })
end)

RegisterNetEvent('gcphone:bankTransferReceived', function(payload)
    SendNUIMessage({
        action = 'bankTransferReceived',
        data = payload
    })
end)

RegisterNUICallback('wavechatGetGroups', function(_, cb)
    lib.callback('gcphone:wavechatGetGroups', false, function(groups)
        cb(groups or {})
    end)
end)

RegisterNUICallback('wavechatCreateGroup', function(data, cb)
    lib.callback('gcphone:wavechatCreateGroup', false, function(success, value)
        cb(cbSuccess(success, success and nil or value, success and { groupId = value } or nil))
    end, data)
end)

RegisterNUICallback('wavechatGetGroupMessages', function(data, cb)
    lib.callback('gcphone:wavechatGetGroupMessages', false, function(messages)
        cb(messages or {})
    end, data)
end)

RegisterNUICallback('wavechatSendGroupMessage', function(data, cb)
    lib.callback('gcphone:wavechatSendGroupMessage', false, function(success, payload)
        cb(cbSuccess(success, success and nil or payload, success and { message = payload } or nil))
    end, data)
end)

RegisterNUICallback('darkroomsGetRooms', function(_, cb)
    lib.callback('gcphone:darkrooms:getRooms', false, function(rooms)
        cb(rooms or {})
    end)
end)

RegisterNUICallback('darkroomsCreateRoom', function(data, cb)
    lib.callback('gcphone:darkrooms:createRoom', false, function(payload)
        cb(payload or { success = false })
    end, data or {})
end)

RegisterNUICallback('darkroomsJoinRoom', function(data, cb)
    lib.callback('gcphone:darkrooms:joinRoom', false, function(payload)
        cb(payload or { success = false })
    end, data)
end)

RegisterNUICallback('darkroomsGetPosts', function(data, cb)
    lib.callback('gcphone:darkrooms:getPosts', false, function(posts)
        cb(posts or {})
    end, data or {})
end)

RegisterNUICallback('darkroomsCreatePost', function(data, cb)
    lib.callback('gcphone:darkrooms:createPost', false, function(payload)
        cb(payload or { success = false })
    end, data or {})
end)

RegisterNUICallback('darkroomsVotePost', function(data, cb)
    lib.callback('gcphone:darkrooms:votePost', false, function(payload)
        cb(payload or { success = false })
    end, data or {})
end)

RegisterNUICallback('darkroomsGetComments', function(data, cb)
    lib.callback('gcphone:darkrooms:getComments', false, function(comments)
        cb(comments or {})
    end, data or {})
end)

RegisterNUICallback('darkroomsCreateComment', function(data, cb)
    lib.callback('gcphone:darkrooms:createComment', false, function(payload)
        cb(payload or { success = false })
    end, data or {})
end)

RegisterNetEvent('gcphone:wavechatGroupMessage', function(payload)
    SendNUIMessage({
        action = 'wavechatGroupMessage',
        data = payload
    })
end)
