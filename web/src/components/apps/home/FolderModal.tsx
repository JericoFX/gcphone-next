import { createMemo, createSignal, For, Show, onMount } from 'solid-js';
import { Motion, Presence } from '@motionone/solid';
import { usePhone } from '../../../store/phone';
import { useRouter } from '../../Phone/PhoneFrame';
import { useNotifications } from '../../../store/notifications';
import { APP_BY_ID } from '../../../config/apps';
import { appName, t } from '../../../i18n';
import type { Folder, AllowedFolderColor } from '../../../types/home';
import {
  ALLOWED_FOLDER_COLORS,
  FOLDER_NAME_MAX,
  FOLDER_NAME_RE,
} from '../../../types/home';
import styles from './FolderModal.module.scss';

interface OriginRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface FolderModalProps {
  folder: Folder;
  language: () => string;
  originRect?: OriginRect | null;
  containerRef?: () => HTMLElement | undefined;
  onClose: () => void;
}

const PANEL_COLOR_CLASS: Record<AllowedFolderColor, string> = {
  blue: styles.colorBlue,
  purple: styles.colorPurple,
  pink: styles.colorPink,
  red: styles.colorRed,
  orange: styles.colorOrange,
  green: styles.colorGreen,
  teal: styles.colorTeal,
  gray: styles.colorGray,
};

const SWATCH_COLOR_CLASS: Record<AllowedFolderColor, string> = {
  blue: styles.swatchBlue,
  purple: styles.swatchPurple,
  pink: styles.swatchPink,
  red: styles.swatchRed,
  orange: styles.swatchOrange,
  green: styles.swatchGreen,
  teal: styles.swatchTeal,
  gray: styles.swatchGray,
};

export function FolderModal(props: FolderModalProps) {
  const [, phoneActions] = usePhone();
  const [, notifActions] = useNotifications();
  const router = useRouter();
  const [editMode, setEditMode] = createSignal(false);
  const [nameDraft, setNameDraft] = createSignal(props.folder.name);
  const [nameError, setNameError] = createSignal(false);

  const folderApps = () => props.folder.apps.map((id) => APP_BY_ID[id]).filter(Boolean);

  const openApp = (app: { id: string; route: string }) => {
    if (editMode()) return;
    notifActions.markAppAsRead(app.id);
    props.onClose();
    router.navigate(app.route);
  };

  const sanitizeInput = (raw: string) => raw.slice(0, FOLDER_NAME_MAX);

  const onNameInput = (value: string) => {
    const sliced = sanitizeInput(value);
    setNameDraft(sliced);
    const trimmed = sliced.trim();
    setNameError(trimmed.length > 0 && !FOLDER_NAME_RE.test(trimmed));
  };

  const commitName = () => {
    const trimmed = nameDraft().trim();
    if (trimmed === props.folder.name) {
      setNameError(false);
      return;
    }
    if (!FOLDER_NAME_RE.test(trimmed)) {
      setNameDraft(props.folder.name);
      setNameError(false);
      return;
    }
    phoneActions.updateFolder(props.folder.id, { name: trimmed });
    setNameError(false);
  };

  const cancelNameEdit = () => {
    setNameDraft(props.folder.name);
    setNameError(false);
  };

  const saveColor = (color: AllowedFolderColor) => {
    phoneActions.updateFolder(props.folder.id, { color });
  };

  const deleteFolder = () => {
    phoneActions.deleteFolder(props.folder.id);
    props.onClose();
  };

  const transformOrigin = createMemo(() => {
    const origin = props.originRect;
    const container = props.containerRef?.();
    if (!origin || !container) return 'center';
    const rect = container.getBoundingClientRect();
    const ox = origin.x + origin.width / 2 - rect.left;
    const oy = origin.y + origin.height / 2 - rect.top;
    return `${ox}px ${oy}px`;
  });

  let inputEl: HTMLInputElement | undefined;
  onMount(() => {
    if (editMode() && inputEl) inputEl.focus();
  });

  return (
    <Presence exitBeforeEnter>
      <Motion.div
        class={styles.overlay}
        onClick={props.onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
      >
        <Motion.div
          class={styles.panel}
          classList={{ [PANEL_COLOR_CLASS[props.folder.color]]: true }}
          onClick={(e: MouseEvent) => e.stopPropagation()}
          style={{ 'transform-origin': transformOrigin() }}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.6 }}
          transition={{ duration: 0.22, easing: [0.2, 0.8, 0.2, 1] }}
        >
          <div class={styles.header}>
            <strong class={styles.title}>{props.folder.name}</strong>
            <div class={styles.headerActions}>
              <button type="button" onClick={() => setEditMode((v) => !v)}>
                {editMode() ? t('home.done', props.language()) : t('home.edit', props.language())}
              </button>
              <button type="button" onClick={props.onClose}>
                {t('home.close', props.language())}
              </button>
            </div>
          </div>

          <Show when={editMode()}>
            <input
              ref={inputEl}
              class={styles.nameInput}
              classList={{ [styles.invalid]: nameError() }}
              type="text"
              value={nameDraft()}
              maxlength={FOLDER_NAME_MAX}
              spellcheck={false}
              autocomplete="off"
              onInput={(e) => onNameInput(e.currentTarget.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); commitName(); (e.currentTarget as HTMLInputElement).blur(); }
                if (e.key === 'Escape') { e.preventDefault(); cancelNameEdit(); (e.currentTarget as HTMLInputElement).blur(); }
              }}
            />
          </Show>

          <div class={styles.grid}>
            <For each={folderApps()}>
              {(app) => (
                <button
                  type="button"
                  class={styles.folderApp}
                  disabled={editMode()}
                  onClick={() => openApp(app)}
                >
                  <img src={app.icon} alt="" draggable={false} />
                  <span>{appName(app.id, app.name, props.language())}</span>
                </button>
              )}
            </For>
          </div>

          <Show when={editMode()}>
            <div class={styles.editor}>
              <div class={styles.colorPicker}>
                <For each={ALLOWED_FOLDER_COLORS}>
                  {(color) => (
                    <button
                      type="button"
                      class={styles.colorSwatch}
                      classList={{
                        [SWATCH_COLOR_CLASS[color]]: true,
                        [styles.active]: props.folder.color === color,
                      }}
                      aria-label={color}
                      onClick={() => saveColor(color)}
                    />
                  )}
                </For>
              </div>
              <button type="button" class={styles.deleteBtn} onClick={deleteFolder}>
                {t('home.delete_folder', props.language()) || 'Delete Folder'}
              </button>
            </div>
          </Show>
        </Motion.div>
      </Motion.div>
    </Presence>
  );
}
