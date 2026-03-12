# gcphone-next (fork)

**gcphone-next** is a fork / derivative work of **gcphone**.

Upstream project:
- Repository: https://github.com/manueljlz/gcphone
- Original author(s): manueljlz and contributors
- Original project age: ~6+ years of legacy codebase

This fork modernizes the architecture while respecting upstream license terms and attribution.

---
## Images

![Captura de pantalla_3-3-2026_141826_localhost](https://github.com/user-attachments/assets/54695d8c-2f70-4c7a-b5be-873634229f96)

![Video](https://files.fm/f/tgdtdgzwnn)

## What is this

A modernized FiveM phone resource featuring:

- SolidJS NUI (rewritten UI layer)
- Lua client/server modular structure
- LiveKit video-call bridge
- Optional Socket.IO realtime chat server
- YouTube server-side music search (API key never exposed to NUI)
- Storage provider abstraction system
- Data retention worker
- Dark Rooms (async forum-style system)
- Wallet + Documents core apps
- App scaffold for external developers

---

## What changed from upstream

Major architectural upgrades:

- Full NUI rewrite to SolidJS
- Modular server-side structure
- LiveKit integration (server token bridge)
- JWT-authenticated Socket.IO bridge
- Storage providers abstraction
- Retention system for history cleanup
- New apps (Wallet / Documents)
- Dark Rooms extended features (anonymous, password, attachments, voting)

This fork is not a drop-in replacement for legacy gcphone.
It is a structural modernization.

---

## Recent updates (Mar 2026)

This is the latest stabilization pass applied to this fork.

### Security and validation

- Added NUI request hardening with per-session token rotation, request sequence, and request signature.
- Added callback gate in client Lua before executing NUI callbacks.
- Added player-state checks for critical flows in QBCore bridge and server modules.
- Wallet, Clips, and Documents callbacks now verify source/target player state before sensitive actions.

### Frontend behavior

- Replaced browser `alert/prompt/confirm` usage with in-phone dialog/alert flows.
- Moved dialogs to render inside the phone screen container (not centered on full viewport).
- Replaced emoji-based controls in Gallery with icon assets.
- Refactored repeated tab/button markup in updated apps into small reusable components.

### FiveM compatibility

- Removed `backdrop-filter` usage from app styles to avoid runtime issues in FiveM NUI.

### Localization

- Added JSON-based locale structure for easy maintenance.
- Integrated `ox_lib` locale support on Lua side using `lib.locale()` and `shared/locales/*.json`.

### Codebase cleanup

- Resolved pending merge conflicts in server modules.
- Removed stale inline comments in updated hot paths.

---

## Self-host WebRTC (LiveKit OSS)

This fork already includes a LiveKit token bridge and browser client integration.

If you want to host your own WebRTC backend, use:

- `tools/livekit/setup-livekit.bat` (interactive setup)
- `tools/livekit/start-livekit.bat` (start stack)
- `tools/livekit/stop-livekit.bat` (stop stack)

The setup script generates:

- `tools/livekit/.env`
- `tools/livekit/livekit.yaml`

It also prints the exact convars you must set in your FiveM server config:

setr livekit_host "ws://YOUR_SERVER_IP:7880"
setr livekit_api_key "YOUR_KEY"
setr livekit_api_secret "YOUR_SECRET"
setr livekit_room_prefix "gcphone"
setr livekit_max_call_duration "300"

### Default networking notes

- `ws://127.0.0.1:7880` is local-only.
- For public production access, use a reachable host/IP and open required ports.
- The provided compose stack exposes:
  - TCP `7880` (signal/ws)
  - TCP `7881` (RTC TCP fallback)
  - UDP `50000-50100` (RTC media)

### Important

- STUN-only setups can fail in strict NAT/firewall environments.
- For stronger production compatibility, configure TURN/TLS.
- See `tools/livekit/README.md` for quickstart and operations.
- Keep `livekit_api_key` and `livekit_api_secret` server-side only (`server.cfg`/convars).
- Do not hardcode LiveKit credentials in web/client files.
- Download setup scripts only from this repository's GitHub.

---

## Operacion del resource

### Dependencias

- `ox_lib`
- `oxmysql`
- `qb-core`
- server build con `onesync`

### Orden de arranque recomendado

1. `oxmysql`
2. `ox_lib`
3. `qb-core`
4. servicios externos opcionales (LiveKit / Socket)
5. `gcphone-next`

### Config server.cfg (LiveKit)

setr livekit_host "ws://IP_DEL_SERVIDOR:7880"
setr livekit_api_key "TU_KEY"
setr livekit_api_secret "TU_SECRET"
setr livekit_room_prefix "gcphone"
setr livekit_max_call_duration "300"

Notas:

- `livekit_host` debe empezar con `ws://` o `wss://`.
- `livekit_api_key` y `livekit_api_secret` son server-side only.

### Config server.cfg (Socket opcional)

setr gcphone_socket_host "ws://IP_DEL_SERVIDOR:3001"
setr gcphone_socket_jwt_secret "TU_SECRET"

Notas:

- Socket es opcional, activar solo si realmente se usa.
- el JWT secret del socket server debe coincidir con `gcphone_socket_jwt_secret`.

### Verificacion rapida despues de reinicio

1. abrir telefono y validar carga inicial.
2. probar una accion social (follow/request o publicar).
3. probar llamada/LiveKit si esta habilitado.
4. revisar consola por errores de callback/convar.

### Troubleshooting rapido

- `MISSING_HOST` o `INVALID_HOST_SCHEME` (LiveKit): revisar `livekit_host`.
- 401 en LiveKit token: revisar key/secret y host correctos.
- `MISSING_SOCKET_HOST` o `INVALID_SOCKET_HOST_SCHEME`: revisar `gcphone_socket_host`.
- setup de LiveKit que "se cierra": ejecutar `tools\\livekit\\setup-livekit.bat` desde `cmd` para ver el error exacto.

### Estandar Lua (resumen)

- usar `lib.callback.register` con validacion defensiva en server.
- no confiar en estado cliente para ownership/permisos.
- usar sanitizacion de input y rate-limit en acciones spameables.
- mantener error codes estables para debug (`INVALID_PAYLOAD`, `RATE_LIMITED`, etc.).

### Notifications API

El recurso ya expone helpers para mandar notificaciones al telefono desde otros resources.

Comportamiento importante:

- si la notificacion trae `route`, al tocarla abre esa ruta en el telefono.
- si la app esta silenciada, no aparece salvo que `priority = 'high'`.
- si `Do Not Disturb` esta activo, no aparece salvo que `priority = 'high'`.
- si `sticky = true`, no se oculta sola.
- si no es sticky, usa `durationMs` y luego se descarta automaticamente.

Payload soportado:

- `appId`: id de app (`messages`, `chirp`, `mail`, etc.)
- `title`: titulo de la notificacion
- `message`: texto visible
- `icon`: glifo corto o texto breve
- `durationMs`: tiempo visible en ms
- `sticky`: si queda fija hasta cerrar manualmente
- `priority`: `low` | `normal` | `high`
- `route`: ruta a abrir al clickear
- `data`: payload adicional para la ruta

#### Server export

```lua
exports['gcphone-next']:SendPhoneNotification(source, {
    appId = 'messages',
    title = 'Mensajes',
    message = 'Nuevo mensaje de Rafa',
    icon = '✉',
    priority = 'normal',
    durationMs = 2600,
    route = 'messages',
    data = {
        conversation = '5551234'
    }
})
```

Broadcast:

```lua
exports['gcphone-next']:SendPhoneNotification(-1, {
    appId = 'system',
    title = 'Servidor',
    message = 'Habra reinicio en 10 minutos',
    icon = 'i',
    priority = 'high'
})
```

#### Client export

```lua
exports['gcphone-next']:NotifyPhone({
    appId = 'chirp',
    title = 'Chirp',
    message = 'Maria hizo rechirp de tu chirp.',
    icon = '↻',
    priority = 'high',
    durationMs = 2600,
    route = 'chirp'
})
```

#### Persistent notification

```lua
exports['gcphone-next']:AddPersistentNotification(identifier, {
    appId = 'mail',
    title = 'Mail',
    message = 'Tienes un correo nuevo pendiente'
})
```

#### Como pensar `appId`, `route`, `data` y `meta`

- `appId`: define a que app pertenece la notificacion para mute/unread/badges. Debe ser un id real del front como `messages`, `mail`, `bank`, `wavechat`, `news`, `yellowpages`.
- `route`: define a que pantalla navega el telefono cuando el jugador toca la notificacion.
- `data`: parametros opcionales de esa ruta. Ejemplo: abrir un chat concreto o centrar un mapa.
- `meta`: payload persistente opcional guardado en DB; sirve para auditoria o contexto extra, pero la UI no navega con `meta`.

Ejemplo para abrir una conversacion:

```lua
exports['gcphone-next']:AddPersistentNotification(identifier, {
    appId = 'messages',
    title = 'Mensajes',
    message = 'Nuevo mensaje de Rafa',
    route = 'messages',
    data = {
        phoneNumber = '555-1111'
    }
})
```

Ejemplo para abrir Maps con coordenadas:

```lua
exports['gcphone-next']:AddPersistentNotification(identifier, {
    appId = 'maps',
    title = 'GPS',
    message = 'Nueva ubicacion recibida',
    route = 'maps',
    data = {
        x = 123.4,
        y = 456.7
    }
})
```

### Sensitive exports and identifier ownership

Los exports server-side que leen datos privados por `identifier` ahora exigen `requestSource` y validan ownership antes de devolver datos.

Esto aplica a exports como:

- `GetContacts(identifier, requestSource)`
- `GetGallery(identifier, requestSource)`
- `GetMessages(identifier, requestSource)`
- `GetConversation(identifier, phoneNumber, requestSource)`
- `GetCallHistory(identifier, requestSource)`
- `GetPhoneNumber(identifier, requestSource)`
- `GetPhoneByIdentifier(identifier, requestSource)`

Ejemplo correcto:

```lua
local src = source
local identifier = exports['gcphone-next']:GetIdentifier(src)
local contacts = exports['gcphone-next']:GetContacts(identifier, src)
```

Si `requestSource` no coincide con el owner real del `identifier`, el export devuelve vacio, `nil` o `UNAUTHORIZED` segun el caso.

#### Browser mock helpers

En browser/devtools puedes probar los banners con:

```js
window.gcphoneMock.hiddenNotification()
window.gcphoneMock.hiddenNotificationBurst()
window.gcphoneMock.hiddenNotificationSticky()
```

Eso sirve para revisar el estado "telefono guardado" y las transiciones de cola sin entrar al juego.

### Lluvia de ideas (rendimiento)

- reemplazar `transition: all` restante por transiciones de propiedades especificas (`transform`, `opacity`, `background-color`, etc.).
- revisar apps con listas largas y mover filtros/derivados a `createMemo` para evitar recomputes innecesarios.
- virtualizar listas pesadas que todavia no usan `VirtualList`.
- revisar callbacks sociales mas usados y aplicar cooldown por accion/usuario segun `Config.Security.RateLimits`.
- agregar comando de health (`gcphone_health`) con estado de DB, LiveKit, Socket y callbacks criticos.
- reducir trabajo por tick en cliente y mover validaciones sensibles al server.
- unificar cache TTL de apps sociales para evitar doble fetch al navegar rapido.
- eliminar queries redundantes en flujos follow/request y consolidar lecturas post-accion.

---

## Attribution

This repository contains a derivative work of:
https://github.com/manueljlz/gcphone

All original credits remain with the upstream authors.
Please refer to the original repository for historical contributors.

---

## License

This project inherits and complies with the upstream license terms.

The original LICENSE file from:
https://github.com/manueljlz/gcphone

must remain included in this repository.

Any additional modifications are distributed under the same license unless otherwise stated.

---

Maintained by: JericoFX
