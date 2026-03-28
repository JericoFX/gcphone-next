import { createMemo, For, Show } from 'solid-js';
import { usePhone } from '../../../store/phone';
import { useNotifications } from '../../../store/notifications';
import { useRouter } from '../../Phone/PhoneFrame';
import { APP_BY_ID } from '../../../config/apps';
import { AppIcon } from './AppIcon';
import { FolderIcon } from './FolderIcon';
import { useDragAndDrop } from './hooks/useDragAndDrop';
import type { Folder } from '../../../types/home';
import styles from './AppGrid.module.scss';

interface AppGridProps {
  items: () => string[];
  editing: boolean;
  language: () => string;
  onOpenFolder: (folder: Folder) => void;
  onPageEdge: (direction: 'left' | 'right') => void;
  onFolderCreated: (folderId: string) => void;
}

export function AppGrid(props: AppGridProps) {
  const [state, phoneActions] = usePhone();
  const [, notifActions] = useNotifications();
  const router = useRouter();
  let gridRef: HTMLDivElement | undefined;

  const drag = useDragAndDrop({
    items: props.items,
    gridRef: () => gridRef,
    onReorder: (itemId, targetIndex) => {
      phoneActions.reorderApp('home', itemId, targetIndex);
    },
    onFolderMerge: (draggedId, targetId) => {
      const folderId = phoneActions.mergeTwoAppsIntoFolder(draggedId, targetId);
      if (folderId) props.onFolderCreated(folderId);
    },
    onPageEdge: props.onPageEdge,
  });

  const folders = createMemo(() => {
    const folderList = state.appLayout.folders || [];
    const map = new Map<string, Folder>();
    for (const f of folderList) map.set(`folder:${f.id}`, f);
    return map;
  });

  const openApp = (app: { id: string; route: string }) => {
    if (props.editing) return;
    notifActions.markAppAsRead(app.id);
    router.navigate(app.route);
  };

  return (
    <div
      ref={gridRef}
      class={styles.grid}
      onPointerMove={drag.handlers.onPointerMove}
      onPointerUp={drag.handlers.onPointerUp}
    >
      <For each={props.items()}>
        {(itemId, index) => {
          const folder = () => folders().get(itemId);
          const app = () => !folder() ? APP_BY_ID[itemId] : null;

          return (
            <div
              class={styles.slot}
              classList={{
                [styles['drop-target']]: drag.hoverIndex() === index() && !drag.mergeTarget(),
                [styles['merge-target']]: drag.mergeTarget() === itemId,
              }}
              data-grid-item={itemId}
            >
              <Show when={folder()} fallback={
                <Show when={app()}>
                  {(appDef) => (
                    <AppIcon
                      id={appDef().id}
                      name={appDef().name}
                      icon={appDef().icon}
                      editing={props.editing}
                      dragging={drag.dragId() === itemId}
                      language={props.language}
                      badgeCount={notifActions.getUnreadCount(appDef().id)}
                      onClick={() => openApp(appDef())}
                      onPointerDown={(e) => drag.handlers.onPointerDown(itemId, e)}
                    />
                  )}
                </Show>
              }>
                {(f) => (
                  <FolderIcon
                    folder={f()}
                    editing={props.editing}
                    dragging={drag.dragId() === itemId}
                    onClick={() => props.onOpenFolder(f())}
                    onPointerDown={(e) => drag.handlers.onPointerDown(itemId, e)}
                  />
                )}
              </Show>
            </div>
          );
        }}
      </For>
    </div>
  );
}
