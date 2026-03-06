local CameraConfig = {}

-- Configurações da câmera
CameraConfig.MaxFOV = Config.Camera and Config.Camera.MaxFOV or 70.0
CameraConfig.DefaultFOV = Config.Camera and Config.Camera.DefaultFOV or 60.0
CameraConfig.MinFOV = Config.Camera and Config.Camera.MinFOV or 10.0
CameraConfig.MaxLookUp = Config.Camera and Config.Camera.MaxLookUp or 80.0
CameraConfig.MaxLookDown = Config.Camera and Config.Camera.MaxLookDown or -80.0
CameraConfig.AllowRunning = Config.Camera and Config.Camera.AllowRunning == true
CameraConfig.VehicleZoom = Config.Camera and Config.Camera.Vehicle and Config.Camera.Vehicle.Zoom == true
CameraConfig.VehicleMaxFOV = Config.Camera and Config.Camera.Vehicle and Config.Camera.Vehicle.MaxFOV or 80.0
CameraConfig.VehicleDefaultFOV = Config.Camera and Config.Camera.Vehicle and Config.Camera.Vehicle.DefaultFOV or 60.0
CameraConfig.VehicleMinFOV = Config.Camera and Config.Camera.Vehicle and Config.Camera.Vehicle.MinFOV or 10.0
CameraConfig.VehicleMaxLookUp = Config.Camera and Config.Camera.Vehicle and Config.Camera.Vehicle.MaxLookUp or 50.0
CameraConfig.VehicleMaxLookDown = Config.Camera and Config.Camera.Vehicle and Config.Camera.Vehicle.MaxLookDown or -30.0
CameraConfig.VehicleMaxLeftRight = Config.Camera and Config.Camera.Vehicle and Config.Camera.Vehicle.MaxLeftRight or
120.0
CameraConfig.VehicleMinLeftRight = Config.Camera and Config.Camera.Vehicle and Config.Camera.Vehicle.MinLeftRight or
-120.0
CameraConfig.SelfieMaxFOV = Config.Camera and Config.Camera.Selfie and Config.Camera.Selfie.MaxFOV or 80.0
CameraConfig.SelfieDefaultFOV = Config.Camera and Config.Camera.Selfie and Config.Camera.Selfie.DefaultFOV or 60.0
CameraConfig.SelfieMinFOV = Config.Camera and Config.Camera.Selfie and Config.Camera.Selfie.MinFOV or 50.0
CameraConfig.FreezeEnabled = Config.Camera and Config.Camera.Freeze and Config.Camera.Freeze.Enabled == true
CameraConfig.FreezeMaxDistance = Config.Camera and Config.Camera.Freeze and Config.Camera.Freeze.MaxDistance or 10.0
CameraConfig.FreezeMaxTime = (Config.Camera and Config.Camera.Freeze and Config.Camera.Freeze.MaxTime or 60) * 1000
CameraConfig.SelfieOffset = Config.Camera and Config.Camera.Selfie and Config.Camera.Selfie.Offset or
vector3(0.1, 0.55, 0.6)
CameraConfig.SelfieRotation = Config.Camera and Config.Camera.Selfie and Config.Camera.Selfie.Rotation or
vector3(10.0, 0.0, -180.0)
CameraConfig.RollEnabled = Config.Camera and Config.Camera.Roll == true

-- Variáveis de estado da câmera
local cameraState = {
    rearOffset = vector3(0.0, 0.5, 0.6),
    pitch = 0.0,
    yaw = 0.0,
    fov = 60.0,
    freezeTime = 0,
    rollAngle = 0.0,
    isFrozen = false,
    isSelfie = false,
    isInVehicle = false,
    currentMode = 0, -- 0 = REAR, 1 = SELFIE, 2 = IN_VEHICLE
    cameraHandle = nil,
    playerPed = PlayerPedId(),
    isMoving = false,
    sensitivity = 0.0,
    zoomLevel = 1.0,
    radioControlDisabled = false,
    cameraModes = {
        REAR = 0,
        SELFIE = 1,
        IN_VEHICLE = 2
    }
}

-- Função para obter os parâmetros FOV atuais
local function GetCurrentFOVSettings()
    if cameraState.isSelfie then
        return CameraConfig.SelfieMaxFOV, CameraConfig.SelfieMinFOV, CameraConfig.SelfieDefaultFOV
    elseif cameraState.isInVehicle then
        if CameraConfig.VehicleZoom then
            return CameraConfig.VehicleMaxFOV, CameraConfig.VehicleMinFOV, CameraConfig.VehicleDefaultFOV
        else
            return CameraConfig.VehicleMaxFOV, CameraConfig.VehicleMaxFOV, CameraConfig.VehicleMaxFOV
        end
    else
        return CameraConfig.MaxFOV, CameraConfig.MinFOV, CameraConfig.DefaultFOV
    end
end

-- Conversão entre FOV e nível de zoom
function ConvertFovToZoom(fov)
    local maxFov, minFov, defaultFov = GetCurrentFOVSettings()
    local clampedFov = math.clamp(fov, minFov, maxFov)

    if clampedFov == defaultFov then
        return 1.0
    elseif defaultFov > clampedFov then
        if clampedFov <= 0 then return 1.0 end
        return defaultFov / clampedFov
    else
        local fovDiff = clampedFov - defaultFov
        local maxDiff = maxFov - defaultFov
        local zoom = 1.0 - (fovDiff / maxDiff) * 0.5
        return zoom
    end
end

-- Conversão entre nível de zoom e FOV
function ConvertZoomToFov(zoom)
    local maxFov, minFov, defaultFov = GetCurrentFOVSettings()
    local baseZoom = 1.0

    if defaultFov < maxFov then
        baseZoom = 0.5
    end

    local minZoom = 1.0
    if minFov < defaultFov and minFov > 0 then
        minZoom = defaultFov / minFov
    end

    local clampedZoom = math.clamp(zoom, baseZoom, minZoom)

    if clampedZoom == 1.0 then
        return defaultFov
    elseif clampedZoom > 1.0 then
        return defaultFov / clampedZoom
    else
        return defaultFov + (2.0 * (1.0 - clampedZoom) * (maxFov - defaultFov))
    end
end

-- Atualiza os níveis de zoom disponíveis na UI
function UpdateZoomLevels()
    local maxFov, minFov, defaultFov = GetCurrentFOVSettings()
    local maxZoom = ConvertFovToZoom(maxFov)
    local minZoom = ConvertFovToZoom(minFov)

    local zoomLevels = { 1.0 }

    if maxZoom < 1.0 then
        table.insert(zoomLevels, 1, maxZoom)
    end

    if minZoom > 2.0 then
        table.insert(zoomLevels, 2, 2.0)
    end

    if minZoom > 5.0 then
        table.insert(zoomLevels, 2, 5.0)
    elseif minZoom > 3.0 then
        table.insert(zoomLevels, 2, 3.0)
    end

    SendReactMessage("camera:setZoomLevels", zoomLevels)
end

-- Define o zoom da câmera
function SetCameraZoom(zoom)
    cameraState.fov = ConvertZoomToFov(zoom)
end

-- Atualiza a posição e configuração da câmera
function UpdateCameraPosition()
    cameraState.playerPed = PlayerPedId()
    cameraState.isInVehicle = IsPedInAnyVehicle(cameraState.playerPed, true)

    local newMode = cameraState.cameraModes.REAR
    if cameraState.isSelfie then
        newMode = newMode | cameraState.cameraModes.SELFIE
    end
    if cameraState.isInVehicle then
        newMode = newMode | cameraState.cameraModes.IN_VEHICLE
    end

    -- Verifica se o modo da câmera mudou
    if cameraState.currentMode ~= newMode then
        local maxFov, minFov, defaultFov = GetCurrentFOVSettings()
        cameraState.currentMode = newMode
        cameraState.fov = defaultFov
        debugprint("Camera mode changed to: " .. cameraState.currentMode)
        UpdateZoomLevels()
        SetCamFov(cameraState.cameraHandle, cameraState.fov)
    end

    -- Verifica se o jogador está se movendo
    cameraState.isMoving = IsDisabledControlPressed(0, 33) or
        IsDisabledControlPressed(0, 34) or
        (not cameraState.isInVehicle and IsDisabledControlPressed(0, 35))

    -- Configurações básicas da câmera
    SetFollowPedCamViewMode(0)
    SetGameplayCamRelativeHeading(0.0)

    -- Desativa controles indesejados
    DisableControlAction(0, 1, true)                 -- Look Left/Right
    DisableControlAction(0, 14, true)                -- Zoom Out
    DisableControlAction(0, 15, true)                -- Zoom In
    DisableControlAction(0, 16, true)                -- Look Up
    DisableControlAction(0, 17, true)                -- Look Down
    DisableControlAction(0, 99, true)                -- Aim
    DisableControlAction(0, 100, true)               -- Attack
    DisableControlAction(0, 115, true)               -- Sprint
    DisableControlAction(0, 116, true)               -- Jump
    DisableControlAction(0, 261, true)               -- Melee Attack 1
    DisableControlAction(0, 262, true)               -- Melee Attack 2
    SetPedResetFlag(cameraState.playerPed, 47, true) -- Disable weapon collision

    -- Verifica se a câmera está congelada
    if cameraState.isFrozen and not cameraState.isInVehicle then
        local playerCoords = GetEntityCoords(cameraState.playerPed)
        local camCoords = GetCamCoord(cameraState.cameraHandle)
        local distance = #(playerCoords - camCoords)

        if distance > CameraConfig.FreezeMaxDistance or GetGameTimer() > cameraState.freezeTime then
            cameraState.isFrozen = false
            TogglePhoneAnimation(true, "camera")
        end
        return
    end

    -- Desativa corrida se não permitido
    if not CameraConfig.AllowRunning then
        DisableControlAction(0, 21, true) -- Sprint
    end

    -- Configuração da câmera selfie
    if cameraState.isSelfie and not cameraState.isInVehicle then
        AttachCamToPedBone_2(
            cameraState.cameraHandle, cameraState.playerPed, 0,
            CameraConfig.SelfieRotation.x + cameraState.rollAngle,
            CameraConfig.SelfieRotation.y,
            CameraConfig.SelfieRotation.z,
            CameraConfig.SelfieOffset.x,
            CameraConfig.SelfieOffset.y,
            CameraConfig.SelfieOffset.z,
            true
        )
        -- Configuração da câmera traseira normal
    elseif not cameraState.isSelfie and not cameraState.isInVehicle then
        local offsetCoords = GetOffsetFromEntityInWorldCoords(
            cameraState.playerPed,
            cameraState.rearOffset.x,
            cameraState.rearOffset.y,
            cameraState.rearOffset.z
        )

        local headCoords = GetPedBoneCoords(cameraState.playerPed, 31086, 0.0, 0.0, 0.0)
        local zCoord = math.abs(headCoords.z - offsetCoords.z) > 0.2 and headCoords.z or offsetCoords.z

        DetachCam(cameraState.cameraHandle)
        SetCamCoord(cameraState.cameraHandle, offsetCoords.x, offsetCoords.y, zCoord)
        SetCamRot(cameraState.cameraHandle, cameraState.pitch, cameraState.yaw, GetEntityHeading(cameraState.playerPed),
            2)
        -- Configuração da câmera selfie em veículo
    elseif cameraState.isSelfie and cameraState.isInVehicle then
        AttachCamToPedBone_2(
            cameraState.cameraHandle, cameraState.playerPed, 0,
            80.0 + cameraState.rollAngle, 0.0, -180.0,
            0.0, 0.2, 0.5,
            true
        )
        -- Configuração da câmera em veículo
    elseif not cameraState.isSelfie and cameraState.isInVehicle then
        SetEntityLocallyInvisible(GetPhoneObject())
        SetEntityLocallyInvisible(cameraState.playerPed)
        AttachCamToPedBone_2(
            cameraState.cameraHandle, cameraState.playerPed,
            GetPedBoneIndex(cameraState.playerPed, 11816),
            cameraState.rollAngle, 0.0, cameraState.yaw,
            0.0, 0.0, 0.55,
            true
        )
    end

    -- Controle de rádio em veículos
    if cameraState.isInVehicle then
        if not cameraState.radioControlDisabled then
            cameraState.radioControlDisabled = true
            SetUserRadioControlEnabled(false)
        end
    elseif cameraState.radioControlDisabled then
        cameraState.radioControlDisabled = false
        SetUserRadioControlEnabled(true)
        cameraState.yaw = 0.0
    end

    -- Atualiza sensibilidade baseada no FOV
    local maxFov, minFov, defaultFov = GetCurrentFOVSettings()
    cameraState.sensitivity = (GetProfileSetting(754) + 10) * (cameraState.fov / maxFov) / 5

    -- Controles de movimento
    if not cameraState.isMoving then
        local lookX = GetDisabledControlNormal(0, 1) -- Look Left/Right
        if lookX ~= 0.0 then
            if cameraState.isInVehicle then
                cameraState.yaw = math.clamp(cameraState.yaw - (lookX * cameraState.sensitivity),
                    CameraConfig.VehicleMinLeftRight,
                    CameraConfig.VehicleMaxLeftRight)
            else
                SetEntityHeading(cameraState.playerPed,
                    GetEntityHeading(cameraState.playerPed) - (lookX * cameraState.sensitivity))
            end
        end

        local lookY = GetDisabledControlNormal(0, 2) -- Look Up/Down
        if lookY ~= 0.0 then
            if cameraState.isInVehicle then
                cameraState.pitch = math.clamp(cameraState.pitch - (lookY * cameraState.sensitivity),
                    CameraConfig.VehicleMaxLookDown,
                    CameraConfig.VehicleMaxLookUp)
            else
                cameraState.pitch = math.clamp(cameraState.pitch - (lookY * cameraState.sensitivity),
                    CameraConfig.MaxLookDown,
                    CameraConfig.MaxLookUp)
            end
        end
    end

    -- Controles de zoom
    if IsDisabledControlPressed(0, 180) then     -- Zoom In
        cameraState.fov = cameraState.fov + 5
    elseif IsDisabledControlPressed(0, 181) then -- Zoom Out
        cameraState.fov = cameraState.fov - 5
    end

    -- Aplica FOV com suavização
    local currentFov = GetCamFov(cameraState.cameraHandle)
    local maxFov, minFov, defaultFov = GetCurrentFOVSettings()
    cameraState.fov = math.clamp(cameraState.fov, minFov, maxFov)

    local newZoom = math.round(ConvertFovToZoom(currentFov), 1)
    if newZoom ~= cameraState.zoomLevel then
        debugprint("Zoom changed to: " .. newZoom .. " (" .. ConvertFovToZoom(currentFov) .. ", " .. currentFov .. ")")
        cameraState.zoomLevel = newZoom
        SendReactMessage("camera:setZoom", newZoom)
    end

    if math.abs(cameraState.fov - currentFov) > 0.05 then
        SetCamFov(cameraState.cameraHandle, currentFov + (cameraState.fov - currentFov) / 25)
    end

    -- Ignora atualizações se a NUI estiver focada
    if IsNuiFocused() then return end
end

-- Função chamada quando os controles são pressionados (para movimento)
function HandleCameraMovement()
    local lookX = GetDisabledControlNormal(0, 1)
    if lookX ~= 0.0 then
        SetEntityHeading(cameraState.playerPed,
            GetEntityHeading(cameraState.playerPed) - (lookX * cameraState.sensitivity))
    end
end

-- Ativa a câmera andável
function EnableWalkableCam(isSelfie)
    if cameraState.cameraHandle then return end

    cameraState.isSelfie = isSelfie == true
    cameraState.isMoving = false
    cameraState.playerPed = PlayerPedId()
    local savedViewMode = GetFollowPedCamViewMode()
    cameraState.pitch = 0.0
    cameraState.yaw = 0.0
    cameraState.isFrozen = false

    -- Configura FOV inicial
    if cameraState.isSelfie then
        cameraState.fov = CameraConfig.SelfieDefaultFOV
    else
        cameraState.fov = CameraConfig.DefaultFOV
    end

    -- Cria a câmera
    cameraState.cameraHandle = CreateCam("DEFAULT_SCRIPTED_CAMERA", true)
    cameraState.sensitivity = GetProfileSetting(754) + 10
    cameraState.zoomLevel = 1.0

    -- Configura ação do telefone
    SetPhoneAction("camera")

    -- Thread para movimento da câmera
    CreateThread(function()
        while cameraState.cameraHandle do
            Wait(0)
            if not cameraState.isMoving and not cameraState.isFrozen and not IsNuiFocused() then
                HandleCameraMovement()
            end
        end

        -- Restaura controles de rádio se necessário
        if cameraState.radioControlDisabled then
            cameraState.radioControlDisabled = false
            SetUserRadioControlEnabled(true)
        end
    end)

    -- Thread principal da câmera
    CreateThread(function()
        while cameraState.cameraHandle do
            Wait(0)
            UpdateCameraPosition()
        end
    end)

    -- Configurações iniciais
    SetCamFov(cameraState.cameraHandle, cameraState.fov)
    RenderScriptCams(true, false, 0, true, true)
    SetCamActive(cameraState.cameraHandle, true)
    SendReactMessage("camera:setZoom", 1.0)
    UpdateZoomLevels()
end

-- Desativa a câmera andável
function DisableWalkableCam()
    if not cameraState.cameraHandle then return end

    RenderScriptCams(false, false, 0, true, true)
    DestroyCam(cameraState.cameraHandle, false)
    SetFollowPedCamViewMode(cameraState.savedViewMode)

    -- Restaura ação do telefone
    SetPhoneAction(IsInCall() and "call" or "default")

    cameraState.cameraHandle = nil

    -- Restaura animação se estava congelada
    if cameraState.isFrozen then
        TogglePhoneAnimation(true, "camera")
    end
end

-- Alterna entre câmera normal e selfie
function ToggleSelfieCam(enable)
    local wasSelfie = cameraState.isSelfie
    cameraState.isSelfie = enable == true

    if wasSelfie ~= cameraState.isSelfie then
        cameraState.rollAngle = 0.0
        cameraState.pitch = 0.0
    end
end

-- Alterna o congelamento da câmera
function ToggleCameraFrozen()
    if not CameraConfig.FreezeEnabled or not cameraState.cameraHandle or cameraState.isSelfie then
        return
    end

    local shouldFreeze = not cameraState.isFrozen
    if shouldFreeze then
        TogglePhoneAnimation(false, "camera")
        cameraState.freezeTime = GetGameTimer() + CameraConfig.FreezeMaxTime
    end

    cameraState.isFrozen = shouldFreeze
end

-- Verifica se a câmera andável está ativa
function IsWalkingCamEnabled()
    return cameraState.cameraHandle ~= nil
end

-- Verifica se está no modo selfie
function IsSelfieCam()
    return cameraState.isSelfie
end

-- Evento para teclas pressionadas
AddEventHandler("lb-phone:keyPressed", function(key)
    if not cameraState.cameraHandle then return end

    if key == "FreezeCamera" then
        if CameraConfig.FreezeEnabled and not cameraState.isSelfie then
            ToggleCameraFrozen()
        end
    elseif (key == "RollLeft" or key == "RollRight") and CameraConfig.RollEnabled then
        local rollAmount = (key == "RollLeft") and -0.5 or 0.5
        local keybind = Config.KeyBinds[key]

        while keybind.bindData.pressed do
            Wait(0)
            cameraState.rollAngle = cameraState.rollAngle + rollAmount
        end
    end
end)

-- Exportações
exports("EnableWalkableCam", EnableWalkableCam)
exports("DisableWalkableCam", DisableWalkableCam)
exports("ToggleSelfieCam", ToggleSelfieCam)
exports("ToggleCameraFrozen", ToggleCameraFrozen)
exports("IsWalkingCamEnabled", IsWalkingCamEnabled)
exports("IsSelfieCam", IsSelfieCam)
