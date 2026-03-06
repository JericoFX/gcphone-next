local RegisterLegacyCallback = RegisterLegacyCallback
local BaseCallback = BaseCallback

RegisterLegacyCallback("security:getIdentifier", function(source, callback)
  local identifier1, identifier2 = GetIdentifier(source)
  callback(identifier1, identifier2)
end)

BaseCallback("security:setPin", function(source, phoneNumber, newPin, oldPin)
  if type(newPin) ~= "string" or #newPin ~= 4 then
    debugprint("Failed to set pin: invalid type or length")
    return false
  end

  local rowsAffected = MySQL.update.await(
    "UPDATE phone_phones SET pin = ? WHERE phone_number = ? AND (pin = ? OR pin IS NULL)",
    { newPin, phoneNumber, oldPin or "" }
  )
  local success = rowsAffected > 0

  debugprint("phone:security:setPin", GetPlayerName(source), success, phoneNumber, newPin, oldPin)
  return success
end, false)

BaseCallback("security:removePin", function(source, phoneNumber, pin)
  if type(pin) ~= "string" or #pin ~= 4 then
    debugprint("Failed to remove pin: invalid type or length")
    return false
  end

  local rowsAffected = MySQL.update.await(
    "UPDATE phone_phones SET pin = NULL, face_id = NULL WHERE phone_number = ? AND (pin = ? OR pin IS NULL)",
    { phoneNumber, pin }
  )
  return rowsAffected > 0
end, false)

BaseCallback("security:verifyPin", function(source, phoneNumber, pin)
  if type(pin) ~= "string" or #pin ~= 4 then
    debugprint("Failed to verify pin: invalid type or length")
    return false
  end

  local savedPin = MySQL.scalar.await(
    "SELECT pin FROM phone_phones WHERE phone_number = ?",
    { phoneNumber }
  )
  local isValid = savedPin == nil or savedPin == pin

  debugprint("phone:security:verifyPin", GetPlayerName(source), isValid, savedPin, pin)
  return isValid
end, false)

BaseCallback("security:enableFaceUnlock", function(source, phoneNumber, pin)
  if type(pin) ~= "string" or #pin ~= 4 then
    debugprint("Failed to enable face unlock: invalid type or length")
    return false
  end

  local identifier = GetIdentifier(source)

  local rowsAffected = MySQL.update.await(
    "UPDATE phone_phones SET face_id = ? WHERE phone_number = ? AND pin = ?",
    { identifier, phoneNumber, pin }
  )
  return rowsAffected > 0
end, false)

BaseCallback("security:disableFaceUnlock", function(source, phoneNumber, pin)
  if type(pin) ~= "string" or #pin ~= 4 then
    debugprint("Failed to disable face unlock: invalid type or length")
    return false
  end

  return MySQL.update.await(
    "UPDATE phone_phones SET face_id = NULL WHERE phone_number = ? AND (pin = ? OR pin IS NULL)",
    { phoneNumber, pin }
  )
end, false)

BaseCallback("security:verifyFace", function(source, faceId)
  local identifier = GetIdentifier(source)

  local savedFaceId = MySQL.scalar.await(
    "SELECT face_id FROM phone_phones WHERE phone_number = ?",
    { faceId }
  )

  debugprint("phone:security:verifyFace", GetPlayerName(source), savedFaceId, identifier)
  return savedFaceId == identifier
end, false)

local function ResetSecurity(phoneNumber)
  assert(type(phoneNumber) == "string",
    "Invalid argument #1 to ResetSecurity, expected string, got " .. type(phoneNumber))

  MySQL.update.await(
    "UPDATE phone_phones SET pin = NULL, face_id = NULL WHERE phone_number = ?",
    { phoneNumber }
  )

  local source = GetSourceFromNumber(phoneNumber)
  if source then
    TriggerClientEvent("phone:security:reset", source, phoneNumber)
  end
end
ResetSecurity = ResetSecurity

exports("GetPin", function(phoneNumber)
  assert(type(phoneNumber) == "string", "Invalid argument #1 to GetPin, expected string, got " .. type(phoneNumber))
  return MySQL.scalar.await("SELECT pin FROM phone_phones WHERE phone_number = ?", { phoneNumber })
end)

exports("ResetSecurity", ResetSecurity)
