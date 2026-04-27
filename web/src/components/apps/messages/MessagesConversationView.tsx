import { createSignal, For, Show, createEffect, onMount, onCleanup } from 'solid-js';
import type { Accessor } from 'solid-js';
import { useRouter } from '../../Phone/PhoneRouterContext';
import { fetchNui } from '../../../utils/fetchNui';
import { formatPhoneNumber, timeAgo } from '../../../utils/misc';
import { resolveMediaType, sanitizeText } from '../../../utils/sanitize';
import { parseSharedContactMessage } from '../../../utils/contactShare';
import { uiAlert } from '../../../utils/uiAlert';
import { ActionSheet } from '../../shared/ui/ActionSheet';
import { InlineNotice } from '../../shared/ui/InlineNotice';
import { EmojiPickerButton } from '../../shared/ui/EmojiPicker';
import { AppScaffold } from '../../shared/layout';
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

  const lang = () => getStoredLanguage();

  return (
    <Show when={!failed()} fallback={
      <span class={styles.messageText}>{t('messages.post_deleted', lang())}</span>
    }>
      <Show when={preview()} fallback={
        <span class={styles.messageText}>{t('messages.post_loading', lang())}</span>
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
  let blobUrl: string | undefined;

  const onTimeUpdate = () => {
    if (audioRef && audioRef.duration > 0) setProgress(audioRef.currentTime / audioRef.duration);
  };
  const onEnded = () => { setPlaying(false); setProgress(0); };

  const play = () => {
    if (!audioRef) {
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
        blobUrl = src;
      }
      audioRef = new Audio(src);
      audioRef.addEventListener('timeupdate', onTimeUpdate);
      audioRef.addEventListener('ended', onEnded);
    }
    if (playing()) {
      audioRef.pause();
      setPlaying(false);
    } else {
      void audioRef.play();
      setPlaying(true);
    }
  };

  onCleanup(() => {
    if (audioRef) {
      audioRef.removeEventListener('timeupdate', onTimeUpdate);
      audioRef.removeEventListener('ended', onEnded);
      audioRef.pause();
      audioRef.src = '';
    }
    if (blobUrl) URL.revokeObjectURL(blobUrl);
  });

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

export interface ConversationViewProps {
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
  replyTo: Accessor<{ id: number; snippet: string; sender: string } | null>;
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
}

export function ConversationView(props: ConversationViewProps) {
  const router = useRouter();
  const language = () => getStoredLanguage();
  let messagesEnd: HTMLDivElement | undefined;
  const [showAttachSheet, setShowAttachSheet] = createSignal(false);
  const [selectedMessage, setSelectedMessage] = createSignal<any>(null);
  const [reactionPickerMsg, setReactionPickerMsg] = createSignal<number | null>(null);
  let sendHoldTimer: number | undefined;

  onMount(() => {
    messagesEnd?.scrollIntoView({ behavior: 'auto' });
  });

  onCleanup(() => {
    if (sendHoldTimer) {
      clearTimeout(sendHoldTimer);
      sendHoldTimer = undefined;
    }
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
                        onOpen={(type, _id) => router.navigate(type === 'chirp' ? 'chirp' : 'snap')}
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
              if (sendHoldTimer) clearTimeout(sendHoldTimer);
              sendHoldTimer = window.setTimeout(() => {
                sendHoldTimer = undefined;
                props.onRecordVoice();
              }, 500);
            }}
            onPointerUp={() => {
              if (sendHoldTimer) {
                clearTimeout(sendHoldTimer);
                sendHoldTimer = undefined;
                props.onSend();
              }
            }}
            onPointerLeave={() => {
              if (sendHoldTimer) {
                clearTimeout(sendHoldTimer);
                sendHoldTimer = undefined;
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
              label: t('messages.reply_action', language()),
              tone: 'primary' as const,
              onClick: () => {
                const msg = selectedMessage();
                if (!msg) return;
                props.onReply(msg.id);
                setSelectedMessage(null);
              },
            },
            {
              label: t('messages.forward', language()),
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
