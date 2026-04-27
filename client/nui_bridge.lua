local PhoneState = require 'client.state'
local Nui = require 'client.nui_helpers'
local cbSuccess = Nui.cbSuccess

RegisterNUICallback('setAirplaneMode', function(data, cb)
    local enabled = data and data.enabled and true or false
    PhoneState.airplaneMode = enabled
    TriggerServerEvent('gcphone:setAirplaneMode', enabled)
    cb(true)
end)

RegisterNUICallback('getWidgetLayout', function(_, cb)
    lib.callback('gcphone:getWidgetLayout', false, function(layout)
        cb(layout)
    end)
end)

RegisterNUICallback('setWidgetLayout', function(data, cb)
    lib.callback('gcphone:setWidgetLayout', false, function(success)
        cb(cbSuccess(success))
    end, data and data.layout or nil)
end)

RegisterNUICallback('getAppLayout', function(_, cb)
    lib.callback('gcphone:getAppLayout', false, function(layout)
        cb(layout)
    end)
end)

RegisterNUICallback('setAppLayout', function(data, cb)
    lib.callback('gcphone:setAppLayout', false, function(success)
        cb(cbSuccess(success))
    end, data and data.layout or nil)
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
        cb(cbSuccess(success))
    end, photoId)
end)

RegisterNUICallback('documentsGetList', function(_, cb)
    lib.callback('gcphone:documents:getList', false, function(payload)
        cb(payload or {})
    end)
end)

RegisterNUICallback('documentsCreate', function(data, cb)
    lib.callback('gcphone:documents:create', false, function(payload)
        cb(payload or { success = false })
    end, data)
end)

RegisterNUICallback('documentsDelete', function(data, cb)
    lib.callback('gcphone:documents:delete', false, function(payload)
        cb(payload or { success = false })
    end, data)
end)

RegisterNUICallback('documentsToggleNFC', function(data, cb)
    lib.callback('gcphone:documents:toggleNFC', false, function(payload)
        cb(payload or { success = false })
    end, data)
end)

RegisterNUICallback('documentsScanNFC', function(data, cb)
    lib.callback('gcphone:documents:scanNFC', false, function(payload)
        cb(payload or { success = false })
    end, data)
end)

RegisterNUICallback('documentsVerify', function(data, cb)
    lib.callback('gcphone:documents:verify', false, function(payload)
        cb(payload or { success = false })
    end, data)
end)

RegisterNUICallback('documentsGetScanHistory', function(_, cb)
    lib.callback('gcphone:documents:getScanHistory', false, function(payload)
        cb(payload or {})
    end)
end)

RegisterNUICallback('documentsGetTypes', function(_, cb)
    lib.callback('gcphone:documents:getTypes', false, function(payload)
        cb(payload or {})
    end)
end)

RegisterNUICallback('chirpGetAccount', function(_, cb)
    lib.callback('gcphone:chirp:getAccount', false, function(account)
        cb(account)
    end)
end)

RegisterNUICallback('chirpCreateAccount', function(data, cb)
    lib.callback('gcphone:chirp:createAccount', false, function(success, payload)
        if success then
            cb(cbSuccess(true, nil, { account = payload }))
            return
        end

        local errorMessage = type(payload) == 'string' and payload or 'No se pudo crear la cuenta'
        cb(cbSuccess(false, errorMessage))
    end, data or {})
end)

RegisterNUICallback('chirpUpdateAccount', function(data, cb)
    lib.callback('gcphone:chirp:updateAccount', false, function(success)
        cb(cbSuccess(success))
    end, data or {})
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

RegisterNUICallback('chirpToggleRechirp', function(data, cb)
    lib.callback('gcphone:chirp:toggleRechirp', false, function(result)
        cb(result or { rechirped = false })
    end, data or {})
end)

RegisterNUICallback('chirpFollow', function(data, cb)
    lib.callback('gcphone:chirp:follow', false, function(result)
        cb(result or { following = false, requested = false })
    end, data or {})
end)

RegisterNUICallback('chirpGetProfile', function(data, cb)
    lib.callback('gcphone:chirp:getProfile', false, function(profile)
        cb(profile)
    end, data or {})
end)

RegisterNUICallback('chirpGetPendingFollowRequests', function(_, cb)
    lib.callback('gcphone:chirp:getPendingFollowRequests', false, function(items)
        cb(items or {})
    end)
end)

RegisterNUICallback('chirpGetSentFollowRequests', function(_, cb)
    lib.callback('gcphone:chirp:getSentFollowRequests', false, function(items)
        cb(items or {})
    end)
end)

RegisterNUICallback('chirpRespondFollowRequest', function(data, cb)
    lib.callback('gcphone:chirp:respondFollowRequest', false, function(success)
        cb(cbSuccess(success))
    end, data or {})
end)

RegisterNUICallback('chirpCancelFollowRequest', function(data, cb)
    lib.callback('gcphone:chirp:cancelFollowRequest', false, function(success)
        cb(cbSuccess(success))
    end, data or {})
end)

RegisterNUICallback('chirpGetComments', function(data, cb)
    lib.callback('gcphone:chirp:getComments', false, function(comments)
        cb(comments or {})
    end, data or {})
end)

RegisterNUICallback('chirpAddComment', function(data, cb)
    lib.callback('gcphone:chirp:addComment', false, function(success, comment)
        cb(cbSuccess(success, success and nil or comment, success and { comment = comment } or nil))
    end, data or {})
end)

RegisterNUICallback('snapGetAccount', function(_, cb)
    lib.callback('gcphone:snap:getAccount', false, function(account)
        cb(account)
    end)
end)

RegisterNUICallback('clipsGetAccount', function(_, cb)
    lib.callback('gcphone:clips:getAccount', false, function(account)
        cb(account)
    end)
end)

RegisterNUICallback('newsGetAccount', function(_, cb)
    lib.callback('gcphone:news:getAccount', false, function(account)
        cb(account)
    end)
end)

RegisterNUICallback('snapCreateAccount', function(data, cb)
    lib.callback('gcphone:snap:createAccount', false, function(success, payload)
        if success then
            cb(cbSuccess(true, nil, { account = payload }))
            return
        end

        local errorMessage = type(payload) == 'string' and payload or 'No se pudo crear la cuenta'
        cb(cbSuccess(false, errorMessage))
    end, data or {})
end)

RegisterNUICallback('clipsCreateAccount', function(data, cb)
    lib.callback('gcphone:clips:createAccount', false, function(success, payload)
        if success then
            cb(cbSuccess(true, nil, { account = payload }))
            return
        end

        local errorMessage = type(payload) == 'string' and payload or 'No se pudo crear la cuenta'
        cb(cbSuccess(false, errorMessage))
    end, data or {})
end)

RegisterNUICallback('newsCreateAccount', function(data, cb)
    lib.callback('gcphone:news:createAccount', false, function(success, payload)
        if success then
            cb(cbSuccess(true, nil, { account = payload }))
            return
        end

        local errorMessage = type(payload) == 'string' and payload or 'No se pudo crear la cuenta'
        cb(cbSuccess(false, errorMessage))
    end, data or {})
end)

RegisterNUICallback('snapGetDiscoverAccounts', function(data, cb)
    lib.callback('gcphone:snap:getDiscoverAccounts', false, function(accounts)
        cb(accounts or {})
    end, data or {})
end)

RegisterNUICallback('snapGetDiscoverFeed', function(data, cb)
    lib.callback('gcphone:snap:getDiscoverFeed', false, function(rows)
        cb(rows or {})
    end, data or {})
end)

RegisterNUICallback('snapUpdateAccount', function(data, cb)
    lib.callback('gcphone:snap:updateAccount', false, function(success)
        cb(cbSuccess(success))
    end, data or {})
end)

RegisterNUICallback('clipsUpdateAccount', function(data, cb)
    lib.callback('gcphone:clips:updateAccount', false, function(success)
        cb(cbSuccess(success))
    end, data or {})
end)

RegisterNUICallback('newsUpdateAccount', function(data, cb)
    lib.callback('gcphone:news:updateAccount', false, function(success)
        cb(cbSuccess(success))
    end, data or {})
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

RegisterNUICallback('snapFollow', function(data, cb)
    lib.callback('gcphone:snap:follow', false, function(result)
        cb(result or { following = false, requested = false })
    end, data or {})
end)

RegisterNUICallback('snapGetProfile', function(data, cb)
    lib.callback('gcphone:snap:getProfile', false, function(profile)
        cb(profile)
    end, data or {})
end)

RegisterNUICallback('snapGetPendingFollowRequests', function(_, cb)
    lib.callback('gcphone:snap:getPendingFollowRequests', false, function(items)
        cb(items or {})
    end)
end)

RegisterNUICallback('snapGetSentFollowRequests', function(_, cb)
    lib.callback('gcphone:snap:getSentFollowRequests', false, function(items)
        cb(items or {})
    end)
end)

RegisterNUICallback('snapRespondFollowRequest', function(data, cb)
    lib.callback('gcphone:snap:respondFollowRequest', false, function(success)
        cb(cbSuccess(success))
    end, data or {})
end)

RegisterNUICallback('snapCancelFollowRequest', function(data, cb)
    lib.callback('gcphone:snap:cancelFollowRequest', false, function(success)
        cb(cbSuccess(success))
    end, data or {})
end)

RegisterNUICallback('socialGetNotifications', function(data, cb)
    lib.callback('gcphone:social:getNotifications', false, function(items)
        cb(items or {})
    end, data or {})
end)

RegisterNUICallback('getPostPreview', function(data, cb)
    lib.callback('gcphone:social:getPostPreview', false, function(preview)
        cb(preview)
    end, data)
end)

RegisterNUICallback('socialMarkNotificationRead', function(data, cb)
    lib.callback('gcphone:social:markNotificationRead', false, function(success)
        cb(cbSuccess(success))
    end, data or {})
end)

RegisterNUICallback('socialMarkAllNotificationsRead', function(data, cb)
    lib.callback('gcphone:social:markAllNotificationsRead', false, function(success)
        cb(cbSuccess(success))
    end, data or {})
end)

RegisterNUICallback('socialDeleteNotification', function(data, cb)
    lib.callback('gcphone:social:deleteNotification', false, function(success)
        cb(cbSuccess(success))
    end, data or {})
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

RegisterNUICallback('newsGetLiveNews', function(_, cb)
    lib.callback('gcphone:news:getLiveNews', false, function(articles)
        cb(articles or {})
    end)
end)

RegisterNUICallback('newsDeleteArticle', function(data, cb)
    local articleId = tonumber(type(data) == 'table' and data.articleId or data)
    if not articleId then
        cb(cbSuccess(false, 'INVALID_PAYLOAD'))
        return
    end
    lib.callback('gcphone:news:deleteArticle', false, function(success)
        cb(cbSuccess(success))
    end, articleId)
end)

RegisterNUICallback('newsViewArticle', function(data, cb)
    local articleId = tonumber(type(data) == 'table' and data.articleId or data)
    if not articleId then
        cb(cbSuccess(false, 'INVALID_PAYLOAD'))
        return
    end
    lib.callback('gcphone:news:viewArticle', false, function(success)
        cb(cbSuccess(success))
    end, articleId)
end)

RegisterNUICallback('newsStartLive', function(data, cb)
    lib.callback('gcphone:news:startLive', false, function(success, payload)
        cb(cbSuccess(success, nil, payload))
    end, data)
end)

RegisterNUICallback('newsEndLive', function(data, cb)
    local articleId = tonumber(type(data) == 'table' and data.articleId or data)
    if not articleId then
        cb(cbSuccess(false, 'INVALID_PAYLOAD'))
        return
    end
    lib.callback('gcphone:news:endLive', false, function(success)
        cb(cbSuccess(success))
    end, articleId)
end)

RegisterNUICallback('newsGetScaleform', function(data, cb)
    local articleId = tonumber(type(data) == 'table' and data.articleId or data)
    lib.callback('gcphone:news:getScaleform', false, function(scaleform)
        cb(scaleform)
    end, articleId)
end)

RegisterNUICallback('newsJoinLive', function(data, cb)
    lib.callback('gcphone:news:joinLive', false, function(success, payload)
        cb(cbSuccess(success, nil, payload))
    end, data or {})
end)

RegisterNUICallback('newsLeaveLive', function(data, cb)
    lib.callback('gcphone:news:leaveLive', false, function(success)
        cb(cbSuccess(success))
    end, data or {})
end)

RegisterNUICallback('newsSendLiveMessage', function(data, cb)
    lib.callback('gcphone:news:sendLiveMessage', false, function(success, payload)
        cb(cbSuccess(success, nil, payload))
    end, data or {})
end)

RegisterNUICallback('newsSendLiveReaction', function(data, cb)
    lib.callback('gcphone:news:sendLiveReaction', false, function(success, payload)
        cb(cbSuccess(success, nil, payload))
    end, data or {})
end)

RegisterNUICallback('newsRemoveLiveMessage', function(data, cb)
    lib.callback('gcphone:news:removeLiveMessage', false, function(success, payload)
        cb(cbSuccess(success, nil, payload))
    end, data or {})
end)

RegisterNUICallback('newsMuteLiveUser', function(data, cb)
    lib.callback('gcphone:news:muteLiveUser', false, function(success, payload)
        cb(cbSuccess(success, nil, payload))
    end, data or {})
end)

RegisterNUICallback('snapJoinLive', function(data, cb)
    lib.callback('gcphone:snap:joinLive', false, function(success, payload)
        cb(cbSuccess(success, nil, payload))
    end, data or {})
end)

RegisterNUICallback('snapLeaveLive', function(data, cb)
    lib.callback('gcphone:snap:leaveLive', false, function(success)
        cb(cbSuccess(success))
    end, data or {})
end)

RegisterNUICallback('snapSendLiveMessage', function(data, cb)
    lib.callback('gcphone:snap:sendLiveMessage', false, function(success, payload)
        cb(cbSuccess(success, nil, payload))
    end, data or {})
end)

RegisterNUICallback('snapSendLiveReaction', function(data, cb)
    lib.callback('gcphone:snap:sendLiveReaction', false, function(success, payload)
        cb(cbSuccess(success, nil, payload))
    end, data or {})
end)

RegisterNUICallback('snapRemoveLiveMessage', function(data, cb)
    lib.callback('gcphone:snap:removeLiveMessage', false, function(success, payload)
        cb(cbSuccess(success, nil, payload))
    end, data or {})
end)

RegisterNUICallback('snapMuteLiveUser', function(data, cb)
    lib.callback('gcphone:snap:muteLiveUser', false, function(success, payload)
        cb(cbSuccess(success, nil, payload))
    end, data or {})
end)

RegisterNUICallback('newsSetScaleform', function(data, cb)
    lib.callback('gcphone:news:setScaleform', false, function(success)
        cb(cbSuccess(success))
    end, data or {})
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

RegisterNUICallback('musicCanSearchCatalog', function(_, cb)
    lib.callback('gcphone:music:canSearchCatalog', false, function(payload)
        cb(payload or { enabled = false })
    end)
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

RegisterNUICallback('clipsGetMyClips', function(data, cb)
    lib.callback('gcphone:clips:getMyClips', false, function(posts)
        cb(posts or {})
    end, data or {})
end)

RegisterNUICallback('clipsPublish', function(data, cb)
    lib.callback('gcphone:clips:publish', false, function(success, post)
        cb(cbSuccess(success, nil, { post = post }))
    end, data)
end)

RegisterNUICallback('clipsDeletePost', function(data, cb)
    local postId = tonumber(type(data) == 'table' and data.postId or data)
    lib.callback('gcphone:clips:deletePost', false, function(success)
        cb(cbSuccess(success))
    end, postId)
end)

RegisterNUICallback('clipsToggleLike', function(data, cb)
    lib.callback('gcphone:clips:toggleLike', false, function(payload)
        if type(payload) == 'table' then
            cb(cbSuccess(true, nil, payload))
            return
        end

        cb(cbSuccess(payload == true))
    end, data)
end)

RegisterNUICallback('clipsGetComments', function(data, cb)
    lib.callback('gcphone:clips:getComments', false, function(comments)
        cb(comments or {})
    end, data or {})
end)

RegisterNUICallback('clipsAddComment', function(data, cb)
    lib.callback('gcphone:clips:addComment', false, function(success, comment)
        cb(cbSuccess(success, success and nil or comment, success and { comment = comment } or nil))
    end, data or {})
end)

RegisterNUICallback('clipsDeleteComment', function(data, cb)
    lib.callback('gcphone:clips:deleteComment', false, function(success)
        cb(cbSuccess(success))
    end, data or {})
end)

RegisterNUICallback('garageGetVehicles', function(_, cb)
    lib.callback('gcphone:garage:getVehicles', false, function(vehicles)
        cb(vehicles or {})
    end)
end)

RegisterNUICallback('garageGetLocationHistory', function(data, cb)
    local plate = type(data) == 'table' and data.plate or data
    lib.callback('gcphone:garage:getLocationHistory', false, function(history)
        cb(history or {})
    end, plate)
end)

RegisterNUICallback('garageRequestVehicle', function(data, cb)
    local plate = type(data) == 'table' and data.plate or data
    lib.callback('gcphone:garage:requestVehicle', false, function(success)
        cb(cbSuccess(success))
    end, plate)
end)

RegisterNUICallback('garageShareLocation', function(data, cb)
    lib.callback('gcphone:garage:shareLocation', false, function(success)
        cb(cbSuccess(success))
    end, data or {})
end)

RegisterNUICallback('garageGetImpoundLocation', function(_, cb)
    lib.callback('gcphone:garage:getImpoundLocation', false, function(result)
        cb(result or {})
    end)
end)

RegisterNUICallback('garageSetGps', function(data, cb)
    local x = type(data) == 'table' and tonumber(data.x) or nil
    local y = type(data) == 'table' and tonumber(data.y) or nil
    if x and y then
        SetNewWaypoint(x, y)
        cb(cbSuccess(true))
    else
        cb(cbSuccess(false))
    end
end)

RegisterNUICallback('garagePayBail', function(data, cb)
    lib.callback('gcphone:garage:payBail', false, function(payload)
        cb(payload or { success = false })
    end, data)
end)

RegisterNUICallback('garageRequestValet', function(data, cb)
    lib.callback('gcphone:garage:requestValet', false, function(payload)
        cb(payload or { success = false })
    end, data)
end)

RegisterNUICallback('garageSetWaypoint', function(data, cb)
    lib.callback('gcphone:garage:setWaypoint', false, function(payload)
        cb(payload or { success = false })
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
        cb({ success = success and true or false, payload = type(payload) == 'table' and payload or nil })
    end)
end)

RegisterNUICallback('snapEndLive', function(data, cb)
    local postId = tonumber(type(data) == 'table' and data.postId or data)
    lib.callback('gcphone:snap:endLive', false, function(success)
        cb(cbSuccess(success))
    end, postId)
end)

RegisterNUICallback('snapDeletePost', function(data, cb)
    local postId = tonumber(type(data) == 'table' and data.postId or data)
    lib.callback('gcphone:snap:deletePost', false, function(success)
        cb(cbSuccess(success))
    end, postId)
end)

RegisterNUICallback('snapDeleteStory', function(data, cb)
    local storyId = tonumber(type(data) == 'table' and data.storyId or data)
    lib.callback('gcphone:snap:deleteStory', false, function(success)
        cb(cbSuccess(success))
    end, storyId)
end)

RegisterNUICallback('chirpDeleteTweet', function(data, cb)
    local tweetId = tonumber(type(data) == 'table' and data.tweetId or data)
    lib.callback('gcphone:chirp:deleteTweet', false, function(success)
        cb(cbSuccess(success))
    end, tweetId)
end)

RegisterNUICallback('chirpDeleteComment', function(data, cb)
    lib.callback('gcphone:chirp:deleteComment', false, function(success)
        cb(cbSuccess(success))
    end, data)
end)

RegisterNUICallback('yellowpagesGetCategories', function(_, cb)
    lib.callback('gcphone:yellowpages:getCategories', false, function(payload)
        cb(payload or {})
    end)
end)

RegisterNUICallback('yellowpagesGetListings', function(data, cb)
    lib.callback('gcphone:yellowpages:getListings', false, function(payload)
        cb(payload or {})
    end, data or {})
end)

RegisterNUICallback('yellowpagesGetMyListings', function(data, cb)
    lib.callback('gcphone:yellowpages:getMyListings', false, function(payload)
        cb(payload or {})
    end, data or {})
end)

RegisterNUICallback('yellowpagesGetSellerInfo', function(data, cb)
    local listingId = tonumber(type(data) == 'table' and data.listingId or data)
    lib.callback('gcphone:yellowpages:getSellerInfo', false, function(payload)
        cb(payload)
    end, listingId)
end)

RegisterNUICallback('yellowpagesCreateListing', function(data, cb)
    lib.callback('gcphone:yellowpages:createListing', false, function(success, listing)
        cb(cbSuccess(success, success and nil or listing, success and { listing = listing } or nil))
    end, data or {})
end)

RegisterNUICallback('yellowpagesDeleteListing', function(data, cb)
    local listingId = tonumber(type(data) == 'table' and data.listingId or data)
    lib.callback('gcphone:yellowpages:deleteListing', false, function(success)
        cb(cbSuccess(success))
    end, listingId)
end)

RegisterNUICallback('yellowpagesRecordContact', function(data, cb)
    lib.callback('gcphone:yellowpages:recordContact', false, function(success)
        cb(cbSuccess(success))
    end, data or {})
end)

-- MatchMyLove
RegisterNUICallback('matchmyloveGetProfile', function(_, cb)
    lib.callback('gcphone:matchmylove:getProfile', false, function(payload)
        cb(payload)
    end)
end)

RegisterNUICallback('matchmyloveCreateProfile', function(data, cb)
    lib.callback('gcphone:matchmylove:createProfile', false, function(success, value)
        cb(cbSuccess(success, success and nil or value, success and { profile = value } or nil))
    end, data or {})
end)

RegisterNUICallback('matchmyloveUpdateProfile', function(data, cb)
    lib.callback('gcphone:matchmylove:updateProfile', false, function(success, value)
        cb(cbSuccess(success, success and nil or value, success and { profile = value } or nil))
    end, data or {})
end)

RegisterNUICallback('matchmyloveDeleteProfile', function(_, cb)
    lib.callback('gcphone:matchmylove:deleteProfile', false, function(success, message)
        cb(cbSuccess(success, message))
    end)
end)

RegisterNUICallback('matchmyloveGetCards', function(_, cb)
    lib.callback('gcphone:matchmylove:getCards', false, function(payload)
        cb(payload or {})
    end)
end)

RegisterNUICallback('matchmyloveSwipe', function(data, cb)
    lib.callback('gcphone:matchmylove:swipe', false, function(success, value)
        cb(cbSuccess(success, success and nil or value, success and value or nil))
    end, data or {})
end)

RegisterNUICallback('matchmyloveGetMatches', function(_, cb)
    lib.callback('gcphone:matchmylove:getMatches', false, function(payload)
        cb(payload or {})
    end)
end)

RegisterNUICallback('matchmyloveGetMessages', function(data, cb)
    lib.callback('gcphone:matchmylove:getMessages', false, function(payload)
        cb(payload or {})
    end, data or {})
end)

RegisterNUICallback('matchmyloveSendMessage', function(data, cb)
    lib.callback('gcphone:matchmylove:sendMessage', false, function(success, value)
        cb(cbSuccess(success, success and nil or value, success and { message = value } or nil))
    end, data or {})
end)

RegisterNUICallback('matchmyloveUnmatch', function(data, cb)
    lib.callback('gcphone:matchmylove:unmatch', false, function(success, message)
        cb(cbSuccess(success, message))
    end, data or {})
end)

-- Services
RegisterNUICallback('servicesGetCategories', function(_, cb)
    lib.callback('gcphone:services:getCategories', false, function(payload)
        cb(payload or {})
    end)
end)

RegisterNUICallback('servicesGetListings', function(data, cb)
    lib.callback('gcphone:services:getListings', false, function(payload)
        cb(payload or {})
    end, data or {})
end)

RegisterNUICallback('servicesGetMyService', function(_, cb)
    lib.callback('gcphone:services:getMyService', false, function(payload)
        cb(payload)
    end)
end)

RegisterNUICallback('servicesRegister', function(data, cb)
    lib.callback('gcphone:services:register', false, function(success, service)
        cb(cbSuccess(success, success and nil or service, success and { service = service } or nil))
    end, data or {})
end)

RegisterNUICallback('servicesUpdateService', function(data, cb)
    lib.callback('gcphone:services:updateService', false, function(success, message)
        cb(cbSuccess(success, message))
    end, data or {})
end)

RegisterNUICallback('servicesSetAvailability', function(data, cb)
    lib.callback('gcphone:services:setAvailability', false, function(success)
        cb(cbSuccess(success))
    end, data or {})
end)

RegisterNUICallback('servicesDeleteService', function(_, cb)
    lib.callback('gcphone:services:deleteService', false, function(success)
        cb(cbSuccess(success))
    end)
end)

RegisterNUICallback('servicesGetWorkerInfo', function(data, cb)
    local serviceId = tonumber(type(data) == 'table' and data.serviceId or data)
    lib.callback('gcphone:services:getWorkerInfo', false, function(payload)
        cb(payload)
    end, serviceId)
end)

RegisterNUICallback('servicesRateWorker', function(data, cb)
    lib.callback('gcphone:services:rateWorker', false, function(success, message)
        cb(cbSuccess(success, message))
    end, data or {})
end)

RegisterNUICallback('servicesGetWorkerRatings', function(data, cb)
    lib.callback('gcphone:services:getWorkerRatings', false, function(payload)
        cb(payload or {})
    end, data or {})
end)

RegisterNUICallback('setGPS', function(data, cb)
    local x = type(data) == 'table' and tonumber(data.x) or nil
    local y = type(data) == 'table' and tonumber(data.y) or nil

    if x and y then
        SetNewWaypoint(x, y)
        cb(true)
        return
    end

    cb(false)
end)

RegisterNUICallback('getPlayerCoords', function(_, cb)
    local ped = cache.ped
    if not ped or ped <= 0 then
        cb({ x = 0, y = 0 })
        return
    end

    local coords = GetEntityCoords(ped)
    cb({ x = coords.x or 0, y = coords.y or 0 })
end)

RegisterNUICallback('getWebRTCIceServers', function(_, cb)
    lib.callback('gcphone:webrtc:getIceServers', false, function(servers)
        cb(servers or {})
    end)
end)

RegisterNUICallback('webrtcRegisterSession', function(data, cb)
    lib.callback('gcphone:peer:register', false, function(result)
        cb(result or { success = false })
    end, data)
end)

RegisterNUICallback('webrtcSignal', function(data, cb)
    lib.callback('gcphone:peer:signal', false, function(result)
        cb(result or { success = false })
    end, data)
end)

RegisterNetEvent('gcphone:peer:signal', function(payload)
    SendNUIMessage({ action = 'webrtcSignal', data = payload })
end)

RegisterNUICallback('videoPeerReady', function(data, cb)
    lib.callback('gcphone:peer:videoReady', false, function(result)
        cb(result or { success = false })
    end, data)
end)

RegisterNetEvent('gcphone:peer:videoConnected', function(payload)
    SendNUIMessage({ action = 'videoPeerConnected', data = payload })
end)

RegisterNUICallback('snapLivePeerReady', function(data, cb)
    lib.callback('gcphone:peer:snapLiveReady', false, function(result)
        cb(result or { success = false })
    end, data)
end)

RegisterNetEvent('gcphone:peer:snapLiveConnected', function(payload)
    SendNUIMessage({ action = 'gcphone:snap:livePeerConnected', data = payload })
end)

RegisterNUICallback('newsLivePeerReady', function(data, cb)
    lib.callback('gcphone:peer:newsLiveReady', false, function(result)
        cb(result or { success = false })
    end, data)
end)

RegisterNetEvent('gcphone:peer:newsLiveConnected', function(payload)
    SendNUIMessage({ action = 'gcphone:news:livePeerConnected', data = payload })
end)

RegisterNUICallback('wavechatGetGroups', function(_, cb)
    lib.callback('gcphone:wavechatGetGroups', false, function(groups)
        cb(groups or {})
    end)
end)

RegisterNUICallback('wavechatGetInvites', function(_, cb)
    lib.callback('gcphone:wavechatGetInvites', false, function(invites)
        cb(invites or {})
    end)
end)

RegisterNUICallback('wavechatGetStatusMediaConfig', function(_, cb)
    lib.callback('gcphone:wavechat:getStatusMediaConfig', false, function(payload)
        cb(payload or { canUploadImage = false, canUploadVideo = false, maxVideoDurationSeconds = 10 })
    end)
end)

RegisterNUICallback('wavechatGetStatuses', function(_, cb)
    lib.callback('gcphone:wavechatGetStatuses', false, function(payload)
        cb(payload or {})
    end)
end)

RegisterNUICallback('wavechatCreateStatus', function(data, cb)
    lib.callback('gcphone:wavechatCreateStatus', false, function(success, payload)
        cb(cbSuccess(success, success and nil or payload))
    end, data or {})
end)

RegisterNUICallback('wavechatMarkStatusViewed', function(data, cb)
    lib.callback('gcphone:wavechatMarkStatusViewed', false, function(success)
        cb(cbSuccess(success))
    end, data)
end)

RegisterNUICallback('wavechatCreateGroup', function(data, cb)
    lib.callback('gcphone:wavechatCreateGroup', false, function(success, value)
        cb(cbSuccess(success, success and nil or value, success and { groupId = value } or nil))
    end, data)
end)

RegisterNUICallback('wavechatRespondInvite', function(data, cb)
    lib.callback('gcphone:wavechatRespondInvite', false, function(success, payload)
        cb(cbSuccess(success, success and nil or payload, success and payload or nil))
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

RegisterNetEvent('gcphone:wavechatGroupMessage', function(payload)
    SendNUIMessage({
        action = 'wavechatGroupMessage',
        data = payload
    })
end)

RegisterNUICallback('emergencySOS', function(_, cb)
    lib.callback('gcphone:emergencySOS', false, function(result)
        cb(result or { success = false })
    end)
end)

RegisterNUICallback('notesGetAll', function(_, cb)
    lib.callback('gcphone:notes:getAll', false, function(notes)
        cb(notes or {})
    end)
end)

RegisterNUICallback('notesSave', function(data, cb)
    lib.callback('gcphone:notes:save', false, function(success, noteId)
        cb({ success = success and true or false, id = noteId })
    end, data or {})
end)

RegisterNUICallback('notesDelete', function(data, cb)
    lib.callback('gcphone:notes:delete', false, function(success)
        cb({ success = success and true or false })
    end, data or {})
end)

RegisterNUICallback('getWeatherData', function(_, cb)
    local weatherHash1, weatherHash2, pct = GetWeatherTypeTransition()
    local hour = GetClockHours()
    local minute = GetClockMinutes()

    local weatherNames = {
        [GetHashKey('EXTRASUNNY')] = 'Despejado',
        [GetHashKey('CLEAR')]      = 'Despejado',
        [GetHashKey('CLOUDS')]     = 'Nublado',
        [GetHashKey('OVERCAST')]   = 'Cubierto',
        [GetHashKey('RAIN')]       = 'Lluvia',
        [GetHashKey('THUNDER')]    = 'Tormenta',
        [GetHashKey('CLEARING')]   = 'Despejando',
        [GetHashKey('SMOG')]       = 'Smog',
        [GetHashKey('FOGGY')]      = 'Niebla',
        [GetHashKey('SNOW')]       = 'Nieve',
        [GetHashKey('BLIZZARD')]   = 'Ventisca',
        [GetHashKey('SNOWLIGHT')]  = 'Nieve leve',
        [GetHashKey('XMAS')]       = 'Navidad',
        [GetHashKey('HALLOWEEN')]  = 'Halloween',
        [GetHashKey('NEUTRAL')]    = 'Neutral',
    }

    local current = weatherNames[weatherHash1] or 'Desconocido'
    local next = weatherNames[weatherHash2] or current

    local temp = 22
    if current == 'Despejado' then
        temp = 28
    elseif current == 'Nublado' then
        temp = 20
    elseif current == 'Cubierto' then
        temp = 18
    elseif current == 'Lluvia' or current == 'Tormenta' then
        temp = 15
    elseif current == 'Niebla' then
        temp = 14
    elseif current == 'Nieve' or current == 'Ventisca' or current == 'Nieve leve' then
        temp = -2
    end

    if hour >= 6 and hour < 12 then
        temp = temp - 3
    elseif hour >= 18 or hour < 6 then
        temp = temp - 6
    end

    cb({
        condition = pct > 0.5 and next or current,
        temperature = temp,
        gameHour = hour,
        gameMinute = minute,
        wind = math.random(5, 25),
        humidity = math.random(30, 80),
        rainChance = (current == 'Lluvia' or current == 'Tormenta') and math.random(60, 95) or math.random(0, 20),
    })
end)

-- Clock: read in-game time (CLIENT-ONLY)
RegisterNUICallback('getGameTime', function(_, cb)
    cb({
        hour = GetClockHours(),
        minute = GetClockMinutes(),
        second = GetClockSeconds(),
    })
end)

RegisterNUICallback('documentsUpdatePhoto', function(data, cb)
    lib.callback('gcphone:documents:updatePhoto', false, function(payload)
        cb(payload or {})
    end, data)
end)

-- ── Flashlight ──

-- Flashlight NUI callbacks are registered in client/flashlight.lua (authoritative)

-- ── WaveChat DM ──

RegisterNUICallback('wavechatDmSend', function(data, cb)
    lib.callback('gcphone:wavechat:dm:send', false, function(result)
        cb(result or { success = false })
    end, data)
end)

RegisterNUICallback('wavechatDmGetHistory', function(data, cb)
    lib.callback('gcphone:wavechat:dm:getHistory', false, function(result)
        cb(result or { success = false, messages = {} })
    end, data)
end)

RegisterNUICallback('wavechatDmGetConversations', function(_, cb)
    lib.callback('gcphone:wavechat:dm:getConversations', false, function(result)
        cb(result or { success = false, conversations = {} })
    end)
end)

RegisterNUICallback('wavechatDmTyping', function(data, cb)
    lib.callback('gcphone:wavechat:dm:typing', false, function() cb({}) end, data)
end)

RegisterNUICallback('wavechatDmMarkRead', function(data, cb)
    lib.callback('gcphone:wavechat:dm:markRead', false, function(result)
        cb(result or { success = false })
    end, data)
end)

RegisterNUICallback('wavechatDmDeleteConversation', function(data, cb)
    lib.callback('gcphone:wavechat:dm:deleteConversation', false, function(result)
        cb(result or { success = false })
    end, data)
end)

RegisterNUICallback('wavechatDmDeleteMessage', function(data, cb)
    lib.callback('gcphone:wavechat:dm:deleteMessage', false, function(result)
        cb(result or { success = false })
    end, data)
end)

RegisterNetEvent('gcphone:wavechat:dm:message', function(message)
    SendNUIMessage({ action = 'wavechatDmMessage', data = message })
end)

RegisterNetEvent('gcphone:wavechat:dm:messageDeleted', function(payload)
    SendNUIMessage({ action = 'wavechatDmMessageDeleted', data = payload })
end)

RegisterNetEvent('gcphone:wavechat:dm:typing', function(payload)
    SendNUIMessage({ action = 'wavechatDmTyping', data = payload })
end)

-- ── WaveChat Group Typing ──

RegisterNUICallback('wavechatGroupTyping', function(data, cb)
    lib.callback('gcphone:wavechat:groupTyping', false, function() cb({}) end, data)
end)

RegisterNetEvent('gcphone:wavechat:groupTyping', function(payload)
    SendNUIMessage({ action = 'wavechatGroupTyping', data = payload })
end)

-- ── SnapLive Chat ──

RegisterNUICallback('snapJoinLiveChat', function(data, cb)
    lib.callback('gcphone:snap:joinLiveChat', false, function(result)
        cb(result or { success = false })
    end, data)
end)

RegisterNUICallback('snapLeaveLiveChat', function(data, cb)
    lib.callback('gcphone:snap:leaveLiveChat', false, function() cb({}) end, data)
end)

-- ── MatchMyLove Typing ──

RegisterNUICallback('matchmyloveTyping', function(data, cb)
    lib.callback('gcphone:matchmylove:typing', false, function() cb({}) end, data)
end)

RegisterNetEvent('gcphone:matchmylove:typing', function(payload)
    SendNUIMessage({ action = 'matchmyloveTyping', data = payload })
end)

-- OPT-04/26: dominios extraídos (ver client/nui/*.lua)
require 'client.nui.contacts'
require 'client.nui.messages'
require 'client.nui.mail'
require 'client.nui.phone_setup'
require 'client.nui.notifications'
require 'client.nui.settings'
require 'client.nui.gallery'
require 'client.nui.bank_wallet'
require 'client.nui.sdk_permissions'
require 'client.nui.events'
require 'client.nui.darkrooms'
require 'client.nui.radio'
require 'client.nui.cityride'

return {}
