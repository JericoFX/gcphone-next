import type { JSX } from 'solid-js';
import { For } from 'solid-js';
import styles from './MediaActionButtons.module.scss';

export interface MediaActionButtonItem {
  key?: string;
  icon: JSX.Element | string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'default' | 'danger';
}

interface MediaActionButtonsProps {
  actions: MediaActionButtonItem[];
  variant?: 'compact' | 'tiles';
  class?: string;
}

export function MediaActionButtons(props: MediaActionButtonsProps) {
  const variant = () => props.variant || 'compact';

  return (
    <div
      class={styles.container}
      classList={{
        [styles.compact]: variant() === 'compact',
        [styles.tiles]: variant() === 'tiles',
        [props.class || '']: !!props.class,
      }}
    >
      <For each={props.actions}>
        {(action, index) => (
          <button
            type="button"
            class={styles.action}
            classList={{
              [styles.danger]: action.tone === 'danger',
              [styles.tileAction]: variant() === 'tiles',
            }}
            onClick={action.onClick}
            disabled={action.disabled}
            title={action.label}
          >
            <span class={styles.icon}>{action.icon}</span>
            <span class={styles.label}>{action.label}</span>
          </button>
        )}
      </For>
    </div>
  );
}
