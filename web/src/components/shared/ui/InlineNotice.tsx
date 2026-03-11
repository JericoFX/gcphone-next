import { Show } from 'solid-js';
import styles from './InlineNotice.module.scss';

interface InlineNoticeProps {
  title: string;
  message: string;
  tone?: 'info' | 'warning';
}

export function InlineNotice(props: InlineNoticeProps) {
  const tone = () => props.tone || 'info';

  return (
    <div classList={{ [styles.notice]: true, [styles.warning]: tone() === 'warning' }}>
      <div class={styles.icon}>{tone() === 'warning' ? '!' : 'i'}</div>
      <div class={styles.content}>
        <strong>{props.title}</strong>
        <Show when={props.message}>
          <span>{props.message}</span>
        </Show>
      </div>
    </div>
  );
}
