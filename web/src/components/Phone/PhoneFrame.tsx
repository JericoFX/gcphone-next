import { For, ParentComponent, Show, createContext, createEffect, createMemo, createSignal, onCleanup, useContext, lazy, Suspense } from 'solid-js';
import type { JSX } from 'solid-js';
import { usePhone } from '../../store/phone';
import { HomeScreen } from '../apps/home/HomeScreen';
import { AppPlaceholder } from '../shared/ui/AppPlaceholder';
import { PhoneNotificationBanner } from '../shared/notifications/PhoneNotificationBanner';
import { ControlCenter } from '../shared/control-center/ControlCenter';
import { useNotifications } from '../../store/notifications';
import { APP_BY_ID } from '../../config/apps';
import { isEnvBrowser } from '../../utils/misc';
import styles from './PhoneFrame.module.scss';

type AppRoute = string;

function normalizeRoute(route: string): string {
  if (!route) return 'home';
  if (route.startsWith('messages')) return 'messages';
  const idx = route.indexOf('.');
  if (idx > 0) return route.slice(0, idx);
  return route;
}

interface RouterContextValue {
  currentRoute: () => AppRoute;
  direction: () => 'forward' | 'back';
  params: () => Record<string, unknown>;
  navigate: (route: AppRoute, params?: Record<string, unknown>) => void;
  goBack: () => void;
  history: () => AppRoute[];
  openApps: () => AppRoute[];
  closeApp: (route: AppRoute) => void;
}

const RouterContext = createContext<RouterContextValue>();

export function useRouter() {
  const context = useContext(RouterContext);
  if (!context) throw new Error('useRouter must be used within PhoneFrame');
  return context;
}

const lazyApps = {
  calls: lazy(() => import('../apps/calls/CallsApp').then(m => ({ default: m.CallsApp }))),
  contacts: lazy(() => import('../apps/contacts/ContactsApp').then(m => ({ default: m.ContactsApp }))),
  messages: lazy(() => import('../apps/messages/MessagesApp').then(m => ({ default: m.MessagesApp }))),
  settings: lazy(() => import('../apps/settings/SettingsApp').then(m => ({ default: m.SettingsApp }))),
  bank: lazy(() => import('../apps/bank/BankApp').then(m => ({ default: m.BankApp }))),
  wallet: lazy(() => import('../apps/wallet/WalletApp').then(m => ({ default: m.WalletApp }))),
  documents: lazy(() => import('../apps/documents/DocumentsApp').then(m => ({ default: m.DocumentsApp }))),
  appstore: lazy(() => import('../apps/appstore/AppStoreApp').then(m => ({ default: m.AppStoreApp }))),
  gallery: lazy(() => import('../apps/gallery/GalleryApp').then(m => ({ default: m.GalleryApp }))),
  chirp: lazy(() => import('../apps/chirp/ChirpApp').then(m => ({ default: m.ChirpApp }))),
  snap: lazy(() => import('../apps/snap/SnapApp').then(m => ({ default: m.SnapApp }))),
  clips: lazy(() => import('../apps/clips/ClipsApp').then(m => ({ default: m.ClipsApp }))),
  darkrooms: lazy(() => import('../apps/darkrooms/DarkRoomsApp').then(m => ({ default: m.DarkRoomsApp }))),
  market: lazy(() => import('../apps/market/MarketApp').then(m => ({ default: m.MarketApp }))),
  news: lazy(() => import('../apps/news/NewsApp').then(m => ({ default: m.NewsApp }))),
  garage: lazy(() => import('../apps/garage/GarageApp').then(m => ({ default: m.GarageApp }))),
  clock: lazy(() => import('../apps/clock/ClockApp').then(m => ({ default: m.ClockApp }))),
  notes: lazy(() => import('../apps/notes/NotesApp').then(m => ({ default: m.NotesApp }))),
  maps: lazy(() => import('../apps/maps/MapsApp').then(m => ({ default: m.MapsApp }))),
  weather: lazy(() => import('../apps/weather/WeatherApp').then(m => ({ default: m.WeatherApp }))),
  wavechat: lazy(() => import('../apps/wavechat/WaveChatApp').then(m => ({ default: m.WaveChatApp }))),
  music: lazy(() => import('../apps/music/MusicApp').then(m => ({ default: m.MusicApp }))),
  yellowpages: lazy(() => import('../apps/yellowpages/YellowPagesApp').then(m => ({ default: m.YellowPagesApp }))),
  camera: lazy(() => import('../apps/camera/CameraApp').then(m => ({ default: m.CameraApp }))),
};

const APP_NAMES: Record<string, string> = {
  calls: 'Llamadas',
  contacts: 'Contactos',
  messages: 'Mensajes',
  settings: 'Ajustes',
  bank: 'Banco',
  wallet: 'Wallet',
  documents: 'Documentos',
  appstore: 'App Store',
  gallery: 'Galeria',
  chirp: 'Chirp',
  snap: 'Snap',
  clips: 'Clips',
  darkrooms: 'DarkRooms',
  market: 'Market',
  news: 'Noticias',
  garage: 'Garage',
  clock: 'Reloj',
  notes: 'Notas',
  maps: 'Mapas',
  weather: 'Clima',
  wavechat: 'WaveChat',
  music: 'Musica',
  yellowpages: 'Amarillas',
  camera: 'Camara',
};

export const PhoneFrame: ParentComponent & { Router: () => JSX.Element } = (props) => {
  const [phoneState] = usePhone();
  const [notifications] = useNotifications();
  const browserMode = isEnvBrowser();
  const [history, setHistory] = createSignal<AppRoute[]>(['home']);
  const [openApps, setOpenApps] = createSignal<AppRoute[]>(['home']);
  const [params, setParams] = createSignal<Record<string, unknown>>({});
  const [direction, setDirection] = createSignal<'forward' | 'back'>('forward');
  const [multitaskOpen, setMultitaskOpen] = createSignal(false);

  const currentRoute = () => {
    const stack = history();
    return stack[stack.length - 1] || 'home';
  };

  const navigate = (route: AppRoute, nextParams?: Record<string, unknown>) => {
    const appRoute = normalizeRoute(route);
    setDirection('forward');
    setHistory((stack) => [...stack, appRoute]);
    setOpenApps((apps) => (apps.includes(appRoute) ? apps : [...apps, appRoute]));
    setParams(nextParams || {});
  };

  const goBack = () => {
    setDirection('back');
    setHistory((stack) => (stack.length > 1 ? stack.slice(0, -1) : stack));
  };

  const closeApp = (route: AppRoute) => {
    const appRoute = normalizeRoute(route);
    if (appRoute === 'home') return;

    setOpenApps((apps) => apps.filter((item) => item !== appRoute));
    setHistory((stack) => {
      const filtered = stack.filter((item) => item !== appRoute);
      return filtered.length > 0 ? filtered : ['home'];
    });
  };

  const recentRoutes = createMemo(() => {
    return openApps().filter((route) => route !== 'home').slice(-5).reverse();
  });

  const router: RouterContextValue = {
    currentRoute,
    direction,
    params,
    navigate,
    goBack,
    history,
    openApps,
    closeApp,
  };

  createEffect(() => {
    const handler = (event: CustomEvent<{ route: string; data?: Record<string, unknown> }>) => {
      if (!event.detail?.route) return;
      navigate(event.detail.route, event.detail.data || {});
    };

    window.addEventListener('phone:openRoute', handler as EventListener);
    onCleanup(() => window.removeEventListener('phone:openRoute', handler as EventListener));
  });

  return (
    <div class={styles.phoneWrapper} style={browserMode ? { transform: 'none', right: '20px', bottom: '20px' } : undefined}>
      <Show when={phoneState.settings.coque && phoneState.settings.coque !== 'sin_funda.png'}>
        <div
          class={styles.phoneCoque}
          style={{ 'background-image': `url(./img/coque/${phoneState.settings.coque})` }}
        />
      </Show>

      <div class={styles.phoneScreen} style={{ 'background-image': `url(${phoneState.settings.wallpaper})`, filter: `brightness(${notifications.brightness})` }}>
        <RouterContext.Provider value={router}>
          <ControlCenter />
          <div class={styles.bannerWrap}>
            <PhoneNotificationBanner onOpenRoute={(route, data) => router.navigate(route, data)} />
          </div>
          {props.children}

          <button class={styles.multitaskBtn} onClick={() => setMultitaskOpen(true)} data-testid="multitask-btn">▤</button>

          <Show when={multitaskOpen()}>
            <div class={styles.multitaskOverlay} onClick={() => setMultitaskOpen(false)}>
              <div class={styles.multitaskPanel} onClick={(event) => event.stopPropagation()}>
                <For each={recentRoutes()}>
                  {(route) => {
                    const app = APP_BY_ID[route];
                    return (
                      <div class={styles.multitaskCard}>
                        <button
                          class={styles.multitaskOpen}
                          onClick={() => {
                            router.navigate(route);
                            setMultitaskOpen(false);
                          }}
                        >
                          <img src={app?.icon || './img/icons_ios/settings.svg'} alt={app?.name || route} />
                          <span>{app?.name || route}</span>
                        </button>
                        <button
                          class={styles.multitaskClose}
                          onClick={() => {
                            closeApp(route);
                          }}
                        >
                          ×
                        </button>
                      </div>
                    );
                  }}
                </For>
              </div>
            </div>
          </Show>
        </RouterContext.Provider>
      </div>
      <img class={styles.phoneFrame} src="./img/phone/frame-clean.svg" alt="frame" />
    </div>
  );
};

function Router() {
  const { currentRoute, direction, openApps } = useRouter();

  const renderRoute = (route: AppRoute) => {
    if (route === 'home') return <HomeScreen />;

    if (!phoneState.enabledApps.includes(route)) return <HomeScreen />;
    
    const LazyApp = lazyApps[route as keyof typeof lazyApps];
    
    if (LazyApp) {
      const appName = APP_NAMES[route] || route;
      return (
        <Suspense fallback={<AppPlaceholder title={appName} rows={5} />}>
          <LazyApp />
        </Suspense>
      );
    }
    
    return <HomeScreen />;
  };

  return (
    <div class={styles.routerContainer}>
      <For each={openApps()}>
        {(route) => (
          <div
            class={styles.routeView}
            classList={{
              [styles.routeVisible]: currentRoute() === route,
              [styles.routeHidden]: currentRoute() !== route,
              [styles.routeForward]: currentRoute() === route && direction() === 'forward',
              [styles.routeBack]: currentRoute() === route && direction() === 'back',
            }}
          >
            {renderRoute(route)}
          </div>
        )}
      </For>
    </div>
  );
}

PhoneFrame.Router = Router;
