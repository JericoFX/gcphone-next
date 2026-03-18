# 📱 Guía: Cómo Agregar una Plantilla de App al GCPhone

## Paso a Paso para Crear una Nueva Aplicación

---

## 1️⃣ **Crear la estructura básica**

### Archivos necesarios:
```
web/src/components/apps/YourAppName/
├─ YourAppNameApp.tsx          # Componente principal
├─ YourAppNameApp.module.scss  # Estilos modularizados
└─ README.md                   # Documentación opcional
```

---

## 2️⃣ **Configurar el lazy loading en PhoneFrame**

### Editar `web/src/components/Phone/PhoneFrame.tsx`:

```tsx
// 1. Importar lazy
import { lazy } from 'solid-js';

// 2. Agregar al objeto lazyApps
const lazyApps = {
  // ... existing apps ...
  yourapp: lazy(() => import('../apps/yourapp/YourAppNameApp')),
};

// 3. Registrar en appDefinitions si es necesario
const APP_DEFINITIONS = {
  // ... existing ...
  yourapp: {
    id: 'yourapp',
    name: 'Your App Name',
    icon: './img/icons_ios/yourapp.svg',
    route: '/app/yourapp',
  },
};
```

---

## 3️⃣ **Crear el componente principal con AppScaffold**

### Pattern básico (`YourAppNameApp.tsx`):

```tsx
import { createSignal, createMemo, createEffect, onMount } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { AppScaffold, AppFAB } from '../../shared/layout';
import { usePhoneKeyHandler } from '../../../hooks/usePhoneKeyHandler';
import { t, appName } from '../../../i18n';
import styles from './YourAppNameApp.module.scss';

export function YourAppNameApp() {
  const router = useRouter();
  
  // Estado local
  const [loading, setLoading] = createSignal(false);
  const [data, setData] = createSignal<YourDataType[]>([]);
  
  // Derived state con createMemo (optimización SolidJS)
  const filteredData = createMemo(() => {
    const all = data() || [];
    return all.filter(item => item.active);
  });
  
  // Handler de teclas (Backspace para navegar)
  usePhoneKeyHandler({
    Backspace: () => {
      router.goBack();
    },
  });
  
  onMount(async () => {
    // Fetch inicial
    const response = await fetchNui('getYourAppData', {}, []);
    setData(response);
  });
  
  return (
    <AppScaffold
      title={appName('yourapp')}
      onBack={() => router.goBack()}
    >
      <div class={styles.container}>
        {/* Your UI here */}
        <For each={filteredData()}>
          {(item) => <div class={styles.item}>{item.name}</div>}
        </For>
      </div>
      
      {/* Optional: Floating Action Button */}
      <AppFAB
        icon="./img/icons_ios/add.svg"
        onClick={() => {/* action */}}
        tooltip="Add new"
      />
    </AppScaffold>
  );
}
```

---

## 4️⃣ **SCSS Module pattern (iOS 18 Design System)**

### Pattern básico (`YourAppNameApp.module.scss`):

```scss
// ✅ USAR variables de _ios-system.scss
// ✅ NO usar backdrop-filter: blur()
// ✅ USAR noise texture para material effects

.container {
  display: flex;
  flex-direction: column;
  padding: var(--s-4);
  gap: var(--s-3);
}

.item {
  min-height: 48px;
  padding: var(--space-3);
  border-radius: var(--r-lg);
  background: var(--surface);
  border: 1px solid var(--border);
  
  // Material effect con noise (sin blur)
  &.material {
    background: color-mix(in srgb, var(--surface) 84%, transparent);
    background-image: url('/img/noise-texture.png');
    background-repeat: repeat;
    background-blend-mode: overlay;
  }
}
```

---

## 5️⃣ **Hooks personalizados (opcionales)**

### Si necesitas lógica reusable:

```ts
// web/src/hooks/useYourAppLogic.ts
import { createSignal, createMemo, createEffect } from 'solid-js';

export function useYourAppLogic() {
  const [state, setState] = createSignal<YourState>({ ... });
  
  const derivedData = createMemo(() => {
    // Optimización con memo
    return state().items.filter(...);
  });
  
  createEffect(() => {
    // Side effect cuando state cambia
  });
  
  return { state, derivedData, setState };
}
```

---

## 6️⃣ **Store pattern (si necesita estado global)**

### Si la app necesita compartir estado:

```tsx
// web/src/store/yourapp.tsx
import { createStore, createContext, createMemo } from 'solid-js';

interface YourAppState {
  items: YourItemType[];
  selectedId: string | null;
}

const [state, setState] = createStore<YourAppState>({ ... });

export const YourAppContext = createContext<YourAppState>(state);

export function useYourApp() {
  const context = useContext(YourAppContext);
  return context;
}
```

---

## 7️⃣ **Icono de la app**

### Agregar icono en:
```
web/src/img/icons_ios/yourapp.svg
```

### Referencia en `APP_DEFINITIONS`:
```ts
icon: './img/icons_ios/yourapp.svg',
```

---

## 8️⃣ **Registro en HomeScreen (opcional)**

### Si la app aparece en home:

```tsx
// web/src/components/apps/home/HomeScreen.tsx
const homeApps = createMemo(() => {
  const all = APP_DEFINITIONS;
  return [
    // ... existing ...
    all.yourapp,
  ];
});
```

---

## 9️⃣ **i18n (traducción)**

### Agregar en `web/src/i18n/apps.ts`:

```ts
export const APP_NAMES = {
  // ... existing ...
  yourapp: 'Your App Name',
};
```

---

## 🔟 **Testing básico**

### Smoke test:
```tsx
// 1. Verificar que la app se renderiza
<Show when={currentRoute() === '/app/yourapp'}>
  <YourAppNameApp />
</Show>

// 2. Verificar back navigation
usePhoneKeyHandler({
  Backspace: () => router.goBack(), // ✅ works
});

// 3. Verificar datos cargan
onMount(async () => {
  const data = await fetchNui('getYourAppData', {}, []);
  setData(data); // ✅ data loaded
});
```

---

## 📋 **Best Practices Checklist**

✅ **SolidJS Performance:**
- Usar `createMemo` para derivaciones computacionales
- Usar `createSelector` para selección activa (tabs, listas)
- Usar `batch` para updates múltiples
- Usar `onCleanup` para liberar recursos

✅ **SCSS iOS 18:**
- Usar variables `--s-*`, `--r-*`, `--fs-*`
- NO usar `backdrop-filter: blur()`
- Usar `color-mix()` + noise texture para material effects
- CSS Modules para scope local

✅ **Hooks reusable:**
- Extraer lógica complecida a `hooks/useYourAppLogic.ts`
- Usar `useAsyncResource` para fetching
- Usar `useCreateSelector` para selección

✅ **Componentes shared:**
- Usar `AppScaffold`, `AppFAB`, `AppTabs` de `shared/layout`
- Usar `VirtualList`, `Modal`, `EmptyState` de `shared/ui`
- Usar `SegmentedControl` para tabs

---

## 🎯 **Ejemplo Completo: ClipsApp**

```tsx
// web/src/components/apps/clips/ClipsApp.tsx
import { For, Show, createMemo, createSignal, onMount } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { AppScaffold } from '../../shared/layout';
import { usePhoneKeyHandler } from '../../../hooks/usePhoneKeyHandler';
import { VirtualList } from '../../shared/ui/VirtualList';
import styles from './ClipsApp.module.scss';

export function ClipsApp() {
  const router = useRouter();
  const [clips, setClips] = createSignal<Clip[]>([]);
  const [selectedClip, setSelectedClip] = createSignal<Clip | null>(null);
  
  // Optimización con createMemo
  const trendingClips = createMemo(() => {
    const all = clips() || [];
    return all.filter(c => c.views > 1000).slice(0, 10);
  });
  
  usePhoneKeyHandler({
    Backspace: () => router.goBack(),
  });
  
  onMount(async () => {
    const response = await fetchNui('getClips', {}, []);
    setClips(response);
  });
  
  return (
    <AppScaffold title="Clips" onBack={() => router.goBack()}>
      <div class={styles.container}>
        <VirtualList
          items={trendingClips()}
          renderItem={(clip) => (
            <div class={styles.clipCard}>
              <img src={clip.thumbnail} />
              <strong>{clip.title}</strong>
            </div>
          )}
        />
      </div>
    </AppScaffold>
  );
}
```

---

## 📚 **Referencias**

- **SolidJS Docs:** https://www.solidjs.com
- **iOS 18 Design System:** `web/src/styles/_ios-system.scss`
- **Variables SCSS:** `web/src/styles/_variables.scss`
- **Hooks existentes:** `web/src/hooks/`
- **Componentes shared:** `web/src/components/shared/`

---

## 🔧 **Commands**

```bash
# Typecheck
bun run typecheck

# Build
bun run build

# Lint (si existe)
bun run lint
```

---

## ⚠️ **Common Pitfalls**

❌ **NO hacer:**
- Usar `backdrop-filter: blur()` → FiveM no lo soporta bien
- Mezlar clases globales `ios-*` con CSS Modules sin scope claro
- Hardcoded values → usar variables `--s-*`, `--r-*`
- Recalcular arrays en getters sin `createMemo`

✅ **Sí hacer:**
- Noise texture para material effects
- `createMemo` para derivaciones
- `createSelector` para selección activa
- `batch` para updates múltiples
- `onCleanup` para timers/listeners

---

**¿Listo para crear tu app?** 🚀