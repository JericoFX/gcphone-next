import { createMemo, createSelector, createSignal, For, Show, createEffect, onCleanup, onMount } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { useMessages } from '../../../store/messages';
import { useContacts } from '../../../store/contacts';
import { fetchNui } from '../../../utils/fetchNui';
import { generateColorForString, timeAgo } from '../../../utils/misc';
import { resolveMediaType, sanitizeMediaUrl, sanitizeText } from '../../../utils/sanitize';
import { ActionSheet } from '../../shared/ui/ActionSheet';
import { MediaLightbox } from '../../shared/ui/MediaLightbox';
import { SkeletonList } from '../../shared/ui/SkeletonList';
import { VirtualList } from '../../shared/ui/VirtualList';
import styles from './MessagesApp.module.scss';

function extractCoords(text?: string): { x: number; y: number } | null {
  if (!text) return null;
  const match = text.match(/LOC:([\-\d.]+),\s*([\-\d.]+)/i);
  if (!match) return null;
  const x = Number(match[1]);
  const y = Number(match[2]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

export function MessagesApp() {
  const router = useRouter();
  const [messagesState, messagesActions] = useMessages();
  const [contactsState] = useContacts();
  const [selectedConversation, setSelectedConversation] = createSignal<string | null>(null);
  const [messageInput, setMessageInput] = createSignal('');
  const [attachmentUrl, setAttachmentUrl] = createSignal<string | null>(null);
  const [viewerUrl, setViewerUrl] = createSignal<string | null>(null);
  const [selectedIndex, setSelectedIndex] = createSignal(-1);

  const getMediaUrl = (msg: any): string | undefined => sanitizeMediaUrl(msg.mediaUrl || msg.media_url) || undefined;
  
  const conversations = createMemo(() => {
    const convos: Map<string, { number: string; display: string; lastMessage: any; unread: number }> = new Map();
    
    for (const msg of messagesState.messages) {
      const number = msg.owner === 1 ? msg.receiver : msg.transmitter;
      
      if (!convos.has(number)) {
        const contact = contactsState.contacts.find(c => c.number === number);
        convos.set(number, {
          number,
          display: contact?.display || number,
          lastMessage: msg,
          unread: 0
        });
      }
      
      const convo = convos.get(number)!;
      if (new Date(msg.time) > new Date(convo.lastMessage.time)) {
        convo.lastMessage = msg;
      }
      
      if (!msg.isRead && msg.owner === 0) {
        convo.unread++;
      }
    }
    
    return Array.from(convos.values()).sort(
      (a, b) => new Date(b.lastMessage.time).getTime() - new Date(a.lastMessage.time).getTime()
    );
  });

  const isSelectedConversationIndex = createSelector(selectedIndex);

  createEffect(() => {
    const maxIndex = conversations().length - 1;
    if (maxIndex < 0) {
      setSelectedIndex(-1);
      return;
    }

    if (selectedIndex() > maxIndex) {
      setSelectedIndex(maxIndex);
    }
  });
  
  createEffect(() => {
    const params = router.params();
    const number = typeof params.phoneNumber === 'string' ? params.phoneNumber : '';
    if (!number) return;
    setSelectedConversation(number);
    messagesActions.markAsRead(number);
  });

  createEffect(() => {
    const handleKeyUp = (e: CustomEvent<string>) => {
      const key = e.detail;
      
      if (selectedConversation()) {
        if (key === 'Backspace') {
          setSelectedConversation(null);
        }
        return;
      }
      
      const convos = conversations();
      
      switch (key) {
        case 'ArrowUp':
          setSelectedIndex(prev => Math.max(0, prev - 1));
          break;
        case 'ArrowDown':
          setSelectedIndex(prev => Math.min(convos.length - 1, prev + 1));
          break;
        case 'Enter':
          if (selectedIndex() >= 0 && selectedIndex() < convos.length) {
            setSelectedConversation(convos[selectedIndex()].number);
          }
          break;
        case 'Backspace':
          router.goBack();
          break;
      }
    };
    
    window.addEventListener('phone:keyUp', handleKeyUp as EventListener);
    onCleanup(() => window.removeEventListener('phone:keyUp', handleKeyUp as EventListener));
  });
  
  const openConversation = (number: string) => {
    setSelectedConversation(number);
    messagesActions.markAsRead(number);
  };

  const deleteConversation = async (number: string) => {
    const ok = await messagesActions.deleteConversation(number);
    if (ok && selectedConversation() === number) {
      setSelectedConversation(null);
    }
  };
  
  const getConversationMessages = () => {
    const number = selectedConversation();
    if (!number) return [];
    return messagesActions.getConversation(number);
  };
  
  const sendMessage = async () => {
    const number = selectedConversation();
    const content = sanitizeText(messageInput(), 800);
    const media = sanitizeMediaUrl(attachmentUrl());
    if (!number || (!content && !media)) return;
    
    await messagesActions.send(number, content, media || undefined);
    setMessageInput('');
    setAttachmentUrl(null);
  };

  const attachFromGallery = async () => {
    const gallery = await fetchNui<any[]>('getGallery', undefined, []);
    if (gallery && gallery.length > 0) {
      const nextUrl = sanitizeMediaUrl(gallery[0].url);
      if (nextUrl) setAttachmentUrl(nextUrl);
    }
  };

  const attachFromCamera = async () => {
    const shot = await fetchNui<{ url?: string }>('takePhoto', {} as any, { url: '' } as any);
    if (shot?.url) {
      const nextUrl = sanitizeMediaUrl(shot.url);
      if (nextUrl) {
        setAttachmentUrl(nextUrl);
        return;
      }
    }

    const gallery = await fetchNui<any[]>('getGallery', undefined, []);
    if (gallery && gallery.length > 0) {
      const nextUrl = sanitizeMediaUrl(gallery[0].url);
      if (nextUrl) setAttachmentUrl(nextUrl);
    }
  };

  const attachByUrl = () => {
    const input = window.prompt('Pega URL de imagen, video o audio');
    const nextUrl = sanitizeMediaUrl(input);
    if (nextUrl) {
      setAttachmentUrl(nextUrl);
      return;
    }
    if (input && input.trim()) window.alert('URL invalida o formato no permitido');
  };
  
  const getContactName = (number: string) => {
    const contact = contactsState.contacts.find(c => c.number === number);
    return contact?.display || number;
  };

  const openNewChat = () => {
    const input = window.prompt('Numero para iniciar chat');
    const number = sanitizeText(input, 20);
    if (!number) return;
    setSelectedConversation(number);
  };

  const sendLocationText = async () => {
    const number = selectedConversation();
    if (!number) return;
    const x = Number(window.prompt('Coordenada X'));
    const y = Number(window.prompt('Coordenada Y'));
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    await messagesActions.send(number, `📍 Ubicacion compartida LOC:${x.toFixed(2)},${y.toFixed(2)}`);
  };
  
  return (
    <div class="ios-page">
      <Show when={!selectedConversation()} fallback={
        <ConversationView
          phoneNumber={selectedConversation()!}
          contactName={getContactName(selectedConversation()!)}
          messages={getConversationMessages()}
          messageInput={messageInput()}
          attachmentUrl={attachmentUrl()}
          onInput={setMessageInput}
          onSend={sendMessage}
          onAttachGallery={attachFromGallery}
          onAttachCamera={attachFromCamera}
          onAttachUrl={attachByUrl}
          onSendLocation={sendLocationText}
          onOpenCoords={(x, y) => router.navigate('maps', { x, y })}
          onClearAttachment={() => setAttachmentUrl(null)}
          onOpenViewer={setViewerUrl}
          getMediaUrl={getMediaUrl}
          onBack={() => setSelectedConversation(null)}
          onDeleteConversation={() => void deleteConversation(selectedConversation()!)}
        />
      }>
        <div class="ios-nav">
          <button class="ios-icon-btn" onClick={() => router.goBack()}>
            ‹
          </button>
          <div class="ios-nav-title">Mensajes</div>
          <button class="ios-icon-btn">✏️</button>
        </div>
        <div class="ios-content">
        <div class={styles.conversationList}>
          <Show
            when={messagesState.loading}
            fallback={
              <VirtualList items={conversations} itemHeight={78} overscan={5}>
                {(convo, index) => (
                  <div
                    class={styles.conversationItem}
                    classList={{ [styles.selected]: isSelectedConversationIndex(index()) }}
                    onClick={() => openConversation(convo.number)}
                  >
                    <div class={styles.avatar} style={{ 'background-color': generateColorForString(convo.number) }}>
                      {convo.display.charAt(0).toUpperCase()}
                    </div>
                    <div class={styles.info}>
                      <div class={styles.topRow}>
                        <span class={styles.name}>{convo.display}</span>
                        <span class={styles.time}>{timeAgo(convo.lastMessage.time)}</span>
                      </div>
                      <div class={styles.preview}>
                        <Show when={convo.unread > 0}>
                          <span class={styles.unreadBadge}>{convo.unread}</span>
                        </Show>
                        <span class={styles.message}>{getMediaUrl(convo.lastMessage) ? 'Adjunto multimedia' : convo.lastMessage.message}</span>
                      </div>
                    </div>
                    <button class={styles.deleteConversationBtn} onClick={(e) => { e.stopPropagation(); void deleteConversation(convo.number); }}>
                      Borrar
                    </button>
                  </div>
                )}
              </VirtualList>
            }
          >
            <SkeletonList rows={6} avatar />
          </Show>
        </div>
        <button class={styles.fab} onClick={openNewChat}>+</button>
        </div>
      </Show>
      <MediaLightbox url={viewerUrl()} onClose={() => setViewerUrl(null)} />
    </div>
  );
}

function ConversationView(props: {
  phoneNumber: string;
  contactName: string;
  messages: any[];
  messageInput: string;
  attachmentUrl: string | null;
  onInput: (value: string) => void;
  onSend: () => void;
  onAttachGallery: () => void;
  onAttachCamera: () => void;
  onAttachUrl: () => void;
  onSendLocation: () => void;
  onOpenCoords: (x: number, y: number) => void;
  onClearAttachment: () => void;
  onOpenViewer: (url: string | null) => void;
  getMediaUrl: (msg: any) => string | undefined;
  onBack: () => void;
  onDeleteConversation: () => void;
}) {
  let messagesEnd: HTMLDivElement | undefined;
  const [showAttachSheet, setShowAttachSheet] = createSignal(false);
  
  onMount(() => {
    messagesEnd?.scrollIntoView({ behavior: 'auto' });
  });
  
  createEffect(() => {
    if (props.messages.length > 0) {
      messagesEnd?.scrollIntoView({ behavior: 'smooth' });
    }
  });
  
  return (
    <div class={styles.conversationView}>
      <div class="ios-nav">
        <button class="ios-icon-btn" onClick={props.onBack}>
          ‹
        </button>
        <div class="ios-nav-title">{props.contactName}</div>
        <button class={styles.deleteConversationBtn} onClick={props.onDeleteConversation}>Borrar</button>
      </div>
      
      <div class={styles.messagesList}>
        <For each={props.messages}>
          {(msg) => (
            <div
              class={styles.messageBubble}
              classList={{
                [styles.sent]: msg.owner === 1,
                [styles.received]: msg.owner === 0
              }}
            >
              <span class={styles.messageText}>{msg.message}</span>
              <Show when={extractCoords(msg.message)}>
                {(coords) => (
                  <button class={styles.mapBtn} onClick={() => props.onOpenCoords(coords().x, coords().y)}>
                    Abrir en mapa
                  </button>
                )}
              </Show>
              <Show when={props.getMediaUrl(msg)}>
                <Show when={resolveMediaType(props.getMediaUrl(msg)) === 'image'}>
                  <img class={styles.messageImage} src={props.getMediaUrl(msg)!} alt="adjunto" onClick={() => props.onOpenViewer(props.getMediaUrl(msg) || null)} />
                </Show>
                <Show when={resolveMediaType(props.getMediaUrl(msg)) === 'video'}>
                  <video class={styles.messageImage} src={props.getMediaUrl(msg)!} controls playsinline preload="metadata" />
                </Show>
                <Show when={resolveMediaType(props.getMediaUrl(msg)) === 'audio'}>
                  <audio class={styles.messageAudio} src={props.getMediaUrl(msg)!} controls preload="metadata" />
                </Show>
              </Show>
              <span class={styles.messageTime}>{timeAgo(msg.time)}</span>
            </div>
          )}
        </For>
        <div ref={messagesEnd} />
      </div>
      
      <Show when={props.attachmentUrl}>
        <div class={styles.attachmentPreview}>
          <Show when={resolveMediaType(props.attachmentUrl || undefined) === 'image'}>
            <img src={props.attachmentUrl!} alt="adjunto" onClick={() => props.onOpenViewer(props.attachmentUrl)} />
          </Show>
          <Show when={resolveMediaType(props.attachmentUrl || undefined) === 'video'}>
            <video src={props.attachmentUrl!} controls playsinline preload="metadata" />
          </Show>
          <Show when={resolveMediaType(props.attachmentUrl || undefined) === 'audio'}>
            <audio class={styles.messageAudio} src={props.attachmentUrl!} controls preload="metadata" />
          </Show>
          <button onClick={props.onClearAttachment}>Quitar</button>
        </div>
      </Show>

      <div class={styles.inputContainer}>
        <button class={styles.attachBtn} onClick={() => setShowAttachSheet(true)}>＋</button>
        <input
          type="text"
          placeholder="Mensaje"
          value={props.messageInput}
          onInput={(e) => props.onInput(e.currentTarget.value)}
          onKeyPress={(e) => e.key === 'Enter' && props.onSend()}
        />
        <button class={styles.sendBtn} onClick={props.onSend}>
          ➤
        </button>
      </div>

      <ActionSheet
        open={showAttachSheet()}
        title="Adjuntar"
        onClose={() => setShowAttachSheet(false)}
        actions={[
          { label: 'Foto desde galeria', tone: 'primary', onClick: props.onAttachGallery },
          { label: 'Tomar foto con camara', onClick: props.onAttachCamera },
          { label: 'Pegar URL multimedia', onClick: props.onAttachUrl },
          { label: 'Compartir ubicacion', onClick: props.onSendLocation },
          { label: 'Quitar adjunto', tone: 'danger', onClick: props.onClearAttachment },
        ]}
      />
    </div>
  );
}
