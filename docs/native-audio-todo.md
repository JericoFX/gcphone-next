# Native Audio TODO

Estado actual:

- El telefono ya usa `toneId` abstractos en vez de `.ogg` legacy.
- Hay placeholders listos para audio nativo en `shared/config.lua`.
- Las llamadas entrantes ya usan `state bag` `gcphoneIncomingCall`.
- El cliente ya tiene controlador placeholder en `client/native_audio.lua`, pero no entra en runtime final mientras `PlaceholderMode = true` o falten bancos reales.
- El preview de Settings sigue usando audio web/NUI mediante `gcphone:previewTone` / `gcphone:stopTonePreview`.
- El ringtone JS hardcodeado `Phone_Call_Sound_Effect.ogg` ya no se usa.

Tone IDs definidos:

- `call_main_01`
- `call_alt_01`
- `buzz_short_01`
- `notif_soft_01`
- `msg_soft_01`

MP3 fuente esperados:

- `audio_sources/ringtones/call_main_01.mp3`
- `audio_sources/ringtones/call_alt_01.mp3`
- `audio_sources/vibrate/buzz_short_01.mp3`
- `audio_sources/notifications/notif_soft_01.mp3`
- `audio_sources/messages/msg_soft_01.mp3`

Suposicion actual para Audiotool:

- `soundName` final = nombre del mp3 sin extension.
- Falta verificar el `bank` real que genera Audiotool.
- Falta verificar si tambien requiere `soundSet` distinto del banco.

Informacion que falta cuando se conviertan los audios:

Por cada tono convertir y completar:

1. `resource`
2. `bank`
3. `soundName`
4. `soundSet` (si aplica)
5. `playback` final (`frontend` o `entity`)

Archivos a completar cuando exista el output real de Audiotool:

- `shared/config.lua`
  - completar `Config.NativeAudio.Catalog[*].bank`
  - completar `Config.NativeAudio.Catalog[*].soundSet`
  - ajustar `playback` si hace falta

- `client/native_audio.lua`
  - verificar native final a usar contra el banco real generado
  - confirmar si `PlaySoundFrontend` es suficiente o si conviene `PlaySoundFromEntity`
  - quitar modo placeholder cuando ya existan bancos reales

Flujo implementado hoy:

- Server guarda/lee tonos por `toneId`
- Server setea `Player(target).state.gcphoneIncomingCall`
- Client escucha el `state bag`
- Client intenta resolver `toneId -> soundName/bank/soundSet`, pero con `PlaceholderMode = true` no reproduce runtime nativo aun
- El telefono reproduce tonos actuales por JS/NUI (`PhoneAudioController` + `phoneAudio.ts`)
- Client puede parar el sonido con natives cuando el runtime final quede habilitado

Compatibilidad legacy ya resuelta:

- `ring.ogg` -> `call_main_01`
- `ring2.ogg` -> `call_alt_01`
- `iphone11.ogg` -> `call_alt_01`
- `soft-ping.ogg` -> `notif_soft_01`
- `glass.ogg` -> `notif_soft_01`
- `orbit.ogg` -> `notif_soft_01`
- `pop.ogg` -> `msg_soft_01`
- `bubble.ogg` -> `msg_soft_01`
- `tap.ogg` -> `msg_soft_01`

Punto importante:

- Los MP3 actuales NO son el runtime final.
- `catalog.json` ahora funciona como catalogo logico/UI y referencia de source assets.
- El runtime actual funcional sigue siendo audio web/NUI.
- El runtime final sera audio nativo de FiveM cuando se complete el mapper real.
