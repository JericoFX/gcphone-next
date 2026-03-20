import { For, Show, createEffect, createMemo, createSelector, createSignal, onMount } from 'solid-js';
import { AppFAB } from '../../shared/layout/AppLayout';
import { AppScaffold } from '../../shared/layout/AppScaffold';
import { MediaActionButtons } from '../../shared/ui/MediaActionButtons';
import { MediaAttachmentPreview } from '../../shared/ui/MediaAttachmentPreview';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchNui } from '../../../utils/fetchNui';
import { t } from '../../../i18n';
import { usePhoneState } from '../../../store/phone';
import { resolveMediaType, sanitizeMediaUrl } from '../../../utils/sanitize';
import { uiAlert } from '../../../utils/uiAlert';
import { uiPrompt } from '../../../utils/uiDialog';
import styles from './MailApp.module.scss';

interface MailAccount {
  id: number;
  alias: string;
  email: string;
}

interface MailMessage {
  id: number;
  sender_email?: string;
  sender_alias?: string;
  recipient_email: string;
  recipient_alias?: string;
  subject?: string;
  body: string;
  attachments?: MailAttachment[];
  is_read?: number;
  created_at: number;
}

interface MailAttachment {
  type: 'image' | 'video' | 'document' | 'link';
  url: string;
  name?: string;
  mime?: string;
  size?: number;
  sourceApp?: string;
}

interface MailStateResponse {
  success: boolean;
  hasAccount?: boolean;
  account?: MailAccount | null;
  inbox?: MailMessage[];
  sent?: MailMessage[];
  unread?: number;
  domain?: string;
  error?: string;
}

interface MailActionResponse {
  success: boolean;
  error?: string;
}

const MAIL_ICONS = {
  trash: './img/icons_ios/ui-trash.svg',
  gallery: './img/icons_ios/gallery.svg',
  camera: './img/icons_ios/camera.svg',
  link: './img/icons_ios/ui-link.svg',
  compose: './img/icons_ios/mail.svg',
} as const;

export function MailApp() {
  const router = useRouter();
  const phoneState = usePhoneState();
  const language = () => phoneState.settings.language || 'es';
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');

  const [domain, setDomain] = createSignal('noimotors.gg');
  const [account, setAccount] = createSignal<MailAccount | null>(null);
  const [unread, setUnread] = createSignal(0);
  const [inbox, setInbox] = createSignal<MailMessage[]>([]);
  const [sent, setSent] = createSignal<MailMessage[]>([]);

  const [folder, setFolder] = createSignal<'inbox' | 'sent'>('inbox');
  const [selectedId, setSelectedId] = createSignal<number | null>(null);
  const [view, setView] = createSignal<'list' | 'detail' | 'compose'>('list');

  const [toInput, setToInput] = createSignal('');
  const [subjectInput, setSubjectInput] = createSignal('');
  const [bodyInput, setBodyInput] = createSignal('');
  const [attachments, setAttachments] = createSignal<MailAttachment[]>([]);
  const [attachmentType, setAttachmentType] =
    createSignal<MailAttachment['type']>('document');
  const [attachmentUrl, setAttachmentUrl] = createSignal('');
  const [attachmentName, setAttachmentName] = createSignal('');
  const [lastComposeRouteKey, setLastComposeRouteKey] = createSignal('');
  const [showAttachmentComposer, setShowAttachmentComposer] = createSignal(false);

  let toFieldRef: HTMLInputElement | undefined;
  let bodyFieldRef: HTMLTextAreaElement | undefined;

  const selectedMessage = createMemo(() => {
    const id = selectedId();
    if (!id) return null;
    const source = folder() === 'inbox' ? inbox() : sent();
    return source.find((entry) => Number(entry.id) === Number(id)) || null;
  });

  const visibleMessages = createMemo(() =>
    folder() === 'inbox' ? inbox() : sent(),
  );
  const isSelectedMessage = createSelector(selectedId);
  const hasComposeError = createMemo(() => view() === 'compose' && !!error());

  createEffect(() => {
    const params = router.params();
    const routeKey = JSON.stringify(params || {});
    if (routeKey === lastComposeRouteKey()) return;
    setLastComposeRouteKey(routeKey);

    const compose = params.compose === '1' || params.compose === true;
    const subject = typeof params.subject === 'string' ? params.subject : '';
    const body = typeof params.body === 'string' ? params.body : '';
    const to = typeof params.to === 'string' ? params.to : '';
    const url = typeof params.attachmentUrl === 'string' ? params.attachmentUrl : '';
    const type = params.attachmentType === 'image' || params.attachmentType === 'video' || params.attachmentType === 'document' || params.attachmentType === 'link'
      ? params.attachmentType
      : null;
    const name = typeof params.attachmentName === 'string' ? params.attachmentName : '';

    if (!compose && !subject && !body && !to && !url) return;

    setView('compose');
    if (to) setToInput(to);
    if (subject) setSubjectInput(subject);
    if (body) setBodyInput(body);

    if (url && type) {
      setAttachments((prev) => {
        if (prev.some((entry) => entry.url === url && entry.type === type)) return prev;
        return [...prev, { type, url, name: name || undefined }];
      });
    }
  });

  const loadState = async () => {
    setLoading(true);
    setError('');

    const payload = await fetchNui<MailStateResponse>(
      'mailGetState',
      { limit: 40, offset: 0 },
      {
        success: true,
        hasAccount: false,
        account: null,
        inbox: [],
        sent: [],
        unread: 0,
        domain: 'jericofx.gg',
      },
    );

    setLoading(false);
    setDomain(payload?.domain || 'jericofx.gg');

    if (!payload?.success) {
      setError(payload?.error || t('mail.error.load', language()));
      return;
    }

    if (payload.hasAccount !== true || !payload.account) {
      setAccount(null);
      setInbox([]);
      setSent([]);
      setUnread(0);
      setSelectedId(null);
      return;
    }

    setAccount(payload.account);
    setInbox(payload.inbox || []);
    setSent(payload.sent || []);
    setUnread(Number(payload.unread) || 0);

    const first = (payload.inbox && payload.inbox[0]) || null;
    setSelectedId(first ? Number(first.id) : null);
  };

  const sendMail = async () => {
    if (!account()) return;

    const to = toInput().trim().toLowerCase();
    const subject = subjectInput().trim();
    const body = bodyInput().trim();

    if (!to) {
      setError(t('mail.error.compose_required', language()));
      toFieldRef?.focus();
      return;
    }

    if (!body) {
      setError(t('mail.error.compose_required', language()));
      bodyFieldRef?.focus();
      return;
    }

    setLoading(true);
    setError('');

    const payload = await fetchNui<MailActionResponse>(
      'mailSend',
      {
        to,
        subject,
        body,
        attachments: attachments(),
      },
      { success: false },
    );

    setLoading(false);
    if (!payload?.success) {
      setError(payload?.error || t('mail.error.send', language()));
      return;
    }

    setToInput('');
    setSubjectInput('');
    setBodyInput('');
    setAttachments([]);
    setAttachmentType('document');
    setAttachmentUrl('');
    setAttachmentName('');
    setShowAttachmentComposer(false);
    await loadState();
    setFolder('sent');
    setView('list');
  };

  const addAttachment = () => {
    const url = attachmentType() === 'document' ? attachmentUrl().trim() : sanitizeMediaUrl(attachmentUrl().trim()) || attachmentUrl().trim();
    if (!url) {
      setError(t('mail.error.attachment_url', language()));
      return;
    }

    setAttachments((prev) => [
      ...prev,
      {
        type: attachmentType(),
        url,
        name: attachmentName().trim() || undefined,
      },
    ]);
    setAttachmentUrl('');
    setAttachmentName('');
    setError('');
    setShowAttachmentComposer(false);
  };

  const attachFromGallery = async () => {
    const gallery = await fetchNui<Array<{ url?: string }>>('getGallery', undefined, []);
    const media = gallery?.find((entry) => entry?.url && ['image', 'video'].includes(resolveMediaType(entry.url)));
    const url = sanitizeMediaUrl(media?.url || '');
    if (!url) {
      uiAlert(t('mail.error.gallery_attachment', language()));
      return;
    }

    setAttachments((prev) => [
      ...prev,
      {
        type: resolveMediaType(url) === 'video' ? 'video' : 'image',
        url,
        name: 'Adjunto de galeria',
      },
    ]);
    setError('');
    setShowAttachmentComposer(false);
  };

  const attachFromCamera = async () => {
    const shot = await fetchNui<{ url?: string }>('takePhoto', {}, { url: '' });
    const url = sanitizeMediaUrl(shot?.url || '');
    if (!url) {
      await attachFromGallery();
      return;
    }

    setAttachments((prev) => [
      ...prev,
      {
        type: resolveMediaType(url) === 'video' ? 'video' : 'image',
        url,
        name: 'Captura de camara',
      },
    ]);
    setError('');
    setShowAttachmentComposer(false);
  };

  const attachLinkByPrompt = async () => {
    const result = await uiPrompt(t('mail.prompt.attach_link_message', language()), { title: t('mail.prompt.attach_link_title', language()) });
    const url = (result || '').trim();
    if (!url) return;
    setAttachments((prev) => [
      ...prev,
      {
        type: 'link',
        url,
        name: 'Enlace',
      },
    ]);
    setError('');
    setShowAttachmentComposer(false);
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, current) => current !== index));
  };

  const openMessage = async (message: MailMessage) => {
    setSelectedId(Number(message.id));
    setView('detail');

    if (folder() !== 'inbox') return;
    if (Number(message.is_read) === 1) return;

    await fetchNui<MailActionResponse>(
      'mailMarkRead',
      { messageId: message.id },
      { success: false },
    );
    setInbox((prev) =>
      prev.map((entry) =>
        Number(entry.id) === Number(message.id)
          ? { ...entry, is_read: 1 }
          : entry,
      ),
    );
    setUnread((prev) => Math.max(0, prev - 1));
  };

  const backToList = () => {
    setView('list');
    setSelectedId(null);
  };

  const deleteMessage = async () => {
    const msg = selectedMessage();
    if (!msg) return;

    const res = await fetchNui<MailActionResponse>(
      'mailDelete',
      {
        messageId: msg.id,
        folder: folder(),
      },
      { success: true },
    );

    if (res?.success) {
      if (folder() === 'inbox') {
        setInbox((prev) => prev.filter((m) => Number(m.id) !== Number(msg.id)));
      } else {
        setSent((prev) => prev.filter((m) => Number(m.id) !== Number(msg.id)));
      }
      backToList();
    } else {
      setError(res?.error || t('mail.error.delete', language()));
    }
  };

  const cancelCompose = () => {
    setView('list');
    setToInput('');
    setSubjectInput('');
    setBodyInput('');
    setAttachments([]);
    setAttachmentType('document');
    setAttachmentUrl('');
    setAttachmentName('');
    setShowAttachmentComposer(false);
    setError('');
  };

  onMount(() => {
    void loadState();
  });

  return (
    <AppScaffold title='Mail' subtitle={t('mail.subtitle', language())} onBack={() => router.goBack()} bodyPadding='none'>
      <div class={styles.root}>
        <Show when={!!error() && view() !== 'compose'}>
          <div class={styles.error}>{error()}</div>
        </Show>

        <Show
          when={!account()}
          fallback={
            <>
              {/* Vista de Lista (Inbox/Sent) */}
              <Show when={view() === 'list'}>
                <div class={styles.accountBar}>
                  <div>
                    <p class={styles.label}>{t('mail.account', language())}</p>
                    <strong>{account()?.email}</strong>
                  </div>
                  <div class={styles.unreadBadge}>{t('mail.unread', language())}: {unread()}</div>
                </div>

                <div class={styles.folderTabs}>
                  <button
                    class={styles.tab}
                    classList={{ [styles.tabActive]: folder() === 'inbox' }}
                    onClick={() => setFolder('inbox')}
                  >
                    Inbox
                  </button>
                  <button
                    class={styles.tab}
                    classList={{ [styles.tabActive]: folder() === 'sent' }}
                    onClick={() => setFolder('sent')}
                  >
                    {t('mail.sent', language())}
                  </button>
                </div>

                <div class={styles.contentGrid}>
                  <div class={styles.list}>
                    <For each={visibleMessages()}>
                      {(entry) => (
                        <button
                          class={styles.item}
                          classList={{
                            [styles.itemActive]: isSelectedMessage(Number(entry.id)),
                            [styles.itemUnread]:
                              folder() === 'inbox' && Number(entry.is_read) === 0,
                          }}
                          onClick={() => void openMessage(entry)}
                        >
                          <div class={styles.itemTop}>
                            <strong>
                              {folder() === 'inbox'
                                ? entry.sender_alias ||
                                  entry.sender_email ||
                                  t('mail.sender', language())
                                : entry.recipient_alias || entry.recipient_email}
                            </strong>
                            <span>
                              {new Date(
                                Number(entry.created_at) || Date.now(),
                              ).toLocaleDateString()}
                            </span>
                          </div>
                          <p>{entry.subject || t('mail.no_subject', language())}</p>
                        </button>
                      )}
                    </For>
                  </div>

                  <div class={styles.preview}>
                    <Show
                      when={selectedMessage()}
                      fallback={<p class={styles.empty}>{t('mail.select_message', language())}</p>}
                    >
                      {(message) => (
                        <>
                          <h4>{message().subject || t('mail.no_subject', language())}</h4>
                          <p class={styles.previewMeta}>
                            {folder() === 'inbox'
                              ? `${t('mail.from', language())}: ${message().sender_email || t('mail.unknown', language())}`
                              : `${t('mail.to', language())}: ${message().recipient_email}`}
                          </p>
                          <pre class={styles.previewBody}>
                            {message().body}
                          </pre>
                          <Show
                            when={(message().attachments || []).length > 0}
                          >
                            <div class={styles.previewAttachments}>
                              <h5>{t('mail.attachments', language())}</h5>
                              <For each={message().attachments || []}>
                                {(entry) => (
                                  <div class={styles.previewAttachmentItem}>
                                    <span>{entry.type}</span>
                                    <a
                                      href={entry.url}
                                      target='_blank'
                                      rel='noreferrer'
                                    >
                                      {entry.name || entry.url}
                                    </a>
                                  </div>
                                )}
                              </For>
                            </div>
                          </Show>
                        </>
                      )}
                    </Show>
                  </div>
                </div>

                {/* Boton flotante de nuevo mensaje */}
                <button
                  class={styles.fab}
                  onClick={() => setView('compose')}
                  title={t('mail.new_message', language())}
                >
                  <img src={MAIL_ICONS.compose} alt='' draggable={false} />
                </button>
              </Show>

              {/* Vista de Detail */}
              <Show when={view() === 'detail'}>
                <Show when={selectedMessage()}>
                  {(message) => (
                    <div class={styles.detailView}>
                      <div class={styles.detailHeader}>
                        <button
                          class={styles.backButton}
                          onClick={() => backToList()}
                        >
                          ← {t('mail.back', language())}
                        </button>
                        <h4 class={styles.detailTitle}>
                          {message().subject || t('mail.no_subject', language())}
                        </h4>
                        <div class={styles.detailActions}>
                          <button
                            class={styles.deleteButton}
                            onClick={() => void deleteMessage()}
                          >
                            <img src={MAIL_ICONS.trash} alt='' draggable={false} />
                            <span>{t('mail.delete', language())}</span>
                          </button>
                        </div>
                      </div>

                      <div class={styles.detailContent}>
                        <div class={styles.detailMeta}>
                          <div class={styles.metaRow}>
                              <span class={styles.metaLabel}>{t('mail.from', language())}:</span>
                            <span class={styles.metaValue}>
                              {message().sender_alias ||
                                message().sender_email ||
                                t('mail.unknown', language())}
                            </span>
                          </div>
                          <div class={styles.metaRow}>
                              <span class={styles.metaLabel}>{t('mail.to', language())}:</span>
                            <span class={styles.metaValue}>
                              {message().recipient_alias ||
                                message().recipient_email}
                            </span>
                          </div>
                          <div class={styles.metaRow}>
                              <span class={styles.metaLabel}>{t('mail.date', language())}:</span>
                            <span class={styles.metaValue}>
                              {new Date(
                                Number(message().created_at),
                              ).toLocaleString()}
                            </span>
                          </div>
                        </div>

                        <div class={styles.detailBody}>
                          {message().body}
                        </div>

                        <Show
                          when={(message().attachments || []).length > 0}
                        >
                          <div class={styles.detailAttachments}>
                            <h5>
                              {t('mail.attachments', language())} ({(message().attachments || [])
                                .length})
                            </h5>
                            <For each={message().attachments || []}>
                              {(attachment) => (
                                <div class={styles.attachmentItem}>
                                  <span class={styles.attachmentType}>
                                    {attachment.type}
                                  </span>
                                  <a
                                    href={attachment.url}
                                    target='_blank'
                                    rel='noreferrer'
                                    class={styles.attachmentLink}
                                  >
                                    {attachment.name || attachment.url}
                                  </a>
                                </div>
                              )}
                            </For>
                          </div>
                        </Show>
                      </div>
                    </div>
                  )}
                </Show>
              </Show>

              {/* Vista de Compose */}
              <Show when={view() === 'compose'}>
                <div class={styles.composeView}>
                  <div class={styles.composeHeader}>
                    <button
                      class={styles.backButton}
                      onClick={() => cancelCompose()}
                    >
                      {t('mail.cancel', language())}
                    </button>
                    <h4 class={styles.composeTitle}>{t('mail.new_message', language())}</h4>
                    <div class={styles.composeHeaderSpacer}></div>
                  </div>

                  <div class={styles.composeScroll}>
                    <div class={styles.composeCard}>
                      <Show when={hasComposeError()}>
                        <div class={styles.composeError}>{error()}</div>
                      </Show>

                      <input
                        ref={toFieldRef}
                        class={styles.input}
                        value={toInput()}
                        onInput={(e) => {
                          setToInput(e.currentTarget.value);
                          if (error()) setError('');
                        }}
                        placeholder={t('mail.placeholder.to', language())}
                      />
                      <input
                        class={styles.input}
                        value={subjectInput()}
                        onInput={(e) => setSubjectInput(e.currentTarget.value)}
                        placeholder={t('mail.placeholder.subject', language())}
                      />
                      <textarea
                        ref={bodyFieldRef}
                        class={styles.textarea}
                        value={bodyInput()}
                        onInput={(e) => {
                          setBodyInput(e.currentTarget.value);
                          if (error()) setError('');
                        }}
                        placeholder={t('mail.placeholder.body', language())}
                      />

                      <div class={styles.attachmentsSummary}>
                        <div>
                          <p class={styles.attachmentsLabel}>{t('mail.attachments_optional', language())}</p>
                          <strong class={styles.attachmentsCount}>
                            {attachments().length === 0 ? '0' : attachments().length}
                          </strong>
                        </div>
                        <button
                          class={styles.attachmentsToggle}
                          onClick={() => setShowAttachmentComposer((prev) => !prev)}
                        >
                          {showAttachmentComposer() ? t('mail.cancel', language()) : t('mail.add', language())}
                        </button>
                      </div>

                      <Show when={attachments().length > 0}>
                        <div class={styles.attachList}>
                          <For each={attachments()}>
                            {(entry, index) => (
                              <div class={styles.attachItem}>
                                <span>
                                  {entry.type}: {entry.name || entry.url}
                                </span>
                                <button onClick={() => removeAttachment(index())}>
                                  {t('mail.remove', language())}
                                </button>
                              </div>
                            )}
                          </For>
                        </div>
                      </Show>
                    </div>

                    <Show when={showAttachmentComposer()}>
                      <div class={styles.attachmentsBox}>
                        <h5>{t('mail.attachments_optional', language())}</h5>
                        <MediaActionButtons
                          actions={[
                            { icon: MAIL_ICONS.gallery, label: t('mail.gallery', language()), onClick: attachFromGallery },
                            { icon: MAIL_ICONS.camera, label: t('mail.camera', language()), onClick: attachFromCamera },
                            { icon: MAIL_ICONS.link, label: t('mail.link', language()), onClick: () => void attachLinkByPrompt() },
                          ]}
                          variant='compact'
                          class={styles.composeMediaButtons}
                        />
                        <div class={styles.attachRow}>
                          <select
                            class={styles.select}
                            value={attachmentType()}
                            onChange={(e) =>
                              setAttachmentType(
                                e.currentTarget.value as MailAttachment['type'],
                              )
                            }
                          >
                            <option value='image'>{t('mail.attachment.image', language())}</option>
                            <option value='video'>{t('mail.attachment.video', language())}</option>
                            <option value='document'>{t('mail.attachment.document', language())}</option>
                            <option value='link'>Link</option>
                          </select>
                          <input
                            class={styles.inputInline}
                            value={attachmentUrl()}
                            onInput={(e) => setAttachmentUrl(e.currentTarget.value)}
                            placeholder={t('mail.placeholder.url', language())}
                          />
                        </div>
                        <MediaAttachmentPreview
                          url={attachmentUrl()}
                          mediaClass={styles.composePreviewMedia}
                        />
                        <div class={styles.attachRow}>
                          <input
                            class={styles.inputInline}
                            value={attachmentName()}
                            onInput={(e) => setAttachmentName(e.currentTarget.value)}
                            placeholder={t('mail.placeholder.name', language())}
                          />
                          <button class={styles.attachButton} onClick={addAttachment}>
                            {t('mail.add', language())}
                          </button>
                        </div>
                      </div>
                    </Show>
                  </div>

                  <div class={styles.composeFooter}>
                    <button
                      class={styles.composeFooterSecondary}
                      onClick={() => cancelCompose()}
                      disabled={loading()}
                    >
                      {t('mail.cancel', language())}
                    </button>
                    <button
                      class={styles.composeFooterPrimary}
                      onClick={() => void sendMail()}
                      disabled={loading()}
                    >
                      {t('mail.send', language())}
                    </button>
                  </div>

                  <AppFAB
                    class={styles.composeFab}
                    title={t('mail.attachments_optional', language())}
                    tooltip={attachments().length > 0 ? `${attachments().length} ${t('mail.attachments_optional', language())}` : t('mail.attachments_optional', language())}
                    tooltipVisible={showAttachmentComposer()}
                    icon={<img src={MAIL_ICONS.gallery} alt='' draggable={false} />}
                    onClick={() => setShowAttachmentComposer((prev) => !prev)}
                  />

                  <Show when={attachments().length > 0}>
                    <div class={styles.composeFabBadge}>{attachments().length}</div>
                  </Show>
                </div>
              </Show>
            </>
          }
        >
          <div class={styles.setupCard}>
            <h3>{t('mail.setup_title', language())}</h3>
            <p class={styles.setupHint}>
              {t('mail.no_account_hint', language())}
            </p>
          </div>
        </Show>
      </div>
    </AppScaffold>
  );
}
