local isHearNearbyEnabled = Config.Voice.HearNearby
if not isHearNearbyEnabled then
  return
end

local liveProximityPlayers = {}

-- Marca um jogador que entrou na proximidade de live
local function enterLiveProximity(playerId)
  if not liveProximityPlayers[playerId] then
    liveProximityPlayers[playerId] = true
    debugprint("entered live", playerId)
    TriggerServerEvent("phone:instagram:enteredLiveProximity", playerId)
  end
end

-- Marca um jogador que saiu da proximidade de live
local function leaveLiveProximity(playerId)
  if liveProximityPlayers[playerId] then
    liveProximityPlayers[playerId] = nil
    debugprint("left live 1", playerId)
    TriggerServerEvent("phone:instagram:leftLiveProximity", playerId)
  end
end

RegisterNetEvent("phone:instagram:endLive")
AddEventHandler("phone:instagram:endLive", function(playerId, newPlayerId)
  if not newPlayerId then
    liveProximityPlayers[playerId] = nil
    debugprint("left live 2", playerId)
    return
  end
  if liveProximityPlayers[playerId] then
    liveProximityPlayers[playerId] = nil
    TriggerServerEvent("phone:instagram:leftLiveProximity", newPlayerId, true)
  end
end)

local listeningToPlayers = {}

-- Começa a escutar um jogador (via voz)
local function startListeningToPlayer(playerId)
  if not playerId then return end
  if table.contains(listeningToPlayers, playerId) then return end

  debugprint("started listening to", playerId)
  TriggerServerEvent("phone:phone:listenToPlayer", playerId)
  table.insert(listeningToPlayers, playerId)
  return true
end

-- Para de escutar um jogador
local function stopListeningToPlayer(playerId)
  if not playerId then return end
  local index = table.contains(listeningToPlayers, playerId)
  if not index then return end

  debugprint("stopped listening to", playerId)
  TriggerServerEvent("phone:phone:stopListeningToPlayer", playerId)
  table.remove(listeningToPlayers, index)
  return true
end

local talkingToPlayers = {}

-- Para de falar com um jogador
local function stopTalkingToPlayer(playerId)
  if not playerId then return end
  local index = table.contains(talkingToPlayers, playerId)
  if not index then return end

  debugprint("started talking to", playerId)
  TriggerServerEvent("phone:phone:leftCallProximity", playerId)
  table.remove(talkingToPlayers, index)
  return true
end

-- Começa a falar com um jogador
local function startTalkingToPlayer(playerId)
  if not playerId then return end
  if table.contains(talkingToPlayers, playerId) then return end

  debugprint("stopped talking to", playerId)
  TriggerServerEvent("phone:phone:enteredCallProximity", playerId)
  table.insert(talkingToPlayers, playerId)
  return true
end

-- Loop principal que verifica jogadores próximos e atualiza estados de voz
while true do
  Wait(250)
  local nearbyPlayers = GetNearbyPlayers()
  local playerCoords = GetEntityCoords(PlayerPedId())

  for i = 1, #nearbyPlayers do
    local playerData = nearbyPlayers[i]
    local playerState = Player(playerData.source).state

    local onCallWith = playerState.onCallWith
    local isSpeakerphoneOn = playerState.speakerphone
    local callAnswered = playerState.callAnswered
    local instapicIsLive = playerState.instapicIsLive

    local pedCoords = GetEntityCoords(playerData.ped)
    local distance = #(playerCoords - pedCoords)

    if distance <= 5 then
      if instapicIsLive then
        enterLiveProximity(instapicIsLive)
      end

      if isSpeakerphoneOn and onCallWith and callAnswered then
        local otherMutedCall = playerState.otherMutedCall
        if otherMutedCall then
          if stopListeningToPlayer(onCallWith) and not playerState.mutedCall then
            TriggerServerEvent("phone:phone:enteredCallProximity", playerData.source)
          end
        else
          startListeningToPlayer(onCallWith)
        end

        if playerState.mutedCall then
          if stopTalkingToPlayer(playerData.source) and not otherMutedCall then
            TriggerServerEvent("phone:phone:listenToPlayer", onCallWith)
          end
        else
          startTalkingToPlayer(playerData.source)
        end
      elseif onCallWith then
        startListeningToPlayer(onCallWith)
        startTalkingToPlayer(playerData.source)
      end
    elseif instapicIsLive then
      leaveLiveProximity(instapicIsLive)
    else
      if onCallWith then
        startListeningToPlayer(onCallWith)
        startTalkingToPlayer(playerData.source)
      end
    end
  end
end
