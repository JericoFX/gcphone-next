# Regression QA - Social + Audio

Fecha: _actualizar en cada corrida_
Branch/commit: _anotar hash_
Tester: _anotar nombre_

## 1) Alcance

Este checklist cubre lo que mas se rompe cuando tocamos social y audio:

- Onboarding social compartido (Snap/Chirp/Clips/News)
- Follow requests (Snap + Chirp)
- Perfil social y estado privado/publico
- Notificaciones sociales basicas
- Audio live (LiveKit + proximidad + fallback)

## 2) Entorno de prueba

- Build frontend: `bun run build`
- Typecheck frontend: `bun run typecheck`
- Resource iniciado con dependencias (`ox_lib`, `oxmysql`, `qb-core`)
- Minimo 2 jugadores conectados para escenarios live/follow

## 3) Matriz (resultado)

Usar:

- `PASS`: cumple esperado
- `FAIL`: no cumple
- `NR`: no corrido

| Area | Caso | Estado | Evidencia / nota |
|---|---|---|---|
| Build | `bun run typecheck` | PASS | Ejecutado localmente |
| Build | `bun run build` | PASS | Ejecutado localmente |
| Onboarding | Snap abre modal en primer uso | NR | |
| Onboarding | Chirp abre modal en primer uso | NR | |
| Onboarding | Clips usa onboarding Snap compartido | NR | |
| Onboarding | News usa onboarding Snap compartido | NR | |
| Onboarding | Campos guardan username/display/avatar/bio/private | NR | |
| Snap | Solicitud follow privada se crea | NR | |
| Snap | Owner acepta solicitud y se refleja estado | NR | |
| Snap | Rechazar solicitud limpia listas | NR | |
| Snap | Cancelar solicitud enviada funciona | NR | |
| Chirp | Solicitud follow privada se crea | NR | |
| Chirp | Aceptar/rechazar/cancelar actualiza UI | NR | |
| Chirp | Toggle perfil privado/publico persiste | NR | |
| Social | Perfil actualizado se refleja entre apps | NR | |
| Social | Sin duplicados raros en notifications | NR | |
| Audio | Escenario 1: LiveKit base sin proximidad | NR | Ver `docs/qa/snap-live-audio-smoke.md` |
| Audio | Escenario 2: LiveKit + proximidad | NR | Ver `docs/qa/snap-live-audio-smoke.md` |
| Audio | Escenario 3: fallback/degradacion | NR | Ver `docs/qa/snap-live-audio-smoke.md` |
| Audio | Escenario 4: moderacion owner | NR | Ver `docs/qa/snap-live-audio-smoke.md` |

## 4) Pasos sugeridos (resumen)

### 4.1 Social

1. Crear dos cuentas (A y B).
2. Poner A en privado.
3. Desde B: follow a A.
4. En A: aceptar/rechazar desde modal de solicitudes.
5. Repetir en Chirp.
6. Editar perfil (display/avatar/bio/private) y validar reflejo en apps que comparten cuenta.

### 4.2 Audio

Seguir `docs/qa/snap-live-audio-smoke.md` completo.

## 5) Criterio de cierre de release

- Sin `FAIL` en filas Build.
- Sin `FAIL` en onboarding/follow requests de Snap y Chirp.
- Sin `FAIL` en escenarios 1/2/3 de audio.
- Si hay `NR`, no cerrar release hasta correrlo o dejar excepcion documentada.
