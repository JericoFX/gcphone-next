import { Show } from 'solid-js';
import { Motion } from '@motionone/solid';
import styles from './InlineNotice.module.scss';

interface InlineNoticeProps {
  title: string;
  message: string;
  tone?: 'info' | 'warning';
}

export function InlineNotice(props: InlineNoticeProps) {
  const tone = () => props.tone || 'info';

  return (
    <Motion.div
      classList={{ [styles.notice]: true, [styles.warning]: tone() === 'warning' }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, easing: [0.32, 0.72, 0, 1] }}
    >
      <div class={styles.icon}>{tone() === 'warning' ? '!' : 'i'}</div>
      <div class={styles.content}>
        <strong>{props.title}</strong>
        <Show when={props.message}>
          <span>{props.message}</span>
        </Show>
      </div>
    </Motion.div>
  );
}
