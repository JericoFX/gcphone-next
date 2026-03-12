-- Creado/Modificado por JericoFX

local PICKUP_DISTANCE = 2.0
local DISCOVERY_DISTANCE = 25.0
local SecurityResource = GetCurrentResourceName()
local droppedPhones = {}

local function HitRateLimit(source, key, windowMs, maxHits)
    local ok, blocked = pcall(function()
        return exports[SecurityResource]:HitRateLimit(source, key, windowMs, maxHits)
    end)

    if not ok then return false end
    return blocked == true
end

local function GetPlayerCoords(source)
    local ped = GetPlayerPed(source)
    if not ped or ped <= 0 then return nil end

    local coords = GetEntityCoords(ped)
    if not coords then return nil end

    return coords
end

local function IsWithinDropDistance(source, payload, maxDistance)
    if not payload or not payload.coords then return false, nil end

    local coords = GetPlayerCoords(source)
    if not coords then return false, nil end

    local dx = coords.x - payload.coords.x
    local dy = coords.y - payload.coords.y
    local dz = coords.z - payload.coords.z
    local distance = math.sqrt((dx * dx) + (dy * dy) + (dz * dz))

    return distance <= (maxDistance or PICKUP_DISTANCE), distance
end

local function BuildDroppedPhonePayload(row)
    if not row or not row.phone_id then return nil end

    local x = tonumber(row.coords_x)
    local y = tonumber(row.coords_y)
    local z = tonumber(row.coords_z)

    if not x or not y or not z then return nil end

    return {
        phoneId = tostring(row.phone_id),
        coords = { x = x, y = y, z = z }
    }
end

local function LoadDroppedPhones()
    local rows = MySQL.query.await(
        'SELECT phone_id, coords_x, coords_y, coords_z FROM phone_dropped WHERE picked_up = 0'
    ) or {}

    droppedPhones = {}

    for i = 1, #rows do
        local payload = BuildDroppedPhonePayload(rows[i])
        if payload then
            droppedPhones[payload.phoneId] = payload
        end
    end
end

LoadDroppedPhones()

local function SafeText(value, maxLen)
    if type(value) ~= 'string' then return '' end
    local text = value:gsub('[%z\1-\31\127]', '')
    text = text:gsub('<.->', '')
    text = text:gsub('^%s+', ''):gsub('%s+$', '')
    return text:sub(1, maxLen or 120)
end

local function BuildForensicReport(ownerIdentifier, phoneNumber, imei)
    local lines = {}
    lines[#lines + 1] = ('IMEI: %s'):format(imei or 'N/A')
    lines[#lines + 1] = ('Numero: %s'):format(phoneNumber or 'N/A')

    local contacts = MySQL.query.await(
        'SELECT display, number FROM phone_contacts WHERE identifier = ? ORDER BY favorite DESC, id DESC LIMIT 6',
        { ownerIdentifier }
    ) or {}
    lines[#lines + 1] = ('Contactos: %d'):format(#contacts)
    for i = 1, #contacts do
        local row = contacts[i]
        lines[#lines + 1] = ('  - %s (%s)'):format(SafeText(row.display, 40), SafeText(row.number, 20))
    end

    local messages = MySQL.query.await(
        'SELECT transmitter, receiver, message, time FROM phone_messages WHERE transmitter = ? OR receiver = ? ORDER BY time DESC LIMIT 8',
        { phoneNumber, phoneNumber }
    ) or {}
    lines[#lines + 1] = ('Mensajes recientes: %d'):format(#messages)
    for i = 1, #messages do
        local row = messages[i]
        local snippet = SafeText(row.message, 70)
        lines[#lines + 1] = ('  - [%s] %s -> %s: %s'):format(
            tostring(row.time or ''),
            SafeText(row.transmitter, 20),
            SafeText(row.receiver, 20),
            snippet
        )
    end

    local calls = MySQL.query.await(
        'SELECT num, incoming, accepts, duration, time FROM phone_calls WHERE owner = ? ORDER BY time DESC LIMIT 8',
        { phoneNumber }
    ) or {}
    lines[#lines + 1] = ('Llamadas recientes: %d'):format(#calls)
    for i = 1, #calls do
        local row = calls[i]
        local dir = tonumber(row.incoming) == 1 and 'Entrante' or 'Saliente'
        local accepted = tonumber(row.accepts) == 1 and 'Atendida' or 'Perdida'
        lines[#lines + 1] = ('  - [%s] %s %s (%ss)'):format(tostring(row.time or ''), dir, accepted, tonumber(row.duration) or 0)
        lines[#lines + 1] = ('    Num: %s'):format(SafeText(row.num, 20))
    end

    local gallery = MySQL.query.await(
        'SELECT url, type, created_at FROM phone_gallery WHERE identifier = ? ORDER BY id DESC LIMIT 6',
        { ownerIdentifier }
    ) or {}
    lines[#lines + 1] = ('Galeria recientes: %d'):format(#gallery)
    for i = 1, #gallery do
        local row = gallery[i]
        lines[#lines + 1] = ('  - [%s] %s %s'):format(tostring(row.created_at or ''), SafeText(row.type or 'image', 10), SafeText(row.url or '', 80))
    end

    local docs = MySQL.query.await(
        'SELECT title, updated_at FROM phone_documents WHERE identifier = ? ORDER BY id DESC LIMIT 6',
        { ownerIdentifier }
    ) or {}
    lines[#lines + 1] = ('Documentos: %d'):format(#docs)
    for i = 1, #docs do
        local row = docs[i]
        lines[#lines + 1] = ('  - [%s] %s'):format(tostring(row.updated_at or ''), SafeText(row.title or 'Documento', 60))
    end

    local wallet = MySQL.single.await(
        'SELECT balance FROM phone_wallets WHERE identifier = ? LIMIT 1',
        { ownerIdentifier }
    )
    lines[#lines + 1] = ('Wallet balance: $%d'):format(tonumber(wallet and wallet.balance) or 0)

    return table.concat(lines, '\n')
end

local function ResolveOwnerName(ownerIdentifier)
    local ownerName = 'Desconocido'
    local playerResult = MySQL.single.await(
        'SELECT charinfo FROM players WHERE citizenid = ?',
        { ownerIdentifier }
    )

    if playerResult and playerResult.charinfo then
        local charinfo = json.decode(playerResult.charinfo)
        if charinfo and charinfo.firstname and charinfo.lastname then
            ownerName = charinfo.firstname .. ' ' .. charinfo.lastname
        end
    end

    return ownerName
end

lib.callback.register('gcphone:dropPhone', function(source)
    local identifier = GetIdentifier(source)
    if not identifier then
        return { success = false, error = 'INVALID_SOURCE' }
    end

    local ped = GetPlayerPed(source)
    if not ped then
        return { success = false, error = 'PLAYER_NOT_FOUND' }
    end

    local coords = GetEntityCoords(ped)
    if not coords then
        return { success = false, error = 'COORDS_ERROR' }
    end

    local phoneData = MySQL.single.await(
        'SELECT phone_number, imei FROM phone_numbers WHERE identifier = ?',
        { identifier }
    )

    if not phoneData then
        return { success = false, error = 'NO_PHONE' }
    end

    local phoneId = 'phone-' .. identifier .. '-' .. tostring(os.time())

    MySQL.insert.await(
        'INSERT INTO phone_dropped (phone_id, owner_identifier, phone_number, imei, coords_x, coords_y, coords_z) VALUES (?, ?, ?, ?, ?, ?, ?)',
        { phoneId, identifier, phoneData.phone_number, phoneData.imei, coords.x, coords.y, coords.z }
    )

    local payload = {
        phoneId = phoneId,
        coords = { x = coords.x, y = coords.y, z = coords.z }
    }

    droppedPhones[phoneId] = payload
    TriggerClientEvent('gcphone:phoneDropped', -1, payload)

    return {
        success = true,
        phoneId = phoneId,
        coords = payload.coords,
    }
end)

lib.callback.register('gcphone:getDroppedPhones', function(source)
    local list = {}

    for _, phoneData in pairs(droppedPhones) do
        local near = IsWithinDropDistance(source, phoneData, DISCOVERY_DISTANCE)
        if near then
            list[#list + 1] = phoneData
        end
    end

    return {
        success = true,
        phones = list,
    }
end)

lib.callback.register('gcphone:pickupPhone', function(source, data)
    local phoneId = data and data.phoneId
    if not phoneId then
        return { success = false, error = 'INVALID_PHONE_ID' }
    end

    local dropPayload = droppedPhones[phoneId]
    if not dropPayload then
        return { success = false, error = 'PHONE_NOT_FOUND' }
    end

    local near = IsWithinDropDistance(source, dropPayload, PICKUP_DISTANCE)
    if not near then
        return { success = false, error = 'TOO_FAR' }
    end

    local droppedPhone = MySQL.single.await(
        'SELECT owner_identifier, phone_number, imei FROM phone_dropped WHERE phone_id = ? AND picked_up = 0',
        { phoneId }
    )

    if not droppedPhone then
        return { success = false, error = 'PHONE_NOT_FOUND' }
    end

    local updated = MySQL.update.await(
        'UPDATE phone_dropped SET picked_up = 1 WHERE phone_id = ? AND picked_up = 0',
        { phoneId }
    )

    if not updated or updated < 1 then
        return { success = false, error = 'PHONE_NOT_FOUND' }
    end

    droppedPhones[phoneId] = nil
    TriggerClientEvent('gcphone:phonePickedUp', -1, phoneId)

    local ownerName = GetName(source) or 'Desconocido'

    return {
        success = true,
        phone = {
            owner = ownerName,
            phoneNumber = droppedPhone.phone_number,
            imei = droppedPhone.imei
        }
    }
end)

lib.callback.register('gcphone:getPhoneInfo', function(source, data)
    local phoneId = data and data.phoneId
    if not phoneId then
        return { success = false, error = 'INVALID_PHONE_ID' }
    end

    local dropPayload = droppedPhones[phoneId]
    if not dropPayload then
        return { success = false, error = 'PHONE_NOT_FOUND' }
    end

    local near = IsWithinDropDistance(source, dropPayload, PICKUP_DISTANCE)
    if not near then
        return { success = false, error = 'TOO_FAR' }
    end

    local droppedPhone = MySQL.single.await(
        'SELECT owner_identifier, phone_number, imei FROM phone_dropped WHERE phone_id = ? AND picked_up = 0',
        { phoneId }
    )

    if not droppedPhone then
        return { success = false, error = 'PHONE_NOT_FOUND' }
    end

    local ownerIdentifier = droppedPhone.owner_identifier
    local ownerName = ResolveOwnerName(ownerIdentifier)

    return {
        success = true,
        phone = {
            owner = ownerName,
            phoneNumber = droppedPhone.phone_number,
            imei = droppedPhone.imei
        }
    }
end)

lib.callback.register('gcphone:unlockDroppedPhone', function(source, data)
    local phoneId = type(data) == 'table' and data.phoneId or nil
    local pin = type(data) == 'table' and tostring(data.pin or '') or ''

    if not phoneId or phoneId == '' then
        return { success = false, error = 'INVALID_PHONE_ID' }
    end

    local dropPayload = droppedPhones[phoneId]
    if not dropPayload then
        return { success = false, error = 'PHONE_NOT_FOUND' }
    end

    local near = IsWithinDropDistance(source, dropPayload, PICKUP_DISTANCE)
    if not near then
        return { success = false, error = 'TOO_FAR' }
    end

    if not pin:match('^%d%d%d%d$') then
        return { success = false, error = 'INVALID_PIN_FORMAT' }
    end

    if HitRateLimit(source, 'drop_unlock_global', 1500, 3) then
        return { success = false, error = 'RATE_LIMITED' }
    end

    if HitRateLimit(source, 'drop_unlock:' .. tostring(phoneId), 30000, 5) then
        return { success = false, error = 'PIN_LOCKED' }
    end

    local droppedPhone = MySQL.single.await(
        'SELECT owner_identifier, phone_number, imei, dropped_at FROM phone_dropped WHERE phone_id = ? AND picked_up = 0',
        { phoneId }
    )

    if not droppedPhone then
        return { success = false, error = 'PHONE_NOT_FOUND' }
    end

    local unlocked, err = VerifyPhonePinForIdentifier(droppedPhone.owner_identifier, pin)
    if err == 'PHONE_NOT_FOUND' then
        return { success = false, error = 'PHONE_OWNER_NOT_FOUND' }
    end

    if not unlocked then
        return { success = false, error = 'INVALID_PIN' }
    end

    local ownerName = ResolveOwnerName(droppedPhone.owner_identifier)
    SetPhoneAccessContext(source, {
        mode = 'foreign-readonly',
        ownerIdentifier = droppedPhone.owner_identifier,
        phoneId = phoneId,
        ownerName = ownerName,
        readOnly = true,
    })

    local phone = GetPhoneRecordByIdentifier(droppedPhone.owner_identifier)
    local payload = phone and BuildPhonePayloadForSource(phone, source) or nil
    if payload then
        payload.useLockScreen = false
        payload.forceLockScreen = false
    end
    local report = BuildForensicReport(droppedPhone.owner_identifier, droppedPhone.phone_number, droppedPhone.imei)

    return {
        success = true,
        phone = {
            owner = ownerName,
            ownerIdentifier = droppedPhone.owner_identifier,
            phoneNumber = droppedPhone.phone_number,
            imei = droppedPhone.imei,
            droppedAt = droppedPhone.dropped_at,
        },
        payload = payload,
        report = report,
    }
end)
