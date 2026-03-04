import { For, Show, createEffect, createMemo, createSignal, onCleanup } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchNui } from '../../../utils/fetchNui';
import { timeAgo } from '../../../utils/misc';
import { AppScaffold } from '../../shared/layout';
import { useAppCache } from '../../../hooks';
import { Modal, ModalActions, ModalButton } from '../../shared/ui/Modal';
import styles from './DocumentsApp.module.scss';

interface Document {
  id: number;
  doc_type: string;
  title: string;
  holder_name: string;
  holder_number?: string;
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

interface ScanHistory {
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

export function DocumentsApp() {
  const router = useRouter();
<<<<<<< HEAD
  const cache = useAppCache('documents');
=======
  const [docs, setDocs] = createSignal<DocItem[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [query, setQuery] = createSignal('');
  const [typeFilter, setTypeFilter] = createSignal('all');
>>>>>>> 6087054b2c17bad903d1ba2a08f953f8451a6489

  // Data
  const [documents, setDocuments] = createSignal<Document[]>([]);
  const [docTypes, setDocTypes] = createSignal<DocType[]>([]);
  const [scanHistory, setScanHistory] = createSignal<ScanHistory[]>([]);
  const [selectedDoc, setSelectedDoc] = createSignal<Document | null>(null);

  // Tabs
  const [activeTab, setActiveTab] = createSignal<'my' | 'nfc' | 'history'>('my');

  // UI State
  const [loading, setLoading] = createSignal(false);
  const [showComposer, setShowComposer] = createSignal(false);
  const [showDocPicker, setShowDocPicker] = createSignal(false);
  const [docPickerTarget, setDocPickerTarget] = createSignal<number | null>(null);
  const [receivedDoc, setReceivedDoc] = createSignal<ScannedDoc & { from?: string; shared_at?: string } | null>(null);
  const [lastNfcRouteKey, setLastNfcRouteKey] = createSignal('');

  // Composer
  const [composerType, setComposerType] = createSignal('id');
  const [composerTitle, setComposerTitle] = createSignal('');
  const [composerHolderName, setComposerHolderName] = createSignal('');
  const [composerHolderNumber, setComposerHolderNumber] = createSignal('');
  const [composerExpires, setComposerExpires] = createSignal('');
  const [composerNFC, setComposerNFC] = createSignal(true);

  const loadData = async () => {
    setLoading(true);
    
    // Load document types
    const types = await fetchNui<DocType[]>('documentsGetTypes', {}, []);
    setDocTypes(types || []);
    
    // Load my documents
    const docs = await fetchNui<Document[]>('documentsGetList', {}, []);
    setDocuments(docs || []);
    
    // Load scan history
    const history = await fetchNui<ScanHistory[]>('documentsGetScanHistory', {}, []);
    setScanHistory(history || []);
    
    setLoading(false);
  };

  createEffect(() => {
    void loadData();
    
    // Listen for document picker events from ox_target
    const handleMessage = (event: MessageEvent) => {
      if (event?.data?.action === 'openDocumentPicker') {
        setDocPickerTarget(event.data.data?.targetServerId || null);
        setShowDocPicker(true);
      }
      if (event?.data?.action === 'receiveSharedDocument') {
        const doc = event.data.data?.document;
        if (doc) {
          setReceivedDoc({
            ...doc,
            from: event.data.data.from,
            shared_at: event.data.data.shared_at
          });
        }
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  });

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
      setActiveTab('nfc');
    }

    if (params?.nfcAction === 'received_document' && params.receivedDocument?.document) {
      setReceivedDoc({
        ...params.receivedDocument.document,
        from: params.receivedDocument.from,
        shared_at: params.receivedDocument.shared_at,
      });
    }
  });

  createEffect(() => {
    const onKey = (e: CustomEvent<string>) => {
      if (e.detail === 'Backspace') {
        if (showComposer()) {
          setShowComposer(false);
          return;
        }
        if (selectedDoc()) {
          setSelectedDoc(null);
          return;
        }
        router.goBack();
      }
    };
    window.addEventListener('phone:keyUp', onKey as EventListener);
    onCleanup(() => window.removeEventListener('phone:keyUp', onKey as EventListener));
  });

  const getDocTypeInfo = (typeId: string): DocType => {
    return docTypes().find(t => t.id === typeId) || { id: typeId, name: 'Documento', icon: 'DOC', color: '#8e8e93' };
  };

  const isExpired = (expiresAt?: string): boolean => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const createDocument = async () => {
    if (!composerTitle().trim()) {
      alert('El titulo es obligatorio');
      return;
    }

    setLoading(true);
    const result = await fetchNui<{ success?: boolean; document?: Document }>('documentsCreate', {
      docType: composerType(),
      title: composerTitle(),
      holderName: composerHolderName() || undefined,
      holderNumber: composerHolderNumber() || undefined,
      expiresAt: composerExpires() || undefined,
      nfcEnabled: composerNFC()
    });
    setLoading(false);

    if (result?.success) {
      setShowComposer(false);
      setComposerTitle('');
      setComposerHolderName('');
      setComposerHolderNumber('');
      setComposerExpires('');
      await loadData();
    } else {
      alert(result?.error || 'Error al crear documento');
    }
  };

  const deleteDocument = async (id: number) => {
    if (!confirm('¿Eliminar este documento?')) return;
    
    await fetchNui('documentsDelete', { documentId: id });
    await loadData();
    setSelectedDoc(null);
  };

  const toggleNFC = async (doc: Document) => {
    const newValue = !doc.nfc_enabled;
    await fetchNui('documentsToggleNFC', { documentId: doc.id, enabled: newValue });
    
    setDocuments(docs => docs.map(d => 
      d.id === doc.id ? { ...d, nfc_enabled: newValue ? 1 : 0 } : d
    ));
  };

  const shareDocument = async (docId: number) => {
    if (!docPickerTarget()) return;
    
    const result = await fetchNui<{ success?: boolean; error?: string }>('shareDocument', {
      documentId: docId,
      targetServerId: docPickerTarget()
    });
    
    if (result?.success) {
      setShowDocPicker(false);
      setDocPickerTarget(null);
    } else {
      alert(result?.error || 'Error al compartir documento');
    }
  };

  const docTypes = createMemo(() => {
    const options = new Set<string>(['all']);
    for (const doc of docs()) {
      const entry = String(doc.doc_type || '').trim();
      if (entry) options.add(entry);
    }
    return Array.from(options);
  });

  const visibleDocs = createMemo(() => {
    const q = query().trim().toLowerCase();
    const type = typeFilter();
    return docs().filter((doc) => {
      if (type !== 'all' && doc.doc_type !== type) return false;
      if (!q) return true;
      return (
        String(doc.title || '').toLowerCase().includes(q) ||
        String(doc.holder_name || '').toLowerCase().includes(q) ||
        String(doc.verification_code || '').toLowerCase().includes(q)
      );
    });
  });

  return (
<<<<<<< HEAD
    <AppScaffold title="Documentos" subtitle="Tus documentos digitales" onBack={() => router.goBack()} bodyClass={styles.body}>
      <div class={styles.documentsApp}>
        {/* Tabs */}
        <div class={styles.tabs}>
          <button
            class={styles.tabBtn}
            classList={{ [styles.active]: activeTab() === 'my' }}
            onClick={() => setActiveTab('my')}
          >
            Mis Docs
          </button>
          <button
            class={styles.tabBtn}
            classList={{ [styles.active]: activeTab() === 'nfc' }}
            onClick={() => setActiveTab('nfc')}
          >
            NFC
          </button>
          <button
            class={styles.tabBtn}
            classList={{ [styles.active]: activeTab() === 'history' }}
            onClick={() => setActiveTab('history')}
          >
            Historial
          </button>
        </div>

        {/* My Documents */}
        <Show when={activeTab() === 'my'}>
          <div class={styles.documentsList}>
            <Show when={loading() && documents().length === 0}>
              <div class={styles.loading}>Cargando...</div>
            </Show>
            
            <For each={documents()}>
              {(doc) => {
                const typeInfo = getDocTypeInfo(doc.doc_type);
                const expired = isExpired(doc.expires_at);
                
                return (
                  <div class={styles.documentCard} onClick={() => setSelectedDoc(doc)}>
                    <div class={styles.docIcon} style={{ background: typeInfo.color }}>
                      <span>{typeInfo.icon}</span>
                    </div>
                    
                    <div class={styles.docInfo}>
                      <h3 class={styles.docTitle}>{doc.title}</h3>
                      <span class={styles.docType}>{typeInfo.name}</span>
                      
                      <Show when={doc.expires_at}>
                        <span class={styles.docExpiry} classList={{ [styles.expired]: expired }}>
                          {expired ? 'EXPIRADO' : 'Valido hasta ' + doc.expires_at}
                        </span>
                      </Show>
                      
                      <Show when={doc.nfc_enabled}>
                        <span class={styles.nfcBadge}>NFC Activo</span>
                      </Show>
                    </div>
                    
                    <div class={styles.docArrow}><img src="./img/icons_ios/ui-chevron-right.svg" alt="" /></div>
=======
    <div class="ios-page">
      <div class="ios-nav">
        <button class="ios-icon-btn" onClick={() => router.goBack()}>‹</button>
        <div class="ios-nav-title">Docs Vault</div>
        <button class="ios-icon-btn" onClick={() => void createDoc()}>＋</button>
      </div>

      <div class="ios-content">
        <div class={styles.toolbar}>
          <input
            class={styles.searchInput}
            type="text"
            placeholder="Buscar documento"
            value={query()}
            onInput={(event) => setQuery(event.currentTarget.value)}
          />
          <div class={styles.typeRow}>
            <For each={docTypes()}>
              {(entry) => (
                <button
                  class={styles.typeChip}
                  classList={{ [styles.typeChipActive]: typeFilter() === entry }}
                  onClick={() => setTypeFilter(entry)}
                >
                  {entry}
                </button>
              )}
            </For>
          </div>
        </div>
        <Show when={!loading()} fallback={<div class="ios-card">Cargando...</div>}>
          <div class={styles.grid}>
            <For each={visibleDocs()}>
              {(doc) => (
                <article class={styles.docCard}>
                  <div class={styles.topRow}>
                    <strong>{doc.title}</strong>
                    <span>{doc.doc_type.toUpperCase()}</span>
>>>>>>> 6087054b2c17bad903d1ba2a08f953f8451a6489
                  </div>
                );
              }}
            </For>
            
            <Show when={!loading() && documents().length === 0}>
              <div class={styles.emptyState}>
                <p>No tienes documentos</p>
                <p class={styles.emptyHint}>Crea tu primer documento digital</p>
              </div>
            </Show>
          </div>

          {/* FAB */}
          <button class={styles.fab} onClick={() => setShowComposer(true)}>
            <span>+</span>
          </button>
        </Show>

        {/* NFC Tab */}
        <Show when={activeTab() === 'nfc'}>
          <div class={styles.scanSection}>
            <div class={styles.scanOptions}>
              <button class={styles.scanBtn} onClick={() => setActiveTab('my')}>
                <span class={styles.scanIcon}>NFC</span>
                <strong>Activar en mis documentos</strong>
                <span>Abre un documento y activa NFC Habilitado</span>
              </button>
              
              <button class={styles.scanBtn}>
                <span class={styles.scanIcon}>OX</span>
                <strong>Usar ox_target</strong>
                <span>Mira a una persona y usa "Mostrar documento NFC"</span>
              </button>
            </div>
            
            <div class={styles.scanInfo}>
              <h4>Como funciona NFC</h4>
              <p>1. Activa NFC en el documento desde Mis Docs.</p>
              <p>2. Acercate a la persona y usa ox_target.</p>
              <p>3. Elige "Mostrar documento NFC" y selecciona documento.</p>
              <p>4. La otra persona lo recibe en su telefono automaticamente.</p>
            </div>
          </div>
        </Show>

        {/* History Tab */}
        <Show when={activeTab() === 'history'}>
          <div class={styles.historyList}>
            <Show when={scanHistory().length === 0}>
              <div class={styles.emptyState}>
                <p>Sin historial</p>
                <p class={styles.emptyHint}>Los escaneos apareceran aqui</p>
              </div>
            </Show>
            
            <For each={scanHistory()}>
              {(scan) => {
                const typeInfo = getDocTypeInfo(scan.doc_type);
                
                return (
                  <div class={styles.historyItem}>
                    <span class={styles.historyIcon}>{typeInfo.icon}</span>
                    <div class={styles.historyInfo}>
                      <strong>{scan.title}</strong>
                      <span>{typeInfo.name} • {timeAgo(scan.scanned_at)}</span>
                    </div>
                    <span class={styles.historyType}>{scan.scan_type === 'nfc' ? 'NFC' : 'MANUAL'}</span>
                  </div>
                );
              }}
            </For>
          </div>
        </Show>

        {/* Document Detail Modal */}
        <Show when={selectedDoc()}>
          <div class={styles.detailModal}>
            <button class={styles.closeBtn} onClick={() => setSelectedDoc(null)}>
              <img src="./img/icons_ios/ui-close.svg" alt="" />
            </button>
            
            {(() => {
              const doc = selectedDoc();
              const typeInfo = getDocTypeInfo(doc.doc_type);
              const expired = isExpired(doc.expires_at);
              
              return (
                <div class={styles.detailContent}>
                  <div class={styles.detailHeader} style={{ background: typeInfo.color }}>
                    <span class={styles.detailIconLarge}>{typeInfo.icon}</span>
                    <h2>{doc.title}</h2>
                    <span class={styles.detailType}>{typeInfo.name}</span>
                  </div>
                  
                  <div class={styles.detailBody}>
                    <div class={styles.detailField}>
                      <label>Titular</label>
                      <strong>{doc.holder_name}</strong>
                    </div>
                    
                    <Show when={doc.holder_number}>
                      <div class={styles.detailField}>
                        <label>Numero</label>
                        <strong>{doc.holder_number}</strong>
                      </div>
                    </Show>
                    
                    <Show when={doc.expires_at}>
                      <div class={styles.detailField}>
                        <label>Vencimiento</label>
                        <strong classList={{ [styles.expiredText]: expired }}>
                          {doc.expires_at} {expired ? '(EXPIRADO)' : ''}
                        </strong>
                      </div>
                    </Show>
                    
                    <div class={styles.detailField}>
                      <label>Codigo de Verificacion</label>
                      <div class={styles.codeBox}>
                        <strong>{doc.verification_code}</strong>
                      </div>
                    </div>
                    
                    <div class={styles.nfcToggle}>
                      <label>
                        <input
                          type="checkbox"
                          checked={doc.nfc_enabled}
                          onChange={() => toggleNFC(doc)}
                        />
                        <span>NFC Habilitado</span>
                      </label>
                      <p>Permite mostrar este documento a personas cercanas via ox_target</p>
                    </div>
                  </div>
                  
                  <div class={styles.detailActions}>
                    <button class={styles.deleteBtn} onClick={() => deleteDocument(doc.id)}>
                      Eliminar Documento
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </Show>

        {/* Composer Modal */}
        <Modal
          open={showComposer()}
          title="Nuevo Documento"
          onClose={() => setShowComposer(false)}
          size="md"
        >
          <div class={styles.composerContent}>
            <div class={styles.formField}>
              <label>Tipo de Documento</label>
              <div class={styles.typeGrid}>
                <For each={docTypes()}>
                  {(type) => (
                    <button
                      class={styles.typeBtn}
                      classList={{ [styles.active]: composerType() === type.id }}
                      onClick={() => setComposerType(type.id)}
                      style={{ 'border-color': composerType() === type.id ? type.color : undefined }}
                    >
                      <span style={{ color: type.color }}>{type.icon}</span>
                      <span>{type.name}</span>
                    </button>
                  )}
                </For>
              </div>
            </div>
            
            <div class={styles.formField}>
              <label>Titulo *</label>
              <input
                type="text"
                placeholder="Ej: Licencia de Conducir"
                value={composerTitle()}
                onInput={(e) => setComposerTitle(e.currentTarget.value)}
              />
            </div>
            
            <div class={styles.formField}>
              <label>Nombre del Titular</label>
              <input
                type="text"
                placeholder="Nombre completo"
                value={composerHolderName()}
                onInput={(e) => setComposerHolderName(e.currentTarget.value)}
              />
            </div>
            
            <div class={styles.formField}>
              <label>Numero de Documento</label>
              <input
                type="text"
                placeholder="Opcional"
                value={composerHolderNumber()}
                onInput={(e) => setComposerHolderNumber(e.currentTarget.value)}
              />
            </div>
            
            <div class={styles.formField}>
              <label>Fecha de Vencimiento</label>
              <input
                type="date"
                value={composerExpires()}
                onInput={(e) => setComposerExpires(e.currentTarget.value)}
              />
            </div>
            
            <div class={styles.formField}>
              <label class={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={composerNFC()}
                  onChange={(e) => setComposerNFC(e.currentTarget.checked)}
                />
                <span>Habilitar NFC (otros pueden escanear este documento)</span>
              </label>
            </div>
          </div>
          
          <ModalActions>
            <ModalButton label="Cancelar" onClick={() => setShowComposer(false)} />
            <ModalButton
              label={loading() ? 'Creando...' : 'Crear'}
              onClick={() => void createDocument()}
              tone="primary"
              disabled={!composerTitle().trim() || loading()}
            />
          </ModalActions>
        </Modal>

        {/* Document Picker Modal - for ox_target sharing */}
        <Modal
          open={showDocPicker()}
          title="Seleccionar Documento"
          onClose={() => { setShowDocPicker(false); setDocPickerTarget(null); }}
          size="md"
        >
          <div class={styles.docPickerContent}>
            <p>Selecciona un documento para mostrar:</p>
            <div class={styles.docPickerList}>
              <For each={documents().filter(d => d.nfc_enabled)}>
                {(doc) => {
                  const typeInfo = getDocTypeInfo(doc.doc_type);
                  return (
                    <button 
                      class={styles.docPickerItem}
                      onClick={() => shareDocument(doc.id)}
                    >
                      <div class={styles.docPickerIcon} style={{ background: typeInfo.color }}>
                        <span>{typeInfo.icon}</span>
                      </div>
                      <div class={styles.docPickerInfo}>
                        <strong>{doc.title}</strong>
                        <span>{typeInfo.name}</span>
                      </div>
                    </button>
                  );
                }}
              </For>
            </div>
            <Show when={documents().filter(d => d.nfc_enabled).length === 0}>
              <p class={styles.docPickerEmpty}>No tienes documentos con NFC activado</p>
            </Show>
          </div>
          
          <ModalActions>
            <ModalButton label="Cancelar" onClick={() => { setShowDocPicker(false); setDocPickerTarget(null); }} />
          </ModalActions>
        </Modal>

        {/* Received Document Modal */}
        <Show when={receivedDoc()}>
          <div class={styles.scanResultModal}>
            <button class={styles.closeBtn} onClick={() => setReceivedDoc(null)}>
              <img src="./img/icons_ios/ui-close.svg" alt="" />
            </button>
            
            {(() => {
              const doc = receivedDoc();
              const typeInfo = getDocTypeInfo(doc.doc_type);
              const expired = isExpired(doc.expires_at);
              
              return (
                <div class={styles.scanResultContent}>
                  <div class={styles.scanResultHeader} classList={{ [styles.valid]: !expired, [styles.invalid]: expired }}>
                    <span class={styles.scanStatus}>{expired ? 'EXPIRADO' : 'DOCUMENTO VALIDO'}</span>
                  </div>
                  
                  <div class={styles.scanResultBody}>
                    <div class={styles.scanDocIcon} style={{ background: typeInfo.color }}>
                      <span>{typeInfo.icon}</span>
                    </div>
                    
                    <h2>{doc.title}</h2>
                    <span class={styles.scanDocType}>{typeInfo.name}</span>
                    
                    <div class={styles.scanFields}>
                      <div class={styles.scanField}>
                        <label>Titular</label>
                        <strong>{doc.holder_name}</strong>
                      </div>
                      
                      <Show when={doc.holder_number}>
                        <div class={styles.scanField}>
                          <label>Numero</label>
                          <strong>{doc.holder_number}</strong>
                        </div>
                      </Show>
                      
                      <Show when={doc.expires_at}>
                        <div class={styles.scanField}>
                          <label>Vencimiento</label>
                          <strong classList={{ [styles.expiredText]: expired }}>{doc.expires_at}</strong>
                        </div>
                      </Show>
                      
                      <div class={styles.scanField}>
                        <label>Codigo</label>
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
      </div>
    </AppScaffold>
  );
}
