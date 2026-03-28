import { createSignal, For, Show } from 'solid-js';
import { usePhone } from '../../../store/phone';
import { useRouter } from '../../Phone/PhoneFrame';
import { useNotifications } from '../../../store/notifications';
import { APP_BY_ID, APP_DEFINITIONS } from '../../../config/apps';
import { appName, t } from '../../../i18n';
import type { Folder } from '../../../types/home';
import { PINNED_APP_IDS } from '../../../types/home';
import styles from './FolderModal.module.scss';

const ACCENT_COLORS = ['blue', 'purple', 'pink', 'red', 'orange', 'green', 'teal'];
const COLOR_HEX: Record<string, string> = {
  blue: '#007aff', purple: '#af52de', pink: '#ff2d55',
  red: '#ff3b30', orange: '#ff9500', green: '#34c759', teal: '#5ac8fa',
};

interface FolderModalProps {
  folder: Folder;
  language: () => string;
  onClose: () => void;
}

export function FolderModal(props: FolderModalProps) {
  const [state, phoneActions] = usePhone();
  const [, notifActions] = useNotifications();
  const router = useRouter();
  const [editMode, setEditMode] = createSignal(false);
  const [editName, setEditName] = createSignal(props.folder.name);
  const [editColor, setEditColor] = createSignal(props.folder.color);

  const folderApps = () => props.folder.apps.map((id) => APP_BY_ID[id]).filter(Boolean);

  const allApps = () =>
    APP_DEFINITIONS.filter(
      (app) => state.enabledApps.includes(app.id) && !PINNED_APP_IDS.includes(app.id as typeof PINNED_APP_IDS[number])
    );

  const isInFolder = (appId: string) => props.folder.apps.includes(appId);

  const openApp = (app: { id: string; route: string }) => {
    notifActions.markAppAsRead(app.id);
    props.onClose();
    router.navigate(app.route);
  };

  const toggleApp = (appId: string) => {
    if (isInFolder(appId)) {
      phoneActions.removeAppFromFolder(props.folder.id, appId);
    } else {
      phoneActions.addAppToFolder(props.folder.id, appId);
    }
  };

  const saveName = () => {
    const name = editName().trim();
    if (name && name !== props.folder.name) {
      phoneActions.updateFolder(props.folder.id, { name });
    }
  };

  const saveColor = (color: string) => {
    setEditColor(color);
    phoneActions.updateFolder(props.folder.id, { color });
  };

  const deleteFolder = () => {
    phoneActions.deleteFolder(props.folder.id);
    props.onClose();
  };

  return (
    <div class={styles.overlay} onClick={props.onClose}>
      <div class={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div class={styles.header}>
          <strong>{props.folder.name}</strong>
          <div class={styles.headerActions}>
            <button onClick={() => setEditMode((v) => !v)}>
              {editMode() ? t('home.done', props.language()) : t('home.edit', props.language())}
            </button>
            <button onClick={props.onClose}>{t('home.close', props.language())}</button>
          </div>
        </div>

        <Show when={!editMode()}>
          <div class={styles.grid}>
            <For each={folderApps()}>
              {(app) => (
                <button class={styles.folderApp} onClick={() => openApp(app)}>
                  <img src={app.icon} alt={appName(app.id, app.name, props.language())} />
                  <span>{appName(app.id, app.name, props.language())}</span>
                </button>
              )}
            </For>
          </div>
        </Show>

        <Show when={editMode()}>
          <div class={styles.editor}>
            <input class={styles.nameInput} type="text" value={editName()} placeholder="Folder name"
              onInput={(e) => setEditName(e.currentTarget.value)} onBlur={saveName} />
            <div class={styles.colorPicker}>
              <For each={ACCENT_COLORS}>
                {(color) => (
                  <button class={styles.colorSwatch} classList={{ [styles.active]: editColor() === color }}
                    style={{ background: COLOR_HEX[color] }} onClick={() => saveColor(color)} />
                )}
              </For>
            </div>
            <div class={styles.appList}>
              <For each={allApps()}>
                {(app) => (
                  <button class={styles.appListItem} onClick={() => toggleApp(app.id)}>
                    <img src={app.icon} alt={app.name} />
                    <span>{appName(app.id, app.name, props.language())}</span>
                    <span class={styles.check} classList={{ [styles.checked]: isInFolder(app.id) }}>
                      {isInFolder(app.id) ? '✓' : ''}
                    </span>
                  </button>
                )}
              </For>
            </div>
            <button class={styles.deleteBtn} onClick={deleteFolder}>
              {t('home.delete_folder', props.language()) || 'Delete Folder'}
            </button>
          </div>
        </Show>
      </div>
    </div>
  );
}
