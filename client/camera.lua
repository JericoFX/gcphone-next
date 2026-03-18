local takePhoto = false

local cameraSession = {
    active = false,
    effect = 'normal',
    fov = 52.0,
    blur = 0.0,
    flash = true,
    selfie = false,
    frozen = false,
    landscape = false,
    quickZoomIndex = 2,
}

local CameraEffects = {
    normal = '',
    noir = 'BlackOut',
    vivid = 'rply_saturation',
    warm = 'V_CIA_Facility'
}

local function ClampNumber(value, minValue, maxValue)
    local num = tonumber(value) or minValue
    if num < minValue then num = minValue end
    if num > maxValue then num = maxValue end
    return num + 0.0
end

local function ClampFov(value)
    return ClampNumber(value, Config.Camera.Fov.Min, Config.Camera.Fov.Max)
end

local function ClampBlur(value)
    return ClampNumber(value, 0.0, 100.0)
end

local function NormalizeQuickZoomIndex(value)
    local quickZooms = Config.Camera.QuickZooms or { Config.Camera.Fov.Default }
    local index = math.floor(tonumber(value) or 1)
    if index < 1 then index = 1 end
    if index > #quickZooms then index = #quickZooms end
    return index
end

local function DrawFaceLight(ped, strength)
    local head = GetPedBoneCoords(ped, 31086, 0.0, 0.0, 0.0)
    DrawLightWithRange(head.x, head.y, head.z + 0.08, 240, 248, 255, 0.7, strength or 2.0)
end

local function TriggerFlashPulse(ped)
    CreateThread(function()
        local untilTs = GetGameTimer() + 120
        while GetGameTimer() < untilTs do
            Wait(0)
            local head = GetPedBoneCoords(ped, 31086, 0.0, 0.0, 0.0)
            DrawLightWithRange(head.x, head.y, head.z + 0.1, 255, 255, 255, 1.35, 4.2)
        end
    end)
end

local function ApplyCameraVisuals()
    local effectName = CameraEffects[cameraSession.effect] or CameraEffects.normal
    if effectName ~= '' then
        -- Verified: Cfx Native Reference SetTimecycleModifier is client-side and applies post-process look filters.
        SetTimecycleModifier(effectName)
    else
        ClearTimecycleModifier()
    end

    SetTimecycleModifierStrength(cameraSession.blur / 140.0)
    UpdateAdvancedPhoneCamera({
        fov = cameraSession.fov,
        selfie = cameraSession.selfie,
        frozen = cameraSession.frozen,
        landscape = cameraSession.landscape,
    })

    if type(SetPhoneVisualMode) == 'function' then
        SetPhoneVisualMode('camera', {
            landscape = cameraSession.landscape,
            selfie = cameraSession.selfie,
        })
    end
end

local function NormalizeCameraData(data)
    cameraSession.effect = type(data) == 'table' and tostring(data.effect or 'normal') or 'normal'
    if CameraEffects[cameraSession.effect] == nil then
        cameraSession.effect = 'normal'
    end

    cameraSession.fov = ClampFov(type(data) == 'table' and data.fov or Config.Camera.Fov.Default)
    cameraSession.blur = ClampBlur(type(data) == 'table' and data.blur or 0)
    cameraSession.flash = not (type(data) == 'table' and data.flash == false)
    cameraSession.selfie = type(data) == 'table' and data.selfie == true or false
    cameraSession.frozen = type(data) == 'table' and data.frozen == true or false
    cameraSession.landscape = type(data) == 'table' and data.landscape == true or false
    cameraSession.quickZoomIndex = NormalizeQuickZoomIndex(type(data) == 'table' and data.quickZoomIndex or cameraSession.quickZoomIndex)
end

local function StartCameraSession(data)
    NormalizeCameraData(data)
    local ped = cache.ped

    if cameraSession.active then
        ApplyCameraVisuals()
        return true
    end

    cameraSession.active = true
    PhoneState.cameraActive = true
    SetPedCurrentWeaponVisible(ped, false, true, true, true)
    StartAdvancedPhoneCamera({
        fov = cameraSession.fov,
        selfie = cameraSession.selfie,
        frozen = cameraSession.frozen,
        landscape = cameraSession.landscape,
    })
    ApplyCameraVisuals()

    CreateThread(function()
        while cameraSession.active do
            Wait(0)

            if IsControlJustPressed(0, 177) then
                cameraSession.active = false
                SendNUIMessage({ action = 'cameraSessionClosed' })
            elseif IsControlJustPressed(0, 27) then
                cameraSession.selfie = not cameraSession.selfie
                ApplyCameraVisuals()
            end

            if cameraSession.flash then
                DrawFaceLight(ped, cameraSession.selfie and 2.2 or 1.6)
            end
        end

        StopAdvancedPhoneCamera()
        PhoneState.cameraActive = false
        ClearTimecycleModifier()
        SetTimecycleModifierStrength(0.0)
        SetPedCurrentWeaponVisible(ped, true, true, true, true)
        if type(SetPhoneFlashlightEnabled) == 'function' then
            SetPhoneFlashlightEnabled(false)
        end
        PhonePlayText()
    end)

    return true
end

local function StopCameraSession()
    cameraSession.active = false
end

local function CaptureCurrentFrame(data, cb)
    if not cameraSession.active then
        cb({ url = nil, error = 'camera_session_inactive' })
        return
    end

    local ped = cache.ped
    local provider = type(data) == 'table' and tostring(data.provider or '') or ''
    local uploadUrl = (data and data.url) or (Config.Gallery and Config.Gallery.UploadUrl) or ''
    local uploadField = (data and data.field) or (Config.Gallery and Config.Gallery.UploadField) or 'files[]'

    if cameraSession.flash then
        TriggerFlashPulse(ped)
    end

    if provider == 'server_folder' then
        lib.callback('gcphone:storage:capturePhoto', false, function(success, payload)
            if success and type(payload) == 'table' and payload.url then
                cb({ url = payload.url })
            else
                cb({ url = nil, error = payload or 'server_folder_capture_failed' })
            end
        end)
        return
    end

    if uploadUrl == '' or uploadField == '' then
        cb({ url = nil, error = 'upload_not_configured' })
        return
    end

    if GetResourceState('screenshot-basic') ~= 'started' then
        cb({ url = nil, error = 'screenshot_basic_not_running' })
        return
    end

    exports['screenshot-basic']:requestScreenshotUpload(uploadUrl, uploadField, function(uploadData)
        local resp = json.decode(uploadData)
        if resp and resp.files and resp.files[1] then
            lib.callback('gcphone:savePhoto', false, function(_success)
                cb({ url = resp.files[1].url })
            end, { url = resp.files[1].url, type = 'image' })
        else
            cb({ url = nil })
        end
    end)
end

RegisterNUICallback('cameraGetCapabilities', function(_, cb)
    cb({
        flashlight = Config.Flashlight.Enabled == true,
        advancedCamera = Config.Camera.Enabled == true,
        video = false,
        freeze = Config.Camera.Freeze.Enabled == true,
        landscape = true,
        quickZooms = Config.Camera.QuickZooms or { Config.Camera.Fov.Default },
    })
end)

RegisterNUICallback('startCameraSession', function(data, cb)
    cb(StartCameraSession(data))
end)

RegisterNUICallback('updateCameraSession', function(data, cb)
    if not cameraSession.active then
        cb(false)
        return
    end

    NormalizeCameraData(data)
    ApplyCameraVisuals()
    cb(true)
end)

RegisterNUICallback('captureCameraSession', function(data, cb)
    CaptureCurrentFrame(data, cb)
end)

RegisterNUICallback('captureCameraVideoSession', function(_, cb)
    cb({ url = nil, error = 'video_not_supported' })
end)

RegisterNUICallback('cameraSetFreeze', function(data, cb)
    if not cameraSession.active then
        cb({ success = false, frozen = false })
        return
    end

    cameraSession.frozen = SetAdvancedPhoneCameraFreeze(type(data) == 'table' and data.enabled == true)
    cb({ success = true, frozen = cameraSession.frozen })
end)

RegisterNUICallback('cameraSetLandscape', function(data, cb)
    if not cameraSession.active then
        cb({ success = false, landscape = false })
        return
    end

    cameraSession.landscape = SetAdvancedPhoneCameraLandscape(type(data) == 'table' and data.enabled == true)
    ApplyCameraVisuals()
    cb({ success = true, landscape = cameraSession.landscape })
end)

RegisterNUICallback('cameraSetQuickZoom', function(data, cb)
    if not cameraSession.active then
        cb({ success = false, fov = cameraSession.fov, quickZoomIndex = cameraSession.quickZoomIndex })
        return
    end

    local fov, quickZoomIndex = SetAdvancedPhoneCameraQuickZoom(type(data) == 'table' and data.index or cameraSession.quickZoomIndex)
    cameraSession.fov = ClampFov(fov)
    cameraSession.quickZoomIndex = quickZoomIndex
    cb({ success = true, fov = cameraSession.fov, quickZoomIndex = cameraSession.quickZoomIndex })
end)

RegisterNUICallback('stopCameraSession', function(_, cb)
    StopCameraSession()
    cb(true)
end)

RegisterNUICallback('takePhoto', function(data, cb)
    if cameraSession.active then
        cb({ url = nil, error = 'camera_session_busy' })
        return
    end

    local effect = type(data) == 'table' and data.effect or 'normal'
    local fov = ClampFov(type(data) == 'table' and data.fov or Config.Camera.Fov.Default)
    local blur = ClampBlur(type(data) == 'table' and data.blur or 0)
    local flashEnabled = type(data) == 'table' and data.flash ~= false
    local selfieMode = type(data) == 'table' and data.selfie == true
    local frozen = type(data) == 'table' and data.frozen == true
    local landscape = type(data) == 'table' and data.landscape == true

    StartCameraSession({ effect = effect, fov = fov, blur = blur, flash = flashEnabled, selfie = selfieMode, frozen = frozen, landscape = landscape })
    takePhoto = true

    CreateThread(function()
        while takePhoto and cameraSession.active do
            Wait(0)

            if IsControlJustPressed(0, 177) then
                takePhoto = false
                StopCameraSession()
                cb({ url = nil })
                return
            end

            if IsControlJustPressed(0, 176) then
                takePhoto = false
                CaptureCurrentFrame(data, function(result)
                    StopCameraSession()
                    cb(result)
                end)
                return
            end
        end

        if takePhoto then
            takePhoto = false
            cb({ url = nil })
        end
    end)
end)

RegisterNUICallback('faketakePhoto', function(_, cb)
    menuIsOpen = false
    SendNUIMessage({ action = 'hidePhone' })
    PhonePlayOut()
    cb(true)

    TriggerEvent('camera:open')
end)

AddEventHandler('onResourceStop', function(resourceName)
    if resourceName ~= GetCurrentResourceName() then return end
    StopCameraSession()
    StopAdvancedPhoneCamera()
    PhoneState.cameraActive = false
    ClearTimecycleModifier()
    SetTimecycleModifierStrength(0.0)
end)
