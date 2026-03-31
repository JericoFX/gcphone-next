---
title: Phone SDK Examples
---

# Phone SDK — Examples

Complete working examples for common use cases.

---

## Simple: Bank Transfer Dialog

```lua
-- client/main.lua

RegisterCommand('transfer', function()
  local result = exports['gcphone-next']:phoneInput('Transferir dinero', {
    { type = 'input', id = 'target', label = 'Numero destino', required = true, maxLength = 20 },
    { type = 'number', id = 'amount', label = 'Monto ($)', required = true, min = 1, max = 1000000 },
    { type = 'textarea', id = 'note', label = 'Nota', placeholder = 'Opcional', maxLength = 140 },
  }, {
    submitLabel = 'Transferir',
    submitTone = 'primary',
  })

  if not result then return end

  TriggerServerEvent('bank:transfer', result.target, result.amount, result.note)
end)
```

---

## Simple: Sell Confirmation

```lua
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
```

---

## Simple: Vehicle Selection

```lua
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
```

---

## Complete: Mechanic Shop (Multi-View)

```lua
-- server/main.lua

CreateThread(function()
  exports['gcphone-next']:registerPhoneUI('mech_central', {
    title = 'Mecanico Central',
    icon = '🔧',
    shortcut = {
      visible = false,
      category = 'services',
      description = 'Reparaciones y mejoras',
    },
    views = {
      main = {
        elements = {
          { type = 'header', text = 'Servicios disponibles' },
          { type = 'list', id = 'service', items = {
            { id = 'repair', label = 'Reparar vehiculo', description = 'Reparacion completa — $500', icon = '🔧', navigateTo = 'confirm_repair' },
            { id = 'upgrade', label = 'Mejoras de motor', description = 'Potencia y velocidad', icon = '⬆️', navigateTo = 'upgrades' },
            { id = 'paint', label = 'Pintura', description = 'Cambiar color del vehiculo', icon = '🎨', navigateTo = 'paint' },
            { id = 'wash', label = 'Lavado', description = 'Limpieza express — $50', icon = '🧽', navigateTo = 'confirm_wash' },
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
          { id = 'confirm_repair', label = 'Reparar — $500', tone = 'primary' },
        },
      },

      confirm_wash = {
        title = 'Confirmar lavado',
        elements = {
          { type = 'label', text = 'Lavado express para tu vehiculo.' },
          { type = 'label', text = 'Costo: $50' },
        },
        options = {
          { id = 'confirm_wash', label = 'Lavar — $50', tone = 'primary' },
        },
      },

      upgrades = {
        title = 'Mejoras de motor',
        elements = {
          { type = 'select', id = 'part', label = 'Pieza', required = true, options = {
            { value = 'engine', label = 'Motor — $2,000' },
            { value = 'turbo', label = 'Turbo — $5,000' },
            { value = 'brakes', label = 'Frenos — $1,500' },
            { value = 'suspension', label = 'Suspension — $1,200' },
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
          { id = 'apply_paint', label = 'Pintar — $1,000', tone = 'primary' },
        },
      },
    },
    startView = 'main',
  })
end)

-- Show/hide via ox_target (client-side)
-- The dev handles proximity detection however they want (ox_target, qb-target, zones, etc.)
exports('ox_target'):addBoxZone({
  coords = vec3(732.0, -1088.0, 22.0),
  size = vec3(10, 10, 4),
  options = {
    { name = 'mech_open', label = 'Abrir Mecanico', onSelect = function()
      exports['gcphone-next']:openPhoneUI('mech_central')
    end },
  },
})

-- Handle results
exports['gcphone-next']:onPhoneUIResult('mech_central', function(source, result)
  if result.optionId == 'confirm_repair' then
    if RemoveMoney(source, 500) then
      RepairVehicle(source)
      Notify(source, 'Vehiculo reparado')
    end

  elseif result.optionId == 'confirm_wash' then
    if RemoveMoney(source, 50) then
      WashVehicle(source)
      Notify(source, 'Vehiculo lavado')
    end

  elseif result.optionId == 'buy_upgrade' then
    local part = result.formData.part
    local level = result.formData.level
    local cost = GetUpgradeCost(part, level)
    if RemoveMoney(source, cost) then
      ApplyUpgrade(source, part, tonumber(level))
      Notify(source, ('Mejora instalada: %s Nv.%s'):format(part, level))
    end

  elseif result.optionId == 'apply_paint' then
    local color = result.formData.color
    local metallic = result.formData.metallic
    local cost = metallic and 1200 or 1000
    if RemoveMoney(source, cost) then
      PaintVehicle(source, color, metallic)
      Notify(source, 'Vehiculo pintado')
    end
  end
end)
```

---

## Complete: Food Delivery App (Always Available)

```lua
-- server/main.lua

CreateThread(function()
  exports['gcphone-next']:registerPhoneUI('cluckin_delivery', {
    title = 'Cluckin Bell Delivery',
    icon = '🍗',
    shortcut = {
      visible = true,
      category = 'food',
      description = 'Pedi comida a domicilio',
    },
    permissions = { 'location', 'notifications' },
    views = {
      menu = {
        elements = {
          { type = 'image', url = 'https://example.com/cluckin-banner.jpg', height = 150 },
          { type = 'header', text = 'Menu del dia' },
          { type = 'select', id = 'food', label = 'Plato', required = true, options = {
            { value = 'burger', label = 'Cluckin Burger — $8' },
            { value = 'wings', label = 'Wings x6 — $6' },
            { value = 'combo', label = 'Combo Familiar — $15' },
            { value = 'wrap', label = 'Chicken Wrap — $5' },
          }},
          { type = 'number', id = 'quantity', label = 'Cantidad', required = true, min = 1, max = 10, default = 1 },
          { type = 'select', id = 'drink', label = 'Bebida', options = {
            { value = 'none', label = 'Sin bebida' },
            { value = 'cola', label = 'eCola — $2' },
            { value = 'sprunk', label = 'Sprunk — $2' },
            { value = 'water', label = 'Agua — $1' },
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

exports['gcphone-next']:onPhoneUIResult('cluckin_delivery', function(source, result)
  if result.optionId ~= 'order' then return end

  local food = result.formData.food
  local qty = tonumber(result.formData.quantity) or 1
  local drink = result.formData.drink
  local instructions = result.formData.instructions

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

  -- Simulate delivery
  SetTimeout(300000, function()
    GiveFood(source, food, qty, drink)
    exports['gcphone-next']:phoneNotify(source, 'cluckin_delivery', {
      title = 'Pedido entregado!',
      content = 'Tu comida esta lista. Buen provecho!',
      icon = '🍗',
    })
  end)
end)
```

---

## Complete: Bar / Restaurant (Proximity + Promo)

A bar that appears when the player is nearby, with happy hour promos and a food/drink menu.

```lua
-- server/main.lua of resource "my-bar"

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
        { id = 'order_combo', label = 'Pedir combo amigos — $150', tone = 'primary' },
      },
    },
  },
  startView = 'main',
})

-- Show when players are near the bar
-- Client-side: open via ox_target or any proximity system
-- Proximity detection is the dev's responsibility
exports('ox_target'):addSphereZone({
  coords = vec3(230.0, -910.0, 30.0),
  radius = 3.0,
  options = {
    { name = 'bar_open', label = 'Abrir menu del bar', icon = 'fas fa-beer', onSelect = function()
      exports['gcphone-next']:openPhoneUI('el_gordo_bar')
    end },
  },
})

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
```

---

## Complete: Mechanic Job (On-Duty + Dynamic Data)

A work panel for mechanic employees with dynamic inventory, pending jobs, and client notifications.

```lua
-- server/main.lua of resource "my-mechanic-job"

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
          { value = 'repair', label = 'Reparacion general — $500' },
          { value = 'engine', label = 'Reparacion de motor — $1,500' },
          { value = 'body', label = 'Reparacion carroceria — $800' },
          { value = 'paint', label = 'Pintura completa — $2,000' },
          { value = 'tow', label = 'Servicio de grua — $300' },
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

-- Dev controls visibility however they want.
-- Example: show only for on-duty mechanics using a job check event
AddEventHandler('QBCore:Server:OnJobUpdate', function(source, job)
  mech.setVisible(source, job.name == 'mechanic' and job.onduty)
end)

-- Dynamic data when opened from Servicios
mech.onOpened(function(source)
  local player = exports['qbx_core']:GetPlayer(source)
  local identifier = player.PlayerData.citizenid
  local stats = GetMechanicStats(identifier)
  local pending = GetPendingJobs(identifier)

  local pendingItems = {}
  for _, job in ipairs(pending) do
    pendingItems[#pendingItems + 1] = {
      id = 'job_' .. job.id,
      label = ('%s — %s'):format(job.vehicle, job.service),
      description = ('$%d — %s'):format(job.price, job.client_name),
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

      -- Notify the vehicle owner if online
      local clientSource = FindPlayerByPlate(result.formData.client_plate)
      if clientSource then
        exports['gcphone-next']:phoneNotify(clientSource, 'mech_job', {
          title = 'Tu vehiculo esta siendo atendido',
          content = 'Un mecanico esta trabajando en tu auto',
          icon = '🔧',
        })
      end
    end
  end
end)
```

---

## Complete: Malicious App (RP Phishing)

A "store" that secretly reads contacts and sends spam. Demonstrates the permission system protecting players.

```lua
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
        { type = 'image', url = 'https://example.com/fake-sale-banner.jpg', height = 150 },
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

-- When player opens: harvest contacts and spam
fake.onOpened(function(source)
  local contacts = exports['gcphone-next']:phoneGetContacts(source, 'fake_store')
  if contacts then
    for _, contact in ipairs(contacts) do
      exports['gcphone-next']:phoneSendMessage(source, 'fake_store', {
        to = contact.number,
        message = 'Descuentos INCREIBLES en Fashion Store VIP! Abri la app! 👗💎',
      })
    end
  end
  return {}
end)

-- The "discount" does nothing
fake.onResult(function(source, result)
  fake.notify(source, {
    title = 'Procesando descuento...',
    content = 'Tu codigo sera enviado por SMS (mentira)',
    icon = '👗',
  })
end)
```

**How the player is protected:**
1. First open shows permission modal: "Fashion Store VIP wants access to: Contacts, Messages"
2. A clothing store asking for contacts + messages is suspicious
3. If rejected: app opens but `phoneGetContacts` and `phoneSendMessage` return `PERMISSION_DENIED`
4. If accepted: contacts get spammed (RP consequence)
5. After being scammed: Settings > Apps > **"Remove app"** blocks it permanently

---

## Simple: Hospital Check-in

```lua
local confirmed = exports['gcphone-next']:phoneConfirm('Check-in Hospital', {
  description = 'Te van a atender en emergencias. Costo: $2,500.',
  confirmLabel = 'Aceptar tratamiento',
  confirmTone = 'primary',
  icon = '🏥',
})

if confirmed then
  RemoveMoney(source, 2500)
  HealPlayer(source)
end
```

---

## Simple: Police Report

```lua
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
  CreatePoliceReport(source, report.type, report.description, report.location)
  TriggerClientEvent('chat:addMessage', -1, {
    args = { '[LSPD]', 'Nueva denuncia recibida: ' .. report.type },
  })
end
```

---

## Simple: Real Estate Listing

```lua
local propertyId = exports['gcphone-next']:phoneSelect('Propiedades en venta', {
  { id = 'apt_alta_1', label = 'Apartamento Alta St #1', description = '$150,000 — 2 ambientes', icon = '🏢' },
  { id = 'house_grove', label = 'Casa Grove Street', description = '$280,000 — 3 ambientes + garage', icon = '🏠' },
  { id = 'mansion_vinewood', label = 'Mansion Vinewood Hills', description = '$1,200,000 — 6 ambientes + pileta', icon = '🏰' },
}, {
  searchable = true,
  cancelLabel = 'Cerrar listado',
})

if propertyId then
  ShowPropertyDetails(source, propertyId)
end
```

---

## Medium: Car Dealership (Multi-View)

```lua
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
        -- Filled via viewOverrides with real stock
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
        { type = 'label', text = 'Tasa: 5% mensual — Sin entrega inicial', tone = 'muted' },
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

dealer.onOpened(function(source)
  local stock = GetDealerStock()
  local stockItems = {}
  for _, v in ipairs(stock) do
    stockItems[#stockItems + 1] = {
      id = v.model,
      label = v.name,
      description = ('$%s — %s'):format(v.price, v.class),
      icon = '🚗',
    }
  end

  return {
    dynamicData = {
      balance = ('$%s'):format(GetPlayerMoney(source)),
      stock_count = tostring(#stock),
    },
    viewOverrides = {
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
```

---

## Medium: Gang Stash (With Permissions)

```lua
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
        { type = 'select', id = 'item', label = 'Item', required = true, options = {} }, -- dynamic
        { type = 'number', id = 'amount', label = 'Cantidad', required = true, min = 1, max = 100 },
      },
      options = {
        { id = 'do_deposit', label = 'Depositar', tone = 'primary' },
      },
    },
    withdraw = {
      title = 'Retirar',
      elements = {
        { type = 'select', id = 'item', label = 'Item del stash', required = true, options = {} }, -- dynamic
        { type = 'number', id = 'amount', label = 'Cantidad', required = true, min = 1, max = 100 },
      },
      options = {
        { id = 'do_withdraw', label = 'Retirar', tone = 'danger' },
      },
    },
    log = {
      title = 'Historial',
      elements = {
        -- dynamic
      },
    },
  },
  startView = 'main',
})
```

---

## Navigation Between Views

Views navigate using `navigateTo` on list items or action buttons:

```lua
views = {
  main = {
    elements = {
      { type = 'list', id = 'menu', items = {
        { id = 'item1', label = 'Ver detalles', navigateTo = 'details' },
      }},
    },
    options = {
      { id = 'settings', label = 'Configuracion', navigateTo = 'settings' },
    },
  },
  details = {
    title = 'Detalles',
    elements = { ... },
    -- Back button (←) appears automatically
  },
  settings = {
    title = 'Configuracion',
    elements = { ... },
  },
}
```

The phone automatically shows a back button when the player navigates deeper. The ✕ button always closes the entire modal.

---

## Comparison Table

| Example | Visibility | Permissions | Dynamic Data | Notifications | Controller Methods |
|---|---|---|---|---|---|
| Bank Transfer | N/A (direct) | None | No | No | N/A |
| Sell Confirm | N/A (direct) | None | No | No | N/A |
| Vehicle Select | N/A (direct) | None | No | No | N/A |
| Bar | Proximity (25m) | `notifications` | No (static menu) | Yes (orders) | `setVisible`, `notify`, `onResult` |
| Mechanic Job | Job + on-duty | `location`, `notifications`, `maps` | Yes (inventory, jobs, stats) | Yes (job status) | `setVisible`, `notify`, `onOpened`, `onResult` |
| Car Dealer | Proximity | None | Yes (stock, balance) | Yes (quotes) | `setVisible`, `notify`, `onOpened`, `onResult` |
| Gang Stash | Gang zone | `location` | Yes (inventory) | No | `setVisible`, `onOpened`, `onResult` |
| Malicious App | Always | `contacts`, `messages` | No | Yes (fake promos) | `notify`, `onOpened`, `onResult` |
