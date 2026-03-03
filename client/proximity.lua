-- Creado/Modificado por JericoFX

local ox_target = exports.ox_target

local function IsPhoneOpenSafe()
    local resource = GetCurrentResourceName()
    local ok, open = pcall(function()
        return exports[resource]:IsPhoneOpen()
    end)
    if ok then return open and true or false end
    return PhoneState and PhoneState.isOpen or false
end

local function GetNearbyPlayers(maxDistance)
    local ped = cache.ped
    local coords = GetEntityCoords(ped)
    local nearbyPlayers = {}
    
    for _, player in ipairs(GetActivePlayers()) do
        if player ~= PlayerId() then
            local targetPed = GetPlayerPed(player)
            local targetCoords = GetEntityCoords(targetPed)
            local distance = #(coords - targetCoords)
            
            if distance <= maxDistance then
                table.insert(nearbyPlayers, {
                    serverId = GetPlayerServerId(player),
                    ped = targetPed,
                    distance = distance
                })
            end
        end
    end
    
    return nearbyPlayers
end

ox_target:addGlobalPlayer({
    {
        name = 'gcphone_shareContact',
        icon = 'fa-solid fa-address-book',
        label = 'Compartir mi contacto',
        distance = Config.Proximity.ShareContactDistance,
        canInteract = function(entity, distance)
            return IsPhoneOpenSafe() and distance <= Config.Proximity.ShareContactDistance
        end,
        onSelect = function(data)
            local targetServerId = GetPlayerServerId(NetworkGetPlayerIndexFromPed(data.entity))
            
            SendNUIMessage({
                action = 'openContactPicker',
                data = { targetServerId = targetServerId, type = 'share' }
            })
        end
    },
    {
        name = 'gcphone_shareLocation',
        icon = 'fa-solid fa-location-dot',
        label = 'Compartir ubicacion',
        distance = Config.Proximity.ShareLocationDistance,
        canInteract = function(entity, distance)
            return IsPhoneOpenSafe() and distance <= Config.Proximity.ShareLocationDistance
        end,
        onSelect = function(data)
            local targetServerId = GetPlayerServerId(NetworkGetPlayerIndexFromPed(data.entity))
            local ped = cache.ped
            local coords = GetEntityCoords(ped)
            
            lib.callback('gcphone:proximity:shareLocation', false, function(success)
                if success then
                    lib.notify({ title = 'Ubicacion enviada', type = 'success' })
                end
            end, {
                targetServerId = targetServerId,
                x = coords.x,
                y = coords.y,
                z = coords.z
            })
        end
    },
    {
        name = 'gcphone_addFriend',
        icon = 'fa-solid fa-user-plus',
        label = 'Anadir a redes sociales',
        distance = Config.Proximity.FriendRequestDistance,
        canInteract = function(entity, distance)
            return IsPhoneOpenSafe() and distance <= Config.Proximity.FriendRequestDistance
        end,
        onSelect = function(data)
            local targetServerId = GetPlayerServerId(NetworkGetPlayerIndexFromPed(data.entity))
            
            SendNUIMessage({
                action = 'openFriendRequest',
                data = { targetServerId = targetServerId }
            })
        end
    }
})

RegisterNUICallback('shareContact', function(data, cb)
    lib.callback('gcphone:proximity:shareContact', false, function(success, msg)
        if success then
            lib.notify({ title = 'Contacto enviado', type = 'success' })
        else
            lib.notify({ title = msg or 'Error', type = 'error' })
        end
        cb({ success = success, message = msg })
    end, data)
end)

RegisterNUICallback('sendFriendRequest', function(data, cb)
    lib.callback('gcphone:proximity:sendFriendRequest', false, function(success, msg)
        if success then
            if msg == 'accepted' then
                lib.notify({ title = 'Ahora son amigos!', type = 'success' })
            else
                lib.notify({ title = 'Solicitud enviada', type = 'success' })
            end
        else
            lib.notify({ title = msg or 'Error', type = 'error' })
        end
        cb({ success = success, message = msg })
    end, data)
end)

RegisterNUICallback('acceptFriendRequest', function(data, cb)
    lib.callback('gcphone:proximity:acceptFriendRequest', false, function(success)
        cb({ success = success })
    end, data)
end)

RegisterNUICallback('rejectFriendRequest', function(data, cb)
    lib.callback('gcphone:proximity:rejectFriendRequest', false, function(success)
        cb({ success = success })
    end, data)
end)

RegisterNUICallback('acceptContactRequest', function(data, cb)
    lib.callback('gcphone:proximity:acceptContact', false, function(success)
        if success then
            lib.notify({ title = 'Contacto guardado', type = 'success' })
        end
        cb({ success = success })
    end, data)
end)

RegisterNetEvent('gcphone:receiveContactRequest', function(data)
    SendNUIMessage({
        action = 'receiveContactRequest',
        data = data
    })
end)

RegisterNetEvent('gcphone:receiveSharedLocation', function(data)
    SendNUIMessage({
        action = 'receiveSharedLocation',
        data = data
    })
    
    lib.notify({ 
        title = 'Ubicacion recibida',
        description = data.from .. ' te ha compartido su ubicacion',
        type = 'info'
    })
end)

RegisterNetEvent('gcphone:receiveFriendRequest', function(data)
    SendNUIMessage({
        action = 'receiveFriendRequest',
        data = data
    })
end)

RegisterNetEvent('gcphone:friendRequestAccepted', function(data)
    SendNUIMessage({
        action = 'friendRequestAccepted',
        data = data
    })
    
    lib.notify({ 
        title = 'Solicitud aceptada',
        description = 'Ahora eres amigo de ' .. data.name,
        type = 'success'
    })
end)

RegisterNetEvent('gcphone:receiveSharedPost', function(data)
    SendNUIMessage({
        action = 'receiveSharedPost',
        data = data
    })
    
    lib.notify({ 
        title = 'Publicacion compartida',
        description = data.from .. ' te ha compartido una publicacion',
        type = 'info'
    })
end)

exports('GetNearbyPlayers', GetNearbyPlayers)
