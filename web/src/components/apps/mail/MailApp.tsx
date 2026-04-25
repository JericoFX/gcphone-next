import { For, Show, createEffect, createMemo, createSignal, onMount, batch } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchKnownNui, fetchNui } from '../../../utils/fetchNui';
import { t } from '../../../i18n';
import { usePhoneState } from '../../../store/phone';
import { useContactsState } from '../../../store/contacts';
import { resolveMediaType, sanitizeMediaUrl } from '../../../utils/sanitize';
import { generateColorForString } from '../../../utils/misc';
import { uiPrompt } from '../../../utils/uiDialog';
import { AppScaffold } from '../../shared/layout';
import { LetterAvatar } from '../../shared/ui/LetterAvatar';
import { ActionSheet } from '../../shared/ui/ActionSheet';
import { SearchInput } from '../../shared/ui/SearchInput';
import type { MailAccount, MailAttachment, MailMessage } from '../../../types/nui';
import styles from './MailApp.module.scss';

/* ─── Interfaces ─── */

/* ─── Swipe threshold (px) ─── */

/* ─── Helpers ─── */

function formatDate(ts: number, lang: string): string {
  const d = new Date(ts || Date.now());
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffDays === 0) {
    return d.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });
  }
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) {
    return d.toLocaleDateString(lang, { weekday: 'short' });
  }
  return d.toLocaleDateString(lang, { month: 'short', day: 'numeric' });
}

function attachmentIcon(type: string): string {
  switch (type) {
    case 'image': return '\uD83D\uDDBC';
    case 'video': return '\uD83C\uDFA5';
    case 'document': return '\uD83D\uDCC4';
    case 'link': return '\uD83D\uDD17';
    default: return '\uD83D\uDCCE';
  }
}

/* ─── Component ─── */

export function MailApp() {
  const router = useRouter();
  const phoneState = usePhoneState();
  const contactsState = useContactsState();
  const language = () => phoneState.settings.language || 'es';

  /* State */
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');
  const [domain, setDomain] = createSignal('noimotors.gg');
  const [account, setAccount] = createSignal<MailAccount | null>(null);
  const [unread, setUnread] = createSignal(0);
  const [inbox, setInbox] = createSignal<MailMessage[]>([]);
  const [sent, setSent] = createSignal<MailMessage[]>([]);

  const [folder, setFolder] = createSignal<'inbox' | 'sent'>('inbox');
  const [view, setView] = createSignal<'list' | 'detail' | 'compose'>('list');
  const [selectedId, setSelectedId] = createSignal<number | null>(null);
  const [search, setSearch] = createSignal('');

  /* Compose state */
  const [toInput, setToInput] = createSignal('');
  const [subjectInput, setSubjectInput] = createSignal('');
  const [bodyInput, setBodyInput] = createSignal('');
  const [attachments, setAttachments] = createSignal<MailAttachment[]>([]);
  const [lastComposeRouteKey, setLastComposeRouteKey] = createSignal('');
  const [showAttachSheet, setShowAttachSheet] = createSignal(false);

  /* Setup state */
  const [aliasInput, setAliasInput] = createSignal('');

  let bodyFieldRef: HTMLTextAreaElement | undefined;

  /* ─── Avatar resolution ─── */
  // Only show contact avatar if sender's number matches a contact in OUR list
  const resolveAvatar = (email?: string, alias?: string) => {
    const name = alias || email?.split('@')[0] || '?';
    const contact = contactsState.contacts.find(
      (c) => c.number === name,
    );
    return {
      imageUrl: contact?.avatar || undefined,
      label: contact?.display || name,
      color: generateColorForString(email || name),
    };
  };

  /* ─── Derived ─── */
  const selectedMessage = createMemo(() => {
    const id = selectedId();
    if (id == null) return null;
    const source = folder() === 'inbox' ? inbox() : sent();
    return source.find((m) => Number(m.id) === Number(id)) || null;
  });

  const filteredMessages = createMemo(() => {
    const all = folder() === 'inbox' ? inbox() : sent();
    const q = search().toLowerCase().trim();
    if (!q) return all;
    return all.filter(
      (m) =>
        (m.subject || '').toLowerCase().includes(q) ||
        (m.body || '').toLowerCase().includes(q) ||
        (m.sender_alias || '').toLowerCase().includes(q) ||
        (m.sender_email || '').toLowerCase().includes(q) ||
        (m.recipient_alias || '').toLowerCase().includes(q) ||
        (m.recipient_email || '').toLowerCase().includes(q),
    );
  });

  const canSend = createMemo(() => {
    return toInput().trim().length > 0 && bodyInput().trim().length > 0 && !loading();
  });

  /* ─── Route-param compose (external apps) ─── */
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
    const type =
      params.attachmentType === 'image' ||
      params.attachmentType === 'video' ||
      params.attachmentType === 'document' ||
      params.attachmentType === 'link'
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
        if (prev.some((e) => e.url === url && e.type === type)) return prev;
        return [...prev, { type, url, name: name || undefined }];
      });
    }
  });

  /* ─── NUI actions ─── */
  const loadState = async () => {
    setLoading(true);
    setError('');

    const payload = await fetchKnownNui(
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
      batch(() => {
        setAccount(null);
        setInbox([]);
        setSent([]);
        setUnread(0);
        setSelectedId(null);
      });
      return;
    }

    batch(() => {
      setAccount(payload.account!);
      setInbox(payload.inbox || []);
      setSent(payload.sent || []);
      setUnread(Number(payload.unread) || 0);
    });
  };

  const createAccount = async () => {
    const alias = aliasInput().trim();
    if (!alias) return;
    setLoading(true);
    setError('');
    const res = await fetchKnownNui('mailCreateAccount', { alias }, { success: false });
    setLoading(false);
    if (res?.success) {
      await loadState();
    } else {
      setError(res?.error || t('mail.error.create_account', language()));
    }
  };

  const sendMail = async () => {
    if (!account()) return;
    const to = toInput().trim().toLowerCase();
    const subject = subjectInput().trim();
    const body = bodyInput().trim();

    if (!to) {
      setError(t('mail.error.compose_required', language()));
      return;
    }
    if (!body) {
      setError(t('mail.error.compose_required', language()));
      bodyFieldRef?.focus();
      return;
    }

    setLoading(true);
    setError('');

    const payload = await fetchKnownNui(
      'mailSend',
      { to, subject, body, attachments: attachments() },
      { success: false },
    );

    setLoading(false);
    if (!payload?.success) {
      setError(payload?.error || t('mail.error.send', language()));
      return;
    }

    cancelCompose();
    await loadState();
    setFolder('sent');
  };

  const openMessage = async (message: MailMessage) => {
    setSelectedId(Number(message.id));
    setView('detail');

    if (folder() === 'inbox' && Number(message.is_read) !== 1) {
      await fetchKnownNui('mailMarkRead', { messageId: message.id }, { success: false });
      setInbox((prev) =>
        prev.map((e) => (Number(e.id) === Number(message.id) ? { ...e, is_read: 1 } : e)),
      );
      setUnread((prev) => Math.max(0, prev - 1));
    }
  };


  const deleteMessage = async (msg?: MailMessage | null) => {
    const target = msg || selectedMessage();
    if (!target) return;

    const res = await fetchKnownNui(
      'mailDelete',
      { messageId: target.id, folder: folder() },
      { success: true },
    );

    if (res?.success) {
      if (folder() === 'inbox') {
        setInbox((prev) => prev.filter((m) => Number(m.id) !== Number(target.id)));
      } else {
        setSent((prev) => prev.filter((m) => Number(m.id) !== Number(target.id)));
      }
      if (view() === 'detail') {
        setView('list');
        setSelectedId(null);
      }
    } else {
      setError(res?.error || t('mail.error.delete', language()));
    }
  };

  const cancelCompose = () => {
    batch(() => {
      setView('list');
      setToInput('');
      setSubjectInput('');
      setBodyInput('');
      setAttachments([]);
      setShowAttachSheet(false);
      setError('');
    });
  };

  const replyTo = (msg: MailMessage) => {
    batch(() => {
      setToInput(msg.sender_email || '');
      setSubjectInput(`Re: ${msg.subject || ''}`);
      setBodyInput('');
      setAttachments([]);
      setView('compose');
    });
  };

  /* ─── Attachment helpers ─── */
  const attachFromGallery = async () => {
    const gallery = await fetchNui<Array<{ url?: string }>>('getGallery', undefined, []);
    const media = gallery?.find(
      (e) => e?.url && ['image', 'video'].includes(resolveMediaType(e.url)),
    );
    const url = sanitizeMediaUrl(media?.url || '');
    if (!url) return;
    setAttachments((prev) => [
      ...prev,
      { type: resolveMediaType(url) === 'video' ? 'video' : 'image', url, name: 'Gallery' },
    ]);
    setShowAttachSheet(false);
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
      { type: resolveMediaType(url) === 'video' ? 'video' : 'image', url, name: 'Camera' },
    ]);
    setShowAttachSheet(false);
  };

  const attachFromDocuments = async () => {
    const docs = await fetchNui<
      Array<{ id: number; title: string; verification_code: string; doc_type: string }>
    >('documentsGetList', undefined, []);
    if (!docs || docs.length === 0) return;
    const docNames = docs.map((d) => `${d.title} (${d.doc_type})`).join('\n');
    const selected = await uiPrompt(
      (t('mail.prompt.select_document', language()) || 'Select document:') + '\n\n' + docNames,
      { title: t('mail.prompt.attach_document_title', language()) || 'Attach document' },
    );
    if (!selected) return;
    const doc = docs.find((d) => d.title.toLowerCase().includes(String(selected).toLowerCase()));
    if (!doc) return;
    setAttachments((prev) => [
      ...prev,
      { type: 'document', url: `DOC:${doc.id}:${doc.verification_code}`, name: doc.title },
    ]);
    setShowAttachSheet(false);
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  /* ─── Contact suggestions for To field ─── */
  const contactSuggestions = createMemo(() => {
    const q = toInput().toLowerCase().trim();
    if (!q || q.length < 2) return [];
    return contactsState.contacts
      .filter(
        (c) =>
          c.display.toLowerCase().includes(q) ||
          (c.number || '').toLowerCase().includes(q),
      )
      .slice(0, 5);
  });

  onMount(() => {
    void loadState();
  });

  /* ─── Render ─── */
  return (
    <AppScaffold
      title="Mail"
      subtitle={account()?.email || t('mail.subtitle', language())}
      onBack={() => router.goBack()}
      bodyPadding="none"
    >
      <div class={styles.root}>
        {/* Global error (list view only) */}
        <Show when={!!error() && view() === 'list'}>
          <div class={styles.error}>{error()}</div>
        </Show>

        <Show
          when={account()}
          fallback={
            /* ─── Account Setup ─── */
            <div class={styles.setupCard}>
              <h3>{t('mail.setup_title', language())}</h3>
              <p class={styles.setupHint}>{t('mail.setup_hint', language())}</p>
              <input
                class={styles.setupInput}
                value={aliasInput()}
                onInput={(e) => setAliasInput(e.currentTarget.value)}
                placeholder={t('mail.placeholder.alias', language()) || 'Alias'}
              />
              <Show when={aliasInput().trim()}>
                <p class={styles.setupDomainPreview}>
                  <strong>{aliasInput().trim()}</strong>@{domain()}
                </p>
              </Show>
              <button
                class={styles.setupBtn}
                disabled={!aliasInput().trim() || loading()}
                onClick={() => void createAccount()}
              >
                {t('mail.create_account', language())}
              </button>
            </div>
          }
        >
          {/* ─── Mail List View ─── */}
          <Show when={view() === 'list'}>
            {/* Tabs */}
            <div class={styles.folderTabs}>
              <button
                class={styles.tab}
                classList={{ [styles.tabActive]: folder() === 'inbox' }}
                onClick={() => setFolder('inbox')}
              >
                {t('mail.inbox', language()) || 'Inbox'}
                <Show when={folder() === 'inbox' && unread() > 0}>
                  {' '}({unread()})
                </Show>
              </button>
              <button
                class={styles.tab}
                classList={{ [styles.tabActive]: folder() === 'sent' }}
                onClick={() => setFolder('sent')}
              >
                {t('mail.sent', language())}
              </button>
            </div>

            {/* Search */}
            <div class={styles.searchWrap}>
              <SearchInput
                value={search()}
                onInput={setSearch}
                placeholder={t('mail.search', language()) || 'Search'}
              />
            </div>

            {/* Message list */}
            <div class={styles.list}>
              <Show
                when={filteredMessages().length > 0}
                fallback={
                  <div class={styles.emptyState}>
                    <p>
                      {folder() === 'inbox'
                        ? t('mail.empty_inbox', language()) || 'No messages'
                        : t('mail.empty_sent', language()) || 'No sent messages'}
                    </p>
                  </div>
                }
              >
                <For each={filteredMessages()}>
                  {(message) => {
                    const isUnread = () =>
                      folder() === 'inbox' && Number(message.is_read) === 0;
                    const avatar = () => {
                      if (folder() === 'inbox') {
                        return resolveAvatar(message.sender_email, message.sender_alias);
                      }
                      return resolveAvatar(message.recipient_email, message.recipient_alias);
                    };
                    const senderDisplay = () =>
                      folder() === 'inbox'
                        ? message.sender_alias || message.sender_email || t('mail.unknown', language())
                        : message.recipient_alias || message.recipient_email;
                    return (
                      <div
                        class={styles.mailRow}
                        classList={{ [styles.rowUnread]: isUnread() }}
                        onClick={() => void openMessage(message)}
                      >
                          {/* Unread dot */}
                          <Show when={isUnread()}>
                            <div class={styles.unreadDot} />
                          </Show>

                          {/* Avatar */}
                          <div class={styles.rowAvatar}>
                            <LetterAvatar
                              label={avatar().label}
                              color={avatar().color}
                              imageUrl={avatar().imageUrl}
                              size={40}
                              gradient
                            />
                          </div>

                          {/* Content */}
                          <div class={styles.rowContent}>
                            <div class={styles.rowTopLine}>
                              <span class={styles.rowSender}>{senderDisplay()}</span>
                              <span class={styles.rowDate}>
                                {formatDate(Number(message.created_at), language())}
                              </span>
                              <span class={styles.rowChevron}>{'\u203A'}</span>
                            </div>
                            <p class={styles.rowSubject}>
                              {message.subject || t('mail.no_subject', language())}
                            </p>
                            <p class={styles.rowPreview}>
                              {message.body.slice(0, 80)}
                            </p>
                          </div>
                        </div>
                    );
                  }}
                </For>
              </Show>
            </div>

            {/* FAB */}
            <button
              class={styles.fab}
              onClick={() => setView('compose')}
              title={t('mail.compose', language())}
            >
              <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75l11.06-11.06-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" /></svg>
            </button>
          </Show>

          {/* ─── Reading View ─── */}
          <Show when={view() === 'detail' && selectedMessage()}>
            {(message) => {
              const senderAvatar = () =>
                resolveAvatar(message().sender_email, message().sender_alias);
              return (
                <div class={styles.readingView}>
                  {/* Header */}
                  <div class={styles.readingHeader}>
                    <button
                      class={styles.readingHeaderBtn}
                      onClick={() => { setView('list'); setSelectedId(null); }}
                    >
                      {'\u2039'} {t('mail.back', language())}
                    </button>
                    <div class={styles.readingActions}>
                      <button
                        class={styles.readingHeaderBtn}
                        onClick={() => replyTo(message())}
                      >
                        {t('mail.reply', language()) || 'Reply'}
                      </button>
                      <button
                        class={`${styles.readingHeaderBtn} ${styles.readingHeaderBtnDanger}`}
                        onClick={() => void deleteMessage(message())}
                      >
                        {t('mail.delete', language())}
                      </button>
                    </div>
                  </div>

                  {/* Body */}
                  <div class={styles.readingBody}>
                    {/* Sender row */}
                    <div class={styles.readingSenderRow}>
                      <LetterAvatar
                        label={senderAvatar().label}
                        color={senderAvatar().color}
                        imageUrl={senderAvatar().imageUrl}
                        size={48}
                        gradient
                      />
                      <div class={styles.readingSenderInfo}>
                        <p class={styles.readingSenderName}>
                          {message().sender_alias || message().sender_email || t('mail.unknown', language())}
                        </p>
                        <p class={styles.readingSenderEmail}>
                          {message().sender_email || ''}
                        </p>
                      </div>
                      <span class={styles.readingDate}>
                        {new Date(Number(message().created_at)).toLocaleString(language())}
                      </span>
                    </div>

                    {/* Subject */}
                    <h2 class={styles.readingSubject}>
                      {message().subject || t('mail.no_subject', language())}
                    </h2>

                    {/* Meta */}
                    <p class={styles.readingMeta}>
                      {t('mail.to', language())}: {message().recipient_alias || message().recipient_email}
                    </p>

                    {/* Message body */}
                    <p class={styles.readingText}>{message().body}</p>

                    {/* Attachments */}
                    <Show when={(message().attachments || []).length > 0}>
                      <div class={styles.readingAttachments}>
                        <h5>{t('mail.attachments', language())} ({(message().attachments || []).length})</h5>
                        <For each={message().attachments || []}>
                          {(att) => (
                            <>
                              <Show when={att.type === 'image'}>
                                <img
                                  src={att.url}
                                  alt={att.name || ''}
                                  class={styles.readingAttachThumb}
                                  loading="lazy"
                                />
                              </Show>
                              <div class={styles.attachChip}>
                                <span class={styles.attachChipIcon}>{attachmentIcon(att.type)}</span>
                                <a href={att.url} target="_blank" rel="noreferrer">
                                  {att.name || att.url}
                                </a>
                                <Show when={att.type === 'image' || att.type === 'video'}>
                                  <button
                                    class={styles.attachChipSave}
                                    onClick={() => {
                                      void fetchNui('storeMediaUrl', { url: att.url, type: att.type }, { success: true });
                                    }}
                                  >
                                    {t('gallery.save', language()) || 'Save'}
                                  </button>
                                </Show>
                              </div>
                            </>
                          )}
                        </For>
                      </div>
                    </Show>
                  </div>
                </div>
              );
            }}
          </Show>

          {/* ─── Compose View ─── */}
          <Show when={view() === 'compose'}>
            <div class={styles.composeView}>
              {/* Header */}
              <div class={styles.composeHeader}>
                <button class={styles.composeHeaderBtn} onClick={cancelCompose}>
                  {t('mail.cancel', language())}
                </button>
                <h4 class={styles.composeTitle}>{t('mail.new_message', language())}</h4>
                <button
                  class={`${styles.composeHeaderBtn} ${styles.composeHeaderBtnSend}`}
                  disabled={!canSend()}
                  onClick={() => void sendMail()}
                >
                  {t('mail.send', language())}
                </button>
              </div>

              {/* Error */}
              <Show when={!!error()}>
                <div class={styles.composeError}>{error()}</div>
              </Show>

              <div class={styles.composeScroll}>
                {/* To field */}
                <div class={styles.composeField}>
                  <span class={styles.composeFieldLabel}>{t('mail.compose.to', language()) || 'To:'}</span>
                  <input
                    class={styles.composeFieldInput}
                    value={toInput()}
                    onInput={(e) => {
                      setToInput(e.currentTarget.value);
                      if (error()) setError('');
                    }}
                    placeholder={t('mail.placeholder.to', language())}
                  />
                </div>

                {/* Contact suggestions */}
                <Show when={contactSuggestions().length > 0}>
                  <div class={styles.contactSuggestions}>
                    <For each={contactSuggestions()}>
                      {(contact) => {
                        const cAvatar = () => resolveAvatar(contact.number, contact.display);
                        return (
                          <button
                            class={styles.contactSuggestion}
                            onClick={() => {
                              setToInput(contact.number || contact.display);
                            }}
                          >
                            <LetterAvatar
                              label={cAvatar().label}
                              color={cAvatar().color}
                              imageUrl={contact.avatar}
                              size={28}
                              gradient
                            />
                            <div>
                              <div class={styles.contactSuggestionName}>{contact.display}</div>
                              <Show when={contact.number}>
                                <div class={styles.contactSuggestionEmail}>{contact.number}</div>
                              </Show>
                            </div>
                          </button>
                        );
                      }}
                    </For>
                  </div>
                </Show>

                {/* Subject field */}
                <div class={styles.composeField}>
                  <span class={styles.composeFieldLabel}>{t('mail.compose.subject', language()) || 'Subject:'}</span>
                  <input
                    class={styles.composeFieldInput}
                    value={subjectInput()}
                    onInput={(e) => setSubjectInput(e.currentTarget.value)}
                    placeholder={t('mail.placeholder.subject', language())}
                  />
                </div>

                {/* Body */}
                <textarea
                  ref={bodyFieldRef}
                  class={styles.composeBody}
                  value={bodyInput()}
                  onInput={(e) => {
                    setBodyInput(e.currentTarget.value);
                    if (error()) setError('');
                  }}
                  placeholder={t('mail.placeholder.body', language())}
                />

                {/* Inline attachment chips */}
                <Show when={attachments().length > 0}>
                  <div class={styles.composeAttachments}>
                    <For each={attachments()}>
                      {(att, idx) => (
                        <div class={styles.composeAttachChip}>
                          <span class={styles.composeAttachChipIcon}>{attachmentIcon(att.type)}</span>
                          <span class={styles.composeAttachChipName}>{att.name || att.url}</span>
                          <button
                            class={styles.composeAttachChipRemove}
                            onClick={() => removeAttachment(idx())}
                          >
                            {'\u00D7'}
                          </button>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
              </div>

              {/* Footer with attach button */}
              <div class={styles.composeFooter}>
                <button
                  class={styles.composeAttachBtn}
                  onClick={() => setShowAttachSheet(true)}
                  title={t('mail.compose.attach', language()) || 'Attach'}
                >
                  +
                </button>
              </div>
            </div>
          </Show>
        </Show>
      </div>

      {/* Attachment action sheet */}
      <ActionSheet
        open={showAttachSheet()}
        title={t('mail.compose.attach', language()) || 'Add attachment'}
        onClose={() => setShowAttachSheet(false)}
        actions={[
          {
            label: t('mail.compose.attach_gallery', language()) || t('mail.gallery', language()) || 'Gallery',
            onClick: () => void attachFromGallery(),
          },
          {
            label: t('mail.compose.attach_document', language()) || 'Document',
            onClick: () => void attachFromDocuments(),
          },
          {
            label: t('mail.compose.attach_camera', language()) || t('mail.camera', language()) || 'Camera',
            onClick: () => void attachFromCamera(),
          },
        ]}
      />
    </AppScaffold>
  );
}
