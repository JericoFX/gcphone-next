import { createSignal, For, Show, createMemo } from 'solid-js';
import { usePhone } from '../../../store/phone';
import { WIDGET_DEFINITIONS, type WidgetType, type WidgetSize } from '../../../types/home';
import { t } from '../../../i18n';
import styles from './WidgetPicker.module.scss';

interface WidgetPickerProps {
  language: () => string;
  onClose: () => void;
}

const WIDGET_TYPES = Object.keys(WIDGET_DEFINITIONS) as WidgetType[];

const WIDGET_DESCRIPTIONS: Record<WidgetType, string> = {
  maps: 'Quick navigation',
  nowPlaying: 'Music controls',
  contacts: 'Favorite contacts',
  notes: 'Recent notes',
  chirp: 'Latest posts',
  clock: 'Current time',
  weather: 'Current conditions',
  bank: 'Account balance',
  gallery: 'Recent photos',
  radio: 'Now playing',
};

export function WidgetPicker(props: WidgetPickerProps) {
  const [, phoneActions] = usePhone();
  const [search, setSearch] = createSignal('');
  const [expanded, setExpanded] = createSignal<WidgetType | null>(null);
  const [selectedSize, setSelectedSize] = createSignal<Record<string, WidgetSize>>({});

  const tr = (key: string, fallback: string) => {
    const v = t(key, props.language());
    return v === key ? fallback : v;
  };

  const getSize = (type: WidgetType): WidgetSize =>
    selectedSize()[type] || WIDGET_DEFINITIONS[type].sizes[0];

  const filtered = createMemo(() => {
    const q = search().toLowerCase().trim();
    if (!q) return WIDGET_TYPES;
    return WIDGET_TYPES.filter((type) =>
      WIDGET_DEFINITIONS[type].name.toLowerCase().includes(q),
    );
  });

  const addWidget = (type: WidgetType) => {
    phoneActions.addWidget(type, getSize(type));
    props.onClose();
  };

  const toggleExpand = (type: WidgetType) => {
    setExpanded((prev) => (prev === type ? null : type));
  };

  return (
    <div class={styles.overlay} onClick={props.onClose}>
      <div class={styles.panel} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div class={styles.header}>
          <span />
          <strong>{tr('home.widgets', 'Widgets')}</strong>
          <button class={styles.closeBtn} onClick={props.onClose}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div class={styles.searchWrap}>
          <svg class={styles.searchIcon} width="14" height="14" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2" />
            <path d="M16 16l4.5 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
          <input
            class={styles.searchInput}
            type="text"
            placeholder={tr('home.search_widgets', 'Search Widgets')}
            value={search()}
            onInput={(e) => setSearch(e.currentTarget.value)}
          />
        </div>

        {/* Widget list */}
        <div class={styles.list}>
          <For each={filtered()} fallback={<div class={styles.empty}>{tr('home.no_widgets', 'No widgets found')}</div>}>
            {(type) => {
              const def = WIDGET_DEFINITIONS[type];
              const isExpanded = () => expanded() === type;
              return (
                <div class={styles.widgetItem} classList={{ [styles.expanded]: isExpanded() }}>
                  <button class={styles.widgetRow} onClick={() => toggleExpand(type)}>
                    <img class={styles.widgetIcon} src={def.icon} alt={def.name} draggable={false} />
                    <div class={styles.widgetInfo}>
                      <strong>{def.name}</strong>
                      <span>{WIDGET_DESCRIPTIONS[type]}</span>
                    </div>
                    <svg class={styles.chevron} classList={{ [styles.chevronOpen]: isExpanded() }} width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M3 4.5l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  </button>

                  <Show when={isExpanded()}>
                    <div class={styles.expandedContent}>
                      {/* Size tabs */}
                      <div class={styles.sizeTabs}>
                        <For each={def.sizes}>
                          {(size) => (
                            <button
                              class={styles.sizeTab}
                              classList={{ [styles.sizeTabActive]: getSize(type) === size }}
                              onClick={() => setSelectedSize((prev) => ({ ...prev, [type]: size }))}
                            >
                              {size.toUpperCase()}
                            </button>
                          )}
                        </For>
                      </div>

                      {/* Size preview */}
                      <div class={styles.preview}>
                        <div
                          class={styles.previewCard}
                          classList={{
                            [styles.previewSm]: getSize(type) === 'sm',
                            [styles.previewMd]: getSize(type) === 'md',
                            [styles.previewLg]: getSize(type) === 'lg',
                          }}
                        >
                          <span class={styles.previewLabel}>{def.name}</span>
                        </div>
                      </div>

                      {/* Add button */}
                      <button class={styles.addBtn} onClick={() => addWidget(type)}>
                        {tr('home.add_widget', 'Add Widget')}
                      </button>
                    </div>
                  </Show>
                </div>
              );
            }}
          </For>
        </div>
      </div>
    </div>
  );
}
