import { For, Show, createEffect, createMemo, createSignal, onMount } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchNui } from '../../../utils/fetchNui';
import { formatPhoneNumber, timeAgo } from '../../../utils/misc';
import { sanitizeMediaUrl, sanitizeText } from '../../../utils/sanitize';
import { uiConfirm } from '../../../utils/uiDialog';
import { uiAlert } from '../../../utils/uiAlert';
import { usePhoneKeyHandler } from '../../../hooks/usePhoneKeyHandler';
import { useContextMenu } from '../../../hooks/useContextMenu';
import { usePhone } from '../../../store/phone';
import { AppScaffold } from '../../shared/layout';
import { useAppCache } from '../../../hooks';
import { MediaLightbox } from '../../shared/ui/MediaLightbox';
import { EmptyState } from '../../shared/ui/EmptyState';
import { InlineNotice } from '../../shared/ui/InlineNotice';
import { SearchInput } from '../../shared/ui/SearchInput';
import { SegmentedTabs } from '../../shared/ui/SegmentedTabs';
import { SheetIntro } from '../../shared/ui/SheetIntro';
import { FormRow, FormSection, Modal, ModalActions, ModalButton } from '../../shared/ui/Modal';
import { t } from '../../../i18n';
import { ActionSheet } from '../../shared/ui/ActionSheet';
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
  const [phoneState] = usePhone();
  const language = () => phoneState.settings.language || 'es';

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
  const ctxMenu = useContextMenu<Listing>();

  // Composer
  const [title, setTitle] = createSignal('');
  const [description, setDescription] = createSignal('');
  const [price, setPrice] = createSignal('');
  const [composerCategory, setComposerCategory] = createSignal('items');
  const [photos, setPhotos] = createSignal<string[]>([]);
  const isReadOnly = () => phoneState.accessMode === 'foreign-readonly';
  const tabs = () => [
    { id: 'all', label: t('yellowpages.tab.browse', language()) },
    { id: 'my', label: t('yellowpages.tab.my', language()) },
  ];
  const categoryNameMap = createMemo(() => {
    const map = new Map<string, string>();

    for (const category of categories()) {
      map.set(category.id, category.name);
    }

    return map;
  });

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

  onMount(() => {
    void loadCategories();
  });

  createEffect(() => {
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
    return categoryNameMap().get(catId) || t('yellowpages.category.other', language());
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
      router.navigate('calls', {
        phoneNumber: seller.phone_number,
        display: seller.seller_name,
        autoStartCall: true,
      });
    } else {
      router.navigate('messages', {
        phoneNumber: seller.phone_number,
        display: seller.seller_name,
      });
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
    if (isReadOnly()) return;
    const payload = {
      title: sanitizeText(title(), 100),
      description: sanitizeText(description(), 1000),
      price: Number(price() || 0),
      category: composerCategory(),
      photos: photos()
    };
    
    if (!payload.title) {
      uiAlert(t('yellowpages.title_required', language()));
      return;
    }

    setLoading(true);
    const result = await fetchNui<{ success?: boolean; listing?: Listing }>('yellowpagesCreateListing', payload);
    setLoading(false);
    
    if (!result?.success) {
      uiAlert(t('yellowpages.error.publish', language()));
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
    if (!(await uiConfirm(t('yellowpages.confirm_delete_message', language()), { title: t('yellowpages.confirm_delete_title', language()) }))) return;
    
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
    <AppScaffold title={t('yellowpages.title', language())} subtitle={t('yellowpages.subtitle', language())} onBack={() => router.goBack()} bodyClass={styles.body}>
      <div class={styles.yellowpagesApp}>
        <Show when={isReadOnly()}>
          <InlineNotice title={t('yellowpages.readonly_title', language())} message={t('yellowpages.readonly_message', language(), { name: phoneState.accessOwnerName || t('common.other_person', language()) })} />
        </Show>

        {/* Header with Search */}
        <div class={styles.header}>
          <div class={styles.searchBar}>
            <SearchInput
              value={searchQuery()}
              onInput={setSearchQuery}
              placeholder={t('yellowpages.search', language())}
              class={styles.searchInputRoot}
              inputClass={styles.searchInput}
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
          <SegmentedTabs items={tabs()} active={currentTab()} onChange={(id) => setCurrentTab(id as 'all' | 'my')} />
        </div>

        {/* Listings */}
        <div class={styles.listingsGrid}>
          <Show when={loading() && listings().length === 0}>
            <div class={styles.loading}>{t('state.loading', language())}</div>
          </Show>
          
          <For each={listings()}>
            {(listing) => (
              <div class={styles.listingCard} onClick={() => openListing(listing)} onContextMenu={ctxMenu.onContextMenu(listing)}>
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
                  <p class={styles.cardDesc}>{listing.description || t('yellowpages.no_description', language())}</p>
                  
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
            <EmptyState class={styles.emptyState} title={t('yellowpages.no_listings', language())} description={t('yellowpages.no_listings_desc', language())} />
          </Show>
        </div>

        {/* FAB */}
        <Show when={!isReadOnly()}>
          <button class={styles.fab} onClick={() => setShowComposer(true)}>
            <span>+</span>
          </button>
        </Show>

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
                    <div class={styles.photoCount}>+{selectedListing().photos.length - 1} {t('yellowpages.photos', language())}</div>
                  </Show>
                </div>
              </Show>
              
              <div class={styles.detailInfo}>
                <span class={styles.detailCategory}>
                  <img src={getCategoryIcon(selectedListing().category)} alt="" /> {getCategoryName(selectedListing().category)}
                </span>
                <h2 class={styles.detailTitle}>{selectedListing().title}</h2>
                <p class={styles.detailDesc}>{selectedListing().description || t('yellowpages.no_description', language())}</p>
                
                <div class={styles.detailPrice}>
                  <span class={styles.priceLabel}>{t('yellowpages.price', language())}</span>
                  <span class={styles.priceValue}>${selectedListing().price.toLocaleString()}</span>
                </div>
                
                <div class={styles.detailMeta}>
                  <span class={styles.metaWithIcon}><img src="./img/icons_ios/ui-eye.svg" alt="" /> {selectedListing().views || 0} {t('yellowpages.visits', language())}</span>
                  <span>•</span>
                  <span>{t('yellowpages.published', language())} {selectedListing().created_at ? timeAgo(selectedListing().created_at) : ''}</span>
                </div>
              </div>
              
              {/* Seller Info */}
              <Show when={sellerInfo()}>
                <div class={styles.sellerSection}>
                  <h4>{t('yellowpages.seller_section', language())}</h4>
                  <div class={styles.sellerCard}>
                    <div class={styles.sellerAvatar}>
                      {sellerInfo().seller_avatar ? (
                        <img src={sellerInfo().seller_avatar} alt="" />
                      ) : (
                        <span>{(sellerInfo().seller_name || 'U').charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div class={styles.sellerInfo}>
                      <strong>{sellerInfo().seller_name || t('yellowpages.seller', language())}</strong>
                      <span class={styles.metaWithIcon}><img src="./img/icons_ios/ui-phone.svg" alt="" /> {sellerInfo().phone_number ? formatPhoneNumber(sellerInfo().phone_number, phoneState.framework || 'unknown') : t('yellowpages.no_phone', language())}</span>
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
                        {t('yellowpages.contact_seller', language())}
                    </button>
                    <Show when={selectedListing()?.location_shared}>
                      <button 
                        class={styles.locationBtn}
                        onClick={viewLocation}
                      >
                        <img src="./img/icons_ios/ui-location.svg" alt="" />
                        {t('maps.share_location', language())}
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
          title={t('yellowpages.contact_seller', language())}
          onClose={() => setShowContactModal(false)}
          size="sm"
        >
          <div class={styles.contactOptions}>
            <button class={styles.contactOption} onClick={() => contactSeller('call')}>
              <span class={styles.contactIcon}><img src="./img/icons_ios/ui-phone.svg" alt="" /></span>
              <div class={styles.contactInfo}>
                <strong>{t('calls.call', language())}</strong>
                <span>{sellerInfo()?.phone_number ? formatPhoneNumber(sellerInfo()!.phone_number, phoneState.framework || 'unknown') : t('yellowpages.no_phone', language())}</span>
              </div>
            </button>
            
            <button class={styles.contactOption} onClick={() => contactSeller('message')}>
              <span class={styles.contactIcon}><img src="./img/icons_ios/ui-chat.svg" alt="" /></span>
              <div class={styles.contactInfo}>
                <strong>{t('contacts.send_message', language())}</strong>
                <span>{t('yellowpages.private_chat', language())}</span>
              </div>
            </button>

            <Show when={sellerInfo()?.phone_number}>
              <button class={styles.contactOption} onClick={async () => {
                const seller = sellerInfo();
                if (!seller?.phone_number) return;
                const result = await fetchNui<{ success?: boolean }>('addContact', {
                  display: seller.seller_name || t('yellowpages.seller', language()),
                  number: seller.phone_number,
                }, { success: true });
                if (result?.success) {
                  setShowContactModal(false);
                  uiAlert(t('yellowpages.contact_saved', language()));
                }
              }}>
                <span class={styles.contactIcon}><img src="./img/icons_ios/ui-user.svg" alt="" /></span>
                <div class={styles.contactInfo}>
                  <strong>{t('yellowpages.add_contact', language())}</strong>
                  <span>{t('yellowpages.add_contact_desc', language())}</span>
                </div>
              </button>
            </Show>
          </div>
          
          <ModalActions>
            <ModalButton label={t('action.cancel', language())} onClick={() => setShowContactModal(false)} />
          </ModalActions>
        </Modal>

        {/* Composer Modal */}
        <Modal
          open={showComposer()}
          title={t('yellowpages.new_listing', language())}
          onClose={() => setShowComposer(false)}
          size="md"
        >
          <div class={styles.composerContent}>
            <SheetIntro title={t('yellowpages.listing_intro_title', language())} description={t('yellowpages.listing_intro_desc', language())} tone="warm" />
            <FormSection class={styles.formField} label={t('yellowpages.form.title', language())}>
              <input
                type="text"
                placeholder={t('yellowpages.form.title_placeholder', language())}
                value={title()}
                onInput={(e) => setTitle(e.currentTarget.value)}
                maxlength={100}
              />
            </FormSection>
            
            <FormSection class={styles.formField} label={t('yellowpages.form.description', language())}>
              <textarea
                placeholder={t('yellowpages.form.description_placeholder', language())}
                value={description()}
                onInput={(e) => setDescription(e.currentTarget.value)}
                rows={4}
                maxlength={1000}
              />
            </FormSection>
            
            <FormRow class={styles.formRow}>
              <FormSection class={styles.formField} label={t('yellowpages.form.price', language())}>
                <input
                  type="number"
                  placeholder="0"
                  value={price()}
                  onInput={(e) => setPrice(e.currentTarget.value)}
                  min="0"
                />
              </FormSection>
              
              <FormSection class={styles.formField} label={t('yellowpages.form.category', language())}>
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
            
            <FormSection class={styles.formField} label={t('yellowpages.form.photos', language(), { count: photos().length })}>
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
            <ModalButton label={t('action.cancel', language())} onClick={() => setShowComposer(false)} />
            <ModalButton 
              label={loading() ? t('chirp.publishing', language()) : t('news.post', language())}
              onClick={() => void publish()}
              tone="primary"
              disabled={!title().trim() || loading()}
            />
          </ModalActions>
        </Modal>

        <MediaLightbox url={viewerUrl()} onClose={() => setViewerUrl(null)} />

        <ActionSheet
          open={ctxMenu.isOpen()}
          title={ctxMenu.item()?.title || t('yellowpages.title', language())}
          onClose={ctxMenu.close}
          actions={[
            {
              label: t('calls.call', language()),
              onClick: () => {
                const listing = ctxMenu.item();
                if (listing) void openListing(listing).then(() => setShowContactModal(true));
                ctxMenu.close();
              },
            },
            {
              label: t('contacts.send_message', language()),
              onClick: () => {
                const listing = ctxMenu.item();
                if (listing) void openListing(listing).then(() => setShowContactModal(true));
                ctxMenu.close();
              },
            },
            {
              label: t('yellowpages.view_details', language()) || 'Ver detalle',
              tone: 'primary',
              onClick: () => {
                const listing = ctxMenu.item();
                if (listing) void openListing(listing);
                ctxMenu.close();
              },
            },
          ]}
        />
      </div>
    </AppScaffold>
  );
}
