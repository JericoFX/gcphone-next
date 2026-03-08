import { For, Show, createEffect, createSignal } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchNui } from '../../../utils/fetchNui';
import { timeAgo } from '../../../utils/misc';
import { sanitizeMediaUrl, sanitizeText } from '../../../utils/sanitize';
import { uiConfirm } from '../../../utils/uiDialog';
import { uiAlert } from '../../../utils/uiAlert';
import { usePhoneKeyHandler } from '../../../hooks/usePhoneKeyHandler';
import { AppScaffold } from '../../shared/layout';
import { useAppCache } from '../../../hooks';
import { MediaLightbox } from '../../shared/ui/MediaLightbox';
import { FormRow, FormSection, Modal, ModalActions, ModalButton } from '../../shared/ui/Modal';
import styles from './YellowPagesApp.module.scss';

interface Listing {
  id: number;
  identifier?: string;
  phone_number?: string;
  seller_name?: string;
  seller_avatar?: string;
  title: string;
  description?: string;
  price: number;
  category: string;
  photos?: string[] | string;
  views?: number;
  location_shared?: number;
  location_x?: number;
  location_y?: number;
  location_z?: number;
  created_at?: string;
  is_own?: boolean;
}

interface Category {
  id: string;
  name: string;
  icon: string;
}

const CATEGORY_ICON_MAP: Record<string, string> = {
  all: './img/icons_ios/ui-list.svg',
  autos: './img/icons_ios/garage.svg',
  properties: './img/icons_ios/map.svg',
  electronics: './img/icons_ios/phone-solid.svg',
  services: './img/icons_ios/settings.svg',
  jobs: './img/icons_ios/documents.svg',
  items: './img/icons_ios/market.svg',
  other: './img/icons_ios/ui-list.svg',
};

interface SellerInfo {
  identifier: string;
  phone_number: string;
  seller_name: string;
  seller_avatar?: string;
  location_shared: number;
  location_x?: number;
  location_y?: number;
  location_z?: number;
}

export function YellowPagesApp() {
  const router = useRouter();
  const cache = useAppCache('yellowpages');

  // Data
  const [listings, setListings] = createSignal<Listing[]>([]);
  const [categories, setCategories] = createSignal<Category[]>([]);
  const [selectedListing, setSelectedListing] = createSignal<Listing | null>(null);
  const [sellerInfo, setSellerInfo] = createSignal<SellerInfo | null>(null);

  // Tabs and filters
  const [currentTab, setCurrentTab] = createSignal<'all' | 'my'>('all');
  const [selectedCategory, setSelectedCategory] = createSignal('all');
  const [searchQuery, setSearchQuery] = createSignal('');

  // UI State
  const [loading, setLoading] = createSignal(false);
  const [showComposer, setShowComposer] = createSignal(false);
  const [showContactModal, setShowContactModal] = createSignal(false);
  const [viewerUrl, setViewerUrl] = createSignal<string | null>(null);

  // Composer
  const [title, setTitle] = createSignal('');
  const [description, setDescription] = createSignal('');
  const [price, setPrice] = createSignal('');
  const [composerCategory, setComposerCategory] = createSignal('items');
  const [photos, setPhotos] = createSignal<string[]>([]);

  const loadCategories = async () => {
    const cats = await fetchNui<Category[]>('yellowpagesGetCategories', {}, []);
    setCategories(cats || []);
  };

  const loadListings = async () => {
    setLoading(true);
    
    const cacheKey = `yellowpages:${currentTab()}:${selectedCategory()}:${searchQuery()}`;
    const cached = cache.get<Listing[]>(cacheKey);
    
    let list: Listing[];
    if (cached) {
      list = cached;
    } else if (currentTab() === 'my') {
      list = await fetchNui<Listing[]>('yellowpagesGetMyListings', { limit: 50, offset: 0 }, []);
    } else {
      list = await fetchNui<Listing[]>('yellowpagesGetListings', {
        category: selectedCategory(),
        search: searchQuery(),
        limit: 50,
        offset: 0
      }, []);
    }
    
    if (!cached) cache.set(cacheKey, list || [], 30000);
    setListings(list || []);
    setLoading(false);
  };

  createEffect(() => {
    void loadCategories();
    void loadListings();
  });

  usePhoneKeyHandler({
    Backspace: () => {
      if (showContactModal()) {
        setShowContactModal(false);
        return;
      }
      if (selectedListing()) {
        setSelectedListing(null);
        setSellerInfo(null);
        return;
      }
      if (showComposer()) {
        setShowComposer(false);
        return;
      }
      router.goBack();
    },
  });

  const getCategoryIcon = (catId: string) => CATEGORY_ICON_MAP[catId] || './img/icons_ios/ui-list.svg';

  const getCategoryName = (catId: string) => {
    const cat = categories().find(c => c.id === catId);
    return cat?.name || 'Otros';
  };

  const openListing = async (listing: Listing) => {
    setSelectedListing(listing);
    const info = await fetchNui<SellerInfo>('yellowpagesGetSellerInfo', listing.id);
    setSellerInfo(info);
  };

  const contactSeller = async (type: 'call' | 'message') => {
    const listing = selectedListing();
    const seller = sellerInfo();
    if (!listing || !seller) return;

    // Record contact
    await fetchNui('yellowpagesRecordContact', {
      listingId: listing.id,
      sellerId: seller.identifier,
      contactType: type
    });

    if (type === 'call') {
      // Navigate to calls app with number
      router.navigate('calls', { number: seller.phone_number });
    } else {
      // Navigate to messages app
      router.navigate('messages', { number: seller.phone_number });
    }
    
    setShowContactModal(false);
  };

  const viewLocation = () => {
    const listing = selectedListing();
    if (!listing || !listing.location_shared || !listing.location_x) return;
    
    router.navigate('maps', {
      x: listing.location_x,
      y: listing.location_y,
      z: listing.location_z
    });
  };

  const publish = async () => {
    const payload = {
      title: sanitizeText(title(), 100),
      description: sanitizeText(description(), 1000),
      price: Number(price() || 0),
      category: composerCategory(),
      photos: photos()
    };
    
    if (!payload.title) {
      uiAlert('El titulo es obligatorio');
      return;
    }

    setLoading(true);
    const result = await fetchNui<{ success?: boolean; listing?: Listing }>('yellowpagesCreateListing', payload);
    setLoading(false);
    
    if (!result?.success) {
      uiAlert('Error al publicar');
      return;
    }

    // Reset form
    setShowComposer(false);
    setTitle('');
    setDescription('');
    setPrice('');
    setPhotos([]);
    
    // Refresh listings
    cache.invalidate();
    await loadListings();
  };

  const deleteListing = async (id: number) => {
    if (!(await uiConfirm('¿Eliminar este anuncio?', { title: 'Eliminar anuncio' }))) return;
    
    await fetchNui('yellowpagesDeleteListing', id);
    cache.invalidate();
    await loadListings();
  };

  const addPhoto = async () => {
    const gallery = await fetchNui<any[]>('getGallery', undefined, []);
    if (gallery?.[0]?.url) {
      const url = sanitizeMediaUrl(gallery[0].url);
      if (url && photos().length < 5) {
        setPhotos([...photos(), url]);
      }
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(photos().filter((_, i) => i !== index));
  };

  return (
    <AppScaffold title="Paginas Amarillas" subtitle="Compra, vende, conecta" onBack={() => router.goBack()} bodyClass={styles.body}>
      <div class={styles.yellowpagesApp}>
        {/* Header with Search */}
        <div class={styles.header}>
          <div class={styles.searchBar}>
            <input
              type="text"
              placeholder="Buscar anuncios..."
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadListings()}
            />
            <button class={styles.searchBtn} onClick={() => loadListings()}>
              <img src="./img/icons_ios/ui-search.svg" alt="" />
            </button>
          </div>
          
          {/* Category Filter */}
          <div class={styles.categoryFilter}>
            <For each={categories()}>
              {(cat) => (
                <button
                  class={styles.categoryChip}
                  classList={{ [styles.active]: selectedCategory() === cat.id }}
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  <span class={styles.catIcon}><img src={getCategoryIcon(cat.id)} alt="" /></span>
                  <span class={styles.catName}>{cat.name}</span>
                </button>
              )}
            </For>
          </div>
        </div>

        {/* Tabs */}
        <div class={styles.tabs}>
          <button
            class={styles.tabBtn}
            classList={{ [styles.active]: currentTab() === 'all' }}
            onClick={() => setCurrentTab('all')}
          >
            Todos
          </button>
          <button
            class={styles.tabBtn}
            classList={{ [styles.active]: currentTab() === 'my' }}
            onClick={() => setCurrentTab('my')}
          >
            Mis Anuncios
          </button>
        </div>

        {/* Listings */}
        <div class={styles.listingsGrid}>
          <Show when={loading() && listings().length === 0}>
            <div class={styles.loading}>Cargando...</div>
          </Show>
          
          <For each={listings()}>
            {(listing) => (
              <div class={styles.listingCard} onClick={() => openListing(listing)}>
                <div class={styles.cardImage}>
                  <Show when={Array.isArray(listing.photos) && listing.photos.length > 0}>
                    <img src={listing.photos[0]} alt="" />
                  </Show>
                  <div class={styles.categoryBadge}>
                    <img src={getCategoryIcon(listing.category)} alt="" />
                  </div>
                  <Show when={listing.is_own}>
                    <button 
                      class={styles.deleteBtn}
                      onClick={(e) => { e.stopPropagation(); deleteListing(listing.id); }}
                    >
                      <img src="./img/icons_ios/ui-close.svg" alt="" />
                    </button>
                  </Show>
                </div>
                
                <div class={styles.cardContent}>
                  <h3 class={styles.cardTitle}>{listing.title}</h3>
                  <p class={styles.cardDesc}>{listing.description || 'Sin descripcion'}</p>
                  
                  <div class={styles.cardMeta}>
                    <span class={styles.price}>${listing.price.toLocaleString()}</span>
                    <span class={styles.views}><img src="./img/icons_ios/ui-eye.svg" alt="" /> {listing.views || 0}</span>
                  </div>
                  
                  <div class={styles.cardFooter}>
                    <span class={styles.category}>{getCategoryName(listing.category)}</span>
                    <span class={styles.time}>{listing.created_at ? timeAgo(listing.created_at) : ''}</span>
                  </div>
                </div>
              </div>
            )}
          </For>
          
          <Show when={!loading() && listings().length === 0}>
            <div class={styles.emptyState}>
              <p>No hay anuncios</p>
              <p class={styles.emptyHint}>¡Sé el primero en publicar!</p>
            </div>
          </Show>
        </div>

        {/* FAB */}
        <button class={styles.fab} onClick={() => setShowComposer(true)}>
          <span>+</span>
        </button>

        {/* Listing Detail Modal */}
        <Show when={selectedListing()}>
          <div class={styles.detailModal}>
            <button class={styles.closeBtn} onClick={() => { setSelectedListing(null); setSellerInfo(null); }}>
              <img src="./img/icons_ios/ui-close.svg" alt="" />
            </button>
            
            <div class={styles.detailContent}>
              <Show when={Array.isArray(selectedListing()?.photos) && selectedListing().photos.length > 0}>
                <div class={styles.detailImage}>
                  <img 
                    src={selectedListing().photos[0]} 
                    alt="" 
                    onClick={() => setViewerUrl(selectedListing().photos[0])}
                  />
                  <Show when={selectedListing().photos.length > 1}>
                    <div class={styles.photoCount}>+{selectedListing().photos.length - 1} fotos</div>
                  </Show>
                </div>
              </Show>
              
              <div class={styles.detailInfo}>
                <span class={styles.detailCategory}>
                  <img src={getCategoryIcon(selectedListing().category)} alt="" /> {getCategoryName(selectedListing().category)}
                </span>
                <h2 class={styles.detailTitle}>{selectedListing().title}</h2>
                <p class={styles.detailDesc}>{selectedListing().description || 'Sin descripcion'}</p>
                
                <div class={styles.detailPrice}>
                  <span class={styles.priceLabel}>Precio</span>
                  <span class={styles.priceValue}>${selectedListing().price.toLocaleString()}</span>
                </div>
                
                <div class={styles.detailMeta}>
                  <span class={styles.metaWithIcon}><img src="./img/icons_ios/ui-eye.svg" alt="" /> {selectedListing().views || 0} visitas</span>
                  <span>•</span>
                  <span>Publicado {selectedListing().created_at ? timeAgo(selectedListing().created_at) : ''}</span>
                </div>
              </div>
              
              {/* Seller Info */}
              <Show when={sellerInfo()}>
                <div class={styles.sellerSection}>
                  <h4>Vendedor</h4>
                  <div class={styles.sellerCard}>
                    <div class={styles.sellerAvatar}>
                      {sellerInfo().seller_avatar ? (
                        <img src={sellerInfo().seller_avatar} alt="" />
                      ) : (
                        <span>{(sellerInfo().seller_name || 'U').charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div class={styles.sellerInfo}>
                      <strong>{sellerInfo().seller_name || 'Vendedor'}</strong>
                      <span class={styles.metaWithIcon}><img src="./img/icons_ios/ui-phone.svg" alt="" /> {sellerInfo().phone_number || 'Sin telefono'}</span>
                    </div>
                  </div>
                </div>
                
                {/* Contact Buttons */}
                <Show when={!selectedListing()?.is_own}>
                  <div class={styles.contactButtons}>
                    <button 
                      class={styles.contactBtn}
                      onClick={() => setShowContactModal(true)}
                    >
                      <img src="./img/icons_ios/ui-phone.svg" alt="" />
                      Contactar
                    </button>
                    <Show when={selectedListing()?.location_shared}>
                      <button 
                        class={styles.locationBtn}
                        onClick={viewLocation}
                      >
                        <img src="./img/icons_ios/ui-location.svg" alt="" />
                        Ver ubicacion
                      </button>
                    </Show>
                  </div>
                </Show>
              </Show>
            </div>
          </div>
        </Show>

        {/* Contact Modal */}
        <Modal
          open={showContactModal()}
          title="Contactar Vendedor"
          onClose={() => setShowContactModal(false)}
          size="sm"
        >
          <div class={styles.contactOptions}>
            <button class={styles.contactOption} onClick={() => contactSeller('call')}>
              <span class={styles.contactIcon}><img src="./img/icons_ios/ui-phone.svg" alt="" /></span>
              <div class={styles.contactInfo}>
                <strong>Llamar</strong>
                <span>{sellerInfo()?.phone_number}</span>
              </div>
            </button>
            
            <button class={styles.contactOption} onClick={() => contactSeller('message')}>
              <span class={styles.contactIcon}><img src="./img/icons_ios/ui-chat.svg" alt="" /></span>
              <div class={styles.contactInfo}>
                <strong>Enviar mensaje</strong>
                <span>Chat privado</span>
              </div>
            </button>
          </div>
          
          <ModalActions>
            <ModalButton label="Cancelar" onClick={() => setShowContactModal(false)} />
          </ModalActions>
        </Modal>

        {/* Composer Modal */}
        <Modal
          open={showComposer()}
          title="Nuevo Anuncio"
          onClose={() => setShowComposer(false)}
          size="md"
        >
          <div class={styles.composerContent}>
            <FormSection class={styles.formField} label="Titulo *">
              <input
                type="text"
                placeholder="Ej: Auto deportivo en venta"
                value={title()}
                onInput={(e) => setTitle(e.currentTarget.value)}
                maxlength={100}
              />
            </FormSection>
            
            <FormSection class={styles.formField} label="Descripcion">
              <textarea
                placeholder="Describe tu producto o servicio..."
                value={description()}
                onInput={(e) => setDescription(e.currentTarget.value)}
                rows={4}
                maxlength={1000}
              />
            </FormSection>
            
            <FormRow class={styles.formRow}>
              <FormSection class={styles.formField} label="Precio ($)">
                <input
                  type="number"
                  placeholder="0"
                  value={price()}
                  onInput={(e) => setPrice(e.currentTarget.value)}
                  min="0"
                />
              </FormSection>
              
              <FormSection class={styles.formField} label="Categoria">
                <select
                  value={composerCategory()}
                  onChange={(e) => setComposerCategory(e.currentTarget.value)}
                >
                  <For each={categories().filter(c => c.id !== 'all')}>
                    {(cat) => (
                      <option value={cat.id}>{cat.name}</option>
                    )}
                  </For>
                </select>
              </FormSection>
            </FormRow>
            
            <FormSection class={styles.formField} label={`Fotos (${photos().length}/5)`}>
              <div class={styles.photosGrid}>
                <For each={photos()}>
                  {(photo, index) => (
                    <div class={styles.photoThumb}>
                      <img src={photo} alt="" />
                      <button onClick={() => removePhoto(index())}><img src="./img/icons_ios/ui-close.svg" alt="" /></button>
                    </div>
                  )}
                </For>
                <Show when={photos().length < 5}>
                  <button class={styles.addPhotoBtn} onClick={addPhoto}>
                    <span>+</span>
                  </button>
                </Show>
              </div>
            </FormSection>
          </div>
          
          <ModalActions>
            <ModalButton label="Cancelar" onClick={() => setShowComposer(false)} />
            <ModalButton 
              label={loading() ? 'Publicando...' : 'Publicar'}
              onClick={() => void publish()}
              tone="primary"
              disabled={!title().trim() || loading()}
            />
          </ModalActions>
        </Modal>

        <MediaLightbox url={viewerUrl()} onClose={() => setViewerUrl(null)} />
      </div>
    </AppScaffold>
  );
}
