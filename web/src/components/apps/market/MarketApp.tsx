import { createMemo, createSignal, For, Show, onMount } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchNui } from '../../../utils/fetchNui';
import { sanitizeMediaUrl, sanitizeText } from '../../../utils/sanitize';
import { usePhoneKeyHandler } from '../../../hooks/usePhoneKeyHandler';
import { useMediaAttachment } from '../../../hooks/useMediaAttachment';
import { useContextMenu } from '../../../hooks/useContextMenu';
import { ActionSheet } from '../../shared/ui/ActionSheet';
import { MediaLightbox } from '../../shared/ui/MediaLightbox';
import { t } from '../../../i18n';
import { usePhone } from '../../../store/phone';
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
  const [phoneState] = usePhone();
  const language = () => phoneState.settings.language || 'es';
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
  const ctxMenu = useContextMenu<any>();
  const [viewerUrl, setViewerUrl] = createSignal<string | null>(null);
  const [query, setQuery] = createSignal('');
  const [selectedCategory, setSelectedCategory] = createSignal('all');

  const load = async () => {
    const data = await fetchNui<MarketListing[]>('marketGetListings', { category: 'all', limit: 50, offset: 0 }, []);
    setListings(data || []);
    const mine = await fetchNui<MarketListing[]>('marketGetMyListings', {}, []);
    setMyListings(mine || []);
  };

  onMount(() => {
    void load();
  });

  usePhoneKeyHandler({
    Backspace: () => {
      if (!showCreate()) {
        router.goBack();
      }
    },
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

  const media = useMediaAttachment({ onAttached: (url) => setPhotoUrl(url) });

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
      router.navigate('messages.view', { phoneNumber: result.phoneNumber, display: t('market.seller', language()) });
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
        <button class={styles.backBtn} onClick={() => router.goBack()}><img src="./img/icons_ios/ui-chevron-left.svg" alt="" draggable={false} /></button>
        <h1>{t('market.title', language())}</h1>
        <button class={styles.addBtn} onClick={() => setShowCreate(true)}>+</button>
      </div>

      <div class={styles.searchRow}>
        <input
          class={styles.searchInput}
          type="text"
          placeholder={t('market.search_placeholder', language())}
          value={query()}
          onInput={(event) => setQuery(event.currentTarget.value)}
        />
      </div>

      <div class={styles.tabs}>
        <button class={styles.tabBtn} classList={{ [styles.active]: tab() === 'all' }} onClick={() => setTab('all')}>{t('market.tab.public', language())}</button>
        <button class={styles.tabBtn} classList={{ [styles.active]: tab() === 'mine' }} onClick={() => setTab('mine')}>{t('market.tab.mine', language())}</button>
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
            <article class={styles.card} onContextMenu={ctxMenu.onContextMenu(item)}>
              <strong>{item.title}</strong>
              <span class={styles.price}>${Number(item.price || 0).toLocaleString('en-US')}</span>
              <p>{item.description || t('market.no_description', language())}</p>
              <small class={styles.cardCategory}>{item.category || 'general'}</small>
              <div class={styles.cardActions}>
                <button onClick={() => contactSeller(item.id)}>{t('market.contact', language())}</button>
                <Show when={tab() === 'mine'}>
                  <button onClick={() => markSold(item.id)}>{t('market.sold', language())}</button>
                  <button onClick={() => deleteListing(item.id)}>{t('common.delete', language())}</button>
                </Show>
              </div>
            </article>
          )}
        </For>
      </div>

      <Show when={showCreate()}>
        <div class={styles.modal}>
          <div class={styles.modalContent}>
            <h2>{t('market.new_listing', language())}</h2>
            <input type="text" placeholder={t('market.form.title', language())} value={title()} onInput={(e) => setTitle(e.currentTarget.value)} />
            <input type="text" placeholder={t('market.form.description', language())} value={description()} onInput={(e) => setDescription(e.currentTarget.value)} />
            <input type="number" placeholder={t('market.form.price', language())} value={price()} onInput={(e) => setPrice(e.currentTarget.value)} />
            <div class={styles.attachRow}>
              <button onClick={() => setShowAttachSheet(true)}>{t('market.form.attach', language())}</button>
              <input type="text" placeholder={t('market.form.photo_url', language())} value={photoUrl()} onInput={(e) => setPhotoUrl(sanitizeMediaUrl(e.currentTarget.value))} />
            </div>
            <Show when={photoUrl()}>
              <img class={styles.photoPreview} src={photoUrl()} alt="foto" onClick={() => setViewerUrl(photoUrl())} />
            </Show>
            <input type="text" placeholder={t('market.form.category', language())} value={category()} onInput={(e) => setCategory(sanitizeText(e.currentTarget.value, 30))} />
            <div class={styles.actions}>
              <button onClick={() => setShowCreate(false)}>{t('common.cancel', language())}</button>
              <button class={styles.primary} onClick={createListing}>{t('market.publish', language())}</button>
            </div>
          </div>
        </div>
      </Show>

      <ActionSheet
        open={showAttachSheet()}
        title={t('market.attach_title', language())}
        onClose={() => setShowAttachSheet(false)}
        actions={[
          { label: t('market.attach_gallery', language()), tone: 'primary', onClick: () => void media.attachFromGallery() },
          { label: t('market.attach_camera', language()), onClick: () => void media.attachFromCamera() },
          { label: t('market.attach_url', language()), onClick: () => void media.attachByUrl() },
          { label: t('market.attach_remove', language()), tone: 'danger', onClick: () => { setPhotoUrl(''); } },
        ]}
      />
      <ActionSheet
        open={ctxMenu.isOpen()}
        title={ctxMenu.item()?.title || 'Listing'}
        onClose={ctxMenu.close}
        actions={[
          { label: t('market.contact', language()), tone: 'primary' as const, onClick: () => { const id = ctxMenu.item()?.id; ctxMenu.close(); if (id) contactSeller(id); } },
          ...(tab() === 'mine' ? [
            { label: t('market.sold', language()), onClick: () => { const id = ctxMenu.item()?.id; ctxMenu.close(); if (id) markSold(id); } },
            { label: t('common.delete', language()), tone: 'danger' as const, onClick: () => { const id = ctxMenu.item()?.id; ctxMenu.close(); if (id) deleteListing(id); } },
          ] : []),
        ]}
      />
      <MediaLightbox url={viewerUrl()} onClose={() => setViewerUrl(null)} />
    </div>
  );
}
