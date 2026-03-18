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

    -- Verified: Context7 /communityox/ox_lib exposes lib.getNearbyPlayers(coords, radius, includePlayer) returning id/ped/coords entries.
    local players = lib.getNearbyPlayers(coords, maxDistance, false)
    for i = 1, #players do
        local player = players[i]
        nearbyPlayers[#nearbyPlayers + 1] = {
            serverId = GetPlayerServerId(player.id),
            ped = player.ped,
            distance = #(coords - player.coords)
        }
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
    },
    {
        name = 'gcphone_sharePhoto',
        icon = 'fa-solid fa-image',
        label = 'Compartir foto NFC',
        distance = Config.Proximity.SharePhotoDistance,
        canInteract = function(entity, distance)
            return IsPhoneOpenSafe() and distance <= Config.Proximity.SharePhotoDistance
        end,
        onSelect = function(data)
            local targetServerId = GetPlayerServerId(NetworkGetPlayerIndexFromPed(data.entity))

            SendNUIMessage({
                action = 'phone:openRoute',
                data = { route = 'gallery', data = { nfcAction = 'share_photo', targetServerId = targetServerId, requestId = GetGameTimer() } }
            })
        end
    },
    {
        name = 'gcphone_shareDocument',
        icon = 'fa-solid fa-id-card',
        label = 'Mostrar documento NFC',
        distance = Config.Proximity.ShareDocumentDistance,
        canInteract = function(entity, distance)
            return IsPhoneOpenSafe() and distance <= Config.Proximity.ShareDocumentDistance
        end,
        onSelect = function(data)
            local targetServerId = GetPlayerServerId(NetworkGetPlayerIndexFromPed(data.entity))
            
            SendNUIMessage({
                action = 'phone:openRoute',
                data = { route = 'documents', data = { nfcAction = 'share_document', targetServerId = targetServerId, requestId = GetGameTimer() } }
            })
        end
    },
    {
        name = 'gcphone_walletNfcInvoice',
        icon = 'fa-solid fa-wallet',
        label = 'Cobrar con NFC',
        distance = Config.Proximity.ShareWalletDistance,
        canInteract = function(entity, distance)
            return IsPhoneOpenSafe() and distance <= Config.Proximity.ShareWalletDistance
        end,
        onSelect = function(data)
            local targetServerId = GetPlayerServerId(NetworkGetPlayerIndexFromPed(data.entity))

            SendNUIMessage({
                action = 'phone:openRoute',
                data = { route = 'wallet', data = { nfcAction = 'create_invoice', targetServerId = targetServerId, requestId = GetGameTimer() } }
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

RegisterNUICallback('getNearbyPlayers', function(_, cb)
    local list = GetNearbyPlayers(Config.Proximity.ShareWalletDistance)
    local payload = {}

    for _, item in ipairs(list) do
        payload[#payload + 1] = {
            serverId = item.serverId,
            name = GetPlayerName(NetworkGetPlayerIndexFromPed(item.ped)) or ('ID ' .. tostring(item.serverId)),
            distance = math.floor((item.distance or 0) * 10) / 10,
        }
    end

    cb(payload)
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

RegisterNetEvent('gcphone:receiveSharedPhoto', function(data)
    SendNUIMessage({
        action = 'receiveSharedPhoto',
        data = data
    })

    SendNUIMessage({
        action = 'phone:openRoute',
        data = { route = 'gallery', data = { nfcAction = 'received_photo', sharedPhoto = data, requestId = GetGameTimer() } }
    })

    lib.notify({
        title = 'Foto recibida',
        description = (data.from or 'Alguien') .. ' te ha compartido una foto',
        type = 'info'
    })
end)

RegisterNetEvent('gcphone:receiveSharedDocument', function(data)
    SendNUIMessage({
        action = 'receiveSharedDocument',
        data = data
    })

    SendNUIMessage({
        action = 'phone:openRoute',
        data = { route = 'documents', data = { nfcAction = 'received_document', receivedDocument = data, requestId = GetGameTimer() } }
    })
    
    lib.notify({ 
        title = 'Documento recibido',
        description = data.from .. ' te ha mostrado un documento',
        type = 'info'
    })
end)

RegisterNetEvent('gcphone:walletNfcInvoiceReceived', function(data)
    SendNUIMessage({
        action = 'walletNfcInvoiceReceived',
        data = data
    })

    SendNUIMessage({
        action = 'phone:openRoute',
        data = { route = 'wallet', data = { nfcAction = 'incoming_invoice', invoice = data, requestId = GetGameTimer() } }
    })

    lib.notify({
        title = 'Cobro NFC',
        description = (data.fromName or 'Alguien') .. ' te envio un cobro',
        type = 'info'
    })
end)

RegisterNetEvent('gcphone:walletNfcInvoiceResult', function(data)
    SendNUIMessage({
        action = 'walletNfcInvoiceResult',
        data = data
    })

    if data and data.status == 'paid' then
        lib.notify({ title = 'Cobro NFC', description = 'Pago completado', type = 'success' })
    elseif data and data.status == 'rejected' then
        lib.notify({ title = 'Cobro NFC', description = 'Pago rechazado', type = 'error' })
    elseif data and data.status == 'expired' then
        lib.notify({ title = 'Cobro NFC', description = 'Cobro vencido', type = 'error' })
    end
end)

RegisterNetEvent('gcphone:bankInvoiceReceived', function(data)
    SendNUIMessage({
        action = 'bankInvoiceReceived',
        data = data
    })

    SendNUIMessage({
        action = 'phone:openRoute',
        data = { route = 'bank', data = { nfcAction = 'incoming_invoice', invoice = data, requestId = GetGameTimer() } }
    })

    lib.notify({
        title = 'Factura recibida',
        description = (data.fromName or 'Alguien') .. ' te envio una factura',
        type = 'info'
    })
end)

RegisterNetEvent('gcphone:bankInvoiceResult', function(data)
    SendNUIMessage({
        action = 'bankInvoiceResult',
        data = data
    })

    if data and data.status == 'paid' then
        lib.notify({ title = 'Factura', description = 'Factura pagada', type = 'success' })
    elseif data and data.status == 'rejected' then
        lib.notify({ title = 'Factura', description = 'Factura rechazada', type = 'error' })
    elseif data and data.status == 'expired' then
        lib.notify({ title = 'Factura', description = 'Factura vencida', type = 'error' })
    end
end)

RegisterNUICallback('shareDocument', function(data, cb)
    lib.callback('gcphone:documents:share', false, function(success, msg)
        if success then
            lib.notify({ title = 'Documento mostrado', type = 'success' })
        else
            lib.notify({ title = msg or 'Error al mostrar documento', type = 'error' })
        end
        cb({ success = success, message = msg })
    end, data)
end)

local LiveAudioSession = nil
local LiveAudioLastState = nil
local LiveAudioLastVolume = nil
local PushLiveAudioState

local function GetLiveAudioStatus()
    if not LiveAudioSession then
        return {
            active = false,
            localEnabled = true,
            currentVolume = 0.0,
            lastVolume = LiveAudioLastVolume,
        }
    end

    local targetPlayer = GetPlayerFromServerId(LiveAudioSession.targetServerId or -1)
    return {
        active = true,
        localEnabled = true,
        liveId = LiveAudioSession.liveId,
        targetServerId = LiveAudioSession.targetServerId,
        targetOnline = targetPlayer ~= -1,
        listenDistance = LiveAudioSession.listenDistance,
        leaveBuffer = LiveAudioSession.leaveBuffer,
        minVolume = LiveAudioSession.minVolume,
        maxVolume = LiveAudioSession.maxVolume,
        distanceCurve = LiveAudioSession.distanceCurve,
        volumeSmoothing = LiveAudioSession.volumeSmoothing,
        useMumbleRangeClamp = LiveAudioSession.useMumbleRangeClamp,
        updateIntervalMs = LiveAudioSession.updateIntervalMs,
        activeListen = LiveAudioSession.activeListen == true,
        currentVolume = LiveAudioSession.currentVolume,
        lastVolume = LiveAudioLastVolume,
    }
end

local function StopLiveAudioSession(reason)
    local disabledLiveId = nil
    if LiveAudioSession then
        disabledLiveId = LiveAudioSession.liveId
        PushLiveAudioState({
            liveId = LiveAudioSession.liveId,
            listening = false,
            targetOnline = false,
            distance = -1,
        })
    end

    LiveAudioSession = nil
    LiveAudioLastState = nil
    LiveAudioLastVolume = nil

    if disabledLiveId then
        SendNUIMessage({
            action = 'gcphone:snap:proximityDisabled',
            data = {
                liveId = disabledLiveId,
                reason = reason or 'stopped',
            }
        })
    end
end

local function ClampNumber(value, min, max)
    local n = tonumber(value)
    if not n then return min end
    if n < min then return min end
    if n > max then return max end
    return n
end

PushLiveAudioState = function(state)
    SendNUIMessage({
        action = 'gcphone:snap:proximityState',
        data = state,
    })
end

local function PushLiveAudioVolume(payload)
    SendNUIMessage({
        action = 'gcphone:snap:proximityVolume',
        data = payload,
    })
end

local function ComputeLiveAudioVolume(distance, maxDistance, minVolume, maxVolume, curve)
    local safeDistance = ClampNumber(maxDistance, 1.0, 80.0)
    local d = ClampNumber(distance, 0.0, safeDistance)
    local normalized = 1.0 - (d / safeDistance)
    local exponent = ClampNumber(curve, 0.5, 3.0)
    normalized = normalized ^ exponent
    local volume = minVolume + (maxVolume - minVolume) * normalized
    return ClampNumber(volume, 0.0, 1.0)
end

local function GetMumbleProximityRange()
    if type(MumbleGetTalkerProximity) ~= 'function' then
        return nil
    end

    local success, range = pcall(MumbleGetTalkerProximity)
    if not success then
        return nil
    end

    local value = tonumber(range)
    if not value or value <= 0 then
        return nil
    end

    return value
end

local function SmoothVolume(previous, target, factor)
    local f = ClampNumber(factor, 0.0, 1.0)
    if f <= 0.0 then
        return target
    end

    local prev = tonumber(previous)
    if not prev then
        return target
    end

    return prev + (target - prev) * f
end

RegisterNUICallback('snapLiveAudioStart', function(data, cb)
    local liveId = tonumber(type(data) == 'table' and data.liveId or nil)
    if not liveId or liveId < 1 then
        cb({ success = false, enabled = false, reason = 'invalid_live' })
        return
    end

    lib.callback('gcphone:snap:getLiveAudioSession', false, function(payload)
        if type(payload) ~= 'table' or payload.enabled ~= true then
            LiveAudioSession = nil
            LiveAudioLastState = nil
            LiveAudioLastVolume = nil
            cb({ success = true, enabled = false, reason = type(payload) == 'table' and payload.reason or 'disabled' })
            return
        end

        LiveAudioSession = {
            liveId = liveId,
            targetServerId = tonumber(payload.targetServerId),
            listenDistance = ClampNumber(payload.listenDistance, 3.0, 80.0),
            leaveBuffer = ClampNumber(payload.leaveBuffer, 0.0, 15.0),
            minVolume = ClampNumber(payload.minVolume, 0.0, 1.0),
            maxVolume = ClampNumber(payload.maxVolume, 0.0, 1.0),
            distanceCurve = ClampNumber(payload.distanceCurve, 0.5, 3.0),
            volumeSmoothing = ClampNumber(payload.volumeSmoothing, 0.0, 1.0),
            useMumbleRangeClamp = payload.useMumbleRangeClamp == true,
            updateIntervalMs = math.floor(ClampNumber(payload.updateIntervalMs, 120, 1500)),
            activeListen = false,
            currentVolume = nil,
        }

        if LiveAudioSession.maxVolume < LiveAudioSession.minVolume then
            LiveAudioSession.maxVolume = LiveAudioSession.minVolume
        end

        LiveAudioLastState = nil
        LiveAudioLastVolume = nil

        cb({
            success = true,
            enabled = true,
            config = {
                listenDistance = LiveAudioSession.listenDistance,
                leaveBuffer = LiveAudioSession.leaveBuffer,
                minVolume = LiveAudioSession.minVolume,
                maxVolume = LiveAudioSession.maxVolume,
                distanceCurve = LiveAudioSession.distanceCurve,
                volumeSmoothing = LiveAudioSession.volumeSmoothing,
                useMumbleRangeClamp = LiveAudioSession.useMumbleRangeClamp,
                updateIntervalMs = LiveAudioSession.updateIntervalMs,
            }
        })
    end, { liveId = liveId })
end)

RegisterNUICallback('snapLiveAudioStop', function(_, cb)
    StopLiveAudioSession('manual_stop')
    cb({ success = true })
end)

RegisterNUICallback('snapLiveAudioStatus', function(_, cb)
    cb(GetLiveAudioStatus())
end)

RegisterCommand('gcphone_liveauudio_status', function()
    local status = GetLiveAudioStatus()
    local asJson = json.encode(status)
    print(('[gcphone] liveaudio status: %s'):format(asJson or '{}'))

    if status.active then
        lib.notify({
            title = 'Snap Live Audio',
            description = ('Activo | Vol %.2f'):format(tonumber(status.currentVolume) or 0.0),
            type = 'inform'
        })
    else
        lib.notify({
            title = 'Snap Live Audio',
            description = 'Inactivo',
            type = 'inform'
        })
    end
end, false)

RegisterCommand('gcphone_liveauudio_stop', function()
    StopLiveAudioSession('command_stop')
    lib.notify({
        title = 'Snap Live Audio',
        description = 'Sesion de proximidad detenida',
        type = 'inform'
    })
end, false)

CreateThread(function()
    while true do
        local session = LiveAudioSession

        if not session then
            Wait(500)
        else
            local waitMs = session.updateIntervalMs or 220
            local playerPed = cache.ped
            local targetPlayer = GetPlayerFromServerId(session.targetServerId or -1)
            local targetOnline = targetPlayer ~= -1
            local listening = false
            local distance = -1.0
            local desiredVolume = 0.0

            if playerPed and playerPed > 0 then
                if targetOnline then
                    local targetPed = GetPlayerPed(targetPlayer)
                    if targetPed and targetPed > 0 then
                        local fromCoords = GetEntityCoords(playerPed)
                        local toCoords = GetEntityCoords(targetPed)
                        distance = #(fromCoords - toCoords)

                        local effectiveListenDistance = session.listenDistance
                        if session.useMumbleRangeClamp then
                            local mumbleRange = GetMumbleProximityRange()
                            if mumbleRange then
                                effectiveListenDistance = math.min(effectiveListenDistance, mumbleRange)
                            end
                        end

                        if session.activeListen then
                            listening = distance <= (effectiveListenDistance + session.leaveBuffer)
                        else
                            listening = distance <= effectiveListenDistance
                        end

                        session.activeListen = listening

                        if listening then
                            desiredVolume = ComputeLiveAudioVolume(distance, effectiveListenDistance, session.minVolume, session.maxVolume, session.distanceCurve)
                        end
                    end
                end
            end

            session.currentVolume = SmoothVolume(session.currentVolume, desiredVolume, session.volumeSmoothing)
            local volume = ClampNumber(session.currentVolume, 0.0, 1.0)

            local nextState = ('%s|%s|%s'):format(session.liveId, tostring(listening), tostring(targetOnline))
            if nextState ~= LiveAudioLastState then
                PushLiveAudioState({
                    liveId = session.liveId,
                    listening = listening,
                    targetOnline = targetOnline,
                    distance = distance,
                })
                LiveAudioLastState = nextState
            end

            local roundedVolume = math.floor(volume * 100 + 0.5) / 100
            if roundedVolume ~= LiveAudioLastVolume then
                PushLiveAudioVolume({
                    liveId = session.liveId,
                    volume = roundedVolume,
                })
                LiveAudioLastVolume = roundedVolume
            end

            local sleepMs = waitMs
            if (not targetOnline) and (not listening) and (roundedVolume <= 0.01) then
                sleepMs = math.max(waitMs, 700)
            end

            Wait(sleepMs)
        end
    end
end)

---@class GCSnapLiveAudioStatus
---@field active boolean
---@field listenerSource? integer
---@field broadcasterSource? integer
---@field distance? number
---@field volume? number

---@class GCNearbyPlayerEntry
---@field serverId integer
---@field ped integer
---@field distance number

---Get the current Snap live audio status for the local player.
---@return GCSnapLiveAudioStatus
exports('GetSnapLiveAudioStatus', GetLiveAudioStatus)

---Get nearby players around the local player.
---@param maxDistance number
---@return GCNearbyPlayerEntry[]
exports('GetNearbyPlayers', GetNearbyPlayers)
