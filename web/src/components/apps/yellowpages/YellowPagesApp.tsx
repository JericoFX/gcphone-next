import { For, Show, createEffect, createMemo, createSignal, onCleanup } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchNui } from '../../../utils/fetchNui';
import { sanitizeMediaUrl, sanitizeText } from '../../../utils/sanitize';
import { MediaLightbox } from '../../shared/ui/MediaLightbox';
import styles from './YellowPagesApp.module.scss';

interface Listing {
  id: number;
  title: string;
  description?: string;
  price: number;
  category: string;
  photos?: string[] | string;
}

export function YellowPagesApp() {
  const router = useRouter();
  const [listings, setListings] = createSignal<Listing[]>([]);
  const [showComposer, setShowComposer] = createSignal(false);
  const [title, setTitle] = createSignal('');
  const [description, setDescription] = createSignal('');
  const [price, setPrice] = createSignal('0');
  const [category, setCategory] = createSignal('items');
  const [photoUrl, setPhotoUrl] = createSignal('');
  const [viewerUrl, setViewerUrl] = createSignal<string | null>(null);
  const [query, setQuery] = createSignal('');
  const [selectedCategory, setSelectedCategory] = createSignal('all');

  const categories = createMemo(() => {
    const base = new Set<string>(['all']);
    for (const listing of listings()) {
      const category = sanitizeText(listing.category || '', 30);
      if (category) base.add(category);
    }
    return Array.from(base);
  });

  const visibleListings = createMemo(() => {
    const categoryFilter = selectedCategory();
    const q = sanitizeText(query(), 60).toLowerCase();
    return listings().filter((listing) => {
      if (categoryFilter !== 'all' && sanitizeText(listing.category || '', 30) !== categoryFilter) return false;
      if (!q) return true;
      return (
        sanitizeText(listing.title || '', 100).toLowerCase().includes(q) ||
        sanitizeText(listing.description || '', 1000).toLowerCase().includes(q)
      );
    });
  });

  const load = async () => {
    const next = await fetchNui<Listing[]>('marketGetListings', { category: 'all', limit: 50, offset: 0 }, []);
    setListings(next || []);
  };

  createEffect(() => {
    void load();
  });

  createEffect(() => {
    const onKey = (event: CustomEvent<string>) => {
      if (event.detail === 'Backspace') {
        if (showComposer()) setShowComposer(false);
        else router.goBack();
      }
    };
    window.addEventListener('phone:keyUp', onKey as EventListener);
    onCleanup(() => window.removeEventListener('phone:keyUp', onKey as EventListener));
  });

  const publish = async () => {
    const payload = {
      title: sanitizeText(title(), 100),
      description: sanitizeText(description(), 1000),
      price: Number(price() || 0),
      category: sanitizeText(category(), 30) || 'items',
      photos: sanitizeMediaUrl(photoUrl()) ? [sanitizeMediaUrl(photoUrl())] : [],
    };
    if (!payload.title) return;

    const result = await fetchNui<{ success?: boolean }>('marketCreateListing', payload);
    if (!result?.success) return;

    setShowComposer(false);
    setTitle('');
    setDescription('');
    setPrice('0');
    setPhotoUrl('');
    await load();
  };

  const attachFromCamera = async () => {
    const shot = await fetchNui<{ url?: string }>('takePhoto', {} as any, { url: '' } as any);
    if (shot?.url) {
      const next = sanitizeMediaUrl(shot.url);
      if (next) setPhotoUrl(next);
    }
  };

  const attachFromGallery = async () => {
    const gallery = await fetchNui<any[]>('getGallery', undefined, []);
    if (gallery && gallery.length > 0) {
      const next = sanitizeMediaUrl(gallery[0].url);
      if (next) setPhotoUrl(next);
    }
  };

  return (
    <div class={styles.app}>
      <div class={styles.header}>
        <button class={styles.backBtn} onClick={() => router.goBack()}>‹</button>
        <h1>Amarillas Pro</h1>
        <button class={styles.addBtn} onClick={() => setShowComposer(true)}>+</button>
      </div>

      <div class={styles.searchRow}>
        <input
          class={styles.searchInput}
          type="text"
          placeholder="Buscar negocio o servicio"
          value={query()}
          onInput={(event) => setQuery(event.currentTarget.value)}
        />
      </div>

      <div class={styles.categoryRow}>
        <For each={categories()}>
          {(entry) => (
            <button
              class={styles.categoryChip}
              classList={{ [styles.categoryActive]: selectedCategory() === entry }}
              onClick={() => setSelectedCategory(entry)}
            >
              {entry}
            </button>
          )}
        </For>
      </div>

      <div class={styles.list}>
        <For each={visibleListings()}>
          {(listing) => (
            <article class={styles.card}>
              <strong>{listing.title}</strong>
              <Show when={Array.isArray(listing.photos) ? listing.photos[0] : undefined}>
                <img class={styles.photo} src={(Array.isArray(listing.photos) ? listing.photos[0] : '') as string} alt="foto" onClick={() => setViewerUrl((Array.isArray(listing.photos) ? listing.photos[0] : '') as string)} />
              </Show>
              <p>{listing.description || 'Sin descripcion'}</p>
              <div class={styles.meta}>
                <span>{listing.category}</span>
                <span>${listing.price}</span>
              </div>
            </article>
          )}
        </For>
      </div>

      <MediaLightbox url={viewerUrl()} onClose={() => setViewerUrl(null)} />

      <Show when={showComposer()}>
        <div class={styles.modal}>
          <div class={styles.modalContent}>
            <h2>Nueva publicacion</h2>
            <input type="text" placeholder="Titulo" value={title()} onInput={(e) => setTitle(e.currentTarget.value)} />
            <textarea placeholder="Descripcion" value={description()} onInput={(e) => setDescription(e.currentTarget.value)} />
            <input type="number" placeholder="Precio" value={price()} onInput={(e) => setPrice(e.currentTarget.value)} />
            <input type="text" placeholder="Categoria" value={category()} onInput={(e) => setCategory(e.currentTarget.value)} />
            <div class={styles.photoRow}>
              <input type="text" placeholder="URL foto" value={photoUrl()} onInput={(e) => setPhotoUrl(e.currentTarget.value)} />
              <button onClick={() => void attachFromCamera()}>Camara</button>
              <button onClick={() => void attachFromGallery()}>Galeria</button>
            </div>
            <div class={styles.actions}>
              <button onClick={() => setShowComposer(false)}>Cancelar</button>
              <button class={styles.primary} onClick={publish}>Publicar</button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
