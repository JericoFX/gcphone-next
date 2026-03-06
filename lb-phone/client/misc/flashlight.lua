local drawFlashlightFunc, toggleFlashlightFunc, registerToggleFlashlight, flashlightThread
local flashlightEnabled = false
local activeFlashlights = {}
local isDrawingFlashlights = false

-- Função para desenhar o efeito do flash da lanterna
drawFlashlightFunc = DrawFlashlight
if not drawFlashlightFunc then
  function drawFlashlightFunc(playerPed)
    local boneCoords = GetPedBoneCoords(playerPed, 28422, 0.5, 0.0, 0.0)
    local forwardVector = GetEntityForwardVector(playerPed)

    DrawSpotLightWithShadow(
      boneCoords.x, boneCoords.y, boneCoords.z,
      forwardVector.x, forwardVector.y, forwardVector.z,
      255, 255, 255,
      15.0, 3.0, 0.0,
      50.0, 100.0, 1
    )
    DrawSpotLightWithShadow(
      boneCoords.x, boneCoords.y, boneCoords.z,
      forwardVector.x, forwardVector.y, forwardVector.z,
      255, 255, 255,
      30.0, 10.0, 0.0,
      20.0, 25.0, 1
    )
  end
end

-- Função para alternar o estado da lanterna
toggleFlashlightFunc = function(toggle)
  local wasEnabled = flashlightEnabled
  flashlightEnabled = (toggle == true)
  if flashlightEnabled == wasEnabled then return end

  TriggerServerEvent("phone:toggleFlashlight", flashlightEnabled)

  if not flashlightEnabled then
    return
  end

  Citizen.CreateThreadNow(function()
    local playerPed = PlayerPedId()
    while flashlightEnabled do
      if phoneOpen then
        drawFlashlightFunc(playerPed)
      else
        Wait(500)
      end
      Wait(0)
    end
  end)
end

-- Callback da NUI para alternar a lanterna via UI
registerToggleFlashlight = RegisterNUICallback
registerToggleFlashlight("toggleFlashlight", function(data, cb)
  toggleFlashlightFunc(data.toggled)
  SetTimeout(100, function()
    cb(flashlightEnabled)
  end)
end)

-- Export para togglear a lanterna externamente
exports("ToggleFlashlight", function(toggle)
  if not phoneOpen then return end
  toggleFlashlightFunc(toggle)
  SendReactMessage("toggleFlashlight", flashlightEnabled)
end)

-- Export para pegar o estado da lanterna
exports("GetFlashlight", function()
  return flashlightEnabled == true
end)

-- Função para iniciar a thread que desenha as lanternas próximas
local function startDrawingFlashlights()
  if isDrawingFlashlights then return end
  isDrawingFlashlights = true

  Citizen.CreateThreadNow(function()
    debugprint("Started drawing flashlights")
    while isDrawingFlashlights do
      for i = 1, #activeFlashlights do
        drawFlashlightFunc(activeFlashlights[i])
      end
      Wait(0)
    end
    debugprint("Stopped drawing flashlights")
  end)
end

-- Handler para mudanças no estado de "flashlight" no StateBag
AddStateBagChangeHandler("flashlight", nil, function(bagName, key, value, _unused1, _unused2)
  local playerServerId = GetPlayerFromStateBagName(bagName)
  if not playerServerId or playerServerId == 0 then return end
  if playerServerId == PlayerId() then return end -- Ignorar jogador local

  local playerPed = GetPlayerPed(playerServerId)
  local playerCoords = GetEntityCoords(PlayerPedId())
  local otherCoords = GetEntityCoords(playerPed)
  local dist = #(playerCoords - otherCoords)
  if dist > 30.0 then return end

  local flashlightIndex = table.contains(activeFlashlights, playerPed)
  if not flashlightIndex and value then
    table.insert(activeFlashlights, playerPed)
  elseif flashlightIndex and not value then
    table.remove(activeFlashlights, flashlightIndex)
  end

  if #activeFlashlights > 0 then
    startDrawingFlashlights()
  else
    isDrawingFlashlights = false
  end
end)

-- Thread para limpar lista de lanternas e atualizar lanternas próximas
Citizen.CreateThread(function()
  while true do
    if #activeFlashlights > 0 then
      table.wipe(activeFlashlights)
    end

    local playerCoords = GetEntityCoords(PlayerPedId())
    local nearbyPlayers = GetNearbyPlayers()
    for _, player in ipairs(nearbyPlayers) do
      local playerState = Player(player.source).state
      if playerState.flashlight and playerState.phoneOpen then
        local pedCoords = GetEntityCoords(player.ped)
        if #(playerCoords - pedCoords) <= 30.0 then
          table.insert(activeFlashlights, player.ped)
        end
      end
    end

    if #activeFlashlights > 0 then
      startDrawingFlashlights()
    else
      isDrawingFlashlights = false
    end

    Wait(1000)
  end
end)
