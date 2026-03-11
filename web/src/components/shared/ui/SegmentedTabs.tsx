import { For } from 'solid-js';
import styles from './SegmentedTabs.module.scss';

interface SegmentedTabItem {
  id: string;
  label: string;
}

interface SegmentedTabsProps {
  items: SegmentedTabItem[];
  active: string;
  onChange: (id: string) => void;
  class?: string;
}

export function SegmentedTabs(props: SegmentedTabsProps) {
  return (
    <div classList={{ [styles.root]: true, [props.class || '']: !!props.class }}>
      <For each={props.items}>
        {(item) => (
          <button
            class={styles.tab}
            classList={{ [styles.active]: props.active === item.id }}
            onClick={() => props.onChange(item.id)}
            type="button"
          >
            {item.label}
          </button>
        )}
      </For>
    </div>
  );
}
