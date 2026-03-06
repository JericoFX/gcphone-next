BaseCallback("backup:createBackup", function(source, phoneNumber)
  local identifier = GetIdentifier(source)
  local query = [[
    INSERT INTO phone_backups (id, phone_number) VALUES (@identifier, @phoneNumber)
    ON DUPLICATE KEY UPDATE phone_number = @phoneNumber
  ]]
  local params = {
    ["@identifier"] = identifier,
    ["@phoneNumber"] = phoneNumber,
  }
  local result = MySQL.update.await(query, params)
  return result > 0
end)

BaseCallback("backup:applyBackup", function(source, newPhoneNumber, backupPhoneNumber)
  local identifier = GetIdentifier(source)

  local exists = MySQL.scalar.await(
    "SELECT 1 FROM phone_backups WHERE id = ? AND phone_number = ?",
    { identifier, backupPhoneNumber }
  )

  if not exists or newPhoneNumber == backupPhoneNumber then
    return false
  end

  local params = {
    ["@number"] = backupPhoneNumber,
    ["@phoneNumber"] = newPhoneNumber,
  }

  local phonesData = MySQL.query.await(
    "SELECT settings, pin, face_id, phone_number FROM phone_phones WHERE phone_number = @number OR phone_number = @phoneNumber",
    params
  )

  local newPhoneData = phonesData[1]
  local backupPhoneData = phonesData[2]

  -- Swap if needed to keep newPhoneData corresponding to newPhoneNumber
  if newPhoneData and newPhoneData.phone_number ~= newPhoneNumber then
    newPhoneData, backupPhoneData = backupPhoneData, newPhoneData
  end

  if not newPhoneData or not backupPhoneData then
    return false
  end

  -- Decode settings JSON
  local settings = json.decode(backupPhoneData.settings)
  newPhoneData.settings = settings

  -- Adjust pinCode flag
  if settings.security and settings.security.pinCode and not newPhoneData.pin then
    newPhoneData.settings.security.pinCode = false
  end

  -- Adjust faceId flag
  if settings.security and settings.security.faceId and not newPhoneData.face_id then
    newPhoneData.settings.security.faceId = false
  end

  -- Update phone settings
  MySQL.update.await(
    "UPDATE phone_phones SET settings = ? WHERE phone_number = ?",
    { json.encode(newPhoneData.settings), newPhoneNumber }
  )

  -- Copy photos from backup to new phone, avoiding duplicates
  MySQL.update.await([[
    INSERT IGNORE INTO phone_photos (phone_number, link, is_video, size, `timestamp`)
    SELECT @phoneNumber, link, is_video, size, `timestamp`
    FROM phone_photos
    WHERE phone_number = @number AND link NOT IN (SELECT link FROM phone_photos WHERE phone_number = @phoneNumber)
  ]], params)

  -- Copy contacts from backup to new phone, avoiding duplicates
  MySQL.update.await([[
    INSERT IGNORE INTO phone_phone_contacts (contact_phone_number, firstname, lastname, profile_image, favourite, phone_number)
    SELECT contact_phone_number, firstname, lastname, profile_image, favourite, @phoneNumber
    FROM phone_phone_contacts
    WHERE phone_number = @number AND contact_phone_number NOT IN (SELECT contact_phone_number FROM phone_phone_contacts WHERE phone_number = @phoneNumber)
  ]], params)

  -- Copy map locations from backup to new phone, avoiding duplicates
  MySQL.update.await([[
    INSERT IGNORE INTO phone_maps_locations (id, phone_number, `name`, x_pos, y_pos)
    SELECT id, @phoneNumber, `name`, x_pos, y_pos
    FROM phone_maps_locations
    WHERE phone_number = @number AND id NOT IN (SELECT id FROM phone_maps_locations WHERE phone_number = @phoneNumber)
  ]], params)

  return true
end)

BaseCallback("backup:deleteBackup", function(source, _, phoneNumber)
  local identifier = GetIdentifier(source)
  local result = MySQL.update.await(
    "DELETE FROM phone_backups WHERE id = ? AND phone_number = ?",
    { identifier, phoneNumber }
  )
  return result > 0
end)

BaseCallback("backup:getBackups", function(source, _)
  local identifier = GetIdentifier(source)
  return MySQL.query.await(
    "SELECT phone_number AS `number` FROM phone_backups WHERE id = ?",
    { identifier }
  )
end)
