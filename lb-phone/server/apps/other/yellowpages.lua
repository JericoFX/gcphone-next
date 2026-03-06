local POSTS_PER_PAGE = 10

-- Função para obter posts das Yellow Pages
local function getYellowPagesPosts(page, filters)
    page = page or 0
    local whereClauses = {}
    local queryParams = {}

    -- Filtros de busca
    if filters and filters.search then
        local searchTerm = "%" .. filters.search .. "%"
        table.insert(whereClauses, "(title LIKE ? OR description LIKE ?)")
        table.insert(queryParams, searchTerm)
        table.insert(queryParams, searchTerm)

        if not filters.from then
            table.insert(whereClauses, "OR phone_number LIKE ?")
            table.insert(queryParams, searchTerm)
        end
    end

    -- Filtro por número de telefone
    if filters and filters.from then
        local prefix = #whereClauses > 0 and "AND " or ""
        table.insert(whereClauses, prefix .. "phone_number = ?")
        table.insert(queryParams, filters.from)
    end

    -- Construção da query SQL
    local query = [[
        SELECT id, phone_number AS `number`, title, description,
               attachment, price, `timestamp`
        FROM phone_yellow_pages_posts
        {WHERE}
        ORDER BY `timestamp` DESC
        LIMIT ?, ?
    ]]

    -- Substitui a cláusula WHERE se necessário
    query = query:gsub("{WHERE}", #whereClauses > 0 and "WHERE " .. table.concat(whereClauses, " ") or "")

    -- Adiciona parâmetros de paginação
    table.insert(queryParams, page * POSTS_PER_PAGE)
    table.insert(queryParams, POSTS_PER_PAGE)

    return MySQL.query.await(query, queryParams)
end

-- Callback para obter posts
BaseCallback("yellowPages:getPosts", function(source, phoneNumber, page, filters)
    return getYellowPagesPosts(page, filters)
end)

-- Callback para criar um novo post
BaseCallback("yellowPages:createPost", function(source, phoneNumber, postData)
    -- Validação básica
    if not postData or not postData.title or not postData.description then
        return false
    end

    -- Verifica palavras proibidas
    if ContainsBlacklistedWord(source, "Pages", postData.title) or
        ContainsBlacklistedWord(source, "Pages", postData.description) then
        return false
    end

    -- Insere o novo post
    local postId = MySQL.insert.await(
        "INSERT INTO phone_yellow_pages_posts (phone_number, title, description, attachment, price) VALUES (?, ?, ?, ?, ?)",
        {
            phoneNumber,
            postData.title,
            postData.description,
            postData.attachment,
            tonumber(postData.price)
        }
    )

    if not postId then return false end

    -- Prepara dados para broadcast
    postData.id = postId
    postData.number = phoneNumber

    -- Notifica todos os jogadores
    TriggerClientEvent("phone:yellowPages:newPost", -1, postData)
    TriggerEvent("lb-phone:pages:newPost", postData)

    -- Log do sistema
    Log("YellowPages", source, "info",
        L("BACKEND.LOGS.YELLOWPAGES_NEW_TITLE"),
        L("BACKEND.LOGS.YELLOWPAGES_NEW_DESCRIPTION", {
            title = postData.title,
            description = postData.description,
            attachment = postData.attachment or "",
            id = postId
        })
    )

    return postId
end)

-- Callback para deletar um post
BaseCallback("yellowPages:deletePost", function(source, phoneNumber, postId)
    local isAdmin = IsAdmin(source)
    local query = "DELETE FROM phone_yellow_pages_posts WHERE id = ?"
    local params = { postId }

    if not isAdmin then
        query = query .. " AND phone_number = ?"
        table.insert(params, phoneNumber)
    end

    local affectedRows = MySQL.update.await(query, params)

    if affectedRows > 0 then
        Log("YellowPages", source, "error",
            L("BACKEND.LOGS.YELLOWPAGES_DELETED"),
            string.format("**ID**: %s", postId)
        )
        return true
    end

    return false
end)
