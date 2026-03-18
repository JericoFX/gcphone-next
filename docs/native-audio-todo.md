# Native Audio — COMPLETADO

Estado: **Activo** — Audio nativo GTA habilitado via `gcphone_sounds` (AWC + dat54.rel).

## Arquitectura

- **Runtime** (notificación, llamada entrante/saliente, mensaje) → `PlaySoundFromEntity` (espacial, nearby players escuchan)
- **Preview** (Settings, probar tonos) → `PlaySoundFrontend` (solo jugador local)
- **Modo silencio/DND** → usa variante `_vibrando` del AWC en vez del sonido normal
- **Fallback** → si el nativo falla (ej. browser dev mode), cae a HTML5 Audio/NUI

## Banco de audio

- Bank: `audiodirectory/sounds`
- SoundSet: `gcphone`
- Recurso: `gcphone_sounds` (dependencia en fxmanifest.lua)

## Sonidos disponibles en AWC (SoundSet `gcphone`)

| ScriptName | Uso |
|---|---|
| call_1..call_13 | Ringtones |
| call_vibrando | Vibración para ringtones (silencio/DND) |
| nueva_notificacion | Notificación/Mensaje 1 |
| nueva_notificacion2 | Notificación/Mensaje 2 |
| nueva_notificacion3 | Notificación/Mensaje 3 |
| nueva_notificacion_vibrando | Vibración para notif/msg (silencio/DND) |
| pop | Pop 1 |
| pop2 | Pop 2 |
| sonando | Tono de marcado (loop) |
| sonando_corto | Tono de marcado corto |

## Guía para agregar nuevos sonidos

1. Agregar el WAV al recurso `gcphone_sounds` (carpeta `wav/`)
2. Recompilar el AWC con Renewed Audiotool
3. Agregar entrada al SoundSet en `gcphone_sounds.dat54.rel.xml`
4. Recompilar el `.dat54.rel`
5. Agregar entrada en `Config.NativeAudio.Catalog` (`shared/config.lua`):
   ```lua
   mi_sonido = {
       label = 'Mi Sonido',
       category = 'notification',  -- ringtone | notification | message | calling
       soundName = 'mi_sonido',    -- ScriptName del SoundSet
       vibrando = 'nueva_notificacion_vibrando',  -- o false si no tiene
   }
   ```
6. Bank y SoundSet son compartidos: `audiodirectory/sounds` / `gcphone`

## Archivos clave

- `shared/config.lua` — Catálogo (`Config.NativeAudio.Catalog`)
- `client/native_audio.lua` — Controlador de playback nativo (PlayTone, modos, NUI callbacks)
- `web/src/components/system/PhoneAudioController.tsx` — Ruteo nativo-primero con fallback NUI
- `client/calls.lua` — Outgoing call sound via nativo

## Verificación

1. `ensure gcphone_sounds` antes de `ensure gcphone-next` en server.cfg
2. `/testaudio` — confirmar que todos los sonidos AWC funcionan
3. Recibir llamada → ringtone suena desde el ped (otros jugadores cercanos lo escuchan)
4. Activar modo silencio → la llamada entrante usa `call_vibrando`
5. Recibir notificación → sonido espacial `nueva_notificacion` desde el ped
6. Recibir mensaje → sonido espacial desde el ped
7. Ir a Settings → probar tonos → suena solo para el jugador local (PlaySoundFrontend)
8. Hacer llamada saliente → tono `sonando` desde el ped
9. Browser dev mode → fallback HTML5 Audio funciona
10. `bun run build` en `web/` compila sin errores
