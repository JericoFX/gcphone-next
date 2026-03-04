import { createEffect, createMemo, createSignal, For, onCleanup, Show } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchNui } from '../../../utils/fetchNui';
import { sanitizeMediaUrl, sanitizeText } from '../../../utils/sanitize';
import { ActionSheet } from '../../shared/ui/ActionSheet';
import { MediaLightbox } from '../../shared/ui/MediaLightbox';
import styles from './MarketApp.module.scss';

interface MarketListing {
  id: number;
  title: string;
  description?: string;
  price: number;
  category: string;
  phone_number?: string;
}

export function MarketApp() {
  const router = useRouter();
  const [listings, setListings] = createSignal<MarketListing[]>([]);
  const [myListings, setMyListings] = createSignal<MarketListing[]>([]);
  const [tab, setTab] = createSignal<'all' | 'mine'>('all');
  const [showCreate, setShowCreate] = createSignal(false);
  const [title, setTitle] = createSignal('');
  const [description, setDescription] = createSignal('');
  const [price, setPrice] = createSignal('');
  const [category, setCategory] = createSignal('general');
  const [photoUrl, setPhotoUrl] = createSignal('');
  const [showAttachSheet, setShowAttachSheet] = createSignal(false);
  const [viewerUrl, setViewerUrl] = createSignal<string | null>(null);
  const [query, setQuery] = createSignal('');
  const [selectedCategory, setSelectedCategory] = createSignal('all');

  const load = async () => {
    const data = await fetchNui<MarketListing[]>('marketGetListings', { category: 'all', limit: 50, offset: 0 }, []);
    setListings(data || []);
    const mine = await fetchNui<MarketListing[]>('marketGetMyListings', {}, []);
    setMyListings(mine || []);
  };

  createEffect(() => {
    void load();
  });

  createEffect(() => {
    const onKey = (e: CustomEvent<string>) => {
      if (e.detail === 'Backspace' && !showCreate()) router.goBack();
    };
    window.addEventListener('phone:keyUp', onKey as EventListener);
    onCleanup(() => window.removeEventListener('phone:keyUp', onKey as EventListener));
  });

  const createListing = async () => {
    const nextTitle = sanitizeText(title(), 100);
    const nextDescription = sanitizeText(description(), 1000);
    const nextCategory = sanitizeText(category(), 30) || 'general';
    const nextPhoto = sanitizeMediaUrl(photoUrl());
    if (!nextTitle) return;
    const result = await fetchNui<{ success?: boolean }>('marketCreateListing', {
      title: nextTitle,
      description: nextDescription,
      price: Number(price() || 0),
      category: nextCategory,
      photos: nextPhoto ? [nextPhoto] : []
    });

    if (result?.success) {
      setShowCreate(false);
      setTitle('');
      setDescription('');
      setPrice('');
      setPhotoUrl('');
      setCategory('general');
      await load();
    }
  };

  const attachFromGallery = async () => {
    const gallery = await fetchNui<any[]>('getGallery', undefined, []);
    if (gallery && gallery.length > 0) {
      const nextUrl = sanitizeMediaUrl(gallery[0].url);
      if (nextUrl) setPhotoUrl(nextUrl);
    }
  };

  const attachFromCamera = async () => {
    const shot = await fetchNui<{ url?: string }>('takePhoto', {} as any, { url: '' } as any);
    if (shot?.url) {
      const nextUrl = sanitizeMediaUrl(shot.url);
      if (nextUrl) {
        setPhotoUrl(nextUrl);
        return;
      }
    }
    const gallery = await fetchNui<any[]>('getGallery', undefined, []);
    if (gallery && gallery.length > 0) {
      const nextUrl = sanitizeMediaUrl(gallery[0].url);
      if (nextUrl) setPhotoUrl(nextUrl);
    }
  };

  const attachByUrl = () => {
    const input = window.prompt('Pega URL de imagen');
    const nextUrl = sanitizeMediaUrl(input);
    if (nextUrl) {
      setPhotoUrl(nextUrl);
      return;
    }
    if (input && input.trim()) window.alert('URL invalida o formato no permitido');
  };

  const markSold = async (listingId: number) => {
    const result = await fetchNui<{ success?: boolean }>('marketMarkAsSold', { listingId });
    if (result?.success) await load();
  };

  const deleteListing = async (listingId: number) => {
    const result = await fetchNui<{ success?: boolean }>('marketDeleteListing', { listingId });
    if (result?.success) await load();
  };

  const contactSeller = async (listingId: number) => {
    const result = await fetchNui<{ phoneNumber?: string }>('marketContactSeller', { listingId });
    if (result?.phoneNumber) {
      router.navigate('messages.view', { number: result.phoneNumber, display: 'Vendedor' });
    }
  };

  const allCategories = createMemo(() => {
    const categories = new Set<string>(['all']);
    for (const listing of listings()) {
      const next = sanitizeText(listing.category || '', 30);
      if (next) categories.add(next);
    }
    return Array.from(categories);
  });

  const visibleListings = createMemo(() => {
    const source = tab() === 'all' ? listings() : myListings();
    const q = sanitizeText(query(), 60).toLowerCase();
    const categoryFilter = selectedCategory();

    return source.filter((item) => {
      const category = sanitizeText(item.category || '', 30) || 'general';
      if (categoryFilter !== 'all' && category !== categoryFilter) return false;
      if (!q) return true;
      return (
        sanitizeText(item.title || '', 100).toLowerCase().includes(q) ||
        sanitizeText(item.description || '', 1000).toLowerCase().includes(q)
      );
    });
  });

  return (
    <div class={styles.app}>
      <div class={styles.header}>
        <button class={styles.backBtn} onClick={() => router.goBack()}>‹</button>
        <h1>Market Pro</h1>
        <button class={styles.addBtn} onClick={() => setShowCreate(true)}>+</button>
      </div>

      <div class={styles.searchRow}>
        <input
          class={styles.searchInput}
          type="text"
          placeholder="Buscar productos, servicios"
          value={query()}
          onInput={(event) => setQuery(event.currentTarget.value)}
        />
      </div>

      <div class={styles.tabs}>
        <button class={styles.tabBtn} classList={{ [styles.active]: tab() === 'all' }} onClick={() => setTab('all')}>Publico</button>
        <button class={styles.tabBtn} classList={{ [styles.active]: tab() === 'mine' }} onClick={() => setTab('mine')}>Mis avisos</button>
      </div>

      <div class={styles.categoryRow}>
        <For each={allCategories()}>
          {(entry) => (
            <button
              class={styles.categoryChip}
              classList={{ [styles.categoryChipActive]: selectedCategory() === entry }}
              onClick={() => setSelectedCategory(entry)}
            >
              {entry}
            </button>
          )}
        </For>
      </div>

      <div class={styles.list}>
        <For each={visibleListings()}>
          {(item) => (
            <article class={styles.card}>
              <strong>{item.title}</strong>
              <span class={styles.price}>${Number(item.price || 0).toLocaleString('en-US')}</span>
              <p>{item.description || 'Sin descripcion'}</p>
              <small class={styles.cardCategory}>{item.category || 'general'}</small>
              <div class={styles.cardActions}>
                <button onClick={() => contactSeller(item.id)}>Contactar</button>
                <Show when={tab() === 'mine'}>
                  <button onClick={() => markSold(item.id)}>Vendido</button>
                  <button onClick={() => deleteListing(item.id)}>Eliminar</button>
                </Show>
              </div>
            </article>
          )}
        </For>
      </div>

      <Show when={showCreate()}>
        <div class={styles.modal}>
          <div class={styles.modalContent}>
            <h2>Nueva publicacion</h2>
            <input type="text" placeholder="Titulo" value={title()} onInput={(e) => setTitle(e.currentTarget.value)} />
            <input type="text" placeholder="Descripcion" value={description()} onInput={(e) => setDescription(e.currentTarget.value)} />
            <input type="number" placeholder="Precio" value={price()} onInput={(e) => setPrice(e.currentTarget.value)} />
            <div class={styles.attachRow}>
              <button onClick={() => setShowAttachSheet(true)}>Adjuntar</button>
              <input type="text" placeholder="URL foto" value={photoUrl()} onInput={(e) => setPhotoUrl(sanitizeMediaUrl(e.currentTarget.value))} />
            </div>
            <Show when={photoUrl()}>
              <img class={styles.photoPreview} src={photoUrl()} alt="foto" onClick={() => setViewerUrl(photoUrl())} />
            </Show>
            <input type="text" placeholder="Categoria" value={category()} onInput={(e) => setCategory(sanitizeText(e.currentTarget.value, 30))} />
            <div class={styles.actions}>
              <button onClick={() => setShowCreate(false)}>Cancelar</button>
              <button class={styles.primary} onClick={createListing}>Publicar</button>
            </div>
          </div>
        </div>
      </Show>

      <ActionSheet
        open={showAttachSheet()}
        title="Adjuntar en market"
        onClose={() => setShowAttachSheet(false)}
        actions={[
          { label: 'Elegir desde galeria', tone: 'primary', onClick: attachFromGallery },
          { label: 'Tomar foto con camara', onClick: attachFromCamera },
          { label: 'Pegar URL de imagen', onClick: attachByUrl },
          { label: 'Quitar adjunto', tone: 'danger', onClick: () => { setPhotoUrl(''); } },
        ]}
      />
      <MediaLightbox url={viewerUrl()} onClose={() => setViewerUrl(null)} />
    </div>
  );
}
