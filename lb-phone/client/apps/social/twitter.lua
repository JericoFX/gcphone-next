-- Twitter/Birdy Client Module

-- Helper function to format tweet data
local function formatTweetData(tweet)
    if not tweet then
        return {}
    end

    -- Process attachments
    local attachments = tweet.attachments
    if type(tweet.attachments) == "string" then
        attachments = json.decode(tweet.attachments)
    end

    -- Validate attachments format
    if attachments then
        if type(attachments) ~= "table" or table.type(attachments) ~= "array" then
            attachments = nil
            debugprint("Malformed attachments for birdy post", tweet.id)
        end
    end

    -- Construct formatted data
    local formattedData = {
        user = {
            profile_picture = tweet.profile_image,
            name = tweet.display_name,
            username = tweet.username,
            verified = tweet.verified == true,
            private = tweet.private == true
        },
        tweet = {
            id = tweet.id,
            content = tweet.content,
            date_created = tweet.timestamp,
            replies = tweet.reply_count,
            likes = tweet.like_count,
            retweets = tweet.retweet_count,
            attachments = attachments,
            replyToId = tweet.reply_to,
            liked = tweet.liked == true,
            retweeted = tweet.retweeted == true,
            replyToAuthor = tweet.replyToAuthor,
            retweetedByName = tweet.retweeted_by_display_name,
            retweetedByUsername = tweet.retweeted_by_username
        }
    }

    return formattedData
end

-- Function to get formatted posts with optional promotion
local function getFormattedPosts(filter, page)
    local posts = AwaitCallback("birdy:getPosts", filter, page)
    local formattedPosts = {}

    for i = 1, #posts do
        formattedPosts[i] = formatTweetData(posts[i])
    end

    -- Add promoted tweet if enabled and there are enough posts
    local promotionPosition = math.random(3, 6)
    if promotionPosition >= #formattedPosts then
        promotionPosition = #formattedPosts - 1
    end

    if Config.PromoteBirdy and Config.PromoteBirdy.Enabled and #posts > 1 then
        local promotedTweet = AwaitCallback("birdy:getRandomPromoted")
        if promotedTweet then
            promotedTweet = formatTweetData(promotedTweet)
            promotedTweet.tweet.promoted = true
            table.insert(formattedPosts, promotionPosition, promotedTweet)
        end
    end

    return formattedPosts
end

-- List of protected actions that require interaction check
local protectedActions = {
    "login",
    "toggleFollow",
    "toggleLike",
    "toggleRetweet",
    "sendMessage"
}

-- Main Twitter NUI callback handler
RegisterNUICallback("Twitter", function(data, callback)
    if not currentPhone then return end

    local action = data.action
    debugprint("Birdy:" .. (action or ""))

    -- Check if action requires interaction permission
    if table.contains(protectedActions, action) and not CanInteract() then
        return callback(false)
    end

    -- Handle different actions
    if action == "createAccount" then
        local accountData = data.data
        TriggerCallback("birdy:createAccount", callback, accountData.name, accountData.username, accountData.password)
    elseif action == "changePassword" then
        TriggerCallback("birdy:changePassword", callback, data.oldPassword, data.newPassword)
    elseif action == "deleteAccount" then
        TriggerCallback("birdy:deleteAccount", callback, data.password)
    elseif action == "login" then
        local loginData = data.data
        TriggerCallback("birdy:login", callback, loginData.username, loginData.password)
    elseif action == "isLoggedIn" then
        TriggerCallback("birdy:isLoggedIn", callback)
    elseif action == "sendTweet" then
        local tweetData = data.data
        TriggerCallback("birdy:sendPost", callback, tweetData.content, tweetData.attachments, tweetData.replyTo,
            tweetData.hashtags)
    elseif action == "updateProfile" then
        local profileData = data.data
        TriggerCallback("birdy:updateProfile", callback, profileData)
    elseif action == "searchAccounts" then
        TriggerCallback("birdy:searchAccounts", function(results)
            local formattedResults = {}
            for i = 1, #results do
                formattedResults[i] = {
                    username = results[i].username,
                    name = results[i].display_name,
                    profile_picture = results[i].profile_image,
                    verified = results[i].verified == true,
                    private = results[i].private == true
                }
            end
            callback(formattedResults)
        end, data.query)
    elseif action == "searchTweets" then
        TriggerCallback("birdy:searchTweets", function(tweets)
            local formattedTweets = {}
            for i = 1, #tweets do
                formattedTweets[i] = formatTweetData(tweets[i])
            end
            callback(formattedTweets)
        end, data.query, data.page)
    elseif action == "getProfile" then
        TriggerCallback("birdy:getProfile", function(profile)
            if not profile then
                debugprint("Birdy: failed to get profile", data.data.username)
                return callback()
            end

            if profile.pinnedTweet then
                profile.pinnedTweet = formatTweetData(profile.pinnedTweet)
            end
            callback(profile)
        end, data.data.username)
    elseif action == "getFollowers" then
        TriggerCallback("birdy:getData", callback, "followers", data.data.username, data.data.page)
    elseif action == "getFollowing" then
        TriggerCallback("birdy:getData", callback, "following", data.data.username, data.data.page)
    elseif action == "getLikes" then
        TriggerCallback("birdy:getData", callback, "likes", data.data.tweet_id, data.data.page)
    elseif action == "getRetweeters" then
        TriggerCallback("birdy:getData", callback, "retweeters", data.data.tweet_id, data.data.page)
    elseif action == "getTweets" then
        local filter = data.filter or data.filters
        if filter and next(filter) == nil then
            filter = nil
        end
        callback(getFormattedPosts(filter, data.page))
    elseif action == "getTweet" then
        TriggerCallback("birdy:getPost", function(tweet)
            callback(formatTweetData(tweet))
        end, data.tweetId)
    elseif action == "getAuthor" then
        TriggerCallback("birdy:getAuthor", callback, data.tweetId)
    elseif action == "toggleFollow" then
        TriggerCallback("birdy:toggleFollow", callback, data.data.username, data.data.following)
    elseif action == "toggleNotifications" then
        TriggerCallback("birdy:toggleNotifications", callback, data.data.username, data.data.toggle)
    elseif action == "toggleLike" then
        TriggerCallback("birdy:toggleInteraction", callback, "like", data.tweet_id, data.liked)
    elseif action == "toggleRetweet" then
        TriggerCallback("birdy:toggleInteraction", callback, "retweet", data.tweet_id, data.retweeted)
    elseif action == "deleteTweet" then
        TriggerCallback("birdy:deletePost", callback, data.tweet_id)
    elseif action == "promoteTweet" then
        TriggerCallback("birdy:promotePost", callback, data.tweet_id)
    elseif action == "sendMessage" then
        local messageData = data.data
        TriggerCallback("birdy:sendMessage", callback, messageData.recipient, messageData.content,
            messageData.attachments)
    elseif action == "getMessages" then
        local messageData = data.data
        TriggerCallback("birdy:getMessages", function(messages)
            for i = 1, #messages do
                if messages[i].attachments then
                    messages[i].attachments = json.decode(messages[i].attachments)
                end
            end
            callback(messages)
        end, messageData.username, messageData.page)
    elseif action == "getRecentMessages" then
        TriggerCallback("birdy:getRecentMessages", callback, data.page)
    elseif action == "signOut" then
        TriggerCallback("birdy:signOut", callback)
    elseif action == "getNotifications" then
        TriggerCallback("birdy:getNotifications", function(notifications)
            for _, notification in pairs(notifications.notifications) do
                if notification.attachments then
                    notification.attachments = json.decode(notification.attachments)
                end
            end
            callback(notifications)
        end, data.page)
    elseif action == "getRecentHashtags" then
        TriggerCallback("birdy:getRecentHashtags", callback)
    elseif action == "pinTweet" then
        TriggerCallback("birdy:pinPost", callback, data.toggle and data.tweet_id or nil)
    elseif action == "getFollowRequests" then
        TriggerCallback("birdy:getFollowRequests", callback, data.page or 0)
    elseif action == "handleFollowRequest" then
        TriggerCallback("birdy:handleFollowRequest", callback, data.username, data.accept)
    end
end)

-- Event handlers for Twitter updates
RegisterNetEvent("phone:twitter:updateTweetData", function(tweetId, data, increment)
    debugprint("updateTweetData", tweetId, data, increment)
    SendReactMessage("twitter:updateTweetData", {
        tweetId = tweetId,
        data = data,
        increment = increment
    })
end)

RegisterNetEvent("phone:twitter:updateProfileData", function(username, data, increment)
    debugprint("updateProfileData", username, data, increment)
    SendReactMessage("twitter:updateProfileData", {
        username = username,
        data = data,
        increment = increment
    })
end)

RegisterNetEvent("phone:twitter:newMessage", function(message)
    SendReactMessage("twitter:newMessage", message)
end)

RegisterNetEvent("phone:twitter:newtweet", function(tweet)
    TriggerEvent("lb-phone:birdy:newPost", tweet)
    SendReactMessage("twitter:newTweet", formatTweetData(tweet))
end)

-- Export: SendTweet / PostBirdy
local function SendTweet(tweetData)
    assert(type(tweetData) == "table", "Expected table for data, got " .. type(tweetData))
    assert(type(tweetData.content) == "string", "Expected string for data.content, got " .. type(tweetData.content))
    assert(type(tweetData.attachments) == "table" or tweetData.attachments == nil,
        "Expected table / nil for data.attachments, got " .. type(tweetData.attachments))
    assert(type(tweetData.replyTo) == "string" or tweetData.replyTo == nil,
        "Expected string / nil for data.replyTo, got " .. type(tweetData.replyTo))
    assert(type(tweetData.hashtags) == "table" or tweetData.hashtags == nil,
        "Expected table / nil for data.hashtags, got " .. type(tweetData.hashtags))

    if not CanInteract() then return end

    return AwaitCallback("birdy:sendPost",
        tweetData.content,
        tweetData.attachments,
        tweetData.replyTo,
        tweetData.hashtags
    )
end

exports("SendTweet", SendTweet)
exports("PostBirdy", SendTweet)
