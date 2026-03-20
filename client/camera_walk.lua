local scriptedCamera = {
    active = false,
    handle = nil,
    yaw = 0.0,
    pitch = 0.0,
    userRoll = 0.0,
    selfie = false,
    landscape = false,
    frozen = false,
    fov = 52.0,
    quickZoomIndex = 2,
    anchorCoords = nil,
    anchorHeading = nil,
}

local function CameraClamp(value, minValue, maxValue)
    local num = tonumber(value) or minValue
    if num < minValue then return minValue end
    if num > maxValue then return maxValue end
    return num + 0.0
end

local function GetCameraConfig()
    return Config.Camera or {}
end

local function GetQuickZooms()
    local cfg = GetCameraConfig()
    local quickZooms = type(cfg.QuickZooms) == 'table' and cfg.QuickZooms or { 30.0, 52.0, 78.0 }
    local out = {}

    for _, value in ipairs(quickZooms) do
        out[#out + 1] = CameraClamp(value, cfg.Fov.Min, cfg.Fov.Max)
    end

    if #out == 0 then
        out[1] = cfg.Fov.Default
    end

    table.sort(out)
    return out
end

local function FindClosestQuickZoomIndex(fov)
    local quickZooms = GetQuickZooms()
    local bestIndex = 1
    local bestDistance = math.huge

    for index, value in ipairs(quickZooms) do
        local distance = math.abs(value - fov)
        if distance < bestDistance then
            bestDistance = distance
            bestIndex = index
        end
    end

    return bestIndex
end

local function GetRearOffsets(inVehicle)
    local cfg = GetCameraConfig()
    local rear = inVehicle and cfg.VehicleRearOffset or cfg.RearOffset
    rear = rear or { x = 0.02, y = -0.06, z = 0.72 }
    return rear.x or 0.02, rear.y or -0.06, rear.z or 0.72
end

local function GetSelfieOffsets(inVehicle)
    local cfg = GetCameraConfig()
    local selfie = inVehicle and cfg.VehicleSelfieOffset or cfg.SelfieOffset
    selfie = selfie or { x = 0.0, y = 0.72, z = 0.62 }
    return selfie.x or 0.0, selfie.y or 0.72, selfie.z or 0.62
end

local function OffsetFromHeading(baseCoords, heading, offsetX, offsetY, offsetZ)
    local headingRad = math.rad(heading)
    local sinHeading = math.sin(headingRad)
    local cosHeading = math.cos(headingRad)

    return vector3(
        baseCoords.x + (offsetX * cosHeading) - (offsetY * sinHeading),
        baseCoords.y + (offsetX * sinHeading) + (offsetY * cosHeading),
        baseCoords.z + offsetZ
    )
end

local function SyncPhoneVisualMode()
    if type(SetPhoneVisualMode) == 'function' then
        SetPhoneVisualMode('camera', {
            landscape = scriptedCamera.landscape,
            selfie = scriptedCamera.selfie,
        })
    end
end

local function EnsureScriptCamera()
    if scriptedCamera.handle and DoesCamExist(scriptedCamera.handle) then
        return scriptedCamera.handle
    end

    scriptedCamera.handle = CreateCam('DEFAULT_SCRIPTED_CAMERA', true)
    SetCamActive(scriptedCamera.handle, true)
    RenderScriptCams(true, false, 0, true, true)
    return scriptedCamera.handle
end

local function DestroyScriptCamera()
    if scriptedCamera.handle and DoesCamExist(scriptedCamera.handle) then
        DestroyCam(scriptedCamera.handle, false)
    end

    scriptedCamera.handle = nil
    RenderScriptCams(false, false, 0, true, true)
end

local function ReleaseFrozenCamera()
    scriptedCamera.frozen = false
    scriptedCamera.anchorCoords = nil
    scriptedCamera.anchorHeading = nil
end

local function CaptureFrozenAnchor()
    scriptedCamera.frozen = true
    scriptedCamera.anchorCoords = GetEntityCoords(cache.ped)
    scriptedCamera.anchorHeading = GetEntityHeading(cache.ped)
end

local function ResolveCameraOrigin(ped)
    if scriptedCamera.frozen and scriptedCamera.anchorCoords and scriptedCamera.anchorHeading then
        local maxDistance = CameraClamp((GetCameraConfig().Freeze or {}).MaxDistance or 8.0, 2.0, 30.0)
        local pedCoords = GetEntityCoords(ped)
        if #(pedCoords - scriptedCamera.anchorCoords) > maxDistance then
            ReleaseFrozenCamera()
        else
            return scriptedCamera.anchorCoords, scriptedCamera.anchorHeading
        end
    end

    return GetEntityCoords(ped), GetEntityHeading(ped)
end

local function UpdateScriptCameraTransform()
    if not scriptedCamera.active then return end

    local cam = EnsureScriptCamera()
    local ped = cache.ped
    local inVehicle = IsPedInAnyVehicle(ped, false)
    local baseCoords, baseHeading = ResolveCameraOrigin(ped)

    local offsetX
    local offsetY
    local offsetZ
    local heading

    if scriptedCamera.selfie then
        offsetX, offsetY, offsetZ = GetSelfieOffsets(inVehicle)
        heading = baseHeading + 180.0 + scriptedCamera.yaw
    else
        offsetX, offsetY, offsetZ = GetRearOffsets(inVehicle)
        heading = baseHeading + scriptedCamera.yaw
    end

    local worldPos = OffsetFromHeading(baseCoords, baseHeading, offsetX, offsetY, offsetZ)
    local baseRoll = scriptedCamera.userRoll
    if scriptedCamera.landscape then
        baseRoll = baseRoll + CameraClamp(GetCameraConfig().LandscapeRoll or -90.0, -180.0, 180.0)
    end

    SetCamCoord(cam, worldPos.x, worldPos.y, worldPos.z)
    SetCamRot(cam, scriptedCamera.pitch, baseRoll, heading, 2)
    SetCamFov(cam, scriptedCamera.fov)
    SyncPhoneVisualMode()
end

local function SetQuickZoomIndex(index)
    local quickZooms = GetQuickZooms()
    local normalized = math.floor(tonumber(index) or 1)
    if normalized < 1 then normalized = 1 end
    if normalized > #quickZooms then normalized = #quickZooms end

    scriptedCamera.quickZoomIndex = normalized
    scriptedCamera.fov = quickZooms[normalized]
    UpdateScriptCameraTransform()
end

local function ApplyScriptedPhoneCameraState(data)
    if type(data) ~= 'table' then return end

    local cfg = GetCameraConfig()
    scriptedCamera.selfie = data.selfie == true
    scriptedCamera.landscape = data.landscape == true
    scriptedCamera.fov = CameraClamp(data.fov or scriptedCamera.fov, cfg.Fov.Min, cfg.Fov.Max)
    scriptedCamera.quickZoomIndex = FindClosestQuickZoomIndex(scriptedCamera.fov)

    if data.frozen == true and not scriptedCamera.frozen then
        CaptureFrozenAnchor()
    elseif data.frozen == false and scriptedCamera.frozen then
        ReleaseFrozenCamera()
    end

    UpdateScriptCameraTransform()
end

function StartAdvancedPhoneCamera(data)
    local cfg = GetCameraConfig()

    scriptedCamera.active = true
    scriptedCamera.yaw = 0.0
    scriptedCamera.pitch = 0.0
    scriptedCamera.userRoll = 0.0
    scriptedCamera.fov = CameraClamp(type(data) == 'table' and data.fov or cfg.Fov.Default, cfg.Fov.Min, cfg.Fov.Max)
    scriptedCamera.selfie = type(data) == 'table' and data.selfie == true or false
    scriptedCamera.landscape = type(data) == 'table' and data.landscape == true or false
    scriptedCamera.quickZoomIndex = FindClosestQuickZoomIndex(scriptedCamera.fov)

    if type(data) == 'table' and data.frozen == true then
        CaptureFrozenAnchor()
    else
        ReleaseFrozenCamera()
    end

    EnsureScriptCamera()
    PhonePlayCamera()
    UpdateScriptCameraTransform()
end

function StopAdvancedPhoneCamera()
    scriptedCamera.active = false
    scriptedCamera.yaw = 0.0
    scriptedCamera.pitch = 0.0
    scriptedCamera.userRoll = 0.0
    scriptedCamera.selfie = false
    scriptedCamera.landscape = false
    scriptedCamera.quickZoomIndex = FindClosestQuickZoomIndex(GetCameraConfig().Fov.Default)
    ReleaseFrozenCamera()
    DestroyScriptCamera()
end

function UpdateAdvancedPhoneCamera(data)
    ApplyScriptedPhoneCameraState(data)
end

function IsAdvancedPhoneCameraActive()
    return scriptedCamera.active == true
end

function GetAdvancedPhoneCameraState()
    return scriptedCamera
end

function SetAdvancedPhoneCameraFreeze(enabled)
    if enabled == true then
        CaptureFrozenAnchor()
    else
        ReleaseFrozenCamera()
    end

    UpdateScriptCameraTransform()
    return scriptedCamera.frozen == true
end

function SetAdvancedPhoneCameraLandscape(enabled)
    scriptedCamera.landscape = enabled == true
    UpdateScriptCameraTransform()
    return scriptedCamera.landscape == true
end

function SetAdvancedPhoneCameraQuickZoom(index)
    SetQuickZoomIndex(index)
    return scriptedCamera.fov, scriptedCamera.quickZoomIndex
end

function StepAdvancedPhoneCameraQuickZoom(direction)
    local nextIndex = scriptedCamera.quickZoomIndex + (direction >= 0 and 1 or -1)
    SetQuickZoomIndex(nextIndex)
    return scriptedCamera.fov, scriptedCamera.quickZoomIndex
end

CreateThread(function()
    while true do
        if not scriptedCamera.active then
            Wait(300)
        else
            Wait(0)
            local ped = cache.ped
            local cfg = GetCameraConfig()
            local lookSensitivity = CameraClamp(cfg.LookSensitivity or 7.5, 1.0, 20.0) / 12.0
            local pitchMax = CameraClamp(cfg.PitchMax or 22.0, 5.0, 89.0)
            local pitchMin = -CameraClamp(cfg.PitchMin or 65.0, 5.0, 89.0)
            local yawMax = CameraClamp(cfg.YawMax or 90.0, 20.0, 160.0)
            local rollStep = CameraClamp(cfg.RollStep or 2.5, 0.5, 10.0)

            DisablePlayerFiring(PlayerId(), true)
            DisableControlAction(0, 24, true)
            DisableControlAction(0, 25, true)
            DisableControlAction(0, 44, true)
            DisableControlAction(0, 140, true)
            DisableControlAction(0, 141, true)
            DisableControlAction(0, 142, true)
            DisableControlAction(0, 257, true)
            DisableControlAction(0, 263, true)
            DisableControlAction(0, 264, true)

            local lookX = GetDisabledControlNormal(0, 1)
            local lookY = GetDisabledControlNormal(0, 2)
            if math.abs(lookX) > 0.0001 then
                scriptedCamera.yaw = CameraClamp(scriptedCamera.yaw - (lookX * lookSensitivity * 8.0), -yawMax, yawMax)
            end
            if math.abs(lookY) > 0.0001 then
                scriptedCamera.pitch = CameraClamp(scriptedCamera.pitch - (lookY * lookSensitivity * 6.0), pitchMin, pitchMax)
            end

            if IsControlJustPressed(0, 27) then
                scriptedCamera.selfie = not scriptedCamera.selfie
            end
            if IsControlJustPressed(0, 175) then
                scriptedCamera.userRoll = CameraClamp(scriptedCamera.userRoll + rollStep, -18.0, 18.0)
            end
            if IsControlJustPressed(0, 174) then
                scriptedCamera.userRoll = CameraClamp(scriptedCamera.userRoll - rollStep, -18.0, 18.0)
            end
            if IsControlJustPressed(0, 180) then
                StepAdvancedPhoneCameraQuickZoom(1)
            end
            if IsControlJustPressed(0, 181) then
                StepAdvancedPhoneCameraQuickZoom(-1)
            end

            if not (cfg.AllowRunning == true) then
                DisableControlAction(0, 21, true)
            end

            HideHudComponentThisFrame(6)
            HideHudComponentThisFrame(7)
            HideHudComponentThisFrame(8)
            HideHudComponentThisFrame(9)
            HideHudComponentThisFrame(19)
            HideHudAndRadarThisFrame()

            if DoesEntityExist(ped) then
                SetPedCurrentWeaponVisible(ped, false, true, true, true)
            end

            UpdateScriptCameraTransform()
        end
    end
end)
