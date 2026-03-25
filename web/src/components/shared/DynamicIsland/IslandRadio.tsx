import { Show } from 'solid-js';
import type { LiveActivity } from '../../../store/liveActivity';
import styles from './DynamicIsland.module.scss';

interface IslandRadioProps {
  activity: LiveActivity;
}

export function IslandRadio(props: IslandRadioProps) {
  return (
    <div class={styles.expandedContent}>
      <div class={styles.expandedHeader}>
        <span class={`${styles.badge} ${styles.badgeLive}`}>EN VIVO</span>
        <div style={{ flex: '1', 'min-width': '0' }}>
          <div class={styles.expandedTitle}>{props.activity.title}</div>
          <div class={styles.expandedSubtitle}>{props.activity.subtitle || 'Radio'}</div>
        </div>
      </div>
      <div class={styles.expandedControls}>
        <Show when={props.activity.onPause}>
          <button
            class={`${styles.controlBtn} ${styles.controlBtnPrimary}`}
            onClick={(e) => { e.stopPropagation(); props.activity.onPause?.(); }}
          >
            {props.activity.isPlaying ? '⏸' : '▶'}
          </button>
        </Show>
        <Show when={props.activity.onStop}>
          <button
            class={`${styles.controlBtn} ${styles.controlBtnDanger}`}
            onClick={(e) => { e.stopPropagation(); props.activity.onStop?.(); }}
          >
            ⏹
          </button>
        </Show>
      </div>
      <Show when={props.activity.onVolumeUp || props.activity.onVolumeDown}>
        <div class={styles.volumeRow}>
          <span class={styles.volumeLabel}>🔈</span>
          <button
            class={`${styles.controlBtn} ${styles.controlBtnPrimary}`}
            style={{ width: '28px', height: '28px', 'font-size': '12px' }}
            onClick={(e) => { e.stopPropagation(); props.activity.onVolumeDown?.(); }}
          >
            −
          </button>
          <div style={{ flex: '1', 'text-align': 'center', 'font-size': '11px', color: 'rgba(255,255,255,0.6)' }}>
            {props.activity.volume ?? 50}%
          </div>
          <button
            class={`${styles.controlBtn} ${styles.controlBtnPrimary}`}
            style={{ width: '28px', height: '28px', 'font-size': '12px' }}
            onClick={(e) => { e.stopPropagation(); props.activity.onVolumeUp?.(); }}
          >
            +
          </button>
          <span class={styles.volumeLabel}>🔊</span>
        </div>
      </Show>
    </div>
  );
}
