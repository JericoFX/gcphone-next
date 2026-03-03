-- Creado/Modificado por JericoFX

local function SanitizeText(value, maxLength)
    if type(value) ~= 'string' then return '' end
    local text = value:gsub('[%z\1-\31\127]', '')
    text = text:gsub('<.->', '')
    text = text:gsub('^%s+', ''):gsub('%s+$', '')
    return text:sub(1, maxLength or 300)
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

local function SanitizePhotos(value)
    if type(value) ~= 'table' then return {} end
    local photos = {}
    for _, raw in ipairs(value) do
        local photo = SanitizeMediaUrl(raw)
        if photo then
            photos[#photos + 1] = photo
        end
        if #photos >= 8 then break end
    end
    return photos
end

lib.callback.register('gcphone:market:getListings', function(source, data)
    data = type(data) == 'table' and data or {}
    local category = SanitizeText(data.category, 30)
    if category == '' then category = 'all' end
    local limit = tonumber(data.limit) or 50
    local offset = tonumber(data.offset) or 0
    if limit < 1 then limit = 1 end
    if limit > 100 then limit = 100 end
    if offset < 0 then offset = 0 end
    
    local listings
    
    if category == 'all' then
        listings = MySQL.query.await([[
            SELECT * FROM phone_market 
            WHERE status = 'active' AND (expires_at IS NULL OR expires_at > NOW())
            ORDER BY created_at DESC 
            LIMIT ? OFFSET ?
        ]], { limit, offset })
    else
        listings = MySQL.query.await([[
            SELECT * FROM phone_market 
            WHERE category = ? AND status = 'active' AND (expires_at IS NULL OR expires_at > NOW())
            ORDER BY created_at DESC 
            LIMIT ? OFFSET ?
        ]], { category, limit, offset })
    end
    
    return listings or {}
end)

lib.callback.register('gcphone:market:getMyListings', function(source)
    local identifier = GetIdentifier(source)
    if not identifier then return {} end
    
    return MySQL.query.await(
        'SELECT * FROM phone_market WHERE identifier = ? ORDER BY created_at DESC',
        { identifier }
    ) or {}
end)

lib.callback.register('gcphone:market:createListing', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false end

    if type(data) ~= 'table' then return false end
    
    local phoneNumber = GetPhoneNumber(identifier)
    if not phoneNumber then return false end
    
    local title = SanitizeText(data.title, 100)
    local description = SanitizeText(data.description, 1000)
    local category = SanitizeText(data.category, 30)
    local price = tonumber(data.price) or 0
    local photos = SanitizePhotos(data.photos)

    if title == '' or category == '' then
        return false, 'Invalid data'
    end

    if price < 0 then price = 0 end
    
    local listingCount = MySQL.scalar.await(
        'SELECT COUNT(*) FROM phone_market WHERE identifier = ? AND status = "active"',
        { identifier }
    ) or 0
    
    if listingCount >= Config.Market.MaxListings then
        return false, 'Maximum listings reached'
    end
    
    local expiresAt = os.time() + Config.Market.ListingDuration
    
    local listingId = MySQL.insert.await(
        'INSERT INTO phone_market (identifier, phone_number, title, description, price, category, photos, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, FROM_UNIXTIME(?))',
        { identifier, phoneNumber, title, description ~= '' and description or nil, price, category, json.encode(photos), expiresAt }
    )
    
    return true, listingId
end)

lib.callback.register('gcphone:market:updateListing', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false end

    if type(data) ~= 'table' then return false end

    local listingId = tonumber(data.id)
    if not listingId or listingId < 1 then return false end

    local title = SanitizeText(data.title, 100)
    local description = SanitizeText(data.description, 1000)
    local category = SanitizeText(data.category, 30)
    local price = tonumber(data.price) or 0
    local photos = SanitizePhotos(data.photos)
    if title == '' or category == '' then return false end
    if price < 0 then price = 0 end
    
    MySQL.update.await(
        'UPDATE phone_market SET title = ?, description = ?, price = ?, category = ?, photos = ? WHERE id = ? AND identifier = ?',
        { title, description ~= '' and description or nil, price, category, json.encode(photos), listingId, identifier }
    )
    
    return true
end)

lib.callback.register('gcphone:market:deleteListing', function(source, listingId)
    local identifier = GetIdentifier(source)
    if not identifier then return false end
    
    MySQL.execute.await(
        'DELETE FROM phone_market WHERE id = ? AND identifier = ?',
        { listingId, identifier }
    )
    
    return true
end)

lib.callback.register('gcphone:market:markAsSold', function(source, listingId)
    local identifier = GetIdentifier(source)
    if not identifier then return false end
    
    MySQL.update.await(
        'UPDATE phone_market SET status = "sold" WHERE id = ? AND identifier = ?',
        { listingId, identifier }
    )
    
    return true
end)

lib.callback.register('gcphone:market:contactSeller', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return false end
    
    local listing = MySQL.single.await(
        'SELECT * FROM phone_market WHERE id = ?',
        { data.listingId }
    )
    
    if not listing then return false end
    
    MySQL.update.await(
        'UPDATE phone_market SET views = views + 1 WHERE id = ?',
        { data.listingId }
    )
    
    return {
        phoneNumber = listing.phone_number
    }
end)

lib.callback.register('gcphone:market:getCategories', function(source)
    return Config.Market.Categories
end)
