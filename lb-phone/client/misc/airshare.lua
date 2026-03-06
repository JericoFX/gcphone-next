local function getNearbyDevices()
  local devices = {}
  local nearbyPlayers = GetNearbyPlayers()
  local playerCoords = GetEntityCoords(PlayerPedId())

  debugprint("Nearby players:", nearbyPlayers)

  for i = 1, #nearbyPlayers do
    local player = nearbyPlayers[i]
    local playerState = Player(player.source).state

    debugprint("Player data", player.source, player)

    local targetCoords = GetEntityCoords(player.ped)
    local distance = #(playerCoords - targetCoords)

    if distance <= 7.5 then
      if playerState.lbTabletOpen and playerState.lbTabletName then
        table.insert(devices, {
          name = playerState.lbTabletName,
          source = player.source,
          device = "tablet"
        })
      elseif playerState.phoneOpen and playerState.phoneName then
        table.insert(devices, {
          name = playerState.phoneName,
          source = player.source,
          device = "phone"
        })
      end
    end
  end

  debugprint("Nearby devices:", devices)
  return devices
end

RegisterNUICallback("AirShare", function(data, callback)
  if not currentPhone then return end

  local action = data.action or ""
  debugprint("AirShare:", action)

  if action == "getNearby" then
    callback(getNearbyDevices())
  elseif action == "share" then
    TriggerCallback("airShare:share", callback, data.source, data.device, data.data)
  elseif action == "accept" then
    TriggerServerEvent("phone:airShare:interacted", data.source, data.device, true)
    callback("ok")
  elseif action == "deny" then
    TriggerServerEvent("phone:airShare:interacted", data.source, data.device, false)
    callback("ok")
  else
    callback(nil)
  end
end)

RegisterNetEvent("phone:airShare:received")
AddEventHandler("phone:airShare:received", function(data)
  debugprint("phone:airShare:received", data)
  SendReactMessage("airShare:received", data)
end)

RegisterNetEvent("phone:airShare:interacted")
AddEventHandler("phone:airShare:interacted", function(sourceId, accepted)
  SendReactMessage("airShare:interacted", {
    source = sourceId,
    accepted = accepted
  })
end)
