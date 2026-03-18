import { For, Show, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { APP_DEFINITIONS, type AppDefinition } from '../../../config/apps';
import { usePhone } from '../../../store/phone';
import { usePhoneKeyHandler } from '../../../hooks/usePhoneKeyHandler';
import { AppScaffold } from '../../shared/layout';
import { SearchInput } from '../../shared/ui/SearchInput';
import { ScreenState } from '../../shared/ui/ScreenState';
import { appName, t } from '../../../i18n';
import styles from './AppStoreApp.module.scss';

type StoreTab = 'all' | 'social' | 'utility' | 'core';

const APP_CATEGORY: Record<string, StoreTab> = {
  chirp: 'social',
  snap: 'social',
  news: 'social',
  darkrooms: 'social',
  clips: 'social',
  yellowpages: 'social',
  contacts: 'core',
  messages: 'core',
  calls: 'core',
  settings: 'core',
  gallery: 'core',
  bank: 'core',
  wallet: 'core',
  documents: 'core',
  appstore: 'core',
  garage: 'utility',
  clock: 'utility',
  notes: 'utility',
  maps: 'utility',
  weather: 'utility',
};

export function AppStoreApp() {
  const router = useRouter();
  const [phoneState, phoneActions] = usePhone();
  const language = () => phoneState.settings.language || 'es';
  const [query, setQuery] = createSignal('');
  const [tab, setTab] = createSignal<StoreTab>('all');
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [installingId, setInstallingId] = createSignal<string | null>(null);
  const [progress, setProgress] = createSignal(0);

  usePhoneKeyHandler({
    Backspace: () => {
      router.goBack();
    },
  });

  onMount(() => {
    setLoading(true);
    const handle = setTimeout(() => {
      setLoading(false);
      setError(null);
    }, 180);

    onCleanup(() => clearTimeout(handle));
  });

  const isInstalledOnHome = (id: string) => phoneState.appLayout.home.includes(id);
  const isInstalledInMenu = (id: string) => phoneState.appLayout.menu.includes(id);
  const categoryLabel = (category: StoreTab) => t(`appstore.category.${category}`, language());

  const filteredApps = createMemo<AppDefinition[]>(() => {
    const q = query().trim().toLowerCase();

    return APP_DEFINITIONS.filter((app) => app.id !== 'appstore')
      .filter((app) => phoneState.enabledApps.includes(app.id))
      .filter((app) => {
        const cat = APP_CATEGORY[app.id] || 'utility';
        if (tab() !== 'all' && cat !== tab()) return false;
        if (!q) return true;
        const label = appName(app.id, app.name, language()).toLowerCase();
        return label.includes(q) || app.route.toLowerCase().includes(q);
      })
      .sort((a, b) => appName(a.id, a.name, language()).localeCompare(appName(b.id, b.name, language())));
  });

  const toggleInstall = async (id: string) => {
    setInstallingId(id);
    setProgress(0);

    const tick = setInterval(() => {
      setProgress((p) => Math.min(96, p + Math.floor(Math.random() * 18 + 8)));
    }, 70);

    await new Promise((resolve) => setTimeout(resolve, 520));
    clearInterval(tick);
    setProgress(100);

    if (isInstalledOnHome(id)) phoneActions.moveApp(id, 'home', 'menu');
    else phoneActions.moveApp(id, 'menu', 'home');

    setTimeout(() => {
      setInstallingId(null);
      setProgress(0);
    }, 180);
  };

  const installedCount = createMemo(() => filteredApps().filter((app) => isInstalledOnHome(app.id)).length);
  const availableCount = createMemo(() => filteredApps().filter((app) => !isInstalledOnHome(app.id)).length);
  const featuredApps = createMemo(() => filteredApps().slice(0, 3));

  return (
    <AppScaffold title={appName('appstore', 'App Store', language())} onBack={() => router.goBack()}>
      <div class={styles.heroGrid}>
        <div class={styles.heroCard}>
          <strong>{installedCount()}</strong>
          <span>{t('appstore.on_home', language()) || 'En inicio'}</span>
        </div>
        <div class={styles.heroCard}>
          <strong>{availableCount()}</strong>
          <span>{t('appstore.available', language()) || 'Disponibles'}</span>
        </div>
      </div>

      <SearchInput
        class={styles.searchWrap}
        value={query()}
        onInput={setQuery}
        placeholder={t('appstore.search_placeholder', language())}
      />

      <div class="ios-segment">
        <button class="ios-segment-btn" classList={{ 'ios-segment-btn-active': tab() === 'all' }} onClick={() => setTab('all')}>{t('appstore.tab.all', language())}</button>
        <button class="ios-segment-btn" classList={{ 'ios-segment-btn-active': tab() === 'social' }} onClick={() => setTab('social')}>{t('appstore.tab.social', language())}</button>
        <button class="ios-segment-btn" classList={{ 'ios-segment-btn-active': tab() === 'utility' }} onClick={() => setTab('utility')}>{t('appstore.tab.utility', language())}</button>
        <button class="ios-segment-btn" classList={{ 'ios-segment-btn-active': tab() === 'core' }} onClick={() => setTab('core')}>{t('appstore.tab.core', language())}</button>
      </div>

      <ScreenState loading={loading()} error={error()} empty={filteredApps().length === 0} emptyTitle={t('appstore.empty_title', language())} emptyDescription={t('appstore.empty_description', language())}>
        <Show when={featuredApps().length > 0}>
          <div class="ios-section-title">{t('appstore.featured', language()) || 'Destacadas'}</div>
          <div class={styles.featuredRail}>
            <For each={featuredApps()}>
              {(app) => (
                <button class={styles.featuredCard} onClick={() => router.navigate(app.route)}>
                  <img src={app.icon} alt={appName(app.id, app.name, language())} />
                  <strong>{appName(app.id, app.name, language())}</strong>
                  <span>{categoryLabel(APP_CATEGORY[app.id] || 'utility')}</span>
                </button>
              )}
            </For>
          </div>
        </Show>

        <div class="ios-section-title">{t('appstore.section.title', language())}</div>
        <div class="ios-list">
          <For each={filteredApps()}>
            {(app) => (
              <div class="ios-row">
                <div class={styles.appInfo}>
                  <img src={app.icon} alt={appName(app.id, app.name, language())} />
                  <div>
                    <div class={styles.rowTitleLine}>
                      <div class="ios-label">{appName(app.id, app.name, language())}</div>
                      <span class={styles.statusChip}>{isInstalledOnHome(app.id) ? (t('appstore.on_home', language()) || 'En inicio') : isInstalledInMenu(app.id) ? (t('appstore.in_menu', language()) || 'En menu') : (t('appstore.hidden', language()) || 'Oculta')}</span>
                    </div>
                    <div class="ios-value">{categoryLabel(APP_CATEGORY[app.id] || 'utility')}</div>
                  </div>
                </div>
                <div class={styles.rowActions}>
                  <button class={styles.openBtn} onClick={() => router.navigate(app.route)}>{t('appstore.open', language()) || 'Abrir'}</button>
                  <Show when={installingId() !== app.id} fallback={<div class={styles.progressText}>{progress()}%</div>}>
                    <button
                      class="ios-btn"
                      classList={{ 'ios-btn-success': !isInstalledOnHome(app.id), 'ios-btn-danger': isInstalledOnHome(app.id) }}
                      onClick={() => void toggleInstall(app.id)}
                    >
                      {isInstalledOnHome(app.id) ? (t('appstore.remove', language()) || 'Quitar') : (t('appstore.add', language()) || 'Agregar')}
                    </button>
                  </Show>
                </div>
              </div>
            )}
          </For>
        </div>
      </ScreenState>
    </AppScaffold>
  );
}
