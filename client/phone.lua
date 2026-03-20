local menuIsOpen = false
local phoneProp = nil
local PHONE_PROP_MODEL = GetHashKey(Config.Phone.PropModel or 'prop_npc_phone_02')
local phoneVisualMode = 'text'
local phoneVisualOptions = {}
local nuiInputState = {
    focus = false,
    cursor = false,
    keepInput = false,
}

local function ResolvePhoneOpenKey()
    local key = Config.Phone and Config.Phone.KeyOpen
    if type(key) == 'string' and key ~= '' then
        return key
    end

    local controlMap = {
        [288] = 'F1',
        [289] = 'F2',
        [170] = 'F3',
        [166] = 'F5',
        [167] = 'F6',
        [168] = 'F7',
    }

    return controlMap[tonumber(key) or -1] or 'F1'
end

---@alias GCPhoneVisualMode 'text'|'call'|'camera'|'live'

local function UpdateNuiInputState(force)
    local desiredFocus = menuIsOpen
    local desiredCursor = menuIsOpen
    local desiredKeepInput = menuIsOpen

    if not force
        and nuiInputState.focus == desiredFocus
        and nuiInputState.cursor == desiredCursor
        and nuiInputState.keepInput == desiredKeepInput then
        return
    end

    nuiInputState.focus = desiredFocus
    nuiInputState.cursor = desiredCursor
    nuiInputState.keepInput = desiredKeepInput

    SetNuiFocus(desiredFocus, desiredCursor)
    SetNuiFocusKeepInput(desiredKeepInput)

    PhoneState.hasFocus = desiredFocus
    PhoneState.useMouse = desiredCursor
end

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

    lib.requestModel(PHONE_PROP_MODEL)

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

local function ShowPhonePayload(data)
    if type(data) ~= 'table' then return end

    menuIsOpen = true
    PhoneState.isOpen = true
    TriggerServerEvent('gcphone:stateChanged', true)
    EnsurePhoneProp()
    UpdateNuiInputState(true)

    data.nuiAuthToken = GCPhone.RotateNuiAuthToken()
    SendNUIMessage({
        action = 'showPhone',
        data = data
    })

    PlayPhoneAnimation('in')
end

function OpenPhoneUsingServerData()
    lib.callback('gcphone:getPhoneData', false, function(data)
        if not data then return end

        if data.blocked then
            lib.notify({
                title = 'Telefono',
                description = data.error == 'NO_PHONE_ITEM' and 'No tienes un telefono' or 'No se pudo abrir el telefono',
                type = 'error',
            })
            menuIsOpen = false
            return
        end

        ShowPhonePayload(data)
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
        UpdateNuiInputState(true)
        
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

local phoneKeybind = lib.addKeybind({
    name = 'gcphone_toggle',
    description = 'Abrir o cerrar telefono',
    defaultMapper = 'keyboard',
    defaultKey = ResolvePhoneOpenKey(),
    onPressed = function()
        if not PhoneState.phoneNumber then
            lib.callback('gcphone:getPhoneData', false, function(data)
                if data then
                    PhoneState.phoneNumber = data.phoneNumber
                    TogglePhone()
                end
            end)
            return
        end

        TogglePhone()
    end,
})

AddEventHandler('onResourceStop', function(resourceName)
    if resourceName ~= GetCurrentResourceName() then return end
    phoneKeybind:disable(true)
    SetNuiFocus(false, false)
    SetNuiFocusKeepInput(false)
    RemovePhoneProp()
end)

RegisterNUICallback('closePhone', function(_, cb)
    ClosePhone()
    cb(true)
end)

RegisterNUICallback('useMouse', function(state, cb)
    UpdateNuiInputState(true)
    cb(true)
end)

RegisterNUICallback('setIgnoreFocus', function(data, cb)
    UpdateNuiInputState(true)
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

RegisterNetEvent('gcphone:phoneMarkedStolen', function(data)
    if type(data) ~= 'table' then return end

    -- Update NUI stolen state
    SendNUIMessage({
        action = 'phone:stolenUpdate',
        data = {
            isStolen = data.isStolen ~= false,
            reason = data.reason or '',
        }
    })

    -- Push notification
    SendNUIMessage({
        action = 'phone:notification',
        data = {
            id = 'phone-stolen-alert',
            appId = 'system',
            title = 'Alerta de seguridad',
            message = data.isStolen ~= false
                and ('Tu telefono ha sido reportado como robado' .. (data.reason and data.reason ~= '' and (': ' .. data.reason) or ''))
                or 'Tu telefono ya no esta reportado como robado',
            icon = './img/icons_ios/ui-warning.svg',
            priority = 'high',
            duration = 8000,
        }
    })
end)

---Toggle the phone open/closed state.
---@return nil
exports('TogglePhone', TogglePhone)

---Force the phone closed if it is open.
---@return nil
exports('ClosePhone', ClosePhone)

---Check whether the phone UI is currently open.
---@return boolean
exports('IsPhoneOpen', function() return menuIsOpen end)

---Set the current phone visual mode used by animations and presentation.
---@param mode GCPhoneVisualMode|string
---@param options? table<string, any>
---@return nil
exports('SetPhoneVisualMode', SetPhoneVisualMode)

---Get the current phone visual mode.
---@return string, table<string, any>
exports('GetPhoneVisualMode', GetPhoneVisualMode)
