import { Show } from 'solid-js';
import type { LiveActivity } from '../../../store/liveActivity';
import styles from './DynamicIsland.module.scss';

interface IslandCallProps {
  activity: LiveActivity;
}

export function IslandCall(props: IslandCallProps) {
  return (
    <div class={styles.expandedContent}>
      <div class={styles.expandedHeader}>
        <span class={`${styles.badge} ${styles.badgeCall}`}>📞</span>
        <div style={{ flex: '1', 'min-width': '0' }}>
          <div class={styles.expandedTitle}>{props.activity.title}</div>
          <div class={styles.expandedSubtitle}>{props.activity.subtitle || 'Llamada en curso'}</div>
        </div>
      </div>
      <div class={styles.expandedControls}>
        <Show when={props.activity.onStop}>
          <button
            class={`${styles.controlBtn} ${styles.controlBtnDanger}`}
            onClick={(e) => { e.stopPropagation(); props.activity.onStop?.(); }}
            style={{ width: '44px', height: '44px', 'font-size': '18px' }}
          >
            📵
          </button>
        </Show>
      </div>
    </div>
  );
}
