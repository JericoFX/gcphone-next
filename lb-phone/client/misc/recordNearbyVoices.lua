local getEntityCoords = GetEntityCoords
local activeListeners = {}

-- Atualiza a lista de players próximos que estão sendo escutados e gerencia canais de voz
local function updateNearbyListeners()
  local nearbyListeners = {}
  local nearbyPlayers = GetNearbyPlayers()
  local playerCoords = getEntityCoords(PlayerPedId())

  for i = 1, #nearbyPlayers do
    local player = nearbyPlayers[i]
    local playerState = Player(player.source).state
    local listeningPeerId = playerState and playerState.listeningPeerId

    if listeningPeerId then
      local pedCoords = getEntityCoords(player.ped)
      local dist = #(playerCoords - pedCoords)
      if dist <= 25.0 then
        local listenerData = {
          source = player.source,
          ped = player.ped,
          channel = listeningPeerId
        }
        table.insert(nearbyListeners, listenerData)

        -- Atualiza volume se já estiver na lista ativa
        for j = 1, #activeListeners do
          if activeListeners[j].source == player.source then
            nearbyListeners[#nearbyListeners].volume = activeListeners[j].volume
            goto continue_loop
          end
        end

        -- Se não estava na lista, obtém o volume de voz e envia comando para React
        local volume = GetVoiceVolume(dist)
        nearbyListeners[#nearbyListeners].volume = volume
        SendReactMessage("voice:joinChannel", {
          channel = listeningPeerId,
          volume = volume
        })
      end
    end
    ::continue_loop::
  end

  activeListeners = nearbyListeners
end

-- Atualiza volumes para listeners ativos
local function updateVolumes()
  local playerCoords = getEntityCoords(PlayerPedId())

  for i = 1, #activeListeners do
    local listener = activeListeners[i]
    local pedCoords = getEntityCoords(listener.ped)
    local dist = #(playerCoords - pedCoords)
    local currentVolume = GetVoiceVolume(dist)

    if listener.volume ~= currentVolume then
      listener.volume = currentVolume
      SendReactMessage("voice:setVolume", {
        channel = listener.channel,
        volume = currentVolume
      })
    end
  end
end

-- Configuração para ativar se gravação de voz próxima estiver habilitada
if not Config.Voice.RecordNearby then
  return
end

-- Thread para atualizar lista de listeners próximos a cada 1 segundo
CreateThread(function()
  while true do
    Wait(1000)
    updateNearbyListeners()
  end
end)

-- Thread para atualizar volumes de listeners ativos a cada 50ms (ou esperar 500ms se nenhum listener)
CreateThread(function()
  while true do
    if #activeListeners > 0 then
      updateVolumes()
      Wait(50)
    else
      Wait(500)
    end
  end
end)

-- Evento para iniciar a escuta de um canal de voz de um player específico
RegisterNetEvent("phone:startedListening")
AddEventHandler("phone:startedListening", function(serverId, channel)
  local playerIndex = GetPlayerFromServerId(serverId)
  if not playerIndex or playerIndex == PlayerId() or playerIndex == -1 then return end

  local localPed = PlayerPedId()
  local targetPed = GetPlayerPed(playerIndex)
  local dist = #(getEntityCoords(localPed) - getEntityCoords(targetPed))

  if not DoesEntityExist(targetPed) or targetPed == localPed or dist > 25.0 then
    return
  end

  for i = 1, #activeListeners do
    if activeListeners[i].source == serverId then
      return -- Já está escutando esse player
    end
  end

  table.insert(activeListeners, {
    source = serverId,
    ped = targetPed,
    channel = channel,
    volume = GetVoiceVolume(dist)
  })

  SendReactMessage("voice:joinChannel", {
    channel = channel,
    volume = GetVoiceVolume(dist)
  })
end)

-- Evento para parar de escutar um canal de voz
RegisterNetEvent("phone:stoppedListening")
AddEventHandler("phone:stoppedListening", function(channel)
  SendReactMessage("voice:leaveChannel", channel)
end)

-- Callback NUI para configurar o peerId que está sendo escutado
RegisterNUICallback("setListeningPeerId", function(data, cb)
  TriggerServerEvent("phone:setListeningPeerId", data)
  cb("ok")
end)

-- Callback NUI para obter configurações de voz
RegisterNUICallback("voice:getConfig", function(_, cb)
  cb({
    recordNearbyVoices = Config.Voice.RecordNearby,
    rtc = Config.RTCConfig
  })
end)
