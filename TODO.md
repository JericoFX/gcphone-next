# TODO - Integracion de ideas LB (sin copiar UX ni estructura)

## Estado actual
- [x] Revertir commit roto que metio `lb-phone` completo por error.
- [ ] Rehacer implementacion limpia, incremental y con un commit por feature.

## Regla base del proyecto
- [ ] Tomar patrones tecnicos de LB, pero NO copiar tablas/flujo/UI tal cual.
- [ ] Mantener identidad visual actual de `gcphone-next` (iOS-like), con layout propio.
- [ ] Mantener chat live efimero (sin persistencia) y moderacion del owner.

## Fase 1 - Social schema minimo (inspirado en LB)
- [ ] Agregar soporte de privacidad en Chirp (`is_private`) para paridad con Snap.
- [ ] Normalizar requests de follow por app (snap/chirp) en tabla dedicada y consistente.
- [ ] Agregar `status` completo en requests: `pending`, `accepted`, `rejected`, `cancelled`.
- [ ] Agregar `responded_at` en requests para auditoria simple.
- [ ] Crear tabla de notificaciones sociales deduplicadas por app/evento/referencia.
- [ ] Agregar indices para: inbox requests, pendientes por owner, unread notifications.

## Fase 2 - Migracion y compatibilidad de datos
- [ ] Migrar datos de requests viejos a nueva estructura (idempotente).
- [ ] Conservar compatibilidad temporal para no romper front ya desplegado.
- [ ] Limpiar/normalizar requests invalidos (self-request, cuentas inexistentes).

## Fase 3 - Backend Snap (paridad follow/request)
- [ ] Implementar `sendFollowRequest` con validaciones server-side.
- [ ] Implementar `cancelFollowRequest`.
- [ ] Implementar `acceptFollowRequest` y `rejectFollowRequest`.
- [ ] Mantener `follow/unfollow` directo solo cuando cuenta destino es publica.
- [ ] Exponer `getPendingRequests` para owner.
- [ ] Exponer `getSentRequests` para emisor.
- [ ] En `getProfile`, devolver flags: `isFollowing`, `requested`, `requestedByMe`.
- [ ] Emitir notificaciones deduplicadas (`follow_request`, `follow_accepted`).

## Fase 4 - Backend Chirp (misma semantica que Snap)
- [ ] Replicar flujo completo de request/accept/reject/cancel en Chirp.
- [ ] Ajustar feed/perfil para cuentas privadas (si no sigue, restringir contenido).
- [ ] Mantener comportamiento publico por defecto para cuentas nuevas.

## Fase 5 - Perfil social unificado (idea de account switcher de LB, adaptada)
- [ ] Definir fuente de verdad de perfil social (username/display/avatar/bio/verified).
- [ ] Reutilizarla en Snap, Chirp, Clips y News sin duplicar logica.
- [ ] Evitar drift entre apps al actualizar perfil desde una sola app.

## Fase 6 - NUI bridge y contratos
- [ ] Agregar callbacks NUI para requests y notificaciones sociales.
- [ ] Estandarizar payloads (`success`, `error`, `data`) para Snap/Chirp.
- [ ] Revisar compatibilidad `cbSuccess` vs retorno crudo donde aplique.

## Fase 7 - Frontend social (que no se vea igual a LB)
- [ ] Crear vista propia de requests pendientes/enviadas para Snap.
- [ ] Crear vista propia de requests pendientes/enviadas para Chirp.
- [ ] Mostrar estados claros de relacion: Seguir / Solicitud enviada / Siguiendo.
- [ ] Ajustar copy/espaciados/jerarquia visual para estilo propio del proyecto.
- [ ] Mantener consistencia de componentes existentes (sin meter patrones externos).

## Fase 8 - Onboarding social unificado
- [ ] Mostrar onboarding de perfil social al primer uso de apps sociales.
- [ ] Campos minimos: username, display name, avatar, bio, privacidad.
- [ ] Validaciones fuertes (longitud, caracteres permitidos, URL avatar segura).
- [ ] Reusar componente compartido en Snap/Chirp/Clips/News.

## Fase 9 - Notificaciones y retencion
- [ ] Integrar notificaciones de follow request/accepted en centro de notificaciones.
- [ ] Agregar regla de limpieza para notificaciones sociales antiguas.

## Fase 10 - Seguridad y hardening (tomado de patrones LB)
- [ ] Guard clauses en todos los callbacks nuevos.
- [ ] Nunca confiar estado del cliente para follow/request/accept.
- [ ] Bloquear acciones self-target y duplicadas.
- [ ] Evitar inserciones dobles con unique + control de errores limpio.

## Fase 11 - QA / smoke tests
- [ ] Caso: cuenta privada Snap recibe request, acepta y aparece follow.
- [ ] Caso: cuenta privada Chirp rechaza request y no hay follow.
- [ ] Caso: cancel request limpia estado en ambos perfiles.
- [ ] Caso: notificaciones deduplicadas (sin spam por reintentos).
- [ ] Caso: onboarding solo primer uso y luego no reaparece.
- [ ] Regresion: Snap live, stories autoplay, Clips short-video, emoji picker siguen OK.

## Commits planificados (1 feature = 1 commit)
- [ ] Commit A: social schema + migration base.
- [ ] Commit B: snap follow request backend completo.
- [ ] Commit C: chirp follow request backend completo.
- [ ] Commit D: social notifications backend + cleanup rule.
- [ ] Commit E: NUI bridge callbacks sociales.
- [ ] Commit F: Snap UI requests + estados follow.
- [ ] Commit G: Chirp UI requests + estados follow.
- [ ] Commit H: onboarding social unificado (shared component + wiring).
- [ ] Commit I: QA fixes y regresiones finales.
