local validApps = {
  twitter = true,
  instagram = true,
  tiktok = true,
}

local aliasApps = {
  birdy = "twitter",
  instapic = "instagram",
  trendy = "tiktok",
}

local appDisplayNames = {
  twitter = "Twitter",
  instagram = "Instagram",
  tiktok = "TikTok",
}

function ToggleVerified(app, username, verified)
  assert(type(app) == "string", "Invalid app")
  app = app:lower()
  if not validApps[app] then
    local alias = aliasApps[app]
    if alias then
      app = alias
    end
  end
  assert(validApps[app], "Invalid app")
  assert(type(username) == "string", "Invalid username")

  TriggerEvent("lb-phone:toggleVerified", app, username, verified)

  local query = string.format("UPDATE phone_%s_accounts SET verified=@verified WHERE username=@username", app)
  local params = {
    ["@username"] = username,
    ["@verified"] = verified,
  }
  local success = MySQL.Sync.execute(query, params) > 0

  if success and verified then
    local displayName = appDisplayNames[app]
    if displayName then
      local activePhones = MySQL.query.await(
        "SELECT phone_number FROM phone_logged_in_accounts WHERE app = ? AND username = ? AND `active` = 1",
        { app, username }
      )
      for _, phone in ipairs(activePhones) do
        SendNotification(phone.phone_number, {
          app = displayName,
          title = L("BACKEND.MISC.VERIFIED")
        })
      end
    end
  end

  return success
end

exports("ToggleVerified", ToggleVerified)

exports("IsVerified", function(app, username)
  assert(type(app) == "string", "Invalid app")
  app = app:lower()
  if not validApps[app] then
    local alias = aliasApps[app]
    if alias then
      app = alias
    end
  end
  assert(validApps[app], "Invalid app")
  assert(type(username) == "string", "Invalid username")

  local query = string.format("SELECT verified FROM phone_%s_accounts WHERE username=@username", app)
  local result = MySQL.Sync.fetchScalar(query, { ["@username"] = username })
  return result or false
end)

local accountFields = {
  twitter = "username",
  instagram = "username",
  tiktok = "username",
  mail = "address",
  darkchat = "username",
}

function ChangePassword(app, username, newPassword)
  assert(type(app) == "string", "Invalid app")
  app = app:lower()
  if not validApps[app] then
    local alias = aliasApps[app]
    if alias then
      app = alias
    end
  end
  assert(validApps[app], "Invalid app")
  assert(type(username) == "string", "Invalid username")
  assert(type(newPassword) == "string", "Invalid password")

  local passwordField = accountFields[app]
  local query = string.format("UPDATE phone_%s_accounts SET password=@password WHERE %s=@username", app, passwordField)
  local params = {
    ["@username"] = username,
    ["@password"] = GetPasswordHash(newPassword),
  }
  local success = MySQL.Sync.execute(query, params) > 0
  if not success then
    return false
  end

  MySQL.update("DELETE FROM phone_logged_in_accounts WHERE app = ? AND username = ?", { app, username })
  return true
end

exports("ChangePassword", ChangePassword)

exports("GetEquippedPhoneNumber", function(identifierOrSource)
  if type(identifierOrSource) == "number" then
    return GetEquippedPhoneNumber(identifierOrSource)
  end

  local sourceId = GetSourceFromIdentifier and GetSourceFromIdentifier(identifierOrSource)
  if sourceId then
    return GetEquippedPhoneNumber(sourceId)
  end

  local tableName = Config.Item.Unique and "phone_last_phone" or "phone_phones"
  local idField = "id"

  local query = string.format("SELECT phone_number FROM %s WHERE %s = ?", tableName, idField)
  return MySQL.scalar.await(query, { identifierOrSource })
end)
