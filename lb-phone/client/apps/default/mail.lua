local currentMail = nil

local function processMailData(mailData)
  if not mailData then
    return false
  end

  if not mailData.attachments then
    mailData.attachments = {}
  else
    mailData.attachments = json.decode(mailData.attachments)
  end

  if not mailData.actions then
    mailData.actions = {}
  else
    mailData.actions = json.decode(mailData.actions)
  end

  return mailData
end

RegisterNUICallback("Mail", function(data, callback)
  local action = data.action
  debugprint("Mail:" .. (action or ""))

  if action == "isLoggedIn" then
    TriggerCallback("mail:isLoggedIn", callback)
  elseif action == "createMail" then
    TriggerCallback(
      "mail:createAccount",
      callback,
      data.data.email,
      data.data.password
    )
  elseif action == "changePassword" then
    TriggerCallback(
      "mail:changePassword",
      callback,
      data.oldPassword,
      data.newPassword
    )
  elseif action == "deleteAccount" then
    TriggerCallback(
      "mail:deleteAccount",
      callback,
      data.password
    )
  elseif action == "login" then
    TriggerCallback(
      "mail:login",
      callback,
      data.data.email,
      data.data.password
    )
  elseif action == "logout" then
    TriggerCallback("mail:logout", callback)
  elseif action == "getMails" then
    TriggerCallback(
      "mail:getMails",
      callback,
      data.page
    )
  elseif action == "getMail" then
    TriggerCallback("mail:getMail", function(mail)
      currentMail = processMailData(mail)
      callback(currentMail)
    end, data.id)
  elseif action == "search" then
    TriggerCallback(
      "mail:search",
      callback,
      data.query,
      data.page
    )
  elseif action == "sendMail" then
    TriggerCallback(
      "mail:sendMail",
      callback,
      data.data
    )
  elseif action == "deleteMail" then
    TriggerCallback(
      "mail:deleteMail",
      callback,
      data.id
    )
  elseif action == "action" then
    if currentMail.id ~= data.id then
      debugprint("wrong mail id for action")
      return
    end

    local actionId = (data.actionId or 0) + 1
    local actionData = currentMail.actions[actionId] and currentMail.actions[actionId].data

    if not actionData then
      debugprint("no action found", actionId)
      return
    end

    if actionData.data and actionData.data.qbMail then
      TriggerEvent(actionData.event, actionData.data.data)
      callback("ok")
      return
    end

    if actionData.isServer then
      TriggerServerEvent(actionData.event, data.id, actionData.data)
    else
      TriggerEvent(actionData.event, data.id, actionData.data)
    end

    callback("ok")
  end
end)

RegisterNetEvent("phone:mail:newMail", function(mailData)
  SendReactMessage("mail:newMail", mailData)
end)

RegisterNetEvent("phone:mail:mailDeleted", function(mailId)
  SendReactMessage("mail:deleteMail", mailId)
end)
