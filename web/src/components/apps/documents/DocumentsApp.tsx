import { For, Show, createEffect, createSignal, onCleanup } from 'solid-js';
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
  const cache = useAppCache('documents');

  // Data
  const [documents, setDocuments] = createSignal<Document[]>([]);
  const [docTypes, setDocTypes] = createSignal<DocType[]>([]);
  const [scanHistory, setScanHistory] = createSignal<ScanHistory[]>([]);
  const [selectedDoc, setSelectedDoc] = createSignal<Document | null>(null);
  const [scannedDoc, setScannedDoc] = createSignal<ScannedDoc | null>(null);

  // Tabs
  const [activeTab, setActiveTab] = createSignal<'my' | 'scan' | 'history'>('my');

  // UI State
  const [loading, setLoading] = createSignal(false);
  const [showComposer, setShowComposer] = createSignal(false);
  const [showScanner, setShowScanner] = createSignal(false);
  const [scanCode, setScanCode] = createSignal('');
  const [nfcScanning, setNfcScanning] = createSignal(false);

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
  });

  createEffect(() => {
    const onKey = (e: CustomEvent<string>) => {
      if (e.detail === 'Backspace') {
        if (showScanner()) {
          setShowScanner(false);
          return;
        }
        if (showComposer()) {
          setShowComposer(false);
          return;
        }
        if (scannedDoc()) {
          setScannedDoc(null);
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

  const scanDocument = async () => {
    if (!scanCode().trim()) return;
    
    setLoading(true);
    const result = await fetchNui<{ success?: boolean; document?: ScannedDoc; error?: string }>('documentsVerify', {
      code: scanCode().trim()
    });
    setLoading(false);

    if (result?.success && result.document) {
      setScannedDoc(result.document);
      setShowScanner(false);
      setScanCode('');
      await loadData(); // Refresh history
    } else {
      alert(result?.error || 'Documento no encontrado');
    }
  };

  const simulateNFCScan = async () => {
    // In real implementation, this would use NFC hardware
    // For now, we simulate with a prompt
    const code = prompt('Simular escaneo NFC - Ingresa codigo de verificacion:');
    if (!code) return;
    
    setNfcScanning(true);
    setLoading(true);
    
    const result = await fetchNui<{ success?: boolean; document?: ScannedDoc; error?: string }>('documentsScanNFC', {
      code: code.trim()
    });
    
    setLoading(false);
    setNfcScanning(false);
    
    if (result?.success && result.document) {
      setScannedDoc(result.document);
      await loadData();
    } else {
      alert(result?.error || 'Documento no encontrado o NFC desactivado');
    }
  };

  return (
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
            classList={{ [styles.active]: activeTab() === 'scan' }}
            onClick={() => setActiveTab('scan')}
          >
            Escanear
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
                    
                    <div class={styles.docArrow}>›</div>
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

        {/* Scan Tab */}
        <Show when={activeTab() === 'scan'}>
          <div class={styles.scanSection}>
            <div class={styles.scanOptions}>
              <button class={styles.scanBtn} onClick={simulateNFCScan}>
                <span class={styles.scanIcon}>NFC</span>
                <strong>Escanear NFC</strong>
                <span>Acerca el telefono al documento</span>
              </button>
              
              <button class={styles.scanBtn} onClick={() => setShowScanner(true)}>
                <span class={styles.scanIcon}>123</span>
                <strong>Ingresar Codigo</strong>
                <span>Verificar manualmente</span>
              </button>
            </div>
            
            <div class={styles.scanInfo}>
              <h4>¿Como funciona?</h4>
              <p>1. El documento debe tener NFC activado</p>
              <p>2. Acerca tu telefono al documento fisico</p>
              <p>3. Se verificara automaticamente la autenticidad</p>
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
              ✕
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
                      <p>Otros pueden escanear este documento via NFC</p>
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

        {/* Scanned Document Result */}
        <Show when={scannedDoc()}>
          <div class={styles.scanResultModal}>
            <button class={styles.closeBtn} onClick={() => setScannedDoc(null)}>
              ✕
            </button>
            
            {(() => {
              const doc = scannedDoc();
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
                      
                      <div class={styles.scanField}>
                        <label>Escaneado</label>
                        <strong>{doc.scanned_at}</strong>
                      </div>
                    </div>
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

        {/* Scanner Modal */}
        <Modal
          open={showScanner()}
          title="Verificar Documento"
          onClose={() => setShowScanner(false)}
          size="sm"
        >
          <div class={styles.scannerContent}>
            <p>Ingresa el codigo de verificacion del documento:</p>
            <input
              type="text"
              placeholder="Ej: ABC12345"
              value={scanCode()}
              onInput={(e) => setScanCode(e.currentTarget.value.toUpperCase())}
              style={{ 'text-transform': 'uppercase' }}
            />
          </div>
          
          <ModalActions>
            <ModalButton label="Cancelar" onClick={() => setShowScanner(false)} />
            <ModalButton
              label="Verificar"
              onClick={() => void scanDocument()}
              tone="primary"
              disabled={!scanCode().trim() || loading()}
            />
          </ModalActions>
        </Modal>
      </div>
    </AppScaffold>
  );
}
