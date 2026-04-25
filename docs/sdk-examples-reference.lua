--[[
  ╔═══════════════════════════════════════════════════════════════════╗
  ║              gcphone-next SDK — Referencia de Ejemplos           ║
  ║                                                                   ║
  ║  Este archivo contiene la coleccion completa del SDK para copiar ║
  ║  y pegar en tus recursos. No es un script ejecutable.            ║
  ╚═══════════════════════════════════════════════════════════════════╝

  Todos los exports se invocan via:
    exports['gcphone-next']:NombreExport(...)

  Modos de API:
    1. Direct Dialogs  — llamadas bloqueantes (phoneInput, phoneConfirm, phoneSelect)
    2. Registered UIs   — apps multi-vista registradas por ID
    3. Exports          — funciones del servidor/cliente
    4. Hooks            — interceptar eventos del telefono

  ┌─────────────────────────────────────────────────────────────────┐
  │                    ARQUITECTURA: DONDE CORRE CADA COSA          │
  ├─────────────────────────────────────────────────────────────────┤
  │                                                                 │
  │  DIRECT DIALOGS (phoneInput, phoneConfirm, phoneSelect):       │
  │    → Se llaman desde CLIENT solamente                           │
  │    → No necesitan registro previo                               │
  │    → Bloquean el hilo Lua del cliente hasta que el jugador      │
  │      responde o cancela                                         │
  │                                                                 │
  │  REGISTERED UIs (registerPhoneUI / openPhoneUI):                │
  │    → Flujo en 3 pasos:                                          │
  │                                                                 │
  │    1. SERVER: registerPhoneUI('id', { ... })                    │
  │       Se ejecuta UNA VEZ al iniciar el recurso (CreateThread).  │
  │       Registra la app en el sistema. No necesita source.        │
  │                                                                 │
  │    2. CLIENT: openPhoneUI('id')                                 │
  │       El jugador abre la app (ej: via ox_target, comando, etc). │
  │       Tambien se puede abrir desde SERVER con source:           │
  │         openPhoneUI('id', source)                               │
  │                                                                 │
  │    3. SERVER: controller.onResult(function(source, result)      │
  │       Se recibe el resultado con el source del jugador           │
  │       que interactuo. Aca procesas la logica (cobrar, dar item) │
  │                                                                 │
  │  Resumen rapido:                                                │
  │    registerPhoneUI  → SERVER (registrar, sin source)            │
  │    openPhoneUI      → CLIENT (sin source) o SERVER (con source) │
  │    onResult         → SERVER (recibe source)                    │
  │    onOpened         → SERVER (recibe source)                    │
  │    notify           → SERVER (necesita source)                  │
  │    setVisible       → SERVER (necesita source)                  │
  │    phoneInput       → CLIENT solamente                          │
  │    phoneConfirm     → CLIENT solamente                          │
  │    phoneSelect      → CLIENT solamente                          │
  │                                                                 │
  └─────────────────────────────────────────────────────────────────┘
]]

-- ═══════════════════════════════════════════════════════════════════
-- SECCION 1: DIRECT DIALOGS (Client-side)
-- ═══════════════════════════════════════════════════════════════════

--[[
  phoneInput(title, elements, options?)
    - Abre un formulario en el telefono
    - Bloquea el hilo Lua hasta que el jugador envia o cancela
    - Retorna: table { [id] = valor } o nil si cancelo
]]

-- Ejemplo 1A: Transferencia bancaria
RegisterCommand('transfer', function()
  local result = exports['gcphone-next']:phoneInput('Transferir dinero', {
    { type = 'input', id = 'target', label = 'Numero destino', required = true, maxLength = 20 },
    { type = 'number', id = 'amount', label = 'Monto ($)', required = true, min = 1, max = 1000000 },
    { type = 'textarea', id = 'note', label = 'Nota', placeholder = 'Opcional', maxLength = 140 },
  }, {
    submitLabel = 'Transferir',
    submitTone = 'primary',  -- 'default' | 'primary' | 'danger'
  })

  if not result then return end
  TriggerServerEvent('bank:transfer', result.target, result.amount, result.note)
end)

-- Ejemplo 1B: Denuncia policial
RegisterCommand('denuncia', function()
  local report = exports['gcphone-next']:phoneInput('Denuncia ciudadana', {
    { type = 'select', id = 'type', label = 'Tipo de denuncia', required = true, options = {
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
    submitTone = 'primary',
  })

  if report then
    TriggerServerEvent('police:report', report.type, report.description, report.location)
  end
end)


--[[
  phoneConfirm(title, options?)
    - Abre un dialogo de confirmacion si/no
    - Retorna: true si confirmo, false si cancelo
]]

-- Ejemplo 1C: Confirmacion de venta
RegisterCommand('sell', function()
  local confirmed = exports['gcphone-next']:phoneConfirm('Vender vehiculo?', {
    description = 'Tu Elegy Retro Custom se vendera por $45,000. Esta accion no se puede deshacer.',
    confirmLabel = 'Vender',
    confirmTone = 'danger',
    icon = '🚗',
  })

  if confirmed then
    TriggerServerEvent('garage:sell', currentVehicle)
  end
end)

-- Ejemplo 1D: Check-in hospital
RegisterCommand('hospital', function()
  local confirmed = exports['gcphone-next']:phoneConfirm('Check-in Hospital', {
    description = 'Te van a atender en emergencias. Costo: $2,500.',
    confirmLabel = 'Aceptar tratamiento',
    confirmTone = 'primary',
    icon = '🏥',
  })

  if confirmed then
    TriggerServerEvent('hospital:checkin')
  end
end)


--[[
  phoneSelect(title, items, options?)
    - Abre una lista de seleccion
    - Retorna: string (id del item seleccionado) o nil si cancelo
]]

-- Ejemplo 1E: Seleccion de vehiculo
RegisterCommand('garage', function()
  local vehicleId = exports['gcphone-next']:phoneSelect('Mis vehiculos', {
    { id = 'plate_ABC123', label = 'Elegy Retro Custom', description = 'Garage Norte - Motor Nv.3', icon = '🚗' },
    { id = 'plate_XYZ789', label = 'Sultan RS', description = 'Garage Sur - Stock', icon = '🏎️' },
    { id = 'plate_DEF456', label = 'Kuruma Blindado', description = 'Garage Norte - Turbo', icon = '🛡️' },
  }, {
    searchable = true,
    cancelLabel = 'Cerrar',
  })

  if vehicleId then
    TriggerServerEvent('garage:spawn', vehicleId)
  end
end)

-- Ejemplo 1F: Propiedades en venta
RegisterCommand('propiedades', function()
  local propertyId = exports['gcphone-next']:phoneSelect('Propiedades en venta', {
    { id = 'apt_alta_1', label = 'Apartamento Alta St #1', description = '$150,000 - 2 ambientes', icon = '🏢' },
    { id = 'house_grove', label = 'Casa Grove Street', description = '$280,000 - 3 ambientes + garage', icon = '🏠' },
    { id = 'mansion_vinewood', label = 'Mansion Vinewood Hills', description = '$1,200,000 - 6 ambientes + pileta', icon = '🏰' },
  }, {
    searchable = true,
    cancelLabel = 'Cerrar listado',
  })

  if propertyId then
    TriggerServerEvent('realestate:details', propertyId)
  end
end)


-- ═══════════════════════════════════════════════════════════════════
-- SECCION 2: ELEMENT TYPES (Referencia rapida)
-- ═══════════════════════════════════════════════════════════════════

--[[
  FORM ELEMENTS:

  input    — Texto de una linea
  { type = 'input', id = 'name', label = 'Nombre', placeholder = 'Tu nombre', maxLength = 80, default = '', required = true }

  number   — Entrada numerica con min/max
  { type = 'number', id = 'amount', label = 'Cantidad', min = 1, max = 100, required = true }

  textarea — Texto multilinea
  { type = 'textarea', id = 'desc', label = 'Descripcion', rows = 4, maxLength = 500 }

  select   — Dropdown
  { type = 'select', id = 'color', label = 'Color', required = true, options = {
    { value = 'red', label = 'Rojo' },
    { value = 'blue', label = 'Azul' },
  }}

  checkbox — Toggle switch
  { type = 'checkbox', id = 'agree', label = 'Acepto los terminos', default = false }


  DISPLAY ELEMENTS:

  header   — Titulo de seccion
  { type = 'header', text = 'Seccion importante' }

  label    — Texto informativo (tones: 'default', 'muted', 'danger')
  { type = 'label', text = 'Precio: $5,000', tone = 'muted' }

  divider  — Linea separadora
  { type = 'divider' }

  image    — Imagen (solo HTTPS)
  { type = 'image', url = 'https://example.com/banner.jpg', height = 200 }


  INTERACTIVE ELEMENTS:

  list     — Lista tappeable con navegacion
  { type = 'list', id = 'menu', items = {
    { id = 'item1', label = 'Opcion 1', description = 'Detalle', icon = '🔧', navigateTo = 'otra_vista' },
    { id = 'item2', label = 'Opcion 2', icon = '🎨', tone = 'primary' },
    { id = 'item3', label = 'Peligro', icon = '💥', tone = 'danger', disabled = true },
  }}


  ACTION BUTTONS (max 4 por vista):
  options = {
    { id = 'confirm', label = 'Confirmar', tone = 'primary' },
    { id = 'back', label = 'Volver', tone = 'default', navigateTo = 'main' },
    { id = 'delete', label = 'Eliminar', tone = 'danger' },
  }
]]


-- ═══════════════════════════════════════════════════════════════════
-- SECCION 3: REGISTERED UIs (Server-side)
-- ═══════════════════════════════════════════════════════════════════

--[[
  registerPhoneUI(id, definition)   — SERVER
    - Registra una app multi-vista
    - Llamar una vez al iniciar el recurso
    - Retorna: controller object o nil + error

  openPhoneUI(id)                   — CLIENT (sin source)
  openPhoneUI(id, source)           — SERVER (con source)
    - Abre la UI registrada
    - Bloquea hasta que el jugador interactua
    - Retorna: { view, optionId, formData, selectedId } o nil

  Limites:
    - Max 10 vistas por UI
    - Max 20 elementos por vista
    - Max 4 botones por vista
    - Max 20 UIs registradas por recurso
]]


-- Ejemplo 3A: Mecanico Central (multi-vista completo)
-- server/main.lua
CreateThread(function()
  exports['gcphone-next']:registerPhoneUI('mech_central', {
    title = 'Mecanico Central',
    icon = '🔧',
    shortcut = {
      visible = false,           -- no aparece por defecto en Servicios
      category = 'services',     -- food | services | garage | shop | entertainment | other
      description = 'Reparaciones y mejoras',
    },
    views = {
      main = {
        elements = {
          { type = 'header', text = 'Servicios disponibles' },
          { type = 'list', id = 'service', items = {
            { id = 'repair', label = 'Reparar vehiculo', description = 'Reparacion completa - $500', icon = '🔧', navigateTo = 'confirm_repair' },
            { id = 'upgrade', label = 'Mejoras de motor', description = 'Potencia y velocidad', icon = '⬆️', navigateTo = 'upgrades' },
            { id = 'paint', label = 'Pintura', description = 'Cambiar color', icon = '🎨', navigateTo = 'paint' },
            { id = 'wash', label = 'Lavado', description = 'Limpieza express - $50', icon = '🧽', navigateTo = 'confirm_wash' },
          }},
        },
      },

      confirm_repair = {
        title = 'Confirmar reparacion',
        elements = {
          { type = 'label', text = 'Se reparara tu vehiculo al 100%.', tone = 'muted' },
          { type = 'label', text = 'Costo: $500' },
        },
        options = {
          { id = 'confirm_repair', label = 'Reparar - $500', tone = 'primary' },
        },
      },

      confirm_wash = {
        title = 'Confirmar lavado',
        elements = {
          { type = 'label', text = 'Lavado express para tu vehiculo.' },
          { type = 'label', text = 'Costo: $50' },
        },
        options = {
          { id = 'confirm_wash', label = 'Lavar - $50', tone = 'primary' },
        },
      },

      upgrades = {
        title = 'Mejoras de motor',
        elements = {
          { type = 'select', id = 'part', label = 'Pieza', required = true, options = {
            { value = 'engine', label = 'Motor - $2,000' },
            { value = 'turbo', label = 'Turbo - $5,000' },
            { value = 'brakes', label = 'Frenos - $1,500' },
            { value = 'suspension', label = 'Suspension - $1,200' },
          }},
          { type = 'select', id = 'level', label = 'Nivel', required = true, options = {
            { value = '1', label = 'Nivel 1 (basico)' },
            { value = '2', label = 'Nivel 2 (mejorado)' },
            { value = '3', label = 'Nivel 3 (competicion)' },
          }},
        },
        options = {
          { id = 'buy_upgrade', label = 'Instalar mejora', tone = 'primary' },
        },
      },

      paint = {
        title = 'Pintura',
        elements = {
          { type = 'select', id = 'color', label = 'Color', required = true, options = {
            { value = 'red', label = 'Rojo' },
            { value = 'blue', label = 'Azul' },
            { value = 'black', label = 'Negro' },
            { value = 'white', label = 'Blanco' },
            { value = 'yellow', label = 'Amarillo' },
            { value = 'green', label = 'Verde' },
          }},
          { type = 'checkbox', id = 'metallic', label = 'Acabado metalico (+$200)' },
        },
        options = {
          { id = 'apply_paint', label = 'Pintar - $1,000', tone = 'primary' },
        },
      },
    },
    startView = 'main',
  })
end)

-- Abrir desde client via ox_target o cualquier sistema de proximidad
exports('ox_target'):addBoxZone({
  coords = vec3(732.0, -1088.0, 22.0),
  size = vec3(10, 10, 4),
  options = {
    { name = 'mech_open', label = 'Abrir Mecanico', onSelect = function()
      exports['gcphone-next']:openPhoneUI('mech_central')
    end },
  },
})

-- Manejar resultados (server-side)
exports['gcphone-next']:onPhoneUIResult('mech_central', function(source, result)
  if result.optionId == 'confirm_repair' then
    if RemoveMoney(source, 500) then
      RepairVehicle(source)
    end

  elseif result.optionId == 'confirm_wash' then
    if RemoveMoney(source, 50) then
      WashVehicle(source)
    end

  elseif result.optionId == 'buy_upgrade' then
    local part = result.formData.part
    local level = result.formData.level
    local cost = GetUpgradeCost(part, level)
    if RemoveMoney(source, cost) then
      ApplyUpgrade(source, part, tonumber(level))
    end

  elseif result.optionId == 'apply_paint' then
    local color = result.formData.color
    local metallic = result.formData.metallic
    local cost = metallic and 1200 or 1000
    if RemoveMoney(source, cost) then
      PaintVehicle(source, color, metallic)
    end
  end
end)


-- Ejemplo 3B: Food Delivery (siempre visible + permisos + notificaciones)
-- server/main.lua
CreateThread(function()
  exports['gcphone-next']:registerPhoneUI('cluckin_delivery', {
    title = 'Cluckin Bell Delivery',
    icon = '🍗',
    shortcut = {
      visible = true,            -- siempre visible en Servicios
      category = 'food',
      description = 'Pedi comida a domicilio',
    },
    permissions = { 'location', 'notifications' },  -- permisos requeridos
    views = {
      menu = {
        elements = {
          { type = 'image', url = 'https://example.com/cluckin-banner.jpg', height = 150 },
          { type = 'header', text = 'Menu del dia' },
          { type = 'select', id = 'food', label = 'Plato', required = true, options = {
            { value = 'burger', label = 'Cluckin Burger - $8' },
            { value = 'wings', label = 'Wings x6 - $6' },
            { value = 'combo', label = 'Combo Familiar - $15' },
            { value = 'wrap', label = 'Chicken Wrap - $5' },
          }},
          { type = 'number', id = 'quantity', label = 'Cantidad', required = true, min = 1, max = 10, default = 1 },
          { type = 'select', id = 'drink', label = 'Bebida', options = {
            { value = 'none', label = 'Sin bebida' },
            { value = 'cola', label = 'eCola - $2' },
            { value = 'sprunk', label = 'Sprunk - $2' },
            { value = 'water', label = 'Agua - $1' },
          }},
          { type = 'textarea', id = 'instructions', label = 'Instrucciones especiales', placeholder = 'Sin cebolla, extra salsa...', maxLength = 140 },
        },
        options = {
          { id = 'order', label = 'Hacer pedido', tone = 'primary' },
        },
      },
    },
    startView = 'menu',
  })
end)

-- Manejar resultado de pedido
exports['gcphone-next']:onPhoneUIResult('cluckin_delivery', function(source, result)
  if result.optionId ~= 'order' then return end

  local food = result.formData.food
  local qty = tonumber(result.formData.quantity) or 1
  local drink = result.formData.drink
  local total = CalculateTotal(food, qty, drink)

  if not RemoveMoney(source, total) then
    exports['gcphone-next']:phoneNotify(source, 'cluckin_delivery', {
      title = 'Pago rechazado',
      content = ('No tenes suficiente dinero. Total: $%d'):format(total),
      icon = '🍗',
    })
    return
  end

  exports['gcphone-next']:phoneNotify(source, 'cluckin_delivery', {
    title = 'Pedido confirmado!',
    content = ('Tu pedido de $%d llega en 5 minutos'):format(total),
    icon = '🍗',
  })

  SetTimeout(300000, function()
    GiveFood(source, food, qty, drink)
    exports['gcphone-next']:phoneNotify(source, 'cluckin_delivery', {
      title = 'Pedido entregado!',
      content = 'Tu comida esta lista. Buen provecho!',
      icon = '🍗',
    })
  end)
end)


-- Ejemplo 3C: Bar con proximidad + promo notification
-- server/main.lua
local bar = exports['gcphone-next']:registerPhoneUI('el_gordo_bar', {
  title = 'El Gordo Bar',
  icon = '🍺',
  shortcut = {
    visible = false,
    category = 'food',
    description = 'Tragos y comida en el mejor bar',
  },
  permissions = { 'notifications' },
  promoNotification = {                    -- notificacion unica al abrir el telefono
    title = 'Nuevo bar cerca!',
    content = 'El Gordo Bar tiene happy hour 2x1',
  },
  views = {
    main = {
      elements = {
        { type = 'image', url = 'https://cdn.example.com/bar-banner.jpg', height = 150 },
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
          { value = 'beer', label = 'Cerveza - $30' },
          { value = 'whisky', label = 'Whisky - $80' },
          { value = 'cocktail', label = 'Cocktail de la casa - $60' },
          { value = 'wine', label = 'Vino tinto - $50' },
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
          { value = 'burger', label = 'Hamburguesa completa - $120' },
          { value = 'nachos', label = 'Nachos con queso - $80' },
          { value = 'wings', label = 'Alitas BBQ x6 - $100' },
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
        { id = 'order_combo', label = 'Pedir combo amigos - $150', tone = 'primary' },
      },
    },
  },
  startView = 'main',
})

-- Proximidad via ox_target (client-side)
exports('ox_target'):addSphereZone({
  coords = vec3(230.0, -910.0, 30.0),
  radius = 3.0,
  options = {
    { name = 'bar_open', label = 'Abrir menu del bar', icon = 'fas fa-beer', onSelect = function()
      exports['gcphone-next']:openPhoneUI('el_gordo_bar')
    end },
  },
})

-- Precios y manejo de resultados
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

    if not RemoveMoney(source, price) then
      bar.notify(source, { title = 'Sin fondos', content = 'No te alcanza', icon = '💸' })
      return
    end
    GiveItem(source, drink, qty)
    bar.notify(source, { title = 'Pedido listo!', content = 'Tu trago esta en la barra', icon = '🍺' })

  elseif result.optionId == 'order_food' then
    local plate = result.formData.plate
    local price = PRICES[plate] or 100
    if not RemoveMoney(source, price) then
      bar.notify(source, { title = 'Sin fondos', content = 'No te alcanza', icon = '💸' })
      return
    end
    GiveItem(source, plate, 1)
    bar.notify(source, { title = 'Comida lista!', content = 'Retira en la barra', icon = '🍔' })

  elseif result.optionId == 'order_combo' then
    if not RemoveMoney(source, 150) then
      bar.notify(source, { title = 'Sin fondos', content = 'Junta plata con tus amigos', icon = '💸' })
      return
    end
    GiveItem(source, 'beer', 4)
    GiveItem(source, 'nachos', 1)
    bar.notify(source, { title = 'Combo listo!', content = '4 cervezas + nachos en la mesa', icon = '🔥' })
  end
end)


-- Ejemplo 3D: Car Dealership (datos dinamicos + onOpened)
-- server/main.lua
local dealer = exports['gcphone-next']:registerPhoneUI('pdm_dealer', {
  title = 'Premium Deluxe Motorsport',
  icon = '🚗',
  shortcut = {
    visible = false,
    category = 'garage',
    description = 'Compra y venta de vehiculos',
  },
  views = {
    main = {
      elements = {
        { type = 'header', text = 'Bienvenido a PDM' },
        { type = 'label', text = 'Saldo disponible: ${dynamic.balance}', tone = 'muted' },
        { type = 'list', id = 'action', items = {
          { id = 'buy', label = 'Comprar vehiculo', description = '${dynamic.stock_count} en stock', icon = '🛒', navigateTo = 'catalog' },
          { id = 'sell', label = 'Vender mi vehiculo', description = 'Cotizacion instantanea', icon = '💰', navigateTo = 'sell' },
          { id = 'finance', label = 'Financiamiento', description = 'Paga en cuotas', icon = '🏦', navigateTo = 'finance' },
        }},
      },
    },
    catalog = {
      title = 'Catalogo',
      elements = {
        { type = 'label', text = 'Cargando catalogo...', tone = 'muted' },
      },
    },
    sell = {
      title = 'Vender vehiculo',
      elements = {
        { type = 'input', id = 'plate', label = 'Patente del vehiculo', required = true, maxLength = 8 },
      },
      options = {
        { id = 'get_quote', label = 'Obtener cotizacion', tone = 'primary' },
      },
    },
    finance = {
      title = 'Financiamiento',
      elements = {
        { type = 'label', text = 'Paga tu vehiculo en cuotas mensuales.' },
        { type = 'label', text = 'Tasa: 5% mensual - Sin entrega inicial', tone = 'muted' },
        { type = 'select', id = 'months', label = 'Plazo', required = true, options = {
          { value = '6', label = '6 meses' },
          { value = '12', label = '12 meses' },
          { value = '24', label = '24 meses' },
        }},
      },
      options = {
        { id = 'apply_finance', label = 'Solicitar financiamiento', tone = 'primary' },
      },
    },
  },
  startView = 'main',
})

-- Datos dinamicos: se ejecuta cada vez que alguien abre la app desde Servicios
dealer.onOpened(function(source)
  local stock = GetDealerStock()
  local stockItems = {}
  for _, v in ipairs(stock) do
    stockItems[#stockItems + 1] = {
      id = v.model,
      label = v.name,
      description = ('$%s - %s'):format(v.price, v.class),
      icon = '🚗',
    }
  end

  return {
    dynamicData = {                        -- reemplaza ${dynamic.X} en los textos
      balance = ('$%s'):format(GetPlayerMoney(source)),
      stock_count = tostring(#stock),
    },
    viewOverrides = {                      -- sobreescribe elementos de vistas
      catalog = {
        elements = {{ type = 'list', id = 'vehicle', items = stockItems }},
      },
    },
  }
end)

dealer.onResult(function(source, result)
  if result.selectedId and result.view == 'catalog' then
    BuyVehicle(source, result.selectedId)
  elseif result.optionId == 'get_quote' then
    local quote = GetVehicleQuote(result.formData.plate)
    dealer.notify(source, {
      title = 'Cotizacion',
      content = quote and ('Tu vehiculo vale $%d'):format(quote) or 'Vehiculo no encontrado',
      icon = '💰',
    })
  end
end)


-- Ejemplo 3E: Mecanico con datos dinamicos (on-duty check)
-- server/main.lua
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
          { id = 'pending', label = 'Trabajos pendientes', description = '${dynamic.pending_count} en cola', icon = '📋', navigateTo = 'pending_jobs' },
          { id = 'services', label = 'Ofrecer servicio', icon = '🔧', navigateTo = 'offer_service' },
          { id = 'parts', label = 'Inventario de repuestos', icon = '📦', navigateTo = 'inventory' },
          { id = 'stats', label = 'Mis estadisticas', icon = '📊', navigateTo = 'stats' },
        }},
      },
    },
    pending_jobs = {
      title = 'Trabajos pendientes',
      elements = {
        { type = 'label', text = 'No hay trabajos pendientes', tone = 'muted' },
      },
    },
    offer_service = {
      title = 'Ofrecer servicio',
      elements = {
        { type = 'select', id = 'service_type', label = 'Tipo de servicio', required = true, options = {
          { value = 'repair', label = 'Reparacion general - $500' },
          { value = 'engine', label = 'Reparacion de motor - $1,500' },
          { value = 'body', label = 'Reparacion carroceria - $800' },
          { value = 'paint', label = 'Pintura completa - $2,000' },
          { value = 'tow', label = 'Servicio de grua - $300' },
        }},
        { type = 'input', id = 'client_plate', label = 'Patente del vehiculo', placeholder = 'ABC123', maxLength = 8 },
        { type = 'number', id = 'custom_price', label = 'Precio personalizado ($)', min = 0, max = 50000 },
        { type = 'textarea', id = 'diagnosis', label = 'Diagnostico', placeholder = 'Describe el problema...', maxLength = 300 },
      },
      options = {
        { id = 'create_job', label = 'Crear orden de trabajo', tone = 'primary' },
      },
    },
    inventory = {
      title = 'Repuestos',
      elements = {
        { type = 'label', text = 'Cargando inventario...', tone = 'muted' },
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

-- Visibilidad por job
AddEventHandler('QBCore:Server:OnJobUpdate', function(source, job)
  mech.setVisible(source, job.name == 'mechanic' and job.onduty)
end)

-- Datos dinamicos
mech.onOpened(function(source)
  local player = exports['qbx_core']:GetPlayer(source)
  local identifier = player.PlayerData.citizenid
  local stats = GetMechanicStats(identifier)
  local pending = GetPendingJobs(identifier)

  local pendingItems = {}
  for _, job in ipairs(pending) do
    pendingItems[#pendingItems + 1] = {
      id = 'job_' .. job.id,
      label = ('%s - %s'):format(job.vehicle, job.service),
      description = ('$%d - %s'):format(job.price, job.client_name),
      icon = '🔧',
    }
  end

  local invItems = {}
  for _, part in ipairs(GetMechanicInventory(identifier)) do
    invItems[#invItems + 1] = {
      id = 'part_' .. part.name,
      label = part.label,
      description = ('x%d'):format(part.count),
      icon = '📦',
    }
  end

  return {
    dynamicData = {
      shift = player.PlayerData.job.onduty and 'En servicio' or 'Fuera de servicio',
      jobs_today = tostring(stats.todayCount or 0),
      pending_count = tostring(#pending),
      total_jobs = tostring(stats.totalJobs or 0),
      total_earnings = ('$%s'):format(stats.totalEarnings or 0),
      rating = ('%.1f'):format(stats.rating or 0),
    },
    viewOverrides = {
      pending_jobs = {
        elements = #pendingItems > 0
          and {{ type = 'header', text = 'En cola' }, { type = 'list', id = 'job', items = pendingItems }}
          or {{ type = 'label', text = 'No hay trabajos pendientes', tone = 'muted' }},
      },
      inventory = {
        elements = #invItems > 0
          and {{ type = 'header', text = 'Tus repuestos' }, { type = 'list', id = 'part', items = invItems }}
          or {{ type = 'label', text = 'Sin repuestos', tone = 'muted' }},
      },
    },
  }
end)

mech.onResult(function(source, result)
  if not result then return end
  if result.optionId == 'create_job' then
    local jobId = CreateMechJob(source, {
      service = result.formData.service_type,
      plate = result.formData.client_plate,
      price = tonumber(result.formData.custom_price) or GetDefaultPrice(result.formData.service_type),
      notes = result.formData.diagnosis,
    })
    if jobId then
      mech.notify(source, { title = 'Orden creada', content = ('Trabajo #%d registrado'):format(jobId), icon = '🔧' })
    end
  end
end)


-- Ejemplo 3F: Gang Stash con permisos
local stash = exports['gcphone-next']:registerPhoneUI('gang_stash', {
  title = 'Stash',
  icon = '📦',
  shortcut = {
    visible = false,
    category = 'other',
    description = 'Acceso al escondite',
  },
  permissions = { 'location' },
  views = {
    main = {
      elements = {
        { type = 'header', text = 'Escondite' },
        { type = 'label', text = 'Ubicacion: ${dynamic.location}', tone = 'muted' },
        { type = 'divider' },
        { type = 'list', id = 'action', items = {
          { id = 'deposit', label = 'Depositar', icon = '📥', navigateTo = 'deposit' },
          { id = 'withdraw', label = 'Retirar', icon = '📤', navigateTo = 'withdraw' },
          { id = 'log', label = 'Historial', icon = '📋', navigateTo = 'log' },
        }},
      },
    },
    deposit = {
      title = 'Depositar',
      elements = {
        { type = 'select', id = 'item', label = 'Item', required = true, options = {} },
        { type = 'number', id = 'amount', label = 'Cantidad', required = true, min = 1, max = 100 },
      },
      options = {
        { id = 'do_deposit', label = 'Depositar', tone = 'primary' },
      },
    },
    withdraw = {
      title = 'Retirar',
      elements = {
        { type = 'select', id = 'item', label = 'Item del stash', required = true, options = {} },
        { type = 'number', id = 'amount', label = 'Cantidad', required = true, min = 1, max = 100 },
      },
      options = {
        { id = 'do_withdraw', label = 'Retirar', tone = 'danger' },
      },
    },
    log = {
      title = 'Historial',
      elements = {},
    },
  },
  startView = 'main',
})


-- ═══════════════════════════════════════════════════════════════════
-- SECCION 4: CONTROLLER METHODS (Server-side)
-- ═══════════════════════════════════════════════════════════════════

--[[
  El registerPhoneUI retorna un controller con estos metodos:

  controller.open(source)                    -- Abre UI para jugador (bloqueante)
  controller.close(source)                   -- Fuerza cierre
  controller.notify(source, payload)         -- Envia notificacion (requiere permiso 'notifications')
  controller.setVisible(source, bool)        -- Mostrar/ocultar en Servicios per-player
  controller.setVisibleAll(bool)             -- Mostrar/ocultar globalmente
  controller.onOpened(fn(source))            -- Callback al abrir desde Servicios
  controller.onResult(fn(source, result))    -- Callback al recibir resultado
  controller.unregister()                    -- Desregistrar app
]]

-- Ejemplo de uso del controller:
local app = exports['gcphone-next']:registerPhoneUI('food_delivery', { --[[ ... ]] })

-- Abrir para un jugador
local result = app.open(source)

-- Cerrar forzosamente
app.close(source)

-- Notificacion
app.notify(source, {
  title = 'Pedido en camino',
  content = 'Llega en 5 minutos',
  icon = '🚗',
})

-- Visibilidad per-player
app.setVisible(source, true)
app.setVisible(source, false)

-- Visibilidad global
app.setVisibleAll(true)

-- Desregistrar
app.unregister()


-- ═══════════════════════════════════════════════════════════════════
-- SECCION 5: VISIBILITY CONTROL (Server-side)
-- ═══════════════════════════════════════════════════════════════════

-- Mostrar/ocultar por jugador (ej: zona de proximidad)
exports['gcphone-next']:setPhoneUIVisible('mech_shop', source, true)   -- entra zona
exports['gcphone-next']:setPhoneUIVisible('mech_shop', source, false)  -- sale zona

-- Mostrar/ocultar globalmente
exports['gcphone-next']:setPhoneUIVisibleAll('event_shop', true)


-- ═══════════════════════════════════════════════════════════════════
-- SECCION 6: HOOKS (Server-side)
-- ═══════════════════════════════════════════════════════════════════

--[[
  Hooks disponibles:
    numberDialed         — Antes de rutear una llamada
    callStarted          — Llamada iniciada
    emergencyCallStarted — Llamada SOS
    contactAdded         — Contacto agregado
    contactUpdated       — Contacto actualizado
    contactDeleted       — Contacto eliminado
    messageSent          — SMS enviado
    mailAccountCreated   — Cuenta de mail creada
    phoneSetupCompleted  — Setup inicial completado
    deviceUnlocked       — PIN correcto
    imeiViewed           — IMEI visto en settings

  Retornar false desde el callback CANCELA la accion.
]]

-- Ejemplo 6A: Bloquear llamadas a un numero
local hookId = exports['gcphone-next']:registerHook('numberDialed', function(payload)
  if payload.targetNumber == '555-0000' then
    return false  -- cancela la llamada
  end
end)

-- Remover hook especifico
exports['gcphone-next']:removeHooks(hookId)

-- Remover todos los hooks del recurso
exports['gcphone-next']:removeHooks()

-- Ejemplo 6B: Log de mensajes enviados
exports['gcphone-next']:registerHook('messageSent', function(payload)
  print(('[AUDIT] %s envio mensaje a %s'):format(
    payload.identifier or 'unknown',
    payload.message and payload.message.phoneNumber or 'unknown'
  ))
end, { print = true })  -- { print = true } activa debug logging

-- Ejemplo 6C: Validar nombre de contacto
exports['gcphone-next']:registerHook('contactAdded', function(payload)
  local contact = payload.contact
  if contact and contact.display and #contact.display > 50 then
    return false  -- rechaza contactos con nombres > 50 chars
  end
end)

-- Ejemplo 6D: Log de llamadas de emergencia
exports['gcphone-next']:registerHook('emergencyCallStarted', function(payload)
  print(('[SOS] Player %d llamo SOS desde coords %s'):format(
    payload.source,
    tostring(payload.coords)
  ))
end)

-- Ejemplo 6E: Trigger hook manualmente (uso avanzado)
local allowed = exports['gcphone-next']:triggerHook('messageSent', {
  source = source,
  identifier = identifier,
  message = messageData,
})
if not allowed then
  print('Mensaje cancelado por un hook')
end


-- ═══════════════════════════════════════════════════════════════════
-- SECCION 7: SERVER EXPORTS (Referencia rapida)
-- ═══════════════════════════════════════════════════════════════════

-- Bridge
local identifier = exports['gcphone-next']:GetIdentifier(source)
local name       = exports['gcphone-next']:GetName(source)
local money      = exports['gcphone-next']:GetMoney(source, 'bank')
local ok         = exports['gcphone-next']:AddMoney(source, 5000, 'cash', 'pago')
local ok         = exports['gcphone-next']:RemoveMoney(source, 500, 'cash', 'compra')
local job        = exports['gcphone-next']:GetJob(source)
local framework  = exports['gcphone-next']:GetFramework()
local src        = exports['gcphone-next']:GetSourceFromIdentifier(identifier)
local canAct     = exports['gcphone-next']:IsPlayerActionAllowed(source)

-- Phone Management
local phoneNum   = exports['gcphone-next']:GetPhoneNumber(identifier)
local ident      = exports['gcphone-next']:GetIdentifierByPhone('555-1234')
local phoneInfo  = exports['gcphone-next']:GetPhoneByIdentifier(identifier)
local ownerIMEI  = exports['gcphone-next']:GetPhoneOwnerByIMEI(imei)
local ownerNum   = exports['gcphone-next']:GetPhoneOwnerByNumber('555-1234')
local stolen     = exports['gcphone-next']:MarkPhoneAsStolenByIMEI(imei, 'robado', 'policia')
local stolen     = exports['gcphone-next']:MarkPhoneAsStolenByNumber('555-1234', 'robado')
local cleared    = exports['gcphone-next']:ClearPhoneStolenByIMEI(imei)
local cleared    = exports['gcphone-next']:ClearPhoneStolenByNumber('555-1234')
local hasPhone   = exports['gcphone-next']:PlayerHasPhoneItem(source)

-- Notifications
exports['gcphone-next']:SendPhoneNotification(source, {
  title = 'Alerta',
  content = 'Mensaje de prueba',
  app = 'messages',
  icon = './img/icon.svg',
  priority = 'high',       -- bypassa DND
})

exports['gcphone-next']:SendPhoneNotification(-1, {   -- broadcast a todos
  title = 'Anuncio',
  content = 'Evento especial!',
})

local notifId = exports['gcphone-next']:AddPersistentNotification(identifier, {
  title = 'Notificacion persistente',
  content = 'Se guarda en DB',
})

-- Security
local limited = exports['gcphone-next']:HitRateLimit(source, 'my_action', 10000, 3)
local blocked = exports['gcphone-next']:IsBlockedByIdentifier(identifier)
local either  = exports['gcphone-next']:IsBlockedEither(identA, identB)
exports['gcphone-next']:RecordReport(reporter, target, phone, appId, evidence)

-- Messages
local threads  = exports['gcphone-next']:GetMessages(identifier)
local convo    = exports['gcphone-next']:GetConversation(identifier, '555-1234')

-- Mail
local mailResult = exports['gcphone-next']:SendInGameMail(identifier, {
  -- payload del mail
})

-- Calls
local calls   = exports['gcphone-next']:GetActiveCalls()
local history = exports['gcphone-next']:GetCallHistory(identifier)

-- Contacts
local contacts = exports['gcphone-next']:GetContacts(identifier)

-- Gallery
local gallery = exports['gcphone-next']:GetGallery(identifier)

-- Wallet
local canPay, err, dist = exports['gcphone-next']:CanUseProximityPayment(source, targetSource, 5.0)
local txResult = exports['gcphone-next']:ProximityTransfer(source, targetSource, 1000, 'Pago', 'nfc')

-- Garage
exports['gcphone-next']:RegisterGarageSpawnPoint('spawn_1', { label = 'Garage Norte', x = 100, y = 200, z = 30, h = 90 })
exports['gcphone-next']:RegisterImpoundLocation('impound_1', { label = 'Impound Central', x = 400, y = -900, z = 29 })
exports['gcphone-next']:SyncVehicle(identifier, 'ABC123', 'elegy2', 'Elegy Retro', 'Garage Norte')


-- ═══════════════════════════════════════════════════════════════════
-- SECCION 8: CLIENT EXPORTS (Referencia rapida)
-- ═══════════════════════════════════════════════════════════════════

-- Phone State
local state     = exports['gcphone-next']:GetPhoneState()
local isOpen    = exports['gcphone-next']:IsPhoneOpen()
exports['gcphone-next']:TogglePhone()
exports['gcphone-next']:ClosePhone()
exports['gcphone-next']:NotifyPhone({ title = 'Test', content = 'Local notification' })

-- Visual Mode
exports['gcphone-next']:SetPhoneVisualMode('text')
exports['gcphone-next']:SetPhoneVisualMode('call')
exports['gcphone-next']:SetPhoneVisualMode('camera')
local mode, opts = exports['gcphone-next']:GetPhoneVisualMode()

-- Calls
local inCall = exports['gcphone-next']:IsInCall()
local callId = exports['gcphone-next']:GetCurrentCallId()

-- Music
local playing = exports['gcphone-next']:isPlayingMusic()
local paused  = exports['gcphone-next']:isMusicPaused()
local url     = exports['gcphone-next']:getCurrentMusicUrl()

-- Flashlight
exports['gcphone-next']:SetPhoneFlashlightEnabled(true)
local flashOn   = exports['gcphone-next']:IsPhoneFlashlightEnabled()
local profile   = exports['gcphone-next']:GetPhoneFlashlightProfile()

-- Native Audio
exports['gcphone-next']:PlayPhoneNativeTone('ring')
exports['gcphone-next']:StopPhoneNativeCallTone()
exports['gcphone-next']:StopPhoneNativePreviewTone()
exports['gcphone-next']:StopPhoneNativeOutgoingTone()

-- Animation
exports['gcphone-next']:PhonePlayIn()
exports['gcphone-next']:PhonePlayOut()
exports['gcphone-next']:PhonePlayCall()
exports['gcphone-next']:PhonePlayText()
exports['gcphone-next']:PhonePlayCamera()
exports['gcphone-next']:PhonePlayLive()

-- Proximity
local audioStatus  = exports['gcphone-next']:GetSnapLiveAudioStatus()
local nearbyPlayers = exports['gcphone-next']:GetNearbyPlayers()


-- ═══════════════════════════════════════════════════════════════════
-- SECCION 9: PERMISOS DISPONIBLES
-- ═══════════════════════════════════════════════════════════════════

--[[
  Permisos que una app puede solicitar:

  'location'       — Acceso a ubicacion del jugador
  'contacts'       — Leer lista de contactos
  'messages'       — Enviar mensajes SMS
  'notifications'  — Enviar notificaciones
  'camera'         — Acceso a camara
  'maps'           — Acceso a mapas/GPS

  Se declaran en el campo `permissions` de registerPhoneUI:
    permissions = { 'location', 'notifications' }

  El jugador ve un popup la primera vez pidiendo autorizacion.
  Si rechaza, los exports protegidos retornan PERMISSION_DENIED.
  El jugador puede revocar permisos en Settings > Apps.
]]


-- ═══════════════════════════════════════════════════════════════════
-- SECCION 10: RETURN VALUES Y ERRORES
-- ═══════════════════════════════════════════════════════════════════

--[[
  Direct Dialogs:
    phoneInput   -> { [id] = value, ... } o nil
    phoneConfirm -> true o false
    phoneSelect  -> "selected_id" o nil

  Registered UIs:
    result.view       -> string: vista donde estaba el jugador
    result.optionId   -> string: boton que clickeo
    result.formData   -> table: { [elementId] = value, ... }
    result.selectedId -> string: si selecciono un item de lista directamente

  Error returns (nil/false) cuando:
    PHONE_CLOSED   — telefono cerrado
    NOT_FOUND      — UI no registrada
    RATE_LIMITED   — rate limit excedido (3 por 10s por recurso por jugador)
    QUEUE_FULL     — cola llena (max 5 modales por jugador)
    APP_BLOCKED    — app bloqueada por el jugador
    Timeout        — 60 segundos sin actividad

  Server exports dan el error como segundo valor:
    local result, err = exports['gcphone-next']:openPhoneUI('app', source)
    if not result then print('Error:', err) end
]]


-- ═══════════════════════════════════════════════════════════════════
-- SECCION 11: NAVEGACION ENTRE VISTAS
-- ═══════════════════════════════════════════════════════════════════

--[[
  Usa `navigateTo` en items de lista o botones de accion:

  views = {
    main = {
      elements = {
        { type = 'list', id = 'menu', items = {
          { id = 'item1', label = 'Ver detalles', navigateTo = 'details' },
        }},
      },
      options = {
        { id = 'settings', label = 'Config', navigateTo = 'settings' },
      },
    },
    details = {
      title = 'Detalles',
      elements = { ... },
      -- Boton atras aparece automaticamente
    },
    settings = {
      title = 'Configuracion',
      elements = { ... },
    },
  }

  - Boton atras (<-) aparece automaticamente al navegar mas profundo
  - Boton X siempre cierra todo el modal
  - Un boton sin navigateTo valida campos required y cierra retornando resultado
]]
