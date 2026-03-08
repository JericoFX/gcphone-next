-- Creado/Modificado por JericoFX
-- YellowPages - Backend

local function SanitizeText(value, maxLength)
    if type(value) ~= 'string' then return '' end
    local text = value:gsub('[%z\1-\31\127]', '')
    text = text:gsub('<.->', '')
    text = text:gsub('^%s+', ''):gsub('%s+$', '')
    return text:sub(1, maxLength or 100)
end

local function SanitizeMediaUrl(value)
    if type(value) ~= 'string' then return nil end
    local url = value:gsub('[%z\1-\31\127]', '')
    url = url:gsub('^%s+', ''):gsub('%s+$', '')
    if url == '' then return nil end
    if not url:match('^https?://') then return nil end
    local base = (url:match('^[^?]+') or url):lower()
    local allowed = { '.png', '.jpg', '.jpeg', '.webp', '.gif' }
    for _, ext in ipairs(allowed) do
        if base:sub(-#ext) == ext then
            return url:sub(1, 500)
        end
    end
    return nil
end

local function GetPhoneNumber(identifier)
    if not identifier then return nil end
    local result = MySQL.single.await('SELECT phone_number FROM phone_numbers WHERE identifier = ?', { identifier })
    return result and result.phone_number or nil
end

-- Get all listings with seller info
lib.callback.register('gcphone:yellowpages:getListings', function(source, data)
    local identifier = GetIdentifier(source)
    data = type(data) == 'table' and data or {}
    local category = data.category or 'all'
    local search = data.search or ''
    local limit = tonumber(data.limit) or 50
    local offset = tonumber(data.offset) or 0
    
    if limit < 1 then limit = 1 end
    if limit > 100 then limit = 100 end
    if offset < 0 then offset = 0 end
    
    local sql = [[
        SELECT m.*, 
               CASE WHEN m.identifier = ? THEN 1 ELSE 0 END as is_own
        FROM phone_market m
        WHERE m.status = 'active'
    ]]
    local params = { identifier or '' }
    
    if category ~= 'all' and category ~= '' then
        sql = sql .. " AND m.category = ?"
        params[#params + 1] = category
    end
    
    if search ~= '' then
        sql = sql .. " AND (m.title LIKE ? OR m.description LIKE ?)"
        params[#params + 1] = '%' .. search .. '%'
        params[#params + 1] = '%' .. search .. '%'
    end
    
    sql = sql .. " ORDER BY m.created_at DESC LIMIT ? OFFSET ?"
    params[#params + 1] = limit
    params[#params + 1] = offset
    
    return MySQL.query.await(sql, params) or {}
end)

-- Get my listings
lib.callback.register('gcphone:yellowpages:getMyListings', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return {} end
    
    data = type(data) == 'table' and data or {}
    local limit = tonumber(data.limit) or 50
    local offset = tonumber(data.offset) or 0
    
    return MySQL.query.await([[
        SELECT m.*, 1 as is_own
        FROM phone_market m
        WHERE m.identifier = ?
        ORDER BY m.created_at DESC
        LIMIT ? OFFSET ?
    ]], { identifier, limit, offset }) or {}
end)

-- Create listing
lib.callback.register('gcphone:yellowpages:createListing', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false, 'Not authenticated' end
    
    if type(data) ~= 'table' then return false, 'Invalid data' end
    
    local title = SanitizeText(data.title, 100)
    local description = SanitizeText(data.description, 1000)
    local price = tonumber(data.price) or 0
    local category = SanitizeText(data.category, 30) or 'items'
    local photos = {}
    
    if type(data.photos) == 'table' then
        for _, url in ipairs(data.photos) do
            local clean = SanitizeMediaUrl(url)
            if clean then photos[#photos + 1] = clean end
        end
    elseif type(data.photos) == 'string' then
        local clean = SanitizeMediaUrl(data.photos)
        if clean then photos = { clean } end
    end
    
    if title == '' then return false, 'Title required' end
    
    local phoneNumber = GetPhoneNumber(identifier) or ''
    local playerName = GetName(source) or 'Usuario'
    
    local listingId = MySQL.insert.await([[
        INSERT INTO phone_market 
        (identifier, phone_number, seller_name, title, description, price, category, photos, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
    ]], { 
        identifier, 
        phoneNumber, 
        playerName,
        title, 
        description ~= '' and description or nil, 
        price, 
        category, 
        #photos > 0 and json.encode(photos) or nil 
    })
    
    local listing = MySQL.single.await([[
        SELECT m.*, 1 as is_own
        FROM phone_market m
        WHERE m.id = ?
    ]], { listingId })
    
    return true, listing
end)

-- Delete listing (only own)
lib.callback.register('gcphone:yellowpages:deleteListing', function(source, listingId)
    local identifier = GetIdentifier(source)
    if not identifier then return false end
    
    local id = tonumber(listingId)
    if not id then return false end
    
    MySQL.execute.await('DELETE FROM phone_market WHERE id = ? AND identifier = ?', { id, identifier })
    return true
end)

-- Get seller contact info
lib.callback.register('gcphone:yellowpages:getSellerInfo', function(source, listingId)
    local id = tonumber(listingId)
    if not id then return nil end
    
    local listing = MySQL.single.await([[
        SELECT identifier, phone_number, seller_name, seller_avatar, location_shared, location_x, location_y, location_z
        FROM phone_market
        WHERE id = ? AND status = 'active'
    ]], { id })
    
    if not listing then return nil end
    
    -- Increment views
    MySQL.update.await('UPDATE phone_market SET views = views + 1 WHERE id = ?', { id })
    
    return listing
end)

-- Record contact
lib.callback.register('gcphone:yellowpages:recordContact', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false end
    
    if type(data) ~= 'table' then return false end
    
    local listingId = tonumber(data.listingId)
    local sellerId = data.sellerId
    local contactType = data.contactType -- 'call' or 'message'
    
    if not listingId or not sellerId or not contactType then return false end
    
    MySQL.insert.await([[
        INSERT INTO phone_yellowpages_contacts (listing_id, buyer_identifier, seller_identifier, contact_type)
        VALUES (?, ?, ?, ?)
    ]], { listingId, identifier, sellerId, contactType })
    
    return true
end)

-- Share location for listing
lib.callback.register('gcphone:yellowpages:shareLocation', function(source, listingId)
    local identifier = GetIdentifier(source)
    if not identifier then return false end
    
    local id = tonumber(listingId)
    if not id then return false end
    
    local ped = GetPlayerPed(source)
    local coords = GetEntityCoords(ped)
    
    MySQL.update.await([[
        UPDATE phone_market 
        SET location_shared = 1, location_x = ?, location_y = ?, location_z = ?
        WHERE id = ? AND identifier = ?
    ]], { coords.x, coords.y, coords.z, id, identifier })
    
    return true
end)

-- Get categories
lib.callback.register('gcphone:yellowpages:getCategories', function(source)
    return {
        { id = 'all', name = 'Todos', icon = '📋' },
        { id = 'autos', name = 'Autos', icon = '🚗' },
        { id = 'properties', name = 'Propiedades', icon = '🏠' },
        { id = 'electronics', name = 'Electrónica', icon = '📱' },
        { id = 'services', name = 'Servicios', icon = '🔧' },
        { id = 'jobs', name = 'Trabajo', icon = '💼' },
        { id = 'items', name = 'Artículos', icon = '📦' },
        { id = 'other', name = 'Otros', icon = '📌' }
    }
end)
