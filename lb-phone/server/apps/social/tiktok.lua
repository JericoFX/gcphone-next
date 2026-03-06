local function GetLoggedInTikTokAccount(phoneNumber)
  local phoneNumber = GetEquippedPhoneNumber(phoneNumber)
  if not phoneNumber then
    return false
  end
  return GetLoggedInAccount(phoneNumber, "TikTok")
end

local function TikTokCallback(eventName, callback, fallback)
  BaseCallback("tiktok:" .. eventName, function(source, phoneNumber, ...)
    local account = GetLoggedInAccount(phoneNumber, "TikTok")
    if not account then
      return fallback
    end
    return callback(source, phoneNumber, account, ...)
  end, fallback)
end

local function SendTikTokNotification(username, notification, excludePhoneNumber)
  local result = MySQL.query.await(
    "SELECT phone_number FROM phone_logged_in_accounts WHERE username = ? AND app = 'TikTok' AND `active` = 1",
    { username }
  )

  notification.app = "TikTok"

  for _, row in ipairs(result) do
    if row.phone_number ~= excludePhoneNumber then
      SendNotification(row.phone_number, notification)
    end
  end
end

local function GetTikTokProfile(username, loggedInUsername)
  local fields =
  "`name`, bio, avatar, username, verified, follower_count, following_count, like_count, twitter, instagram, show_likes"
  local profile

  if loggedInUsername then
    local query = string.format([[
      SELECT %s,
        (SELECT TRUE FROM phone_tiktok_follows WHERE follower = @username AND followed = @loggedIn) AS isFollowingYou,
        (SELECT TRUE FROM phone_tiktok_follows WHERE follower = @loggedIn AND followed = @username) AS isFollowing
      FROM phone_tiktok_accounts WHERE username = @username
    ]], fields)

    profile = MySQL.Sync.fetchAll(query, {
      ["@username"] = username,
      ["@loggedIn"] = loggedInUsername
    })[1]
  else
    local query = string.format("SELECT %s FROM phone_tiktok_accounts WHERE username = @username", fields)
    profile = MySQL.Sync.fetchAll(query, { ["@username"] = username })[1]
  end

  if profile then
    profile.isFollowing = profile.isFollowing == 1
    profile.isFollowingYou = profile.isFollowingYou == 1
  end

  return profile
end

local NOTIFICATION_TYPES = {
  like = "BACKEND.TIKTOK.LIKE",
  save = "BACKEND.TIKTOK.SAVE",
  comment = "BACKEND.TIKTOK.COMMENT",
  follow = "BACKEND.TIKTOK.FOLLOW",
  like_comment = "BACKEND.TIKTOK.LIKED_COMMENT",
  reply = "BACKEND.TIKTOK.REPLIED_COMMENT",
  message = "BACKEND.TIKTOK.DM"
}

local function SendTikTokNotificationToUser(targetUsername, fromUsername, notificationType, videoId, commentId, extraData)
  local notificationKey = NOTIFICATION_TYPES[notificationType]
  if not notificationKey or targetUsername == fromUsername then
    return
  end

  local fromProfile = GetTikTokProfile(fromUsername)
  if not fromProfile then
    return
  end

  if notificationType ~= "message" then
    local queryParams = { targetUsername, fromUsername, notificationType }
    local query = "SELECT 1 FROM phone_tiktok_notifications WHERE username = ? AND `from` = ? AND `type` = ?"

    if videoId then
      query = query .. " AND video_id = ?"
      table.insert(queryParams, videoId)
    end

    if commentId then
      query = query .. " AND comment_id = ?"
      table.insert(queryParams, commentId)
    end

    local exists = MySQL.scalar.await(query, queryParams) == 1
    if exists then
      return
    end

    MySQL.insert(
    "INSERT INTO phone_tiktok_notifications (username, `from`, `type`, video_id, comment_id) VALUES (?, ?, ?, ?, ?)", {
      targetUsername, fromUsername, notificationType, videoId, commentId
    })
  end

  local videoSrc = videoId and MySQL.Sync.fetchScalar(
    "SELECT src FROM phone_tiktok_videos WHERE id = @id",
    { ["@id"] = videoId }
  ) or nil

  local notification = {
    app = "TikTok",
    title = L(NOTIFICATION_TYPES[notificationType], { displayName = fromProfile.name }),
    thumbnail = videoSrc
  }

  if notificationType == "message" then
    notification.avatar = fromProfile.avatar
    notification.content = extraData.content
    notification.showAvatar = true
  end

  local recipients = MySQL.query.await(
    "SELECT phone_number FROM phone_logged_in_accounts WHERE username = ? AND app = 'TikTok' AND `active` = 1",
    { targetUsername }
  )

  for _, row in ipairs(recipients) do
    SendNotification(row.phone_number, notification)
  end
end

CreateThread(function()
  while true do
    MySQL.Async.execute("DELETE FROM phone_tiktok_notifications WHERE `timestamp` < DATE_SUB(NOW(), INTERVAL 7 DAY)", {})
    Wait(3600000)
  end
end)

RegisterLegacyCallback("tiktok:getNotifications", function(source, cb, page)
  local account = GetLoggedInTikTokAccount(source)
  if not account then
    return cb({ success = false, error = "not_logged_in" })
  end

  MySQL.Async.fetchAll([[
    SELECT
      n.`type`, n.`timestamp`, n.video_id AS videoId,
      a.`name`, a.avatar, a.username, a.verified,
      CASE
        WHEN n.video_id IS NOT NULL THEN
          v.src
        ELSE NULL
      END AS videoSrc,
      n.comment_id,
      CASE
        WHEN n.comment_id IS NOT NULL THEN
          c.comment
        ELSE NULL
      END AS commentText,
      CASE
        WHEN n.`type` = 'follow' THEN
          CASE
            WHEN f.follower IS NOT NULL THEN
              TRUE
            ELSE FALSE
          END
        ELSE NULL
      END AS isFollowing,
      CASE
        WHEN n.`type` = 'reply' THEN
        c_original.comment
        ELSE NULL
      END AS originalText
    FROM
      phone_tiktok_notifications n
      LEFT JOIN phone_tiktok_accounts a ON n.from = a.username
      LEFT JOIN phone_tiktok_videos v ON n.video_id = v.id
      LEFT JOIN phone_tiktok_comments c ON n.comment_id = c.id
      LEFT JOIN phone_tiktok_comments c_original ON c.reply_to = c_original.id
      LEFT JOIN phone_tiktok_follows f ON n.username = f.follower AND n.from = f.followed
    WHERE
      n.username = @username
    ORDER BY
      n.`timestamp` DESC
    LIMIT @page, @perPage
  ]], {
    ["@username"] = account,
    ["@page"] = (page or 0) * 15,
    ["@perPage"] = 15
  }, function(result)
    cb({ success = true, data = result })
  end)
end)

RegisterLegacyCallback("tiktok:login", function(source, cb, username, password)
  local phoneNumber = GetEquippedPhoneNumber(source)
  if not phoneNumber then
    return cb({ success = false, error = "no_number" })
  end

  username = username:lower()

  MySQL.Async.fetchScalar("SELECT password FROM phone_tiktok_accounts WHERE username = @username", {
    ["@username"] = username
  }, function(dbPassword)
    if not dbPassword then
      return cb({ success = false, error = "invalid_username" })
    end

    if not VerifyPasswordHash(password, dbPassword) then
      return cb({ success = false, error = "incorrect_password" })
    end

    local profile = GetTikTokProfile(username)
    if not profile then
      return cb({ success = false, error = "invalid_username" })
    end

    AddLoggedInAccount(phoneNumber, "TikTok", username)
    cb({ success = true, data = profile })
  end)
end)

RegisterLegacyCallback("tiktok:signup", function(source, cb, username, password, displayName)
  local phoneNumber = GetEquippedPhoneNumber(source)
  if not phoneNumber then
    return cb({ success = false, error = "UNKNOWN" })
  end

  username = username:lower()

  if not IsUsernameValid(username) then
    return cb({ success = false, error = "USERNAME_NOT_ALLOWED" })
  end

  local exists = MySQL.Sync.fetchScalar(
    "SELECT TRUE FROM phone_tiktok_accounts WHERE username = @username",
    { ["@username"] = username }
  )

  if exists then
    return cb({ success = false, error = "USERNAME_TAKEN" })
  end

  MySQL.Sync.execute(
    "INSERT INTO phone_tiktok_accounts (`name`, username, password, phone_number) VALUES (@displayName, @username, @password, @phoneNumber)",
    {
      ["@displayName"] = displayName,
      ["@username"] = username,
      ["@password"] = GetPasswordHash(password),
      ["@phoneNumber"] = phoneNumber
    }
  )

  AddLoggedInAccount(phoneNumber, "TikTok", username)
  cb({ success = true })

  if Config.AutoFollow.Enabled and Config.AutoFollow.Trendy.Enabled then
    for _, account in ipairs(Config.AutoFollow.Trendy.Accounts) do
      MySQL.update.await(
        "INSERT INTO phone_tiktok_follows (followed, follower) VALUES (?, ?)",
        { account, username }
      )
    end
  end
end)

TikTokCallback("changePassword", function(source, phoneNumber, account, oldPassword, newPassword)
  if not Config.ChangePassword.Trendy then
    infoprint("warning",
      string.format("%s tried to change password on Trendy, but it's not enabled in the config.", source))
    return false
  end

  if newPassword == oldPassword or #newPassword < 3 then
    debugprint("same password / too short")
    return false
  end

  local dbPassword = MySQL.scalar.await(
    "SELECT password FROM phone_tiktok_accounts WHERE username = ?",
    { account }
  )

  if not dbPassword or not VerifyPasswordHash(oldPassword, dbPassword) then
    return false
  end

  local success = MySQL.update.await(
    "UPDATE phone_tiktok_accounts SET password = ? WHERE username = ?",
    { GetPasswordHash(newPassword), account }
  ) > 0

  if not success then
    return false
  end

  SendTikTokNotification(account, {
    title = L("BACKEND.MISC.LOGGED_OUT_PASSWORD.TITLE"),
    content = L("BACKEND.MISC.LOGGED_OUT_PASSWORD.DESCRIPTION")
  }, phoneNumber)

  MySQL.update.await(
    "DELETE FROM phone_logged_in_accounts WHERE username = ? AND app = 'TikTok' AND phone_number != ?",
    { account, phoneNumber }
  )

  ClearActiveAccountsCache("TikTok", account, phoneNumber)

  Log("Trendy", source, "info",
    L("BACKEND.LOGS.CHANGED_PASSWORD.TITLE"),
    L("BACKEND.LOGS.CHANGED_PASSWORD.DESCRIPTION", {
      number = phoneNumber,
      username = account,
      app = "Trendy"
    })
  )

  TriggerClientEvent("phone:logoutFromApp", -1, {
    username = account,
    app = "tiktok",
    reason = "password",
    number = phoneNumber
  })

  return true
end, false)

TikTokCallback("deleteAccount", function(source, phoneNumber, account, password)
  if not Config.DeleteAccount.Trendy then
    infoprint("warning",
      string.format("%s tried to delete their account on Trendy, but it's not enabled in the config.", source))
    return false
  end

  local dbPassword = MySQL.scalar.await(
    "SELECT password FROM phone_tiktok_accounts WHERE username = ?",
    { account }
  )

  if not dbPassword or not VerifyPasswordHash(password, dbPassword) then
    return false
  end

  local success = MySQL.update.await(
    "DELETE FROM phone_tiktok_accounts WHERE username = ?",
    { account }
  ) > 0

  if not success then
    return false
  end

  SendTikTokNotification(account, {
    title = L("BACKEND.MISC.DELETED_NOTIFICATION.TITLE"),
    content = L("BACKEND.MISC.DELETED_NOTIFICATION.DESCRIPTION")
  })

  MySQL.update.await(
    "DELETE FROM phone_logged_in_accounts WHERE username = ? AND app = 'TikTok'",
    { account }
  )

  ClearActiveAccountsCache("TikTok", account)

  Log("Trendy", source, "info",
    L("BACKEND.LOGS.DELETED_ACCOUNT.TITLE"),
    L("BACKEND.LOGS.DELETED_ACCOUNT.DESCRIPTION", {
      number = phoneNumber,
      username = account,
      app = "Trendy"
    })
  )

  TriggerClientEvent("phone:logoutFromApp", -1, {
    username = account,
    app = "tiktok",
    reason = "deleted"
  })

  return true
end, false)

RegisterLegacyCallback("tiktok:logout", function(source, cb)
  local account = GetLoggedInTikTokAccount(source)
  if not account then
    return cb(false)
  end

  local phoneNumber = GetEquippedPhoneNumber(source)
  if not phoneNumber then
    return cb(false)
  end

  RemoveLoggedInAccount(phoneNumber, "TikTok", account)
  cb(true)
end)

RegisterLegacyCallback("tiktok:isLoggedIn", function(source, cb)
  local account = GetLoggedInTikTokAccount(source)
  cb(account and GetTikTokProfile(account) or false)
end)

RegisterLegacyCallback("tiktok:getProfile", function(source, cb, username)
  cb(GetTikTokProfile(username, GetLoggedInTikTokAccount(source)))
end)

RegisterLegacyCallback("tiktok:updateProfile", function(source, cb, data)
  local phoneNumber = GetEquippedPhoneNumber(source)
  if not phoneNumber then
    return cb({ success = false, error = "no_number" })
  end

  local account = GetLoggedInTikTokAccount(source)
  if not account then
    return cb({ success = false, error = "not_logged_in" })
  end

  local name = data.name
  local bio = data.bio
  local avatar = data.avatar
  local twitter = data.twitter
  local instagram = data.instagram
  local show_likes = data.show_likes

  if #name > 30 then
    return cb({ success = false, error = "display_name_too_long" })
  end

  if bio and #bio > 150 then
    return cb({ success = false, error = "bio_too_long" })
  end

  if twitter then
    local valid = MySQL.Sync.fetchScalar(
      "SELECT TRUE FROM phone_logged_in_accounts WHERE phone_number = @phoneNumber and app = @app and username = @username",
      {
        ["@phoneNumber"] = phoneNumber,
        ["@app"] = "Twitter",
        ["@username"] = twitter
      }
    )

    if not valid then
      return cb({ success = false, error = "invalid_twitter" })
    end
  end

  if instagram then
    local valid = MySQL.Sync.fetchScalar(
      "SELECT TRUE FROM phone_logged_in_accounts WHERE phone_number = @phoneNumber and app = @app and username = @username",
      {
        ["@phoneNumber"] = phoneNumber,
        ["@app"] = "Instagram",
        ["@username"] = instagram
      }
    )

    if not valid then
      return cb({ success = false, error = "invalid_instagram" })
    end
  end

  MySQL.Async.execute(
    "UPDATE phone_tiktok_accounts SET `name` = @displayName, bio = @bio, avatar = @avatar, twitter = @twitter, instagram = @instagram, `show_likes` = @showLikes WHERE username = @username",
    {
      ["@displayName"] = name,
      ["@bio"] = bio,
      ["@avatar"] = avatar,
      ["@twitter"] = twitter,
      ["@instagram"] = instagram,
      ["@showLikes"] = show_likes == true,
      ["@username"] = account
    },
    function()
      cb({ success = true })
    end
  )
end)

RegisterLegacyCallback("tiktok:searchAccounts", function(source, cb, query, page)
  local account = GetLoggedInTikTokAccount(source)
  if not account then
    return cb(false)
  end

  MySQL.Async.fetchAll([[
    SELECT `name`, username, avatar, verified, follower_count, video_count,
      (SELECT TRUE FROM phone_tiktok_follows WHERE follower = @username AND followed = a.username) AS isFollowing
    FROM phone_tiktok_accounts a
    WHERE username LIKE @query OR `name` LIKE @query
    ORDER BY username
    LIMIT @page, @perPage
  ]], {
    ["@query"] = "%" .. query .. "%",
    ["@username"] = account,
    ["@page"] = (page or 0) * 10,
    ["@perPage"] = 10
  }, cb)
end)

RegisterLegacyCallback("tiktok:toggleFollow", function(source, cb, targetUsername, follow)
  local account = GetLoggedInTikTokAccount(source)
  if not account then
    return cb({ success = false, error = "not_logged_in" })
  end

  if targetUsername == account then
    return cb({ success = false, error = "cannot_follow_self" })
  end

  local targetProfile = GetTikTokProfile(targetUsername)
  if not targetProfile then
    return cb({ success = false, error = "invalid_username" })
  end

  cb({ success = true })

  local query = follow and
      "INSERT IGNORE INTO phone_tiktok_follows (follower, followed) VALUES (@follower, @followed)" or
      "DELETE FROM phone_tiktok_follows WHERE follower = @follower AND followed = @followed"

  MySQL.Async.execute(query, {
    ["@follower"] = account,
    ["@followed"] = targetUsername
  }, function(affectedRows)
    if affectedRows == 0 then
      return
    end

    local action = follow and "add" or "remove"

    TriggerClientEvent("phone:tiktok:updateFollowers", -1, targetUsername, action)
    TriggerClientEvent("phone:tiktok:updateFollowing", -1, account, action)

    if follow then
      SendTikTokNotificationToUser(targetUsername, account, "follow")
    end
  end)
end)

RegisterLegacyCallback("tiktok:getFollowing", function(source, cb, username, page)
  local account = GetLoggedInTikTokAccount(source)
  if not account then
    return cb({})
  end

  MySQL.Async.fetchAll([[
    SELECT
      a.username, a.`name`, a.avatar, a.verified,
      (SELECT TRUE FROM phone_tiktok_follows WHERE follower = a.username AND followed = @loggedIn) AS isFollowingYou,
      (SELECT TRUE FROM phone_tiktok_follows WHERE follower = @loggedIn AND followed = a.username) AS isFollowing
    FROM phone_tiktok_follows f
    INNER JOIN phone_tiktok_accounts a ON a.username = f.followed
    WHERE f.follower = @username
    ORDER BY a.username
    LIMIT @page, @perPage
  ]], {
    ["@username"] = username,
    ["@loggedIn"] = account,
    ["@page"] = (page or 0) * 15,
    ["@perPage"] = 15
  }, cb)
end)

RegisterLegacyCallback("tiktok:getFollowers", function(source, cb, username, page)
  local account = GetLoggedInTikTokAccount(source)
  if not account then
    return cb({})
  end

  MySQL.Async.fetchAll([[
    SELECT
      a.username, a.`name`, a.avatar, a.verified,
      (SELECT TRUE FROM phone_tiktok_follows WHERE follower = @username AND followed = @loggedIn) AS isFollowingYou,
      (SELECT TRUE FROM phone_tiktok_follows WHERE follower = @loggedIn AND followed = @username) AS isFollowing
    FROM phone_tiktok_follows f
    INNER JOIN phone_tiktok_accounts a ON a.username = f.follower
    WHERE f.followed = @username
    ORDER BY a.username
    LIMIT @page, @perPage
  ]], {
    ["@username"] = username,
    ["@loggedIn"] = account,
    ["@page"] = (page or 0) * 15,
    ["@perPage"] = 15
  }, cb)
end)

RegisterLegacyCallback("tiktok:uploadVideo", function(source, cb, videoData)
  local account = GetLoggedInTikTokAccount(source)
  if not account then
    return cb({ success = false, error = "not_logged_in" })
  elseif ContainsBlacklistedWord(source, "Trendy", videoData.caption) then
    return cb(false)
  elseif not videoData.src or type(videoData.src) ~= "string" or #videoData.src == 0 then
    return cb({ success = false, error = "invalid_src" })
  elseif not videoData.caption or type(videoData.caption) ~= "string" or #videoData.caption == 0 then
    return cb({ success = false, error = "invalid_caption" })
  end

  local videoId = GenerateId("phone_tiktok_videos", "id")

  MySQL.Async.execute(
    "INSERT INTO phone_tiktok_videos (id, username, src, caption, metadata, music) VALUES (@id, @username, @src, @caption, @metadata, @music)",
    {
      ["@id"] = videoId,
      ["@username"] = account,
      ["@src"] = videoData.src,
      ["@caption"] = videoData.caption,
      ["@metadata"] = videoData.metadata,
      ["@music"] = videoData.music
    },
    function()
      cb({ success = true, id = videoId })

      local videoInfo = {
        username = account,
        caption = videoData.caption,
        videoUrl = videoData.src,
        id = videoId
      }

      TriggerClientEvent("phone:tiktok:newVideo", -1, videoInfo)
      TriggerEvent("lb-phone:trendy:newPost", videoInfo)
      TrackSocialMediaPost("trendy", { videoData.src })

      Log("Trendy", source, "success",
        L("BACKEND.LOGS.TRENDY_UPLOAD_TITLE"),
        L("BACKEND.LOGS.TRENDY_UPLOAD_DESCRIPTION", {
          username = account,
          caption = videoData.caption,
          id = videoId
        })
      )
    end
  )
end)

RegisterLegacyCallback("tiktok:deleteVideo", function(source, cb, videoId)
  local account = GetLoggedInTikTokAccount(source)
  if not account then
    return cb({ success = false, error = "not_logged_in" })
  end

  local query = "DELETE FROM phone_tiktok_videos WHERE id = @id"
  if not IsAdmin(source) then
    query = query .. " AND username = @username"
  end

  MySQL.Async.execute(query, {
    ["@id"] = videoId,
    ["@username"] = account
  }, function(affectedRows)
    cb({ success = affectedRows > 0 })

    if affectedRows > 0 then
      Log("Trendy", source, "error",
        L("BACKEND.LOGS.TRENDY_DELETE_TITLE"),
        L("BACKEND.LOGS.TRENDY_DELETE_DESCRIPTION", {
          username = account,
          id = videoId
        })
      )
    end
  end)
end)

RegisterLegacyCallback("tiktok:togglePinnedVideo", function(source, cb, videoId, pin)
  local account = GetLoggedInTikTokAccount(source)
  if not account then
    return cb({ success = false, error = "not_logged_in" })
  end

  if pin then
    local count = MySQL.Sync.fetchScalar(
      "SELECT COUNT(*) FROM phone_tiktok_pinned_videos WHERE username = @username",
      { ["@username"] = account }
    )

    if count >= 3 then
      return cb({ success = false, error = "max_pinned" })
    end
  end

  local query = pin and
      "INSERT INTO phone_tiktok_pinned_videos (username, video_id) VALUES (@username, @videoId)" or
      "DELETE FROM phone_tiktok_pinned_videos WHERE username = @username AND video_id = @videoId"

  MySQL.Async.execute(query, {
    ["@videoId"] = videoId,
    ["@username"] = account
  }, function(affectedRows)
    cb({ success = affectedRows > 0 })
  end)
end)

local VIDEO_QUERY = [[
  SELECT
    v.id, v.src, v.caption, v.`timestamp`,
    p.video_id IS NOT NULL AS pinned,
    v.likes, v.comments, v.views, v.saves,
    (SELECT TRUE FROM phone_tiktok_likes WHERE username = @loggedIn AND video_id = v.id) AS liked,
    (SELECT TRUE FROM phone_tiktok_saves WHERE username = @loggedIn AND video_id = v.id) AS saved,
    w.video_id IS NOT NULL AS viewed,
    v.metadata, v.music,
    a.username, a.`name`, a.avatar, a.verified,
    (SELECT TRUE FROM phone_tiktok_follows WHERE follower = @username AND followed = a.username) AS following
  FROM phone_tiktok_videos v
  INNER JOIN phone_tiktok_accounts a ON a.username = v.username
  LEFT JOIN phone_tiktok_views w ON v.id = w.video_id AND w.username = @loggedIn
  LEFT JOIN phone_tiktok_pinned_videos p ON p.video_id = v.id AND p.username = @loggedIn
]]

RegisterLegacyCallback("tiktok:getVideo", function(source, cb, videoId)
  local account = GetLoggedInTikTokAccount(source)
  if not account then
    return cb({ success = false, error = "not_logged_in" })
  end

  MySQL.Async.fetchAll(VIDEO_QUERY .. " WHERE v.id = @id", {
    ["@id"] = videoId,
    ["@loggedIn"] = account,
    ["@username"] = account
  }, function(result)
    if #result == 0 then
      return cb({ success = false, error = "invalid_id" })
    end

    cb({ success = true, video = result[1] })
  end)
end)

RegisterLegacyCallback("tiktok:getVideos", function(source, callback, params, page)
  local playerIdentifier = GetLoggedInTikTokAccount(source)
  if not playerIdentifier then
    callback({})
    return
  end
  local query
  local perPage

  -- Base query parts atualizada para incluir o avatar
  local baseQuery = [[
      SELECT
          v.id, v.src, v.views,
          v.username, v.`timestamp`,
          a.avatar,  -- Adicionando o campo avatar
          (SELECT COUNT(*) FROM phone_tiktok_likes WHERE video_id = v.id) AS likes,
          (SELECT COUNT(*) FROM phone_tiktok_comments WHERE video_id = v.id) AS comments,
          EXISTS(SELECT 1 FROM phone_tiktok_likes WHERE video_id = v.id AND username = @loggedIn) AS liked,
          EXISTS(SELECT 1 FROM phone_tiktok_follows WHERE follower = @loggedIn AND followed = v.username) AS following,
          w.username IS NOT NULL AS watched
      FROM phone_tiktok_videos v
      INNER JOIN phone_tiktok_accounts a ON a.username = v.username  -- JOIN com a tabela de accounts
      LEFT JOIN phone_tiktok_views w ON w.video_id = v.id AND w.username = @loggedIn
  ]]

  if params.full then
    perPage = 5

    if params.type == "recent" then
      if params.id and params.username then
        query = baseQuery .. [[
                  WHERE v.username = @username AND v.`timestamp` ]] ..
            (params.backwards and ">" or "<") ..
            [[ (SELECT `timestamp` FROM phone_tiktok_videos WHERE id = @id)
                  ORDER BY (w.username IS NOT NULL), v.timestamp DESC
              ]]
      elseif params.id then
        query = baseQuery .. [[
                  WHERE v.username != @loggedIn AND v.`timestamp` ]] ..
            (params.backwards and ">" or "<") ..
            [[ (SELECT `timestamp` FROM phone_tiktok_videos WHERE id = @id)
                  ORDER BY (w.username IS NOT NULL), v.timestamp DESC
              ]]
      else
        query = baseQuery .. [[
                  WHERE v.username != @loggedIn
                  ORDER BY (w.username IS NOT NULL), v.timestamp DESC
              ]]
      end
    elseif params.type == "following" then
      query = baseQuery .. [[
              INNER JOIN phone_tiktok_follows f ON f.followed = v.username
              WHERE f.follower = @loggedIn
              ORDER BY (w.username IS NOT NULL), v.timestamp DESC
          ]]
    end
  else
    perPage = 15

    if params.type == "recent" and params.username then
      if page == 0 then
        query = [[
                  SELECT
                      v.id, v.src, v.views,
                      a.avatar,  -- Adicionando o campo avatar
                      p.video_id IS NOT NULL AS pinned
                  FROM phone_tiktok_videos v
                  INNER JOIN phone_tiktok_accounts a ON a.username = v.username  -- JOIN com a tabela de accounts
                  LEFT JOIN phone_tiktok_pinned_videos p ON p.video_id = v.id AND p.username = @username
                  WHERE v.username = @username
                  ORDER BY (p.video_id IS NOT NULL) DESC, v.`timestamp` DESC
              ]]
      else
        query = [[
                  SELECT v.id, v.src, v.views, a.avatar
                  FROM phone_tiktok_videos v
                  INNER JOIN phone_tiktok_accounts a ON a.username = v.username  -- JOIN com a tabela de accounts
                  WHERE v.username = @username
                  ORDER BY `timestamp` DESC
              ]]
      end
    elseif params.type == "liked" then
      query = [[
              SELECT v.id, v.src, v.views, a.avatar
              FROM phone_tiktok_videos v
              INNER JOIN phone_tiktok_accounts a ON a.username = v.username  -- JOIN com a tabela de accounts
              INNER JOIN phone_tiktok_likes l ON l.video_id = v.id
              WHERE l.username = @username
              ORDER BY v.`timestamp` DESC
          ]]
    elseif params.type == "saved" then
      if playerIdentifier ~= params.username then
        debugprint("wrong account", playerIdentifier, #playerIdentifier, params.username, #params.username)
        callback({})
        return
      end
      query = [[
              SELECT v.id, v.src, v.views, a.avatar
              FROM phone_tiktok_videos v
              INNER JOIN phone_tiktok_accounts a ON a.username = v.username  -- JOIN com a tabela de accounts
              INNER JOIN phone_tiktok_saves s ON s.video_id = v.id
              WHERE s.username = @username
              ORDER BY v.`timestamp` DESC
          ]]
    end
  end

  if not query then
    callback({})
    return
  end

  -- Add pagination
  query = query .. " LIMIT @page, @perPage"

  MySQL.Async.fetchAll(query, {
    ["@username"] = params.username,
    ["@loggedIn"] = playerIdentifier,
    ["@id"] = params.id,
    ["@page"] = (page or 0) * perPage,
    ["@perPage"] = perPage
  }, callback)
end)

RegisterNetEvent("phone:tiktok:setViewed", function(videoId)
  local account = GetLoggedInTikTokAccount(source)
  if not account then
    return
  end

  MySQL.Async.execute(
    "INSERT IGNORE INTO phone_tiktok_views (username, video_id) VALUES (@username, @videoId)",
    {
      ["@username"] = account,
      ["@videoId"] = videoId
    }
  )
end)

RegisterLegacyCallback("tiktok:toggleVideoAction", function(source, cb, action, videoId, toggle)
  if action ~= "like" and action ~= "save" then
    return cb({ success = false, error = "invalid_action" })
  end

  local account = GetLoggedInTikTokAccount(source)
  if not account then
    return cb({ success = false, error = "not_logged_in" })
  end

  local videoOwner = MySQL.Sync.fetchScalar(
    "SELECT username FROM phone_tiktok_videos WHERE id = @id",
    { ["@id"] = videoId }
  )

  if not videoOwner then
    return cb({ success = false, error = "invalid_id" })
  end

  cb({ success = true })

  local query = toggle and
      "INSERT IGNORE INTO phone_tiktok_%s (username, video_id) VALUES (@username, @videoId)" or
      "DELETE FROM phone_tiktok_%s WHERE username = @username AND video_id = @videoId"

  query = query:format(action == "like" and "likes" or "saves")

  MySQL.Async.execute(query, {
    ["@username"] = account,
    ["@videoId"] = videoId
  }, function(affectedRows)
    if affectedRows == 0 then
      return
    end

    local actionType = toggle and "add" or "remove"

    TriggerClientEvent("phone:tiktok:updateVideoStats", -1, action, videoId, actionType)

    if toggle then
      SendTikTokNotificationToUser(videoOwner, account, action, videoId)
    end
  end)
end)

RegisterLegacyCallback("tiktok:postComment", function(source, cb, videoId, replyToId, comment)
  local account = GetLoggedInTikTokAccount(source)
  if not account then
    return cb({ success = false, error = "not_logged_in" })
  end

  if not comment or #comment == 0 or #comment > 500 then
    return cb({ success = false, error = "invalid_comment" })
  end

  if ContainsBlacklistedWord(source, "Trendy", comment) then
    return cb(false)
  end

  local videoOwner = MySQL.Sync.fetchScalar(
    "SELECT username FROM phone_tiktok_videos WHERE id = @id",
    { ["@id"] = videoId }
  )

  if not videoOwner then
    return cb({ success = false, error = "invalid_id" })
  end

  local replyToValid = not replyToId or MySQL.Sync.fetchScalar(
    "SELECT username FROM phone_tiktok_comments WHERE id = @id",
    { ["@id"] = replyToId }
  )

  if not replyToValid then
    return cb({ success = false, error = "invalid_reply_to" })
  end

  local commentId = GenerateId("phone_tiktok_comments", "id")

  MySQL.Async.execute(
    "INSERT INTO phone_tiktok_comments (id, reply_to, video_id, username, comment) VALUES (@id, @replyTo, @videoId, @loggedIn, @comment)",
    {
      ["@id"] = commentId,
      ["@replyTo"] = replyToId,
      ["@videoId"] = videoId,
      ["@loggedIn"] = account,
      ["@comment"] = comment
    },
    function(affectedRows)
      if affectedRows == 0 then
        return cb({ success = false, error = "failed_insert" })
      end

      TriggerClientEvent("phone:tiktok:updateVideoStats", -1, "comment", videoId, "add")

      if replyToId then
        MySQL.Async.execute(
          "UPDATE phone_tiktok_comments SET replies = replies + 1 WHERE id = @id",
          { ["@id"] = replyToId }
        )

        TriggerClientEvent("phone:tiktok:updateCommentStats", -1, "reply", replyToId, "add")
        SendTikTokNotificationToUser(replyToValid, account, "reply", videoId, commentId)
      end

      cb({ success = true, id = commentId })
      SendTikTokNotificationToUser(videoOwner, account, "comment", videoId, commentId)
    end
  )
end)

RegisterLegacyCallback("tiktok:deleteComment", function(source, cb, commentId, videoId)
  local account = GetLoggedInTikTokAccount(source)
  if not account then
    return cb({ success = false, error = "not_logged_in" })
  end

  local whereClause = ""
  if not IsAdmin(source) then
    whereClause = " AND username = @username"
  end

  local replyTo = MySQL.Sync.fetchScalar(
    "SELECT reply_to FROM phone_tiktok_comments WHERE id = @id" .. whereClause,
    {
      ["@id"] = commentId,
      ["@username"] = account
    }
  )

  local replyCount = 0
  if replyTo then
    MySQL.Async.execute(
      "UPDATE phone_tiktok_comments SET replies = replies - 1 WHERE id = @id",
      { ["@id"] = replyTo }
    )

    TriggerClientEvent("phone:tiktok:updateCommentStats", -1, "reply", replyTo, "remove")
  else
    replyCount = MySQL.Sync.fetchScalar(
      "SELECT COUNT(*) FROM phone_tiktok_comments WHERE reply_to = @id",
      { ["@id"] = commentId }
    )
  end

  MySQL.Async.execute(
    "DELETE FROM phone_tiktok_comments WHERE id = @id" .. whereClause,
    {
      ["@id"] = commentId,
      ["@username"] = account
    },
    function(affectedRows)
      if affectedRows > 0 then
        cb({ success = true })
        TriggerClientEvent("phone:tiktok:updateVideoStats", -1, "comment", videoId, "remove", replyCount + 1)
      else
        cb({ success = false, error = "failed_delete" })
      end
    end
  )
end)

RegisterLegacyCallback("tiktok:setPinnedComment", function(source, cb, commentId, videoId)
  local account = GetLoggedInTikTokAccount(source)
  if not account then
    return cb({ success = false, error = "not_logged_in" })
  end

  local isOwner = MySQL.Sync.fetchScalar(
    "SELECT TRUE FROM phone_tiktok_videos WHERE id = @id AND username = @username",
    {
      ["@id"] = videoId,
      ["@username"] = account
    }
  )

  if not isOwner then
    return cb({ success = false, error = "invalid_id" })
  end

  if commentId ~= nil then
    local isValid = MySQL.Sync.fetchScalar(
      "SELECT TRUE FROM phone_tiktok_comments WHERE id = @id AND username = @username",
      {
        ["@id"] = commentId,
        ["@username"] = account
      }
    )

    if not isValid then
      return cb({ success = false, error = "invalid_comment" })
    end
  end

  MySQL.Async.execute(
    "UPDATE phone_tiktok_videos SET pinned_comment = @commentId WHERE id = @id",
    {
      ["@commentId"] = commentId,
      ["@id"] = videoId
    },
    function(affectedRows)
      if affectedRows > 0 then
        cb({ success = true })
      else
        cb({ success = false, error = "failed_update" })
      end
    end
  )
end)

RegisterLegacyCallback("tiktok:getComments", function(source, callback, videoId, replyTo, creatorUsername, page)
  local loggedInUser = GetPlayerIdentifier(source)
  if not loggedInUser then
    callback({
      success = false,
      error = "not_logged_in"
    })
    return
  end

  -- Base query
  local query = [[
      SELECT
          a.username, a.`name`, a.avatar, a.verified,
          c.id, c.comment, c.likes, c.replies AS reply_count, c.`timestamp`,
          (SELECT TRUE FROM phone_tiktok_comments_likes WHERE username = @loggedIn AND comment_id = c.id) AS liked,
          (SELECT TRUE FROM phone_tiktok_comments_likes WHERE username = @creator AND comment_id = c.id) AS creator_liked
      FROM phone_tiktok_comments c
      INNER JOIN phone_tiktok_accounts a ON a.username = c.username
      WHERE c.video_id = @videoId
  ]]

  -- Add reply filter
  if replyTo then
    query = query .. " AND c.reply_to = @replyTo"
  else
    query = query .. " AND c.reply_to IS NULL"
  end

  -- Add pagination
  query = query .. " ORDER BY c.`timestamp` DESC LIMIT @page, @perPage"

  MySQL.Async.fetchAll(query, {
    ["@loggedIn"] = loggedInUser,
    ["@creator"] = creatorUsername,
    ["@videoId"] = videoId,
    ["@replyTo"] = replyTo,
    ["@page"] = (page or 0) * 15,
    ["@perPage"] = 15
  }, function(result)
    callback({
      success = true,
      comments = result
    })
  end)
end)

RegisterLegacyCallback("tiktok:toggleLikeComment", function(source, cb, commentId, like)
  local account = GetLoggedInTikTokAccount(source)
  if not account then
    return cb({ success = false, error = "not_logged_in" })
  end

  if not commentId or like == nil then
    return cb({ success = false, error = "invalid_data" })
  end

  local commentInfo = MySQL.Sync.fetchAll(
    "SELECT username, video_id FROM phone_tiktok_comments WHERE id = @id",
    { ["@id"] = commentId }
  )[1]

  if not commentInfo then
    return cb({ success = false, error = "invalid_id" })
  end

  local query = like and
      "INSERT IGNORE INTO phone_tiktok_comments_likes (username, comment_id) VALUES (@username, @commentId)" or
      "DELETE FROM phone_tiktok_comments_likes WHERE username = @username AND comment_id = @commentId"

  MySQL.Async.execute(query, {
    ["@username"] = account,
    ["@commentId"] = commentId
  }, function(affectedRows)
    cb({ success = true })

    if affectedRows == 0 then
      debugprint("Failed to toggle like comment, no rows changed")
      return
    end

    local action = like and "add" or "remove"
    TriggerClientEvent("phone:tiktok:updateCommentStats", -1, "like", commentId, action)

    if like then
      SendTikTokNotificationToUser(commentInfo.username, account, "like_comment", commentInfo.video_id, commentId)
    end
  end)
end)

RegisterLegacyCallback("tiktok:getRecentMessages", function(source, cb)
  local account = GetLoggedInTikTokAccount(source)
  if not account then
    return cb({ success = false, error = "not_logged_in" })
  end

  MySQL.Async.fetchAll([[
    SELECT
      id, last_message, `timestamp`,
      a.username, a.`name`, a.avatar, a.verified, a.follower_count, a.following_count,
      (SELECT COALESCE(amount, 0) FROM phone_tiktok_unread_messages WHERE channel_id = id AND username = @loggedIn) AS unread_messages
    FROM phone_tiktok_channels
    INNER JOIN phone_tiktok_accounts a ON a.username = IF(member_1 = @loggedIn, member_2, member_1)
    WHERE member_1 = @loggedIn OR member_2 = @loggedIn
    ORDER BY `timestamp` DESC
  ]], {
    ["@loggedIn"] = account
  }, function(result)
    cb({ success = true, channels = result })
  end)
end)

RegisterLegacyCallback("tiktok:getMessages", function(source, cb, channelId, page)
  local account = GetLoggedInTikTokAccount(source)
  if not account then
    return cb({ success = false, error = "not_logged_in" })
  end

  local isValid = MySQL.Sync.fetchScalar(
    "SELECT TRUE FROM phone_tiktok_channels WHERE id = @id AND (member_1 = @loggedIn OR member_2 = @loggedIn)",
    {
      ["@id"] = channelId,
      ["@loggedIn"] = account
    }
  )

  if not isValid then
    return cb({ success = false, error = "invalid_id" })
  end

  MySQL.Async.fetchAll(
    "SELECT id, sender, content, `timestamp` FROM phone_tiktok_messages WHERE channel_id = @channelId ORDER BY `timestamp` DESC LIMIT @page, @perPage",
    {
      ["@channelId"] = channelId,
      ["@page"] = (page or 0) * 25,
      ["@perPage"] = 25
    },
    function(result)
      cb({ success = true, messages = result })
    end
  )
end)

RegisterLegacyCallback("tiktok:getUnreadMessages", function(source, cb)
  local account = GetLoggedInTikTokAccount(source)
  if not account then
    return cb({ success = false, error = "not_logged_in" })
  end

  MySQL.Async.fetchScalar(
    "SELECT COUNT(*) FROM phone_tiktok_unread_messages WHERE username = @username AND amount > 0",
    { ["@username"] = account },
    function(count)
      cb({ success = true, unread = count })
    end
  )
end)

RegisterNetEvent("phone:tiktok:clearUnreadMessages", function(channelId)
  local account = GetLoggedInTikTokAccount(source)
  if not account then
    return
  end

  MySQL.Async.execute(
    "UPDATE phone_tiktok_unread_messages SET amount = 0 WHERE username = @username AND channel_id = @channelId",
    {
      ["@username"] = account,
      ["@channelId"] = channelId
    }
  )
end)

RegisterLegacyCallback("tiktok:sendMessage", function(source, cb, messageData)
  local account = GetLoggedInTikTokAccount(source)
  if not account then
    return cb({ success = false, error = "not_logged_in" })
  end

  if ContainsBlacklistedWord(source, "Trendy", messageData.content) then
    return cb(false)
  end

  local channelId = messageData.id
  local content = messageData.content
  local targetUsername = messageData.username

  if not channelId then
    if not targetUsername then
      return cb({ success = false, error = "invalid_id" })
    end

    channelId = MySQL.Sync.fetchScalar(
      "SELECT id FROM phone_tiktok_channels WHERE (member_1 = @loggedIn AND member_2 = @username) OR (member_1 = @username AND member_2 = @loggedIn)",
      {
        ["@loggedIn"] = account,
        ["@username"] = targetUsername
      }
    )

    if not channelId then
      channelId = GenerateId("phone_tiktok_channels", "id")
      local inserted = MySQL.Sync.execute(
        "INSERT IGNORE INTO phone_tiktok_channels (id, last_message, member_1, member_2) VALUES (@id, @message, @member_1, @member_2)",
        {
          ["@id"] = channelId,
          ["@message"] = content,
          ["@member_1"] = account,
          ["@member_2"] = targetUsername
        }
      ) > 0

      if not inserted then
        return cb({ success = false, error = "failed_create_channel" })
      end
    end
  end

  local messageId = GenerateId("phone_tiktok_messages", "id")

  MySQL.Async.execute(
    "INSERT INTO phone_tiktok_messages (id, channel_id, sender, content) VALUES (@messageId, @channelId, @sender, @content)",
    {
      ["@messageId"] = messageId,
      ["@channelId"] = channelId,
      ["@sender"] = account,
      ["@content"] = content
    },
    function(affectedRows)
      cb({
        success = affectedRows > 0,
        id = messageId,
        channelId = channelId,
        error = "failed_insert"
      })

      if affectedRows > 0 then
        MySQL.Async.execute([[
          INSERT INTO phone_tiktok_unread_messages
            (username, channel_id, amount)
          VALUES
            (@username, @channelId, 1)
          ON DUPLICATE KEY UPDATE
            amount = amount + 1
        ]], {
          ["@username"] = targetUsername,
          ["@channelId"] = channelId
        })

        local activeAccounts = GetActiveAccounts("TikTok")
        for phone, username in pairs(activeAccounts) do
          if username == targetUsername then
            local targetSource = GetSourceFromNumber(phone)
            if targetSource then
              TriggerClientEvent("phone:tiktok:receivedMessage", targetSource, {
                id = messageId,
                channelId = channelId,
                sender = account,
                content = content
              })
            end
          end
        end

        SendTikTokNotificationToUser(targetUsername, account, "message", nil, nil, {
          content = content
        })
      end
    end
  )
end)

RegisterLegacyCallback("tiktok:getChannelId", function(source, cb, username)
  local account = GetLoggedInTikTokAccount(source)
  if not account then
    return cb({ success = false, error = "not_logged_in" })
  end

  local channelId = MySQL.Sync.fetchScalar(
    "SELECT id FROM phone_tiktok_channels WHERE (member_1 = @loggedIn AND member_2 = @username) OR (member_1 = @username AND member_2 = @loggedIn)",
    {
      ["@loggedIn"] = account,
      ["@username"] = username
    }
  )

  if not channelId then
    return cb({ success = false, error = "no_channel" })
  end

  cb({ success = true, id = channelId })
end)
