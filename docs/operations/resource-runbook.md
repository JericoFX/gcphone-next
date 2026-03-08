# gcphone-next - Runbook operativo

Este documento explica como levantar, operar y mantener el resource en un servidor FiveM.

## 1) Dependencias

Minimo requerido:

- `ox_lib`
- `oxmysql`
- `qb-core`
- Build server con `onesync` habilitado

Notas:

- El frontend se sirve desde `web/dist` (incluido en `fxmanifest.lua`).
- LiveKit y Socket son opcionales por feature flag, pero si estan habilitados necesitan host/token validos.

## 2) Orden de arranque recomendado

Orden base del servidor:

1. `oxmysql`
2. `ox_lib`
3. framework (`qb-core`)
4. dependencias externas (si aplica)
5. `gcphone-next`

Si `gcphone-next` arranca antes que framework/base de datos, vas a ver callbacks incompletos o setup parcial.

## 3) Configuracion minima

### 3.1 Basico

Revisar `shared/config.lua`:

- `Config.Phone`
- `Config.Features`
- `Config.Security.RateLimits`
- `Config.Storage`

### 3.2 LiveKit (si `Config.LiveKit.Enabled = true`)

En `server.cfg`:

setr livekit_host "ws://IP_DEL_SERVIDOR:7880"
setr livekit_api_key "TU_KEY"
setr livekit_api_secret "TU_SECRET"
setr livekit_room_prefix "gcphone"
setr livekit_max_call_duration "300"

Reglas:

- `livekit_host` debe ser `ws://` o `wss://`.
- key/secret son solo server-side. No se ponen en web ni cliente.

### 3.3 Socket (si `Config.Socket.Enabled = true`)

En `server.cfg`:

setr gcphone_socket_host "ws://IP_DEL_SERVIDOR:3001"
setr gcphone_socket_jwt_secret "TU_SECRET"

Reglas:

- `gcphone_socket_host` debe ser `ws://` o `wss://`.
- el JWT secret debe coincidir con el servidor Socket.

## 4) Validaciones de arranque (check rapido)

Despues de reiniciar:

1. Abrir telefono y verificar que carga estado inicial.
2. Probar un callback simple (contactos o mensajes).
3. Si LiveKit esta activo, probar obtener token y conectar una llamada.
4. Si Socket esta activo, validar token y conexion de chat.

## 5) Flujo de operacion diario

Checklist corto:

1. Verificar logs de errores en consola server.
2. Confirmar DB online y sin timeout.
3. Revisar que `gcphone-next` este en estado started.
4. Hacer smoke de una accion social y una de llamadas.

## 6) Deploy / actualizacion

Antes de actualizar:

1. Backup de DB.
2. Guardar config y convars actuales.
3. Revisar cambios en `sql/schema.sql` y notas de migracion.

Despues de actualizar:

1. Reiniciar resource.
2. Correr smoke funcional basico.
3. Revisar notificaciones, follows y llamadas.

## 7) Seguridad operativa

- Nunca dejar `livekit_api_secret` o `gcphone_socket_jwt_secret` en archivos de cliente.
- No compartir capturas de config con secretos visibles.
- Evitar endpoints locales (`127.0.0.1`) en produccion publica.

## 8) QA recomendado por release

Para cerrar una release:

- QA social (requests/follow/notificaciones).
- QA llamadas/video/live audio.
- QA regresion visual de apps principales.
- Build frontend en verde y server sin errores de callback.
