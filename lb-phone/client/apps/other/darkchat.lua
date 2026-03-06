local registerNUICallback = RegisterNUICallback
local registerNetEvent = RegisterNetEvent

-- Callback do DarkChat para diversas ações
local function handleDarkChatRequest(data, callback)
  if not currentPhone then
    return
  end

  local action = data.action or ""
  debugprint("DarkChat: " .. action, data)

  if action == "getUsername" then
    TriggerCallback("darkchat:getUsername", callback)
  elseif action == "setPassword" then
    TriggerCallback("darkchat:setPassword", callback, data.password)
  elseif action == "login" then
    TriggerCallback("darkchat:login", callback, data.username, data.password)
  elseif action == "logout" then
    TriggerCallback("darkchat:logout", callback)
  elseif action == "changePassword" then
    TriggerCallback("darkchat:changePassword", callback, data.oldPassword, data.newPassword)
  elseif action == "deleteAccount" then
    TriggerCallback("darkchat:deleteAccount", callback, data.password)
  elseif action == "register" then
    TriggerCallback("darkchat:register", callback, data.username, data.password)
  elseif action == "getChannels" then
    TriggerCallback("darkchat:getChannels", callback)
  elseif action == "joinChannel" then
    TriggerCallback("darkchat:joinChannel", callback, data.channel)
  elseif action == "getMessages" then
    TriggerCallback("darkchat:getMessages", callback, data.channel, data.page)
  elseif action == "sendMessage" then
    TriggerCallback("darkchat:sendMessage", callback, data.channel, data.content)
  elseif action == "leaveChannel" then
    TriggerCallback("darkchat:leaveChannel", callback, data.channel)
  end
end

registerNUICallback("DarkChat", handleDarkChatRequest)

-- Evento de nova mensagem no DarkChat
local function onNewDarkChatMessage(channel, sender, content)
  SendReactMessage("darkChat:newMessage", {
    channel = channel,
    sender = sender,
    content = content
  })
end

registerNetEvent("phone:darkChat:newMessage", onNewDarkChatMessage)

-- Evento para atualizar informações do canal no DarkChat
local function onUpdateDarkChatChannel(channel, username, action)
  SendReactMessage("darkChat:updateChannel", {
    action = action,
    channel = channel,
    username = username
  })
end

registerNetEvent("phone:darkChat:updateChannel", onUpdateDarkChatChannel)
