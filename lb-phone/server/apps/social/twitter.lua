-- Funções principais
local function GetLoggedInTwitterAccount(source)
  local phoneNumber = GetEquippedPhoneNumber(source)
  if not phoneNumber then
    return false
  end
  return GetLoggedInAccount(phoneNumber, "Twitter")
end

local function TwitterCallback(callbackName, callbackFunc, defaultReturn)
  BaseCallback("birdy:" .. callbackName, function(source, phoneNumber, ...)
    local account = GetLoggedInAccount(phoneNumber, "Twitter")
    if not account then
      return defaultReturn
    end
    return callbackFunc(source, phoneNumber, account, ...)
  end, defaultReturn)
end

local function NotifyTwitterUsers(username, notification, excludeNumber)
  local phoneNumbers = MySQL.query.await(
    "SELECT phone_number FROM phone_logged_in_accounts WHERE username = ? AND app = 'Twitter' AND `active` = 1",
    { username }
  )

  notification.app = "Twitter"

  for _, entry in ipairs(phoneNumbers) do
    local targetNumber = entry.phone_number
    if targetNumber ~= excludeNumber then
      SendNotification(targetNumber, notification)
    end
  end
end

local function GetTwitterProfile(username, currentUserNumber)
  username = username:lower()

  local accountData = MySQL.single.await(
    "SELECT `display_name`, `bio`, `profile_image`, `profile_header`, `verified`, `follower_count`, `following_count`, `date_joined`, private FROM `phone_twitter_accounts` WHERE `username`=?",
    { username }
  )

  if not accountData then
    return false
  end

  local isFollowing = false
  local isFollowingYou = false
  local notificationsEnabled = false
  local hasRequested = false
  local pinnedTweet = nil
  local currentUser = nil

  if currentUserNumber then
    currentUser = GetLoggedInAccount(currentUserNumber, "Twitter")
  end

  if currentUser then
    isFollowing = MySQL.scalar.await(
      "SELECT `followed` FROM `phone_twitter_follows` WHERE `follower` = ? AND `followed` = ?",
      { currentUser, username }
    ) ~= nil

    isFollowingYou = MySQL.scalar.await(
      "SELECT `followed` FROM `phone_twitter_follows` WHERE `follower` = ? AND `followed` = ?",
      { username, currentUser }
    ) ~= nil

    notificationsEnabled = MySQL.scalar.await(
      "SELECT `notifications` FROM `phone_twitter_follows` WHERE `follower` = ? AND `followed` = ?",
      { currentUser, username }
    ) == true

    hasRequested = MySQL.scalar.await(
      "SELECT TRUE FROM phone_twitter_follow_requests WHERE requester = ? AND requestee = ?",
      { currentUser, username }
    ) ~= nil

    pinnedTweet = MySQL.scalar.await(
      "SELECT pinned_tweet FROM phone_twitter_accounts WHERE username = ?",
      { username }
    )

    if pinnedTweet then
      pinnedTweet = GetTweet(pinnedTweet, currentUser)
    end
  end

  return {
    name = accountData.display_name,
    username = username,
    followers = accountData.follower_count,
    following = accountData.following_count,
    date_joined = accountData.date_joined,
    bio = accountData.bio,
    verified = accountData.verified,
    private = accountData.private,
    profile_picture = accountData.profile_image,
    header = accountData.profile_header,
    isFollowing = isFollowing,
    isFollowingYou = isFollowingYou,
    notificationsEnabled = notificationsEnabled,
    pinnedTweet = pinnedTweet,
    requested = hasRequested
  }
end

local function GetTwitterLoggedInUsers(username)
  local users = {}
  local results = MySQL.Sync.fetchAll(
    "SELECT phone_number FROM phone_logged_in_accounts WHERE username = ? AND app = 'Twitter' AND `active` = 1",
    { username }
  )

  for _, entry in ipairs(results) do
    users[entry.phone_number] = GetSourceFromNumber(entry.phone_number)
  end

  return users
end

-- Constantes
local NOTIFICATION_TYPES = {
  like = "BACKEND.TWITTER.LIKE",
  retweet = "BACKEND.TWITTER.RETWEET",
  reply = "BACKEND.TWITTER.REPLY",
  follow = "BACKEND.TWITTER.FOLLOW",
  tweet = "BACKEND.TWITTER.TWEET"
}

-- Funções de notificação
local function SendTwitterNotification(recipient, sender, notificationType, tweetId)
  if recipient == sender then
    return
  end

  local notificationKey = NOTIFICATION_TYPES[notificationType]
  if not notificationKey then
    return
  end

  -- Verificar notificações duplicadas
  if notificationType == "like" or notificationType == "retweet" or notificationType == "follow" then
    local query =
    "SELECT TRUE FROM phone_twitter_notifications WHERE username=@username AND `from`=@from AND `type`=@type"
    if notificationType ~= "follow" then
      query = query .. " AND tweet_id=@tweet_id"
    end

    local alreadyExists = MySQL.Sync.fetchScalar(query, {
      ["@username"] = recipient,
      ["@from"] = sender,
      ["@type"] = notificationType,
      ["@tweet_id"] = tweetId
    })

    if alreadyExists then
      return
    end
  end

  -- Obter informações do remetente
  local senderData = MySQL.Sync.fetchAll(
    "SELECT display_name, private FROM phone_twitter_accounts WHERE username=@username",
    { ["@username"] = sender }
  )[1]

  -- Pular se a conta for privada (a menos que seja uma resposta)
  if senderData.private and notificationType ~= "reply" then
    return
  end

  -- Formatar notificação
  notificationKey = L(notificationKey, {
    displayName = senderData.display_name,
    username = sender
  })

  -- Inserir notificação
  MySQL.Async.execute(
    "INSERT INTO phone_twitter_notifications (id, username, `from`, `type`, tweet_id) VALUES (@id, @username, @from, @type, @tweetId)",
    {
      ["@id"] = GenerateId("phone_twitter_notifications", "id"),
      ["@username"] = recipient,
      ["@from"] = sender,
      ["@type"] = notificationType,
      ["@tweetId"] = tweetId
    }
  )

  -- Obter conteúdo do tweet se aplicável
  local tweetContent = nil
  local attachments = nil

  if notificationType ~= "follow" then
    local tweetData = MySQL.Sync.fetchAll(
      "SELECT content, attachments FROM phone_twitter_tweets WHERE id=@tweetId",
      { ["@tweetId"] = tweetId }
    )

    if tweetData and tweetData[1] then
      tweetContent = tweetData[1].content
      if tweetData[1].attachments then
        attachments = json.decode(tweetData[1].attachments)
      end
    end
  end

  -- Enviar notificações para todos os dispositivos logados
  local recipients = GetTwitterLoggedInUsers(recipient)
  for phoneNumber, source in pairs(recipients) do
    SendNotification(phoneNumber, {
      app = "Twitter",
      title = notificationKey,
      content = tweetContent,
      thumbnail = attachments and attachments[1]
    })
  end
end

-- Callbacks
RegisterLegacyCallback("birdy:getNotifications", function(source, callback, page)
  local account = GetLoggedInTwitterAccount(source)
  if not account then
    return callback({
      notifications = {},
      requests = 0
    })
  end

  local notifications = MySQL.Sync.fetchAll([[
    SELECT
      n.`from`, n.`type`, n.tweet_id,
      t.username, t.content, t.attachments, t.reply_to, t.like_count,
      t.reply_count, t.retweet_count, t.`timestamp`,
      (
        SELECT TRUE FROM phone_twitter_likes l
        WHERE l.tweet_id=t.id AND l.username=@username
      ) AS liked,
      (
        SELECT TRUE FROM phone_twitter_retweets r
        WHERE r.tweet_id=t.id AND r.username=@username
      ) AS retweeted,
      a.display_name AS `name`, a.profile_image AS profile_picture, a.verified,
      (
        CASE WHEN t.reply_to IS NULL THEN NULL ELSE (SELECT username FROM phone_twitter_tweets WHERE id=t.reply_to LIMIT 1) END
      ) AS replyToAuthor
    FROM phone_twitter_notifications n
    LEFT JOIN phone_twitter_tweets t ON n.tweet_id = t.id
    JOIN phone_twitter_accounts a ON a.username = n.from
    WHERE n.username=@username
    ORDER BY n.`timestamp` DESC
    LIMIT @page, @perPage
  ]], {
    ["@page"] = page * 15,
    ["@perPage"] = 15,
    ["@username"] = account
  })

  if page > 0 then
    return callback({ notifications = notifications })
  end

  local requestCount = MySQL.Sync.fetchScalar(
    "SELECT COUNT(1) FROM phone_twitter_follow_requests WHERE requestee=@username",
    { ["@username"] = account }
  )

  callback({
    notifications = notifications,
    requests = requestCount
  })
end)

RegisterLegacyCallback("birdy:createAccount", function(source, callback, displayName, username, password)
  local phoneNumber = GetEquippedPhoneNumber(source)
  if not phoneNumber then
    return callback(false)
  end

  username = username:lower()

  if not IsUsernameValid(username) then
    return callback({
      success = false,
      error = "USERNAME_NOT_ALLOWED"
    })
  end

  if MySQL.Sync.fetchScalar(
        "SELECT TRUE FROM phone_twitter_accounts WHERE username=@username",
        { ["@username"] = username }
      ) then
    return callback({
      success = false,
      error = "USERNAME_TAKEN"
    })
  end

  MySQL.Sync.execute(
    "INSERT INTO phone_twitter_accounts (display_name, username, `password`, phone_number) VALUES (@displayName, @username, @password, @phonenumber)",
    {
      ["@displayName"] = displayName,
      ["@username"] = username,
      ["@password"] = GetPasswordHash(password),
      ["@phonenumber"] = phoneNumber
    }
  )

  AddLoggedInAccount(phoneNumber, "Twitter", username)

  callback({ success = true })

  -- Seguidores automáticos
  if Config.AutoFollow.Enabled and Config.AutoFollow.Birdy.Enabled then
    for _, autoFollowUser in ipairs(Config.AutoFollow.Birdy.Accounts) do
      MySQL.update.await(
        "INSERT INTO phone_twitter_follows (followed, follower) VALUES (?, ?)",
        { autoFollowUser, username }
      )
    end
  end
end)

TwitterCallback("changePassword", function(source, phoneNumber, username, currentPassword, newPassword)
  if not Config.ChangePassword.Birdy then
    infoprint("warning",
      string.format("%s tried to change password on Birdy, but it's not enabled in the config.", source))
    return false
  end

  if currentPassword == newPassword or #newPassword < 3 then
    debugprint("same password / too short")
    return false
  end

  local currentPasswordHash = MySQL.scalar.await(
    "SELECT password FROM phone_twitter_accounts WHERE username = ?",
    { username }
  )

  if not currentPasswordHash or not VerifyPasswordHash(currentPassword, currentPasswordHash) then
    return false
  end

  local success = MySQL.update.await(
    "UPDATE phone_twitter_accounts SET password = ? WHERE username = ?",
    { GetPasswordHash(newPassword), username }
  ) > 0

  if not success then
    return false
  end

  NotifyTwitterUsers(username, {
    title = L("BACKEND.MISC.LOGGED_OUT_PASSWORD.TITLE"),
    content = L("BACKEND.MISC.LOGGED_OUT_PASSWORD.DESCRIPTION")
  }, phoneNumber)

  MySQL.update.await(
    "DELETE FROM phone_logged_in_accounts WHERE username = ? AND app = 'Twitter' AND phone_number != ?",
    { username, phoneNumber }
  )

  ClearActiveAccountsCache("Twitter", username, phoneNumber)

  Log("Birdy", source, "info",
    L("BACKEND.LOGS.CHANGED_PASSWORD.TITLE"),
    L("BACKEND.LOGS.CHANGED_PASSWORD.DESCRIPTION", {
      number = phoneNumber,
      username = username,
      app = "Birdy"
    })
  )

  TriggerClientEvent("phone:logoutFromApp", -1, {
    username = username,
    app = "twitter",
    reason = "password",
    number = phoneNumber
  })

  return true
end, false)

TwitterCallback("deleteAccount", function(source, phoneNumber, username, password)
  if not Config.DeleteAccount.Birdy then
    infoprint("warning",
      string.format("%s tried to delete their account on Birdy, but it's not enabled in the config.", source))
    return false
  end

  local currentPasswordHash = MySQL.scalar.await(
    "SELECT password FROM phone_twitter_accounts WHERE username = ?",
    { username }
  )

  if not currentPasswordHash or not VerifyPasswordHash(password, currentPasswordHash) then
    return false
  end

  local success = MySQL.update.await(
    "DELETE FROM phone_twitter_accounts WHERE username = ?",
    { username }
  ) > 0

  if not success then
    return false
  end

  NotifyTwitterUsers(username, {
    title = L("BACKEND.MISC.DELETED_NOTIFICATION.TITLE"),
    content = L("BACKEND.MISC.DELETED_NOTIFICATION.DESCRIPTION")
  })

  MySQL.update.await(
    "DELETE FROM phone_logged_in_accounts WHERE username = ? AND app = 'Twitter'",
    { username }
  )

  ClearActiveAccountsCache("Twitter", username)

  Log("Birdy", source, "info",
    L("BACKEND.LOGS.DELETED_ACCOUNT.TITLE"),
    L("BACKEND.LOGS.DELETED_ACCOUNT.DESCRIPTION", {
      number = phoneNumber,
      username = username,
      app = "Birdy"
    })
  )

  TriggerClientEvent("phone:logoutFromApp", -1, {
    username = username,
    app = "twitter",
    reason = "deleted"
  })

  return true
end, false)

BaseCallback("birdy:login", function(source, phoneNumber, username, password)
  username = username:lower()

  local passwordHash = MySQL.scalar.await(
    "SELECT `password` FROM phone_twitter_accounts WHERE username = ?",
    { username }
  )

  if not passwordHash then
    return {
      success = false,
      error = "INVALID_ACCOUNT"
    }
  elseif not VerifyPasswordHash(password, passwordHash) then
    return {
      success = false,
      error = "INVALID_PASSWORD"
    }
  end

  AddLoggedInAccount(phoneNumber, "Twitter", username)

  local profile = GetTwitterProfile(username)
  if not profile then
    return {
      success = false,
      error = "INVALID_ACCOUNT"
    }
  end

  return {
    success = true,
    data = profile
  }
end)

TwitterCallback("isLoggedIn", function(source, phoneNumber, username)
  return GetTwitterProfile(username)
end, false)

TwitterCallback("getProfile", function(source, phoneNumber, username, targetUsername)
  return GetTwitterProfile(targetUsername, phoneNumber)
end, false)

RegisterLegacyCallback("birdy:pinPost", function(source, callback, tweetId)
  local account = GetLoggedInTwitterAccount(source)
  if not account then
    return callback(false)
  end

  if tweetId then
    local isOwner = MySQL.scalar.await(
      "SELECT TRUE FROM phone_twitter_tweets WHERE id = ? AND username = ?",
      { tweetId, account }
    )

    if not isOwner then
      infoprint("warning", string.format("%s (%s) tried to pin a post on birdy that they didn't make.", account, source))
      return callback(false)
    end
  end

  MySQL.Async.execute(
    "UPDATE phone_twitter_accounts SET pinned_tweet=@tweetId WHERE username=@username",
    {
      ["@tweetId"] = tweetId or nil,
      ["@username"] = account
    },
    function()
      callback(true)
    end
  )
end)

RegisterLegacyCallback("birdy:signOut", function(source, callback)
  local phoneNumber = GetEquippedPhoneNumber(source)
  if not phoneNumber then
    return callback(false)
  end

  local account = GetLoggedInAccount(phoneNumber, "Twitter")
  if not account then
    return callback(false)
  end

  RemoveLoggedInAccount(phoneNumber, "Twitter", account)
  callback(true)
end)

RegisterLegacyCallback("birdy:updateProfile", function(source, callback, profileData)
  local account = GetLoggedInTwitterAccount(source)
  if not account then
    return callback(false)
  end

  MySQL.Async.execute(
    "UPDATE phone_twitter_accounts SET display_name=@displayName, bio=@bio, profile_image=@profilePicture, profile_header=@header, private=@private WHERE username=@username",
    {
      ["@username"] = account,
      ["@displayName"] = profileData.name,
      ["@bio"] = profileData.bio,
      ["@profilePicture"] = profileData.profile_picture,
      ["@header"] = profileData.header,
      ["@private"] = profileData.private
    },
    function()
      callback(true)
    end
  )
end)

-- Funções para posts
local function LogTwitterPost(postId, username, content, attachments, source)
  if not content then content = "" end
  local attachmentCount = attachments and #attachments or 0

  local logMessage = "**Username**: " .. username .. "\n**Content**: " .. (content or "")

  if attachments then
    logMessage = logMessage .. "\n**Attachments**:"
    for i, attachment in ipairs(attachments) do
      logMessage = logMessage .. string.format("\n[Attachment %s](%s)", i, attachment)
    end
  end

  logMessage = logMessage .. "\n**ID**: " .. postId

  Log("Birdy", source, "info", "New post", logMessage)
end

local function SendTwitterWebhook(username, content, attachments, replyTo)
  if not Config.Post.Birdy or replyTo then return end
  if not BIRDY_WEBHOOK or BIRDY_WEBHOOK:sub(-14) ~= "/api/webhooks/" then return end

  local profileImage = MySQL.scalar.await(
    "SELECT profile_image FROM phone_twitter_accounts WHERE username = ?",
    { username }
  )

  PerformHttpRequest(BIRDY_WEBHOOK, function() end, "POST", json.encode({
    username = Config.Post.Accounts and Config.Post.Accounts.Birdy and Config.Post.Accounts.Birdy.Username or "Birdy",
    avatar_url = Config.Post.Accounts and Config.Post.Accounts.Birdy and Config.Post.Accounts.Birdy.Avatar or
    "https://loaf-scripts.com/fivem/lb-phone/icons/Birdy.png",
    embeds = { {
      title = L("APPS.TWITTER.NEW_POST"),
      description = content and #content > 0 and content or nil,
      color = 1942002,
      timestamp = GetTimestampISO(),
      author = {
        name = "@" .. username,
        icon_url = profileImage or "https://cdn.discordapp.com/embed/avatars/5.png"
      },
      image = attachments and #attachments > 0 and { url = attachments[1] } or nil,
      footer = {
        text = "LB Phone",
        icon_url = "https://docs.lbscripts.com/images/icons/icon.png"
      }
    } }
  }), { ["Content-Type"] = "application/json" })
end

function PostBirdy(username, content, attachments, replyTo, hashtags, source)
  assert(type(username) == "string", "PostBirdy: Expected string for argument 1 (username), got " .. type(username))
  assert(type(content) == "string", "PostBirdy: Expected string/nil for argument 2 (content), got " .. type(content))

  if not content then content = "" end

  local postId = GenerateId("phone_twitter_tweets", "id")
  local values = { postId, username, content }
  local columns = "INSERT INTO phone_twitter_tweets (id, username, content"

  if attachments then
    assert(type(attachments) == "table",
      "PostBirdy: Expected table/nil for argument 3 (attachments), got " .. type(attachments))
    assert(table.type(attachments) == "array", "PostBirdy: Expected array table for attachments")

    if #attachments > 0 then
      columns = columns .. ", attachments"
      values[#values + 1] = json.encode(attachments)
    end
  else
    if content:gsub(" ", ""):len() == 0 then
      debugprint("PostBirdy: No content & no attachments")
      return false
    end
  end

  if replyTo then
    assert(type(replyTo) == "string", "PostBirdy: Expected string/nil for argument 4 (replyTo), got " .. type(replyTo))
    columns = columns .. ", reply_to"
    values[#values + 1] = replyTo
  end

  local query = columns .. ") VALUES (" .. string.rep("?, ", #values):sub(1, -3) .. ")"

  if MySQL.update.await(query, values) == 0 then
    return false
  end

  local accountData = MySQL.single.await(
    "SELECT display_name, profile_image, verified, private FROM phone_twitter_accounts WHERE username = ?",
    { username }
  ) or { display_name = username }

  -- Atualizar contagem de respostas se for uma resposta
  if replyTo then
    MySQL.update.await(
      "UPDATE phone_twitter_tweets SET reply_count = reply_count + 1 WHERE id = ?",
      { replyTo }
    )

    TriggerClientEvent("phone:twitter:updateTweetData", -1, replyTo, "replies", true)

    MySQL.scalar(
      "SELECT username FROM phone_twitter_tweets WHERE id = ?",
      { replyTo },
      function(replyAuthor)
        if replyAuthor then
          SendTwitterNotification(replyAuthor, username, "reply", postId)
        end
      end
    )
  end

  -- Notificar seguidores
  MySQL.query(
    "SELECT follower FROM phone_twitter_follows WHERE followed = ? AND notifications=1",
    { username },
    function(followers)
      for _, follower in ipairs(followers) do
        SendTwitterNotification(follower.follower, username, "tweet", postId)
      end
    end
  )

  TrackSocialMediaPost("birdy", attachments)

  if source then
    LogTwitterPost(postId, username, content, attachments, source)
  end

  -- Enviar webhook se a conta não for privada
  if not accountData.private then
    SendTwitterWebhook(username, content, attachments, replyTo)

    -- Notificações globais
    if Config.BirdyNotifications then
      local notificationScope = Config.BirdyNotifications == "all" and "all" or "online"
      NotifyEveryone(notificationScope, {
        app = "Twitter",
        title = L("BACKEND.TWITTER.TWEET", { username = username }),
        content = content,
        thumbnail = attachments and attachments[1]
      })
    end

    -- Trending hashtags
    if Config.BirdyTrending.Enabled and type(hashtags) == "table" and table.type(hashtags) == "array" and #hashtags > 0 then
      MySQL.update(
        [[
          INSERT INTO phone_twitter_hashtags (hashtag, amount)
          VALUES ]] .. string.rep("(?, 1), ", #hashtags):sub(1, -3) .. [[
          ON DUPLICATE KEY UPDATE amount = amount + 1
        ]],
        hashtags
      )
    end
    return true
  end

  -- Criar objeto do tweet para broadcast
  local tweetData = {
    id = postId,
    username = username,
    content = content,
    attachments = attachments,
    like_count = 0,
    reply_count = 0,
    retweet_count = 0,
    reply_to = replyTo,
    timestamp = os.time() * 1000,
    liked = false,
    retweeted = false,
    display_name = accountData.display_name,
    profile_image = accountData.profile_image,
    verified = accountData.verified
  }

  if replyTo then
    tweetData.replyToAuthor = MySQL.scalar.await(
      "SELECT username FROM phone_twitter_tweets WHERE id = ?",
      { replyTo }
    )
  end

  -- Enviar para todos os clientes
  TriggerClientEvent("phone:twitter:newtweet", -1, tweetData)
  TriggerEvent("lb-phone:birdy:newPost", tweetData)

  return true, postId
end

TwitterCallback("sendPost", function(source, phoneNumber, username, content, attachments, replyTo, hashtags)
  if ContainsBlacklistedWord(source, "Birdy", content) then
    return false
  end

  return PostBirdy(username, content, attachments, replyTo, hashtags, source)
end)

RegisterLegacyCallback("birdy:getRecentHashtags", function(source, callback)
  if not Config.BirdyTrending.Enabled then
    return callback({})
  end

  local hashtags = MySQL.query.await(
    "SELECT hashtag, amount AS uses FROM phone_twitter_hashtags ORDER BY amount DESC LIMIT 5"
  )

  callback(hashtags)
end)

RegisterLegacyCallback("birdy:deletePost", function(source, callback, tweetId)
  local account = GetLoggedInTwitterAccount(source)
  if not account then
    return callback(false)
  end

  local replyTo = MySQL.Sync.fetchScalar(
    "SELECT reply_to FROM phone_twitter_tweets WHERE id=@id",
    { ["@id"] = tweetId }
  )

  local isAllowed = IsAdmin(source) or MySQL.Sync.fetchScalar(
    "SELECT TRUE FROM phone_twitter_tweets WHERE id=@id AND username=@username",
    {
      ["@id"] = tweetId,
      ["@username"] = account
    }
  )

  if not isAllowed then
    return callback(false)
  end

  local params = { ["@id"] = tweetId }

  MySQL.Sync.execute("DELETE FROM phone_twitter_likes WHERE tweet_id=@id", params)
  MySQL.Sync.execute("DELETE FROM phone_twitter_retweets WHERE tweet_id=@id", params)
  MySQL.Sync.execute("DELETE FROM phone_twitter_notifications WHERE tweet_id=@id", params)
  local success = MySQL.Sync.execute("DELETE FROM phone_twitter_tweets WHERE id=@id", params) > 0

  callback(success)

  if not success then return end

  -- Atualizar contagem de respostas se necessário
  if replyTo then
    local replyCount = MySQL.Sync.fetchScalar(
      "SELECT COUNT(id) FROM phone_twitter_tweets WHERE reply_to=@replyTo",
      { ["@replyTo"] = replyTo }
    )

    MySQL.Sync.execute(
      "UPDATE phone_twitter_tweets SET reply_count=@count WHERE id=@replyTo",
      {
        ["@replyTo"] = replyTo,
        ["@count"] = replyCount
      }
    )

    TriggerClientEvent("phone:twitter:updateTweetData", -1, replyTo, "replies", false)
  end

  Log("Birdy", source, "info", "Post deleted", "**ID**: " .. tweetId)
end)

RegisterLegacyCallback("birdy:getRandomPromoted", function(source, callback)
  local account = GetLoggedInTwitterAccount(source)
  if not account then
    return callback(false)
  end

  local tweetId = MySQL.Sync.fetchScalar(
    "SELECT tweet_id FROM phone_twitter_promoted WHERE promotions > 0 ORDER BY RAND() LIMIT 1"
  )

  if not tweetId then
    return callback(false)
  end

  MySQL.Async.execute(
    "UPDATE phone_twitter_promoted SET promotions = promotions - 1, views = views + 1 WHERE tweet_id = @tweetId",
    { ["@tweetId"] = tweetId }
  )

  callback(GetTweet(tweetId))
end)

RegisterLegacyCallback("birdy:promotePost", function(source, callback, tweetId)
  if not Config.PromoteBirdy or not Config.PromoteBirdy.Enabled or not RemoveMoney then
    return callback(false)
  end

  if not RemoveMoney(source, Config.PromoteBirdy.Cost) then
    return callback(false)
  end

  MySQL.Async.execute(
    [[
      INSERT INTO phone_twitter_promoted (tweet_id, promotions, views) VALUES (@tweetId, @promotions, 0)
      ON DUPLICATE KEY UPDATE promotions = promotions + @promotions
    ]],
    {
      ["@tweetId"] = tweetId,
      ["@promotions"] = Config.PromoteBirdy.Views
    }
  )

  callback(true)
end)

RegisterLegacyCallback("birdy:searchAccounts", function(source, callback, searchTerm)
  MySQL.Async.fetchAll(
    [[
      SELECT display_name, username, profile_image, verified, private
      FROM phone_twitter_accounts
      WHERE
          username LIKE CONCAT(@search, "%")
          OR
          display_name LIKE CONCAT("%", @search, "%")
    ]],
    { ["@search"] = searchTerm },
    callback
  )
end)

RegisterLegacyCallback("birdy:searchTweets", function(source, callback, searchTerm, page)
  local account = GetLoggedInTwitterAccount(source)
  if not account then
    return callback(false)
  end

  MySQL.Async.fetchAll(
    [[
      SELECT
          DISTINCT t.id, t.username, t.content, t.attachments,
          t.like_count, t.reply_count, t.retweet_count, t.reply_to,
          t.`timestamp`,

          (
              CASE WHEN t.reply_to IS NULL THEN NULL ELSE (SELECT username FROM phone_twitter_tweets WHERE id=t.reply_to LIMIT 1) END
          ) AS replyToAuthor,

          a.display_name, a.username, a.profile_image, a.verified,

          (
              SELECT TRUE FROM phone_twitter_likes l
              WHERE l.tweet_id=t.id AND l.username=@loggedInAs
          ) AS liked,
          (
              SELECT TRUE FROM phone_twitter_retweets r
              WHERE r.tweet_id=t.id AND r.username=@loggedInAs
          ) AS retweeted

      FROM phone_twitter_tweets t
          LEFT JOIN phone_twitter_accounts a ON a.username=t.username
      WHERE
          t.content LIKE CONCAT("%", @search, "%")

      ORDER BY t.`timestamp` DESC

      LIMIT
          @page, @perPage
    ]],
    {
      ["@search"] = searchTerm,
      ["@loggedInAs"] = account,
      ["@page"] = page * 10,
      ["@perPage"] = 10
    },
    callback
  )
end)

RegisterLegacyCallback("birdy:getData", function(source, callback, dataType, target, page)
  local account = GetLoggedInTwitterAccount(source)
  if not account then
    return callback(false)
  end

  local tableName = "phone_twitter_likes"
  local column1 = "tweet_id"
  local column2 = "username"

  if dataType == "following" or dataType == "followers" then
    tableName = "phone_twitter_follows"
    if dataType == "following" then
      column1 = "follower"
      column2 = "followed"
    else
      column1 = "followed"
      column2 = "follower"
    end
  elseif dataType == "retweeters" then
    tableName = "phone_twitter_retweets"
    column1 = "tweet_id"
    column2 = "username"
  end

  local query = string.format([[
    SELECT
        a.display_name AS `name`,
        a.username,
        a.profile_image AS profile_picture,
        a.bio,
        a.verified,

    (
        SELECT CASE WHEN f.followed IS NULL THEN FALSE ELSE TRUE END
            FROM phone_twitter_follows f
            WHERE f.follower=@loggedInAs AND a.username=f.followed
    ) AS isFollowing,

    (
        SELECT CASE WHEN f.follower IS NULL THEN FALSE ELSE TRUE END
            FROM phone_twitter_follows f
            WHERE f.follower=a.username AND f.followed=@loggedInAs
    ) AS isFollowingYou

    FROM
        %s w
    JOIN
        phone_twitter_accounts a ON a.username=w.%s
    WHERE
        w.%s=@whereValue

    ORDER BY
        a.username DESC

    LIMIT
        @page, @perPage
  ]], tableName, column2, column1)

  MySQL.Async.fetchAll(
    query,
    {
      ["@loggedInAs"] = account,
      ["@whereValue"] = target,
      ["@page"] = page * 20,
      ["@perPage"] = 20
    },
    callback
  )
end)

function GetTweet(tweetId, currentUser)
  if not tweetId then return end

  local tweet = MySQL.Sync.fetchAll([[
    SELECT
      DISTINCT t.id, t.username, t.content, t.attachments,
      t.like_count, t.reply_count, t.retweet_count, t.reply_to,
      t.`timestamp`,

      (
        CASE WHEN t.reply_to IS NULL THEN NULL ELSE (SELECT username FROM phone_twitter_tweets WHERE id=t.reply_to LIMIT 1) END
      ) AS replyToAuthor,

      a.display_name, a.username, a.profile_image, a.verified,

      (
        SELECT TRUE FROM phone_twitter_likes l
        WHERE l.tweet_id=t.id AND l.username=@loggedInAs
      ) AS liked,
      (
        SELECT TRUE FROM phone_twitter_retweets r
        WHERE r.tweet_id=t.id AND r.username=@loggedInAs
      ) AS retweeted

    FROM phone_twitter_tweets t

    INNER JOIN phone_twitter_accounts a
      ON a.username=t.username

    WHERE t.id=@tweetId AND (a.private=0 OR a.username=@loggedInAs OR (
      SELECT TRUE FROM phone_twitter_follows f
      WHERE f.follower=@loggedInAs AND f.followed=a.username
    ))
  ]], {
    ["@tweetId"] = tweetId,
    ["@loggedInAs"] = currentUser
  })[1]

  return tweet
end

exports("GetTweet", function(tweetId, callback)
  assert(type(tweetId) == "string", "Expected string for argument 1, got " .. type(tweetId))
  infoprint("warning", "GetTweet is deprecated, use GetBirdyPost instead")

  MySQL.Async.fetchAll([[
    SELECT
      DISTINCT t.id, t.username, t.content, t.attachments,
      t.like_count, t.reply_count, t.retweet_count, t.reply_to,
      t.`timestamp`,
      a.display_name, a.username, a.profile_image, a.verified
    FROM (phone_twitter_tweets t, phone_twitter_accounts a)
    WHERE t.id=@tweetId AND t.username=a.username
  ]], { ["@tweetId"] = tweetId }, callback)
end)

exports("GetBirdyPost", function(tweetId)
  local post = MySQL.single.await(
    [[
      SELECT
        t.id,
        t.username,
        t.content,
        t.attachments,
        t.like_count AS likes,
        t.reply_count AS replies,
        t.retweet_count AS reposts,
        t.reply_to AS replyTo,
        t.`timestamp`,
        a.display_name AS displayName,
        a.profile_image AS avatar,
        a.verified
      FROM
        phone_twitter_tweets t
        LEFT JOIN phone_twitter_accounts a ON a.username = t.username
      WHERE
        t.id = ?
    ]],
    { tweetId }
  )

  if post and post.attachments then
    post.attachments = json.decode(post.attachments)
  end

  return post
end)

RegisterLegacyCallback("birdy:getPost", function(source, callback, tweetId)
  local account = GetLoggedInTwitterAccount(source)
  if not account then
    return callback(false)
  end

  callback(GetTweet(tweetId, account))
end)

RegisterLegacyCallback("birdy:getPosts", function(source, callback, filter, page)
  -- Pega a conta logada
  local loggedInAccount = GetLoggedInTwitterAccount(source)
  if not loggedInAccount then
    return callback({})
  end

  local joinClause = ""
  local retweetJoinClause = ""
  local whereClause = "t.reply_to IS NULL"
  local orderBy = "`timestamp` DESC"
  local includeRetweets = false
  local retweetWhereClause = ""

  -- Define filtro e cláusulas conforme o tipo
  if not filter then
    whereClause = "t.reply_to IS NULL"
    includeRetweets = true
  else
    if filter.type == "following" then
      whereClause = "t.reply_to IS NULL AND f.follower=@loggedInAs AND f.followed=t.username"
      joinClause = "JOIN phone_twitter_follows f"
      retweetJoinClause = "JOIN phone_twitter_follows f ON f.follower=@loggedInAs AND r.username=f.followed"
      includeRetweets = true
    elseif filter.type == "replyTo" then
      whereClause = "t.reply_to=@replyTo"
      orderBy = "t.like_count DESC, t.timestamp DESC"
    elseif filter.type == "user" then
      whereClause = "t.username=@username AND t.reply_to IS NULL"
      retweetWhereClause = " AND r.username=@username"
      includeRetweets = true
    elseif filter.type == "media" then
      whereClause = "t.username=@username AND t.attachments IS NOT NULL"
    elseif filter.type == "replies" then
      whereClause = "t.username=@username AND t.reply_to IS NOT NULL"
    elseif filter.type == "liked" then
      whereClause = "l.username=@username AND t.id=l.tweet_id"
      joinClause = "JOIN phone_twitter_likes l"
      orderBy = "l.timestamp DESC"
    end
  end

  -- Query base para tweets regulares
  local baseQuery = ([[
    SELECT
      (CASE WHEN t.reply_to IS NULL THEN NULL ELSE (SELECT username FROM phone_twitter_tweets WHERE id=t.reply_to LIMIT 1) END) AS replyToAuthor,

      t.id, t.username, t.content, t.attachments,
      t.like_count, t.reply_count, t.retweet_count, t.reply_to,
      t.`timestamp`,

      a.display_name, a.profile_image, a.verified, a.private,

      (SELECT TRUE FROM phone_twitter_likes l2 WHERE l2.tweet_id=t.id AND l2.username=@loggedInAs) AS liked,
      (SELECT TRUE FROM phone_twitter_retweets r2 WHERE r2.tweet_id=t.id AND r2.username=@loggedInAs) AS retweeted,

      NULL AS tweet_timestamp, NULL AS retweeted_by_display_name, NULL AS retweeted_by_username
    FROM phone_twitter_tweets t
    INNER JOIN phone_twitter_accounts a ON a.username=t.username
    %s
    WHERE (a.private=0 OR a.username=@loggedInAs OR (
      SELECT TRUE FROM phone_twitter_follows f WHERE f.follower=@loggedInAs AND f.followed=a.username
    )) AND %s
  ]]):format(joinClause, whereClause)

  local fullQuery = baseQuery

  -- Adiciona retweets se necessário
  if includeRetweets then
    local retweetQuery = ([[
      UNION ALL
      SELECT
        (CASE WHEN t.reply_to IS NULL THEN NULL ELSE (SELECT username FROM phone_twitter_tweets WHERE id=t.reply_to LIMIT 1) END) AS replyToAuthor,

        t.id, t.username, t.content, t.attachments,
        t.like_count, t.reply_count, t.retweet_count, t.reply_to,
        r.timestamp,

        a.display_name, a.profile_image, a.verified, a.private,

        (SELECT TRUE FROM phone_twitter_likes l2 WHERE l2.tweet_id=t.id AND l2.username=@loggedInAs) AS liked,
        (SELECT TRUE FROM phone_twitter_retweets r2 WHERE r2.tweet_id=t.id AND r2.username=@loggedInAs) AS retweeted,

        t.`timestamp` AS tweet_timestamp,
        (SELECT display_name FROM phone_twitter_accounts a2 WHERE r.username=a2.username) AS retweeted_by_display_name,
        r.username AS retweeted_by_username

      FROM phone_twitter_tweets t
      INNER JOIN phone_twitter_accounts a ON a.username=t.username
      JOIN phone_twitter_retweets r ON r.tweet_id=t.id
      %s
      WHERE (a.private=0 OR a.username=@loggedInAs OR (
        SELECT TRUE FROM phone_twitter_follows f WHERE f.follower=@loggedInAs AND f.followed=a.username
      )) %s
    ]]):format(retweetJoinClause, retweetWhereClause)

    fullQuery = fullQuery .. retweetQuery
  end

  -- Ajusta ORDER BY para UNION usando posição da coluna
  if includeRetweets then
    -- timestamp está na 10ª coluna do SELECT
    fullQuery = fullQuery .. "\nORDER BY 10 DESC\nLIMIT @page, @perPage"
  else
    fullQuery = fullQuery .. ("\nORDER BY %s\nLIMIT @page, @perPage"):format(orderBy)
  end

  -- Parâmetros da query
  local queryParams = {
    ["@page"] = (page or 0) * 10,
    ["@perPage"] = 10,
    ["@loggedInAs"] = loggedInAccount,
    ["@username"] = filter and filter.username or nil,
    ["@replyTo"] = filter and filter.tweet_id or nil
  }

  -- Executa consulta
  MySQL.Async.fetchAll(fullQuery, queryParams, callback)
end)


local INTERACTION_TABLES = {
  like = {
    table = "phone_twitter_likes",
    column1 = "username",
    column2 = "tweet_id"
  },
  retweet = {
    table = "phone_twitter_retweets",
    column1 = "username",
    column2 = "tweet_id"
  }
}

RegisterLegacyCallback("birdy:toggleInteraction", function(source, callback, interactionType, tweetId, shouldAdd)
  if interactionType ~= "like" and interactionType ~= "retweet" then
    return
  end

  local account = GetLoggedInTwitterAccount(source)
  if not account then
    return callback(not shouldAdd)
  end

  local function onComplete(rowsChanged)
    if rowsChanged == 0 then
      return callback(not shouldAdd)
    else
      callback(shouldAdd)
    end

    TriggerClientEvent("phone:twitter:updateTweetData", -1, tweetId,
      interactionType == "like" and "likes" or "retweets",
      shouldAdd == true
    )

    if shouldAdd then
      MySQL.Sync.fetchScalar(
        "SELECT username FROM phone_twitter_tweets WHERE id=@tweetId",
        { ["@tweetId"] = tweetId },
        function(tweetAuthor)
          if tweetAuthor then
            SendTwitterNotification(tweetAuthor, account, interactionType, tweetId)
          end
        end
      )
    end
  end

  local interaction = INTERACTION_TABLES[interactionType]
  if shouldAdd then
    MySQL.Async.execute(
      string.format("INSERT IGNORE INTO %s (%s, %s) VALUES (@loggedInAs, @tweetId)",
        interaction.table, interaction.column1, interaction.column2
      ),
      {
        ["@loggedInAs"] = account,
        ["@tweetId"] = tweetId
      },
      onComplete
    )
  else
    MySQL.Async.execute(
      string.format("DELETE FROM %s WHERE %s=@loggedInAs AND %s=@tweetId",
        interaction.table, interaction.column1, interaction.column2
      ),
      {
        ["@loggedInAs"] = account,
        ["@tweetId"] = tweetId
      },
      onComplete
    )
  end
end)

RegisterLegacyCallback("birdy:toggleNotifications", function(source, callback, username, shouldEnable)
  local account = GetLoggedInTwitterAccount(source)
  if not account then
    return callback(not shouldEnable)
  end

  MySQL.Async.execute(
    "UPDATE phone_twitter_follows SET notifications=@enabled WHERE follower=@loggedInAs AND followed=@username",
    {
      ["@enabled"] = shouldEnable,
      ["@loggedInAs"] = account,
      ["@username"] = username
    },
    function(rowsChanged)
      if rowsChanged > 0 then
        callback(shouldEnable)
      else
        callback(not shouldEnable)
      end
    end
  )
end)

RegisterLegacyCallback("birdy:toggleFollow", function(source, callback, targetUsername, shouldFollow)
  local account = GetLoggedInTwitterAccount(source)
  if not account or targetUsername == account then
    return callback(not shouldFollow)
  end

  local params = {
    ["@loggedInAs"] = account,
    ["@username"] = targetUsername
  }

  local isPrivate = MySQL.Sync.fetchScalar(
    "SELECT private FROM phone_twitter_accounts WHERE username=@username",
    params
  )

  if isPrivate then
    if shouldFollow then
      MySQL.Async.execute(
        "INSERT IGNORE INTO phone_twitter_follow_requests (requester, requestee) VALUES (@loggedInAs, @username)",
        params,
        function(rowsChanged)
          callback(shouldFollow)
          if rowsChanged == 0 then return end

          local recipients = GetTwitterLoggedInUsers(targetUsername)
          for phoneNumber, source in pairs(recipients) do
            if source then
              SendNotification(phoneNumber, {
                app = "Twitter",
                content = L("BACKEND.TWITTER.NEW_FOLLOW_REQUEST", { username = account })
              })
            end
          end
        end
      )
      return
    else
      MySQL.Async.execute(
        "DELETE FROM phone_twitter_follow_requests WHERE requester=@loggedInAs AND requestee=@username",
        params
      )
    end
  end

  local query = "INSERT IGNORE INTO phone_twitter_follows (followed, follower) VALUES (@username, @loggedInAs)"
  if not shouldFollow then
    query = "DELETE FROM phone_twitter_follows WHERE followed=@username AND follower=@loggedInAs"
  end

  MySQL.Async.execute(
    query,
    params,
    function(rowsChanged)
      if rowsChanged == 0 then
        return callback(not shouldFollow)
      end

      TriggerClientEvent("phone:twitter:updateProfileData", -1, targetUsername, "followers", shouldFollow == true)
      TriggerClientEvent("phone:twitter:updateProfileData", -1, account, "following", shouldFollow == true)

      if shouldFollow then
        SendTwitterNotification(targetUsername, account, "follow")
      end

      callback(shouldFollow)
    end
  )
end)

RegisterLegacyCallback("birdy:getFollowRequests", function(source, callback, page)
  local account = GetLoggedInTwitterAccount(source)
  if not account then
    return callback({})
  end

  MySQL.Async.fetchAll(
    [[
      SELECT a.username, a.display_name AS `name`, a.profile_image AS profile_picture, a.verified,
      (
        SELECT CASE WHEN f.follower IS NULL THEN FALSE ELSE TRUE END
        FROM phone_twitter_follows f
        WHERE f.follower=a.username AND f.followed=@loggedInAs
      ) AS isFollowingYou

      FROM phone_twitter_follow_requests r

      INNER JOIN phone_twitter_accounts a
        ON a.username=r.requester

      WHERE r.requestee=@loggedInAs

      ORDER BY r.`timestamp` DESC

      LIMIT @page, @perPage
    ]],
    {
      ["@loggedInAs"] = account,
      ["@page"] = (page or 0) * 15,
      ["@perPage"] = 15
    },
    callback
  )
end)

RegisterLegacyCallback("birdy:handleFollowRequest", function(source, callback, requester, shouldAccept)
  local account = GetLoggedInTwitterAccount(source)
  if not account then
    return callback(false)
  end

  local params = {
    ["@loggedInAs"] = account,
    ["@username"] = requester
  }

  local rowsChanged = MySQL.Sync.execute(
    "DELETE FROM phone_twitter_follow_requests WHERE requestee=@loggedInAs AND requester=@username",
    params
  )

  if rowsChanged == 0 then
    return callback(false)
  end

  if not shouldAccept then
    return callback(true)
  end

  MySQL.Sync.execute(
    "INSERT IGNORE INTO phone_twitter_follows (follower, followed) VALUES (@username, @loggedInAs)",
    params
  )

  TriggerClientEvent("phone:twitter:updateProfileData", -1, account, "followers", true)
  TriggerClientEvent("phone:twitter:updateProfileData", -1, requester, "following", true)

  SendTwitterNotification(requester, account, "follow")

  local recipients = GetTwitterLoggedInUsers(requester)
  for phoneNumber, source in pairs(recipients) do
    if source then
      SendNotification(phoneNumber, {
        app = "Twitter",
        content = L("BACKEND.TWITTER.FOLLOW_REQUEST_ACCEPTED_DESCRIPTION", { username = account })
      })
    end
  end

  callback(true)
end)

TwitterCallback("sendMessage", function(source, phoneNumber, sender, recipient, content, attachments)
  if ContainsBlacklistedWord(source, "Birdy", content) then
    return false
  end

  local messageId = GenerateId("phone_twitter_messages", "id")

  local success = MySQL.update.await(
    [[
      INSERT INTO phone_twitter_messages (id, sender, recipient, content, attachments)
      VALUES (@id, @sender, @recipient, @content, @attachments)
    ]],
    {
      ["@id"] = messageId,
      ["@sender"] = sender,
      ["@recipient"] = recipient,
      ["@content"] = content,
      ["@attachments"] = attachments and json.encode(attachments)
    }
  ) > 0

  if not success then
    return false
  end

  -- Enviar para destinatários online
  local recipients = GetTwitterLoggedInUsers(recipient)
  for targetNumber, targetSource in pairs(recipients) do
    if targetSource then
      TriggerClientEvent("phone:twitter:newMessage", targetSource, {
        sender = sender,
        recipient = recipient,
        content = content,
        attachments = attachments,
        timestamp = os.time() * 1000
      })
    end
  end

  -- Enviar notificações
  local senderProfile = GetTwitterProfile(sender)
  if not senderProfile then
    return true
  end

  for targetNumber, targetSource in pairs(recipients) do
    if targetSource then
      SendNotification(targetNumber, {
        source = targetSource,
        app = "Twitter",
        title = senderProfile.name,
        content = content,
        thumbnail = attachments and attachments[1],
        avatar = senderProfile.profile_picture,
        showAvatar = true
      })
    end
  end

  return true
end)

RegisterLegacyCallback("birdy:getMessages", function(source, callback, otherUser, page)
  local account = GetLoggedInTwitterAccount(source)
  if not account then
    return callback({})
  end

  MySQL.Async.fetchAll(
    [[
      SELECT
        sender, recipient, content, attachments, `timestamp`
      FROM phone_twitter_messages
      WHERE (sender=@loggedInAs AND recipient=@username) OR (sender=@username AND recipient=@loggedInAs)
      ORDER BY `timestamp` DESC
      LIMIT @page, @perPage
    ]],
    {
      ["@loggedInAs"] = account,
      ["@username"] = otherUser,
      ["@page"] = (page or 0) * 25,
      ["@perPage"] = 25
    },
    callback
  )
end)

RegisterLegacyCallback("birdy:getRecentMessages", function(source, callback, page)
  local account = GetLoggedInTwitterAccount(source)
  if not account then
    return callback({})
  end

  MySQL.Async.fetchAll(
    [[
      SELECT
        m.content, m.attachments, m.sender, f_m.username, m.`timestamp`,
        a.display_name AS `name`, a.profile_image AS profile_picture, a.verified
      FROM phone_twitter_messages m
      JOIN ((
        SELECT (
          CASE WHEN recipient!=@loggedInAs THEN recipient ELSE sender END
        ) AS username, MAX(`timestamp`) AS `timestamp`
        FROM phone_twitter_messages
        WHERE sender=@loggedInAs OR recipient=@loggedInAs
        GROUP BY username
      ) f_m)
      ON m.`timestamp`=f_m.`timestamp`
      INNER JOIN phone_twitter_accounts a
        ON a.username=f_m.username
      WHERE m.sender=@loggedInAs OR m.recipient=@loggedInAs
      GROUP BY f_m.username
      ORDER BY m.`timestamp` DESC
      LIMIT @page, @perPage
    ]],
    {
      ["@loggedInAs"] = account,
      ["@page"] = (page or 0) * 15,
      ["@perPage"] = 15
    },
    callback
  )
end)

-- Manutenção de hashtags
Citizen.CreateThread(function()
  if not Config.BirdyTrending.Enabled then return end

  while true do
    MySQL.Async.execute(
      string.format("DELETE FROM phone_twitter_hashtags WHERE last_used < DATE_SUB(NOW(), INTERVAL %s HOUR)",
        tostring(Config.BirdyTrending.Reset or 24)
      ),
      {}
    )
    Wait(3600000)
  end
end)
