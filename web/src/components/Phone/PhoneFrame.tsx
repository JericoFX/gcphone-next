import { For, ParentComponent, Show, createContext, createEffect, createMemo, createSignal, onCleanup, useContext } from 'solid-js';
import type { JSX } from 'solid-js';
import { usePhone } from '../../store/phone';
import { HomeScreen } from '../apps/home/HomeScreen';
import { ContactsApp } from '../apps/contacts/ContactsApp';
import { MessagesApp } from '../apps/messages/MessagesApp';
import { CallsApp } from '../apps/calls/CallsApp';
import { SettingsApp } from '../apps/settings/SettingsApp';
import { BankApp } from '../apps/bank/BankApp';
import { GalleryApp } from '../apps/gallery/GalleryApp';
import { ChirpApp } from '../apps/chirp/ChirpApp';
import { SnapApp } from '../apps/snap/SnapApp';
import { ClipsApp } from '../apps/clips/ClipsApp';
import { MarketApp } from '../apps/market/MarketApp';
import { NewsApp } from '../apps/news/NewsApp';
import { GarageApp } from '../apps/garage/GarageApp';
import { ClockApp } from '../apps/clock/ClockApp';
import { NotesApp } from '../apps/notes/NotesApp';
import { MapsApp } from '../apps/maps/MapsApp';
import { WeatherApp } from '../apps/weather/WeatherApp';
import { WaveChatApp } from '../apps/wavechat/WaveChatApp';
import { MusicApp } from '../apps/music/MusicApp';
import { YellowPagesApp } from '../apps/yellowpages/YellowPagesApp';
import { CameraApp } from '../apps/camera/CameraApp';
import { APP_BY_ID } from '../../config/apps';
import { isEnvBrowser } from '../../utils/misc';
import { PhoneNotificationBanner } from '../shared/notifications/PhoneNotificationBanner';
import { ControlCenter } from '../shared/control-center/ControlCenter';
import { useNotifications } from '../../store/notifications';
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
    if (route === 'contacts') return <ContactsApp />;
    if (route.startsWith('messages')) return <MessagesApp />;
    if (route === 'calls') return <CallsApp />;
    if (route === 'settings') return <SettingsApp />;
    if (route === 'gallery') return <GalleryApp />;
    if (route === 'bank') return <BankApp />;
    if (route === 'wavechat') return <WaveChatApp />;
    if (route === 'music') return <MusicApp />;
    if (route === 'chirp') return <ChirpApp />;
    if (route === 'snap') return <SnapApp />;
    if (route === 'clips') return <ClipsApp />;
    if (route === 'yellowpages') return <YellowPagesApp />;
    if (route === 'market') return <MarketApp />;
    if (route === 'news') return <NewsApp />;
    if (route === 'garage') return <GarageApp />;
    if (route === 'clock') return <ClockApp />;
    if (route === 'notes') return <NotesApp />;
    if (route === 'maps') return <MapsApp />;
    if (route === 'weather') return <WeatherApp />;
    if (route === 'camera') return <CameraApp />;
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
