-- ============================================================
-- gcphone SDK — Trabajo de Mecanico
-- App compleja con datos dinamicos, notificaciones, waypoints
-- ============================================================

local mech = exports['gcphone-next']:registerPhoneUI('mech_job', {
    title = 'MechWork',
    icon = '🔧',
    shortcut = {
        visible = false,
        category = 'services',
        description = 'Panel de trabajo para mecanicos',
    },
    permissions = { 'location', 'notifications', 'maps' },
    views = {
        main = {
            elements = {
                { type = 'header', text = 'Panel de mecanico' },
                { type = 'label', text = 'Turno: ${dynamic.shift}', tone = 'muted' },
                { type = 'label', text = 'Trabajos hoy: ${dynamic.jobs_today}' },
                { type = 'divider' },
                { type = 'list', id = 'action', items = {
                    { id = 'pending', label = 'Trabajos pendientes', description = '${dynamic.pending_count} en cola', icon = '📋', navigateTo = 'pending' },
                    { id = 'services', label = 'Ofrecer servicio', icon = '🔧', navigateTo = 'offer' },
                    { id = 'parts', label = 'Inventario', icon = '📦', navigateTo = 'inventory' },
                    { id = 'stats', label = 'Estadisticas', icon = '📊', navigateTo = 'stats' },
                }},
            },
        },
        pending = {
            title = 'Trabajos pendientes',
            elements = {
                { type = 'label', text = 'No hay trabajos pendientes', tone = 'muted' },
            },
        },
        offer = {
            title = 'Ofrecer servicio',
            elements = {
                { type = 'select', id = 'service_type', label = 'Tipo de servicio', required = true, options = {
                    { value = 'repair', label = 'Reparacion general — $500' },
                    { value = 'engine', label = 'Reparacion de motor — $1,500' },
                    { value = 'body', label = 'Reparacion carroceria — $800' },
                    { value = 'paint', label = 'Pintura completa — $2,000' },
                    { value = 'tow', label = 'Servicio de grua — $300' },
                }},
                { type = 'input', id = 'plate', label = 'Patente del vehiculo', placeholder = 'ABC123', maxLength = 8 },
                { type = 'number', id = 'price', label = 'Precio personalizado ($)', min = 0, max = 50000 },
                { type = 'textarea', id = 'diagnosis', label = 'Diagnostico', placeholder = 'Describe el problema...', maxLength = 300 },
            },
            options = {
                { id = 'create_job', label = 'Crear orden de trabajo', tone = 'primary' },
            },
        },
        inventory = {
            title = 'Repuestos',
            elements = {
                { type = 'label', text = 'Cargando...', tone = 'muted' },
            },
        },
        stats = {
            title = 'Estadisticas',
            elements = {
                { type = 'label', text = 'Trabajos completados: ${dynamic.total_jobs}' },
                { type = 'label', text = 'Ganancia total: ${dynamic.total_earnings}' },
                { type = 'label', text = 'Rating: ${dynamic.rating} / 5.0' },
            },
        },
    },
    startView = 'main',
})

-- Visibilidad: solo mecanicos on-duty
-- El dev controla esto como quiera. Ejemplo con evento de job:
--[[
AddEventHandler('QBCore:Server:OnJobUpdate', function(source, job)
    mech.setVisible(source, job.name == 'mechanic' and job.onduty)
end)
]]

-- Datos dinamicos cuando abren desde Directorio
mech.onOpened(function(source)
    -- Reemplazar con tu logica real
    local stats = { todayCount = 3, totalJobs = 47, totalEarnings = 68500, rating = 4.8 }

    return {
        dynamicData = {
            shift = 'En servicio',
            jobs_today = tostring(stats.todayCount),
            pending_count = '2',
            total_jobs = tostring(stats.totalJobs),
            total_earnings = ('$%s'):format(stats.totalEarnings),
            rating = ('%.1f'):format(stats.rating),
        },
        viewOverrides = {
            pending = {
                elements = {
                    { type = 'list', id = 'job', items = {
                        { id = 'job_1', label = 'Sultan RS — Motor', description = '$1,500 — Juan Perez', icon = '🔧' },
                        { id = 'job_2', label = 'Elegy — Pintura', description = '$2,000 — Maria Garcia', icon = '🎨' },
                    }},
                },
            },
            inventory = {
                elements = {
                    { type = 'header', text = 'Tus repuestos' },
                    { type = 'list', id = 'part', items = {
                        { id = 'engine_part', label = 'Pieza de motor', description = 'x5', icon = '⚙️' },
                        { id = 'brake_pad', label = 'Pastilla de freno', description = 'x12', icon = '🔴' },
                        { id = 'turbo_kit', label = 'Kit de turbo', description = 'x2', icon = '💨' },
                    }},
                },
            },
        },
    }
end)

mech.onResult(function(source, result)
    if not result then return end

    if result.optionId == 'create_job' then
        local serviceType = result.formData.service_type
        local plate = result.formData.plate
        local price = tonumber(result.formData.price)
        local diagnosis = result.formData.diagnosis

        -- Crear orden en tu sistema
        -- local jobId = CreateMechJob(source, serviceType, plate, price, diagnosis)

        mech.notify(source, {
            title = 'Orden creada',
            content = ('Trabajo registrado: %s'):format(serviceType),
            icon = '🔧',
        })

        -- Notificar al cliente si esta online
        -- local clientSource = FindPlayerByPlate(plate)
        -- if clientSource then
        --     exports['gcphone-next']:phoneNotify(clientSource, 'mech_job', {
        --         title = 'Tu vehiculo esta siendo atendido',
        --         content = 'Un mecanico esta trabajando en tu auto',
        --         icon = '🔧',
        --     })
        -- end
    end
end)
