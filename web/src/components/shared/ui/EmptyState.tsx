import { Motion } from '@motionone/solid';
import styles from './EmptyState.module.scss';

interface EmptyStateProps {
  title: string;
  description?: string;
  class?: string;
  icon?: string;
}

export function EmptyState(props: EmptyStateProps) {
  return (
    <Motion.div
      classList={{ [styles.emptyState]: true, [props.class || '']: !!props.class }}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, easing: [0.32, 0.72, 0, 1] }}
    >
      <div class={styles.emptyGlyph} aria-hidden="true">{props.icon || '*'}</div>
      <strong>{props.title}</strong>
      {props.description ? <span>{props.description}</span> : null}
    </Motion.div>
  );
}
