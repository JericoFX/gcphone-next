import { For, Show, createEffect, createMemo, createSignal, onCleanup } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { APP_DEFINITIONS, type AppDefinition } from '../../../config/apps';
import { usePhone } from '../../../store/phone';
import { ScreenState } from '../../shared/ui/ScreenState';
import styles from './AppStoreApp.module.scss';

type StoreTab = 'all' | 'social' | 'utility' | 'core';

const APP_CATEGORY: Record<string, StoreTab> = {
  chirp: 'social',
  snap: 'social',
  market: 'social',
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
  const [query, setQuery] = createSignal('');
  const [tab, setTab] = createSignal<StoreTab>('all');
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [installingId, setInstallingId] = createSignal<string | null>(null);
  const [progress, setProgress] = createSignal(0);

  createEffect(() => {
    const onKey = (e: CustomEvent<string>) => {
      if (e.detail === 'Backspace') router.goBack();
    };
    window.addEventListener('phone:keyUp', onKey as EventListener);
    onCleanup(() => window.removeEventListener('phone:keyUp', onKey as EventListener));
  });

  createEffect(() => {
    setLoading(true);
    const handle = setTimeout(() => {
      setLoading(false);
      setError(null);
    }, 180);

    onCleanup(() => clearTimeout(handle));
  });

  const isInstalledOnHome = (id: string) => phoneState.appLayout.home.includes(id);

  const filteredApps = createMemo<AppDefinition[]>(() => {
    const q = query().trim().toLowerCase();

    return APP_DEFINITIONS.filter((app) => app.id !== 'appstore')
      .filter((app) => phoneState.enabledApps.includes(app.id))
      .filter((app) => {
        const cat = APP_CATEGORY[app.id] || 'utility';
        if (tab() !== 'all' && cat !== tab()) return false;
        if (!q) return true;
        return app.name.toLowerCase().includes(q) || app.route.toLowerCase().includes(q);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
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

  return (
    <div class="ios-page">
      <div class="ios-nav">
        <button class="ios-icon-btn" onClick={() => router.goBack()}>
          ‹
        </button>
        <div class="ios-nav-title">App Store</div>
      </div>

      <div class="ios-content">
        <div class={styles.searchWrap}>
          <input class="ios-input" type="text" placeholder="Buscar apps" value={query()} onInput={(e) => setQuery(e.currentTarget.value)} />
        </div>

        <div class="ios-segment">
          <button class="ios-segment-btn" classList={{ 'ios-segment-btn-active': tab() === 'all' }} onClick={() => setTab('all')}>Todo</button>
          <button class="ios-segment-btn" classList={{ 'ios-segment-btn-active': tab() === 'social' }} onClick={() => setTab('social')}>Social</button>
          <button class="ios-segment-btn" classList={{ 'ios-segment-btn-active': tab() === 'utility' }} onClick={() => setTab('utility')}>Utilidad</button>
          <button class="ios-segment-btn" classList={{ 'ios-segment-btn-active': tab() === 'core' }} onClick={() => setTab('core')}>Core</button>
        </div>

        <ScreenState
          loading={loading()}
          error={error()}
          empty={filteredApps().length === 0}
          emptyTitle="Sin resultados"
          emptyDescription="No hay apps que coincidan con tu busqueda."
        >
          <div class="ios-section-title">Aplicaciones</div>
          <div class="ios-list">
            <For each={filteredApps()}>
              {(app) => (
                <div class="ios-row">
                  <div class={styles.appInfo}>
                    <img src={app.icon} alt={app.name} />
                    <div>
                      <div class="ios-label">{app.name}</div>
                      <div class="ios-value">{APP_CATEGORY[app.id] || 'utility'}</div>
                    </div>
                  </div>
                  <Show when={installingId() !== app.id} fallback={<div class={styles.progressText}>{progress()}%</div>}>
                    <button
                      class="ios-btn"
                      classList={{ 'ios-btn-success': !isInstalledOnHome(app.id), 'ios-btn-danger': isInstalledOnHome(app.id) }}
                      onClick={() => void toggleInstall(app.id)}
                    >
                      {isInstalledOnHome(app.id) ? 'Quitar' : 'Instalar'}
                    </button>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </ScreenState>
      </div>
    </div>
  );
}
