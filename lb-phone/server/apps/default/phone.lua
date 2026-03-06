local blockedPlayers = {}
local activeCalls = {}
local callIdCounter = 0

-- Função para obter um contato específico
function GetContact(phoneNumber, contactNumber, callback)
  local queryParams = {
    contactNumber,
    phoneNumber,
    contactNumber
  }

  local query = [[
    SELECT
      CONCAT(firstname, ' ', lastname) AS `name`, profile_image AS avatar, firstname, lastname, email, address, contact_phone_number AS `number`, favourite,
      (IF((SELECT TRUE FROM phone_phone_blocked_numbers b WHERE b.phone_number=? AND b.blocked_number=`number`), TRUE, FALSE)) AS blocked
    FROM
      phone_phone_contacts
    WHERE
      contact_phone_number=? AND phone_number=?
  ]]

  if callback then
    return MySQL.single(query, queryParams, callback)
  else
    return MySQL.single.await(query, queryParams)
  end
end

-- Função para criar um novo contato
function CreateContact(phoneNumber, contactData)
  local affectedRows = MySQL.Sync.execute(
    [[
      INSERT INTO phone_phone_contacts (contact_phone_number, firstname, lastname, profile_image, email, address, phone_number)
      VALUES (@contactNumber, @firstname, @lastname, @avatar, @email, @address, @phoneNumber)
      ON DUPLICATE KEY UPDATE firstname=@firstname, lastname=@lastname, profile_image=@avatar, email=@email, address=@address
    ]],
    {
      ["@contactNumber"] = contactData.number,
      ["@firstname"] = contactData.firstname,
      ["@lastname"] = contactData.lastname or "",
      ["@avatar"] = contactData.avatar,
      ["@email"] = contactData.email,
      ["@address"] = contactData.address,
      ["@phoneNumber"] = phoneNumber
    }
  )

  return affectedRows > 0
end

-- Callback para salvar contato
BaseCallback("saveContact", function(source, phoneNumber, contactData)
  return CreateContact(phoneNumber, contactData)
end, false)

-- Callback para obter contatos
BaseCallback("getContacts", function(source, phoneNumber)
  return MySQL.query.await(
    [[
      SELECT contact_phone_number AS number, firstname, lastname, profile_image AS avatar, favourite,
        (IF((SELECT TRUE FROM phone_phone_blocked_numbers b WHERE b.phone_number=@phoneNumber AND b.blocked_number=`number`), TRUE, FALSE)) AS blocked
      FROM phone_phone_contacts c
      WHERE c.phone_number=@phoneNumber
    ]],
    { ["@phoneNumber"] = phoneNumber }
  )
end, {})

-- Callback para bloquear/desbloquear número
BaseCallback("toggleBlock", function(source, phoneNumber, numberToBlock, shouldBlock)
  local query =
  "INSERT INTO phone_phone_blocked_numbers (phone_number, blocked_number) VALUES (@phoneNumber, @number) ON DUPLICATE KEY UPDATE phone_number=@phoneNumber"

  if not shouldBlock then
    query = "DELETE FROM phone_phone_blocked_numbers WHERE phone_number=@phoneNumber AND blocked_number=@number"
  end

  MySQL.update.await(query, {
    ["@phoneNumber"] = phoneNumber,
    ["@number"] = numberToBlock
  })

  return shouldBlock
end, false)

-- Callback para favoritar/desfavoritar contato
BaseCallback("toggleFavourite", function(source, phoneNumber, contactNumber, shouldFavourite)
  MySQL.update.await(
    "UPDATE phone_phone_contacts SET favourite=@favourite WHERE contact_phone_number=@number AND phone_number=@phoneNumber",
    {
      ["@phoneNumber"] = phoneNumber,
      ["@number"] = contactNumber,
      ["@favourite"] = true == shouldFavourite
    }
  )

  return true
end, false)

-- Callback para remover contato
BaseCallback("removeContact", function(source, phoneNumber, contactNumber)
  MySQL.update.await(
    "DELETE FROM phone_phone_contacts WHERE contact_phone_number=? AND phone_number=?",
    { contactNumber, phoneNumber }
  )

  return true
end, false)

-- Callback para atualizar contato
BaseCallback("updateContact", function(source, phoneNumber, contactData)
  MySQL.update.await(
    "UPDATE phone_phone_contacts SET firstname=@firstname, lastname=@lastname, profile_image=@avatar, email=@email, address=@address, contact_phone_number=@newNumber WHERE contact_phone_number=@number AND phone_number=@phoneNumber",
    {
      ["@phoneNumber"] = phoneNumber,
      ["@number"] = contactData.oldNumber,
      ["@newNumber"] = contactData.number,
      ["@firstname"] = contactData.firstname,
      ["@lastname"] = contactData.lastname or "",
      ["@avatar"] = contactData.avatar,
      ["@email"] = contactData.email,
      ["@address"] = contactData.address
    }
  )

  return true
end, false)

-- Callback para obter chamadas recentes
BaseCallback("getRecentCalls", function(source, phoneNumber, onlyMissed, page)
  onlyMissed = true == onlyMissed

  local calls = MySQL.query.await(
    [[
      SELECT
        duration, answered, `timestamp`, IF(caller=@phoneNumber, callee, caller) AS `number`, IF(caller=@phoneNumber, true, false) AS called,
        IF(callee=@phoneNumber, hide_caller_id, FALSE) AS hideCallerId,
        (IF((SELECT TRUE FROM phone_phone_blocked_numbers b WHERE b.phone_number=@phoneNumber AND b.blocked_number=`number`), TRUE, FALSE)) AS blocked
      FROM phone_phone_calls
      WHERE callee=@phoneNumber ]] .. (onlyMissed and "AND answered=0" or "OR caller=@phoneNumber") .. [[
      ORDER BY `timestamp` DESC
      LIMIT @page, @perPage
    ]],
    {
      ["@phoneNumber"] = phoneNumber,
      ["@page"] = (page or 0) * 25,
      ["@perPage"] = 25
    }
  )

  for _, call in ipairs(calls) do
    call.hideCallerId = true == call.hideCallerId
    call.blocked = true == call.blocked
    call.called = true == call.called

    if call.hideCallerId then
      call.number = L("BACKEND.CALLS.NO_CALLER_ID")
    end
  end

  return calls
end, {})

-- Callback para obter números bloqueados
BaseCallback("getBlockedNumbers", function(source, phoneNumber)
  return MySQL.query.await(
    "SELECT blocked_number AS `number` FROM phone_phone_blocked_numbers WHERE phone_number=?",
    { phoneNumber }
  )
end, {})

-- Função para registrar uma chamada no histórico
function LogCall(callerNumber, calleeNumber, duration, wasAnswered, hideCallerId, callerSource)
  MySQL.insert(
    "INSERT INTO phone_phone_calls (caller, callee, duration, answered, hide_caller_id) VALUES (@caller, @callee, @duration, @answered, @hideCallerId)",
    {
      ["@caller"] = callerNumber,
      ["@callee"] = calleeNumber,
      ["@duration"] = duration,
      ["@answered"] = wasAnswered,
      ["@hideCallerId"] = hideCallerId
    }
  )

  if wasAnswered or callerSource == calleeNumber then
    return
  end

  local hasPhone = MySQL.scalar.await("SELECT TRUE FROM phone_phones WHERE phone_number = ?", { calleeNumber })
  if not hasPhone then
    return
  end

  if hideCallerId then
    SendNotification(calleeNumber, {
      app = "Phone",
      title = L("BACKEND.CALLS.NO_CALLER_ID"),
      content = L("BACKEND.CALLS.MISSED_CALL"),
      showAvatar = false
    })
    return
  end

  GetContact(callerNumber, calleeNumber, function(contact)
    SendNotification(calleeNumber, {
      app = "Phone",
      title = contact and contact.name or callerNumber,
      content = L("BACKEND.CALLS.MISSED_CALL"),
      avatar = contact and contact.avatar,
      showAvatar = true
    })
  end)

  -- SendMessage(callerNumber, calleeNumber, "<!CALL-NO-ANSWER!>")
end

-- Evento para registrar chamada
RegisterNetEvent("phone:logCall", function(calleeNumber, duration, wasAnswered)
  local source = source
  local callerNumber = GetEquippedPhoneNumber(source)

  if not (callerNumber and calleeNumber) or not duration then
    return
  end

  LogCall(callerNumber, calleeNumber, duration, wasAnswered, false, callerNumber)
end)

-- Função para gerar ID único para chamada
function GenerateCallId()
  local id = math.random(999999999)

  while activeCalls[id] do
    id = math.random(999999999)
  end

  return id
end

-- Função para verificar se jogador está em chamada
function IsPlayerInCall(playerSource)
  for callId, callData in pairs(activeCalls) do
    if (callData.caller and callData.caller.source == playerSource) or
        (callData.callee and callData.callee.source == playerSource) then
      return true, callId
    end
  end

  return false
end

-- Evento para desativar chamadas de empresa
RegisterNetEvent("phone:phone:disableCompanyCalls", function(shouldDisable)
  local source = source
  if shouldDisable then
    blockedPlayers[source] = true
  else
    blockedPlayers[source] = nil
  end
end)

-- Callback para iniciar chamada
BaseCallback("call", function(source, callerNumber, calleeData)
  debugprint("phone:phone:call", source, callerNumber, calleeData)

  local isInCall, _ = IsPlayerInCall(source)
  if isInCall then
    debugprint(source, "is in call, returning")
    return false
  end

  local callId = GenerateCallId()
  local callData = {
    started = os.time(),
    answered = false,
    videoCall = false,
    hideCallerId = true == calleeData.hideCallerId,
    callId = callId,
    caller = {
      source = source,
      number = callerNumber,
      nearby = {}
    }
  }

  if calleeData.company then
    if not Config.Companies.Enabled or calleeData.videoCall then
      debugprint("company calls are disabled in config or trying to call with video")
      TriggerClientEvent("phone:phone:userBusy", source)
      return false
    end

    local isValidCompany = false
    local companyName = calleeData.company

    if Config.Companies.Contacts[calleeData.company] then
      companyName = Config.Companies.Contacts[calleeData.company].name
      isValidCompany = true
    else
      for _, service in ipairs(Config.Companies.Services) do
        if service.job == calleeData.company then
          isValidCompany = true
          companyName = service.name
          break
        end
      end
    end

    if not isValidCompany then
      debugprint("invalid company (does not exist in Config.Companies.Contacts or Config.Companies.Services)")
      return false
    end

    if not Config.Companies.AllowAnonymous then
      callData.hideCallerId = false
    end

    callData.videoCall = false
    callData.company = calleeData.company
    callData.callee = { nearby = {} }

    local employees = GetEmployees(calleeData.company)
    debugprint("GetEmployees result:", employees)

    for _, employeeId in ipairs(employees) do
      local isEmployeeInCall = IsPlayerInCall(employeeId)
      if not isEmployeeInCall and employeeId ~= source and not blockedPlayers[employeeId] then
        TriggerClientEvent("phone:phone:setCall", employeeId, {
          callId = callId,
          number = callerNumber,
          company = calleeData.company,
          companylabel = calleeData.companylabel,
          hideCallerId = callData.hideCallerId
        })
      else
        debugprint("employee", employeeId, "is in call or have disabled company calls")
      end
    end
  else
    local isBlocked = MySQL.Sync.fetchScalar(
      [[
        SELECT TRUE FROM phone_phone_blocked_numbers WHERE
          (phone_number = @number1 AND blocked_number = @number2)
          OR (phone_number = @number2 AND blocked_number = @number1)
      ]],
      {
        ["@number1"] = callerNumber,
        ["@number2"] = calleeData.number
      }
    )

    if isBlocked then
      debugprint(source, "tried to call", calleeData.number, "but they are blocked")
      TriggerClientEvent("phone:phone:userBusy", source)
      return false
    end

    if calleeData.number == callerNumber then
      debugprint(source, "tried to call themselves")
      TriggerClientEvent("phone:phone:userBusy", source)
      return false
    end

    local calleeSource = GetSourceFromNumber(calleeData.number)
    local isCalleeInCall = calleeSource and IsPlayerInCall(calleeSource)

    if not calleeSource or isCalleeInCall or IsPhoneDead(calleeData.number) or HasAirplaneMode(calleeData.number) then
      LogCall(callerNumber, calleeData.number, 0, false, calleeData.hideCallerId)

      if isCalleeInCall then
        debugprint(source, "tried to call", calleeData.number, "but they are in call")
        TriggerClientEvent("phone:phone:userBusy", source)
      else
        debugprint(source, "tried to call", calleeData.number, "but they are not online / their phone is dead")
        TriggerClientEvent("phone:phone:userUnavailable", source)
      end

      return false
    end

    callData.callee = {
      source = calleeSource,
      number = calleeData.number,
      nearby = {}
    }

    debugprint(source, "is calling", calleeData.number, "with callId", callId)
    TriggerClientEvent("phone:phone:setCall", calleeSource, {
      callId = callId,
      number = callerNumber,
      videoCall = calleeData.videoCall,
      webRTC = calleeData.webRTC,
      hideCallerId = calleeData.hideCallerId
    })
  end

  activeCalls[callId] = callData
  TriggerEvent("lb-phone:newCall", callData)
  return callId
end)

-- Callback para responder chamada
BaseCallback("answerCall", function(source, _, callId)
  debugprint("phone:phone:answerCall", source, callId)

  local callData = activeCalls[callId]
  if not callData then
    debugprint("phone:phone:answerCall: invalid call id")
    return false
  end

  if callData.company then
    if callData.callee.source then
      return false
    end

    local employees = GetEmployees(callData.company)
    for _, employeeId in ipairs(employees) do
      local isEmployeeInCall = IsPlayerInCall(employeeId)
      if not isEmployeeInCall and employeeId ~= source and not blockedPlayers[employeeId] then
        TriggerClientEvent("phone:phone:endCall", employeeId, callId)
      end
    end

    callData.callee.source = source
  else
    if callData.callee.source ~= source then
      debugprint("phone:phone:answerCall: invalid source")
      return false
    end
  end

  local callerSource = callData.caller.source
  local calleeSource = callData.callee.source or source

  local callerState = Player(callerSource).state
  local calleeState = Player(calleeSource).state

  callerState.speakerphone = false
  calleeState.speakerphone = false
  callerState.mutedCall = false
  calleeState.mutedCall = false
  callerState.otherMutedCall = false
  calleeState.otherMutedCall = false
  callerState.onCallWith = calleeSource
  calleeState.onCallWith = callerSource
  callerState.callAnswered = true
  calleeState.callAnswered = true

  callData.answered = true

  TriggerClientEvent("phone:phone:connectCall", source, callId)
  TriggerClientEvent("phone:phone:connectCall", callerSource, callId, callData.exportCall == true)
  TriggerClientEvent("phone:phone:setCallEffect", source, callerSource, true)
  TriggerClientEvent("phone:phone:setCallEffect", callerSource, source, true)
  TriggerEvent("lb-phone:callAnswered", callData)

  debugprint("phone:phone:answerCall: answered call", callId)
  return true
end)

-- Callback para solicitar chamada de vídeo
BaseCallback("requestVideoCall", function(source, _, callId, isRequesting)
  if not callId or not activeCalls[callId] then
    debugprint("requestVideoCall: invalid call id", callId, json.encode(activeCalls, { indent = true }))
    return false
  end

  debugprint("requestVideoCall", source, callId, isRequesting)

  local callData = activeCalls[callId]
  if callData.videoCall or not callData.answered then
    return false
  end

  local otherParticipant = (callData.caller.source == source) and
      (callData.callee.source or callData.caller.source) or
      callData.caller.source

  callData.videoRequested = true
  TriggerClientEvent("phone:phone:videoRequested", otherParticipant, isRequesting)
end)

-- Callback para responder solicitação de vídeo
BaseCallback("answerVideoRequest", function(source, _, callId, shouldAccept)
  if not callId or not activeCalls[callId] then
    debugprint("answerVideoRequest: invalid call id")
    return false
  end

  debugprint("answerVideoRequest", source, callId, shouldAccept)

  local callData = activeCalls[callId]
  local otherParticipant = (callData.caller.source == source) and
      (callData.callee.source or callData.caller.source) or
      callData.caller.source

  if callData.videoCall or not callData.answered or not callData.videoRequested then
    return false
  end

  callData.videoRequested = false
  callData.videoCall = true == shouldAccept
  TriggerClientEvent("phone:phone:videoRequestAnswered", otherParticipant, shouldAccept)
  return true
end)

-- Callback para parar chamada de vídeo
BaseCallback("stopVideoCall", function(source, _, callId)
  if not callId or not activeCalls[callId] then
    debugprint("stopVideoCall: invalid call id")
    return false
  end

  local callData = activeCalls[callId]
  local otherParticipant = (callData.caller.source == source) and
      (callData.callee.source or callData.caller.source) or
      callData.caller.source

  if not callData.videoCall or not callData.answered then
    return false
  end

  callData.videoCall = false
  TriggerClientEvent("phone:phone:stopVideoCall", source)
  TriggerClientEvent("phone:phone:stopVideoCall", otherParticipant)
  return true
end)

-- Função para encerrar chamada
function EndCall(playerSource, callback)
  local isInCall, callId = IsPlayerInCall(playerSource)
  debugprint("^5EndCall^7:", playerSource, isInCall, callId)

  if not isInCall or not callId or not activeCalls[callId] then
    if callback then callback(false) end
    debugprint("^5EndCall^7: not in call/invalid callId")
    return false
  end

  local callData = activeCalls[callId]
  local callerSource = callData.caller.source
  local calleeSource = callData.callee and callData.callee.source

  if calleeSource then
    debugprint("^5EndCall^7: ending call for callee", callId, calleeSource)
    TriggerClientEvent("phone:phone:endCall", calleeSource)
    TriggerClientEvent("phone:phone:removeVoiceTarget", -1, calleeSource, true)
    TriggerClientEvent("phone:phone:removeVoiceTarget", -1, callerSource, true)
    TriggerClientEvent("phone:phone:setCallEffect", calleeSource, callerSource, false)
    TriggerClientEvent("phone:phone:setCallEffect", callerSource, calleeSource, false)
  elseif callData.company then
    local employees = GetEmployees(callData.company)
    for _, employeeId in ipairs(employees) do
      local isEmployeeInCall = IsPlayerInCall(employeeId)
      if not isEmployeeInCall and employeeId ~= playerSource and not blockedPlayers[employeeId] then
        TriggerClientEvent("phone:phone:endCall", employeeId, callId)
      end
    end
  end

  if callerSource then
    debugprint("^5EndCall^7: ending call for caller", callId, callerSource)
    TriggerClientEvent("phone:phone:endCall", callerSource)
  end

  -- Reset player states
  for _, src in ipairs({ callerSource, calleeSource }) do
    if src then
      local playerState = Player(src).state
      if playerState then
        playerState.onCallWith = nil
        playerState.speakerphone = false
        playerState.mutedCall = false
        playerState.otherMutedCall = false
        playerState.callAnswered = false
      end
    end
  end

  -- Remove voice targets
  local callerNearby = callData.caller.nearby or {}
  local calleeNearby = callData.callee and callData.callee.nearby or {}

  if calleeSource then
    for _, nearbyPlayer in ipairs(callerNearby) do
      TriggerClientEvent("phone:phone:removeVoiceTarget", calleeSource, nearbyPlayer, true)
      TriggerClientEvent("phone:phone:removeVoiceTarget", nearbyPlayer, calleeSource, true)
    end
  end

  if callerSource then
    for _, nearbyPlayer in ipairs(calleeNearby) do
      TriggerClientEvent("phone:phone:removeVoiceTarget", callerSource, nearbyPlayer, true)
      TriggerClientEvent("phone:phone:removeVoiceTarget", nearbyPlayer, callerSource, true)
    end
  end

  -- Log the call if not a company call
  if not callData.company then
    LogCall(
      callData.caller.number,
      callData.callee.number,
      os.time() - callData.started,
      callData.answered,
      callData.hideCallerId,
      GetEquippedPhoneNumber(playerSource))
  end

  TriggerEvent("lb-phone:callEnded", callData)

  Log("Calls", callData.caller.source, "info",
    L("BACKEND.LOGS.CALL_ENDED"),
    L("BACKEND.LOGS.CALL_DESCRIPTION", {
      duration = os.time() - callData.started,
      caller = FormatNumber(callData.caller.number),
      callee = callData.callee.number and FormatNumber(callData.callee.number) or callData.company,
      answered = callData.answered
    })
  )

  activeCalls[callId] = nil
  if callback then callback(true) end
  return true
end

-- Evento para encerrar chamada
RegisterNetEvent("phone:endCall", function()
  local source = source
  EndCall(source)
end)

-- Callback para obter correios de voz recentes
BaseCallback("getRecentVoicemails", function(source, phoneNumber, page)
  return MySQL.query.await(
    [[
      SELECT id, IF(hide_caller_id, null, caller) AS `number`, url, duration, hide_caller_id AS hideCallerId, `timestamp`
      FROM phone_phone_voicemail
      WHERE callee = ?
      ORDER BY `timestamp` DESC
      LIMIT ?, ?
    ]],
    { phoneNumber, (page or 0) * 25, 25 }
  )
end, {})

-- Callback para deletar correio de voz
BaseCallback("deleteVoiceMail", function(source, phoneNumber, voicemailId)
  local affectedRows = MySQL.update.await(
    "DELETE FROM phone_phone_voicemail WHERE id = ? AND callee = ?",
    { voicemailId, phoneNumber }
  )

  return affectedRows > 0
end)

-- Callback para enviar correio de voz
BaseCallback("sendVoicemail", function(source, callerNumber, voicemailData)
  MySQL.insert.await(
    "INSERT INTO phone_phone_voicemail (caller, callee, url, duration, hide_caller_id) VALUES (@caller, @callee, @url, @duration, @hideCallerId)",
    {
      ["@caller"] = callerNumber,
      ["@callee"] = voicemailData.number,
      ["@url"] = voicemailData.src,
      ["@duration"] = voicemailData.duration,
      ["@hideCallerId"] = true == voicemailData.hideCallerId
    }
  )

  SendNotification(voicemailData.number, {
    app = "Phone",
    title = L("BACKEND.CALLS.NEW_VOICEMAIL")
  })

  return true
end)

-- Função para verificar modo avião
function HasAirplaneMode(phoneNumber)
  debugprint("checking if", phoneNumber, "has airplane mode enabled")
  local settings = GetSettings(phoneNumber)
  if not settings then
    debugprint("no settings found for", phoneNumber)
    return
  end
  return settings.airplaneMode
end

exports("HasAirplaneMode", HasAirplaneMode)

-- Export para criar chamada
exports("CreateCall", function(callerData, calleeNumber, options)
  assert(type(callerData) == "table", "caller must be a table")
  assert(type(callerData.source) == "number", "caller.source must be a number")
  assert(type(callerData.phoneNumber) == "string", "caller.phoneNumber must be a string")
  assert(type(calleeNumber) == "string", "callee/options.company must be a string")

  if not options then options = {} end
  assert(type(options) == "table", "options must be a table or nil")

  local callerSource = callerData.source
  local callerNumber = callerData.phoneNumber
  local callerName = GetPlayerName(callerSource)

  if not callerName then
    debugprint("CreateCall: callerSrc is not a valid player")
    return
  end

  if options.requirePhone then
    if IsPhoneDead(callerNumber) or not HasPhoneItem(callerSource, callerNumber) then
      debugprint("CreateCall: caller does not have a phone")
      return
    end
  end

  if IsPlayerInCall(callerSource) then
    debugprint("CreateCall: caller is already in a call")
    return
  end

  local callId = GenerateCallId()
  local callData = {
    started = os.time(),
    answered = false,
    videoCall = false,
    hideCallerId = true == options.hideNumber,
    callId = callId,
    caller = {
      source = callerSource,
      number = callerNumber
    },
    exportCall = true
  }

  if options.company then
    if not Config.Companies.Enabled then
      debugprint("company calls are disabled in config")
      return
    end

    local isValidCompany = false
    local companyName = options.company

    if Config.Companies.Contacts[options.company] then
      companyName = Config.Companies.Contacts[options.company].name
      isValidCompany = true
    else
      for _, service in ipairs(Config.Companies.Services) do
        if service.job == options.company then
          isValidCompany = true
          companyName = service.name
          break
        end
      end
    end

    if not isValidCompany then
      debugprint("invalid company")
      return
    end

    callData.company = options.company
    callData.callee = {}

    local employees = GetEmployees(options.company)
    for _, employeeId in ipairs(employees) do
      local isEmployeeInCall = IsPlayerInCall(employeeId)
      if not isEmployeeInCall and employeeId ~= callerSource and not blockedPlayers[employeeId] then
        TriggerClientEvent("phone:phone:setCall", employeeId, {
          callId = callId,
          number = callerNumber,
          company = options.company,
          companylabel = companyName,
          hideCallerId = callData.hideCallerId
        })
      end
    end
  else
    local calleeSource = GetSourceFromNumber(calleeNumber)
    if not calleeSource then
      debugprint("CreateCall: calleeSrc is not a valid player")
      return
    end

    if IsPlayerInCall(calleeSource) then
      debugprint("CreateCall: caller or callee is in call")
      return
    end

    callData.callee = {
      source = calleeSource,
      number = calleeNumber
    }

    TriggerClientEvent("phone:phone:setCall", calleeSource, {
      callId = callId,
      number = callerNumber,
      hideCallerId = callData.hideCallerId
    })
  end

  activeCalls[callId] = callData
  TriggerEvent("lb-phone:newCall", callData)
  TriggerClientEvent("phone:phone:enableExportCall", callerSource)
  return callId
end)

-- Export para obter dados da chamada
exports("GetCall", function(callId)
  return activeCalls[callId]
end)

-- Export para adicionar contato
exports("AddContact", function(phoneNumber, contactData)
  assert(type(phoneNumber) == "string", "phoneNumber must be a string")
  assert(type(contactData) == "table", "data must be a table")

  local success = CreateContact(phoneNumber, contactData)
  debugprint("AddContact: success", success)

  local playerSource = GetSourceFromNumber(phoneNumber)
  if playerSource and success then
    TriggerClientEvent("phone:phone:contactAdded", playerSource, contactData)
  end
end)

exports("EndCall", EndCall)
exports("IsInCall", IsPlayerInCall)

-- Eventos para controle de chamada
RegisterNetEvent("phone:phone:toggleMute", function(shouldMute)
  local source = source
  local playerState = Player(source).state
  playerState.mutedCall = true == shouldMute

  local isInCall, callId = IsPlayerInCall(source)
  if isInCall then
    local callData = activeCalls[callId]
    local otherParticipant = (callData.caller.source == source) and
        (callData.callee.source or callData.caller.source) or
        callData.caller.source

    Player(otherParticipant).state.otherMutedCall = true == shouldMute
  end
end)

RegisterNetEvent("phone:phone:toggleSpeaker", function(shouldEnable)
  Player(source).state.speakerphone = true == shouldEnable
end)

RegisterNetEvent("phone:phone:enteredCallProximity", function(callParticipant)
  local source = source
  local isInCall, callId = IsPlayerInCall(callParticipant)

  if not isInCall then return end

  local callData = activeCalls[callId]
  if not callData.answered then return end

  local isCaller = callData.caller.source == callParticipant
  local nearbyList = isCaller and callData.caller.nearby or callData.callee.nearby
  local otherParticipant = isCaller and
      (callData.callee.source or callData.caller.source) or
      callData.caller.source

  TriggerClientEvent("phone:phone:addVoiceTarget", otherParticipant, source, true, true)
  TriggerClientEvent("phone:phone:addVoiceTarget", source, otherParticipant, false, true)

  if table.contains(nearbyList, source) then return end

  nearbyList[#nearbyList + 1] = source
end)

RegisterNetEvent("phone:phone:leftCallProximity", function(callParticipant)
  local source = source
  local isInCall, callId = IsPlayerInCall(callParticipant)

  if not isInCall then return end

  local callData = activeCalls[callId]
  if not callData.answered then return end

  local isCaller = callData.caller.source == callParticipant
  local nearbyList = isCaller and callData.caller.nearby or callData.callee.nearby
  local index = table.find(nearbyList, source)

  if index then
    local otherParticipant = isCaller and
        (callData.callee.source or callData.caller.source) or
        callData.caller.source

    TriggerClientEvent("phone:phone:removeVoiceTarget", otherParticipant, source, true)
    TriggerClientEvent("phone:phone:removeVoiceTarget", source, otherParticipant, true)
    table.remove(nearbyList, index)
  end
end)

RegisterNetEvent("phone:phone:listenToPlayer", function(targetPlayer)
  local source = source
  debugprint(source, "started listening to", targetPlayer)

  TriggerClientEvent("phone:phone:addVoiceTarget", source, targetPlayer, true, true)
  TriggerClientEvent("phone:phone:addVoiceTarget", targetPlayer, source, false, true)
end)

RegisterNetEvent("phone:phone:stopListeningToPlayer", function(targetPlayer)
  local source = source
  debugprint(source, "stopped listening to to", targetPlayer)

  TriggerClientEvent("phone:phone:removeVoiceTarget", source, targetPlayer)
  TriggerClientEvent("phone:phone:removeVoiceTarget", targetPlayer, source)
end)

-- Limpeza quando jogador desconectar
AddEventHandler("playerDropped", function()
  local source = source
  blockedPlayers[source] = nil
  EndCall(source)
end)
