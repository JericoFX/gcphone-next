import { For, Show, createMemo, createSignal } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchNui } from '../../../utils/fetchNui';
import { isEnvBrowser } from '../../../utils/misc';
import { usePhoneKeyHandler } from '../../../hooks/usePhoneKeyHandler';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { useContextMenu } from '../../../hooks/useContextMenu';
import { useSDK } from '../../../store/sdk';
import { AppScaffold } from '../../shared/layout';
import { ScreenState } from '../../shared/ui/ScreenState';
import { ActionSheet } from '../../shared/ui/ActionSheet';
import { sanitizeText } from '../../../utils/sanitize';
import styles from './DirectorioApp.module.scss';

interface ShortcutItem {
  id: string;
  title: string;
  icon?: string;
  category: string;
  description?: string;
  resourceName?: string;
}

const CATEGORIES: Record<string, { label: string; icon: string; order: number }> = {
  food: { label: 'Comida', icon: '\u{1F354}', order: 1 },
  services: { label: 'Servicios', icon: '\u{1F527}', order: 2 },
  garage: { label: 'Vehiculos', icon: '\u{1F697}', order: 3 },
  shop: { label: 'Tiendas', icon: '\u{1F6CD}\uFE0F', order: 4 },
  entertainment: { label: 'Entretenimiento', icon: '\u{1F3AE}', order: 5 },
  other: { label: 'Otros', icon: '\u{1F4F1}', order: 6 },
};

function getCategoryMeta(cat: string) {
  return CATEGORIES[cat] || CATEGORIES.other;
}

export function DirectorioApp() {
  const router = useRouter();
  const [, sdkActions] = useSDK();
  const { data: shortcuts, loading, setData: setShortcuts } = useAsyncData(
    () => fetchNui<ShortcutItem[]>('sdkGetShortcuts', {}, []),
    { initialData: [] as ShortcutItem[] },
  );
  const ctxMenu = useContextMenu<ShortcutItem>();
  const [blockingId, setBlockingId] = createSignal<string | null>(null);

  usePhoneKeyHandler({
    Backspace: () => {
      router.goBack();
    },
  }, { routeId: 'directorio' });

  const grouped = createMemo(() => {
    const items = shortcuts();
    const groups = new Map<string, ShortcutItem[]>();

    for (const item of items) {
      const cat = CATEGORIES[item.category] ? item.category : 'other';
      const list = groups.get(cat);
      if (list) {
        list.push(item);
      } else {
        groups.set(cat, [item]);
      }
    }

    return Array.from(groups.entries())
      .map(([cat, items]) => ({
        category: cat,
        meta: getCategoryMeta(cat),
        items,
      }))
      .sort((a, b) => a.meta.order - b.meta.order);
  });

  const openShortcut = async (item: ShortcutItem) => {
    if (isEnvBrowser()) {
      const def = await fetchNui<any>('sdkGetShortcutDefinition', { appId: item.id });
      if (def) {
        sdkActions.openModal({
          requestId: 'shortcut_' + Date.now(),
          mode: 'registered',
          title: def.title || item.title,
          icon: def.icon || item.icon,
          resourceName: def.resourceName || item.resourceName,
          views: def.views,
          startView: def.startView || 'main',
        });
      }
    } else {
      await fetchNui('sdkOpenShortcut', { appId: item.id });
    }
  };

  const blockApp = async (item: ShortcutItem) => {
    setBlockingId(item.id);
    await fetchNui('sdkBlockApp', { appId: item.id });
    setShortcuts((prev) => prev.filter((s) => s.id !== item.id));
    setBlockingId(null);
  };

  return (
    <AppScaffold title="Directorio" onBack={() => router.goBack()}>
      <ScreenState
        loading={loading()}
        empty={shortcuts().length === 0}
        emptyTitle="No hay apps disponibles"
        emptyDescription="Las apps de terceros apareceran aqui."
      >
        <div class={styles.list}>
          <For each={grouped()}>
            {(group) => (
              <section class={styles.section}>
                <div class={styles.sectionHeader}>
                  <span class={styles.sectionIcon}>{group.meta.icon}</span>
                  <span class={styles.sectionLabel}>{group.meta.label}</span>
                </div>
                <div class={styles.sectionItems}>
                  <For each={group.items}>
                    {(item) => (
                      <button
                        type="button"
                        class={styles.item}
                        disabled={blockingId() === item.id}
                        onClick={() => openShortcut(item)}
                        onContextMenu={ctxMenu.onContextMenu(item)}
                      >
                        <span class={styles.itemIcon}>{item.icon || getCategoryMeta(item.category).icon}</span>
                        <div class={styles.itemBody}>
                          <span class={styles.itemTitle}>{sanitizeText(item.title, 40)}</span>
                          <Show when={item.description}>
                            <span class={styles.itemDesc}>{sanitizeText(item.description || '', 120)}</span>
                          </Show>
                        </div>
                        <Show when={item.resourceName}>
                          <span class={styles.resourceBadge}>{item.resourceName}</span>
                        </Show>
                      </button>
                    )}
                  </For>
                </div>
              </section>
            )}
          </For>
        </div>
      </ScreenState>

      <ActionSheet
        open={ctxMenu.isOpen()}
        title={ctxMenu.item()?.title || 'Servicio'}
        onClose={ctxMenu.close}
        actions={[
          {
            label: 'Eliminar app',
            tone: 'danger',
            onClick: () => {
              const item = ctxMenu.item();
              if (item) void blockApp(item);
              ctxMenu.close();
            },
          },
        ]}
      />
    </AppScaffold>
  );
}
