import { For, Show, createSignal } from 'solid-js';
import { timeAgo } from '../../../../utils/misc';
import { sanitizeText } from '../../../../utils/sanitize';
import { EmojiPickerButton } from '../../../shared/ui/EmojiPicker';
import styles from '../ClipsApp.module.scss';

interface Message {
  id: string;
  username: string;
  avatar?: string;
  content: string;
  isMention: boolean;
  timestamp: number;
}

interface Props {
  messages: Message[];
  isOpen: boolean;
  isOwner: boolean;
  onClose: () => void;
  onSend: (content: string) => void;
  onDelete: (messageId: string) => void;
  onMute: (username: string) => void;
  myUsername: string;
}

export function GlobalChatPanel(props: Props) {
  const [messageText, setMessageText] = createSignal('');
  const [selectedMessage, setSelectedMessage] = createSignal<string | null>(null);
  
  const handleSend = () => {
    const content = sanitizeText(messageText(), 500);
    if (!content) return;
    props.onSend(content);
    setMessageText('');
  };
  
  const handleMessageClick = (messageId: string, username: string) => {
    if (!props.isOwner) return;
    setSelectedMessage(messageId);
  };
  
  const handleDelete = (messageId: string) => {
    props.onDelete(messageId);
    setSelectedMessage(null);
  };
  
  const handleMute = (username: string) => {
    props.onMute(username);
    setSelectedMessage(null);
  };
  
  return (
    <Show when={props.isOpen}>
      <div class={styles.globalChatPanel}>
        <div class={styles.globalChatHeader}>
          <h3>Chat en vivo</h3>
          <button class={styles.closeBtn} onClick={props.onClose}><img src="./img/icons_ios/ui-close.svg" alt="" draggable={false} /></button>
        </div>
        
        <div class={styles.globalChatMessages}>
          <For each={props.messages}>
            {(message) => (
              <div 
                class={styles.globalMessageItem}
                classList={{
                  [styles.isMention]: message.isMention,
                  [styles.isOwn]: message.username === props.myUsername
                }}
                onClick={() => handleMessageClick(message.id, message.username)}
              >
                <Show when={message.avatar}>
                  <img src={message.avatar} alt="" class={styles.globalMessageAvatar} />
                </Show>
                <div class={styles.globalMessageContent}>
                  <strong>@{message.username}</strong>
                  <p>{message.content}</p>
              <span class={styles.globalMessageTime}>
                {timeAgo(new Date(message.timestamp))}
              </span>
                </div>
                
                {/* Moderation menu for owner */}
                <Show when={props.isOwner && selectedMessage() === message.id}>
                  <div class={styles.moderationMenu}>
                    <button onClick={() => handleDelete(message.id)}>
                      <img src="./img/icons_ios/ui-trash.svg" alt="" draggable={false} /><span>Eliminar mensaje</span>
                    </button>
                    <button onClick={() => handleMute(message.username)}>
                      <img src="./img/icons_ios/ui-block.svg" alt="" draggable={false} /><span>Silenciar usuario</span>
                    </button>
                  </div>
                </Show>
              </div>
            )}
          </For>
        </div>
        
        <div class={styles.globalChatInput}>
          <EmojiPickerButton 
            value={messageText()} 
            onChange={setMessageText} 
            maxLength={500} 
          />
          <input
            type="text"
            placeholder="Escribe un mensaje..."
            value={messageText()}
            onInput={(e) => setMessageText(sanitizeText(e.currentTarget.value, 500))}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          />
          <button onClick={handleSend} disabled={!messageText().trim()}>
            Enviar
          </button>
        </div>
        
        {/* Quick reactions */}
        <div class={styles.quickReactions}>
          <button onClick={() => props.onSend('👍')}>👍</button>
          <button onClick={() => props.onSend('❤️')}>❤️</button>
          <button onClick={() => props.onSend('😂')}>😂</button>
          <button onClick={() => props.onSend('🔥')}>🔥</button>
          <button onClick={() => props.onSend('👏')}>👏</button>
        </div>
      </div>
    </Show>
  );
}
