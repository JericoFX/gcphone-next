import { For, Show, createEffect, createMemo, createSignal, onMount } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchNui } from '../../../utils/fetchNui';
import { sanitizeText } from '../../../utils/sanitize';
import { uiConfirm } from '../../../utils/uiDialog';
import { uiAlert } from '../../../utils/uiAlert';
import { usePhoneKeyHandler } from '../../../hooks/usePhoneKeyHandler';
import { usePhone } from '../../../store/phone';
import { AppScaffold } from '../../shared/layout';
import { useAppCache } from '../../../hooks';
import { EmptyState } from '../../shared/ui/EmptyState';
import { SearchInput } from '../../shared/ui/SearchInput';
import { SegmentedTabs } from '../../shared/ui/SegmentedTabs';
import { FormSection, Modal, ModalActions, ModalButton } from '../../shared/ui/Modal';
import { t } from '../../../i18n';
import styles from './ServicesApp.module.scss';

interface ServiceWorker {
  id: number;
  identifier?: string;
  phone_number?: string;
  display_name: string;
  avatar?: string;
  category: string;
  description?: string;
  availability: 'online' | 'offline' | 'busy';
  rating_sum: number;
  rating_count: number;
  rating: number;
  created_at?: string;
}

interface Category {
  id: string;
  name: string;
  icon: string;
}

const CATEGORY_ICON: Record<string, string> = {
  all: './img/icons_ios/svc-all.svg',
  mechanic: './img/icons_ios/svc-mechanic.svg',
  lawyer: './img/icons_ios/svc-lawyer.svg',
  doctor: './img/icons_ios/svc-doctor.svg',
  taxi: './img/icons_ios/svc-taxi.svg',
  delivery: './img/icons_ios/svc-delivery.svg',
  security: './img/icons_ios/svc-security.svg',
  realtor: './img/icons_ios/svc-realtor.svg',
  other: './img/icons_ios/svc-other.svg',
};


function renderStars(rating: number): string {
  const full = Math.round(rating);
  let out = '';
  for (let i = 1; i <= 5; i++) {
    out += i <= full ? '\u2605' : '\u2606';
  }
  return out;
}

export function ServicesApp() {
  const router = useRouter();
  const cache = useAppCache('services');
  const [phoneState] = usePhone();

  // Data
  const [listings, setListings] = createSignal<ServiceWorker[]>([]);
  const [categories, setCategories] = createSignal<Category[]>([]);
  const [selectedWorker, setSelectedWorker] = createSignal<ServiceWorker | null>(null);
  const [myService, setMyService] = createSignal<ServiceWorker | null>(null);

  // Tabs and filters
  const [currentTab, setCurrentTab] = createSignal<'browse' | 'my'>('browse');
  const [selectedCategory, setSelectedCategory] = createSignal('all');
  const [searchQuery, setSearchQuery] = createSignal('');

  // UI State
  const [loading, setLoading] = createSignal(false);
  const [showRegister, setShowRegister] = createSignal(false);

  // Rate
  const [rateScore, setRateScore] = createSignal(0);
  const [rateLoading, setRateLoading] = createSignal(false);

  // Form fields (register/edit)
  const [formName, setFormName] = createSignal('');
  const [formAvatar, setFormAvatar] = createSignal('');
  const [formCategory, setFormCategory] = createSignal('mechanic');
  const [formDescription, setFormDescription] = createSignal('');
  const [formAvailability, setFormAvailability] = createSignal<'online' | 'offline' | 'busy'>('offline');

  const isReadOnly = () => phoneState.accessMode === 'foreign-readonly';
  const language = () => phoneState.settings.language || 'es';

  const tabs = () => [
    { id: 'browse', label: t('services.tab.browse', language()) },
    { id: 'my', label: t('services.tab.my', language()) },
  ];

  const categoryNameMap = createMemo(() => {
    const map = new Map<string, string>();
    for (const category of categories()) {
      map.set(category.id, category.name);
    }
    return map;
  });

  const getCategoryName = (catId: string) => categoryNameMap().get(catId) || t('services.category.other', language());
  const getCategoryIcon = (catId: string) => CATEGORY_ICON[catId] || CATEGORY_ICON.other;

  const loadCategories = async () => {
    const cats = await fetchNui<Category[]>('servicesGetCategories', {}, []);
    setCategories(cats || []);
  };

  const loadListings = async () => {
    setLoading(true);

    const cacheKey = `services:${selectedCategory()}:${searchQuery()}`;
    const cached = cache.get<ServiceWorker[]>(cacheKey);

    let list: ServiceWorker[];
    if (cached) {
      list = cached;
    } else {
      list = await fetchNui<ServiceWorker[]>('servicesGetListings', {
        category: selectedCategory(),
        search: searchQuery(),
        limit: 50,
        offset: 0,
      }, []);
    }

    if (!cached) cache.set(cacheKey, list || [], 30000);
    setListings(list || []);
    setLoading(false);
  };

  const loadMyService = async () => {
    const svc = await fetchNui<ServiceWorker | null>('servicesGetMyService', {}, null);
    setMyService(svc);
    if (svc) {
      setFormName(svc.display_name || '');
      setFormAvatar(svc.avatar || '');
      setFormCategory(svc.category || 'mechanic');
      setFormDescription(svc.description || '');
      setFormAvailability(svc.availability || 'offline');
    }
  };

  onMount(() => {
    void loadCategories();
    void loadMyService();
  });

  createEffect(() => {
    if (currentTab() === 'browse') {
      void loadListings();
    }
  });

  usePhoneKeyHandler({
    Backspace: () => {
      if (selectedWorker()) { setSelectedWorker(null); return; }
      if (showRegister()) { setShowRegister(false); return; }
      router.goBack();
    },
  });

  const openWorker = async (worker: ServiceWorker) => {
    const info = await fetchNui<ServiceWorker | null>('servicesGetWorkerInfo', worker.id, null);
    setSelectedWorker(info || worker);
    setRateScore(0);
  };

  const callWorker = () => {
    const worker = selectedWorker();
    if (!worker?.phone_number) return;
    router.navigate('calls', { phoneNumber: worker.phone_number, autoStartCall: true });
  };

  const messageWorker = () => {
    const worker = selectedWorker();
    if (!worker?.phone_number) return;
    router.navigate('messages', { phoneNumber: worker.phone_number });
  };

  const submitRating = async () => {
    const worker = selectedWorker();
    if (!worker || rateScore() < 1) return;
    setRateLoading(true);

    const result = await fetchNui<{ success?: boolean }>('servicesRateWorker', {
      service_id: worker.id,
      score: rateScore(),
    }, { success: false });

    setRateLoading(false);

    if (result?.success) {
      uiAlert(t('services.rating_sent', language()));
      // Reload worker info
      const updated = await fetchNui<ServiceWorker | null>('servicesGetWorkerInfo', worker.id, null);
      if (updated) setSelectedWorker(updated);
    } else {
      uiAlert(t('services.rating_failed', language()));
    }
  };

  const registerService = async () => {
    if (isReadOnly()) return;
    const name = sanitizeText(formName(), 60);
    if (!name) {
      uiAlert(t('services.name_required', language()));
      return;
    }

    setLoading(true);
    const result = await fetchNui<{ success?: boolean; service?: ServiceWorker }>('servicesRegister', {
      display_name: name,
      avatar: formAvatar() || undefined,
      category: formCategory(),
      description: sanitizeText(formDescription(), 500),
    }, { success: false });
    setLoading(false);

    if (result?.success) {
      setShowRegister(false);
      cache.invalidate();
      await loadMyService();
    } else {
      uiAlert(t('services.register_failed', language()));
    }
  };

  const updateService = async () => {
    if (isReadOnly()) return;
    const name = sanitizeText(formName(), 60);
    if (!name) {
      uiAlert(t('services.name_required', language()));
      return;
    }

    setLoading(true);
    const result = await fetchNui<{ success?: boolean }>('servicesUpdateService', {
      display_name: name,
      avatar: formAvatar() || undefined,
      category: formCategory(),
      description: sanitizeText(formDescription(), 500),
    }, { success: false });
    setLoading(false);

    if (result?.success) {
      cache.invalidate();
      await loadMyService();
      uiAlert(t('services.update_success', language()));
    } else {
      uiAlert(t('services.update_failed', language()));
    }
  };

  const setAvailability = async (avail: 'online' | 'offline' | 'busy') => {
    if (isReadOnly()) return;
    setFormAvailability(avail);

    await fetchNui('servicesSetAvailability', { availability: avail });
    cache.invalidate();
    await loadMyService();
  };

  const deleteService = async () => {
    if (isReadOnly()) return;
    if (!(await uiConfirm(t('services.delete_confirm', language()), { title: t('services.delete_title', language()) }))) return;

    await fetchNui('servicesDeleteService', {});
    cache.invalidate();
    setMyService(null);
    setFormName('');
    setFormAvatar('');
    setFormCategory('mechanic');
    setFormDescription('');
    setFormAvailability('offline');
  };

  return (
    <AppScaffold title={t('services.title', language())} subtitle={t('services.subtitle', language())} onBack={() => router.goBack()} bodyClass={styles.body}>
      <div class={styles.servicesApp}>
        {/* Tabs */}
        <div class={styles.tabs}>
          <SegmentedTabs items={tabs()} active={currentTab()} onChange={(id) => setCurrentTab(id as 'browse' | 'my')} />
        </div>

        {/* Browse View */}
        <Show when={currentTab() === 'browse'}>
          <div class={styles.header}>
            <div class={styles.searchBar}>
              <SearchInput
                value={searchQuery()}
                onInput={setSearchQuery}
                placeholder={t('services.search_placeholder', language())}
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
                    <img class={styles.catIcon} src={getCategoryIcon(cat.id)} alt="" />
                    <span>{cat.name}</span>
                  </button>
                )}
              </For>
            </div>
          </div>

          {/* Listings */}
          <div class={styles.listingsGrid}>
            <Show when={loading() && listings().length === 0}>
              <div class={styles.loading}>{t('common.loading', language())}</div>
            </Show>

            <For each={listings()}>
              {(worker) => (
                <div class={styles.workerCard} onClick={() => openWorker(worker)}>
                  <div class={styles.avatar}>
                    <Show when={worker.avatar} fallback={
                      <span>{(worker.display_name || 'U').charAt(0).toUpperCase()}</span>
                    }>
                      <img src={worker.avatar} alt="" />
                    </Show>
                  </div>

                  <div class={styles.workerInfo}>
                    <div class={styles.workerName}>{worker.display_name}</div>
                    <div class={styles.workerMeta}>
                      <span class={styles.categoryBadge}>{getCategoryName(worker.category)}</span>
                      <span class={styles.ratingStars}>
                        {renderStars(worker.rating || 0)}
                        <span class={styles.ratingValue}>
                          {worker.rating_count > 0 ? (worker.rating_sum / worker.rating_count).toFixed(1) : '0.0'}
                        </span>
                      </span>
                    </div>
                  </div>

                  <div
                    class={styles.availabilityBadge}
                    classList={{
                      [styles.online]: worker.availability === 'online',
                      [styles.offline]: worker.availability === 'offline',
                      [styles.busy]: worker.availability === 'busy',
                    }}
                  >
                    <span class={styles.dot} />
                    <span>{t('services.availability.' + worker.availability, language()) || 'Offline'}</span>
                  </div>
                </div>
              )}
            </For>

            <Show when={!loading() && listings().length === 0}>
              <EmptyState class={styles.emptyState} title={t('services.empty_title', language())} description={t('services.empty_desc', language())} />
            </Show>
          </div>
        </Show>

        {/* My Service View */}
        <Show when={currentTab() === 'my'}>
          <div class={styles.myServiceView}>
            <Show when={!myService() && !showRegister()}>
              <div class={styles.registerPrompt}>
                <h3>{t('services.offer_title', language())}</h3>
                <p>{t('services.offer_desc', language())}</p>
                <Show when={!isReadOnly()}>
                  <button class={styles.registerBtn} onClick={() => setShowRegister(true)}>
                    {t('common.register', language())}
                  </button>
                </Show>
              </div>
            </Show>

            {/* Register Form */}
            <Show when={showRegister() && !myService()}>
              <div class={styles.serviceForm}>
                <FormSection class={styles.formField} label={t('services.form.name', language())}>
                  <input
                    type="text"
                    placeholder={t('services.form.name_placeholder', language())}
                    value={formName()}
                    onInput={(e) => setFormName(e.currentTarget.value)}
                    maxlength={60}
                  />
                </FormSection>

                <FormSection class={styles.formField} label={t('services.form.avatar', language())}>
                  <input
                    type="text"
                    placeholder="https://..."
                    value={formAvatar()}
                    onInput={(e) => setFormAvatar(e.currentTarget.value)}
                    maxlength={500}
                  />
                </FormSection>

                <FormSection class={styles.formField} label={t('services.form.category', language())}>
                  <select value={formCategory()} onChange={(e) => setFormCategory(e.currentTarget.value)}>
                    <For each={categories().filter(c => c.id !== 'all')}>
                      {(cat) => <option value={cat.id}>{cat.name}</option>}
                    </For>
                  </select>
                </FormSection>

                <FormSection class={styles.formField} label={t('services.form.description', language())}>
                  <textarea
                    placeholder={t('services.form.description_placeholder', language())}
                    value={formDescription()}
                    onInput={(e) => setFormDescription(e.currentTarget.value)}
                    rows={4}
                    maxlength={500}
                  />
                </FormSection>

                <div class={styles.formActions}>
                  <button class={styles.deleteBtn} onClick={() => setShowRegister(false)}>{t('common.cancel', language())}</button>
                  <button class={styles.saveBtn} onClick={() => void registerService()} disabled={loading()}>
                    {loading() ? t('services.registering', language()) : t('common.register', language())}
                  </button>
                </div>
              </div>
            </Show>

            {/* Edit Form */}
            <Show when={myService()}>
              <div class={styles.serviceForm}>
                <FormSection class={styles.formField} label={t('services.form.availability', language())}>
                  <div class={styles.availabilityToggle}>
                    <button
                      classList={{ [styles.activeOnline]: formAvailability() === 'online' }}
                      onClick={() => void setAvailability('online')}
                    >{t('services.availability.online', language())}</button>
                    <button
                      classList={{ [styles.activeBusy]: formAvailability() === 'busy' }}
                      onClick={() => void setAvailability('busy')}
                    >{t('services.availability.busy', language())}</button>
                    <button
                      classList={{ [styles.activeOffline]: formAvailability() === 'offline' }}
                      onClick={() => void setAvailability('offline')}
                    >{t('services.availability.offline', language())}</button>
                  </div>
                </FormSection>

                <FormSection class={styles.formField} label={t('services.form.name', language())}>
                  <input
                    type="text"
                    placeholder={t('services.form.name_placeholder', language())}
                    value={formName()}
                    onInput={(e) => setFormName(e.currentTarget.value)}
                    maxlength={60}
                  />
                </FormSection>

                <FormSection class={styles.formField} label={t('services.form.avatar', language())}>
                  <input
                    type="text"
                    placeholder="https://..."
                    value={formAvatar()}
                    onInput={(e) => setFormAvatar(e.currentTarget.value)}
                    maxlength={500}
                  />
                </FormSection>

                <FormSection class={styles.formField} label={t('services.form.category', language())}>
                  <select value={formCategory()} onChange={(e) => setFormCategory(e.currentTarget.value)}>
                    <For each={categories().filter(c => c.id !== 'all')}>
                      {(cat) => <option value={cat.id}>{cat.name}</option>}
                    </For>
                  </select>
                </FormSection>

                <FormSection class={styles.formField} label={t('services.form.description', language())}>
                  <textarea
                    placeholder={t('services.form.description_placeholder', language())}
                    value={formDescription()}
                    onInput={(e) => setFormDescription(e.currentTarget.value)}
                    rows={4}
                    maxlength={500}
                  />
                </FormSection>

                <div class={styles.formActions}>
                  <button class={styles.deleteBtn} onClick={() => void deleteService()}>{t('common.delete', language())}</button>
                  <button class={styles.saveBtn} onClick={() => void updateService()} disabled={loading()}>
                    {loading() ? t('services.saving', language()) : t('common.save', language())}
                  </button>
                </div>
              </div>
            </Show>
          </div>
        </Show>

        {/* Worker Detail Modal */}
        <Show when={selectedWorker()}>
          <div class={styles.detailModal}>
            <button class={styles.closeBtn} onClick={() => { setSelectedWorker(null); setRateScore(0); }}>
              <img src="./img/icons_ios/ui-close.svg" alt="" />
            </button>

            <div class={styles.detailContent}>
              <div class={styles.detailHeader}>
                <div class={styles.detailAvatar}>
                  <Show when={selectedWorker()!.avatar} fallback={
                    <span>{(selectedWorker()!.display_name || 'U').charAt(0).toUpperCase()}</span>
                  }>
                    <img src={selectedWorker()!.avatar} alt="" />
                  </Show>
                </div>
                <div class={styles.detailHeaderInfo}>
                  <span class={styles.detailCategory}>
                    <img class={styles.detailCatIcon} src={getCategoryIcon(selectedWorker()!.category)} alt="" />
                    {getCategoryName(selectedWorker()!.category)}
                  </span>
                  <h2>{selectedWorker()!.display_name}</h2>
                  <div
                    class={styles.availabilityBadge}
                    classList={{
                      [styles.online]: selectedWorker()!.availability === 'online',
                      [styles.offline]: selectedWorker()!.availability === 'offline',
                      [styles.busy]: selectedWorker()!.availability === 'busy',
                    }}
                  >
                    <span class={styles.dot} />
                    <span>{t('services.availability.' + selectedWorker()!.availability, language()) || 'Offline'}</span>
                  </div>
                </div>
              </div>

              {/* Rating */}
              <div class={styles.detailRating}>
                <span class={styles.ratingBig}>
                  {selectedWorker()!.rating_count > 0
                    ? (selectedWorker()!.rating_sum / selectedWorker()!.rating_count).toFixed(1)
                    : '0.0'}
                </span>
                <span class={styles.ratingStarsBig}>
                  {renderStars(selectedWorker()!.rating || 0)}
                </span>
                <span class={styles.ratingCountLabel}>
                  {t('services.rating_count', language(), { count: selectedWorker()!.rating_count || 0 })}
                </span>
              </div>

              {/* Description */}
              <Show when={selectedWorker()!.description}>
                <p class={styles.detailDesc}>{selectedWorker()!.description}</p>
              </Show>

              {/* Phone */}
              <Show when={selectedWorker()!.phone_number}>
                <div class={styles.detailPhone}>
                  <img src="./img/icons_ios/ui-phone.svg" alt="" />
                  <span>{selectedWorker()!.phone_number}</span>
                </div>
              </Show>

              {/* Contact Buttons */}
              <Show when={selectedWorker()!.phone_number}>
                <div class={styles.contactButtons}>
                  <button class={styles.contactBtn} onClick={callWorker}>
                    <img src="./img/icons_ios/ui-phone.svg" alt="" />
                    {t('services.call', language())}
                  </button>
                  <button class={styles.messageBtn} onClick={messageWorker}>
                    <img src="./img/icons_ios/ui-chat.svg" alt="" />
                    {t('services.message', language())}
                  </button>
                </div>
              </Show>

              {/* Rate Section */}
              <div class={styles.rateSection}>
                <h4>{t('services.rate', language())}</h4>
                <div class={styles.rateStars}>
                  <For each={[1, 2, 3, 4, 5]}>
                    {(star) => (
                      <button
                        classList={{ [styles.filled]: star <= rateScore() }}
                        onClick={() => setRateScore(star)}
                      >
                        {star <= rateScore() ? '\u2605' : '\u2606'}
                      </button>
                    )}
                  </For>
                </div>
                <button
                  class={styles.rateSubmit}
                  onClick={() => void submitRating()}
                  disabled={rateScore() < 1 || rateLoading()}
                >
                  {rateLoading() ? t('services.sending_rating', language()) : t('services.rate_submit', language())}
                </button>
              </div>
            </div>
          </div>
        </Show>
      </div>
    </AppScaffold>
  );
}
