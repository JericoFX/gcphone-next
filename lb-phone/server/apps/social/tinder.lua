local BaseCallback = BaseCallback

-- Callback para criar uma conta no Tinder
BaseCallback("tinder:createAccount", function(source, phoneNumber, accountData)
    local accountExists = MySQL.scalar.await("SELECT TRUE FROM phone_tinder_accounts WHERE phone_number = ?",
        { phoneNumber })
    if accountExists then
        return false
    end

    local result = MySQL.update.await([[
        INSERT INTO phone_tinder_accounts
            (`name`, phone_number, photos, bio, dob, is_male, interested_men, interested_women)
        VALUES
            (@name, @phoneNumber, @photos, @bio, @dob, @isMale, @showMen, @showWomen)
    ]], {
        ["@name"] = accountData.name,
        ["@phoneNumber"] = phoneNumber,
        ["@photos"] = json.encode(accountData.photos),
        ["@bio"] = accountData.bio,
        ["@dob"] = accountData.dob,
        ["@isMale"] = accountData.isMale,
        ["@showMen"] = accountData.showMen,
        ["@showWomen"] = accountData.showWomen
    })

    return result > 0
end, false)

-- Callback para deletar uma conta do Tinder
BaseCallback("tinder:deleteAccount", function(source, phoneNumber)
    if not Config.DeleteAccount.Spark then
        infoprint("warning",
            string.format("%s tried to delete their spark account, but it's not enabled in the config.", source))
        return false
    end

    local deleted = MySQL.update.await("DELETE FROM phone_tinder_accounts WHERE phone_number = ?", { phoneNumber }) > 0
    if not deleted then
        return false
    end

    MySQL.update.await("DELETE FROM phone_tinder_swipes WHERE swiper = ? OR swipee = ?", { phoneNumber, phoneNumber })
    MySQL.update.await("DELETE FROM phone_tinder_matches WHERE phone_number_1 = ? OR phone_number_2 = ?",
        { phoneNumber, phoneNumber })
    MySQL.update.await("DELETE FROM phone_tinder_messages WHERE sender = ? OR recipient = ?",
        { phoneNumber, phoneNumber })

    return true
end)

-- Callback para atualizar uma conta do Tinder
BaseCallback("tinder:updateAccount", function(source, phoneNumber, accountData)
    local result = MySQL.update.await([[
        UPDATE phone_tinder_accounts
        SET
            `name`=@name,
            photos=@photos,
            bio=@bio,
            is_male=@isMale,
            interested_men=@showMen,
            interested_women=@showWomen,
            `active`=@active
        WHERE phone_number=@phoneNumber
    ]], {
        ["@name"] = accountData.name,
        ["@photos"] = json.encode(accountData.photos),
        ["@bio"] = accountData.bio,
        ["@isMale"] = accountData.isMale,
        ["@showMen"] = accountData.showMen,
        ["@showWomen"] = accountData.showWomen,
        ["@active"] = accountData.active,
        ["@phoneNumber"] = phoneNumber
    })

    return result > 0
end, false)

-- Callback para verificar se o usuário está logado no Tinder
BaseCallback("tinder:isLoggedIn", function(source, phoneNumber)
    local account = MySQL.single.await(
        "SELECT `name`, photos, bio, dob, is_male, interested_men, interested_women, `active` FROM phone_tinder_accounts WHERE phone_number = ?",
        { phoneNumber }
    )

    if account then
        MySQL.update.await("UPDATE phone_tinder_accounts SET last_seen = NOW() WHERE phone_number = ?", { phoneNumber })
    end

    return account
end, false)

-- Callback para obter o feed de perfis do Tinder
BaseCallback("tinder:getFeed", function(source, phoneNumber, page)
    return MySQL.query.await([[
        SELECT
            a.`name`, a.phone_number, a.photos, a.bio, a.dob
        FROM
            phone_tinder_accounts a
        JOIN
            phone_tinder_accounts b
        ON
            b.phone_number = @phoneNumber
        WHERE
            a.phone_number != @phoneNumber
            AND a.`active` = 1
            AND (a.is_male = b.interested_men OR a.is_male=(NOT b.interested_women))
            AND (a.interested_men=b.is_male OR a.interested_women=(NOT b.is_male))
            AND NOT EXISTS (SELECT TRUE FROM phone_tinder_swipes WHERE swiper = @phoneNumber AND swipee = a.phone_number)
        ORDER BY a.phone_number
        LIMIT @page, @perPage
    ]], {
        ["@phoneNumber"] = phoneNumber,
        ["@page"] = page * 10,
        ["@perPage"] = 10
    })
end, {})

-- Callback para registrar um swipe (like/dislike) no Tinder
BaseCallback("tinder:swipe", function(source, swiperPhone, swipeePhone, liked)
    local result = MySQL.query.await(
        "INSERT INTO phone_tinder_swipes (swiper, swipee, liked) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE liked = ?",
        { swiperPhone, swipeePhone, liked, liked }
    )

    if result == 0 or not liked then
        return false
    end

    local mutualLike = MySQL.scalar.await(
        "SELECT liked FROM phone_tinder_swipes WHERE swiper = ? AND swipee = ?",
        { swipeePhone, swiperPhone }
    ) == true

    if not mutualLike then
        return false
    end

    MySQL.update.await(
        "INSERT INTO phone_tinder_matches (phone_number_1, phone_number_2) VALUES (?, ?)",
        { swiperPhone, swipeePhone }
    )

    local swiperProfile = MySQL.single.await(
        "SELECT `name`, photos FROM phone_tinder_accounts WHERE phone_number = ?",
        { swiperPhone }
    )

    if swiperProfile then
        SendNotification(swipeePhone, {
            app = "Tinder",
            title = L("BACKEND.TINDER.NEW_MATCH"),
            content = L("BACKEND.TINDER.MATCHED_WITH", { name = swiperProfile.name }),
            thumbnail = json.decode(swiperProfile.photos)[1]
        })
    end

    return true
end)

-- Callback para obter os matches do Tinder
BaseCallback("tinder:getMatches", function(source, phoneNumber)
    return MySQL.query.await([[
        SELECT
            a.`name`, a.phone_number, a.photos, a.dob, a.bio, a.is_male, b.latest_message
        FROM
            phone_tinder_accounts a
        JOIN
            phone_tinder_matches b
        ON
            (b.phone_number_1 = @phoneNumber AND b.phone_number_2 = a.phone_number)
            OR
            (b.phone_number_2 = @phoneNumber AND b.phone_number_1 = a.phone_number)
        ORDER BY b.latest_message_timestamp DESC
    ]], {
        ["@phoneNumber"] = phoneNumber
    })
end)

-- Callback para enviar mensagem no Tinder
BaseCallback("tinder:sendMessage", function(source, senderPhone, recipientPhone, message, attachments)
    if ContainsBlacklistedWord(source, "Spark", message) then
        return false
    end

    local senderProfile = MySQL.single.await(
        "SELECT `name`, photos FROM phone_tinder_accounts WHERE phone_number = ?",
        { senderPhone }
    )

    if not senderProfile then
        return true
    end

    local result = MySQL.insert.await(
        "INSERT INTO phone_tinder_messages (sender, recipient, content, attachments) VALUES (?, ?, ?, ?)",
        { senderPhone, recipientPhone, message, attachments }
    )

    if not result then
        return false
    end

    MySQL.update.await(
        "UPDATE phone_tinder_matches SET latest_message = ? WHERE (phone_number_1 = ? AND phone_number_2 = ?) OR (phone_number_2 = ? AND phone_number_1 = ?)",
        { message, senderPhone, recipientPhone, senderPhone, recipientPhone }
    )

    local recipientSource = GetSourceFromNumber(recipientPhone)
    if recipientSource then
        TriggerClientEvent("phone:tinder:receiveMessage", recipientSource, {
            sender = senderPhone,
            recipient = recipientPhone,
            content = message,
            attachments = attachments,
            timestamp = os.time() * 1000
        })
    end

    SendNotification(recipientPhone, {
        app = "Tinder",
        title = senderProfile.name,
        content = message,
        thumbnail = attachments and json.decode(attachments)[1],
        avatar = json.decode(senderProfile.photos)[1],
        showAvatar = true
    })

    return true
end)

-- Callback para obter mensagens do Tinder
BaseCallback("tinder:getMessages", function(source, phoneNumber, matchPhoneNumber, page)
    return MySQL.query.await([[
        SELECT
            sender, recipient, content, attachments, timestamp
        FROM
            phone_tinder_messages
        WHERE
            (sender = @phoneNumber AND recipient = @number)
            OR
            (recipient = @phoneNumber AND sender = @number)
        ORDER BY timestamp DESC
        LIMIT @page, @perPage
    ]], {
        ["@phoneNumber"] = phoneNumber,
        ["@number"] = matchPhoneNumber,
        ["@page"] = page * 25,
        ["@perPage"] = 25
    })
end)

-- Thread para desativar contas inativas do Tinder
CreateThread(function()
    if not Config.AutoDisableSparkAccounts then
        return
    end

    local checkInterval = 3600000 -- 1 hora
    local daysInactive = 7        -- padrão de 7 dias

    if type(Config.AutoDisableSparkAccounts) == "number" then
        daysInactive = math.max(Config.AutoDisableSparkAccounts, 1)
    end

    while true do
        MySQL.update(
            "UPDATE phone_tinder_accounts SET active = 0 WHERE active = 1 AND last_seen < NOW() - INTERVAL ? DAY",
            { daysInactive },
            function(affectedRows)
                debugprint("Disabled", affectedRows, "inactive Spark accounts.")
            end
        )
        Wait(checkInterval)
    end
end)
