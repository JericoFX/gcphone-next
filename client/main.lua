-- Creado/Modificado por JericoFX

PhoneState = {
    isOpen = false,
    phoneNumber = nil,
    hasFocus = false,
    useMouse = false,
    airplaneMode = false
}

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
            PhoneState.coque = data.coque
            PhoneState.language = data.language
            PhoneState.audioProfile = data.audioProfile
            
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
    PhoneState.coque = data.coque
    PhoneState.language = data.language
    PhoneState.audioProfile = data.audioProfile
    
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
