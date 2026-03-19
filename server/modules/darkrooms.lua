-- Creado/Modificado por JericoFX

local LastRoomActionBySource = {}

local ROOM_ICON_ALLOWLIST = {
    ['🌙'] = true,
    ['💀'] = true,
    ['👁️'] = true,
    ['🕯️'] = true,
    ['🧿'] = true,
    ['🩸'] = true,
    ['🕸️'] = true,
    ['🔮'] = true,
    ['☠️'] = true,
    ['🔥'] = true,
    ['⚡'] = true,
    ['🦇'] = true,
}

local function SanitizeText(value, maxLength)
    if type(value) ~= 'string' then return '' end
    local text = value:gsub('[%z\1-\31\127]', '')
    text = text:gsub('<.->', '')
    text = text:gsub('^%s+', ''):gsub('%s+$', '')
    return text:sub(1, maxLength or 800)
end

local function SanitizeSlug(value)
    local text = SanitizeText(value, 40):lower()
    text = text:gsub('[^a-z0-9%-_]', '-')
    text = text:gsub('%-+', '-')
    text = text:gsub('^%-+', ''):gsub('%-+$', '')
    return text
end

local function SanitizeEmoji(value)
    local text = SanitizeText(value, 4)
    if text == '' then return '🌙' end
    if ROOM_ICON_ALLOWLIST[text] then
        return text
    end
    return '🌙'
end

local function SanitizeMediaUrl(value)
    if type(value) ~= 'string' then return nil end
    local url = value:gsub('[%z\1-\31\127]', '')
    url = url:gsub('^%s+', ''):gsub('%s+$', '')
    if url == '' then return nil end
    if not url:match('^https?://') then return nil end

    local lower = (url:match('^[^?]+') or url):lower()
    local allowed = {
        '.png', '.jpg', '.jpeg', '.webp', '.gif',
        '.mp4', '.webm', '.mov', '.m3u8', '.mp3', '.ogg', '.wav', '.m4a', '.aac'
    }

    for _, ext in ipairs(allowed) do
        if lower:sub(-#ext) == ext then
            return url:sub(1, 500)
        end
    end

    return nil
end

local function ToPositiveInt(value)
    local n = tonumber(value)
    if not n then return nil end
    if n < 1 then return nil end
    return math.floor(n)
end

local function CanPerformAction(source)
    local now = GetGameTimer()
    local last = LastRoomActionBySource[source] or 0
    if (now - last) < 350 then
        return false
    end
    LastRoomActionBySource[source] = now
    return true
end

local function IsRoomMember(roomId, identifier)
    local row = MySQL.single.await(
        'SELECT id FROM phone_darkrooms_members WHERE room_id = ? AND identifier = ? LIMIT 1',
        { roomId, identifier }
    )
    return row ~= nil
end

local function EnsureDefaultRooms()
    local defaults = {
        { slug = 'general', name = 'General', description = 'Conversaciones generales de la ciudad', icon = '🌙' },
        { slug = 'mercado', name = 'Mercado', description = 'Ofertas, compras y ventas', icon = '💼' },
        { slug = 'vehiculos', name = 'Vehiculos', description = 'Mecanica, carreras y recomendaciones', icon = '🏁' },
        { slug = 'policia', name = 'Policia', description = 'Novedades de seguridad y reportes', icon = '🚔' },
    }

    for _, room in ipairs(defaults) do
        local existing = MySQL.single.await('SELECT id FROM phone_darkrooms_rooms WHERE slug = ? LIMIT 1', { room.slug })
        if not existing then
            MySQL.insert.await(
                'INSERT INTO phone_darkrooms_rooms (slug, name, description, icon, password_hash, created_by) VALUES (?, ?, ?, ?, ?, ?)',
                { room.slug, room.name, room.description, room.icon, nil, 'system' }
            )
        end
    end
end

CreateThread(function()
    Wait(1000)
    EnsureDefaultRooms()
end)

lib.callback.register('gcphone:darkrooms:getRooms', function(source)
    local identifier = GetIdentifier(source)
    if not identifier then return {} end

    return MySQL.query.await(
        [[
            SELECT r.id, r.slug, r.name, r.description, r.icon, r.created_at,
                   (r.password_hash IS NOT NULL) AS has_password,
                   COUNT(DISTINCT m.id) AS members,
                   COUNT(DISTINCT p.id) AS posts,
                   MAX(CASE WHEN mym.identifier IS NULL THEN 0 ELSE 1 END) AS is_member
            FROM phone_darkrooms_rooms r
            LEFT JOIN phone_darkrooms_members m ON m.room_id = r.id
            LEFT JOIN phone_darkrooms_posts p ON p.room_id = r.id
            LEFT JOIN phone_darkrooms_members mym ON mym.room_id = r.id AND mym.identifier = ?
            GROUP BY r.id
            ORDER BY r.name ASC
        ]],
        { identifier }
    ) or {}
end)

lib.callback.register('gcphone:darkrooms:createRoom', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return { success = false, error = 'INVALID_SOURCE' } end
    if not CanPerformAction(source) then return { success = false, error = 'RATE_LIMIT' } end
    if type(data) ~= 'table' then return { success = false, error = 'INVALID_DATA' } end

    local name = SanitizeText(data.name, 60)
    local slug = SanitizeSlug(data.slug or name)
    local description = SanitizeText(data.description, 220)
    local icon = SanitizeEmoji(data.icon)
    local password = SanitizeText(data.password, 64)

    if name == '' then return { success = false, error = 'EMPTY_NAME' } end
    if slug == '' then return { success = false, error = 'INVALID_SLUG' } end

    local existing = MySQL.single.await('SELECT id FROM phone_darkrooms_rooms WHERE slug = ? LIMIT 1', { slug })
    if existing then return { success = false, error = 'SLUG_TAKEN' } end

    local roomId
    if password ~= '' then
        roomId = MySQL.insert.await(
            'INSERT INTO phone_darkrooms_rooms (slug, name, description, icon, password_hash, created_by) VALUES (?, ?, ?, ?, SHA2(?, 256), ?)',
            { slug, name, description ~= '' and description or nil, icon, password, identifier }
        )
    else
        roomId = MySQL.insert.await(
            'INSERT INTO phone_darkrooms_rooms (slug, name, description, icon, password_hash, created_by) VALUES (?, ?, ?, ?, ?, ?)',
            { slug, name, description ~= '' and description or nil, icon, nil, identifier }
        )
    end

    MySQL.insert.await(
        'INSERT IGNORE INTO phone_darkrooms_members (room_id, identifier, role) VALUES (?, ?, ?)',
        { roomId, identifier, 'moderator' }
    )

    return { success = true, roomId = roomId }
end)

lib.callback.register('gcphone:darkrooms:joinRoom', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return { success = false, error = 'INVALID_SOURCE' } end
    if not CanPerformAction(source) then return { success = false, error = 'RATE_LIMIT' } end

    local roomId = ToPositiveInt(type(data) == 'table' and data.roomId or nil)
    if not roomId then return { success = false, error = 'INVALID_ROOM' } end

    if IsRoomMember(roomId, identifier) then
        return { success = true }
    end

    local room = MySQL.single.await('SELECT id, password_hash IS NOT NULL AS has_password FROM phone_darkrooms_rooms WHERE id = ? LIMIT 1', { roomId })
    if not room then
        return { success = false, error = 'ROOM_NOT_FOUND' }
    end

    local hasPassword = tonumber(room.has_password) == 1
    if hasPassword then
        local password = SanitizeText(type(data) == 'table' and data.password or '', 64)
        if password == '' then
            return { success = false, error = 'PASSWORD_REQUIRED' }
        end

        local valid = MySQL.single.await(
            'SELECT id FROM phone_darkrooms_rooms WHERE id = ? AND password_hash = SHA2(?, 256) LIMIT 1',
            { roomId, password }
        )

        if not valid then
            return { success = false, error = 'INVALID_PASSWORD' }
        end
    end

    MySQL.insert.await(
        'INSERT IGNORE INTO phone_darkrooms_members (room_id, identifier, role) VALUES (?, ?, ?)',
        { roomId, identifier, 'member' }
    )

    return { success = true }
end)

lib.callback.register('gcphone:darkrooms:getPosts', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return {} end

    local roomId = ToPositiveInt(type(data) == 'table' and data.roomId or nil)
    if not roomId then return {} end

    local room = MySQL.single.await('SELECT id, password_hash IS NOT NULL AS has_password FROM phone_darkrooms_rooms WHERE id = ? LIMIT 1', { roomId })
    if not room then return {} end

    if tonumber(room.has_password) == 1 and not IsRoomMember(roomId, identifier) then
        return {}
    end

    local sort = SanitizeText(type(data) == 'table' and data.sort or 'new', 10)
    local orderBy = sort == 'top' and 'p.score DESC, p.created_at DESC' or 'p.created_at DESC'
    local limit = math.max(1, math.min(tonumber(type(data) == 'table' and data.limit or 25) or 25, 50))
    local offset = math.max(0, tonumber(type(data) == 'table' and data.offset or 0) or 0)

    local sql = ([[
        SELECT p.id, p.room_id, p.author_identifier, p.author_name, p.title, p.content, p.media_url, p.is_anonymous,
               p.score, p.comments_count, p.created_at,
               COALESCE(v.value, 0) AS my_vote
        FROM phone_darkrooms_posts p
        LEFT JOIN phone_darkrooms_votes v ON v.post_id = p.id AND v.identifier = ?
        WHERE p.room_id = ?
        ORDER BY %s
        LIMIT ? OFFSET ?
    ]]):format(orderBy)

    return MySQL.query.await(sql, { identifier, roomId, limit, offset }) or {}
end)

lib.callback.register('gcphone:darkrooms:createPost', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return { success = false, error = 'INVALID_SOURCE' } end
    if not CanPerformAction(source) then return { success = false, error = 'RATE_LIMIT' } end

    local roomId = ToPositiveInt(type(data) == 'table' and data.roomId or nil)
    local title = SanitizeText(type(data) == 'table' and data.title or '', 140)
    local content = SanitizeText(type(data) == 'table' and data.content or '', 2000)
    local mediaUrl = SanitizeMediaUrl(type(data) == 'table' and data.mediaUrl or nil)
    local anonymous = type(data) == 'table' and data.anonymous == true

    if not roomId then return { success = false, error = 'INVALID_ROOM' } end
    if title == '' or (content == '' and not mediaUrl) then return { success = false, error = 'EMPTY_POST' } end

    local room = MySQL.single.await('SELECT id, password_hash IS NOT NULL AS has_password FROM phone_darkrooms_rooms WHERE id = ? LIMIT 1', { roomId })
    if not room then return { success = false, error = 'ROOM_NOT_FOUND' } end

    if tonumber(room.has_password) == 1 and not IsRoomMember(roomId, identifier) then
        return { success = false, error = 'ROOM_JOIN_REQUIRED' }
    end

    if not IsRoomMember(roomId, identifier) then
        MySQL.insert.await(
            'INSERT IGNORE INTO phone_darkrooms_members (room_id, identifier, role) VALUES (?, ?, ?)',
            { roomId, identifier, 'member' }
        )
    end

    local authorName = anonymous and 'Anonimo' or SanitizeText(GetName(source) or 'Anonimo', 64)
    local postId = MySQL.insert.await(
        'INSERT INTO phone_darkrooms_posts (room_id, author_identifier, author_name, title, content, media_url, is_anonymous) VALUES (?, ?, ?, ?, ?, ?, ?)',
        { roomId, identifier, authorName ~= '' and authorName or 'Anonimo', title, content, mediaUrl, anonymous and 1 or 0 }
    )

    local post = MySQL.single.await(
        'SELECT id, room_id, author_identifier, author_name, title, content, media_url, is_anonymous, score, comments_count, created_at, 0 AS my_vote FROM phone_darkrooms_posts WHERE id = ?',
        { postId }
    )

    return { success = true, post = post }
end)

lib.callback.register('gcphone:darkrooms:votePost', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return { success = false } end
    if not CanPerformAction(source) then return { success = false } end

    local postId = ToPositiveInt(type(data) == 'table' and data.postId or nil)
    local vote = tonumber(type(data) == 'table' and data.vote or 0) or 0
    if vote > 1 then vote = 1 end
    if vote < -1 then vote = -1 end
    if not postId or vote == 0 then return { success = false } end

    local previous = MySQL.single.await(
        'SELECT value FROM phone_darkrooms_votes WHERE post_id = ? AND identifier = ? LIMIT 1',
        { postId, identifier }
    )

    local previousValue = previous and tonumber(previous.value) or 0
    local nextValue = vote

    if previousValue == vote then
        MySQL.execute.await('DELETE FROM phone_darkrooms_votes WHERE post_id = ? AND identifier = ?', { postId, identifier })
        nextValue = 0
    else
        MySQL.insert.await(
            'INSERT INTO phone_darkrooms_votes (post_id, identifier, value) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)',
            { postId, identifier, vote }
        )
    end

    -- score maintained by trg_darkrooms_votes_ai/au/ad
    local score = MySQL.scalar.await('SELECT score FROM phone_darkrooms_posts WHERE id = ? LIMIT 1', { postId }) or 0
    return { success = true, score = tonumber(score) or 0, myVote = nextValue }
end)

lib.callback.register('gcphone:darkrooms:getComments', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return {} end

    local postId = ToPositiveInt(type(data) == 'table' and data.postId or nil)
    if not postId then return {} end

    return MySQL.query.await(
        'SELECT id, post_id, author_identifier, author_name, content, media_url, is_anonymous, created_at FROM phone_darkrooms_comments WHERE post_id = ? ORDER BY created_at ASC LIMIT 200',
        { postId }
    ) or {}
end)

lib.callback.register('gcphone:darkrooms:createComment', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return { success = false, error = 'INVALID_SOURCE' } end
    if not CanPerformAction(source) then return { success = false, error = 'RATE_LIMIT' } end

    local postId = ToPositiveInt(type(data) == 'table' and data.postId or nil)
    local content = SanitizeText(type(data) == 'table' and data.content or '', 1200)
    local mediaUrl = SanitizeMediaUrl(type(data) == 'table' and data.mediaUrl or nil)
    local anonymous = type(data) == 'table' and data.anonymous == true

    if not postId or (content == '' and not mediaUrl) then return { success = false, error = 'INVALID_PAYLOAD' } end

    local exists = MySQL.single.await('SELECT id FROM phone_darkrooms_posts WHERE id = ? LIMIT 1', { postId })
    if not exists then return { success = false, error = 'POST_NOT_FOUND' } end

    local authorName = anonymous and 'Anonimo' or SanitizeText(GetName(source) or 'Anonimo', 64)
    local commentId = MySQL.insert.await(
        'INSERT INTO phone_darkrooms_comments (post_id, author_identifier, author_name, content, media_url, is_anonymous) VALUES (?, ?, ?, ?, ?, ?)',
        { postId, identifier, authorName ~= '' and authorName or 'Anonimo', content, mediaUrl, anonymous and 1 or 0 }
    )

    -- comments_count maintained by trg_darkrooms_comments_ai
    local comment = MySQL.single.await(
        'SELECT id, post_id, author_identifier, author_name, content, media_url, is_anonymous, created_at FROM phone_darkrooms_comments WHERE id = ?',
        { commentId }
    )

    return { success = true, comment = comment }
end)

AddEventHandler('playerDropped', function()
    LastRoomActionBySource[source] = nil
end)
