import { createSignal, For, Show } from 'solid-js';
import { AppScaffold, AppFAB, AppTabs } from '@/components/shared/layout';
import { usePhoneKeyHandler } from '@/hooks/usePhoneKeyHandler';
import { useAsyncData } from '@/hooks/useAsyncData';
import { ScreenState } from '@/components/shared/ui/ScreenState';
import { SkeletonList } from '@/components/shared/ui/SkeletonList';
import { Avatar } from '@/components/shared/ui/Avatar';
import { fetchNui } from '@/utils/fetchNui';
import type { TabItem } from '@/components/shared/layout';

interface TemplateItem {
  id: number;
  name: string;
  description?: string;
}

export function TemplateApp() {
  const [activeTab, setActiveTab] = createSignal('all');
  const [showModal, setShowModal] = createSignal(false);
  const [newItemName, setNewItemName] = createSignal('');

  usePhoneKeyHandler({
    Backspace: () => {
    },
  });

  const { data: items, loading, error, execute: reload } = useAsyncData<TemplateItem[]>(
    () => fetchNui('getTemplateItems', undefined, []),
    { initialData: [] }
  );

  const tabs: TabItem[] = [
    { id: 'all', label: 'Todos', icon: './img/icons_ios/grid.svg' },
    { id: 'favorites', label: 'Favoritos', icon: './img/icons_ios/star-fill.svg' },
  ];

  const filteredItems = () => {
    const all = items() || [];
    if (activeTab() === 'favorites') {
      return all.slice(0, 2);
    }
    return all;
  };

  const handleCreate = async () => {
    if (!newItemName().trim()) return;
    await fetchNui('createTemplateItem', { name: newItemName() });
    setNewItemName('');
    setShowModal(false);
    reload();
  };

  return (
    <AppScaffold
      title="Template App"
      action={{ icon: '+', onClick: () => setShowModal(true) }}
      footer={tabs.length > 1 ? <AppTabs tabs={tabs} active={activeTab()} onChange={setActiveTab} /> : undefined}
      footerFixed
    >
        <Show when={loading()}>
          <SkeletonList rows={6} avatar />
        </Show>

        <Show when={!loading() && error()}>
          <ScreenState loading={false} error={error()?.message} empty={false}>
            {null}
          </ScreenState>
        </Show>

        <Show when={!loading() && !error()}>
          <ScreenState
            loading={false}
            empty={filteredItems().length === 0}
            emptyTitle="Sin items"
            emptyDescription="Toca + para agregar un nuevo item."
          >
            <For each={filteredItems()}>
              {(item) => (
                <div class="ios-list">
                  <div class="ios-row">
                    <Avatar identifier={item.name.toString()} display={item.name} />
                    <div class="ios-label">{item.name}</div>
                    <Show when={item.description}>
                      <div class="ios-value">{item.description}</div>
                    </Show>
                  </div>
                </div>
              )}
            </For>
          </ScreenState>
        </Show>
      <AppFAB onClick={() => setShowModal(true)} />

      <Show when={showModal()}>
        <div class={modalStyles.overlay} onClick={() => setShowModal(false)}>
          <div class={modalStyles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 class={modalStyles.title}>Nuevo Item</h2>
            <div class={modalStyles.content}>
              <label class={modalStyles.label}>Nombre</label>
              <input
                class="ios-input"
                type="text"
                value={newItemName()}
                onInput={(e) => setNewItemName(e.currentTarget.value)}
                placeholder="Ingresa el nombre"
              />
            </div>
            <div class={modalStyles.actions}>
              <button class="ios-btn" onClick={() => setShowModal(false)}>
                Cancelar
              </button>
              <button class="ios-btn ios-btn-primary" onClick={handleCreate}>
                Guardar
              </button>
            </div>
          </div>
        </div>
      </Show>
    </AppScaffold>
  );
}

const modalStyles = {
  overlay: 'fixed inset-0 bg-black/50 flex items-center justify-center z-50',
  modal: 'bg-[var(--surface)] rounded-2xl p-4 w-[90%] max-w-[280px]',
  title: 'text-lg font-bold text-center mb-4',
  content: 'mb-4',
  label: 'block text-xs font-semibold text-[var(--text-3)] mb-2',
  actions: 'flex gap-3',
};
