import { createMemo, createSelector, createSignal, For, Show, createEffect, onMount } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { useMessages } from '../../../store/messages';
import { useContacts } from '../../../store/contacts';
import { usePhoneState } from '../../../store/phone';
import { usePhoneKeyHandler } from '../../../hooks/usePhoneKeyHandler';
import { useContextMenu } from '../../../hooks/useContextMenu';
import { useMediaAttachment } from '../../../hooks/useMediaAttachment';
import { fetchNui } from '../../../utils/fetchNui';
import { formatPhoneNumber, generateColorForString, timeAgo } from '../../../utils/misc';
import { resolveMediaType, sanitizeMediaUrl, sanitizePhone, sanitizeText } from '../../../utils/sanitize';
import { parseSharedContactMessage } from '../../../utils/contactShare';
import { uiPrompt } from '../../../utils/uiDialog';
import { uiAlert } from '../../../utils/uiAlert';
import { getPlayerCoords, formatLocationMessage } from '../../../utils/playerLocation';
import { useInternalEvent } from '../../../utils/internalEvents';
import { ActionSheet } from '../../shared/ui/ActionSheet';
import { InlineNotice } from '../../shared/ui/InlineNotice';
import { LetterAvatar } from '../../shared/ui/LetterAvatar';
import { MediaLightbox } from '../../shared/ui/MediaLightbox';
import { SkeletonList } from '../../shared/ui/SkeletonList';
import { VirtualList } from '../../shared/ui/VirtualList';
import { EmojiPickerButton } from '../../shared/ui/EmojiPicker';
import { ShareSheet, type SharePayload } from '../../shared/ui/ShareSheet';
import { AppFAB, AppScaffold } from '../../shared/layout';
import { getStoredLanguage, t } from '../../../i18n';
import styles from './MessagesApp.module.scss';

function parseSocialPost(text?: string): { type: 'chirp' | 'snap'; id: number } | null {
  if (!text) return null;
  const match = text.match(/^(CHIRP|SNAP):(\d+)$/);
  if (!match) return null;
  return { type: match[1].toLowerCase() as 'chirp' | 'snap', id: Number(match[2]) };
}

function extractCoords(text?: string): { x: number; y: number } | null {
  if (!text) return null;
  const match = text.match(/LOC:([\-\d.]+),\s*([\-\d.]+)/i);
  if (!match) return null;
  const x = Number(match[1]);
  const y = Number(match[2]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

interface SocialPreview {
  type: 'chirp' | 'snap';
  id: number;
  username?: string;
  display_name?: string;
  avatar?: string;
  content?: string;
  caption?: string;
  media_url?: string;
  verified?: boolean;
}

function SocialPostCard(props: { post: { type: 'chirp' | 'snap'; id: number }; onOpen: (type: string, id: number) => void }) {
  const [preview, setPreview] = createSignal<SocialPreview | null>(null);
  const [failed, setFailed] = createSignal(false);

  onMount(async () => {
    const result = await fetchNui<SocialPreview | null>('getPostPreview', { type: props.post.type, id: props.post.id }, null);
    if (result) setPreview(result);
    else setFailed(true);
  });

  return (
    <Show when={!failed()} fallback={
      <span class={styles.messageText}>{props.post.type === 'chirp' ? 'Tweet eliminado' : 'Post eliminado'}</span>
    }>
      <Show when={preview()} fallback={
        <span class={styles.messageText}>{props.post.type === 'chirp' ? 'Cargando tweet...' : 'Cargando post...'}</span>
      }>
        {(p) => (
          <div class={styles.socialCard} onClick={() => props.onOpen(p().type, p().id)}>
            <div class={styles.socialCardHeader}>
              <Show when={p().avatar}>
                <img class={styles.socialCardAvatar} src={p().avatar!} alt="" />
              </Show>
              <span class={styles.socialCardUser}>{p().display_name || p().username}</span>
              <span class={styles.socialCardApp}>{p().type === 'chirp' ? 'Chirp' : 'Snap'}</span>
            </div>
            <Show when={p().content || p().caption}>
              <p class={styles.socialCardText}>{sanitizeText((p().content || p().caption) ?? '', 140)}</p>
            </Show>
            <Show when={p().media_url}>
              <img class={styles.socialCardMedia} src={p().media_url!} alt="" />
            </Show>
          </div>
        )}
      </Show>
    </Show>
  );
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
  const ctxMenu = useContextMenu<any>();
  const [routeConversationName, setRouteConversationName] = createSignal('');
  const [replyTo, setReplyTo] = createSignal<{ id: number; snippet: string; sender: string } | null>(null);
  const [forwardPayload, setForwardPayload] = createSignal<SharePayload | null>(null);
  const [remoteTyping, setRemoteTyping] = createSignal<string | null>(null);
  let typingTimeout: number | undefined;
  let typingDebounce: number | undefined;
  const language = () => phoneState.settings.language || 'es';

  const handleTypingInput = (value: string) => {
    setMessageInput(value);
    const convo = selectedConversation();
    if (!convo || !value) return;
    if (typingDebounce) return;
    typingDebounce = window.setTimeout(() => { typingDebounce = undefined; }, 1500);
    void fetchNui('messageTyping', { to: convo });
  };

  useInternalEvent<{ from?: string }>('messages:remoteTyping', (detail) => {
    if (!detail?.from) return;
    if (detail.from !== selectedConversation()) return;
    setRemoteTyping(detail.from);
    if (typingTimeout) clearTimeout(typingTimeout);
    typingTimeout = window.setTimeout(() => setRemoteTyping(null), 3000);
  });

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
    const mediaFile = sanitizeMediaUrl(attachmentUrl());
    if (!number || (!content && !mediaFile)) return;

    const reply = replyTo();
    await messagesActions.send({
      phoneNumber: number,
      message: content,
      mediaUrl: mediaFile || undefined,
      replyToId: reply?.id,
    });
    setMessageInput('');
    setAttachmentUrl(null);
    setReplyTo(null);
  };

  const sendVoiceMessage = async (audioData: string, duration: number) => {
    if (isReadOnly()) return;
    const number = selectedConversation();
    if (!number) return;

    // audioData is already a URL from the upload provider
    await messagesActions.send({
      phoneNumber: number,
      message: '[Audio]',
      messageType: 'audio',
      audioData,
      audioDuration: duration,
    });
  };

  const recordAndSendVoice = async () => {
    if (isReadOnly()) return;
    const number = selectedConversation();
    if (!number) return;

    // Get upload config from server
    const config = await fetchNui<{ url?: string; field?: string; headers?: Record<string, string> }>(
      'getAudioUploadConfig', {}, { url: '', field: 'file' }
    );

    const { startAudioRecording, uploadAudioBlob } = await import('../../../utils/audioRecorder');

    await startAudioRecording(
      async (recording) => {
        let audioUrl: string | null = null;

        if (config?.url) {
          audioUrl = await uploadAudioBlob(recording.blob, {
            url: config.url,
            field: config.field || 'file',
            headers: config.headers,
          });
        }

        if (audioUrl) {
          await sendVoiceMessage(audioUrl, Math.ceil(recording.durationMs / 1000));
        }
      },
      (error) => {
        console.warn('[Messages] Voice recording error:', error);
      },
    );
  };

  const handleReply = (messageId: number) => {
    const msgs = getConversationMessages();
    const msg = msgs.find((m: any) => m.id === messageId);
    if (!msg) return;
    setReplyTo({
      id: msg.id,
      snippet: sanitizeText(msg.message || '', 80),
      sender: msg.owner === 1 ? 'You' : getContactName(selectedConversation()!),
    });
  };

  const handleReact = async (messageId: number, emoji: string) => {
    await messagesActions.react(messageId, emoji);
  };

  const sendPayment = async () => {
    if (isReadOnly()) return;
    const number = selectedConversation();
    if (!number) return;
    const input = await uiPrompt('Monto a enviar', { title: 'Enviar pago' });
    const amount = parseInt(input || '0', 10);
    if (!amount || amount < 1) return;
    const result = await fetchNui<{ success?: boolean; balance?: number; error?: string }>('walletChatTransfer', {
      targetPhone: number,
      amount,
      title: 'Pago via chat',
    });
    if (result?.success) {
      await messagesActions.send({ phoneNumber: number, message: `[Pago enviado: $${amount}]` });
      uiAlert(`Pago de $${amount} enviado`);
    } else {
      uiAlert(result?.error === 'INSUFFICIENT_FUNDS' ? 'Fondos insuficientes' : 'Error al enviar pago');
    }
  };

  const handleForward = (msg: any) => {
    const mediaUrl = sanitizeMediaUrl(msg.mediaUrl || msg.media_url) || undefined;
    setForwardPayload({
      text: msg.message_type === 'audio' ? '' : sanitizeText(msg.message || '', 800),
      mediaUrl,
    });
  };

  const media = useMediaAttachment({ onAttached: (url) => setAttachmentUrl(url) });
  
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
    const coords = await getPlayerCoords();
    if (!coords) return;
    await messagesActions.send({ phoneNumber: number, message: formatLocationMessage(coords, t('maps.share_location', language())) });
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
          onInput={handleTypingInput}
          isTyping={remoteTyping() !== null}
          onSend={sendMessage}
          onSendVoice={sendVoiceMessage}
          onRecordVoice={recordAndSendVoice}
          onReply={handleReply}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          onReact={handleReact}
          onForward={handleForward}
          onAttachGallery={media.attachFromGallery}
          onAttachCamera={media.attachFromCamera}
          onAttachUrl={media.attachByUrl}
          onSendLocation={sendLocationText}
          onSendPayment={sendPayment}
          onOpenCoords={(x, y) => router.navigate('maps', { x, y })}
          onClearAttachment={() => setAttachmentUrl(null)}
          onOpenViewer={setViewerUrl}
          getMediaUrl={getMediaUrl}
          isKnownContact={isKnownContact}
          onAddContact={addContactFromMessage}
          onBack={() => {
            setSelectedConversation(null);
            setRouteConversationName('');
            setReplyTo(null);
          }}
          onDeleteConversation={() => void deleteConversation(selectedConversation()!)}
          framework={phoneState.framework || 'unknown'}
          readOnly={isReadOnly()}
          readOnlyOwnerName={phoneState.accessOwnerName}
          myNumber={phoneState.settings.phoneNumber}
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
                        onContextMenu={ctxMenu.onContextMenu(convo)}
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
      <ShareSheet
        open={forwardPayload() !== null}
        payload={forwardPayload() || { text: '' }}
        destinations={['messages', 'wavechat', 'mail']}
        onClose={() => setForwardPayload(null)}
      />

      <ActionSheet
        open={ctxMenu.isOpen()}
        title={ctxMenu.item()?.display || ctxMenu.item()?.number || ''}
        onClose={ctxMenu.close}
        actions={[
          {
            label: t('messages.title', language()),
            tone: 'primary',
            onClick: () => {
              const c = ctxMenu.item();
              if (!c) return;
              ctxMenu.close();
              openConversation(c.number, c.display);
            },
          },
          {
            label: t('contacts.call', language()),
            onClick: () => {
              const c = ctxMenu.item();
              if (!c) return;
              ctxMenu.close();
              fetchNui('startCall', { phoneNumber: c.number });
            },
          },
          {
            label: t('messages.delete', language()),
            tone: 'danger',
            onClick: () => {
              const c = ctxMenu.item();
              if (!c) return;
              ctxMenu.close();
              void deleteConversation(c.number);
            },
          },
        ]}
      />
    </>
  );
}

const REACTION_EMOJIS = ['\u{1F44D}', '\u{2764}\u{FE0F}', '\u{1F602}', '\u{1F62E}', '\u{1F622}', '\u{1F525}'];

function MessageStatusIcon(props: { status?: string; owner: number }) {
  if (props.owner !== 1) return null;
  const s = props.status || 'sent';
  return (
    <span class={styles.statusIcon} classList={{ [styles.statusRead]: s === 'read' }}>
      {s === 'sent' ? '\u2713' : '\u2713\u2713'}
    </span>
  );
}

function AudioPlayerBubble(props: { audioData: string; duration?: number }) {
  const [playing, setPlaying] = createSignal(false);
  const [progress, setProgress] = createSignal(0);
  let audioRef: HTMLAudioElement | undefined;

  const play = () => {
    if (!audioRef) {
      // Support both URL (new) and base64 (legacy) formats
      const isUrl = props.audioData.startsWith('http://') || props.audioData.startsWith('https://');
      let src: string;
      if (isUrl) {
        src = props.audioData;
      } else {
        const blob = new Blob(
          [Uint8Array.from(atob(props.audioData), c => c.charCodeAt(0))],
          { type: 'audio/webm' }
        );
        src = URL.createObjectURL(blob);
      }
      audioRef = new Audio(src);
      audioRef.addEventListener('timeupdate', () => {
        if (audioRef && audioRef.duration > 0) setProgress(audioRef.currentTime / audioRef.duration);
      });
      audioRef.addEventListener('ended', () => { setPlaying(false); setProgress(0); });
    }
    if (playing()) {
      audioRef.pause();
      setPlaying(false);
    } else {
      void audioRef.play();
      setPlaying(true);
    }
  };

  return (
    <div class={styles.audioBubble} onClick={play}>
      <span class={styles.audioPlayBtn}>{playing() ? '\u23F8' : '\u25B6'}</span>
      <div class={styles.audioProgress}>
        <div class={styles.audioProgressBar} style={{ width: `${Math.round(progress() * 100)}%` }} />
      </div>
      <span class={styles.audioDuration}>{props.duration ? `${props.duration}s` : ''}</span>
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
  onSendVoice: (audioData: string, duration: number) => void;
  onRecordVoice: () => void;
  onReply: (messageId: number) => void;
  replyTo: () => { id: number; snippet: string; sender: string } | null;
  onCancelReply: () => void;
  onReact: (messageId: number, emoji: string) => void;
  onForward: (msg: any) => void;
  onAttachGallery: () => void;
  onAttachCamera: () => void;
  onAttachUrl: () => void;
  onSendLocation: () => void;
  onSendPayment: () => void;
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
  myNumber?: string;
  isTyping?: boolean;
}) {
  const router = useRouter();
  const language = () => getStoredLanguage();
  let messagesEnd: HTMLDivElement | undefined;
  const [showAttachSheet, setShowAttachSheet] = createSignal(false);
  const [selectedMessage, setSelectedMessage] = createSignal<any>(null);
  const [reactionPickerMsg, setReactionPickerMsg] = createSignal<number | null>(null);

  onMount(() => {
    messagesEnd?.scrollIntoView({ behavior: 'auto' });
  });

  createEffect(() => {
    if (props.messages.length > 0) {
      messagesEnd?.scrollIntoView({ behavior: 'smooth' });
    }
  });

  const openMessageActions = (msg: any) => {
    setSelectedMessage(msg);
  };

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
              onClick={() => openMessageActions(msg)}
              onDblClick={() => !props.readOnly && setReactionPickerMsg(msg.id)}
            >
              {/* Quote/Reply reference */}
              <Show when={msg.reply_to_id && msg.reply_snippet}>
                <div class={styles.replyQuote}>
                  <span class={styles.replyQuoteSender}>
                    {msg.reply_sender === props.myNumber ? props.contactName : 'You'}
                  </span>
                  <span class={styles.replyQuoteText}>
                    {sanitizeText(msg.reply_snippet || '', 80)}
                  </span>
                </div>
              </Show>

              {/* Voice message */}
              <Show when={msg.message_type === 'audio' && msg.audio_data} fallback={
                <Show when={parseSharedContactMessage(msg.message)} fallback={
                  <Show when={parseSocialPost(msg.message)} fallback={
                    <>
                      <span class={styles.messageText}>{sanitizeText(msg.message || '', 800)}</span>
                      <Show when={extractCoords(msg.message)}>
                        {(coords) => (
                          <button class={styles.mapBtn} onClick={(e) => { e.stopPropagation(); props.onOpenCoords(coords().x, coords().y); }}>
                            {t('messages.open_map', language())}
                          </button>
                        )}
                      </Show>
                    </>
                  }>
                    {(social) => (
                      <SocialPostCard
                        post={social()}
                        onOpen={(type, id) => router.navigate(type === 'chirp' ? 'chirp' : 'snap')}
                      />
                    )}
                  </Show>
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
                          onClick={(e) => { e.stopPropagation(); props.onAddContact(shared().display, shared().number); }}
                        >
                          {props.isKnownContact(shared().number) ? t('messages.already_added', language()) : t('messages.add_contact', language())}
                        </button>
                      </Show>
                    </div>
                  )}
                </Show>
              }>
                <AudioPlayerBubble audioData={msg.audio_data!} duration={msg.audio_duration} />
              </Show>

              <Show when={props.getMediaUrl(msg)}>
                <Show when={resolveMediaType(props.getMediaUrl(msg)) === 'image'}>
                  <img class={styles.messageImage} src={props.getMediaUrl(msg)!} alt={t('messages.attach', language())} onClick={(e) => { e.stopPropagation(); props.onOpenViewer(props.getMediaUrl(msg) || null); }} />
                </Show>
                <Show when={resolveMediaType(props.getMediaUrl(msg)) === 'video'}>
                  <video class={styles.messageImage} src={props.getMediaUrl(msg)!} controls playsinline preload="metadata" />
                </Show>
                <Show when={resolveMediaType(props.getMediaUrl(msg)) === 'audio'}>
                  <audio class={styles.messageAudio} src={props.getMediaUrl(msg)!} controls preload="metadata" />
                </Show>
              </Show>

              {/* Reactions */}
              <Show when={msg.reactions && msg.reactions.length > 0}>
                <div class={styles.reactionPills}>
                  <For each={msg.reactions}>
                    {(r: any) => <span class={styles.reactionPill}>{r.emoji}</span>}
                  </For>
                </div>
              </Show>

              <div class={styles.messageFooter}>
                <span class={styles.messageTime}>{timeAgo(msg.time)}</span>
                <MessageStatusIcon status={msg.status} owner={msg.owner} />
              </div>
            </div>
          )}
        </For>
        <Show when={props.isTyping}>
          <div class={styles.typingIndicator}>
            <span class={styles.typingDot} />
            <span class={styles.typingDot} />
            <span class={styles.typingDot} />
          </div>
        </Show>
        <div ref={messagesEnd} />
      </div>

      {/* Reaction picker overlay */}
      <Show when={reactionPickerMsg() !== null}>
        <div class={styles.reactionOverlay} onClick={() => setReactionPickerMsg(null)}>
          <div class={styles.reactionBar}>
            <For each={REACTION_EMOJIS}>
              {(emoji) => (
                <button
                  class={styles.reactionOption}
                  onClick={(e) => {
                    e.stopPropagation();
                    props.onReact(reactionPickerMsg()!, emoji);
                    setReactionPickerMsg(null);
                  }}
                >
                  {emoji}
                </button>
              )}
            </For>
          </div>
        </div>
      </Show>

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

      {/* Reply preview bar */}
      <Show when={props.replyTo()}>
        {(reply) => (
          <div class={styles.replyPreview}>
            <div class={styles.replyPreviewContent}>
              <span class={styles.replyPreviewSender}>{reply().sender}</span>
              <span class={styles.replyPreviewText}>{reply().snippet}</span>
            </div>
            <button class={styles.replyPreviewClose} onClick={props.onCancelReply}>&times;</button>
          </div>
        )}
      </Show>

      <Show when={!props.readOnly}>
        <div class={styles.inputContainer}>
          <EmojiPickerButton value={props.messageInput} onChange={props.onInput} maxLength={800} />
          <button class={styles.attachBtn} onClick={() => setShowAttachSheet(true)}>+</button>
          <input
            type="text"
            placeholder={t('messages.message_placeholder', language())}
            value={props.messageInput}
            onInput={(e) => props.onInput(e.currentTarget.value)}
            onKeyPress={(e) => e.key === 'Enter' && props.onSend()}
          />
          <button
            class={styles.sendBtn}
            onPointerDown={() => {
              (window as any).__gcMsgSendTimer = setTimeout(() => {
                (window as any).__gcMsgSendTimer = null;
                props.onRecordVoice();
              }, 500);
            }}
            onPointerUp={() => {
              if ((window as any).__gcMsgSendTimer) {
                clearTimeout((window as any).__gcMsgSendTimer);
                (window as any).__gcMsgSendTimer = null;
                props.onSend();
              }
            }}
            onPointerLeave={() => {
              if ((window as any).__gcMsgSendTimer) {
                clearTimeout((window as any).__gcMsgSendTimer);
                (window as any).__gcMsgSendTimer = null;
              }
            }}
          >
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
          { label: t('messages.voice_note', language()), onClick: () => { setShowAttachSheet(false); props.onRecordVoice(); } },
          { label: t('maps.share_location', language()), onClick: props.onSendLocation },
          { label: 'Enviar pago', onClick: props.onSendPayment },
          { label: t('messages.remove_attachment', language()), tone: 'danger', onClick: props.onClearAttachment },
        ]}
      />

      <ActionSheet
        open={selectedMessage() !== null}
        title={t('messages.action_title', language())}
        onClose={() => setSelectedMessage(null)}
        actions={[
          ...(!props.readOnly ? [
            {
              label: 'Responder',
              tone: 'primary' as const,
              onClick: () => {
                const msg = selectedMessage();
                if (!msg) return;
                props.onReply(msg.id);
                setSelectedMessage(null);
              },
            },
            {
              label: 'Reenviar',
              tone: 'default' as const,
              onClick: () => {
                const msg = selectedMessage();
                if (!msg) return;
                props.onForward(msg);
                setSelectedMessage(null);
              },
            },
          ] : []),
          {
            label: t('messages.save_to_notes', language()),
            onClick: () => {
              const msg = selectedMessage();
              if (!msg) return;
              try {
                const raw = localStorage.getItem('gcphone:notes');
                const notes: any[] = raw ? JSON.parse(raw) : [];
                notes.push({ id: Date.now(), title: t('messages.saved_note_title', language()), content: sanitizeText(msg.message || '', 800), color: '#007aff' });
                localStorage.setItem('gcphone:notes', JSON.stringify(notes));
                uiAlert(t('messages.saved_to_notes', language()));
              } catch {
                uiAlert(t('messages.save_note_error', language()));
              }
              setSelectedMessage(null);
            },
          },
          {
            label: t('messages.copy_text', language()),
            onClick: () => {
              const msg = selectedMessage();
              if (msg) navigator.clipboard.writeText(sanitizeText(msg.message || '', 800)).catch(() => {});
              setSelectedMessage(null);
            },
          },
          {
            label: t('messages.close', language()),
            onClick: () => setSelectedMessage(null),
          },
        ]}
      />
    </AppScaffold>
  );
}
