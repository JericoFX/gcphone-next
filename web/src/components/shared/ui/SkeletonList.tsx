import { For } from 'solid-js';
import styles from './SkeletonList.module.scss';

interface SkeletonListProps {
  rows?: number;
  avatar?: boolean;
}

export function SkeletonList(props: SkeletonListProps) {
  const rows = () => Math.max(1, props.rows || 6);

  return (
    <div class={styles.wrap}>
      <For each={Array.from({ length: rows() })}>
        {() => (
          <div class={styles.row}>
            {props.avatar ? <div class={styles.avatar} /> : null}
            <div class={styles.lines}>
              <div class={styles.lineLg} />
              <div class={styles.lineSm} />
            </div>
          </div>
        )}
      </For>
    </div>
  );
}
