import { For, Show } from 'solid-js';
import { Motion, Presence } from '@motionone/solid';
import { getStoredLanguage, t, tl } from '../../../i18n';
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
    <Presence>
      <Show when={props.open}>
        <Motion.div
          class={styles.overlay}
          onClick={props.onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <Motion.div
            class={styles.sheet}
            onClick={(e: MouseEvent) => e.stopPropagation()}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.3, easing: [0.32, 0.72, 0, 1] }}
          >
            <Show when={props.title}>
              <div class={styles.title}>{tl(props.title || '', getStoredLanguage())}</div>
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
                    {tl(action.label, getStoredLanguage())}
                  </button>
                )}
              </For>
            </div>

            <button class={styles.cancel} onClick={props.onClose}>
              {t('action.cancel', getStoredLanguage())}
            </button>
          </Motion.div>
        </Motion.div>
      </Show>
    </Presence>
  );
}
