-- ============================================================
-- gcphone SDK — Dialogos simples
-- Copiar y pegar en cualquier client script
-- ============================================================

-- Transferencia bancaria
RegisterCommand('transfer', function()
    local result = exports['gcphone-next']:phoneInput('Transferir dinero', {
        { type = 'input', id = 'target', label = 'Numero destino', required = true, placeholder = '555-XXXX', maxLength = 20 },
        { type = 'number', id = 'amount', label = 'Monto ($)', required = true, min = 1, max = 100000 },
        { type = 'select', id = 'account', label = 'Desde cuenta', required = true, options = {
            { value = 'cash', label = 'Efectivo' },
            { value = 'bank', label = 'Banco' },
        }},
        { type = 'textarea', id = 'note', label = 'Nota', placeholder = 'Opcional...', maxLength = 140 },
    }, {
        submitLabel = 'Transferir',
        submitTone = 'primary',
    })

    if not result then return end
    TriggerServerEvent('bank:transfer', result.target, result.amount, result.account, result.note)
end)

-- Confirmacion de venta
RegisterCommand('sell', function()
    local confirmed = exports['gcphone-next']:phoneConfirm('Vender vehiculo?', {
        description = 'Tu Elegy Retro Custom se vendera por $45,000. No se puede deshacer.',
        confirmLabel = 'Vender',
        confirmTone = 'danger',
        icon = '🚗',
    })

    if confirmed then
        TriggerServerEvent('garage:sell', GetVehiclePedIsIn(PlayerPedId(), false))
    end
end)

-- Seleccion de vehiculo
RegisterCommand('garage', function()
    local vehicleId = exports['gcphone-next']:phoneSelect('Mis vehiculos', {
        { id = 'plate_ABC123', label = 'Elegy Retro Custom', description = 'Garage Norte — Motor Nv.3', icon = '🚗' },
        { id = 'plate_XYZ789', label = 'Sultan RS', description = 'Garage Sur — Stock', icon = '🏎️' },
        { id = 'plate_DEF456', label = 'Kuruma Blindado', description = 'Garage Norte — Turbo', icon = '🛡️' },
    }, {
        searchable = true,
    })

    if vehicleId then
        TriggerServerEvent('garage:spawn', vehicleId)
    end
end)

-- Denuncia policial
RegisterCommand('report', function()
    local report = exports['gcphone-next']:phoneInput('Denuncia ciudadana', {
        { type = 'select', id = 'type', label = 'Tipo', required = true, options = {
            { value = 'robbery', label = 'Robo' },
            { value = 'assault', label = 'Agresion' },
            { value = 'vehicle', label = 'Vehiculo abandonado' },
            { value = 'noise', label = 'Ruido excesivo' },
            { value = 'other', label = 'Otro' },
        }},
        { type = 'textarea', id = 'description', label = 'Descripcion', required = true, placeholder = 'Que paso?', maxLength = 300 },
        { type = 'input', id = 'location', label = 'Ubicacion', placeholder = 'Cerca de...', maxLength = 100 },
    }, {
        submitLabel = 'Enviar denuncia',
    })

    if report then
        TriggerServerEvent('police:report', report.type, report.description, report.location)
    end
end)
