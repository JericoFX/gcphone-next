-- ============================================================
-- gcphone SDK — Bar / Restaurante
-- Ejemplo completo con controller handle, proximidad, notificaciones
-- ============================================================

local bar = exports['gcphone-next']:registerPhoneUI('el_gordo_bar', {
    title = 'El Gordo Bar',
    icon = '🍺',
    shortcut = {
        visible = false,
        category = 'food',
        description = 'Tragos y comida en el mejor bar',
    },
    permissions = { 'notifications' },
    promoNotification = {
        title = 'Nuevo bar cerca!',
        content = 'El Gordo Bar tiene happy hour 2x1',
    },
    views = {
        main = {
            elements = {
                { type = 'header', text = 'Menu' },
                { type = 'list', id = 'category', items = {
                    { id = 'drinks', label = 'Tragos', description = '8 opciones', icon = '🍹', navigateTo = 'drinks' },
                    { id = 'food', label = 'Comida', description = '5 platos', icon = '🍔', navigateTo = 'food' },
                    { id = 'promos', label = 'Promos del dia', description = '2x1 en cervezas', icon = '🔥', navigateTo = 'promos' },
                }},
            },
        },
        drinks = {
            title = 'Tragos',
            elements = {
                { type = 'select', id = 'drink', label = 'Elige trago', required = true, options = {
                    { value = 'beer', label = 'Cerveza — $30' },
                    { value = 'whisky', label = 'Whisky — $80' },
                    { value = 'cocktail', label = 'Cocktail de la casa — $60' },
                    { value = 'wine', label = 'Vino tinto — $50' },
                }},
                { type = 'number', id = 'qty', label = 'Cantidad', min = 1, max = 5, default = 1, required = true },
                { type = 'checkbox', id = 'double', label = 'Doble (trago largo)' },
            },
            options = {
                { id = 'order_drink', label = 'Pedir', tone = 'primary' },
            },
        },
        food = {
            title = 'Comida',
            elements = {
                { type = 'select', id = 'plate', label = 'Plato', required = true, options = {
                    { value = 'burger', label = 'Hamburguesa completa — $120' },
                    { value = 'nachos', label = 'Nachos con queso — $80' },
                    { value = 'wings', label = 'Alitas BBQ x6 — $100' },
                }},
                { type = 'textarea', id = 'notes', label = 'Notas', placeholder = 'Sin cebolla, extra salsa...', maxLength = 140 },
            },
            options = {
                { id = 'order_food', label = 'Pedir', tone = 'primary' },
            },
        },
        promos = {
            title = 'Promos',
            elements = {
                { type = 'label', text = 'Happy Hour: 18:00 - 21:00', tone = 'muted' },
                { type = 'label', text = 'Todas las cervezas 2x1' },
                { type = 'divider' },
                { type = 'label', text = 'Combo amigos: 4 cervezas + nachos por $150', tone = 'primary' },
            },
            options = {
                { id = 'order_combo', label = 'Pedir combo — $150', tone = 'primary' },
            },
        },
    },
    startView = 'main',
})

-- Proximidad: el dev lo maneja como quiera (ox_target, zonas, etc.)
-- Ejemplo con ox_target:
--[[
exports('ox_target'):addSphereZone({
    coords = vec3(230.0, -910.0, 30.0),
    radius = 3.0,
    options = {
        { name = 'bar_open', label = 'Abrir menu del bar', icon = 'fas fa-beer', onSelect = function()
            exports['gcphone-next']:openPhoneUI('el_gordo_bar')
        end },
    },
})
]]

local PRICES = {
    beer = 30, whisky = 80, cocktail = 60, wine = 50,
    burger = 120, nachos = 80, wings = 100,
}

bar.onResult(function(source, result)
    if not result then return end

    if result.optionId == 'order_drink' then
        local drink = result.formData.drink
        local qty = tonumber(result.formData.qty) or 1
        local double = result.formData.double == true
        local price = (PRICES[drink] or 50) * qty
        if double then price = math.floor(price * 1.5) end

        -- Cobrar al jugador (reemplazar con tu sistema de economia)
        -- if not RemoveMoney(source, price) then
        --     bar.notify(source, { title = 'Sin fondos', content = 'No te alcanza', icon = '💸' })
        --     return
        -- end

        -- Dar items (reemplazar con tu sistema de items)
        -- GiveItem(source, drink, qty)

        bar.notify(source, {
            title = 'Pedido listo!',
            content = 'Tu trago esta en la barra',
            icon = '🍺',
        })

    elseif result.optionId == 'order_food' then
        local plate = result.formData.plate
        local price = PRICES[plate] or 100

        bar.notify(source, {
            title = 'Comida lista!',
            content = 'Retira en la barra',
            icon = '🍔',
        })

    elseif result.optionId == 'order_combo' then
        bar.notify(source, {
            title = 'Combo listo!',
            content = '4 cervezas + nachos en la mesa',
            icon = '🔥',
        })
    end
end)
