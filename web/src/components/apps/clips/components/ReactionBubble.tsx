import { createSignal, onMount, onCleanup } from 'solid-js';
import styles from '../ClipsApp.module.scss';

interface Props {
  id: string;
  username: string;
  reaction: string;
  onExpire: (id: string) => void;
}

export function ReactionBubble(props: Props) {
  const [isVisible, setIsVisible] = createSignal(true);
  
  let expireTimer: number;
  
  onMount(() => {
    expireTimer = window.setTimeout(() => {
      setIsVisible(false);
      props.onExpire(props.id);
    }, 3000);
  });
  
  onCleanup(() => {
    if (expireTimer) {
      window.clearTimeout(expireTimer);
    }
  });
  
  if (!isVisible()) return null;
  
  return (
    <div class={styles.reactionBubble}>
      <span class={styles.reactionEmoji}>{props.reaction}</span>
      <span class={styles.reactionUsername}>{props.username}</span>
    </div>
  );
}
