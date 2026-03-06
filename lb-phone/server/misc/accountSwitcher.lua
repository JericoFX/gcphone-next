local activeAccountsCache = {}
local validApps = {
  Twitter = true,
  Instagram = true,
  Mail = true,
  TikTok = true,
  DarkChat = true,
}

local appAliases = {
  instapic = "Instagram",
  birdy = "Twitter",
  trendy = "TikTok",
  darkchat = "DarkChat",
  mail = "Mail",
}

for appName, _ in pairs(validApps) do
  activeAccountsCache[appName] = {}
end

-- Callback: switch account
BaseCallback("accountSwitcher:switchAccount", function(playerId, phoneNumber, appName, username)
  if not validApps[appName] then
    return false
  end

  local isLoggedIn = MySQL.scalar.await(
    "SELECT TRUE FROM phone_logged_in_accounts WHERE phone_number = ? AND app = ? AND username = ?",
    { phoneNumber, appName, username }
  )

  if not isLoggedIn then
    print(string.format("Possible abuse? %s (%i) tried to switch to an account they aren't logged into.",
      GetPlayerName(playerId), playerId))
    return false
  end

  local updatedRows = MySQL.update.await(
    "UPDATE phone_logged_in_accounts SET `active` = (username = ?) WHERE phone_number = ? AND app = ?",
    { username, phoneNumber, appName }
  )

  local success = updatedRows > 0
  if success then
    activeAccountsCache[appName][phoneNumber] = username
    TriggerEvent("phone:loggedInToAccount", appName, phoneNumber, username)
  end

  return success
end)

-- Callback: get accounts
BaseCallback("accountSwitcher:getAccounts", function(_, phoneNumber, appName)
  if not validApps[appName] then
    return {}
  end

  return MySQL.query.await(
    "SELECT username FROM phone_logged_in_accounts WHERE phone_number = ? AND app = ?",
    { phoneNumber, appName }
  )
end)

-- Function: Add logged in account
function AddLoggedInAccount(phoneNumber, appName, username)
  assert(validApps[appName], "Invalid app: " .. appName)
  assert(type(phoneNumber) == "string", "Invalid phone number. Expected string.")
  assert(type(username) == "string", "Invalid username. Expected string.")

  MySQL.update.await(
    "UPDATE phone_logged_in_accounts SET `active` = 0 WHERE phone_number = ? AND app = ? AND username != ?",
    { phoneNumber, appName, username }
  )

  local rowsUpdated = MySQL.update.await(
    "INSERT INTO phone_logged_in_accounts (phone_number, app, username, active) VALUES (?, ?, ?, 1) ON DUPLICATE KEY UPDATE active = 1",
    { phoneNumber, appName, username }
  )

  local success = rowsUpdated > 0
  if success then
    activeAccountsCache[appName][phoneNumber] = username
    TriggerEvent("phone:loggedInToAccount", appName, phoneNumber, username)
  end
  return success
end

-- Function: Remove logged in account
function RemoveLoggedInAccount(phoneNumber, appName, username)
  assert(validApps[appName], "Invalid app: " .. appName)
  assert(type(phoneNumber) == "string", "Invalid phone number. Expected string.")
  assert(type(username) == "string", "Invalid username. Expected string.")

  local rowsDeleted = MySQL.update.await(
    "DELETE FROM phone_logged_in_accounts WHERE phone_number = ? AND app = ? AND username = ?",
    { phoneNumber, appName, username }
  )

  local success = rowsDeleted > 0
  if success then
    local cachedUsername = activeAccountsCache[appName][phoneNumber]
    if cachedUsername == username then
      activeAccountsCache[appName][phoneNumber] = nil
    end
    TriggerEvent("phone:loggedOutFromAccount", appName, username, phoneNumber)
  end
  return success
end

-- Function: Get logged in account username for a phone and app
function GetLoggedInAccount(phoneNumber, appName, skipCache)
  assert(validApps[appName], "Invalid app: " .. appName)
  assert(type(phoneNumber) == "string", "Invalid phone number. Expected string.")

  local cachedUsername = activeAccountsCache[appName][phoneNumber]
  if cachedUsername then
    return cachedUsername
  end

  local username = MySQL.scalar.await(
    "SELECT username FROM phone_logged_in_accounts WHERE phone_number = ? AND app = ? AND active = 1",
    { phoneNumber, appName }
  )

  if username and not skipCache then
    debugprint("AccountSwitcher: Setting cache for " .. phoneNumber .. ", logged in as " .. username .. " on " .. appName)
    activeAccountsCache[appName][phoneNumber] = username
  end

  return username or false
end

-- Function: Get logged in phone numbers for a given app and username
function GetLoggedInNumbers(appName, username)
  assert(validApps[appName], "Invalid app: " .. appName)
  assert(type(username) == "string", "Invalid username. Expected string.")

  local rows = MySQL.query.await(
    "SELECT phone_number FROM phone_logged_in_accounts WHERE app = ? AND username = ?",
    { appName, username }
  )

  if not rows then
    return {}
  end

  local phoneNumbers = {}
  for _, row in ipairs(rows) do
    table.insert(phoneNumbers, row.phone_number)
  end
  return phoneNumbers
end

-- Function: Get active accounts cache for an app
function GetActiveAccounts(appName)
  local appCache = activeAccountsCache[appName]
  if not appCache then
    appCache = {}
  end
  return appCache
end

-- Function: Clear cache for active accounts, removing duplicates except the current phoneNumber
function ClearActiveAccountsCache(appName, username, phoneNumberToKeep)
  assert(validApps[appName], "Invalid app: " .. appName)
  assert(type(username) == "string", "Invalid username. Expected string.")

  for phoneNumber, cachedUsername in pairs(activeAccountsCache[appName]) do
    if cachedUsername == username and phoneNumber ~= phoneNumberToKeep then
      activeAccountsCache[appName][phoneNumber] = nil
    end
  end
end

-- Export function to get social media username by phone and app
exports("GetSocialMediaUsername", function(phoneNumber, appName)
  assert(type(phoneNumber) == "string", "Invalid phone number. Expected string.")
  assert(type(appName) == "string", "Invalid app. Expected string.")
  assert(appAliases[appName], "Invalid app: " .. appName)

  return GetLoggedInAccount(phoneNumber, appAliases[appName], true)
end)

-- Event handler: on player dropped, clear cache for their phone number
AddEventHandler("playerDropped", function()
  local phoneNumber = GetEquippedPhoneNumber(source)
  if not phoneNumber then
    return
  end

  for appName, accounts in pairs(activeAccountsCache) do
    if accounts[phoneNumber] then
      accounts[phoneNumber] = nil
      debugprint("AccountSwitcher: Player dropped, logging out " .. phoneNumber .. " from " .. appName)
    end
  end
end)
