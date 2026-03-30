import { For, Show } from 'solid-js';
import { AppView } from '@/components/shared/layout/AppView';
import { AppFAB } from '@/components/shared/layout/AppLayout';
import { ScreenState } from '@/components/shared/ui/ScreenState';
import { Modal, ModalActions, ModalButton, FormField } from '@/components/shared/ui/Modal';
import { createAppLoader } from '@/hooks/createAppLoader';
import { createAppStore } from '@/hooks/createAppStore';
import { useNuiCallback } from '@/hooks/useNuiCallback';
import { fetchNui } from '@/utils/fetchNui';
import { TemplateDetail } from './components/TemplateDetail';
import type { TabItem } from '@/components/shared/layout/AppLayout';
import styles from './TemplateApp.module.scss';

interface TemplateItem {
  id: number;
  title: string;
  description: string;
  favorite: boolean;
  createdAt: string;
}

type TabId = 'all' | 'favorites';

const TABS: TabItem[] = [
  { id: 'all', label: 'All', icon: './img/icons_ios/grid.svg' },
  { id: 'favorites', label: 'Favorites', icon: './img/icons_ios/star-fill.svg' },
];

export function TemplateApp() {
  const items = createAppLoader<TemplateItem[]>(
    () => fetchNui<TemplateItem[]>('templateGetItems', {}, []),
    { initialData: [] },
  );

  const [state, actions] = createAppStore(
    {
      tab: 'all' as TabId,
      selectedId: null as number | null,
      showCreate: false,
      newTitle: '',
    },
    (_state, setState) => ({
      setTab: (tab: TabId) => setState('tab', tab),
      select: (id: number) => setState('selectedId', id),
      clearSelection: () => setState('selectedId', null),
      openCreate: () => setState('showCreate', true),
      closeCreate: () => {
        setState('showCreate', false);
        setState('newTitle', '');
      },
      setNewTitle: (v: string) => setState('newTitle', v),
    }),
  );

  useNuiCallback<TemplateItem>('templateItemUpdated', (item) => {
    items.mutate((prev) => prev.map((i) => (i.id === item.id ? item : i)));
  });

  const filteredItems = () => {
    const list = items.data();
    return state.tab === 'favorites' ? list.filter((i) => i.favorite) : list;
  };

  const selectedItem = () =>
    items.data().find((i) => i.id === state.selectedId) ?? null;

  const handleCreate = async () => {
    const title = state.newTitle.trim();
    if (!title) return;
    await fetchNui('templateCreateItem', { title });
    actions.closeCreate();
    items.refetch();
  };

  return (
    <>
      <AppView<TemplateItem[]>
        title="Template"
        action={{ icon: '+', onClick: actions.openCreate, label: 'New item' }}
        tabs={{
          items: TABS,
          active: state.tab,
          onChange: (id) => actions.setTab(id as TabId),
        }}
        loader={items}
        emptyTitle="No items yet"
        emptyDescription="Tap + to create your first item."
      >
        {() => (
          <For
            each={filteredItems()}
            fallback={
              <ScreenState loading={false} empty emptyTitle="No matches" emptyDescription="Try the other tab.">
                {null}
              </ScreenState>
            }
          >
            {(item) => (
              <div class={styles.item} onClick={() => actions.select(item.id)}>
                <div class={styles.itemTitle}>{item.title}</div>
                <div class={styles.itemDesc}>{item.description}</div>
              </div>
            )}
          </For>
        )}
      </AppView>

      <AppFAB onClick={actions.openCreate} />

      <Show when={selectedItem()}>
        {(item) => (
          <TemplateDetail item={item()} onClose={actions.clearSelection} />
        )}
      </Show>

      <Modal open={state.showCreate} title="New Item" onClose={actions.closeCreate} size="sm">
        <FormField
          label="Title"
          value={state.newTitle}
          onChange={actions.setNewTitle}
          placeholder="Enter a title"
        />
        <ModalActions>
          <ModalButton label="Cancel" onClick={actions.closeCreate} />
          <ModalButton label="Save" onClick={handleCreate} tone="primary" disabled={!state.newTitle.trim()} />
        </ModalActions>
      </Modal>
    </>
  );
}
