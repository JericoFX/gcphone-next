import { For, Show } from 'solid-js';
import styles from './ActionSheet.module.scss';

export interface ActionSheetAction {
  label: string;
  tone?: 'default' | 'primary' | 'danger';
  onClick: () => void | Promise<void>;
}

interface ActionSheetProps {
  open: boolean;
  title?: string;
  actions: ActionSheetAction[];
  onClose: () => void;
}

export function ActionSheet(props: ActionSheetProps) {
  return (
    <Show when={props.open}>
      <div class={styles.overlay} onClick={props.onClose}>
        <div class={styles.sheet} onClick={(e) => e.stopPropagation()}>
          <Show when={props.title}>
            <div class={styles.title}>{props.title}</div>
          </Show>

          <div class={styles.list}>
            <For each={props.actions}>
              {(action) => (
                <button
                  class={styles.action}
                  classList={{
                    [styles.primary]: action.tone === 'primary',
                    [styles.danger]: action.tone === 'danger',
                  }}
                  onClick={async () => {
                    await action.onClick();
                    props.onClose();
                  }}
                >
                  {action.label}
                </button>
              )}
            </For>
          </div>

          <button class={styles.cancel} onClick={props.onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </Show>
  );
}
