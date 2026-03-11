local KeyOpenClose = Config.Phone.KeyOpen
local menuIsOpen = false
local hasFocus = false
local useMouse = false
local ignoreFocus = false
local phoneProp = nil
local PHONE_PROP_MODEL = GetHashKey("prop_npc_phone_02")
local phoneVisualMode = 'text'
local phoneVisualOptions = {}

local function GetVisualPreset()
    local cfg = Config.PhoneVisual or {}

    if phoneVisualMode == 'call' then
        return cfg.Call or cfg.Text or {}
    end

    if phoneVisualMode == 'camera' then
        if phoneVisualOptions.landscape == true then
            return cfg.CameraLandscape or cfg.Camera or cfg.Text or {}
        end

        return cfg.Camera or cfg.Text or {}
    end

    if phoneVisualMode == 'live' then
        return cfg.Live or cfg.Camera or cfg.Text or {}
    end

    return cfg.Text or {}
end

local function ApplyPhonePropAttachment()
    if not phoneProp or not DoesEntityExist(phoneProp) then return end

    local ped = cache.ped
    if not ped or ped <= 0 then return end

    local preset = GetVisualPreset()
    local offset = preset.offset or {}
    local rotation = preset.rotation or {}

    AttachEntityToEntity(
        phoneProp,
        ped,
        GetPedBoneIndex(ped, 28422),
        offset.x or 0.0,
        offset.y or 0.0,
        offset.z or 0.0,
        rotation.x or 0.0,
        rotation.y or 0.0,
        rotation.z or 0.0,
        true,
        true,
        false,
        true,
        1,
        true
    )
end

local function EnsurePhoneProp()
    local ped = cache.ped
    if phoneProp and DoesEntityExist(phoneProp) then return end

    RequestModel(PHONE_PROP_MODEL)
    while not HasModelLoaded(PHONE_PROP_MODEL) do
        Wait(0)
    end

    phoneProp = CreateObject(PHONE_PROP_MODEL, 0.0, 0.0, 0.0, true, true, false)
    if phoneProp and DoesEntityExist(phoneProp) then
        SetEntityAsMissionEntity(phoneProp, true, true)
        ApplyPhonePropAttachment()
    end

    SetModelAsNoLongerNeeded(PHONE_PROP_MODEL)
end

local function RemovePhoneProp()
    if phoneProp and DoesEntityExist(phoneProp) then
        DetachEntity(phoneProp, true, true)
        DeleteEntity(phoneProp)
    end
    phoneProp = nil
end

local KeyControls = {
    { code = 172, event = 'ArrowUp' },
    { code = 173, event = 'ArrowDown' },
    { code = 174, event = 'ArrowLeft' },
    { code = 175, event = 'ArrowRight' },
    { code = 176, event = 'Enter' },
    { code = 177, event = 'Backspace' }
}

local function ShowPhonePayload(data)
    if not data then return end

    menuIsOpen = true
    PhoneState.isOpen = true
    TriggerServerEvent('gcphone:stateChanged', true)
    EnsurePhoneProp()

    data.nuiAuthToken = RotateNuiAuthToken()
    SendNUIMessage({
        action = 'showPhone',
        data = data
    })

    PlayPhoneAnimation('in')
end

function OpenPhoneUsingServerData()
    lib.callback('gcphone:getPhoneData', false, function(data)
        if data then
            ShowPhonePayload(data)
        end
    end)
end

function TogglePhone()
    menuIsOpen = not menuIsOpen
    
    if menuIsOpen then
        OpenPhoneUsingServerData()
    else
        PhoneState.isOpen = false
        TriggerServerEvent('gcphone:stateChanged', false)
        TriggerServerEvent('gcphone:clearPhoneAccessContext')
        RemovePhoneProp()
        phoneVisualMode = 'text'
        phoneVisualOptions = {}
        
        SendNUIMessage({ action = 'hidePhone' })
        
        if hasFocus then
            SetNuiFocus(false, false)
            hasFocus = false
        end
        
        PlayPhoneAnimation('out')
    end
end

function SetPhoneVisualMode(mode, options)
    phoneVisualMode = type(mode) == 'string' and mode or 'text'
    phoneVisualOptions = type(options) == 'table' and options or {}
    ApplyPhonePropAttachment()
end

function GetPhoneVisualMode()
    return phoneVisualMode, phoneVisualOptions
end

function ClosePhone()
    if menuIsOpen then
        TogglePhone()
    end
end

CreateThread(function()
    while true do
        local sleepMs = menuIsOpen and 0 or 150
        Wait(sleepMs)
        
        if IsControlJustPressed(1, KeyOpenClose) then
            if not PhoneState.phoneNumber then
                lib.callback('gcphone:getPhoneData', false, function(data)
                    if data then
                        PhoneState.phoneNumber = data.phoneNumber
                        TogglePhone()
                    end
                end)
            else
                TogglePhone()
            end
        end
        
        if menuIsOpen then
            for _, key in ipairs(KeyControls) do
                if IsControlJustPressed(1, key.code) then
                    SendNUIMessage({ keyUp = key.event })
                end
            end
            
            if useMouse and hasFocus == ignoreFocus then
                local nuiFocus = not hasFocus
                SetNuiFocus(nuiFocus, nuiFocus)
                hasFocus = nuiFocus
            elseif not useMouse and hasFocus then
                SetNuiFocus(false, false)
                hasFocus = false
            end
        else
            if hasFocus then
                SetNuiFocus(false, false)
                hasFocus = false
            end
        end
    end
end)

AddEventHandler('onResourceStop', function(resourceName)
    if resourceName ~= GetCurrentResourceName() then return end
    RemovePhoneProp()
end)

RegisterNUICallback('closePhone', function(_, cb)
    ClosePhone()
    cb(true)
end)

RegisterNUICallback('useMouse', function(state, cb)
    useMouse = state
    cb(true)
end)

RegisterNUICallback('setIgnoreFocus', function(data, cb)
    ignoreFocus = data.ignoreFocus
    cb(true)
end)

RegisterNUICallback('phoneSetVisualMode', function(data, cb)
    SetPhoneVisualMode(type(data) == 'table' and data.mode or 'text', type(data) == 'table' and data.options or {})
    cb(true)
end)

RegisterNetEvent('gcphone:forceOpenPhone', function()
    if not menuIsOpen then
        TogglePhone()
    end
end)

RegisterNetEvent('gcphone:forceClosePhone', function()
    if menuIsOpen then
        TogglePhone()
    end
end)

exports('TogglePhone', TogglePhone)
exports('ClosePhone', ClosePhone)
exports('IsPhoneOpen', function() return menuIsOpen end)
exports('SetPhoneVisualMode', SetPhoneVisualMode)
exports('GetPhoneVisualMode', GetPhoneVisualMode)
