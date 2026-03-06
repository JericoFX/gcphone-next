# TODO manana - ideas LB -> gcphone-next

## Objetivo
Implementar las ideas tecnicas buenas de `lb-phone` en nuestro telefono, sin copiar su UX/flujo visual.

## Lo que ya quedo hecho hoy (commits)
- [x] A - `feat(social): add follow-request foundation schema`
- [x] B - `feat(snap): add private follow-request workflow and profile relation states`
- [x] C - `feat(chirp): add private follow-request workflow and relationship-aware profiles`
- [x] D - `feat(social): add notification inbox callbacks and retention cleanup`
- [x] E - `feat(nui): wire snap/chirp follow-request and social notification callbacks`

## Ideas concretas sacadas de LB (a implementar/adaptar)

### 1) Follow system por app (LB: Instagram/Twitter)
- [x] Base backend lista (Snap/Chirp con private + requests).
- [ ] Ajustar UX completa de estados: `Seguir` / `Pendiente` / `Siguiendo`.
- [ ] Asegurar simetria en todos los paths (follow directo, request, cancel, accept, reject, unfollow).

### 2) Requests robustas (LB: follow_requests)
- [x] Estados y timestamps base (`pending/accepted/rejected/cancelled`, `responded_at`).
- [ ] Revisar migracion de datos legacy para que quede 100% idempotente en servidores viejos.
- [ ] Evitar requests huérfanas (cuentas borradas/corruptas).

### 3) Notificaciones sociales deduplicadas (LB: notifications + dedupe)
- [x] Tabla + insercion dedupe + callbacks de inbox.
- [ ] Integrar en UI (centro de notificaciones social visible en app).
- [ ] Marcar leidas/leer todo desde frontend real (no solo callback disponible).

### 4) Cuenta social unificada (LB: account switcher pattern)
- [ ] Definir fuente de verdad de perfil social (username, display, avatar, bio, privacidad, verified).
- [ ] Dejar Snap/Chirp/Clips/News leyendo del mismo perfil para evitar drift.
- [ ] Resolver conflictos de updates simultaneos entre apps.

### 5) Retencion/limpieza (LB: auto delete notifications)
- [x] Cleanup agregado para `phone_social_notifications`.
- [ ] Revisar intervalo y politica final por config (si se quiere custom por app).

### 6) Seguridad defensiva (LB: guard clauses consistentes)
- [x] Validaciones base server-side ya agregadas en nuevos endpoints.
- [ ] Revisar todos los endpoints legacy de follow/profile para hardening parejo.
- [ ] Auditoria final de self-target, duplicados, race conditions y responses consistentes.

### 7) Audio live/proximidad (LB: hearNearby + recordNearby, adaptado)
- [x] Definir modo de audio para lives Snap sin copiar LB 1:1.
- [x] Mantener `snaplive-*` en LiveKit como base principal.
- [x] Agregar capa opcional de proximidad (feature flag):
  - [x] Near listeners entran/salen por distancia configurable.
  - [x] Volumen dinamico por distancia.
  - [x] Owner/participantes con prioridad de mezcla.
- [ ] No persistir audio ni mensajes live (seguir efimero).
- [x] Moderacion de owner aplicada tambien al audio (mute/kick de participantes en vivo).
- [x] Guardar compatibilidad con pma-voice/mumble cuando este disponible.
- [x] Fallback seguro: si falla proximidad, live sigue funcionando por LiveKit normal.

## Lo que falta hacer manana (orden recomendado)

## F - Snap UI (requests + estados follow)
- [ ] Panel de solicitudes en Snap con listas `Recibidas` y `Enviadas`.
- [ ] Botones `Aceptar/Rechazar/Cancelar` conectados a callbacks nuevos.
- [ ] Editor de perfil Snap conectado a `snapUpdateAccount`.
- [ ] Mostrar estado de relacion en vistas de perfil (cuando toque).
- [ ] Ajustar estilos para que quede propio de gcphone-next (no look LB).

## G - Chirp UI (requests + estados follow)
- [ ] Strip social bajo tabs en Chirp (pendientes/enviadas + accesos rapidos).
- [ ] Modal de solicitudes y modal de perfil conectados a callbacks nuevos.
- [ ] Soporte `is_private` en editor Chirp (toggle + persistencia).
- [ ] Refrescar feed/estado luego de aceptar/rechazar/cancelar.

## H - Onboarding social unificado
- [ ] Crear componente shared para onboarding social primer uso.
- [ ] Campos minimos: username, display_name, avatar, bio, is_private.
- [ ] Reutilizar en Snap, Chirp, Clips, News.
- [ ] Gate de primer uso para no mostrarlo cada vez.

## I - Pulido final + QA
- [ ] Tests smoke manuales:
  - [ ] Snap private: request -> accept -> follow real.
  - [ ] Snap private: request -> reject.
  - [ ] Chirp private: request -> cancel.
  - [ ] Notificaciones: no duplicados por spam click/reintentos.
  - [ ] Perfil unificado refleja cambios en las 4 apps.
- [ ] Regression suite visual/funcional:
  - [ ] Snap live efimero + moderacion owner.
  - [ ] Stories autoplay.
  - [ ] Clips short-video (sin overlay raro).
  - [ ] Emoji picker (6 recientes max).
  - [ ] Settings simplificados (sin phone case/themes).
- [ ] Correr build/lint final y corregir errores.

## J - Audio (implementacion por fases)
- [x] Fase J1: contrato server/client de proximidad (sin activar por defecto).
- [x] Fase J2: eventos de entrada/salida de radio de escucha para live.
- [x] Fase J3: control de volumen por distancia + pruebas de rendimiento.
- [x] Fase J4: controles owner (mute/kick) reflejados en UI live.
- [ ] Fase J5: smoke test con 3 escenarios:
  - [ ] LiveKit solo.
  - [ ] LiveKit + proximidad activa.
  - [ ] Degradacion/fallback sin cortar stream.
  - [x] Guia QA en `docs/qa/snap-live-audio-smoke.md`.
  - [x] Herramienta QA: comando `gcphone_liveauudio_status` para diagnostico rapido.
  - [x] Herramienta QA: comando `gcphone_liveauudio_stop` para cortar proximidad en caliente.
  - [x] Herramienta QA: comando `gcphone_liveauudio_toggle` para pruebas LiveKit-only vs proximidad.

## Regla de diseño (importante)
- [ ] No copiar layout/estructura de LB.
- [ ] Mantener lenguaje actual de gcphone-next (iOS-like, limpio, compacto).
- [ ] Textos, orden visual y componentes con identidad propia.

## Plan de commits manana (1 feature = 1 commit)
- [ ] Commit F: Snap UI requests + profile editor.
- [ ] Commit G: Chirp UI requests + profile editor + private toggle.
- [ ] Commit H: onboarding social shared + wiring apps.
- [ ] Commit I: QA fixes + regression pass.
- [ ] Commit J: audio live/proximidad (feature flag + fallback + QA).
