import { For, Show, createEffect, createMemo, createSignal } from 'solid-js';
import { AppScaffold } from '../../shared/layout/AppScaffold';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchNui } from '../../../utils/fetchNui';
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

export function MailApp() {
  const router = useRouter();
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');

  const [domain, setDomain] = createSignal('noimotors.gg');
  const [account, setAccount] = createSignal<MailAccount | null>(null);
  const [unread, setUnread] = createSignal(0);
  const [inbox, setInbox] = createSignal<MailMessage[]>([]);
  const [sent, setSent] = createSignal<MailMessage[]>([]);

  const [folder, setFolder] = createSignal<'inbox' | 'sent'>('inbox');
  const [selectedId, setSelectedId] = createSignal<number | null>(null);

  const [aliasInput, setAliasInput] = createSignal('');
  const [passwordInput, setPasswordInput] = createSignal('');

  const [toInput, setToInput] = createSignal('');
  const [subjectInput, setSubjectInput] = createSignal('');
  const [bodyInput, setBodyInput] = createSignal('');
  const [attachments, setAttachments] = createSignal<MailAttachment[]>([]);
  const [attachmentType, setAttachmentType] = createSignal<MailAttachment['type']>('document');
  const [attachmentUrl, setAttachmentUrl] = createSignal('');
  const [attachmentName, setAttachmentName] = createSignal('');

  const selectedMessage = createMemo(() => {
    const id = selectedId();
    if (!id) return null;
    const source = folder() === 'inbox' ? inbox() : sent();
    return source.find((entry) => Number(entry.id) === Number(id)) || null;
  });

  const visibleMessages = createMemo(() => (folder() === 'inbox' ? inbox() : sent()));

  const loadState = async () => {
    setLoading(true);
    setError('');

    const payload = await fetchNui<MailStateResponse>('mailGetState', { limit: 40, offset: 0 }, {
      success: true,
      hasAccount: false,
      account: null,
      inbox: [],
      sent: [],
      unread: 0,
      domain: 'noimotors.gg',
    });

    setLoading(false);
    setDomain(payload?.domain || 'noimotors.gg');

    if (!payload?.success) {
      setError(payload?.error || 'No se pudo cargar Mail');
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

  const createAccount = async () => {
    const alias = aliasInput().trim();
    const password = passwordInput().trim();

    if (!alias || !password) {
      setError('Alias y password son requeridos');
      return;
    }

    setLoading(true);
    setError('');

    const payload = await fetchNui<MailActionResponse>('mailCreateAccount', {
      alias,
      password,
    }, { success: false });

    setLoading(false);
    if (!payload?.success) {
      setError(payload?.error || 'No se pudo crear la cuenta');
      return;
    }

    setAliasInput('');
    setPasswordInput('');
    await loadState();
  };

  const sendMail = async () => {
    if (!account()) return;

    const to = toInput().trim().toLowerCase();
    const subject = subjectInput().trim();
    const body = bodyInput().trim();

    if (!to || !body) {
      setError('Destino y mensaje son requeridos');
      return;
    }

    setLoading(true);
    setError('');

    const payload = await fetchNui<MailActionResponse>('mailSend', {
      to,
      subject,
      body,
      attachments: attachments(),
    }, { success: false });

    setLoading(false);
    if (!payload?.success) {
      setError(payload?.error || 'No se pudo enviar el mail');
      return;
    }

    setToInput('');
    setSubjectInput('');
    setBodyInput('');
    setAttachments([]);
    setAttachmentType('document');
    setAttachmentUrl('');
    setAttachmentName('');
    await loadState();
    setFolder('sent');
  };

  const addAttachment = () => {
    const url = attachmentUrl().trim();
    if (!url) {
      setError('El adjunto requiere URL');
      return;
    }

    setAttachments((prev) => ([
      ...prev,
      {
        type: attachmentType(),
        url,
        name: attachmentName().trim() || undefined,
      },
    ]));
    setAttachmentUrl('');
    setAttachmentName('');
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, current) => current !== index));
  };

  const openMessage = async (message: MailMessage) => {
    setSelectedId(Number(message.id));

    if (folder() !== 'inbox') return;
    if (Number(message.is_read) === 1) return;

    await fetchNui<MailActionResponse>('mailMarkRead', { messageId: message.id }, { success: true });
    setInbox((prev) => prev.map((entry) => (
      Number(entry.id) === Number(message.id)
        ? { ...entry, is_read: 1 }
        : entry
    )));
    setUnread((prev) => Math.max(0, prev - 1));
  };

  createEffect(() => {
    void loadState();
  });

  return (
    <AppScaffold title="Mail" onBack={() => router.goBack()}>
      <div class={styles.root}>
        <Show when={!!error()}>
          <div class={styles.error}>{error()}</div>
        </Show>

        <Show when={!account()} fallback={(
          <>
            <div class={styles.accountBar}>
              <div>
                <p class={styles.label}>Cuenta</p>
                <strong>{account()?.email}</strong>
              </div>
              <div class={styles.unreadBadge}>No leidos: {unread()}</div>
            </div>

            <div class={styles.composeCard}>
              <h4>Nuevo mail</h4>
              <input class={styles.input} value={toInput()} onInput={(e) => setToInput(e.currentTarget.value)} placeholder="destino@dominio.gg" />
              <input class={styles.input} value={subjectInput()} onInput={(e) => setSubjectInput(e.currentTarget.value)} placeholder="Asunto" />
              <textarea class={styles.textarea} value={bodyInput()} onInput={(e) => setBodyInput(e.currentTarget.value)} placeholder="Escribe tu mensaje..." />

              <div class={styles.attachmentsBox}>
                <h5>Adjuntos (opcional)</h5>
                <div class={styles.attachRow}>
                  <select class={styles.select} value={attachmentType()} onChange={(e) => setAttachmentType(e.currentTarget.value as MailAttachment['type'])}>
                    <option value="image">Imagen</option>
                    <option value="video">Video</option>
                    <option value="document">Documento</option>
                    <option value="link">Link</option>
                  </select>
                  <input class={styles.inputInline} value={attachmentUrl()} onInput={(e) => setAttachmentUrl(e.currentTarget.value)} placeholder="URL interna" />
                </div>
                <div class={styles.attachRow}>
                  <input class={styles.inputInline} value={attachmentName()} onInput={(e) => setAttachmentName(e.currentTarget.value)} placeholder="Nombre (opcional)" />
                  <button class={styles.attachButton} onClick={addAttachment}>Agregar</button>
                </div>

                <Show when={attachments().length > 0}>
                  <div class={styles.attachList}>
                    <For each={attachments()}>
                      {(entry, index) => (
                        <div class={styles.attachItem}>
                          <span>{entry.type}: {entry.name || entry.url}</span>
                          <button onClick={() => removeAttachment(index())}>Quitar</button>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
              </div>

              <button class={styles.button} onClick={() => void sendMail()} disabled={loading()}>Enviar</button>
            </div>

            <div class={styles.folderTabs}>
              <button class={styles.tab} classList={{ [styles.tabActive]: folder() === 'inbox' }} onClick={() => setFolder('inbox')}>Inbox</button>
              <button class={styles.tab} classList={{ [styles.tabActive]: folder() === 'sent' }} onClick={() => setFolder('sent')}>Enviados</button>
            </div>

            <div class={styles.contentGrid}>
              <div class={styles.list}>
                <For each={visibleMessages()}>
                  {(entry) => (
                    <button
                      class={styles.item}
                      classList={{
                        [styles.itemActive]: Number(entry.id) === Number(selectedId()),
                        [styles.itemUnread]: folder() === 'inbox' && Number(entry.is_read) === 0,
                      }}
                      onClick={() => void openMessage(entry)}
                    >
                      <div class={styles.itemTop}>
                        <strong>{folder() === 'inbox' ? (entry.sender_alias || entry.sender_email || 'Remitente') : (entry.recipient_alias || entry.recipient_email)}</strong>
                        <span>{new Date(Number(entry.created_at) || Date.now()).toLocaleDateString()}</span>
                      </div>
                      <p>{entry.subject || '(Sin asunto)'}</p>
                    </button>
                  )}
                </For>
              </div>

              <div class={styles.preview}>
                <Show when={selectedMessage()} fallback={<p class={styles.empty}>Selecciona un mensaje</p>}>
                  <h4>{selectedMessage()?.subject || '(Sin asunto)'}</h4>
                  <p class={styles.previewMeta}>
                    {folder() === 'inbox'
                      ? `De: ${selectedMessage()?.sender_email || 'desconocido'}`
                      : `Para: ${selectedMessage()?.recipient_email}`}
                  </p>
                  <pre class={styles.previewBody}>{selectedMessage()?.body}</pre>
                  <Show when={(selectedMessage()?.attachments || []).length > 0}>
                    <div class={styles.previewAttachments}>
                      <h5>Adjuntos</h5>
                      <For each={selectedMessage()?.attachments || []}>
                        {(entry) => (
                          <div class={styles.previewAttachmentItem}>
                            <span>{entry.type}</span>
                            <a href={entry.url} target="_blank" rel="noreferrer">{entry.name || entry.url}</a>
                          </div>
                        )}
                      </For>
                    </div>
                  </Show>
                </Show>
              </div>
            </div>
          </>
        )}>
          <div class={styles.setupCard}>
            <h3>Configura tu Mail</h3>
            <p class={styles.setupHint}>Crea tu alias y se asignara automaticamente: <strong>@{domain()}</strong></p>
            <input class={styles.input} value={aliasInput()} onInput={(e) => setAliasInput(e.currentTarget.value)} placeholder="alias" />
            <input class={styles.input} type="password" value={passwordInput()} onInput={(e) => setPasswordInput(e.currentTarget.value)} placeholder="password" />
            <button class={styles.button} onClick={() => void createAccount()} disabled={loading()}>Crear cuenta</button>
          </div>
        </Show>
      </div>
    </AppScaffold>
  );
}
