# Cómo Crear una Nueva App

Esta guia te muestra como crear una nueva app siguiendo los estandares de GCPhone Next.

## Estructura de Archivos

```
web/src/components/apps/myapp/
├── MyApp.tsx           # Componente principal
├── MyApp.module.scss   # Estilos especificos (opcional)
└── index.ts            # Exports (opcional)
```

## Paso 1: Crear los Archivos

```bash
mkdir -p web/src/components/apps/myapp
touch web/src/components/apps/myapp/MyApp.tsx
touch web/src/components/apps/myapp/MyApp.module.scss
```

## Paso 2: Copiar el Template

Copia el contenido de `_template/TemplateApp.tsx` a tu nuevo archivo y personalízalo.

## Paso 3: Registrar la App

En `web/src/config/apps.ts`:

```typescript
export const APP_DEFINITIONS: AppDefinition[] = [
  // ... apps existentes
  { id: 'myapp', name: 'Mi App', icon: './img/icons_ios/myapp.svg', route: 'myapp', defaultHome: true },
];
```

## Paso 4: Agregar al Router

En `web/src/components/Phone/PhoneFrame.tsx`:

```typescript
import { MyApp } from '../apps/myapp/MyApp';

// En renderRoute():
if (route === 'myapp') return <MyApp />;
```

## Componentes de Layout Disponibles

### AppLayout
Contenedor raíz de cualquier app.

```tsx
<AppLayout>
  {children}
</AppLayout>
```

### AppHeader
Header con navegación iOS.

```tsx
<AppHeader
  title="Mi App"
  subtitle="Opcional"
  onBack={() => console.log('back')}  // Opcional, default: router.goBack()
  backIcon="‹"                        // Opcional
  action={{ icon: '+', onClick: handleAdd }}  // Botón derecha
/>
```

### AppBody
Área de contenido principal con scroll.

```tsx
<AppBody padding="md">  // 'none' | 'sm' | 'md'
  {children}
</AppBody>
```

### AppFooter
Footer fijo para acciones/tabs.

```tsx
<AppFooter fixed>
  <AppTabs tabs={tabs} active={activeTab} onChange={setActiveTab} />
</AppFooter>
```

### AppFAB
Floating Action Button.

```tsx
<AppFAB onClick={handleAdd} icon="+" position="bottom-right" />
```

### AppTabs
Tabs de navegación.

```tsx
const tabs: TabItem[] = [
  { id: 'all', label: 'Todos', icon: './img/icons_ios/grid.svg', badge: 5 },
  { id: 'fav', label: 'Favoritos', icon: './img/icons_ios/star.svg' },
];

<AppTabs tabs={tabs} active={activeTab()} onChange={setActiveTab} />
```

## Hooks Disponibles

### usePhoneKeyHandler
Maneja las teclas del teléfono.

```tsx
usePhoneKeyHandler({
  Backspace: () => router.goBack(),
  ArrowUp: () => selectPrev(),
  ArrowDown: () => selectNext(),
  Enter: () => confirmSelection(),
});
```

### useAsyncData
Carga datos asíncronos con estados.

```tsx
const { data, loading, error, execute, reset } = useAsyncData(
  () => fetchNui('getMyData', undefined, []),
  { initialData: [], autoFetch: true }
);
```

### useMediaAttachment
Adjuntar multimedia (galería, cámara, URL).

```tsx
const { mediaUrl, mediaType, attachFromGallery, attachFromCamera, attachByUrl, clearAttachment } = useMediaAttachment();

// Usar con AttachmentSheet
<AttachmentSheet
  open={showAttach()}
  onClose={() => setShowAttach(false)}
  onGallery={attachFromGallery}
  onCamera={attachFromCamera}
  onUrl={attachByUrl}
  onRemove={clearAttachment}
  hasAttachment={!!mediaUrl()}
/>
```

### useListNavigation
Navegación con flechas en listas.

```tsx
const { selectedIndex, selectNext, selectPrev, confirmSelection } = useListNavigation(
  () => items(),
  { onSelect: (item, index) => console.log(item) }
);
```

## Componentes UI Disponibles

- `Modal` - Modal reutilizable
- `Avatar` - Avatar con inicial/color
- `MediaPreview` - Preview de imagen/video/audio
- `AttachmentSheet` - Sheet para adjuntar media
- `AppPlaceholder` - Skeleton de carga
- `ScreenState` - Estados de loading/empty/error
- `SkeletonList` - Lista skeleton de carga
- `ActionSheet` - Sheet de acciones

## Clases CSS iOS Disponibles

Usa estas clases para mantener consistencia:

- `.ios-page` - Contenedor de página
- `.ios-nav` - Navegación
- `.ios-content` - Área de contenido
- `.ios-list` - Lista con bordes
- `.ios-row` - Fila de lista
- `.ios-input` - Input estilizado
- `.ios-btn` - Botón
- `.ios-btn-primary` - Botón primario
- `.ios-btn-danger` - Botón de peligro
- `.ios-chip` - Chip/tag

## Ejemplo Completo

```tsx
import { createSignal, For, Show } from 'solid-js';
import { AppLayout, AppHeader, AppBody, AppFAB } from '@/components/shared/layout';
import { usePhoneKeyHandler } from '@/hooks/usePhoneKeyHandler';
import { useAsyncData } from '@/hooks/useAsyncData';
import { ScreenState } from '@/components/shared/ui/ScreenState';
import { SkeletonList } from '@/components/shared/ui/SkeletonList';
import { fetchNui } from '@/utils/fetchNui';

interface Note {
  id: number;
  title: string;
  content: string;
}

export function NotesApp() {
  usePhoneKeyHandler({}); // Backspace -> goBack por defecto

  const { data: notes, loading, execute: reload } = useAsyncData<Note[]>(
    () => fetchNui('getNotes', undefined, []),
    { initialData: [] }
  );

  return (
    <AppLayout>
      <AppHeader title="Notas" action={{ icon: '+', onClick: handleCreate }} />
      
      <AppBody>
        <Show when={loading()}>
          <SkeletonList rows={6} />
        </Show>
        
        <Show when={!loading()}>
          <ScreenState
            loading={false}
            empty={notes()?.length === 0}
            emptyTitle="Sin notas"
            emptyDescription="Toca + para crear una nota."
          >
            <For each={notes()}>
              {(note) => (
                <div class="ios-list">
                  <div class="ios-row">
                    <div class="ios-label">{note.title}</div>
                  </div>
                </div>
              )}
            </For>
          </ScreenState>
        </Show>
      </AppBody>
      
      <AppFAB onClick={handleCreate} />
    </AppLayout>
  );
}
```

## Tips

1. **Siempre usa `AppLayout`** como contenedor raíz
2. **Usa `usePhoneKeyHandler`** para manejar Backspace
3. **Usa `ScreenState`** para estados de loading/empty/error
4. **Prefiere clases iOS** (`ios-*`) sobre estilos custom
5. **Lazy load** para apps grandes (ver PhoneFrame)
