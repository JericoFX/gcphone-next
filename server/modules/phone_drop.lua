-- OPT-11: Phone Drop Server Module
-- Handles dropping and picking up phones

local PICKUP_DISTANCE = 2.0

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

    return {
        success = true,
        phoneId = phoneId,
        coords = { x = coords.x, y = coords.y, z = coords.z }
    }
end)

lib.callback.register('gcphone:pickupPhone', function(source, data)
    local phoneId = data and data.phoneId
    if not phoneId then
        return { success = false, error = 'INVALID_PHONE_ID' }
    end

    local droppedPhone = MySQL.single.await(
        'SELECT owner_identifier, phone_number, imei FROM phone_dropped WHERE phone_id = ? AND picked_up = 0',
        { phoneId }
    )

    if not droppedPhone then
        return { success = false, error = 'PHONE_NOT_FOUND' }
    end

    MySQL.update.await(
        'UPDATE phone_dropped SET picked_up = 1 WHERE phone_id = ?',
        { phoneId }
    )

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

    local droppedPhone = MySQL.single.await(
        'SELECT owner_identifier, phone_number, imei FROM phone_dropped WHERE phone_id = ? AND picked_up = 0',
        { phoneId }
    )

    if not droppedPhone then
        return { success = false, error = 'PHONE_NOT_FOUND' }
    end

    local ownerIdentifier = droppedPhone.owner_identifier
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

    if not pin:match('^%d%d%d%d$') then
        return { success = false, error = 'INVALID_PIN_FORMAT' }
    end

    local droppedPhone = MySQL.single.await(
        'SELECT owner_identifier, phone_number, imei, dropped_at FROM phone_dropped WHERE phone_id = ? AND picked_up = 0',
        { phoneId }
    )

    if not droppedPhone then
        return { success = false, error = 'PHONE_NOT_FOUND' }
    end

    local ownerPhone = MySQL.single.await(
        'SELECT lock_code FROM phone_numbers WHERE identifier = ? LIMIT 1',
        { droppedPhone.owner_identifier }
    )

    if not ownerPhone then
        return { success = false, error = 'PHONE_OWNER_NOT_FOUND' }
    end

    if tostring(ownerPhone.lock_code or '') ~= pin then
        return { success = false, error = 'INVALID_PIN' }
    end

    local ownerName = 'Desconocido'
    local playerResult = MySQL.single.await(
        'SELECT charinfo FROM players WHERE citizenid = ?',
        { droppedPhone.owner_identifier }
    )

    if playerResult and playerResult.charinfo then
        local charinfo = json.decode(playerResult.charinfo)
        if charinfo and charinfo.firstname and charinfo.lastname then
            ownerName = charinfo.firstname .. ' ' .. charinfo.lastname
        end
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
        report = report,
    }
end)
