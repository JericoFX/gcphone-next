-- Creado/Modificado por JericoFX

local currentDroppedPhones = {}
local phoneObjects = {}
local isNearPhone = false
local nearestPhone = nil

local function CreatePhoneObject(coords)
    local model = "prop_npc_phone_01"
    lib.requestModel(model)
    
    local phoneObj = CreateObject(model, coords.x, coords.y, coords.z, false, false, false)
    SetEntityAsMissionEntity(phoneObj, true, false)
    PlaceObjectOnGroundProperly(phoneObj)
    
    SetModelAsNoLongerNeeded(model)
    
    return phoneObj
end

local function RemovePhoneObject(phoneId)
    if phoneObjects[phoneId] then
        DeleteEntity(phoneObjects[phoneId])
        phoneObjects[phoneId] = nil
    end
end

RegisterCommand('tiratelefono', function()
    lib.callback('gcphone:dropPhone', false, function(result)
        if result and result.success then
            lib.notify({
                title = 'Telefono',
                description = 'Has tirado tu telefono al suelo',
                type = 'success'
            })
        else
            lib.notify({
                title = 'Error',
                description = 'No se pudo tirar el telefono: ' .. (result and result.error or 'Unknown error'),
                type = 'error'
            })
        end
    end)
end, false)

RegisterNetEvent('gcphone:phoneDropped', function(data)
    if not data or not data.phoneId or not data.coords then return end
    
    currentDroppedPhones[data.phoneId] = data
    
    local phoneObj = CreatePhoneObject(data.coords)
    phoneObjects[data.phoneId] = phoneObj
end)

RegisterNetEvent('gcphone:phonePickedUp', function(phoneId)
    if not phoneId then return end
    
    RemovePhoneObject(phoneId)
    currentDroppedPhones[phoneId] = nil
end)

RegisterNUICallback('getPhoneMetadata', function(_, cb)
    lib.callback('gcphone:getPhoneMetadata', false, function(result)
        cb(result or { success = false })
    end)
end)

CreateThread(function()
    while true do
        Wait(500)
        
        local ped = PlayerPedId()
        local pedCoords = GetEntityCoords(ped)
        isNearPhone = false
        nearestPhone = nil
        
        for phoneId, phoneData in pairs(currentDroppedPhones) do
            if phoneObjects[phoneId] and DoesEntityExist(phoneObjects[phoneId]) then
                local phoneCoords = GetEntityCoords(phoneObjects[phoneId])
                local distance = #(pedCoords - phoneCoords)
                
                if distance < 2.0 then
                    isNearPhone = true
                    nearestPhone = phoneId
                    
                    lib.showTextUI('[E] Examinar telefono', {
                        position = 'left-center'
                    })
                    
                    if IsControlJustReleased(0, 38) then
                        local action = lib.inputDialog('Telefono encontrado', {
                            {
                                type = 'select',
                                label = 'Accion',
                                required = true,
                                options = {
                                    { value = 'inspect', label = 'Ver metadata' },
                                    { value = 'unlock', label = 'Intentar PIN (pericia)' },
                                }
                            }
                        })

                        if not action or not action[1] then
                            goto continue
                        end

                        if action[1] == 'inspect' then
                            lib.callback('gcphone:getPhoneInfo', false, function(result)
                                if result and result.success and result.phone then
                                    lib.alertDialog({
                                        header = 'Telefono Encontrado',
                                        content = ('Propietario: %s\nNumero: %s\nIMEI: %s'):format(
                                            result.phone.owner,
                                            result.phone.phoneNumber,
                                            result.phone.imei
                                        ),
                                        centered = true
                                    })
                                end
                            end, { phoneId = phoneId })
                        end

                        if action[1] == 'unlock' then
                            local pinInput = lib.inputDialog('Intentar desbloqueo', {
                                {
                                    type = 'input',
                                    label = 'PIN de 4 digitos',
                                    placeholder = '0000',
                                    required = true,
                                    min = 4,
                                    max = 4,
                                }
                            })

                            if not pinInput or not pinInput[1] then
                                goto continue
                            end

                            lib.callback('gcphone:unlockDroppedPhone', false, function(result)
                                if result and result.success then
                                    lib.alertDialog({
                                        header = 'Pericia completada',
                                        content = ('Propietario: %s\n\n%s'):format(result.phone.owner or 'N/A', result.report or 'Sin datos'),
                                        centered = true,
                                        size = 'lg'
                                    })
                                else
                                    lib.notify({
                                        title = 'PIN incorrecto',
                                        description = 'No se pudo desbloquear el dispositivo',
                                        type = 'error'
                                    })
                                end
                            end, {
                                phoneId = phoneId,
                                pin = tostring(pinInput[1] or '')
                            })
                        end
                    end
                    ::continue::
                    break
                end
            end
        end
        
        if not isNearPhone then
            lib.hideTextUI()
        end
    end
end)

AddEventHandler('onResourceStop', function(resourceName)
    if GetCurrentResourceName() == resourceName then
        for phoneId, _ in pairs(phoneObjects) do
            RemovePhoneObject(phoneId)
        end
    end
end)
