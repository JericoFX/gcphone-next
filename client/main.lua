PhoneState = {
    isOpen = false,
    phoneNumber = nil,
    hasFocus = false,
    useMouse = false,
    airplaneMode = false
}

local function CreateNuiAuthToken()
    local now = GetGameTimer() or 0
    local a = math.random(100000, 999999)
    local b = math.random(100000, 999999)
    return ('%d-%d-%d'):format(now, a, b)
end

GCPhoneNuiToken = nil
GCPhoneNuiLastSeq = 0

local function BuildNuiSignature(token, seq, eventName)
    local input = ('%s|%s|%s'):format(token, seq, eventName)
    local hash = 2166136261

    for i = 1, #input do
        hash = (hash ~ string.byte(input, i)) & 0xffffffff
        hash = (hash * 16777619) & 0xffffffff
    end

    return string.format('%08x', hash)
end

function RotateNuiAuthToken()
    GCPhoneNuiToken = CreateNuiAuthToken()
    GCPhoneNuiLastSeq = 0
    return GCPhoneNuiToken
end

function GetNuiAuthToken()
    if not GCPhoneNuiToken then
        GCPhoneNuiToken = CreateNuiAuthToken()
    end
    return GCPhoneNuiToken
end

local UnprotectedNuiCallbacks = {
    nuiReady = true,
}

local NativeRegisterNUICallback = RegisterNUICallback

RegisterNUICallback = function(name, handler)
    NativeRegisterNUICallback(name, function(rawData, cb)
        local payload = rawData
        local providedToken = nil
        local providedSeq = nil
        local providedSig = nil

        if type(rawData) == 'table' and type(rawData._gc) == 'table' then
            payload = rawData.data
            providedToken = rawData._gc.token
            providedSeq = tonumber(rawData._gc.seq)
            providedSig = rawData._gc.sig
        end

        if payload == nil then
            payload = {}
        end

        if not UnprotectedNuiCallbacks[name] then
            local expectedToken = GetNuiAuthToken()
            if not PhoneState.isOpen then
                cb({ success = false, message = 'PHONE_CLOSED' })
                return
            end

            if type(providedToken) ~= 'string' or providedToken ~= expectedToken then
                cb({ success = false, message = 'UNAUTHORIZED' })
                return
            end

            if not providedSeq or providedSeq <= GCPhoneNuiLastSeq then
                cb({ success = false, message = 'UNAUTHORIZED' })
                return
            end

            local expectedSig = BuildNuiSignature(expectedToken, providedSeq, name)
            if type(providedSig) ~= 'string' or providedSig ~= expectedSig then
                cb({ success = false, message = 'UNAUTHORIZED' })
                return
            end

            GCPhoneNuiLastSeq = providedSeq
        end

        handler(payload, cb)
    end)
end

CreateThread(function()
    Wait(1000)
    print('^2[gcphone-next]^7 Client initialized')
    
    lib.callback('gcphone:getPhoneData', false, function(data)
        if data then
            PhoneState.phoneNumber = data.phoneNumber
            PhoneState.wallpaper = data.wallpaper
            PhoneState.ringtone = data.ringtone
            PhoneState.volume = data.volume
            PhoneState.lockCode = data.lockCode
            PhoneState.language = data.language
            PhoneState.audioProfile = data.audioProfile
            data.nuiAuthToken = RotateNuiAuthToken()
            
            SendNUIMessage({
                action = 'initPhone',
                data = data
            })
        end
    end)
end)

RegisterNetEvent('gcphone:init', function(data)
    PhoneState.phoneNumber = data.phoneNumber
    PhoneState.wallpaper = data.wallpaper
    PhoneState.ringtone = data.ringtone
    PhoneState.volume = data.volume
    PhoneState.lockCode = data.lockCode
    PhoneState.language = data.language
    PhoneState.audioProfile = data.audioProfile
    data.nuiAuthToken = RotateNuiAuthToken()
    
    SendNUIMessage({
        action = 'initPhone',
        data = data
    })
end)

RegisterNUICallback('nuiReady', function(_, cb)
    cb(true)
end)

local function PushPhoneNotification(payload)
    if type(payload) ~= 'table' then return false end
    SendNUIMessage({
        action = 'phone:notification',
        data = payload
    })
    return true
end

RegisterNetEvent('gcphone:notify', function(payload)
    PushPhoneNotification(payload)
end)

exports('GetPhoneState', function()
    return PhoneState
end)

exports('IsPhoneOpen', function()
    return PhoneState.isOpen
end)

exports('NotifyPhone', function(payload)
    return PushPhoneNotification(payload)
end)
