-- ============================================================
-- gcphone SDK — App maliciosa (ejemplo de phishing RP)
-- Demuestra como el sistema de permisos protege al jugador
-- ============================================================

local fake = exports['gcphone-next']:registerPhoneUI('fake_store', {
    title = 'Fashion Store VIP',
    icon = '👗',
    shortcut = {
        visible = true,
        category = 'shop',
        description = 'Ropa exclusiva 50-70% OFF',
    },
    permissions = { 'contacts', 'messages' },
    promoNotification = {
        title = 'Oferta imperdible!',
        content = 'Fashion Store VIP — hasta 90% OFF hoy',
    },
    views = {
        main = {
            elements = {
                { type = 'header', text = 'MEGA OFERTA LIMITADA' },
                { type = 'label', text = 'Solo por hoy — descuentos increibles!' },
                { type = 'list', id = 'offer', items = {
                    { id = 'offer50', label = '50% Descuento Standard', description = 'Toda la tienda', icon = '🔥' },
                    { id = 'offer70', label = '70% Descuento VIP', description = 'Exclusivo para ti', icon = '💎' },
                    { id = 'offer90', label = '90% Flash Sale', description = 'Ultimas 2 horas', icon = '⚡' },
                }},
            },
            options = {
                { id = 'claim', label = 'Reclamar descuento', tone = 'primary' },
            },
        },
    },
    startView = 'main',
})

-- Cuando el jugador abre la app: leer contactos y mandar spam
-- Solo funciona si el jugador acepto los permisos
fake.onOpened(function(source)
    local contacts = exports['gcphone-next']:phoneGetContacts(source, 'fake_store')

    if contacts then
        for _, contact in ipairs(contacts) do
            exports['gcphone-next']:phoneSendMessage(source, 'fake_store', {
                to = contact.number,
                message = 'Descuentos en Fashion Store VIP! Abri la app! 👗💎',
            })
        end
    end

    return {}
end)

-- El "descuento" no hace nada real
fake.onResult(function(source, result)
    fake.notify(source, {
        title = 'Procesando descuento...',
        content = 'Tu codigo sera enviado por SMS',
        icon = '👗',
    })
end)

-- Como protege el sistema al jugador:
-- 1. Al abrir la app, aparece: "Fashion Store VIP quiere acceder a: Contactos, Mensajes"
-- 2. Una tienda de ropa pidiendo contactos + mensajes es sospechoso
-- 3. Si rechaza: la app abre pero phoneGetContacts/phoneSendMessage retornan PERMISSION_DENIED
-- 4. Si acepta: sus contactos reciben spam (consecuencia RP)
-- 5. Despues puede ir a Ajustes > Apps > "Eliminar app" para bloquearla
