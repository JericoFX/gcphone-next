import { createMemo, For, Show } from 'solid-js';
import { usePhone } from '../../../store/phone';
import { useNotifications } from '../../../store/notifications';
import { useRouter } from '../../Phone/PhoneFrame';
import { APP_BY_ID } from '../../../config/apps';
import { AppIcon } from './AppIcon';
import { FolderIcon } from './FolderIcon';
import { useIconDrag } from './hooks/useIconDrag';
import type { Folder, AllowedFolderColor } from '../../../types/home';
import { PINNED_APP_IDS } from '../../../types/home';
import styles from './AppGrid.module.scss';

const GHOST_COLOR_CLASS: Record<AllowedFolderColor, string> = {
  blue: styles.colorBlue,
  purple: styles.colorPurple,
  pink: styles.colorPink,
  red: styles.colorRed,
  orange: styles.colorOrange,
  green: styles.colorGreen,
  teal: styles.colorTeal,
  gray: styles.colorGray,
};

interface AppGridProps {
  items: () => string[];
  editing: boolean;
  language: () => string;
  frameRef: () => HTMLElement | undefined;
  onOpenFolder: (folder: Folder, originEl: HTMLElement) => void;
  onPageEdge: (direction: 'left' | 'right') => void;
  onFolderCreated: (folderId: string) => void;
}

export function AppGrid(props: AppGridProps) {
  const [state, phoneActions] = usePhone();
  const [, notifActions] = useNotifications();
  const router = useRouter();
  let gridRef: HTMLDivElement | undefined;

  const folders = createMemo(() => {
    const folderList = state.appLayout.folders || [];
    const map = new Map<string, Folder>();
    for (const f of folderList) map.set(`folder:${f.id}`, f);
    return map;
  });

  const isFolder = (itemId: string) => itemId.startsWith('folder:');
  const isPinned = (itemId: string) =>
    !itemId.startsWith('folder:') && PINNED_APP_IDS.includes(itemId as typeof PINNED_APP_IDS[number]);

  const drag = useIconDrag({
    editing: () => props.editing,
    items: props.items,
    gridRef: () => gridRef,
    frameRef: props.frameRef,
    isPinned,
    isFolder,
    onReorder: (itemId, targetIndex) => {
      phoneActions.reorderApp('home', itemId, targetIndex);
    },
    onMergeCreateFolder: (draggedId, targetId) => {
      const folderId = phoneActions.mergeTwoAppsIntoFolder(draggedId, targetId);
      if (folderId) props.onFolderCreated(folderId);
    },
    onAddAppToFolder: (draggedId, folderRef) => {
      const folderId = folderRef.slice('folder:'.length);
      phoneActions.addAppToFolder(folderId, draggedId);
    },
    onPageEdge: props.onPageEdge,
  });

  const openApp = (app: { id: string; route: string }) => {
    if (props.editing) return;
    notifActions.markAppAsRead(app.id);
    router.navigate(app.route);
  };

  const dragPreviewApp = createMemo(() => {
    const ds = drag.dragState();
    if (!ds || ds.itemId.startsWith('folder:')) return null;
    return APP_BY_ID[ds.itemId] ?? null;
  });

  const dragPreviewFolder = createMemo(() => {
    const ds = drag.dragState();
    if (!ds || !ds.itemId.startsWith('folder:')) return null;
    return folders().get(ds.itemId) ?? null;
  });

  return (
    <>
      <div
        ref={gridRef}
        class={styles.grid}
        onPointerMove={drag.handlers.onPointerMove}
        onPointerUp={drag.handlers.onPointerUp}
        onPointerCancel={drag.handlers.onPointerCancel}
      >
        <For each={props.items()}>
          {(itemId, index) => {
            const folder = () => folders().get(itemId);
            const app = () => !folder() ? APP_BY_ID[itemId] : null;

            return (
              <div
                class={styles.slot}
                classList={{
                  [styles.dropTarget]: drag.hoverIndex() === index() && !drag.mergeTarget(),
                  [styles.mergeTarget]: drag.mergeTarget() === itemId,
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
                      onClick={(el) => props.onOpenFolder(f(), el)}
                      onPointerDown={(e) => drag.handlers.onPointerDown(itemId, e)}
                    />
                  )}
                </Show>
              </div>
            );
          }}
        </For>
      </div>

      <Show when={drag.dragState()}>
        {(ds) => (
          <div
            class={styles.ghost}
            style={{
              left: `${ds().x}px`,
              top: `${ds().y}px`,
              width: `${ds().width}px`,
              height: `${ds().height}px`,
            }}
          >
            <Show when={dragPreviewApp()}>
              {(app) => (
                <div class={styles.ghostInner}>
                  <img src={app().icon} alt="" draggable={false} />
                </div>
              )}
            </Show>
            <Show when={dragPreviewFolder()}>
              {(f) => (
                <div class={styles.ghostInner} classList={{ [GHOST_COLOR_CLASS[f().color]]: true }}>
                  <div class={styles.ghostFolder}>
                    <For each={f().apps.slice(0, 4)}>
                      {(appId) => {
                        const a = APP_BY_ID[appId];
                        return a ? <img src={a.icon} alt="" draggable={false} /> : <span />;
                      }}
                    </For>
                  </div>
                </div>
              )}
            </Show>
          </div>
        )}
      </Show>
    </>
  );
}
