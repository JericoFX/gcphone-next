local disabledApps = Config.DisabledNotifications or {}

function SendNotification(phoneNumberOrSource, notificationData, callback)
  if table.contains(disabledApps, notificationData.app) then
    if callback then callback(false) end
    debugprint("Notification are disabled for app", notificationData.app)
    return
  end

  notificationData = table.clone(notificationData)

  if type(notificationData) ~= "table" or not notificationData.app then
    if callback then callback(false) end
    debugprint("Invalid data or no app")
    return
  end

  if notificationData.content and #notificationData.content > 500 then
    if callback then callback(false) end
    debugprint("Content too long")
    return
  end

  if type(phoneNumberOrSource) == "number" then
    notificationData.source = phoneNumberOrSource
  end

  if notificationData.app and not notificationData.source then
    if type(phoneNumberOrSource) == "string" then
      local source = GetSourceFromNumber(phoneNumberOrSource)
      if source then
        notificationData.source = source
      end
    end
  end

  if not (notificationData.app and type(phoneNumberOrSource) == "string") then
    if callback then callback(true) end
    if notificationData.source then
      TriggerClientEvent("phone:sendNotification", notificationData.source, notificationData)
      debugprint("Sending notification to source: " .. tostring(notificationData.source))
    else
      debugprint("Couldn't find source, no notification printing")
    end
    return
  end

  if Config.MaxNotifications then
    local maxId = MySQL.scalar.await(
      "SELECT id FROM phone_notifications WHERE phone_number = ? ORDER BY id DESC LIMIT ?, 1",
      { phoneNumberOrSource, Config.MaxNotifications - 1 }
    )
    if maxId then
      debugprint("Max notifications reached, deleting all older notifications", phoneNumberOrSource, maxId)
      MySQL.update.await(
        "DELETE FROM phone_notifications WHERE phone_number = ? AND id <= ?",
        { phoneNumberOrSource, maxId }
      )
    end
  end

  local insertId = MySQL.insert.await([[
    INSERT IGNORE INTO phone_notifications
    (phone_number, app, title, content, thumbnail, avatar, show_avatar, custom_data)
    VALUES
    (@phoneNumber, @app, @title, @content, @thumbnail, @avatar, @showAvatar, @data)
  ]], {
    ["@phoneNumber"] = phoneNumberOrSource,
    ["@app"] = notificationData.app,
    ["@title"] = notificationData.title,
    ["@content"] = notificationData.content,
    ["@thumbnail"] = notificationData.thumbnail,
    ["@avatar"] = notificationData.avatar,
    ["@showAvatar"] = notificationData.showAvatar,
    ["@data"] = notificationData.customData and json.encode(notificationData.customData) or nil,
  })

  notificationData.id = insertId

  if notificationData.source then
    TriggerClientEvent("phone:sendNotification", notificationData.source, notificationData)
    debugprint("Sending notification to source: " .. tostring(notificationData.source))
  else
    debugprint("Couldn't find source, no notification printing")
  end

  if callback then
    callback(insertId)
  end
end

exports("SendNotification", SendNotification)

function NotifyEveryone(notifyType, notificationData)
  assert(notifyType == "all" or notifyType == "online", "Invalid notify")
  assert(type(notificationData) == "table" and type(notificationData.app) == "string", "Invalid app")
  assert(type(notificationData.title) == "string", "Invalid title")

  if table.contains(disabledApps, notificationData.app) then
    debugprint("NotifyEveryone: Notification are disabled for app", notificationData.app)
    return
  end

  if notifyType == "all" then
    MySQL.insert([[
      INSERT INTO phone_notifications
      (phone_number, app, title, content, thumbnail, avatar, show_avatar)
      SELECT phone_number, @app, @title, @content, @thumbnail, @avatar, @showAvatar
      FROM phone_phones
      WHERE last_seen > DATE_SUB(NOW(), INTERVAL 7 DAY)
    ]], {
      ["@app"] = notificationData.app,
      ["@title"] = notificationData.title,
      ["@content"] = notificationData.content,
      ["@thumbnail"] = notificationData.thumbnail,
      ["@avatar"] = notificationData.avatar,
      ["@showAvatar"] = notificationData.showAvatar,
    })
  end

  TriggerClientEvent("phone:sendNotification", -1, notificationData)
end

exports("NotifyEveryone", NotifyEveryone)

function NotifyPhones(tableName, notificationData, customWhere, queryParams)
  if table.contains(disabledApps, notificationData.app) then
    debugprint("NotifyPhones: Notification are disabled for app", notificationData.app)
    return
  end

  queryParams = queryParams or {}
  customWhere = customWhere or ""

  queryParams["@app"] = notificationData.app
  queryParams["@title"] = notificationData.title
  queryParams["@content"] = notificationData.content
  queryParams["@thumbnail"] = notificationData.thumbnail
  queryParams["@avatar"] = notificationData.avatar
  queryParams["@showAvatar"] = notificationData.showAvatar

  local sql = string.format([[
    INSERT INTO phone_notifications
    (phone_number, app, title, content, thumbnail, avatar, show_avatar)
    SELECT %sphone_number, @app, @title, @content, @thumbnail, @avatar, @showAvatar
    FROM %s
    RETURNING id, phone_number
  ]], customWhere, tableName)

  MySQL.query(sql, queryParams, function(results)
    for _, row in ipairs(results) do
      local source = GetSourceFromNumber(row.phone_number)
      if source then
        notificationData.id = row.id
        TriggerClientEvent("phone:sendNotification", source, notificationData)
      end
    end
  end)
end

exports("NotifyPhones", NotifyPhones)

function EmergencyNotification(source, data)
  assert(type(source) == "number", "Invalid source")
  assert(type(data) == "table", "Invalid data")

  SendNotification(source, {
    title = data.title or "Emergency Alert",
    content = data.content or "This is a test emergency alert.",
    icon = "./assets/img/icons/" .. (data.icon or "warning") .. ".png"
  })
end

exports("SendAmberAlert", EmergencyNotification)
exports("EmergencyNotification", EmergencyNotification)

BaseCallback("getNotifications", function(source, phoneNumber)
  return MySQL.query.await([[
    SELECT id, app, title, content, thumbnail, avatar, show_avatar AS showAvatar, custom_data, `timestamp`
    FROM phone_notifications WHERE phone_number=?
  ]], { phoneNumber })
end)

BaseCallback("deleteNotification", function(source, phoneNumber, notificationId)
  local rowsAffected = MySQL.update.await(
    "DELETE FROM phone_notifications WHERE id=? AND phone_number=?",
    { notificationId, phoneNumber }
  )
  return rowsAffected > 0
end)

BaseCallback("clearNotifications", function(source, phoneNumber, app)
  MySQL.update.await(
    "DELETE FROM phone_notifications WHERE phone_number=? AND app=?",
    { phoneNumber, app }
  )
  return true
end)
