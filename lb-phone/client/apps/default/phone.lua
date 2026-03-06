local InExportCall = false
local isInCustomCall = false
local callId = nil
local isInCall = false
local customCallData = nil
local callStartTime = 0
local isCallAnswered = false
local customNumbers = {}

function EndCustomCall()
  debugprint("EndCustomCall triggered")
  if customCallData then
    local callDuration = math.floor((GetGameTimer() - callStartTime) / 1000 + 0.5)
    debugprint("Custom call to", customCallData.number, "ended after", callDuration, "seconds", "answered:",
      isCallAnswered)
    TriggerServerEvent("phone:logCall", customCallData.number, callDuration)
  end

  isInCall = false
  customCallData = nil
  callId = nil
  callStartTime = 0
  isCallAnswered = false
  SetPhoneAction("default")
  SendReactMessage("call:endCall")

  if not phoneOpen then
    PlayCloseAnim()
  end
end

function StartCustomCall(number)
  local callInfo = customNumbers[number]
  if not callInfo then
    return false
  end

  local tempCallId = "CUSTOM_NUMBER_" .. math.random(9999999)
  isInCall = true
  callId = tempCallId
  customCallData = callInfo
  callStartTime = GetGameTimer()
  isCallAnswered = false

  Citizen.CreateThreadNow(function()
    callInfo.onCall({
      id = tempCallId,
      accept = function()
        if not isCallAnswered and callId == tempCallId then
          isCallAnswered = true
          SetPhoneAction("call")
          SendReactMessage("call:connected")
        end
      end,
      deny = function()
        if callId == tempCallId then
          EndCustomCall()
        end
      end,
      setName = function(name)
        if callId == tempCallId then
          SendReactMessage("call:setContactData", { name = name })
        end
      end,
      hasEnded = function()
        return callId ~= tempCallId
      end
    })
  end)

  return true
end

function HandleCallAction(action)
  if not customCallData then
    return
  end

  if action == "end" then
    if customCallData.onEnd then
      Citizen.CreateThreadNow(customCallData.onEnd)
    end
    EndCustomCall()
    return
  end

  local isKeypad = action:find("keypad_")
  if isKeypad then
    if not customCallData.onKeypad then
      return
    end
    local key = action:sub(8)
    if not key then
      return
    end
    Citizen.CreateThreadNow(function()
      customCallData.onKeypad(key)
    end)
    return
  end

  if customCallData.onAction then
    customCallData.onAction(action)
  end
end

RegisterNUICallback("Phone", function(data, cb)
  if not currentPhone then
    return
  end

  local action = data.action
  debugprint("Phone:", action or "")

  if action == "getContacts" then
    TriggerCallback("getContacts", function(contacts)
      if Config.Companies.Enabled then
        for companyName, companyData in pairs(Config.Companies.Contacts) do
          contacts[#contacts + 1] = {
            firstname = companyData.name,
            avatar = companyData.photo,
            company = companyName
          }
        end
      end
      cb(contacts)
    end)
  elseif action == "toggleFavourite" then
    TriggerCallback("toggleFavourite", cb, data.number, data.favourite)
  elseif action == "toggleBlock" then
    TriggerCallback("toggleBlock", cb, data.number, data.blocked)
  elseif action == "removeContact" then
    TriggerCallback("removeContact", cb, data.number)
  elseif action == "updateContact" then
    TriggerCallback("updateContact", cb, data.data)
  elseif action == "saveContact" then
    TriggerCallback("saveContact", cb, data.data)
  elseif action == "getRecent" then
    TriggerCallback("getRecentCalls", cb, data.missed == true, data.page)
  elseif action == "getBlockedNumbers" then
    TriggerCallback("getBlockedNumbers", function(blockedNumbers)
      local numbers = {}
      for k, v in pairs(blockedNumbers) do
        numbers[k] = v.number
      end
      cb(numbers)
    end)
  elseif action == "toggleMute" then
    if not callId then
      cb(false)
    elseif customCallData then
      HandleCallAction(data.toggle and "mute" or "unmute")
      cb(data.toggle)
    else
      if data.toggle then
        RemoveFromCall(callId)
      else
        AddToCall(callId)
      end
      TriggerServerEvent("phone:phone:toggleMute", data.toggle)
      cb(data.toggle)
    end
  elseif action == "toggleSpeaker" then
    if not callId then
      cb(false)
    elseif customCallData then
      HandleCallAction(data.toggle and "enable_speaker" or "disable_speaker")
      cb(data.toggle)
    else
      TriggerServerEvent("phone:phone:toggleSpeaker", data.toggle)
      ToggleSpeaker(data.toggle)
      cb(data.toggle)
    end
  elseif action == "sendVoicemail" then
    TriggerCallback("sendVoicemail", cb, data.data)
  elseif action == "getVoiceMails" then
    TriggerCallback("getRecentVoicemails", cb, data.page)
  elseif action == "deleteVoiceMail" then
    TriggerCallback("deleteVoiceMail", cb, data.id)
  elseif action == "keypad" then
    cb("ok")
    if customCallData then
      HandleCallAction("keypad_" .. data.key)
    end
  end

  if action == "call" then
    if StartCustomCall(data.number) then
      cb("CUSTOM_NUMBER")
    elseif data.company then
      if not Config.Companies.Enabled or data.videoCall then
        return
      end

      local companyValid = false
      local companyLabel = data.company
      local companyData = Config.Companies.Contacts[data.company]

      if companyData then
        companyLabel = companyData.name
        companyValid = true
      else
        for _, service in ipairs(Config.Companies.Services) do
          if service.job == data.company then
            companyValid = true
            companyLabel = service.name
            break
          end
        end
      end

      if not companyValid then
        return
      end

      debugprint("CreateCall: company", data)
      SendReactMessage("call", {
        company = data.company,
        companylabel = companyLabel,
        hideCallerId = data.hideNumber == true
      })
    else
      debugprint("CreateCall: number", data)
      SendReactMessage("call", {
        number = data.number,
        videoCall = data.videoCall == true,
        hideCallerId = data.hideNumber == true
      })
    end
    InExportCall = data.videoCall
    TriggerCallback("call", cb, data)
  elseif action == "answerCall" then
    if IsInCall() then
      debugprint("answerCall: Already in call")
      return
    end

    if IsLive() then
      debugprint("answerCall: Ending live")
      TriggerCallback("instagram:endLive")
    elseif IsWatchingLive() then
      debugprint("answerCall: Leaving live")
      SendReactMessage("instagram:liveEnded", IsWatchingLive())
    end

    debugprint("Answering call", data.callId)
    TriggerCallback("answerCall", cb, data.callId)
    cb("ok")
  elseif action == "endCall" then
    EndCall()
    cb("ok")
  elseif action == "flipCamera" then
    ToggleSelfieCam(not IsSelfieCam())
  elseif action == "requestVideoCall" then
    TriggerCallback("requestVideoCall", cb, data.callId, data.peerId)
  elseif action == "answerVideoRequest" then
    TriggerCallback("answerVideoRequest", cb, data.callId, data.accept)
    if data.accept then
      InExportCall = true
      EnableWalkableCam()
    end
  elseif action == "stopVideoCall" then
    TriggerCallback("stopVideoCall", cb, data.callId)
  end
end)

function EndCall()
  TriggerServerEvent("phone:endCall")
  if customCallData then
    HandleCallAction("end")
  end
end

RegisterNetEvent("phone:phone:setCall", function(callData)
  if not HasPhoneItem(currentPhone) or phoneDisabled then
    debugprint("no phone, not showing call")
    return
  end

  if customCallData or isInCustomCall then
    debugprint("in a (custom?) call", tostring(customCallData), tostring(isInCustomCall))
    return
  end

  if IsPedDeadOrDying(PlayerPedId(), false) then
    debugprint("player is dead, not showing call")
    return
  elseif CanOpenPhone and not CanOpenPhone() then
    debugprint("can't open phone, not showing call")
    return
  end

  InExportCall = callData.videoCall
  SendReactMessage("incomingCall", callData)
end)

RegisterNetEvent("phone:phone:enableExportCall", function()
  InExportCall = true
end)

RegisterNetEvent("phone:phone:connectCall", function(id, noUI)
  debugprint("phone:phone:connectCall", id, noUI)
  isInCall = true
  callId = id
  AddToCall(id)

  if noUI then
    return
  end

  SetPhoneAction("call")
  SendReactMessage("call:connected")

  if InExportCall then
    EnableWalkableCam()
  end
end)

RegisterNetEvent("phone:phone:endCall", function()
  debugprint("phone:phone:endCall")
  isInCall = false
  InExportCall = false
  SetPhoneAction("default")
  DisableWalkableCam()

  if not phoneOpen and isInCall then
    debugprint("close anim")
    PlayCloseAnim()
  end

  RemoveFromCall(callId)
  callId = nil
  InExportCall = false
  SendReactMessage("call:endCall")
end)

RegisterNetEvent("phone:phone:userUnavailable", function()
  debugprint("phone:phone:userUnavailable")
  SendReactMessage("call:userUnavailable")
end)

RegisterNetEvent("phone:phone:userBusy", function()
  debugprint("phone:phone:userBusy")
  SendReactMessage("call:userBusy")
end)

function IsInCall()
  return isInCall
end

exports("IsInCall", IsInCall)

exports("AddContact", function(contact)
  assert(type(contact) == "table", "contact must be a table")
  assert(type(contact.number) == "string", "contact.number must be a string")
  assert(type(contact.firstname) == "string", "contact.firstname must be a string")

  local success = AwaitCallback("saveContact", contact)
  if success then
    SendReactMessage("phone:contactAdded", contact)
  end
  return success
end)

RegisterNetEvent("phone:phone:videoRequested", function(data)
  debugprint("phone:phone:videoRequested", data)
  SendReactMessage("call:videoRequested", data)
end)

RegisterNetEvent("phone:phone:videoRequestAnswered", function(accepted)
  debugprint("phone:phone:videoRequestAnswered", accepted)
  SendReactMessage("call:videoRequestAnswered", accepted)
  if accepted then
    InExportCall = true
    EnableWalkableCam()
  end
end)

RegisterNetEvent("phone:phone:stopVideoCall", function()
  debugprint("phone:phone:stopVideoCall")
  SendReactMessage("call:stopVideoCall")
  InExportCall = false
  DisableWalkableCam()
end)

RegisterNetEvent("phone:phone:contactAdded", function(contact)
  debugprint("phone:phone:contactAdded", contact)
  SendReactMessage("phone:contactAdded", contact)
end)

function CreateCall(options)
  assert(type(options) == "table", "options must be a table")
  assert(options.number or options.company, "options must contain either a number or company")

  if not currentPhone then
    debugprint("no phone")
    return
  end

  if options.company then
    if not Config.Companies.Enabled then
      debugprint("company calls are disabled in config")
      return
    end

    local isValid = false
    local companyLabel = options.company
    local companyData = Config.Companies.Contacts[options.company]

    if companyData then
      companyLabel = companyData.name
      isValid = true
    else
      for _, service in ipairs(Config.Companies.Services) do
        if service.job == options.company then
          isValid = true
          companyLabel = service.name
          break
        end
      end
    end

    if not isValid then
      debugprint("invalid company")
      return
    end

    debugprint("CreateCall: company", options)
    SendReactMessage("call", {
      company = options.company,
      companylabel = companyLabel,
      hideCallerId = options.hideNumber == true
    })
  else
    debugprint("CreateCall: number", options)
    SendReactMessage("call", {
      number = options.number,
      videoCall = options.videoCall == true,
      hideCallerId = options.hideNumber == true
    })
  end
end

exports("CreateCall", CreateCall)

exports("CreateCustomNumber", function(number, data)
  local resource = GetInvokingResource()
  assert(type(number) == "string", "number must be a string")
  assert(type(data) == "table", "data must be a table")
  assert(type(data.onCall) == "function", "data.onCall must be a function")

  if customNumbers[number] then
    return false, "Number already exists"
  end

  customNumbers[number] = {
    resource = resource,
    number = number,
    onCall = data.onCall,
    onEnd = data.onEnd,
    onAction = data.onAction,
    onKeypad = data.onKeypad
  }

  return true
end)

exports("RemoveCustomNumber", function(number)
  local resource = GetInvokingResource()
  assert(type(number) == "string", "number must be a string")

  if not customNumbers[number] then
    return false, "Number does not exist"
  end

  if customNumbers[number].resource ~= resource then
    return false, "Number was not created by " .. resource
  end

  customNumbers[number] = nil
  return true
end)

exports("EndCustomCall", function()
  if customCallData then
    EndCustomCall()
    return true
  end
  return false
end)

AddEventHandler("onResourceStop", function(resource)
  if resource == GetCurrentResourceName() then
    return
  end

  for number, data in pairs(customNumbers) do
    if data.resource == resource then
      debugprint("Removed custom number", number, "due to resource stopping")
      if customCallData == data then
        HandleCallAction("end")
      end
      customNumbers[number] = nil
    end
  end
end)
