import { createMemo, createSelector, createSignal, For, Show, createEffect, onMount, onCleanup } from 'solid-js';
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
import { ConversationView } from './MessagesConversationView';
import styles from './MessagesApp.module.scss';

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
  let voiceRecorder: { stop: () => void; cancel: () => void } | null = null;
  let disposed = false;
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

  onCleanup(() => {
    disposed = true;
    if (typingDebounce) clearTimeout(typingDebounce);
    if (typingTimeout) clearTimeout(typingTimeout);
    if (voiceRecorder) {
      voiceRecorder.cancel();
      voiceRecorder = null;
    }
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

    const config = await fetchNui<{ url?: string; field?: string; headers?: Record<string, string>; useProxy?: boolean }>(
      'getAudioUploadConfig', {}, { url: '', field: 'file' }
    );

    const { startAudioRecording, uploadAudioBlob } = await import('../../../utils/audioRecorder');

    if (voiceRecorder) {
      voiceRecorder.cancel();
      voiceRecorder = null;
    }

    if (disposed) return;

    const handle = await startAudioRecording(
      async (recording) => {
        voiceRecorder = null;
        if (disposed) return;
        let audioUrl: string | null = null;

        if (config?.useProxy || config?.url) {
          audioUrl = await uploadAudioBlob(recording.blob, {
            url: config.url,
            field: config.field || 'file',
            headers: config.headers,
            useProxy: config.useProxy,
          }, fetchNui);
        }

        if (audioUrl) {
          await sendVoiceMessage(audioUrl, Math.ceil(recording.durationMs / 1000));
        }
      },
      (error) => {
        voiceRecorder = null;
        console.warn('[Messages] Voice recording error:', error);
      },
    );

    if (disposed) {
      handle.cancel();
      return;
    }
    voiceRecorder = handle;
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
    const input = await uiPrompt(t('messages.payment_amount', language()), { title: t('messages.payment_title', language()) });
    const amount = parseInt(input || '0', 10);
    if (!amount || amount < 1) return;
    const result = await fetchNui<{ success?: boolean; balance?: number; error?: string }>('walletChatTransfer', {
      targetPhone: number,
      amount,
      title: t('messages.payment_title', language()),
    });
    if (result?.success) {
      await messagesActions.send({ phoneNumber: number, message: `[${t('messages.payment_sent', language())}: $${amount}]` });
      uiAlert(t('messages.payment_success', language(), { amount: String(amount) }));
    } else {
      uiAlert(result?.error === 'INSUFFICIENT_FUNDS' ? t('messages.insufficient_funds', language()) : t('messages.payment_error', language()));
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
