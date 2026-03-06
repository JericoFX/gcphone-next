import { For, Show, createSignal, createEffect } from 'solid-js';
import { FloatingMessage } from './FloatingMessage';
import { ReactionBubble } from './ReactionBubble';
import styles from '../ClipsApp.module.scss';

interface Message {
  id: string;
  username: string;
  avatar?: string;
  content: string;
  isMention: boolean;
}

interface Reaction {
  id: string;
  username: string;
  reaction: string;
}

interface Props {
  messages: Message[];
  reactions: Reaction[];
  maxVisible?: number;
  onMessageExpire: (id: string) => void;
  onReactionExpire: (id: string) => void;
}

export function FloatingChat(props: Props) {
  const maxVisible = () => props.maxVisible || 4;
  
  // Only show last N messages
  const visibleMessages = () => {
    const msgs = props.messages;
    if (msgs.length <= maxVisible()) return msgs;
    return msgs.slice(msgs.length - maxVisible());
  };
  
  return (
    <div class={styles.floatingChat}>
      <For each={visibleMessages()}>
        {(message) => (
          <FloatingMessage
            id={message.id}
            username={message.username}
            avatar={message.avatar}
            content={message.content}
            isMention={message.isMention}
            onExpire={props.onMessageExpire}
          />
        )}
      </For>
      
      <For each={props.reactions}>
        {(reaction) => (
          <ReactionBubble
            id={reaction.id}
            username={reaction.username}
            reaction={reaction.reaction}
            onExpire={props.onReactionExpire}
          />
        )}
      </For>
    </div>
  );
}
