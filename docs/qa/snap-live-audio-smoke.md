# Snap Live Audio - Smoke Test

## Prerrequisitos
- `Config.Snap.AllowLive = true`
- `Config.Snap.LiveAudio.Enabled = true`
- Dos jugadores conectados como minimo: emisor (A) y espectador (B)

## Escenario 1 - LiveKit base (sin proximidad)
1. Poner `Config.Snap.LiveAudio.Enabled = false`.
2. Reiniciar recurso y abrir un live en Snap con jugador A.
3. Jugador B entra al live desde Snap.
4. Confirmar que B escucha audio del live sin depender de distancia.

Resultado esperado:
- No hay cortes por distancia.
- El stream sigue funcionando al alejarse/acercarse.

## Escenario 2 - LiveKit + proximidad activa
1. Poner `Config.Snap.LiveAudio.Enabled = true`.
2. Reiniciar recurso.
3. Iniciar live con A y entrar con B.
4. Acercar y alejar B de A.
5. Ejecutar en B: `gcphone_liveauudio_status`.

Resultado esperado:
- En rango: audio activo y badge "Audio cercano".
- Fuera de rango: audio en 0 y badge "Fuera de rango".
- `gcphone_liveauudio_status` reporta `active = true` y volumen variable.

## Escenario 3 - Degradacion/fallback
1. Con live activo y B conectado, provocar perdida temporal del flujo de proximidad (timeout/restart parcial).
2. Esperar watchdog de UI.
3. Verificar estado de audio en B.

Resultado esperado:
- UI muestra fallback y restablece audio base.
- LiveKit no se cae, solo se desactiva la capa de proximidad.

## Escenario 4 - Moderacion owner
1. A (owner) mutea a B en live.
2. Confirmar que B no escucha mientras sigue muteado.
3. A desmutea a B.

Resultado esperado:
- Al mutear: audio de B queda en 0.
- Al desmutear: audio vuelve segun rango sin reconectar live.

## Atajos QA
- `gcphone_liveauudio_status`: imprime estado actual en consola y notificacion.
- `gcphone_liveauudio_stop`: corta la sesion de proximidad en caliente.
- `gcphone_liveauudio_toggle`: activa/desactiva la capa de proximidad local sin reiniciar recurso.
- En el visor live, boton `🎧`: alterna audio cercano local del espectador (sin cerrar live).
