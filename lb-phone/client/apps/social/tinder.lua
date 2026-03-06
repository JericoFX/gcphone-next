local TinderActions = {
    "createAccount",
    "saveProfile",
    "sendMessage"
}

RegisterNUICallback("Tinder", function(data, cb)
    if not currentPhone then
        return
    end

    local action = data.action
    debugprint("Spark:" .. (action or ""))

    if table.contains(TinderActions, action) and not CanInteract() then
        return cb(false)
    end

    if action == "createAccount" then
        TriggerCallback("tinder:createAccount", cb, data.data)
    elseif action == "deleteAccount" then
        TriggerCallback("tinder:deleteAccount", cb)
    elseif action == "saveProfile" then
        TriggerCallback("tinder:updateAccount", cb, data.data)
    elseif action == "isLoggedIn" then
        local account = AwaitCallback("tinder:isLoggedIn")
        if not account then
            return cb(false)
        end

        local profile = {
            name = account.name,
            photos = json.decode(account.photos),
            dob = account.dob,
            bio = account.bio,
            showMen = account.interested_men,
            showWomen = account.interested_women,
            isMale = account.is_male,
            active = account.active
        }
        cb(profile)
    elseif action == "getFeed" then
        local feed = AwaitCallback("tinder:getFeed", data.page)
        local formattedFeed = {}

        for i = 1, #feed do
            local profile = feed[i]
            formattedFeed[i] = {
                name = profile.name,
                dob = profile.dob,
                bio = profile.bio,
                photos = json.decode(profile.photos),
                number = profile.phone_number
            }
        end
        cb(formattedFeed)
    elseif action == "swipe" then
        TriggerCallback("tinder:swipe", cb, data.number, data.like)
    elseif action == "getMatches" then
        local matches = AwaitCallback("tinder:getMatches")
        local formattedMatches = {
            newMatches = {},
            messages = {}
        }

        for i = 1, #matches do
            local match = matches[i]
            local formattedMatch = {
                name = match.name,
                number = match.phone_number,
                photos = json.decode(match.photos),
                dob = match.dob,
                bio = match.bio,
                isMale = match.is_male
            }

            if match.latest_message then
                formattedMatch.lastMessage = match.latest_message
                formattedMatches.messages[#formattedMatches.messages + 1] = formattedMatch
            else
                formattedMatches.newMatches[#formattedMatches.newMatches + 1] = formattedMatch
            end
        end
        cb(formattedMatches)
    elseif action == "sendMessage" then
        local messageData = data.data
        if messageData.attachments and #messageData.attachments == 0 then
            messageData.attachments = nil
        end

        TriggerCallback("tinder:sendMessage", cb,
            messageData.recipient,
            messageData.content,
            messageData.attachments and json.encode(messageData.attachments)
        )
    elseif action == "getMessages" then
        local messages = AwaitCallback("tinder:getMessages", data.number, data.page)

        for i = 1, #messages do
            if messages[i].attachments then
                messages[i].attachments = json.decode(messages[i].attachments)
            else
                messages[i].attachments = {}
            end
        end
        cb(messages)
    end
end)

RegisterNetEvent("phone:tinder:receiveMessage", function(message)
    if message.attachments then
        message.attachments = json.decode(message.attachments)
    else
        message.attachments = {}
    end
    SendReactMessage("tinder:newMessage", message)
end)
