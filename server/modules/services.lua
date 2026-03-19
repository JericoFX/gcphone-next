-- Creado/Modificado por JericoFX
-- Services - Backend

local Utils = GcPhoneUtils
local function SafeString(v, m) return Utils.SafeString(v, m) end
local function SanitizeText(v, m) return Utils.SanitizeText(v, m, true) end
local function SanitizeMediaUrl(v) return Utils.SanitizeMediaUrl(v, {'.png','.jpg','.jpeg','.webp','.gif'}, 500) end
local function HitRateLimit(s, k, w, m) return Utils.HitRateLimit(s, k, w, m) end

local ALLOWED_CATEGORIES = {
    mechanic = true,
    lawyer = true,
    doctor = true,
    taxi = true,
    delivery = true,
    security = true,
    realtor = true,
    other = true,
}

local ALLOWED_AVAILABILITY = {
    online = true,
    offline = true,
    busy = true,
}

-- Get categories
lib.callback.register('gcphone:services:getCategories', function(source)
    return {
        { id = 'all', name = 'Todos', icon = 'list' },
        { id = 'mechanic', name = 'Mecanico', icon = 'wrench' },
        { id = 'lawyer', name = 'Abogado', icon = 'briefcase' },
        { id = 'doctor', name = 'Doctor', icon = 'heart' },
        { id = 'taxi', name = 'Taxi', icon = 'car' },
        { id = 'delivery', name = 'Delivery', icon = 'package' },
        { id = 'security', name = 'Seguridad', icon = 'shield' },
        { id = 'realtor', name = 'Inmobiliaria', icon = 'home' },
        { id = 'other', name = 'Otro', icon = 'dots' },
    }
end)

-- Get listings
lib.callback.register('gcphone:services:getListings', function(source, data)
    if HitRateLimit(source, 'svc_listings', 1500, 4) then return {} end

    data = type(data) == 'table' and data or {}
    local category = data.category or 'all'
    local search = data.search or ''
    local limit = tonumber(data.limit) or 50
    local offset = tonumber(data.offset) or 0

    if limit < 1 then limit = 1 end
    if limit > 100 then limit = 100 end
    if offset < 0 then offset = 0 end

    local sql = [[
        SELECT s.id, s.identifier, s.phone_number, s.display_name, s.avatar,
               s.category, s.description, s.availability,
               s.rating_sum, s.rating_count,
               s.rating,
               s.created_at
        FROM phone_services s
        WHERE s.is_active = 1
    ]]
    local params = {}

    if category ~= 'all' and category ~= '' then
        sql = sql .. " AND s.category = ?"
        params[#params + 1] = category
    end

    if search ~= '' then
        sql = sql .. " AND (s.display_name LIKE ? OR s.description LIKE ?)"
        params[#params + 1] = '%' .. search .. '%'
        params[#params + 1] = '%' .. search .. '%'
    end

    sql = sql .. " ORDER BY s.availability = 'online' DESC, s.rating_count DESC, s.created_at DESC LIMIT ? OFFSET ?"
    params[#params + 1] = limit
    params[#params + 1] = offset

    return MySQL.query.await(sql, params) or {}
end)

-- Get my service
lib.callback.register('gcphone:services:getMyService', function(source)
    local identifier = GetIdentifier(source)
    if not identifier then return nil end

    return MySQL.single.await([[
        SELECT s.id, s.identifier, s.phone_number, s.display_name, s.avatar,
               s.category, s.description, s.availability,
               s.rating_sum, s.rating_count,
               s.rating,
               s.created_at
        FROM phone_services s
        WHERE s.identifier = ?
    ]], { identifier })
end)

-- Register service
lib.callback.register('gcphone:services:register', function(source, data)
    if IsPhoneReadOnly(source) then return false, 'READ_ONLY' end
    if HitRateLimit(source, 'svc_register', 5000, 1) then return false, 'RATE_LIMITED' end

    local identifier = GetIdentifier(source)
    if not identifier then return false, 'Not authenticated' end
    if type(data) ~= 'table' then return false, 'Invalid data' end

    local category = SanitizeText(data.category, 30)
    if not ALLOWED_CATEGORIES[category] then return false, 'Invalid category' end

    local displayName = SanitizeText(data.display_name, 60)
    if displayName == '' then return false, 'Display name required' end

    local description = SanitizeText(data.description, 500)
    local avatar = SanitizeMediaUrl(data.avatar)
    local phoneNumber = GetPhoneNumber(identifier) or ''

    -- Check if already registered
    local existing = MySQL.single.await('SELECT id FROM phone_services WHERE identifier = ?', { identifier })
    if existing then return false, 'Already registered' end

    local id = MySQL.insert.await([[
        INSERT INTO phone_services
        (identifier, phone_number, display_name, avatar, category, description, availability)
        VALUES (?, ?, ?, ?, ?, ?, 'offline')
    ]], {
        identifier,
        phoneNumber,
        displayName,
        avatar,
        category,
        description ~= '' and description or nil,
    })

    local service = MySQL.single.await([[
        SELECT s.id, s.identifier, s.phone_number, s.display_name, s.avatar,
               s.category, s.description, s.availability,
               s.rating_sum, s.rating_count, 0 as rating, s.created_at
        FROM phone_services s
        WHERE s.id = ?
    ]], { id })

    return true, service
end)

-- Update service
lib.callback.register('gcphone:services:updateService', function(source, data)
    if IsPhoneReadOnly(source) then return false, 'READ_ONLY' end
    if HitRateLimit(source, 'svc_update', 3000, 2) then return false, 'RATE_LIMITED' end

    local identifier = GetIdentifier(source)
    if not identifier then return false, 'Not authenticated' end
    if type(data) ~= 'table' then return false, 'Invalid data' end

    local category = SanitizeText(data.category, 30)
    if category ~= '' and not ALLOWED_CATEGORIES[category] then return false, 'Invalid category' end

    local displayName = SanitizeText(data.display_name, 60)
    if displayName == '' then return false, 'Display name required' end

    local description = SanitizeText(data.description, 500)
    local avatar = SanitizeMediaUrl(data.avatar)

    MySQL.update.await([[
        UPDATE phone_services
        SET display_name = ?, avatar = ?, category = ?, description = ?
        WHERE identifier = ?
    ]], {
        displayName,
        avatar,
        category ~= '' and category or 'other',
        description ~= '' and description or nil,
        identifier,
    })

    return true
end)

-- Set availability
lib.callback.register('gcphone:services:setAvailability', function(source, data)
    if IsPhoneReadOnly(source) then return false, 'READ_ONLY' end

    local identifier = GetIdentifier(source)
    if not identifier then return false end

    local availability = type(data) == 'table' and data.availability or data
    if type(availability) ~= 'string' or not ALLOWED_AVAILABILITY[availability] then
        return false, 'Invalid availability'
    end

    MySQL.update.await('UPDATE phone_services SET availability = ? WHERE identifier = ?', { availability, identifier })
    return true
end)

-- Delete service
lib.callback.register('gcphone:services:deleteService', function(source)
    if IsPhoneReadOnly(source) then return false end
    if HitRateLimit(source, 'svc_delete', 5000, 1) then return false end

    local identifier = GetIdentifier(source)
    if not identifier then return false end

    MySQL.execute.await('DELETE FROM phone_services WHERE identifier = ?', { identifier })
    return true
end)

-- Get worker info
lib.callback.register('gcphone:services:getWorkerInfo', function(source, serviceId)
    local id = tonumber(serviceId)
    if not id then return nil end

    return MySQL.single.await([[
        SELECT s.id, s.phone_number, s.display_name, s.avatar,
               s.category, s.description, s.availability,
               s.rating_sum, s.rating_count, s.rating
        FROM phone_services s
        WHERE s.id = ? AND s.is_active = 1
    ]], { id })
end)

-- Rate worker
lib.callback.register('gcphone:services:rateWorker', function(source, data)
    if IsPhoneReadOnly(source) then return false, 'READ_ONLY' end
    if HitRateLimit(source, 'svc_rate', 3000, 2) then return false, 'RATE_LIMITED' end

    local identifier = GetIdentifier(source)
    if not identifier then return false, 'Not authenticated' end
    if type(data) ~= 'table' then return false, 'Invalid data' end

    local serviceId = tonumber(data.service_id)
    local score = tonumber(data.score)

    if not serviceId or not score then return false, 'Missing fields' end
    if score < 1 or score > 5 then return false, 'Invalid score' end
    score = math.floor(score)

    -- Cannot rate self
    local service = MySQL.single.await('SELECT identifier FROM phone_services WHERE id = ?', { serviceId })
    if not service then return false, 'Service not found' end
    if service.identifier == identifier then return false, 'Cannot rate self' end

    -- Check blocked
    local myNumber = GetPhoneNumber(identifier)
    local targetNumber = GetPhoneNumber(service.identifier)
    if myNumber and targetNumber then
        local ok, blocked = pcall(function()
            return exports[GetCurrentResourceName()]:IsBlockedEither(identifier, service.identifier, myNumber, targetNumber)
        end)
        if ok and blocked then return false, 'Blocked' end
    end

    -- Check if already rated, get old score
    local existing = MySQL.single.await(
        'SELECT score FROM phone_services_ratings WHERE service_id = ? AND rater_identifier = ?',
        { serviceId, identifier }
    )

    if existing then
        MySQL.execute.await(
            'UPDATE phone_services_ratings SET score = ? WHERE service_id = ? AND rater_identifier = ?',
            { score, serviceId, identifier }
        )
    else
        MySQL.insert.await([[
            INSERT INTO phone_services_ratings (service_id, rater_identifier, score)
            VALUES (?, ?, ?)
        ]], { serviceId, identifier, score })
    end

    return true
end)

-- Get worker ratings
lib.callback.register('gcphone:services:getWorkerRatings', function(source, data)
    data = type(data) == 'table' and data or {}
    local serviceId = tonumber(data.service_id)
    if not serviceId then return {} end

    local limit = tonumber(data.limit) or 20
    if limit < 1 then limit = 1 end
    if limit > 50 then limit = 50 end

    return MySQL.query.await([[
        SELECT r.score, r.created_at
        FROM phone_services_ratings r
        WHERE r.service_id = ?
        ORDER BY r.created_at DESC
        LIMIT ?
    ]], { serviceId, limit }) or {}
end)
