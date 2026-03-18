local flashlightState = {
    enabled = false,
    threadActive = false,
    kelvin = 5200,
    lumens = 1200,
}

local remoteFlashlights = {}

local function IsPhoneRenderable()
    if type(IsAdvancedPhoneCameraActive) == 'function' and IsAdvancedPhoneCameraActive() then
        return true
    end

    return PhoneState and PhoneState.isOpen == true
end

local function Clamp(value, minValue, maxValue)
    local num = tonumber(value) or minValue
    if num < minValue then return minValue end
    if num > maxValue then return maxValue end
    return num + 0.0
end

local function Round(value)
    return math.floor((tonumber(value) or 0) + 0.5)
end

local function GetKelvinRange()
    local cfg = Config.Flashlight and Config.Flashlight.Kelvin or {}
    return cfg.Min or 2600, cfg.Max or 9000, cfg.Default or 5200
end

local function GetLumensRange()
    local cfg = Config.Flashlight and Config.Flashlight.Lumens or {}
    return cfg.Min or 350, cfg.Max or 2200, cfg.Default or 1200
end

local function NormalizeKelvin(value)
    local minValue, maxValue, defaultValue = GetKelvinRange()
    return Round(Clamp(value, minValue, maxValue) or defaultValue)
end

local function NormalizeLumens(value)
    local minValue, maxValue, defaultValue = GetLumensRange()
    return Round(Clamp(value, minValue, maxValue) or defaultValue)
end

local function KelvinToRgb(kelvin)
    local temp = Clamp(kelvin, 1000.0, 40000.0) / 100.0
    local red
    local green
    local blue

    if temp <= 66.0 then
        red = 255.0
        green = 99.4708025861 * math.log(temp) - 161.1195681661
        if temp <= 19.0 then
            blue = 0.0
        else
            blue = 138.5177312231 * math.log(temp - 10.0) - 305.0447927307
        end
    else
        red = 329.698727446 * ((temp - 60.0) ^ -0.1332047592)
        green = 288.1221695283 * ((temp - 60.0) ^ -0.0755148492)
        blue = 255.0
    end

    return {
        r = Round(Clamp(red, 0.0, 255.0)),
        g = Round(Clamp(green, 0.0, 255.0)),
        b = Round(Clamp(blue, 0.0, 255.0)),
    }
end

local function EnsureRemoteFlashlight(serverId)
    local entry = remoteFlashlights[serverId]
    if entry then return entry end

    local _, _, defaultKelvin = GetKelvinRange()
    local _, _, defaultLumens = GetLumensRange()
    entry = {
        enabled = false,
        kelvin = defaultKelvin,
        lumens = defaultLumens,
    }
    remoteFlashlights[serverId] = entry
    return entry
end

local function PushFlashlightProfileToServer()
    TriggerServerEvent('gcphone:flashlight:setProfile', {
        kelvin = flashlightState.kelvin,
        lumens = flashlightState.lumens,
    })
end

local function SetFlashlightProfile(data, syncServer)
    flashlightState.kelvin = NormalizeKelvin(type(data) == 'table' and data.kelvin or flashlightState.kelvin)
    flashlightState.lumens = NormalizeLumens(type(data) == 'table' and data.lumens or flashlightState.lumens)

    if syncServer ~= false then
        PushFlashlightProfileToServer()
    end

    return {
        kelvin = flashlightState.kelvin,
        lumens = flashlightState.lumens,
    }
end

local function GetFlashlightProfilePayload()
    local minKelvin, maxKelvin = GetKelvinRange()
    local minLumens, maxLumens = GetLumensRange()
    return {
        enabled = flashlightState.enabled == true,
        kelvin = flashlightState.kelvin,
        lumens = flashlightState.lumens,
        minKelvin = minKelvin,
        maxKelvin = maxKelvin,
        minLumens = minLumens,
        maxLumens = maxLumens,
    }
end

local function GetForwardVector(rotation)
    local pitch = math.rad(rotation.x)
    local yaw = math.rad(rotation.z)
    local cosPitch = math.cos(pitch)
    return vector3(-math.sin(yaw) * cosPitch, math.cos(yaw) * cosPitch, math.sin(pitch))
end

local function DrawPhoneFlashlightForPed(ped, intensityScale)
    if not ped or ped <= 0 or not DoesEntityExist(ped) then return end

    local hand = GetPedBoneCoords(ped, 28422, 0.0, 0.0, 0.0)
    local rotation = GetEntityRotation(ped, 2)
    local forward = GetForwardVector(rotation)
    local length = Clamp(Config.Flashlight and Config.Flashlight.Distance or 18.0, 4.0, 40.0)
    local lumensBase = NormalizeLumens(type(intensityScale) == 'table' and intensityScale.lumens or flashlightState.lumens)
    local brightness = Clamp(Config.Flashlight and Config.Flashlight.Intensity or 1.1, 0.2, 4.0)
        * Clamp(lumensBase / 1200.0, 0.35, 2.25)
        * (type(intensityScale) == 'table' and intensityScale.scale or intensityScale or 1.0)
    local color = KelvinToRgb(type(intensityScale) == 'table' and intensityScale.kelvin or flashlightState.kelvin)

    -- Verified: Cfx Native Reference DrawSpotLightWithShadow draws projected flashlight beam in client context.
    DrawSpotLightWithShadow(
        hand.x,
        hand.y,
        hand.z + 0.04,
        forward.x,
        forward.y,
        forward.z,
        color.r,
        color.g,
        color.b,
        length,
        brightness,
        0.0,
        14.0,
        18.0,
        0
    )
end

local function RunLocalFlashlightLoop()
    if flashlightState.threadActive then return end
    flashlightState.threadActive = true

    CreateThread(function()
        while flashlightState.enabled do
            if IsPhoneRenderable() then
                Wait(0)
                DrawPhoneFlashlightForPed(cache.ped, {
                    scale = 1.0,
                    kelvin = flashlightState.kelvin,
                    lumens = flashlightState.lumens,
                })
            else
                Wait(200)
            end
        end

        flashlightState.threadActive = false
    end)
end

local function SetFlashlightEnabled(enabled)
    if not Config.Flashlight or Config.Flashlight.Enabled == false then
        flashlightState.enabled = false
        return false
    end

    local nextState = enabled == true
    if flashlightState.enabled == nextState then
        return nextState
    end

    flashlightState.enabled = nextState
    PushFlashlightProfileToServer()
    TriggerServerEvent('gcphone:flashlight:setEnabled', flashlightState.enabled)

    if flashlightState.enabled then
        RunLocalFlashlightLoop()
    end

    return flashlightState.enabled
end

function SetPhoneFlashlightEnabled(enabled)
    return SetFlashlightEnabled(enabled)
end

function IsPhoneFlashlightEnabled()
    return flashlightState.enabled == true
end

function GetPhoneFlashlightProfile()
    return GetFlashlightProfilePayload()
end

---@class GCPhoneFlashlightProfile
---@field kelvin integer
---@field lumens integer
---@field enabled boolean

---Enable or disable the phone flashlight.
---@param enabled boolean
---@return boolean
exports('SetPhoneFlashlightEnabled', SetPhoneFlashlightEnabled)

---Check if the phone flashlight is enabled.
---@return boolean
exports('IsPhoneFlashlightEnabled', IsPhoneFlashlightEnabled)

---Get the current flashlight profile used by the phone camera.
---@return GCPhoneFlashlightProfile
exports('GetPhoneFlashlightProfile', GetPhoneFlashlightProfile)

RegisterNUICallback('cameraToggleFlashlight', function(data, cb)
    local enabled = type(data) == 'table' and data.enabled == true or false
    cb({ success = true, enabled = SetFlashlightEnabled(enabled) })
end)

RegisterNUICallback('cameraGetFlashlightSettings', function(_, cb)
    cb(GetFlashlightProfilePayload())
end)

RegisterNUICallback('cameraSetFlashlightSettings', function(data, cb)
    local profile = SetFlashlightProfile(data, true)
    cb({ success = true, kelvin = profile.kelvin, lumens = profile.lumens })
end)

AddStateBagChangeHandler('gcphoneFlashlight', nil, function(bagName, _, value)
    local entity = GetEntityFromStateBagName(bagName)
    if entity == 0 then return end

    local player = NetworkGetPlayerIndexFromPed(entity)
    if player == PlayerId() then return end

    local serverId = GetPlayerServerId(player)
    if not serverId or serverId <= 0 then return end

    local entry = EnsureRemoteFlashlight(serverId)
    entry.enabled = value == true
    if not entry.enabled then
        remoteFlashlights[serverId] = nil
    end
end)

AddStateBagChangeHandler('gcphoneFlashlightProfile', nil, function(bagName, _, value)
    local entity = GetEntityFromStateBagName(bagName)
    if entity == 0 then return end

    local player = NetworkGetPlayerIndexFromPed(entity)
    if player == PlayerId() then return end

    local serverId = GetPlayerServerId(player)
    if not serverId or serverId <= 0 then return end

    local decoded = type(value) == 'string' and json.decode(value) or nil
    if type(decoded) ~= 'table' then return end

    local entry = EnsureRemoteFlashlight(serverId)
    entry.kelvin = NormalizeKelvin(decoded.kelvin)
    entry.lumens = NormalizeLumens(decoded.lumens)
end)

CreateThread(function()
    while true do
        if next(remoteFlashlights) == nil then
            Wait(700)
        else
            Wait(0)
            local myCoords = GetEntityCoords(cache.ped)
            local syncDistance = Clamp(Config.Flashlight and Config.Flashlight.SyncDistance or 30.0, 5.0, 60.0)
            local anyVisible = false
            for serverId, profile in pairs(remoteFlashlights) do
                local player = GetPlayerFromServerId(serverId)
                if player ~= -1 then
                    local ped = GetPlayerPed(player)
                    if ped ~= 0 and DoesEntityExist(ped) then
                        local coords = GetEntityCoords(ped)
                        if #(myCoords - coords) <= syncDistance then
                            anyVisible = true
                            DrawPhoneFlashlightForPed(ped, {
                                scale = 0.9,
                                kelvin = profile.kelvin,
                                lumens = profile.lumens,
                            })
                        end
                    end
                end
            end
            if not anyVisible then
                Wait(200)
            end
        end
    end
end)

AddEventHandler('onResourceStop', function(resourceName)
    if resourceName ~= GetCurrentResourceName() then return end
    if flashlightState.enabled then
        TriggerServerEvent('gcphone:flashlight:setEnabled', false)
    end
end)

do
    local _, _, defaultKelvin = GetKelvinRange()
    local _, _, defaultLumens = GetLumensRange()
    flashlightState.kelvin = defaultKelvin
    flashlightState.lumens = defaultLumens
end
