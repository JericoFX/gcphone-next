-- Creado/Modificado por JericoFX
-- MatchMyLove - Dating App Backend

local Utils = GcPhoneUtils
local function SafeString(v, m) return Utils.SafeString(v, m) end
local function SanitizeText(v, m) return Utils.SanitizeText(v, m, true) end
local function SanitizeMediaUrl(v) return Utils.SanitizeMediaUrl(v, {'.png','.jpg','.jpeg','.webp','.gif'}, 500) end
local function HitRateLimit(s, k, w, m) return Utils.HitRateLimit(s, k, w, m) end

local VALID_GENDERS = { male = true, female = true, other = true }
local VALID_LOOKING_FOR = { male = true, female = true, everyone = true }
local VALID_SWIPE_DIR = { left = true, right = true }

local function IsBlockedPair(identifierA, identifierB)
    local ok, blocked = pcall(function()
        return exports[GetCurrentResourceName()]:IsBlockedEither(identifierA, identifierB, '', '')
    end)
    return ok and blocked == true
end

local function SanitizeJsonArray(value, maxItems, itemMaxLen, sanitizeFn)
    if type(value) ~= 'table' then return '[]' end
    local result = {}
    for i = 1, math.min(#value, maxItems) do
        local item = sanitizeFn(value[i], itemMaxLen)
        if item and item ~= '' then result[#result + 1] = item end
    end
    return json.encode(result)
end

local function ValidateGender(value)
    local g = SafeString(value, 10)
    if g and VALID_GENDERS[g] then return g end
    return nil
end

local function ValidateLookingFor(value)
    local l = SafeString(value, 10)
    if l and VALID_LOOKING_FOR[l] then return l end
    return nil
end

local function ValidateAge(value)
    local age = tonumber(value)
    if not age then return nil end
    age = math.floor(age)
    if age < 18 or age > 99 then return nil end
    return age
end

local function ParseProfileRow(row)
    if not row then return nil end
    if type(row.photos) == 'string' and row.photos ~= '' then
        row.photos = json.decode(row.photos) or {}
    elseif type(row.photos) ~= 'table' then
        row.photos = {}
    end
    if type(row.interests) == 'string' and row.interests ~= '' then
        row.interests = json.decode(row.interests) or {}
    elseif type(row.interests) ~= 'table' then
        row.interests = {}
    end
    return row
end

-- Get own profile
lib.callback.register('gcphone:matchmylove:getProfile', function(source)
    local identifier = GetIdentifier(source)
    if not identifier then return nil end

    local row = MySQL.single.await(
        'SELECT * FROM phone_matchmylove_profiles WHERE identifier = ? LIMIT 1',
        { identifier }
    )
    return ParseProfileRow(row)
end)

-- Create profile
lib.callback.register('gcphone:matchmylove:createProfile', function(source, data)
    if IsPhoneReadOnly(source) then return false, 'READ_ONLY' end
    if HitRateLimit(source, 'mml_create', 3000, 1) then return false, 'RATE_LIMITED' end
    local identifier = GetIdentifier(source)
    if not identifier then return false, 'NOT_AUTHENTICATED' end
    if type(data) ~= 'table' then return false, 'INVALID_DATA' end

    -- Check if profile already exists
    local existing = MySQL.scalar.await(
        'SELECT id FROM phone_matchmylove_profiles WHERE identifier = ? LIMIT 1',
        { identifier }
    )
    if existing then return false, 'PROFILE_EXISTS' end

    local displayName = SanitizeText(data.display_name, 30)
    if displayName == '' then return false, 'NAME_REQUIRED' end

    local age = ValidateAge(data.age)
    if not age then return false, 'INVALID_AGE' end

    local bio = SanitizeText(data.bio, 500)
    local avatar = SanitizeMediaUrl(data.avatar)
    local gender = ValidateGender(data.gender)
    if not gender then return false, 'INVALID_GENDER' end

    local lookingFor = ValidateLookingFor(data.looking_for)
    if not lookingFor then return false, 'INVALID_LOOKING_FOR' end

    local photos = SanitizeJsonArray(
        type(data.photos) == 'table' and data.photos or {},
        6, 500, function(v) return SanitizeMediaUrl(v) or '' end
    )

    local interests = SanitizeJsonArray(
        type(data.interests) == 'table' and data.interests or {},
        10, 30, function(v, m) return SanitizeText(v, m) end
    )

    local profileId = MySQL.insert.await([[
        INSERT INTO phone_matchmylove_profiles
        (identifier, display_name, age, bio, avatar, photos, interests, gender, looking_for, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    ]], {
        identifier, displayName, age,
        bio ~= '' and bio or nil,
        avatar,
        photos, interests,
        gender, lookingFor
    })

    local profile = MySQL.single.await(
        'SELECT * FROM phone_matchmylove_profiles WHERE id = ?',
        { profileId }
    )
    return true, ParseProfileRow(profile)
end)

-- Update profile
lib.callback.register('gcphone:matchmylove:updateProfile', function(source, data)
    if IsPhoneReadOnly(source) then return false, 'READ_ONLY' end
    if HitRateLimit(source, 'mml_update', 3000, 1) then return false, 'RATE_LIMITED' end
    local identifier = GetIdentifier(source)
    if not identifier then return false, 'NOT_AUTHENTICATED' end
    if type(data) ~= 'table' then return false, 'INVALID_DATA' end

    local existing = MySQL.single.await(
        'SELECT id FROM phone_matchmylove_profiles WHERE identifier = ? LIMIT 1',
        { identifier }
    )
    if not existing then return false, 'NO_PROFILE' end

    local displayName = SanitizeText(data.display_name, 30)
    if displayName == '' then return false, 'NAME_REQUIRED' end

    local age = ValidateAge(data.age)
    if not age then return false, 'INVALID_AGE' end

    local bio = SanitizeText(data.bio, 500)
    local avatar = SanitizeMediaUrl(data.avatar)
    local gender = ValidateGender(data.gender)
    if not gender then return false, 'INVALID_GENDER' end

    local lookingFor = ValidateLookingFor(data.looking_for)
    if not lookingFor then return false, 'INVALID_LOOKING_FOR' end

    local photos = SanitizeJsonArray(
        type(data.photos) == 'table' and data.photos or {},
        6, 500, function(v) return SanitizeMediaUrl(v) or '' end
    )

    local interests = SanitizeJsonArray(
        type(data.interests) == 'table' and data.interests or {},
        10, 30, function(v, m) return SanitizeText(v, m) end
    )

    MySQL.update.await([[
        UPDATE phone_matchmylove_profiles
        SET display_name = ?, age = ?, bio = ?, avatar = ?, photos = ?,
            interests = ?, gender = ?, looking_for = ?
        WHERE identifier = ?
    ]], {
        displayName, age,
        bio ~= '' and bio or nil,
        avatar,
        photos, interests,
        gender, lookingFor,
        identifier
    })

    local profile = MySQL.single.await(
        'SELECT * FROM phone_matchmylove_profiles WHERE identifier = ? LIMIT 1',
        { identifier }
    )
    return true, ParseProfileRow(profile)
end)

-- Delete profile
lib.callback.register('gcphone:matchmylove:deleteProfile', function(source)
    if IsPhoneReadOnly(source) then return false, 'READ_ONLY' end
    if HitRateLimit(source, 'mml_delete', 3000, 1) then return false, 'RATE_LIMITED' end
    local identifier = GetIdentifier(source)
    if not identifier then return false, 'NOT_AUTHENTICATED' end

    local existing = MySQL.scalar.await(
        'SELECT id FROM phone_matchmylove_profiles WHERE identifier = ? LIMIT 1',
        { identifier }
    )
    if not existing then return false, 'NO_PROFILE' end

    -- Delete messages in matches where this user is a participant
    MySQL.query.await([[
        DELETE mm FROM phone_matchmylove_messages mm
        INNER JOIN phone_matchmylove_matches m ON mm.match_id = m.id
        WHERE m.profile_a_id = ? OR m.profile_b_id = ?
    ]], { identifier, identifier })

    -- Delete matches
    MySQL.execute.await(
        'DELETE FROM phone_matchmylove_matches WHERE profile_a_id = ? OR profile_b_id = ?',
        { identifier, identifier }
    )

    -- Delete swipes
    MySQL.execute.await(
        'DELETE FROM phone_matchmylove_swipes WHERE swiper_id = ? OR target_id = ?',
        { identifier, identifier }
    )

    -- Delete profile
    MySQL.execute.await(
        'DELETE FROM phone_matchmylove_profiles WHERE identifier = ?',
        { identifier }
    )

    return true
end)

-- Get unswiped cards
lib.callback.register('gcphone:matchmylove:getCards', function(source)
    local identifier = GetIdentifier(source)
    if not identifier then return {} end

    local myProfile = MySQL.single.await(
        'SELECT looking_for, gender FROM phone_matchmylove_profiles WHERE identifier = ? AND is_active = 1 LIMIT 1',
        { identifier }
    )
    if not myProfile then return {} end

    local cards = MySQL.query.await([[
        SELECT p.* FROM phone_matchmylove_profiles p
        WHERE p.identifier != ?
          AND p.is_active = 1
          AND p.identifier NOT IN (
            SELECT target_id FROM phone_matchmylove_swipes WHERE swiper_id = ?
          )
          AND p.identifier NOT IN (
            SELECT identifier FROM phone_user_blocks WHERE target_identifier = ?
            UNION
            SELECT target_identifier FROM phone_user_blocks WHERE identifier = ?
          )
        ORDER BY RAND()
        LIMIT 10
    ]], { identifier, identifier, identifier, identifier })

    if not cards then return {} end

    local result = {}
    for _, card in ipairs(cards) do
        if not IsBlockedPair(identifier, card.identifier) then
            result[#result + 1] = ParseProfileRow(card)
        end
    end

    return result
end)

-- Swipe on a profile
lib.callback.register('gcphone:matchmylove:swipe', function(source, data)
    if IsPhoneReadOnly(source) then return false, 'READ_ONLY' end
    if HitRateLimit(source, 'mml_swipe', 500, 1) then return false, 'RATE_LIMITED' end
    local identifier = GetIdentifier(source)
    if not identifier then return false, 'NOT_AUTHENTICATED' end
    if type(data) ~= 'table' then return false, 'INVALID_DATA' end

    local targetId = SafeString(data.targetId, 64)
    if not targetId then return false, 'INVALID_TARGET' end

    local direction = SafeString(data.direction, 10)
    if not direction or not VALID_SWIPE_DIR[direction] then return false, 'INVALID_DIRECTION' end

    if targetId == identifier then return false, 'INVALID_TARGET' end

    -- Verify target profile exists and is active
    local targetExists = MySQL.scalar.await(
        'SELECT id FROM phone_matchmylove_profiles WHERE identifier = ? AND is_active = 1 LIMIT 1',
        { targetId }
    )
    if not targetExists then return false, 'TARGET_NOT_FOUND' end

    -- Verify we haven't already swiped
    local alreadySwiped = MySQL.scalar.await(
        'SELECT id FROM phone_matchmylove_swipes WHERE swiper_id = ? AND target_id = ? LIMIT 1',
        { identifier, targetId }
    )
    if alreadySwiped then return false, 'ALREADY_SWIPED' end

    -- Insert the swipe
    MySQL.insert.await(
        'INSERT INTO phone_matchmylove_swipes (swiper_id, target_id, direction) VALUES (?, ?, ?)',
        { identifier, targetId, direction }
    )

    -- Check for mutual match on right swipe
    if direction == 'right' then
        local mutual = MySQL.scalar.await(
            'SELECT 1 FROM phone_matchmylove_swipes WHERE swiper_id = ? AND target_id = ? AND direction = ? LIMIT 1',
            { targetId, identifier, 'right' }
        )

        if mutual then
            local matchId = MySQL.insert.await([[
                INSERT INTO phone_matchmylove_matches (profile_a_id, profile_b_id)
                VALUES (LEAST(?, ?), GREATEST(?, ?))
            ]], { identifier, targetId, identifier, targetId })

            -- Notify both players
            local myProfile = MySQL.single.await(
                'SELECT display_name FROM phone_matchmylove_profiles WHERE identifier = ? LIMIT 1',
                { identifier }
            )
            local targetProfile = MySQL.single.await(
                'SELECT display_name FROM phone_matchmylove_profiles WHERE identifier = ? LIMIT 1',
                { targetId }
            )

            local myName = myProfile and myProfile.display_name or 'Alguien'
            local targetName = targetProfile and targetProfile.display_name or 'Alguien'

            TriggerClientEvent('gcphone:notify', source, {
                appId = 'matchmylove',
                title = 'MatchMyLove',
                message = 'Hiciste match con ' .. targetName .. '!',
                priority = 'normal'
            })

            local targetSource = GetSourceFromIdentifier(targetId)
            if targetSource then
                TriggerClientEvent('gcphone:notify', targetSource, {
                    appId = 'matchmylove',
                    title = 'MatchMyLove',
                    message = 'Hiciste match con ' .. myName .. '!',
                    priority = 'normal'
                })
            end

            return true, { matched = true, matchId = matchId }
        end
    end

    return true, { matched = false, matchId = nil }
end)

-- Get matches with profile info and last message
lib.callback.register('gcphone:matchmylove:getMatches', function(source)
    local identifier = GetIdentifier(source)
    if not identifier then return {} end

    local matches = MySQL.query.await([[
        SELECT
            m.id AS match_id,
            m.created_at AS matched_at,
            CASE
                WHEN m.profile_a_id = ? THEN m.profile_b_id
                ELSE m.profile_a_id
            END AS other_identifier,
            p.display_name,
            p.age,
            p.avatar,
            p.bio,
            lm.content AS last_message,
            lm.created_at AS last_message_at,
            lm.sender_id AS last_message_sender
        FROM phone_matchmylove_matches m
        INNER JOIN phone_matchmylove_profiles p
            ON p.identifier = CASE
                WHEN m.profile_a_id = ? THEN m.profile_b_id
                ELSE m.profile_a_id
            END
        LEFT JOIN phone_matchmylove_messages lm
            ON lm.match_id = m.id
            AND lm.id = (
                SELECT MAX(lm2.id) FROM phone_matchmylove_messages lm2
                WHERE lm2.match_id = m.id
            )
        WHERE m.profile_a_id = ? OR m.profile_b_id = ?
        ORDER BY COALESCE(lm.created_at, m.created_at) DESC
    ]], { identifier, identifier, identifier, identifier })

    return matches or {}
end)

-- Get messages for a match
lib.callback.register('gcphone:matchmylove:getMessages', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return {} end
    if type(data) ~= 'table' then return {} end

    local matchId = tonumber(data.matchId)
    if not matchId or matchId < 1 then return {} end

    local offset = tonumber(data.offset) or 0
    if offset < 0 then offset = 0 end

    -- Validate user is participant
    local match = MySQL.single.await(
        'SELECT id FROM phone_matchmylove_matches WHERE id = ? AND (profile_a_id = ? OR profile_b_id = ?) LIMIT 1',
        { matchId, identifier, identifier }
    )
    if not match then return {} end

    return MySQL.query.await([[
        SELECT id, match_id, sender_id, content, created_at
        FROM phone_matchmylove_messages
        WHERE match_id = ?
        ORDER BY created_at ASC
        LIMIT 50 OFFSET ?
    ]], { matchId, offset }) or {}
end)

-- Send message in a match
lib.callback.register('gcphone:matchmylove:sendMessage', function(source, data)
    if IsPhoneReadOnly(source) then return false, 'READ_ONLY' end
    if HitRateLimit(source, 'mml_msg', 700, 1) then return false, 'RATE_LIMITED' end
    local identifier = GetIdentifier(source)
    if not identifier then return false, 'NOT_AUTHENTICATED' end
    if type(data) ~= 'table' then return false, 'INVALID_DATA' end

    local matchId = tonumber(data.matchId)
    if not matchId or matchId < 1 then return false, 'INVALID_MATCH' end

    local content = SanitizeText(data.content, 500)
    if content == '' then return false, 'EMPTY_MESSAGE' end

    -- Validate user is participant and get match info
    local match = MySQL.single.await(
        'SELECT id, profile_a_id, profile_b_id FROM phone_matchmylove_matches WHERE id = ? AND (profile_a_id = ? OR profile_b_id = ?) LIMIT 1',
        { matchId, identifier, identifier }
    )
    if not match then return false, 'NOT_PARTICIPANT' end

    local messageId = MySQL.insert.await(
        'INSERT INTO phone_matchmylove_messages (match_id, sender_id, content) VALUES (?, ?, ?)',
        { matchId, identifier, content }
    )

    local message = MySQL.single.await(
        'SELECT id, match_id, sender_id, content, created_at FROM phone_matchmylove_messages WHERE id = ?',
        { messageId }
    )

    -- Notify the other person
    local otherId = match.profile_a_id == identifier and match.profile_b_id or match.profile_a_id
    local otherSource = GetSourceFromIdentifier(otherId)
    if otherSource then
        local myProfile = MySQL.single.await(
            'SELECT display_name FROM phone_matchmylove_profiles WHERE identifier = ? LIMIT 1',
            { identifier }
        )
        local senderName = myProfile and myProfile.display_name or 'Match'

        TriggerClientEvent('gcphone:notify', otherSource, {
            appId = 'matchmylove',
            title = senderName,
            message = content:sub(1, 80),
            priority = 'normal'
        })

        -- Push the message to the other client in real-time
        TriggerClientEvent('gcphone:matchmylove:newMessage', otherSource, message)
    end

    return true, message
end)

-- Unmatch
lib.callback.register('gcphone:matchmylove:unmatch', function(source, data)
    if IsPhoneReadOnly(source) then return false, 'READ_ONLY' end
    if HitRateLimit(source, 'mml_unmatch', 3000, 1) then return false, 'RATE_LIMITED' end
    local identifier = GetIdentifier(source)
    if not identifier then return false, 'NOT_AUTHENTICATED' end

    local matchId = tonumber(type(data) == 'table' and data.matchId or data)
    if not matchId or matchId < 1 then return false, 'INVALID_MATCH' end

    -- Validate user is participant
    local match = MySQL.single.await(
        'SELECT id FROM phone_matchmylove_matches WHERE id = ? AND (profile_a_id = ? OR profile_b_id = ?) LIMIT 1',
        { matchId, identifier, identifier }
    )
    if not match then return false, 'NOT_PARTICIPANT' end

    -- Delete messages first
    MySQL.execute.await(
        'DELETE FROM phone_matchmylove_messages WHERE match_id = ?',
        { matchId }
    )

    -- Delete the match
    MySQL.execute.await(
        'DELETE FROM phone_matchmylove_matches WHERE id = ?',
        { matchId }
    )

    return true
end)

-- ── Socket server integration ──

-- Validate that an identifier belongs to a match (called by socket server)
RegisterNetEvent('gcphone:matchmylove:validateMatch', function(requestId, identifier, matchId)
    local id = tonumber(requestId) or 0
    local safeIdentifier = SafeString(identifier, 80)
    local safeMatchId = tonumber(matchId)

    if not safeIdentifier or not safeMatchId or safeMatchId < 1 then
        emit('gcphone:matchmylove:validateMatchResult', id, false)
        return
    end

    local match = MySQL.scalar.await(
        'SELECT 1 FROM phone_matchmylove_matches WHERE id = ? AND (profile_a_id = ? OR profile_b_id = ?) LIMIT 1',
        { safeMatchId, safeIdentifier, safeIdentifier }
    )

    emit('gcphone:matchmylove:validateMatchResult', id, match ~= nil)
end)

-- Persist batch of chat messages (called by socket server)
RegisterNetEvent('gcphone:matchmylove:persistBatch', function(requestId, batch)
    local id = tonumber(requestId) or 0
    if type(batch) ~= 'table' or #batch == 0 then
        emit('gcphone:matchmylove:persistBatchResult', id, false, 0, 'EMPTY_BATCH')
        return
    end

    local count = 0
    for _, entry in ipairs(batch) do
        local matchId = tonumber(entry.matchId)
        local senderIdentifier = SafeString(entry.senderIdentifier, 80)
        local content = SanitizeText(entry.content, 500)

        if matchId and matchId > 0 and senderIdentifier and content ~= '' then
            pcall(function()
                MySQL.insert.await(
                    'INSERT INTO phone_matchmylove_messages (match_id, sender_id, content) VALUES (?, ?, ?)',
                    { matchId, senderIdentifier, content }
                )
                count = count + 1
            end)
        end
    end

    emit('gcphone:matchmylove:persistBatchResult', id, true, count, '')
end)
