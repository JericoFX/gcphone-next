import { createEffect, For, onMount, Show } from 'solid-js';
import { formatPhoneNumber, timeAgo } from '../../../utils/misc';
import { resolveMediaType, sanitizeText } from '../../../utils/sanitize';
import { parseSharedContactMessage } from '../../../utils/contactShare';
import { getStoredLanguage, t } from '../../../i18n';
import { ActionSheet } from '../../shared/ui/ActionSheet';
import { EmojiPickerButton } from '../../shared/ui/EmojiPicker';
import { extractCoords } from './WaveChatTypes';
import styles from './WaveChatApp.module.scss';

export function WaveChatConversationView(props: {
  phoneNumber: string;
  contactName: string;
  messages: any[];
  messageInput: string;
  attachmentUrl: string | null;
  showAttachSheet: boolean;
  setShowAttachSheet: (value: boolean) => void;
  onInput: (value: string) => void;
  onSend: () => void;
  onAttachGallery: () => void;
  onAttachCamera: () => void;
  onAttachUrl: () => void;
  onAttachAudioUrl: () => void;
  onSendLocation: () => void;
  isRecordingVoice: boolean;
  recordingSeconds: number;
  uploadingVoice: boolean;
  onStartVoiceRecording: () => void;
  onStopVoiceRecording: () => void;
  onOpenGifPicker: () => void;
  onClearAttachment: () => void;
  onOpenViewer: (url: string | null) => void;
  getMediaUrl: (msg: any) => string | undefined;
  isKnownContact: (number: string) => boolean;
  onAddContact: (display: string, number: string) => void;
  onBack: () => void;
  onOpenCoords: (x: number, y: number) => void;
  onDeleteConversation: () => void;
  framework?: 'esx' | 'qbcore' | 'qbox' | 'unknown';
  myNumber?: string;
}) {
  const language = () => getStoredLanguage();
  let messagesEnd: HTMLDivElement | undefined;

  onMount(() => {
    messagesEnd?.scrollIntoView({ behavior: 'auto' });
  });

  createEffect(() => {
    if (props.messages.length > 0) {
      messagesEnd?.scrollIntoView({ behavior: 'smooth' });
    }
  });

  return (
    <div class={styles.thread}>
      <div class={styles.nav}>
        <button class={styles.iconBtn} onClick={props.onBack}>
          <img src="./img/icons_ios/ui-chevron-left.svg" alt="" draggable={false} />
        </button>
        <div class={styles.navTitle}>{props.contactName}</div>
        <button class={styles.deleteConversationBtn} onClick={props.onDeleteConversation}>{t('wavechat.delete', language())}</button>
      </div>

      <div class={styles.messagesList}>
        <For each={props.messages}>
          {(msg) => {
            const isDeleted = !!msg.deleted_at;
            const shared = isDeleted ? null : parseSharedContactMessage(msg.message);
            const messageText = isDeleted ? '' : sanitizeText(msg.message || '', 800);
            const coords = isDeleted ? null : extractCoords(msg.message);
            const mediaUrl = isDeleted ? undefined : props.getMediaUrl(msg);
            const mediaType = resolveMediaType(mediaUrl);

            const isSent = msg.owner === 1 || (props.myNumber && msg.sender === props.myNumber);
            const isReceived = msg.owner === 0 || (props.myNumber && msg.sender !== props.myNumber && msg.sender === props.phoneNumber);

            return (
            <div class={styles.bubble} classList={{ [styles.sent]: !!isSent, [styles.received]: !!isReceived, [styles.deleted]: isDeleted }}>
              <Show when={isDeleted}>
                <span class={styles.deletedText}>{t('wavechat.message_deleted', language())}</span>
              </Show>
              <Show when={!isDeleted}>
              <Show when={shared} fallback={
                <>
                  <Show when={messageText}>
                    <span class={styles.messageText}>{messageText}</span>
                  </Show>
                  <Show when={coords}>
                    {(coords) => (
                      <button class={styles.mapBtn} onClick={() => props.onOpenCoords(coords().x, coords().y)}>
                        {t('wavechat.open_map', language())}
                      </button>
                    )}
                  </Show>
                </>
              }>
                {(shared) => (
                  <div class={styles.contactCard}>
                    <div class={styles.contactCardLabel}>{t('wavechat.shared_contact', language())}</div>
                    <div class={styles.contactCardName}>{shared().display}</div>
                    <div class={styles.contactCardNumber}>{formatPhoneNumber(shared().number, props.framework || 'unknown')}</div>
                    <button
                      class={styles.contactCardBtn}
                      disabled={props.isKnownContact(shared().number)}
                      onClick={() => props.onAddContact(shared().display, shared().number)}
                    >
                      {props.isKnownContact(shared().number) ? t('wavechat.already_added', language()) : t('wavechat.add_contact', language())}
                    </button>
                  </div>
                )}
              </Show>
              <Show when={mediaUrl}>
                <Show when={mediaType === 'image'}>
                  <img class={styles.mediaPreview} src={mediaUrl!} alt="" onClick={() => props.onOpenViewer(mediaUrl || null)} />
                </Show>
                <Show when={mediaType === 'video'}>
                  <video class={styles.mediaPreview} src={mediaUrl!} controls playsinline preload="metadata" />
                </Show>
                <Show when={mediaType === 'audio'}>
                  <audio class={styles.audioPreview} src={mediaUrl!} controls preload="metadata" />
                </Show>
              </Show>
              </Show>
              <span class={styles.messageTime}>{timeAgo(msg.time || msg.created_at || (msg.createdAt ? new Date(msg.createdAt).toISOString() : ''))}</span>
            </div>
          )}}
        </For>
        <div ref={messagesEnd} />
      </div>

      <Show when={props.attachmentUrl}>
        <div class={styles.attachmentPreview}>
          <Show when={resolveMediaType(props.attachmentUrl || undefined) === 'image'}>
            <img src={props.attachmentUrl!} alt="" onClick={() => props.onOpenViewer(props.attachmentUrl)} />
          </Show>
          <Show when={resolveMediaType(props.attachmentUrl || undefined) === 'video'}>
            <video src={props.attachmentUrl!} controls playsinline preload="metadata" />
          </Show>
          <Show when={resolveMediaType(props.attachmentUrl || undefined) === 'audio'}>
            <audio class={styles.audioPreview} src={props.attachmentUrl!} controls preload="metadata" />
          </Show>
          <button onClick={props.onClearAttachment}>{t('wavechat.remove', language())}</button>
        </div>
      </Show>

      <div class={styles.inputContainer}>
        <button class={styles.attachBtn} onClick={() => props.setShowAttachSheet(true)}>
          +
        </button>
        <EmojiPickerButton value={props.messageInput} onChange={props.onInput} maxLength={800} />
        <input
          type="text"
          placeholder={t('messages.message_placeholder', language())}
          value={props.messageInput}
          onInput={(e) => props.onInput(e.currentTarget.value)}
          onKeyPress={(e) => e.key === 'Enter' && props.onSend()}
        />
        <button
          class={styles.sendBtn}
          classList={{ [styles.sendBtnRecording]: props.isRecordingVoice }}
          onPointerDown={() => {
            (window as any).__gcSendTimer = setTimeout(() => {
              (window as any).__gcSendTimer = null;
              if (props.isRecordingVoice) {
                props.onStopVoiceRecording();
              } else {
                props.onStartVoiceRecording();
              }
            }, 500);
          }}
          onPointerUp={() => {
            if ((window as any).__gcSendTimer) {
              clearTimeout((window as any).__gcSendTimer);
              (window as any).__gcSendTimer = null;
              props.onSend();
            }
          }}
          onPointerLeave={() => {
            if ((window as any).__gcSendTimer) {
              clearTimeout((window as any).__gcSendTimer);
              (window as any).__gcSendTimer = null;
            }
          }}
        >
          {props.isRecordingVoice ? `⏹ ${props.recordingSeconds}s` : '➤'}
        </button>
      </div>

      <Show when={props.uploadingVoice}>
        <div class={styles.voiceUploading}>{t('wavechat.uploading_voice', language())}</div>
      </Show>

      <ActionSheet
        open={props.showAttachSheet}
        title={t('messages.attach', language())}
        onClose={() => props.setShowAttachSheet(false)}
        actions={[
          { label: t('messages.attach_gallery', language()), tone: 'primary', onClick: props.onAttachGallery },
          { label: t('messages.attach_camera', language()), onClick: props.onAttachCamera },
          { label: t('wavechat.search_gif', language()), onClick: props.onOpenGifPicker },
          { label: t('messages.attach_url', language()), onClick: props.onAttachUrl },
          { label: t('wavechat.attach_audio_url', language()), onClick: props.onAttachAudioUrl },
          { label: props.isRecordingVoice ? t('wavechat.stop_recording', language(), { seconds: props.recordingSeconds }) : t('wavechat.record_voice', language()), onClick: props.isRecordingVoice ? props.onStopVoiceRecording : props.onStartVoiceRecording },
          { label: t('maps.share_location', language()), onClick: props.onSendLocation },
          { label: t('messages.remove_attachment', language()), tone: 'danger', onClick: props.onClearAttachment },
        ]}
      />
    </div>
  );
}
