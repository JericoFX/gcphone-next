local notificationsCache = {}

-- Função para obter notificações e processar dados customizados
local function fetchNotifications()
  local notifications = AwaitCallback("getNotifications")
  for i = 1, #notifications do
    local notification = notifications[i]
    -- Se não existir conteúdo, use o título como conteúdo e limpe o título
    if notification.content == nil then
      notification.content = notification.title
      notification.title = nil
    end
    -- Se houver dados customizados em JSON, decodifique e processe botões
    if notification.custom_data then
      local customData = json.decode(notification.custom_data)
      if customData.buttons then
        notification.actions = customData.buttons
        if notification.id then
          notificationsCache[notification.id] = notification
        end
      end
      notification.custom_data = nil
    end
  end
  return notifications
end

-- Função para deletar uma notificação pelo ID
local function deleteNotification(notificationId)
  if not notificationId then
    return true
  end
  if type(notificationId) == "string" and notificationId:find("client%-notification%-") then
    notificationsCache[notificationId] = nil
    return true
  end

  local success = AwaitCallback("deleteNotification", notificationId)
  if not success then
    return false
  end
  if notificationsCache[notificationId] then
    notificationsCache[notificationId] = nil
  end
  return success
end

-- Função para limpar notificações por app
local function clearNotifications(appName)
  local success = AwaitCallback("clearNotifications", appName)
  if not success then
    return false
  end
  for id, notification in pairs(notificationsCache) do
    if notification.app == appName then
      notificationsCache[id] = nil
    end
  end
  return success
end

-- Executa a ação de um botão em uma notificação
local function handleNotificationButton(notificationId, buttonIndex)
  local notification = notificationsCache[notificationId]
  local buttons = notification and notification.actions
  if not buttons then
    debugprint("No buttons found for notification", notificationId)
    return false
  end
  local button = buttons[buttonIndex]
  if not button then
    debugprint("Button not found for notification", notificationId, buttonIndex)
    return false
  end
  if button.event then
    if button.server then
      TriggerServerEvent(button.event, button.data)
    else
      TriggerEvent(button.event, button.data)
    end
  end
  return true
end

-- Callback NUI para gerenciar notificações (obter, deletar, limpar, interagir com botões)
RegisterNUICallback("Notifications", function(data, cb)
  local action = data.action
  debugprint("Notifications:", action or "")
  if action == "getNotifications" then
    local notifications = fetchNotifications()
    return cb(notifications)
  elseif action == "deleteNotification" and data.id then
    local success = deleteNotification(data.id)
    return cb(success)
  elseif action == "clearNotifications" then
    local success = clearNotifications(data.app)
    return cb(success)
  elseif action == "button" then
    local buttonId = (data.buttonId or 0) + 1
    local success = handleNotificationButton(data.id, buttonId)
    return cb(success)
  end
end)

-- Evento para receber nova notificação e enviar para a interface React
RegisterNetEvent("phone:sendNotification")
AddEventHandler("phone:sendNotification", function(notification)
  if not HasPhoneItem(currentPhone) or phoneDisabled then
    debugprint("no phone, not showing notification")
    return
  end

  if notification.content == nil then
    notification.content = notification.title
    notification.title = nil
  end

  if notification.customData and notification.customData.buttons and notification.id then
    notification.actions = notification.customData.buttons
    notificationsCache[notification.id] = notification
    notification.customData = nil
  end

  SendReactMessage("newNotification", notification)
end)

-- Export para enviar notificações
exports("SendNotification", function(notification)
  notification.id = "client-notification-" .. math.random()
  TriggerEvent("phone:sendNotification", notification)
end)
