-- Creado/Modificado por JericoFX

local takePhoto = false
local frontCam = false

local cameraSession = {
    active = false,
    effect = 'normal',
    fov = 52.0,
    blur = 0.0,
    flash = true,
    selfie = false,
}

local CameraEffects = {
    normal = '',
    noir = 'BlackOut',
    vivid = 'rply_saturation',
    warm = 'V_CIA_Facility'
}

local function ClampFov(value)
    local fov = tonumber(value) or 52.0
    if fov < 25.0 then fov = 25.0 end
    if fov > 90.0 then fov = 90.0 end
    return fov + 0.0
end

local function ClampPercent(value)
    local v = tonumber(value) or 0
    if v < 0 then v = 0 end
    if v > 100 then v = 100 end
    return v + 0.0
end

local function TryApplyCamFov(fov)
    local cam = GetRenderingCam()
    if cam and cam ~= 0 and cam ~= -1 then
        SetCamFov(cam, fov)
    end
end

local function GetFaceCoords(ped)
    local head = GetPedBoneCoords(ped, 31086, 0.0, 0.0, 0.0)
    return vector3(head.x, head.y, head.z)
end

local function DrawFaceLight(ped, strength)
    local c = GetFaceCoords(ped)
    local s = strength or 2.0
    DrawLightWithRange(c.x, c.y, c.z + 0.08, 240, 248, 255, 0.7, s)
end

local function TriggerFlashPulse(ped)
    CreateThread(function()
        local untilTs = GetGameTimer() + 120
        while GetGameTimer() < untilTs do
            Wait(0)
            local c = GetFaceCoords(ped)
            DrawLightWithRange(c.x, c.y, c.z + 0.1, 255, 255, 255, 1.35, 4.2)
        end
    end)
end

local function ApplyCameraSettings()
    local effectName = CameraEffects[cameraSession.effect] or CameraEffects.normal
    if effectName ~= '' then
        SetTimecycleModifier(effectName)
    else
        ClearTimecycleModifier()
    end

    SetTimecycleModifierStrength(cameraSession.blur / 140.0)
    frontCam = cameraSession.selfie
    CellCamActivateSelfieMode(frontCam)
    TryApplyCamFov(cameraSession.fov)
end

local function StartCameraSession(data)
    local ped = cache.ped

    cameraSession.effect = type(data) == 'table' and tostring(data.effect or 'normal') or 'normal'
    if CameraEffects[cameraSession.effect] == nil then cameraSession.effect = 'normal' end
    cameraSession.fov = ClampFov(type(data) == 'table' and data.fov or 52.0)
    cameraSession.blur = ClampPercent(type(data) == 'table' and data.blur or 0)
    cameraSession.flash = not (type(data) == 'table' and data.flash == false)
    cameraSession.selfie = type(data) == 'table' and data.selfie == true or false

    if cameraSession.active then
        ApplyCameraSettings()
        return
    end

    CreateMobilePhone(1)
    CellCamActivate(true, true)
    cameraSession.active = true
    SetPedCurrentWeaponVisible(ped, false, true, true, true)

    if hasFocus then
        SetNuiFocus(false, false)
        hasFocus = false
    end

    ApplyCameraSettings()

    CreateThread(function()
        while cameraSession.active do
            Wait(0)

            if IsControlJustPressed(1, 27) then
                cameraSession.selfie = not cameraSession.selfie
                ApplyCameraSettings()
            elseif IsControlJustPressed(1, 177) then
                cameraSession.active = false
                SendNUIMessage({ action = 'cameraSessionClosed' })
            end

            DrawFaceLight(ped, frontCam and 2.2 or 1.6)

            HideHudComponentThisFrame(7)
            HideHudComponentThisFrame(8)
            HideHudComponentThisFrame(9)
            HideHudComponentThisFrame(6)
            HideHudComponentThisFrame(19)
            HideHudAndRadarThisFrame()
        end

        DestroyMobilePhone()
        CellCamActivate(false, false)
        ClearTimecycleModifier()
        SetPedCurrentWeaponVisible(ped, true, true, true, true)
        PlayPhoneAnimation('text')
    end)
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

function PlayPhoneAnimation(anim)
    local ped = cache.ped

    if anim == 'in' then
        RequestAnimDict('cellphone@')
        while not HasAnimDictLoaded('cellphone@') do Wait(10) end
        TaskPlayAnim(ped, 'cellphone@', 'cellphone_text_in', 8.0, -8.0, -1, 50, 0, false, false, false)
    elseif anim == 'out' then
        ClearPedTasks(ped)
    elseif anim == 'call' then
        RequestAnimDict('cellphone@')
        while not HasAnimDictLoaded('cellphone@') do Wait(10) end
        TaskPlayAnim(ped, 'cellphone@', 'cellphone_call_to_text', 8.0, -8.0, -1, 50, 0, false, false, false)
    elseif anim == 'text' then
        RequestAnimDict('cellphone@')
        while not HasAnimDictLoaded('cellphone@') do Wait(10) end
        TaskPlayAnim(ped, 'cellphone@', 'cellphone_text_in', 8.0, -8.0, -1, 50, 0, false, false, false)
    end
end

function PhonePlayIn()
    PlayPhoneAnimation('in')
end

function PhonePlayOut()
    PlayPhoneAnimation('out')
end

function PhonePlayCall()
    PlayPhoneAnimation('call')
end

function PhonePlayText()
    PlayPhoneAnimation('text')
end

RegisterNUICallback('startCameraSession', function(data, cb)
    StartCameraSession(data)
    cb(true)
end)

RegisterNUICallback('updateCameraSession', function(data, cb)
    if not cameraSession.active then
        cb(false)
        return
    end

    if type(data) == 'table' then
        if data.effect ~= nil then
            local effect = tostring(data.effect)
            if CameraEffects[effect] then
                cameraSession.effect = effect
            end
        end
        if data.fov ~= nil then cameraSession.fov = ClampFov(data.fov) end
        if data.blur ~= nil then cameraSession.blur = ClampPercent(data.blur) end
        if data.flash ~= nil then cameraSession.flash = data.flash ~= false end
        if data.selfie ~= nil then cameraSession.selfie = data.selfie == true end
    end

    ApplyCameraSettings()
    cb(true)
end)

RegisterNUICallback('captureCameraSession', function(data, cb)
    CaptureCurrentFrame(data, cb)
end)

RegisterNUICallback('captureCameraVideoSession', function(_, cb)
    cb({ url = nil, error = 'video_not_supported' })
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
    local fov = ClampFov(type(data) == 'table' and data.fov or 52.0)
    local blur = ClampPercent(type(data) == 'table' and data.blur or 0)
    local flashEnabled = type(data) == 'table' and data.flash ~= false
    local selfieMode = type(data) == 'table' and data.selfie == true

    StartCameraSession({ effect = effect, fov = fov, blur = blur, flash = flashEnabled, selfie = selfieMode })
    takePhoto = true

    CreateThread(function()
        while takePhoto and cameraSession.active do
            Wait(0)

            if IsControlJustPressed(1, 177) then
                takePhoto = false
                StopCameraSession()
                cb({ url = nil })
                return
            end

            if IsControlJustPressed(1, 176) then
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

exports('PlayPhoneAnimation', PlayPhoneAnimation)
exports('PhonePlayIn', PhonePlayIn)
exports('PhonePlayOut', PhonePlayOut)
exports('PhonePlayCall', PhonePlayCall)
exports('PhonePlayText', PhonePlayText)
