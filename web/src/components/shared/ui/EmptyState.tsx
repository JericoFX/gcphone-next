import styles from './EmptyState.module.scss';

interface EmptyStateProps {
  title: string;
  description?: string;
  class?: string;
}

export function EmptyState(props: EmptyStateProps) {
  return (
    <div classList={{ [styles.emptyState]: true, [props.class || '']: !!props.class }}>
      <strong>{props.title}</strong>
      {props.description ? <span>{props.description}</span> : null}
    </div>
  );
}
