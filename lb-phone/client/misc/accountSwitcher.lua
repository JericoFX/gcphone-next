local allowedApps = {
  Twitter = true,
  Instagram = true,
  TikTok = true,
  Mail = true,
  DarkChat = true
}

RegisterNUICallback("AccountSwitcher", function(data, callback)
  local action = data.action or ""
  local app = data.app
  debugprint("AccountSwitcher:" .. action)

  if not currentPhone or not allowedApps[app] then
    debugprint("AccountSwitcher: Invalid app / no currentPhone", app)
    return callback(false)
  end

  if action == "switch" then
    TriggerCallback("accountSwitcher:switchAccount", callback, app, data.account)
  elseif action == "getAccounts" then
    TriggerCallback("accountSwitcher:getAccounts", function(accounts)
      if not accounts then
        return callback(false)
      end

      local usernames = {}
      for i = 1, #accounts do
        usernames[i] = accounts[i].username
      end

      callback(usernames)
    end, app)
  else
    callback(false)
  end
end)
