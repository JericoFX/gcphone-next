import { createMemo, createSelector, createSignal, For, Show, createEffect, onMount } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { useMessages } from '../../../store/messages';
import { useContacts } from '../../../store/contacts';
import { usePhoneKeyHandler } from '../../../hooks/usePhoneKeyHandler';
import { fetchNui } from '../../../utils/fetchNui';
import { generateColorForString, timeAgo } from '../../../utils/misc';
import { resolveMediaType, sanitizeMediaUrl, sanitizeText } from '../../../utils/sanitize';
import { parseSharedContactMessage } from '../../../utils/contactShare';
import { uiPrompt } from '../../../utils/uiDialog';
import { uiAlert } from '../../../utils/uiAlert';
import { ActionSheet } from '../../shared/ui/ActionSheet';
import { MediaLightbox } from '../../shared/ui/MediaLightbox';
import { SkeletonList } from '../../shared/ui/SkeletonList';
import { VirtualList } from '../../shared/ui/VirtualList';
import { EmojiPickerButton } from '../../shared/ui/EmojiPicker';
import { AppFAB, AppScaffold } from '../../shared/layout';
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
  const [contactsState, contactsActions] = useContacts();
  const [selectedConversation, setSelectedConversation] = createSignal<string | null>(null);
  const [messageInput, setMessageInput] = createSignal('');
  const [attachmentUrl, setAttachmentUrl] = createSignal<string | null>(null);
  const [viewerUrl, setViewerUrl] = createSignal<string | null>(null);
  const [selectedIndex, setSelectedIndex] = createSignal(-1);
  const [search, setSearch] = createSignal('');
  const [showUnreadOnly, setShowUnreadOnly] = createSignal(false);

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

  const filteredConversations = createMemo(() => {
    const q = sanitizeText(search(), 60).toLowerCase();
    return conversations().filter((convo) => {
      if (showUnreadOnly() && convo.unread <= 0) return false;
      if (!q) return true;
      return convo.display.toLowerCase().includes(q) || convo.number.toLowerCase().includes(q);
    });
  });

  createEffect(() => {
    const maxIndex = filteredConversations().length - 1;
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
    const mediaUrl = sanitizeMediaUrl(typeof params.attachmentUrl === 'string' ? params.attachmentUrl : '');
    if (!number) return;
    setSelectedConversation(number);
    if (mediaUrl) {
      setAttachmentUrl(mediaUrl);
    }
    messagesActions.markAsRead(number);
  });

  usePhoneKeyHandler({
    ArrowUp: () => {
      if (selectedConversation()) return;
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    },
    ArrowDown: () => {
      if (selectedConversation()) return;
      const convos = filteredConversations();
      setSelectedIndex((prev) => Math.min(convos.length - 1, prev + 1));
    },
    Enter: () => {
      if (selectedConversation()) return;
      const convos = filteredConversations();
      if (selectedIndex() >= 0 && selectedIndex() < convos.length) {
        setSelectedConversation(convos[selectedIndex()].number);
      }
    },
    Backspace: () => {
      if (selectedConversation()) {
        setSelectedConversation(null);
        return;
      }
      router.goBack();
    },
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

  const attachByUrl = async () => {
    const input = await uiPrompt('Pega URL de imagen, video o audio', { title: 'Adjuntar' });
    const nextUrl = sanitizeMediaUrl(input);
    if (nextUrl) {
      setAttachmentUrl(nextUrl);
      return;
    }
    if (input && input.trim()) uiAlert('URL invalida o formato no permitido');
  };
  
  const getContactName = (number: string) => {
    const contact = contactsState.contacts.find(c => c.number === number);
    return contact?.display || number;
  };

  const isKnownContact = (number: string) => contactsState.contacts.some((contact) => contact.number === number);

  const addContactFromMessage = async (display: string, number: string) => {
    if (isKnownContact(number)) {
      uiAlert('El contacto ya existe');
      return;
    }
    const added = await contactsActions.add(display, number);
    uiAlert(added ? 'Contacto agregado' : 'No se pudo agregar el contacto');
  };

  const getPreviewText = (message: any) => {
    if (getMediaUrl(message)) return 'Adjunto multimedia';
    const shared = parseSharedContactMessage(message?.message);
    if (shared) return `Contacto: ${shared.display}`;
    return sanitizeText(message?.message || '', 80) || 'Mensaje';
  };

  const openNewChat = async () => {
    const input = await uiPrompt('Numero para iniciar chat', { title: 'Nuevo chat' });
    const number = sanitizeText(input, 20);
    if (!number) return;
    setSelectedConversation(number);
  };

  const sendLocationText = async () => {
    const number = selectedConversation();
    if (!number) return;
    const x = Number(await uiPrompt('Coordenada X', { title: 'Compartir ubicacion' }));
    const y = Number(await uiPrompt('Coordenada Y', { title: 'Compartir ubicacion' }));
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    await messagesActions.send(number, `📍 Ubicacion compartida LOC:${x.toFixed(2)},${y.toFixed(2)}`);
  };
  
  return (
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
        isKnownContact={isKnownContact}
        onAddContact={addContactFromMessage}
        onBack={() => setSelectedConversation(null)}
        onDeleteConversation={() => void deleteConversation(selectedConversation()!)}
      />
    }>
      <AppScaffold title="Mensajes" subtitle="Tus conversaciones" onBack={() => router.goBack()}>
        <div class={styles.messagesApp}>
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
                          <span class={styles.message}>{getPreviewText(convo.lastMessage)}</span>
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
          <AppFAB class={styles.fab} icon="+" onClick={openNewChat} />
        </div>
      </AppScaffold>
      <MediaLightbox url={viewerUrl()} onClose={() => setViewerUrl(null)} />
    </Show>
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
  isKnownContact: (number: string) => boolean;
  onAddContact: (display: string, number: string) => void;
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
              <Show when={parseSharedContactMessage(msg.message)} fallback={
                <>
                  <span class={styles.messageText}>{sanitizeText(msg.message || '', 800)}</span>
                  <Show when={extractCoords(msg.message)}>
                    {(coords) => (
                      <button class={styles.mapBtn} onClick={() => props.onOpenCoords(coords().x, coords().y)}>
                        Abrir en mapa
                      </button>
                    )}
                  </Show>
                </>
              }>
                {(shared) => (
                  <div class={styles.contactCard}>
                    <div class={styles.contactCardLabel}>Contacto compartido</div>
                    <div class={styles.contactCardName}>{shared().display}</div>
                    <div class={styles.contactCardNumber}>{shared().number}</div>
                    <button
                      class={styles.contactCardBtn}
                      disabled={props.isKnownContact(shared().number)}
                      onClick={() => props.onAddContact(shared().display, shared().number)}
                    >
                      {props.isKnownContact(shared().number) ? 'Ya agregado' : 'Agregar contacto'}
                    </button>
                  </div>
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
        <EmojiPickerButton value={props.messageInput} onChange={props.onInput} maxLength={800} />
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
