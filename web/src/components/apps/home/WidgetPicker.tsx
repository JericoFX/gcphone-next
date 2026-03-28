import { createSignal, For } from 'solid-js';
import { usePhone } from '../../../store/phone';
import { WIDGET_DEFINITIONS, type WidgetType, type WidgetSize } from '../../../types/home';
import { t } from '../../../i18n';
import styles from './WidgetPicker.module.scss';

interface WidgetPickerProps {
  language: () => string;
  onClose: () => void;
}

const WIDGET_TYPES = Object.keys(WIDGET_DEFINITIONS) as WidgetType[];

export function WidgetPicker(props: WidgetPickerProps) {
  const [, phoneActions] = usePhone();
  const [selectedSize, setSelectedSize] = createSignal<Record<string, WidgetSize>>({});
  const getSize = (type: WidgetType): WidgetSize => selectedSize()[type] || WIDGET_DEFINITIONS[type].sizes[0];

  const addWidget = (type: WidgetType) => {
    phoneActions.addWidget(type, getSize(type));
    props.onClose();
  };

  return (
    <div class={styles.overlay} onClick={props.onClose}>
      <div class={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div class={styles.header}>
          <strong>{t('home.add_widget', props.language()) || 'Add Widget'}</strong>
          <button onClick={props.onClose}>{t('home.close', props.language())}</button>
        </div>
        <div class={styles.list}>
          <For each={WIDGET_TYPES}>
            {(type) => {
              const def = WIDGET_DEFINITIONS[type];
              return (
                <button class={styles.widgetOption} onClick={() => addWidget(type)}>
                  <img src={def.icon} alt={def.name} />
                  <div class={styles.info}>
                    <strong>{def.name}</strong>
                    <span>{def.sizes.join(' / ')}</span>
                  </div>
                  <div class={styles.sizeSelector}>
                    <For each={def.sizes}>
                      {(size) => (
                        <span class={styles.sizeBtn} classList={{ [styles.active]: getSize(type) === size }}
                          onClick={(e) => { e.stopPropagation(); setSelectedSize((prev) => ({ ...prev, [type]: size })); }}>
                          {size.toUpperCase()}
                        </span>
                      )}
                    </For>
                  </div>
                </button>
              );
            }}
          </For>
        </div>
      </div>
    </div>
  );
}
