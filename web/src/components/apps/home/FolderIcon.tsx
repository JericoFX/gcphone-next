import { For } from 'solid-js';
import { useIconPack } from './IconPackProvider';
import { APP_BY_ID } from '../../../config/apps';
import type { Folder } from '../../../types/home';
import styles from './FolderIcon.module.scss';

interface FolderIconProps {
  folder: Folder;
  editing: boolean;
  dragging: boolean;
  onClick: () => void;
  onPointerDown?: (e: PointerEvent) => void;
}

const FOLDER_COLORS: Record<string, string> = {
  blue: 'rgba(0, 122, 255, 0.2)',
  purple: 'rgba(175, 82, 222, 0.2)',
  pink: 'rgba(255, 45, 85, 0.2)',
  red: 'rgba(255, 59, 48, 0.2)',
  orange: 'rgba(255, 149, 0, 0.2)',
  green: 'rgba(52, 199, 89, 0.2)',
  teal: 'rgba(90, 200, 250, 0.2)',
};

export function FolderIcon(props: FolderIconProps) {
  const { className } = useIconPack();
  const previewApps = () => props.folder.apps.slice(0, 4);
  const bgColor = () => FOLDER_COLORS[props.folder.color] || FOLDER_COLORS.blue;

  return (
    <button
      class={styles.folderIcon}
      classList={{
        [styles.jiggle]: props.editing && !props.dragging,
      }}
      onPointerDown={props.onPointerDown}
      onClick={() => {
        if (!props.editing) props.onClick();
      }}
    >
      <div
        class={`${styles.preview} ${className()}`}
        style={{ background: bgColor() }}
      >
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
