# gcphone-next - Troubleshooting rapido

## 1) El telefono no abre o abre vacio

Revisar:

1. `ox_lib`, `oxmysql`, `qb-core` y `gcphone-next` en estado `started`.
2. `web/dist` presente dentro del resource.
3. errores Lua en consola al iniciar.

Accion:

- reiniciar en orden dependencias -> framework -> `gcphone-next`.

## 2) setup-livekit.bat se cierra solo

Estado actual:

- el script ya incluye `pause` y mensajes de error.

Si igual se cierra:

1. abrir `cmd` manualmente.
2. ejecutar `tools\\livekit\\setup-livekit.bat`.
3. copiar el mensaje exacto.

Errores comunes:

- Docker no instalado.
- Docker Compose no disponible.
- permiso de PowerShell bloqueado por politica local.

## 3) LiveKit token falla (`MISSING_HOST`, `INVALID_HOST_SCHEME`)

Revisar convars en `server.cfg`:

setr livekit_host "ws://IP_DEL_SERVIDOR:7880"
setr livekit_api_key "TU_KEY"
setr livekit_api_secret "TU_SECRET"

Notas:

- el host debe empezar con `ws://` o `wss://`.
- key/secret deben ser validos para ese host.

## 4) LiveKit devuelve 401 invalid authorization token

Causa tipica:

- token firmado con credenciales incorrectas.

Checklist:

1. confirmar key/secret del server.
2. confirmar que LiveKit server corre con el mismo par key/secret.
3. reiniciar `gcphone-next` despues de cambiar convars.

## 5) Socket token falla (`MISSING_SOCKET_HOST`, `INVALID_SOCKET_HOST_SCHEME`)

Revisar convars:

setr gcphone_socket_host "ws://IP_DEL_SERVIDOR:3001"
setr gcphone_socket_jwt_secret "TU_SECRET"

Y confirmar que el socket server usa el mismo JWT secret.

## 6) Follow requests no aparecen o quedan inconsistentes

Revisar:

1. callbacks NUI nuevos activos (`snapCreateAccount`, `chirpCreateAccount`, requests).
2. migraciones SQL aplicadas.
3. que no haya datos legacy huerfanos.

Sugerencia operativa:

- probar flujo completo con dos cuentas: request -> accept/reject/cancel -> unfollow.

## 7) Audio live con cortes o sin audio remoto

Checklist rapido:

1. `Config.Snap.AllowLive = true`
2. `Config.Snap.LiveAudio.Enabled` segun escenario
3. LiveKit host/token correctos
4. ejecutar comando QA `gcphone_liveauudio_status`

Documento de referencia:

- `docs/qa/snap-live-audio-smoke.md`

## 8) No se guardan cambios de perfil social

Revisar callbacks:

- `snapUpdateAccount`
- `chirpUpdateAccount`

En cliente revisar consola NUI y payload enviado.

## 9) Regla de seguridad

- no poner `livekit_api_secret` ni `gcphone_socket_jwt_secret` en frontend/client.
- mantener secretos solo en convars server-side.
