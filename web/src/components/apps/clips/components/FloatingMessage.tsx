import { createSignal, onMount, onCleanup } from 'solid-js';
import styles from '../ClipsApp.module.scss';

interface Props {
  id: string;
  username: string;
  avatar?: string;
  content: string;
  isMention: boolean;
  onExpire: (id: string) => void;
  duration?: number;
}

export function FloatingMessage(props: Props) {
  const [isVisible, setIsVisible] = createSignal(true);
  const [isExpiring, setIsExpiring] = createSignal(false);
  
  let expireTimer: number;
  
  onMount(() => {
    // Start expiration timer
    const duration = props.duration || 5000;
    
    expireTimer = window.setTimeout(() => {
      setIsExpiring(true);
      window.setTimeout(() => {
        setIsVisible(false);
        props.onExpire(props.id);
      }, 400);
    }, duration);
  });
  
  onCleanup(() => {
    if (expireTimer) {
      window.clearTimeout(expireTimer);
    }
  });
  
  if (!isVisible()) return null;
  
  return (
    <div 
      class={styles.floatingMessage}
      classList={{
        [styles.isMention]: props.isMention,
        [styles.expiring]: isExpiring()
      }}
    >
      <div class={styles.floatingMessageHeader}>
        <Show when={props.avatar}>
          <img src={props.avatar} alt="" class={styles.floatingAvatar} />
        </Show>
        <span class={styles.floatingUsername}>@{props.username}</span>
      </div>
      <p class={styles.floatingContent}>{props.content}</p>
    </div>
  );
}

// Required for Show component
import { Show } from 'solid-js';
