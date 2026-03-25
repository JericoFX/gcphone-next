import { Motion } from '@motionone/solid';
import styles from './EmptyState.module.scss';

interface EmptyStateProps {
  title: string;
  description?: string;
  class?: string;
}

export function EmptyState(props: EmptyStateProps) {
  return (
    <Motion.div
      classList={{ [styles.emptyState]: true, [props.class || '']: !!props.class }}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, easing: [0.32, 0.72, 0, 1] }}
    >
      <strong>{props.title}</strong>
      {props.description ? <span>{props.description}</span> : null}
    </Motion.div>
  );
}
