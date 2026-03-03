-- Creado/Modificado por JericoFX

local KeyOpenClose = Config.Phone.KeyOpen
local menuIsOpen = false
local hasFocus = false
local useMouse = false
local ignoreFocus = false
local phoneProp = nil
local PHONE_PROP_MODEL = GetHashKey("prop_npc_phone_02")

local function EnsurePhoneProp()
    local ped = cache.ped
    if phoneProp and DoesEntityExist(phoneProp) then return end

    RequestModel(PHONE_PROP_MODEL)
    while not HasModelLoaded(PHONE_PROP_MODEL) do
        Wait(0)
    end

    phoneProp = CreateObject(PHONE_PROP_MODEL, 0.0, 0.0, 0.0, true, true, false)
    if phoneProp and DoesEntityExist(phoneProp) then
        AttachEntityToEntity(phoneProp, ped, GetPedBoneIndex(ped, 28422), 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, true, true, false, true, 1, true)
        SetEntityAsMissionEntity(phoneProp, true, true)
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

function TogglePhone()
    menuIsOpen = not menuIsOpen
    
    if menuIsOpen then
        PhoneState.isOpen = true
        TriggerServerEvent('gcphone:stateChanged', true)
        EnsurePhoneProp()
        
        lib.callback('gcphone:getPhoneData', false, function(data)
            if data then
                SendNUIMessage({
                    action = 'showPhone',
                    data = data
                })
            end
        end)
        
        PlayPhoneAnimation('in')
    else
        PhoneState.isOpen = false
        TriggerServerEvent('gcphone:stateChanged', false)
        RemovePhoneProp()
        
        SendNUIMessage({ action = 'hidePhone' })
        
        if hasFocus then
            SetNuiFocus(false, false)
            hasFocus = false
        end
        
        PlayPhoneAnimation('out')
    end
end

function ClosePhone()
    if menuIsOpen then
        TogglePhone()
    end
end

CreateThread(function()
    while true do
        Wait(0)
        
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
