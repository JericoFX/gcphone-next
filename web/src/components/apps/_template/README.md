# App Template

Copia esta carpeta para crear una nueva app.

## Pasos

1. Copia `_template/` a `tu-app/`
2. Renombra `TemplateApp` a `TuApp` en todos los archivos
3. Renombra `TemplateItem` y `TemplateDetail` segun tu dominio
4. Registra la app en `config/apps.ts` (agrega un `AppDefinition`)
5. Agrega el lazy import en `Phone/PhoneFrame.tsx`:
   ```ts
   tuapp: lazy(() => import('../apps/tu-app/TuApp').then(m => ({ default: m.TuApp }))),
   ```
6. Agrega server callback en `server/modules/tu-app.lua`
7. Agrega NUI callback en `client/nui_bridge.lua`

## Que incluye

- `TemplateApp.tsx` — AppView + createAppLoader + createAppStore + tabs + modal
- `components/TemplateDetail.tsx` — Sub-componente con props y Modal
- `TemplateApp.module.scss` — Estilos con SCSS modules

## Utilidades disponibles

- `createAppLoader(fetchFn, opts)` — Carga datos con loading/error/refetch/mutate
- `createAppStore(initial, actionsFactory)` — Estado local tipado con acciones
- `useNuiCallback(event, handler)` — Escuchar eventos NUI con cleanup automatico
- `<AppView>` — Layout completo: scaffold + tabs + loading/empty/error automaticos
- `<AppScaffold>` — Layout manual: header + body + footer (sin manejo de estados)
- `<Modal>` — Modal animado con `ModalActions`, `ModalButton`, `FormField`
- `<AppFAB>` — Floating Action Button
- `<ScreenState>` — Estados de loading/empty/error
- `fetchNui(event, data, mockData)` — Llamada NUI con mock para desarrollo en browser

## Documentacion completa

Ver `docs/dev/` para la guia completa de desarrollo.
