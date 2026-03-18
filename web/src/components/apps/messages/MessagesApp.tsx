import { createMemo, createSelector, createSignal, For, Show, createEffect, onMount } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { useMessages } from '../../../store/messages';
import { useContacts } from '../../../store/contacts';
import { usePhoneState } from '../../../store/phone';
import { usePhoneKeyHandler } from '../../../hooks/usePhoneKeyHandler';
import { fetchNui } from '../../../utils/fetchNui';
import { formatPhoneNumber, generateColorForString, timeAgo } from '../../../utils/misc';
import { resolveMediaType, sanitizeMediaUrl, sanitizePhone, sanitizeText } from '../../../utils/sanitize';
import { parseSharedContactMessage } from '../../../utils/contactShare';
import { uiPrompt } from '../../../utils/uiDialog';
import { uiAlert } from '../../../utils/uiAlert';
import { ActionSheet } from '../../shared/ui/ActionSheet';
import { InlineNotice } from '../../shared/ui/InlineNotice';
import { LetterAvatar } from '../../shared/ui/LetterAvatar';
import { MediaLightbox } from '../../shared/ui/MediaLightbox';
import { SkeletonList } from '../../shared/ui/SkeletonList';
import { VirtualList } from '../../shared/ui/VirtualList';
import { EmojiPickerButton } from '../../shared/ui/EmojiPicker';
import { AppFAB, AppScaffold } from '../../shared/layout';
import { getStoredLanguage, t } from '../../../i18n';
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
  const phoneState = usePhoneState();
  const [messagesState, messagesActions] = useMessages();
  const [contactsState, contactsActions] = useContacts();
  const [selectedConversation, setSelectedConversation] = createSignal<string | null>(null);
  const [messageInput, setMessageInput] = createSignal('');
  const [attachmentUrl, setAttachmentUrl] = createSignal<string | null>(null);
  const [viewerUrl, setViewerUrl] = createSignal<string | null>(null);
  const [selectedIndex, setSelectedIndex] = createSignal(-1);
  const [search, setSearch] = createSignal('');
  const [showUnreadOnly, setShowUnreadOnly] = createSignal(false);
  const [routeConversationName, setRouteConversationName] = createSignal('');
  const language = () => phoneState.settings.language || 'es';

  const getMediaUrl = (msg: any): string | undefined => sanitizeMediaUrl(msg.mediaUrl || msg.media_url) || undefined;
  const isReadOnly = createMemo(() => phoneState.accessMode === 'foreign-readonly');
  const contactsByNumber = createMemo(() => {
    const map = new Map<string, string>();

    for (const contact of contactsState.contacts) {
      map.set(contact.number, contact.display || contact.number);
    }

    return map;
  });
  const knownContactNumbers = createMemo(() => new Set(contactsState.contacts.map((contact) => contact.number)));
  
  const conversations = createMemo(() => {
    const convos: Map<string, { number: string; display: string; lastMessage: any; unread: number }> = new Map();
    
    for (const msg of messagesState.messages) {
      const number = msg.owner === 1 ? msg.receiver : msg.transmitter;
      const msgTime = new Date(msg.time).getTime();
      
      if (!convos.has(number)) {
        convos.set(number, {
          number,
          display: contactsByNumber().get(number) || number,
          lastMessage: { ...msg, _timeMs: msgTime },
          unread: 0
        });
      }
      
      const convo = convos.get(number)!;
      if (msgTime > (convo.lastMessage._timeMs || 0)) {
        convo.lastMessage = { ...msg, _timeMs: msgTime };
      }
      
      if (!msg.isRead && msg.owner === 0) {
        convo.unread++;
      }
    }
    
    return Array.from(convos.values()).sort(
      (a, b) => (b.lastMessage._timeMs || 0) - (a.lastMessage._timeMs || 0)
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
    const number = sanitizePhone(typeof params.phoneNumber === 'string' ? params.phoneNumber : typeof params.number === 'string' ? params.number : '');
    const display = sanitizeText(
      typeof params.display === 'string' ? params.display : typeof params.displayName === 'string' ? params.displayName : '',
      80,
    );
    const mediaUrl = sanitizeMediaUrl(typeof params.attachmentUrl === 'string' ? params.attachmentUrl : '');
    if (!number) return;
    setSelectedConversation(number);
    setRouteConversationName(display || '');
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
        openConversation(convos[selectedIndex()].number, convos[selectedIndex()].display);
      }
    },
    Backspace: () => {
      if (selectedConversation()) {
        setSelectedConversation(null);
        setRouteConversationName('');
        return;
      }
      router.goBack();
    },
  });
  
  const openConversation = (number: string, display?: string) => {
    setSelectedConversation(number);
    setRouteConversationName(sanitizeText(display, 80));
    messagesActions.markAsRead(number);
  };

  const deleteConversation = async (number: string) => {
    if (isReadOnly()) return;
    const ok = await messagesActions.deleteConversation(number);
    if (ok && selectedConversation() === number) {
      setSelectedConversation(null);
      setRouteConversationName('');
    }
  };
  
  const getConversationMessages = () => {
    const number = selectedConversation();
    if (!number) return [];
    return messagesActions.getConversation(number);
  };
  
  const sendMessage = async () => {
    if (isReadOnly()) return;
    const number = selectedConversation();
    const content = sanitizeText(messageInput(), 800);
    const media = sanitizeMediaUrl(attachmentUrl());
    if (!number || (!content && !media)) return;
    
    await messagesActions.send(number, content, media || undefined);
    setMessageInput('');
    setAttachmentUrl(null);
  };

  const attachFromGallery = async () => {
    if (isReadOnly()) return;
    const gallery = await fetchNui<any[]>('getGallery', undefined, []);
    if (gallery && gallery.length > 0) {
      const nextUrl = sanitizeMediaUrl(gallery[0].url);
      if (nextUrl) setAttachmentUrl(nextUrl);
    }
  };

  const attachFromCamera = async () => {
    if (isReadOnly()) return;
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
    if (isReadOnly()) return;
    const input = await uiPrompt(t('messages.prompt.media_url', language()), { title: t('messages.attach', language()) });
    const nextUrl = sanitizeMediaUrl(input);
    if (nextUrl) {
      setAttachmentUrl(nextUrl);
      return;
    }
    if (input && input.trim()) uiAlert(t('messages.error.invalid_media_url', language()));
  };
  
  const getContactName = (number: string) => {
    return contactsByNumber().get(number) || number;
  };

  const isKnownContact = (number: string) => knownContactNumbers().has(number);

  const addContactFromMessage = async (display: string, number: string) => {
    if (isReadOnly()) return;
    if (isKnownContact(number)) {
      uiAlert(t('messages.contact_exists', language()));
      return;
    }
    const added = await contactsActions.add(display, number);
    uiAlert(added ? t('messages.contact_added', language()) : t('messages.contact_add_failed', language()));
  };

  const getPreviewText = (message: any) => {
    if (getMediaUrl(message)) return t('messages.media_attachment', language());
    const shared = parseSharedContactMessage(message?.message);
    if (shared) return `Contacto: ${shared.display}`;
    return sanitizeText(message?.message || '', 80) || t('messages.message_placeholder', language());
  };

  const openNewChat = async () => {
    if (isReadOnly()) return;
    const input = await uiPrompt(t('messages.prompt.new_chat_number', language()), { title: t('messages.new_chat', language()) });
    const number = sanitizePhone(input);
    if (!number) return;
    setSelectedConversation(number);
    setRouteConversationName('');
  };

  const sendLocationText = async () => {
    if (isReadOnly()) return;
    const number = selectedConversation();
    if (!number) return;
    const x = Number(await uiPrompt(t('messages.prompt.coord_x', language()), { title: t('maps.share_location', language()) }));
    const y = Number(await uiPrompt(t('messages.prompt.coord_y', language()), { title: t('maps.share_location', language()) }));
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    await messagesActions.send(number, `📍 ${t('maps.share_location', language())} LOC:${x.toFixed(2)},${y.toFixed(2)}`);
  };
  
  return (
    <>
      <Show when={!selectedConversation()} fallback={
        <ConversationView
          phoneNumber={formatPhoneNumber(selectedConversation()!, phoneState.framework || 'unknown')}
          contactName={routeConversationName() || getContactName(selectedConversation()!)}
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
        onBack={() => {
          setSelectedConversation(null);
          setRouteConversationName('');
        }}
        onDeleteConversation={() => void deleteConversation(selectedConversation()!)}
        framework={phoneState.framework || 'unknown'}
        readOnly={isReadOnly()}
        readOnlyOwnerName={phoneState.accessOwnerName}
      />
    }>
        <AppScaffold title={t('messages.title', language())} subtitle={t('messages.subtitle', language())} onBack={() => router.goBack()} bodyPadding="none">
          <div class={styles.messagesApp}>
            <Show when={isReadOnly()}>
              <InlineNotice title={t('messages.readonly_title', language())} message={t('messages.readonly_message', language(), { name: phoneState.accessOwnerName || t('common.other_person', language()) })} />
            </Show>
            <div class={styles.conversationList}>
              <Show
                when={messagesState.loading}
                fallback={
                  <VirtualList items={filteredConversations} itemHeight={78} overscan={5}>
                    {(convo, index) => (
                      <div
                        class={styles.conversationItem}
                        classList={{ [styles.selected]: isSelectedConversationIndex(index()) }}
                        onClick={() => openConversation(convo.number, convo.display)}
                      >
                      <LetterAvatar class={styles.avatar} color={generateColorForString(convo.number)} label={convo.display} />
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
                        <Show when={!isReadOnly()}>
                          <button class={styles.deleteConversationBtn} onClick={(e) => { e.stopPropagation(); void deleteConversation(convo.number); }}>
                            {t('messages.delete', language())}
                          </button>
                        </Show>
                      </div>
                    )}
                  </VirtualList>
                }
              >
                <SkeletonList rows={6} avatar />
              </Show>
            </div>
            <Show when={!isReadOnly()}>
              <AppFAB class={styles.fab} icon="+" onClick={openNewChat} />
            </Show>
          </div>
        </AppScaffold>
      </Show>
      <MediaLightbox url={viewerUrl()} onClose={() => setViewerUrl(null)} />
    </>
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
  framework?: 'esx' | 'qbcore' | 'qbox' | 'unknown';
  readOnly?: boolean;
  readOnlyOwnerName?: string;
}) {
  const language = () => getStoredLanguage();
  let messagesEnd: HTMLDivElement | undefined;
  const [showAttachSheet, setShowAttachSheet] = createSignal(false);
  const [selectedMessage, setSelectedMessage] = createSignal<string | null>(null);

  onMount(() => {
    messagesEnd?.scrollIntoView({ behavior: 'auto' });
  });
  
  createEffect(() => {
    if (props.messages.length > 0) {
      messagesEnd?.scrollIntoView({ behavior: 'smooth' });
    }
  });
  
  return (
    <AppScaffold
      title={props.contactName}
      subtitle={props.phoneNumber}
      onBack={props.onBack}
      bodyClass={styles.conversationView}
      bodyPadding="none"
      headerRight={props.readOnly ? undefined : <button class={styles.deleteConversationBtn} onClick={props.onDeleteConversation}>{t('messages.delete', language())}</button>}
    >
      <Show when={props.readOnly}>
        <InlineNotice title={t('messages.readonly_title', language())} message={t('messages.readonly_conversation', language(), { name: props.readOnlyOwnerName || t('messages.this_phone', language()) })} />
      </Show>
      <div class={styles.messagesList}>
        <For each={props.messages}>
          {(msg) => (
            <div
              class={styles.messageBubble}
              classList={{
                [styles.sent]: msg.owner === 1,
                [styles.received]: msg.owner === 0
              }}
              onClick={() => setSelectedMessage(sanitizeText(msg.message || '', 800))}
            >
              <Show when={parseSharedContactMessage(msg.message)} fallback={
                <>
                  <span class={styles.messageText}>{sanitizeText(msg.message || '', 800)}</span>
                  <Show when={extractCoords(msg.message)}>
                    {(coords) => (
                      <button class={styles.mapBtn} onClick={() => props.onOpenCoords(coords().x, coords().y)}>
                        {t('messages.open_map', language())}
                      </button>
                    )}
                  </Show>
                </>
              }>
                {(shared) => (
                  <div class={styles.contactCard}>
                    <div class={styles.contactCardLabel}>{t('messages.shared_contact', language())}</div>
                    <div class={styles.contactCardName}>{shared().display}</div>
                    <div class={styles.contactCardNumber}>{formatPhoneNumber(shared().number, props.framework || 'unknown')}</div>
                    <Show when={!props.readOnly}>
                      <button
                        class={styles.contactCardBtn}
                        disabled={props.isKnownContact(shared().number)}
                        onClick={() => props.onAddContact(shared().display, shared().number)}
                      >
                         {props.isKnownContact(shared().number) ? t('messages.already_added', language()) : t('messages.add_contact', language())}
                      </button>
                    </Show>
                  </div>
                )}
              </Show>
              <Show when={props.getMediaUrl(msg)}>
                <Show when={resolveMediaType(props.getMediaUrl(msg)) === 'image'}>
                  <img class={styles.messageImage} src={props.getMediaUrl(msg)!} alt={t('messages.attach', language())} onClick={() => props.onOpenViewer(props.getMediaUrl(msg) || null)} />
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

      <Show when={props.attachmentUrl && !props.readOnly}>
        <div class={styles.attachmentPreview}>
          <Show when={resolveMediaType(props.attachmentUrl || undefined) === 'image'}>
            <img src={props.attachmentUrl!} alt={t('messages.attach', language())} onClick={() => props.onOpenViewer(props.attachmentUrl)} />
          </Show>
          <Show when={resolveMediaType(props.attachmentUrl || undefined) === 'video'}>
            <video src={props.attachmentUrl!} controls playsinline preload="metadata" />
          </Show>
          <Show when={resolveMediaType(props.attachmentUrl || undefined) === 'audio'}>
            <audio class={styles.messageAudio} src={props.attachmentUrl!} controls preload="metadata" />
          </Show>
          <button onClick={props.onClearAttachment}>{t('messages.remove', language())}</button>
        </div>
      </Show>

      <Show when={!props.readOnly}>
        <div class={styles.inputContainer}>
          <EmojiPickerButton value={props.messageInput} onChange={props.onInput} maxLength={800} />
          <button class={styles.attachBtn} onClick={() => setShowAttachSheet(true)}>＋</button>
          <input
            type="text"
            placeholder={t('messages.message_placeholder', language())}
            value={props.messageInput}
            onInput={(e) => props.onInput(e.currentTarget.value)}
            onKeyPress={(e) => e.key === 'Enter' && props.onSend()}
          />
          <button class={styles.sendBtn} onClick={props.onSend}>
            ➤
          </button>
        </div>
      </Show>

      <ActionSheet
        open={!props.readOnly && showAttachSheet()}
        title={t('messages.attach', language())}
        onClose={() => setShowAttachSheet(false)}
        actions={[
          { label: t('messages.attach_gallery', language()), tone: 'primary', onClick: props.onAttachGallery },
          { label: t('messages.attach_camera', language()), onClick: props.onAttachCamera },
          { label: t('messages.attach_url', language()), onClick: props.onAttachUrl },
          { label: t('maps.share_location', language()), onClick: props.onSendLocation },
          { label: t('messages.remove_attachment', language()), tone: 'danger', onClick: props.onClearAttachment },
        ]}
      />

      <ActionSheet
        open={selectedMessage() !== null}
        title="Mensaje"
        onClose={() => setSelectedMessage(null)}
        actions={[
          {
            label: 'Guardar en Notas',
            tone: 'primary',
            onClick: () => {
              const text = selectedMessage();
              if (!text) return;
              try {
                const raw = localStorage.getItem('gcphone:notes');
                const notes: any[] = raw ? JSON.parse(raw) : [];
                notes.push({ id: Date.now(), title: 'Mensaje guardado', content: text, color: '#007aff' });
                localStorage.setItem('gcphone:notes', JSON.stringify(notes));
                uiAlert('Mensaje guardado en Notas');
              } catch {
                uiAlert('Error al guardar nota');
              }
              setSelectedMessage(null);
            },
          },
          {
            label: 'Copiar texto',
            onClick: () => {
              const text = selectedMessage();
              if (text) navigator.clipboard.writeText(text).catch(() => {});
              setSelectedMessage(null);
            },
          },
          {
            label: 'Cerrar',
            onClick: () => setSelectedMessage(null),
          },
        ]}
      />
    </AppScaffold>
  );
}
