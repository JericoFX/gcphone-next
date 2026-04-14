import { For } from 'solid-js';
import { useIconPack } from './IconPackProvider';
import { APP_BY_ID } from '../../../config/apps';
import type { Folder, AllowedFolderColor } from '../../../types/home';
import styles from './FolderIcon.module.scss';

interface FolderIconProps {
  folder: Folder;
  editing: boolean;
  dragging: boolean;
  onClick: (triggerEl: HTMLElement) => void;
  onPointerDown?: (e: PointerEvent) => void;
}

const COLOR_CLASS: Record<AllowedFolderColor, string> = {
  blue: styles.colorBlue,
  purple: styles.colorPurple,
  pink: styles.colorPink,
  red: styles.colorRed,
  orange: styles.colorOrange,
  green: styles.colorGreen,
  teal: styles.colorTeal,
  gray: styles.colorGray,
};

export function FolderIcon(props: FolderIconProps) {
  const { borderRadius } = useIconPack();
  const previewApps = () => props.folder.apps.slice(0, 4);
  let rootEl: HTMLButtonElement | undefined;

  return (
    <button
      ref={rootEl}
      class={styles.folderIcon}
      classList={{
        [styles.jiggle]: props.editing && !props.dragging,
        [styles.dragging]: props.dragging,
        [COLOR_CLASS[props.folder.color]]: true,
      }}
      data-testid={`home-folder-${props.folder.id}`}
      onPointerDown={props.onPointerDown}
      onClick={() => {
        if (!props.editing && rootEl) props.onClick(rootEl);
      }}
    >
      <div class={styles.preview} style={{ 'border-radius': borderRadius() }}>
        <For each={[0, 1, 2, 3]}>
          {(i) => {
            const app = () => {
              const appId = previewApps()[i];
              return appId ? APP_BY_ID[appId] : null;
            };
            return app() ? (
              <img class={styles.miniIcon} src={app()!.icon} alt="" draggable={false} />
            ) : (
              <span class={styles.emptySlot} />
            );
          }}
        </For>
      </div>
      <span class={styles.folderName}>{props.folder.name}</span>
    </button>
  );
}
