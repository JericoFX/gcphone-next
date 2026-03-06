local POSTS_PER_PAGE = 15

local function getPosts(page, filters)
    if not page then page = 0 end
    local where, params = {}, {}

    if filters then
        if filters.search then
            table.insert(where, "(title LIKE ? OR description LIKE ?)")
            local searchTerm = "%" .. filters.search .. "%"
            table.insert(params, searchTerm)
            table.insert(params, searchTerm)

            if not filters.from then
                table.insert(where, "OR phone_number LIKE ?")
                table.insert(params, searchTerm)
            end
        end

        if filters.from then
            local prefix = #where > 0 and "AND " or ""
            table.insert(where, prefix .. "phone_number = ?")
            table.insert(params, filters.from)
        end
    end

    local query = [[
        SELECT id, phone_number AS `number`, title, description,
               attachments, price, `timestamp`
        FROM phone_marketplace_posts
        {WHERE}
        ORDER BY `timestamp` DESC
        LIMIT ?, ?
    ]]
    query = string.gsub(query, "{WHERE}", #where > 0 and "WHERE " .. table.concat(where, " ") or "")

    table.insert(params, page * POSTS_PER_PAGE)
    table.insert(params, POSTS_PER_PAGE)

    return MySQL.query.await(query, params)
end

BaseCallback("marketplace:getPosts", function(source, phoneNumber, data)
    return getPosts(data.page, {
        from = data.from,
        search = data.query
    })
end)

BaseCallback("marketplace:createPost", function(source, phoneNumber, data)
    local title, desc, attachments, price = data.title, data.description, data.attachments, data.price
    if not (title and desc and attachments and price) or price < 0 then return false end

    if ContainsBlacklistedWord(source, "MarketPlace", title) or
        ContainsBlacklistedWord(source, "MarketPlace", desc) then
        return false
    end

    local postId = MySQL.insert.await(
        "INSERT INTO phone_marketplace_posts (phone_number, title, description, attachments, price) VALUES (?, ?, ?, ?, ?)",
        { phoneNumber, title, desc, json.encode(attachments), price }
    )

    if not postId then return false end

    data.number = phoneNumber
    data.id = postId
    TriggerClientEvent("phone:marketplace:newPost", -1, data)
    TriggerEvent("lb-phone:marketplace:newPost", data)

    Log("Marketplace", source, "info",
        L("BACKEND.LOGS.MARKETPLACE_NEW_TITLE"),
        L("BACKEND.LOGS.MARKETPLACE_NEW_DESCRIPTION", {
            seller = FormatNumber(phoneNumber),
            title = title,
            price = price,
            description = desc,
            attachments = json.encode(attachments),
            id = postId
        })
    )

    return postId
end)

BaseCallback("marketplace:deletePost", function(source, phoneNumber, postId)
    local isAdmin = IsAdmin(source)
    local query = "DELETE FROM phone_marketplace_posts WHERE id = ?"
    local params = { postId }

    if not isAdmin then
        query = query .. " AND phone_number = ?"
        table.insert(params, phoneNumber)
    end

    local affected = MySQL.update.await(query, params)
    if affected > 0 then
        Log("Marketplace", source, "error",
            L("BACKEND.LOGS.MARKETPLACE_DELETED"),
            string.format("**ID**: %s", postId)
        )
        return true
    end
    return false
end)
