import { Show } from 'solid-js';
import { useIconPack } from './IconPackProvider';
import { appName } from '../../../i18n';
import styles from './AppIcon.module.scss';

interface AppIconProps {
  id: string;
  name: string;
  icon: string;
  editing: boolean;
  dragging: boolean;
  language: () => string;
  badgeCount: number;
  onClick: () => void;
  onPointerDown?: (e: PointerEvent) => void;
}

export function AppIcon(props: AppIconProps) {
  const { borderRadius } = useIconPack();

  return (
    <button
      class={styles.appIcon}
      classList={{
        [styles.jiggle]: props.editing && !props.dragging,
        [styles.dragging]: props.dragging,
      }}
      data-testid={`home-app-${props.id}`}
      onPointerDown={props.onPointerDown}
      onClick={() => {
        if (!props.editing) props.onClick();
      }}
    >
      <img
        class={styles.iconImg}
        style={{ 'border-radius': borderRadius() }}
        src={props.icon}
        alt={appName(props.id, props.name, props.language())}
        draggable={false}
      />
      <span class={styles.appName}>{appName(props.id, props.name, props.language())}</span>
      <Show when={props.editing}>
        <span class={styles.removeBadge}>&#x2212;</span>
      </Show>
      <Show when={!props.editing && props.badgeCount > 0}>
        <span class={styles.badge}>{props.badgeCount}</span>
      </Show>
    </button>
  );
}
