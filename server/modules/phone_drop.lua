-- OPT-11: Phone Drop Server Module
-- Handles dropping and picking up phones

local PICKUP_DISTANCE = 2.0

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
