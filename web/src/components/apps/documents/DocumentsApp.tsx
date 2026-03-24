import { For, Show, createEffect, createMemo, createSignal, onMount, batch } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchNui } from '../../../utils/fetchNui';
import { requestMugshot } from '../../../utils/mugshot';
import { timeAgo } from '../../../utils/misc';
import { uiConfirm } from '../../../utils/uiDialog';
import { useNuiEvent } from '../../../utils/useNui';
import { AppScaffold } from '../../shared/layout';
import { usePhoneKeyHandler } from '../../../hooks/usePhoneKeyHandler';
import { useNfcShare } from '../../../hooks/useNfcShare';
import { usePhoneState } from '../../../store/phone';
import { NfcShareSheet } from '../../shared/ui/NfcShareSheet';
import { SearchInput } from '../../shared/ui/SearchInput';
import { EmptyState } from '../../shared/ui/EmptyState';
import { InlineNotice } from '../../shared/ui/InlineNotice';
import { Modal, ModalActions, ModalButton } from '../../shared/ui/Modal';
import { SheetIntro } from '../../shared/ui/SheetIntro';
import { t } from '../../../i18n';
import styles from './DocumentsApp.module.scss';

interface Document {
  id: number;
  doc_type: string;
  title: string;
  holder_name: string;
  holder_number?: string;
  photo?: string;
  expires_at?: string;
  verification_code: string;
  created_at: string;
  nfc_enabled: number;
}

interface DocType {
  id: string;
  name: string;
  icon: string;
  color: string;
}

interface ScanEntry {
  id: number;
  doc_type: string;
  title: string;
  scanned_at: string;
  scan_type: string;
}

interface ScannedDoc {
  doc_type: string;
  title: string;
  holder_name: string;
  holder_number?: string;
  expires_at?: string;
  verification_code: string;
  scanned_at: string;
}

function DocumentTypeAccent(props: { icon: string; color: string; class: string; label?: string }) {
  return (
    <div class={props.class} style={{ '--doc-accent': props.color }} aria-label={props.label}>
      <span>{props.icon}</span>
    </div>
  );
}

export function DocumentsApp() {
  const router = useRouter();
  const phoneState = usePhoneState();
  const language = () => phoneState.settings.language || 'es';
  const isReadOnly = createMemo(() => phoneState.accessMode === 'foreign-readonly');
  const playerName = () => phoneState.playerName || 'Ciudadano';

  // Data state
  const [documents, setDocuments] = createSignal<Document[]>([]);
  const [docTypes, setDocTypes] = createSignal<DocType[]>([]);
  const [scanHistory, setScanHistory] = createSignal<ScanEntry[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [search, setSearch] = createSignal('');

  // Detail state
  const [selectedDoc, setSelectedDoc] = createSignal<Document | null>(null);
  const [scanHistoryOpen, setScanHistoryOpen] = createSignal(false);

  // Wizard state
  const [wizardOpen, setWizardOpen] = createSignal(false);
  const [wizardStep, setWizardStep] = createSignal(1);
  const [wizardPhoto, setWizardPhoto] = createSignal('');
  const [wizardType, setWizardType] = createSignal<DocType | null>(null);
  const [wizardTitle, setWizardTitle] = createSignal('');
  const [wizardHolder, setWizardHolder] = createSignal('');
  const [wizardNumber, setWizardNumber] = createSignal('');
  const [wizardExpiry, setWizardExpiry] = createSignal('');
  const [mugshotLoading, setMugshotLoading] = createSignal(false);

  // NFC share
  const [nfcDocId, setNfcDocId] = createSignal<number | null>(null);
  const nfcShare = useNfcShare({
    onShare: async (targetServerId) => {
      const docId = nfcDocId();
      if (!docId) return { success: false, error: 'INVALID_DATA' };
      return fetchNui('shareDocument', { documentId: docId, targetServerId }, { success: false });
    },
    successMessage: 'Documento compartido por NFC',
  });

  // Doc picker (for NFC route-based share)
  const [showDocPicker, setShowDocPicker] = createSignal(false);
  const [docPickerTarget, setDocPickerTarget] = createSignal<number | null>(null);

  // Received document modal
  const [receivedDoc, setReceivedDoc] = createSignal<ScannedDoc & { from?: string; shared_at?: string } | null>(null);
  const [lastNfcRouteKey, setLastNfcRouteKey] = createSignal('');

  // Issued notification toast
  const [issuedToast, setIssuedToast] = createSignal(false);

  // -- Data loading --
  const loadDocuments = async () => {
    const docs = await fetchNui<Document[]>('documentsGetList', {}, []);
    setDocuments(docs || []);
  };

  const loadData = async () => {
    setLoading(true);
    const [types, docs, history] = await Promise.all([
      fetchNui<DocType[]>('documentsGetTypes', {}, []),
      fetchNui<Document[]>('documentsGetList', {}, []),
      fetchNui<ScanEntry[]>('documentsGetScanHistory', {}, []),
    ]);
    batch(() => {
      setDocTypes(types || []);
      setDocuments(docs || []);
      setScanHistory(history || []);
      setLoading(false);
    });
  };

  onMount(() => {
    void loadData();
  });

  // -- Helpers --
  const getDocTypeInfo = (typeId: string): DocType => {
    return docTypes().find((dt) => dt.id === typeId) || { id: typeId, name: 'Documento', icon: 'DOC', color: '#8e8e93' };
  };

  const isExpired = (expiresAt?: string): boolean => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const filteredDocs = createMemo(() => {
    const q = search().toLowerCase().trim();
    if (!q) return documents();
    return documents().filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.holder_name.toLowerCase().includes(q) ||
        d.doc_type.toLowerCase().includes(q),
    );
  });

  // -- NUI events --
  useNuiEvent<Document>('documentIssued', (doc) => {
    if (!doc) return;
    setDocuments((prev) => [doc, ...prev]);
    setIssuedToast(true);
    setTimeout(() => setIssuedToast(false), 3000);
  });

  useNuiEvent<{ targetServerId?: number }>('openDocumentPicker', (payload) => {
    setDocPickerTarget(payload?.targetServerId || null);
    setShowDocPicker(true);
  });

  useNuiEvent<{ document?: ScannedDoc; from?: string; shared_at?: string }>('receiveSharedDocument', (payload) => {
    if (!payload?.document) return;
    setReceivedDoc({ ...payload.document, from: payload.from, shared_at: payload.shared_at });
  });

  // NFC route params
  createEffect(() => {
    const params = router.params() as {
      nfcAction?: string;
      targetServerId?: number;
      requestId?: number;
      receivedDocument?: { document?: ScannedDoc; from?: string; shared_at?: string };
    };
    const key = `${params?.requestId || 0}:${params?.nfcAction || 'none'}:${params?.targetServerId || ''}`;
    if (key === lastNfcRouteKey()) return;
    setLastNfcRouteKey(key);

    if (params?.nfcAction === 'share_document' && typeof params?.targetServerId === 'number') {
      setDocPickerTarget(params.targetServerId);
      setShowDocPicker(true);
    }
    if (params?.nfcAction === 'received_document' && params.receivedDocument?.document) {
      setReceivedDoc({
        ...params.receivedDocument.document,
        from: params.receivedDocument.from,
        shared_at: params.receivedDocument.shared_at,
      });
    }
  });

  // -- Key handler --
  usePhoneKeyHandler({
    Backspace: () => {
      if (wizardOpen()) {
        if (wizardStep() > 1) {
          setWizardStep((s) => s - 1);
        } else {
          closeWizard();
        }
        return;
      }
      if (selectedDoc()) {
        setSelectedDoc(null);
        return;
      }
      router.goBack();
    },
  });

  // -- CRUD operations --
  const deleteDocument = async (id: number) => {
    if (isReadOnly()) return;
    if (!(await uiConfirm(t('documents.confirm.delete_message', language()), { title: t('documents.confirm.delete_title', language()) }))) return;
    await fetchNui('documentsDelete', { documentId: id });
    await loadDocuments();
    setSelectedDoc(null);
  };

  const toggleNFC = async (doc: Document) => {
    if (isReadOnly()) return;
    const newValue = !doc.nfc_enabled;
    await fetchNui('documentsToggleNFC', { documentId: doc.id, enabled: newValue });
    setDocuments((docs) => docs.map((d) => (d.id === doc.id ? { ...d, nfc_enabled: newValue ? 1 : 0 } : d)));
    // Update selected doc too
    const sel = selectedDoc();
    if (sel && sel.id === doc.id) {
      setSelectedDoc({ ...sel, nfc_enabled: newValue ? 1 : 0 });
    }
  };

  const shareDocumentByMail = (doc: Document) => {
    if (isReadOnly()) return;
    const typeInfo = getDocTypeInfo(doc.doc_type);
    const lines = [
      `${typeInfo.name}: ${doc.title}`,
      `${t('documents.field.holder', language())}: ${doc.holder_name || 'N/D'}`,
      doc.holder_number ? `${t('documents.field.number', language())}: ${doc.holder_number}` : '',
      doc.expires_at ? `${t('documents.field.expiry', language())}: ${doc.expires_at}` : '',
      `${t('documents.field.verification_code', language())}: ${doc.verification_code}`,
    ].filter(Boolean);

    setSelectedDoc(null);
    router.navigate('mail', {
      compose: '1',
      subject: `${t('documents.mail_subject', language())}: ${doc.title}`,
      body: lines.join('\n'),
      attachmentType: 'document',
      attachmentUrl: `DOC:${doc.id}:${doc.verification_code}`,
      attachmentName: doc.title,
    });
  };

  const shareDocumentPicker = async (docId: number) => {
    if (isReadOnly()) return;
    if (!docPickerTarget()) return;
    const result = await fetchNui<{ success?: boolean; error?: string }>('shareDocument', {
      documentId: docId,
      targetServerId: docPickerTarget(),
    });
    if (result?.success) {
      setShowDocPicker(false);
      setDocPickerTarget(null);
    }
  };

  const addMugshotToDoc = async (doc: Document) => {
    const base64 = await requestMugshot();
    if (!base64) return;
    const result = await fetchNui<{ success?: boolean }>('documentsUpdatePhoto', { documentId: doc.id, photo: base64 });
    if (result?.success) {
      void loadDocuments();
      setSelectedDoc({ ...doc, photo: base64 });
    }
  };

  // -- Wizard --
  const openWizard = () => {
    if (isReadOnly()) return;
    batch(() => {
      setWizardStep(1);
      setWizardPhoto('');
      setWizardType(null);
      setWizardTitle('');
      setWizardHolder(playerName());
      setWizardNumber('');
      setWizardExpiry('');
      setWizardOpen(true);
    });
  };

  const closeWizard = () => {
    setWizardOpen(false);
  };

  const takeMugshot = async () => {
    setMugshotLoading(true);
    const base64 = await requestMugshot();
    if (base64) setWizardPhoto(base64);
    setMugshotLoading(false);
  };

  const createDocument = async () => {
    if (isReadOnly()) return;
    const selType = wizardType();
    if (!selType) return;
    if (!wizardTitle().trim()) return;

    setLoading(true);
    const result = await fetchNui<{ success?: boolean; document?: Document }>('documentsCreate', {
      docType: selType.id,
      title: wizardTitle(),
      holderName: wizardHolder() || undefined,
      holderNumber: wizardNumber() || undefined,
      expiresAt: wizardExpiry() || undefined,
      photo: wizardPhoto() || undefined,
    });
    setLoading(false);

    if (result?.success) {
      closeWizard();
      await loadDocuments();
    }
  };

  const wizardStepLabels = () => [
    t('documents.wizard.step_mugshot', language()),
    t('documents.wizard.step_type', language()),
    t('documents.wizard.step_details', language()),
  ];

  // -- Render --
  return (
    <AppScaffold title={t('documents.title', language())} onBack={() => router.goBack()} bodyClass={styles.body}>
      <div class={styles.documentsApp}>
        <Show when={isReadOnly()}>
          <InlineNotice
            title={t('documents.readonly_title', language())}
            message={t('documents.readonly_message', language(), { name: phoneState.accessOwnerName || '' })}
          />
        </Show>

        {/* Search bar */}
        <div class={styles.searchBar}>
          <SearchInput
            value={search()}
            onInput={setSearch}
            placeholder={t('documents.search', language())}
          />
        </div>

        {/* Document list */}
        <div class={styles.documentsList}>
          <Show when={loading() && documents().length === 0}>
            <div class={styles.loading}>{t('state.loading', language())}</div>
          </Show>

          <For each={filteredDocs()}>
            {(doc) => {
              const typeInfo = getDocTypeInfo(doc.doc_type);
              const expired = isExpired(doc.expires_at);

              return (
                <div
                  class={styles.credentialCard}
                  style={{ '--card-accent': typeInfo.color }}
                  onClick={() => setSelectedDoc(doc)}
                >
                  {/* Photo thumbnail */}
                  <Show
                    when={doc.photo}
                    fallback={
                      <div class={styles.cardPhotoPlaceholder} style={{ '--card-accent': typeInfo.color }}>
                        {typeInfo.icon}
                      </div>
                    }
                  >
                    <div class={styles.cardPhoto}>
                      <img src={doc.photo} alt="" />
                    </div>
                  </Show>

                  {/* Card body */}
                  <div class={styles.cardBody}>
                    <h3 class={styles.cardTitle}>{doc.title}</h3>
                    <div class={styles.cardMeta}>
                      <span class={styles.cardHolder}>{doc.holder_name}</span>
                      <span class={styles.typeBadge} style={{ '--card-accent': typeInfo.color }}>
                        {typeInfo.name}
                      </span>
                    </div>
                  </div>

                  {/* Trailing indicators */}
                  <div class={styles.cardTrailing}>
                    <Show when={doc.expires_at}>
                      <div class={styles.expiryDot} classList={{ [styles.expired]: expired }} />
                    </Show>
                    <Show when={doc.nfc_enabled}>
                      <span class={styles.nfcIcon}>NFC</span>
                    </Show>
                  </div>
                </div>
              );
            }}
          </For>

          <Show when={!loading() && filteredDocs().length === 0}>
            <EmptyState
              class={styles.emptyState}
              title={t('documents.empty_title', language())}
              description={t('documents.empty_desc', language())}
            />
          </Show>
        </div>

        {/* FAB */}
        <Show when={!isReadOnly()}>
          <button class={styles.fab} onClick={openWizard}>
            <span>+</span>
          </button>
        </Show>

        {/* ===== Detail Overlay ===== */}
        <Show when={selectedDoc()}>
          {(() => {
            const doc = selectedDoc()!;
            const typeInfo = getDocTypeInfo(doc.doc_type);
            const expired = isExpired(doc.expires_at);

            return (
              <div class={styles.detailOverlay}>
                <button class={styles.detailBackBtn} onClick={() => setSelectedDoc(null)}>
                  {'<'}
                </button>

                {/* Header gradient */}
                <div class={styles.detailHeader} style={{ '--detail-accent': typeInfo.color }}>
                  <Show
                    when={doc.photo}
                    fallback={
                      <div class={styles.detailPhotoPlaceholder}>{typeInfo.icon}</div>
                    }
                  >
                    <div class={styles.detailPhoto}>
                      <img src={doc.photo} alt="" />
                    </div>
                  </Show>
                  <h2 class={styles.detailTitle}>{doc.title}</h2>
                  <span class={styles.detailTypeBadge}>{typeInfo.name}</span>
                </div>

                {/* Body fields */}
                <div class={styles.detailBody}>
                  <div class={styles.detailField}>
                    <label>{t('documents.detail.holder', language())}</label>
                    <strong>{doc.holder_name}</strong>
                  </div>

                  <Show when={doc.holder_number}>
                    <div class={styles.detailField}>
                      <label>{t('documents.detail.number', language())}</label>
                      <strong>{doc.holder_number}</strong>
                    </div>
                  </Show>

                  <Show when={doc.expires_at}>
                    <div class={styles.detailField}>
                      <label>{t('documents.detail.expires', language())}</label>
                      <span
                        class={styles.expiryBadge}
                        classList={{ [styles.valid]: !expired, [styles.expiredBadge]: expired }}
                      >
                        {doc.expires_at}
                        {' '}
                        {expired ? t('documents.detail.expired', language()) : t('documents.detail.valid', language())}
                      </span>
                    </div>
                  </Show>

                  <div class={styles.detailField}>
                    <label>{t('documents.detail.code', language())}</label>
                    <div class={styles.codeBox}>{doc.verification_code}</div>
                  </div>
                </div>

                {/* Actions */}
                <Show when={!isReadOnly()}>
                  <div class={styles.detailActions}>
                    {/* NFC toggle */}
                    <div class={styles.nfcToggleRow}>
                      <span>{t('documents.detail.nfc_toggle', language())}</span>
                      <input
                        type="checkbox"
                        checked={doc.nfc_enabled === 1}
                        onChange={() => toggleNFC(doc)}
                      />
                    </div>

                    {/* NFC share */}
                    <Show when={doc.nfc_enabled}>
                      <button
                        class={styles.actionBtn}
                        onClick={() => {
                          setNfcDocId(doc.id);
                          nfcShare.open();
                        }}
                      >
                        <span class={styles.actionIcon}>NFC</span>
                        {t('documents.detail.nfc_share', language())}
                      </button>
                    </Show>

                    {/* Send by mail */}
                    <button class={styles.actionBtn} onClick={() => shareDocumentByMail(doc)}>
                      <span class={styles.actionIcon}>@</span>
                      {t('documents.detail.send_mail', language())}
                    </button>

                    {/* Add mugshot (if no photo) */}
                    <Show when={!doc.photo}>
                      <button class={styles.actionBtn} onClick={() => void addMugshotToDoc(doc)}>
                        <span class={styles.actionIcon}>ID</span>
                        {t('documents.detail.add_mugshot', language())}
                      </button>
                    </Show>

                    {/* Delete */}
                    <button
                      class={`${styles.actionBtn} ${styles.danger}`}
                      onClick={() => void deleteDocument(doc.id)}
                    >
                      <span class={styles.actionIcon}>X</span>
                      {t('documents.detail.delete', language())}
                    </button>
                  </div>

                  {/* Scan history (expandable) */}
                  <div class={styles.scanHistorySection}>
                    <button
                      class={styles.scanHistoryToggle}
                      onClick={() => setScanHistoryOpen((prev) => !prev)}
                    >
                      <span class={styles.actionIcon}>{scanHistoryOpen() ? '-' : '+'}</span>
                      {t('documents.detail.scan_history', language())}
                    </button>

                    <Show when={scanHistoryOpen()}>
                      <div class={styles.scanHistoryList}>
                        <Show
                          when={scanHistory().length > 0}
                          fallback={
                            <div class={styles.scanHistoryEmpty}>
                              {t('documents.no_history', language())}
                            </div>
                          }
                        >
                          <For each={scanHistory()}>
                            {(entry) => (
                              <div class={styles.scanHistoryItem}>
                                <span>{entry.scan_type === 'nfc' ? 'NFC' : 'MANUAL'}</span>
                                <span style={{ flex: '1' }}>{entry.title}</span>
                                <span>{timeAgo(entry.scanned_at)}</span>
                              </div>
                            )}
                          </For>
                        </Show>
                      </div>
                    </Show>
                  </div>
                </Show>
              </div>
            );
          })()}
        </Show>

        {/* ===== Creation Wizard ===== */}
        <Show when={wizardOpen()}>
          <div class={styles.wizardOverlay}>
            {/* Header */}
            <div class={styles.wizardHeader}>
              <Show when={wizardStep() > 1} fallback={<span />}>
                <button onClick={() => setWizardStep((s) => s - 1)}>
                  {t('documents.wizard.back', language())}
                </button>
              </Show>
              <span class={styles.wizardStepLabel}>{wizardStepLabels()[wizardStep() - 1]}</span>
              <button onClick={() => closeWizard()}>
                {t('documents.wizard.cancel', language())}
              </button>
            </div>

            {/* Progress dots */}
            <div class={styles.wizardProgress}>
              <div class={styles.wizardProgressDot} classList={{ [styles.active]: wizardStep() >= 1 }} />
              <div class={styles.wizardProgressDot} classList={{ [styles.active]: wizardStep() >= 2 }} />
              <div class={styles.wizardProgressDot} classList={{ [styles.active]: wizardStep() >= 3 }} />
            </div>

            {/* Body */}
            <div class={styles.wizardBody}>
              {/* Step 1: Mugshot */}
              <Show when={wizardStep() === 1}>
                <div class={styles.mugshotArea}>
                  <Show
                    when={wizardPhoto()}
                    fallback={
                      <div class={styles.mugshotPlaceholder}>?</div>
                    }
                  >
                    <div class={styles.mugshotPreview}>
                      <img src={wizardPhoto()} alt="" />
                    </div>
                  </Show>

                  <button
                    class={styles.mugshotBtn}
                    onClick={() => void takeMugshot()}
                    disabled={mugshotLoading()}
                  >
                    {mugshotLoading()
                      ? '...'
                      : t('documents.wizard.take_mugshot', language())}
                  </button>
                </div>
              </Show>

              {/* Step 2: Type selection */}
              <Show when={wizardStep() === 2}>
                <div class={styles.typeGrid}>
                  <For each={docTypes()}>
                    {(dtype) => (
                      <button
                        class={styles.typeCard}
                        classList={{ [styles.selected]: wizardType()?.id === dtype.id }}
                        style={{ '--type-accent': dtype.color }}
                        onClick={() => setWizardType(dtype)}
                      >
                        <span class={styles.typeCardIcon}>{dtype.icon}</span>
                        <span class={styles.typeCardName}>{dtype.name}</span>
                      </button>
                    )}
                  </For>
                </div>
              </Show>

              {/* Step 3: Details */}
              <Show when={wizardStep() === 3}>
                <div class={styles.wizardForm}>
                  <div class={styles.wizardFieldGroup}>
                    <label class={styles.wizardFieldLabel}>
                      {t('documents.title', language())} *
                    </label>
                    <input
                      class={styles.wizardInput}
                      type="text"
                      placeholder={t('documents.new_placeholder', language())}
                      value={wizardTitle()}
                      onInput={(e) => setWizardTitle(e.currentTarget.value)}
                    />
                  </div>

                  <div class={styles.wizardFieldGroup}>
                    <label class={styles.wizardFieldLabel}>
                      {t('documents.detail.holder', language())}
                    </label>
                    <input
                      class={styles.wizardInput}
                      type="text"
                      placeholder={t('documents.full_name', language())}
                      value={wizardHolder()}
                      onInput={(e) => setWizardHolder(e.currentTarget.value)}
                    />
                  </div>

                  <div class={styles.wizardFieldGroup}>
                    <label class={styles.wizardFieldLabel}>
                      {t('documents.detail.number', language())}
                    </label>
                    <input
                      class={styles.wizardInput}
                      type="text"
                      placeholder={t('documents.optional', language())}
                      value={wizardNumber()}
                      onInput={(e) => setWizardNumber(e.currentTarget.value)}
                    />
                  </div>

                  <div class={styles.wizardFieldGroup}>
                    <label class={styles.wizardFieldLabel}>
                      {t('documents.detail.expires', language())}
                    </label>
                    <input
                      class={styles.wizardInput}
                      type="date"
                      value={wizardExpiry()}
                      onInput={(e) => setWizardExpiry(e.currentTarget.value)}
                    />
                  </div>
                </div>
              </Show>
            </div>

            {/* Footer */}
            <div class={styles.wizardFooter}>
              <Show when={wizardStep() === 1}>
                <button
                  class={`${styles.wizardFooterBtn} ${styles.secondary}`}
                  onClick={() => setWizardStep(2)}
                >
                  {t('documents.wizard.skip', language())}
                </button>
                <button
                  class={`${styles.wizardFooterBtn} ${styles.primary}`}
                  onClick={() => setWizardStep(2)}
                  disabled={false}
                >
                  {t('documents.wizard.next', language())}
                </button>
              </Show>

              <Show when={wizardStep() === 2}>
                <button
                  class={`${styles.wizardFooterBtn} ${styles.primary}`}
                  onClick={() => setWizardStep(3)}
                  disabled={!wizardType()}
                >
                  {t('documents.wizard.next', language())}
                </button>
              </Show>

              <Show when={wizardStep() === 3}>
                <button
                  class={`${styles.wizardFooterBtn} ${styles.primary}`}
                  onClick={() => void createDocument()}
                  disabled={!wizardTitle().trim() || loading()}
                >
                  {loading()
                    ? t('documents.creating', language())
                    : t('documents.wizard.create', language())}
                </button>
              </Show>
            </div>
          </div>
        </Show>

        {/* ===== Received document modal ===== */}
        <Show when={receivedDoc()}>
          <div class={styles.scanResultModal}>
            <button class={styles.closeBtn} onClick={() => setReceivedDoc(null)}>
              <img src="./img/icons_ios/ui-close.svg" alt="" />
            </button>

            {(() => {
              const doc = receivedDoc()!;
              const typeInfo = getDocTypeInfo(doc.doc_type);
              const expired = isExpired(doc.expires_at);

              return (
                <div class={styles.scanResultContent}>
                  <div
                    class={styles.scanResultHeader}
                    classList={{ [styles.valid]: !expired, [styles.invalid]: expired }}
                  >
                    <span class={styles.scanStatus}>
                      {expired ? t('documents.detail.expired', language()) : t('documents.detail.valid', language())}
                    </span>
                  </div>

                  <div class={styles.scanResultBody}>
                    <DocumentTypeAccent
                      class={styles.scanDocIcon}
                      color={typeInfo.color}
                      icon={typeInfo.icon}
                      label={typeInfo.name}
                    />
                    <h2>{doc.title}</h2>
                    <span class={styles.scanDocType}>{typeInfo.name}</span>

                    <div class={styles.scanFields}>
                      <div class={styles.scanField}>
                        <label>{t('documents.detail.holder', language())}</label>
                        <strong>{doc.holder_name}</strong>
                      </div>

                      <Show when={doc.holder_number}>
                        <div class={styles.scanField}>
                          <label>{t('documents.detail.number', language())}</label>
                          <strong>{doc.holder_number}</strong>
                        </div>
                      </Show>

                      <Show when={doc.expires_at}>
                        <div class={styles.scanField}>
                          <label>{t('documents.detail.expires', language())}</label>
                          <strong classList={{ [styles.expiredText]: expired }}>{doc.expires_at}</strong>
                        </div>
                      </Show>

                      <div class={styles.scanField}>
                        <label>{t('documents.detail.code', language())}</label>
                        <strong>{doc.verification_code}</strong>
                      </div>

                      <Show when={doc.from}>
                        <div class={styles.scanField}>
                          <label>Compartido por</label>
                          <strong>{doc.from}</strong>
                        </div>
                      </Show>

                      <Show when={doc.shared_at}>
                        <div class={styles.scanField}>
                          <label>Fecha</label>
                          <strong>{doc.shared_at}</strong>
                        </div>
                      </Show>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </Show>

        {/* ===== Issued notification toast ===== */}
        <Show when={issuedToast()}>
          <div class={styles.issuedToast}>
            {t('documents.issued_notification', language())}
          </div>
        </Show>
      </div>

      {/* NFC share sheet */}
      <NfcShareSheet
        open={nfcShare.isOpen()}
        onClose={nfcShare.close}
        onSelect={(id) => void nfcShare.handleSelect(id)}
        title={t('documents.detail.nfc_share', language())}
        maxDistance={2.0}
        disabled={nfcShare.sharing()}
      />

      {/* Doc picker modal (for NFC route-based share) */}
      <Modal
        open={!isReadOnly() && showDocPicker()}
        title={t('documents.select', language())}
        onClose={() => {
          setShowDocPicker(false);
          setDocPickerTarget(null);
        }}
        size="md"
      >
        <div class={styles.docPickerContent}>
          <SheetIntro
            title={t('documents.select', language())}
            description={t('documents.select_to_show', language())}
          />
          <div class={styles.docPickerList}>
            <For each={documents().filter((d) => d.nfc_enabled)}>
              {(doc) => {
                const typeInfo = getDocTypeInfo(doc.doc_type);
                return (
                  <button class={styles.docPickerItem} onClick={() => void shareDocumentPicker(doc.id)}>
                    <DocumentTypeAccent
                      class={styles.docPickerIcon}
                      color={typeInfo.color}
                      icon={typeInfo.icon}
                      label={typeInfo.name}
                    />
                    <div class={styles.docPickerInfo}>
                      <strong>{doc.title}</strong>
                      <span>{typeInfo.name}</span>
                    </div>
                  </button>
                );
              }}
            </For>
          </div>
          <Show when={documents().filter((d) => d.nfc_enabled).length === 0}>
            <p class={styles.docPickerEmpty}>{t('documents.no_history', language())}</p>
          </Show>
        </div>

        <ModalActions>
          <ModalButton
            label={t('action.cancel', language())}
            onClick={() => {
              setShowDocPicker(false);
              setDocPickerTarget(null);
            }}
          />
        </ModalActions>
      </Modal>
    </AppScaffold>
  );
}
