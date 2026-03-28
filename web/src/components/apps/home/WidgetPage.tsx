import { createSignal, createMemo, For, Show } from 'solid-js';
import { usePhone } from '../../../store/phone';
import { WidgetCard } from './WidgetCard';
import { WidgetPicker } from './WidgetPicker';
import { MAX_WIDGETS } from '../../../types/home';
import { t } from '../../../i18n';
import styles from './WidgetPage.module.scss';

interface WidgetPageProps {
  editing: boolean;
  language: () => string;
}

export function WidgetPage(props: WidgetPageProps) {
  const [state, phoneActions] = usePhone();
  const [showPicker, setShowPicker] = createSignal(false);
  const widgets = createMemo(() => state.widgetLayout?.widgets || []);

  const rows = createMemo(() => {
    const result: Array<typeof widgets extends () => infer T ? T : never> = [];
    const ws = widgets();
    let i = 0;
    while (i < ws.length) {
      if (ws[i].size === 'sm' && i + 1 < ws.length && ws[i + 1].size === 'sm') {
        result.push([ws[i], ws[i + 1]]);
        i += 2;
      } else {
        result.push([ws[i]]);
        i++;
      }
    }
    return result;
  });

  const canAdd = () => widgets().length < MAX_WIDGETS;

  return (
    <div class={styles.widgetPage}>
      <Show when={widgets().length === 0}>
        <div class={styles.empty}>
          <span>{t('home.no_widgets', props.language()) || 'No widgets added'}</span>
          <button class={styles.addBtn} onClick={() => setShowPicker(true)}>
            + {t('home.add_widget', props.language()) || 'Add Widget'}
          </button>
        </div>
      </Show>

      <For each={rows()}>
        {(row) => (
          <div class={styles.widgetRow}>
            <For each={row}>
              {(widget) => (
                <WidgetCard
                  widget={widget}
                  editing={props.editing}
                  language={props.language}
                  onRemove={() => phoneActions.removeWidget(widget.id)}
                />
              )}
            </For>
          </div>
        )}
      </For>

      <Show when={props.editing && canAdd() && widgets().length > 0}>
        <button class={styles.addBtn} onClick={() => setShowPicker(true)}>
          + {t('home.add_widget', props.language()) || 'Add Widget'}
        </button>
      </Show>

      <Show when={showPicker()}>
        <WidgetPicker language={props.language} onClose={() => setShowPicker(false)} />
      </Show>
    </div>
  );
}
