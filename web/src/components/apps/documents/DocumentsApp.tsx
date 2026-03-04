import { For, Show, createEffect, createMemo, createSignal, onCleanup } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchNui } from '../../../utils/fetchNui';
import styles from './DocumentsApp.module.scss';

interface DocItem {
  id: number;
  doc_type: string;
  title: string;
  holder_name: string;
  holder_number?: string;
  expires_at?: string;
  verification_code: string;
  created_at: string;
}

export function DocumentsApp() {
  const router = useRouter();
  const [docs, setDocs] = createSignal<DocItem[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [query, setQuery] = createSignal('');
  const [typeFilter, setTypeFilter] = createSignal('all');

  const load = async () => {
    setLoading(true);
    const list = await fetchNui<DocItem[]>('documentsGetList', {}, []);
    setDocs(list || []);
    setLoading(false);
  };

  const createDoc = async () => {
    const docType = (window.prompt('Tipo: id / license / permit') || 'id').trim();
    const title = window.prompt('Titulo del documento') || 'Documento';
    const holderName = window.prompt('Nombre titular') || 'Ciudadano';
    const holderNumber = window.prompt('Numero (opcional)') || '';
    const expiresAt = window.prompt('Expira (YYYY-MM-DD opcional)') || '';

    const payload = await fetchNui<{ success?: boolean; error?: string }>('documentsCreate', {
      docType,
      title,
      holderName,
      holderNumber,
      expiresAt,
    }, { success: false });

    if (!payload.success) {
      window.alert(payload.error || 'No se pudo crear el documento');
      return;
    }

    void load();
  };

  const removeDoc = async (id: number) => {
    const payload = await fetchNui<{ success?: boolean }>('documentsDelete', { documentId: id }, { success: false });
    if (payload.success) void load();
  };

  createEffect(() => {
    const onKey = (e: CustomEvent<string>) => {
      if (e.detail === 'Backspace') router.goBack();
    };
    window.addEventListener('phone:keyUp', onKey as EventListener);
    onCleanup(() => window.removeEventListener('phone:keyUp', onKey as EventListener));
  });

  createEffect(() => {
    void load();
  });

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
                  </div>
                  <p>{doc.holder_name}</p>
                  <Show when={doc.holder_number}><p>#{doc.holder_number}</p></Show>
                  <Show when={doc.expires_at}><p>Vence: {doc.expires_at}</p></Show>
                  <div class={styles.code}>QR: {doc.verification_code}</div>
                  <button onClick={() => void removeDoc(doc.id)}>Eliminar</button>
                </article>
              )}
            </For>
          </div>
        </Show>
      </div>
    </div>
  );
}
