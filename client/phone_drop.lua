-- Creado/Modificado por JericoFX

local currentDroppedPhones = {}
local phoneObjects = {}
local phonePoints = {}
local uiPhoneId = nil
local interactionBusy = false

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

local function RemovePhonePoint(phoneId)
    local point = phonePoints[phoneId]
    if not point then return end

    point:remove()
    phonePoints[phoneId] = nil

    if uiPhoneId == phoneId then
        uiPhoneId = nil
        lib.hideTextUI()
    end
end

local function HandlePhoneInteraction(phoneId)
    if interactionBusy then return end

    interactionBusy = true

    local action = lib.inputDialog('Telefono encontrado', {
        {
            type = 'select',
                label = 'Accion',
                required = true,
                options = {
                    { value = 'inspect', label = 'Ver metadata' },
                    { value = 'unlock', label = 'Abrir solo lectura' },
                    { value = 'pickup', label = 'Recoger telefono' },
                }
            }
        })

    if not action or not action[1] then
        interactionBusy = false
        return
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

            interactionBusy = false
        end, { phoneId = phoneId })

        return
    end

    if action[1] == 'pickup' then
        lib.callback('gcphone:pickupPhone', false, function(result)
            if result and result.success then
                RemovePhonePoint(phoneId)
                RemovePhoneObject(phoneId)
                currentDroppedPhones[phoneId] = nil

                lib.notify({
                    title = 'Telefono recogido',
                    description = result.phone and ('De: %s (%s)'):format(result.phone.owner or '?', result.phone.phoneNumber or '?') or 'Telefono recogido del suelo',
                    type = 'success'
                })
            else
                lib.notify({
                    title = 'Error',
                    description = result and result.error or 'No se pudo recoger el telefono',
                    type = 'error'
                })
            end

            interactionBusy = false
        end, { phoneId = phoneId })

        return
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
            interactionBusy = false
            return
        end

        lib.callback('gcphone:unlockDroppedPhone', false, function(result)
            if result and result.success then
                if result.payload then
                    ShowPhonePayload(result.payload)
                else
                    OpenPhoneUsingServerData()
                end
                lib.notify({
                    title = 'Telefono desbloqueado',
                    description = ('Acceso de solo lectura a %s'):format(result.phone and result.phone.owner or 'N/A'),
                    type = 'success'
                })

                -- Show forensic report if available
                if result.report and result.report ~= '' then
                    SetTimeout(800, function()
                        lib.alertDialog({
                            header = 'Informe forense',
                            content = result.report,
                            centered = false,
                        })
                    end)
                end
            else
                lib.notify({
                    title = 'PIN incorrecto',
                    description = 'No se pudo desbloquear el dispositivo',
                    type = 'error'
                })
            end

            interactionBusy = false
        end, {
            phoneId = phoneId,
            pin = tostring(pinInput[1] or '')
        })

        return
    end

    interactionBusy = false
end

local function CreatePhonePoint(phoneId, coords)
    RemovePhonePoint(phoneId)

    local point = lib.points.new({
        coords = vec3(coords.x, coords.y, coords.z),
        distance = 2.0,
        phoneId = phoneId,
    })

    function point:onExit()
        if uiPhoneId == self.phoneId then
            uiPhoneId = nil
            lib.hideTextUI()
        end
    end

    function point:nearby()
        if not self.isClosest then return end

        uiPhoneId = self.phoneId

        if not lib.isTextUIOpen() then
            lib.showTextUI('[E] Examinar telefono', {
                position = 'left-center'
            })
        end

        if self.currentDistance < 2.0 and IsControlJustReleased(0, 38) then
            HandlePhoneInteraction(self.phoneId)
        end
    end

    phonePoints[phoneId] = point
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
    CreatePhonePoint(data.phoneId, data.coords)
end)

RegisterNetEvent('gcphone:phonePickedUp', function(phoneId)
    if not phoneId then return end
    
    RemovePhonePoint(phoneId)
    RemovePhoneObject(phoneId)
    currentDroppedPhones[phoneId] = nil
end)

RegisterNUICallback('getPhoneMetadata', function(_, cb)
    lib.callback('gcphone:getPhoneMetadata', false, function(result)
        cb(result or { success = false })
    end)
end)

CreateThread(function()
    Wait(500)

    lib.callback('gcphone:getDroppedPhones', false, function(result)
        if not result or not result.success or type(result.phones) ~= 'table' then return end

        for i = 1, #result.phones do
            local phoneData = result.phones[i]

            if phoneData and phoneData.phoneId and phoneData.coords then
                if not currentDroppedPhones[phoneData.phoneId] then
                    currentDroppedPhones[phoneData.phoneId] = phoneData
                end

                if not phoneObjects[phoneData.phoneId] then
                    phoneObjects[phoneData.phoneId] = CreatePhoneObject(phoneData.coords)
                end

                if not phonePoints[phoneData.phoneId] then
                    CreatePhonePoint(phoneData.phoneId, phoneData.coords)
                end
            end
        end
    end)
end)

AddEventHandler('onResourceStop', function(resourceName)
    if GetCurrentResourceName() == resourceName then
        for phoneId, _ in pairs(phonePoints) do
            RemovePhonePoint(phoneId)
        end

        for phoneId, _ in pairs(phoneObjects) do
            RemovePhoneObject(phoneId)
        end

        lib.hideTextUI()
    end
end)
