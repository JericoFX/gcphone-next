import { Show } from 'solid-js';
import styles from './AppPlaceholder.module.scss';

export interface AppPlaceholderProps {
  title?: string;
  rows?: number;
  showHeader?: boolean;
  showTabs?: boolean;
  class?: string;
}

export function AppPlaceholder(props: AppPlaceholderProps) {
  const rows = () => props.rows || 6;
  const showHeader = () => props.showHeader !== false;
  const showTabs = () => props.showTabs || false;

  return (
    <div classList={{ [styles.placeholder]: true, [props.class || '']: !!props.class }}>
      <Show when={showHeader()}>
        <div class={styles.header}>
          <div class={styles.backBtn}></div>
          <div class={styles.title}>
            <Show when={props.title} fallback={<div class={styles.titleSkeleton}></div>}>
              {props.title}
            </Show>
          </div>
          <div class={styles.actionBtn}></div>
        </div>
      </Show>

      <div class={styles.body}>
        {Array.from({ length: rows() }).map((_, i) => (
          <div class={styles.row} style={{ 'animation-delay': `${i * 40}ms` }}>
            <div class={styles.avatar}></div>
            <div class={styles.content}>
              <div class={styles.line} style={{ width: `${60 + Math.random() * 30}%` }}></div>
              <div class={styles.lineShort} style={{ width: `${30 + Math.random() * 40}%` }}></div>
            </div>
          </div>
        ))}
      </div>

      <Show when={showTabs()}>
        <div class={styles.tabs}>
          {Array.from({ length: 4 }).map(() => (
            <div class={styles.tab}>
              <div class={styles.tabIcon}></div>
              <div class={styles.tabLabel}></div>
            </div>
          ))}
        </div>
      </Show>

      <div class={styles.fab}></div>
    </div>
  );
}

export interface SkeletonTextProps {
  lines?: number;
  class?: string;
}

export function SkeletonText(props: SkeletonTextProps) {
  const lines = () => props.lines || 1;

  return (
    <div classList={{ [styles.skeletonText]: true, [props.class || '']: !!props.class }}>
      {Array.from({ length: lines() }).map((_, i) => (
        <div
          class={styles.skeletonLine}
          style={{
            width: i === lines() - 1 && lines() > 1 ? '60%' : '100%',
            'animation-delay': `${i * 60}ms`,
          }}
        ></div>
      ))}
    </div>
  );
}
