import {
  For,
  ParentComponent,
  Show,
  createContext,
  createMemo,
  createSignal,
  useContext,
  lazy,
  Suspense,
  createUniqueId,
  createEffect,
  onCleanup,
  onMount,
} from 'solid-js';
import type { JSX } from 'solid-js';
import { usePhone, usePhoneState } from '../../store/phone';
import { HomeScreen } from '../apps/home/HomeScreen';
import { AppPlaceholder } from '../shared/ui/AppPlaceholder';
import { PhoneNotificationBanner } from '../shared/notifications/PhoneNotificationBanner';
import { ControlCenter } from '../shared/control-center/ControlCenter';
import { DynamicIsland } from '../shared/DynamicIsland/DynamicIsland';
import { useNotifications } from '../../store/notifications';
import { APP_BY_ID } from '../../config/apps';
import { appName, t } from '../../i18n';
import { isEnvBrowser } from '../../utils/misc';
import { useWindowEvent } from '../../hooks';
import { useInternalEvent, emitInternalEvent } from '../../utils/internalEvents';
import { LiveActivityProvider } from '../../store/liveActivity';
import styles from './PhoneFrame.module.scss';

type AppRoute = string;

const PHONE_CASE_COLORS: Record<string, { body: string; border: string; inner: string }> = {
  default:  { body: '#1C1C1E', border: '#0E1420', inner: '#3A465A' },
  silver:   { body: '#C0C0C0', border: '#8A8A8A', inner: '#D8D8D8' },
  gold:     { body: '#C5A55A', border: '#8B7340', inner: '#E8D48B' },
  rosegold: { body: '#B76E79', border: '#8A4F58', inner: '#E8B4B8' },
  midnight: { body: '#0A0A0F', border: '#000000', inner: '#1A1A2E' },
  red:      { body: '#C0272D', border: '#7A1A1E', inner: '#E04850' },
  blue:     { body: '#1A4B8C', border: '#0E2E5A', inner: '#3A6FB0' },
  green:    { body: '#2D6A4F', border: '#1A4030', inner: '#4A9A70' },
};

function phoneCaseColors(caseId?: string) {
  return PHONE_CASE_COLORS[caseId || 'default'] || PHONE_CASE_COLORS.default;
}

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
  calls: lazy(() =>
    import('../apps/calls/CallsApp').then((m) => ({ default: m.CallsApp })),
  ),
  contacts: lazy(() =>
    import('../apps/contacts/ContactsApp').then((m) => ({
      default: m.ContactsApp,
    })),
  ),
  messages: lazy(() =>
    import('../apps/messages/MessagesApp').then((m) => ({
      default: m.MessagesApp,
    })),
  ),
  mail: lazy(() =>
    import('../apps/mail/MailApp').then((m) => ({ default: m.MailApp })),
  ),
  notifications: lazy(() =>
    import('../apps/notifications/NotificationsApp').then((m) => ({
      default: m.NotificationsApp,
    })),
  ),
  settings: lazy(() =>
    import('../apps/settings/SettingsApp').then((m) => ({
      default: m.SettingsApp,
    })),
  ),
  bank: lazy(() =>
    import('../apps/bank/BankApp').then((m) => ({ default: m.BankApp })),
  ),
  wallet: lazy(() =>
    import('../apps/wallet/WalletApp').then((m) => ({ default: m.WalletApp })),
  ),
  documents: lazy(() =>
    import('../apps/documents/DocumentsApp').then((m) => ({
      default: m.DocumentsApp,
    })),
  ),
  appstore: lazy(() =>
    import('../apps/appstore/AppStoreApp').then((m) => ({
      default: m.AppStoreApp,
    })),
  ),
  gallery: lazy(() =>
    import('../apps/gallery/GalleryApp').then((m) => ({
      default: m.GalleryApp,
    })),
  ),
  chirp: lazy(() =>
    import('../apps/chirp/ChirpApp').then((m) => ({ default: m.ChirpApp })),
  ),
  snap: lazy(() =>
    import('../apps/snap/SnapApp').then((m) => ({ default: m.SnapApp })),
  ),
  clips: lazy(() =>
    import('../apps/clips/ClipsApp').then((m) => ({ default: m.ClipsApp })),
  ),
  darkrooms: lazy(() =>
    import('../apps/darkrooms/DarkRoomsApp').then((m) => ({
      default: m.DarkRoomsApp,
    })),
  ),
  // market: lazy(() => import('../apps/market/MarketApp').then(m => ({ default: m.MarketApp }))),
  news: lazy(() =>
    import('../apps/news/NewsApp').then((m) => ({ default: m.NewsApp })),
  ),
  garage: lazy(() =>
    import('../apps/garage/GarageApp').then((m) => ({ default: m.GarageApp })),
  ),
  clock: lazy(() =>
    import('../apps/clock/ClockApp').then((m) => ({ default: m.ClockApp })),
  ),
  notes: lazy(() =>
    import('../apps/notes/NotesApp').then((m) => ({ default: m.NotesApp })),
  ),
  maps: lazy(() =>
    import('../apps/maps/MapsApp').then((m) => ({ default: m.MapsApp })),
  ),
  weather: lazy(() =>
    import('../apps/weather/WeatherApp').then((m) => ({
      default: m.WeatherApp,
    })),
  ),
  wavechat: lazy(() =>
    import('../apps/wavechat/WaveChatApp').then((m) => ({
      default: m.WaveChatApp,
    })),
  ),
  music: lazy(() =>
    import('../apps/music/MusicApp').then((m) => ({ default: m.MusicApp })),
  ),
  yellowpages: lazy(() =>
    import('../apps/yellowpages/YellowPagesApp').then((m) => ({
      default: m.YellowPagesApp,
    })),
  ),
  camera: lazy(() =>
    import('../apps/camera/CameraApp').then((m) => ({ default: m.CameraApp })),
  ),
  services: lazy(() =>
    import('../apps/services/ServicesApp').then((m) => ({
      default: m.ServicesApp,
    })),
  ),
  radio: lazy(() =>
    import('../apps/radio/RadioApp').then((m) => ({ default: m.RadioApp })),
  ),
  matchmylove: lazy(() =>
    import('../apps/matchmylove/MatchMyLoveApp').then((m) => ({
      default: m.MatchMyLoveApp,
    })),
  ),
  cityride: lazy(() =>
    import('../apps/cityride/CityRideApp').then((m) => ({
      default: m.CityRideApp,
    })),
  ),
};

function PhoneCaseSvg(props: { caseId?: string }) {
  const c = () => phoneCaseColors(props.caseId);
  return (
    <svg class={styles.phoneFrame} width="350" height="766" viewBox="0 0 350 766" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <mask id="screen-hole">
          <rect width="350" height="766" fill="white"/>
          <rect x="7" y="7" width="336" height="752" rx="34" fill="black"/>
        </mask>
      </defs>
      <rect width="350" height="766" rx="39" fill={c().body} mask="url(#screen-hole)"/>
      <rect x="1" y="1" width="348" height="764" rx="38" stroke={c().border} stroke-width="2"/>
      <rect x="7" y="7" width="336" height="752" rx="34" stroke={c().inner} stroke-width="1.5"/>
    </svg>
  );
}

export const PhoneFrame: ParentComponent & { Router: () => JSX.Element } = (
  props,
) => {
  const [phoneState] = usePhone();
  const [notifications] = useNotifications();
  const browserMode = isEnvBrowser();

  const [history, setHistory] = createSignal<AppRoute[]>(['home']);
  const [openApps, setOpenApps] = createSignal<AppRoute[]>(['home']);
  const [params, setParams] = createSignal<Record<string, unknown>>({});
  const [direction, setDirection] = createSignal<'forward' | 'back'>('forward');
  const [multitaskOpen, setMultitaskOpen] = createSignal(false);
  const [dialogOpen, setDialogOpen] = createSignal(false);
  const [dialogType, setDialogType] = createSignal<'prompt' | 'confirm'>(
    'confirm',
  );
  const [dialogTitle, setDialogTitle] = createSignal('');
  const [dialogMessage, setDialogMessage] = createSignal('');
  const [dialogInput, setDialogInput] = createSignal('');
  const [dialogPlaceholder, setDialogPlaceholder] = createSignal('');
  let dialogResolve: ((value: unknown) => void) | null = null;
  const dialogTitleId = createUniqueId();
  const dialogMessageId = createUniqueId();
  const multitaskTitleId = createUniqueId();
  const currentLanguage = () => phoneState.settings.language || 'es';

  const currentRoute = () => {
    const stack = history();
    return stack[stack.length - 1] || 'home';
  };

  const navigate = (route: AppRoute, nextParams?: Record<string, unknown>) => {
    const appRoute = normalizeRoute(route);
    setDirection('forward');
    setHistory((stack) => [...stack, appRoute]);
    setOpenApps((apps) =>
      apps.includes(appRoute) ? apps : [...apps, appRoute],
    );
    setParams(nextParams || {});
  };

  const goBack = () => {
    setDirection('back');
    setHistory((stack) => (stack.length > 1 ? stack.slice(0, -1) : stack));
  };

  const closeApp = (route: AppRoute) => {
    const appRoute = normalizeRoute(route);
    if (appRoute === 'home') return;

    emitInternalEvent('phone:appForceClose', { route: appRoute });

    setOpenApps((apps) => apps.filter((item) => item !== appRoute));
    setHistory((stack) => {
      const filtered = stack.filter((item) => item !== appRoute);
      return filtered.length > 0 ? filtered : ['home'];
    });
  };

  const recentRoutes = createMemo(() => {
    return openApps()
      .filter((route) => route !== 'home')
      .slice(-5)
      .reverse();
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

  useInternalEvent<{ route: string; data?: Record<string, unknown> }>(
    'phone:openRoute',
    (detail) => {
      if (!detail?.route) return;
      navigate(detail.route, detail.data || {});
    },
  );

  useInternalEvent<{
    type?: 'prompt' | 'confirm';
    title?: string;
    message?: string;
    placeholder?: string;
    defaultValue?: string;
    resolve?: (value: unknown) => void;
  }>('phone:uiDialogRequest', (detail) => {
    if (!detail || typeof detail.resolve !== 'function' || !detail.message)
      return;

    dialogResolve = detail.resolve;
    setDialogType(detail.type === 'prompt' ? 'prompt' : 'confirm');
    setDialogTitle(
      detail.title || (detail.type === 'prompt' ? t('common.input', currentLanguage()) : t('common.confirm', currentLanguage())),
    );
    setDialogMessage(detail.message);
    setDialogPlaceholder(detail.placeholder || '');
    setDialogInput(detail.defaultValue || '');
    setDialogOpen(true);
  });

  useWindowEvent<KeyboardEvent>('keydown', (event) => {
    if (event.key !== 'Escape') return;

    if (dialogOpen()) {
      closeDialog(dialogType() === 'confirm' ? false : null);
      return;
    }

    if (multitaskOpen()) {
      setMultitaskOpen(false);
    }
  });

  // Theme management
  createEffect(() => {
    const theme = phoneState.settings.theme || 'light';
    const phoneScreen = document.querySelector(`.${styles.phoneScreen}`);
    if (phoneScreen) {
      phoneScreen.classList.remove('theme-light', 'theme-dark');
      if (theme !== 'auto') {
        phoneScreen.classList.add(`theme-${theme}`);
      }
    }
  });

  const closeDialog = (value: unknown) => {
    const resolve = dialogResolve;
    dialogResolve = null;
    setDialogOpen(false);
    if (resolve) resolve(value);
  };

  const phoneScale = () => {
    const s = phoneState.settings.phoneScale;
    return typeof s === 'number' ? Math.max(0.7, Math.min(1, s)) : 1;
  };

  const [viewportScale, setViewportScale] = createSignal(1);
  const updateViewportScale = () => {
    const shellH = 1000;
    const fit = Math.min(1, window.innerHeight / shellH);
    setViewportScale(fit);
  };
  updateViewportScale();
  onMount(() => {
    window.addEventListener('resize', updateViewportScale);
    onCleanup(() => window.removeEventListener('resize', updateViewportScale));
  });

  const effectiveScale = () => Math.min(phoneScale(), viewportScale());

  return (
    <div
      class={styles.phoneWrapper}
      style={{
        ...(browserMode ? { right: '20px', bottom: '20px' } : {}),
        transform: `scale(${effectiveScale()})`,
        'transform-origin': 'bottom right',
      }}
    >
      <div
        class={styles.phoneScreen}
        classList={{ [styles.cameraActive]: currentRoute() === 'camera' }}
        style={{
          'background-image': currentRoute() === 'camera' ? 'none' : `url(${phoneState.settings.wallpaper})`,
          filter: `brightness(${notifications.brightness})`,
        }}
      >
        <RouterContext.Provider value={router}>
          <LiveActivityProvider>
          <ControlCenter />
          <div class={styles.bannerWrap}>
            <PhoneNotificationBanner
              onOpenRoute={(route, data) => router.navigate(route, data)}
            />
          </div>
          <Show when={phoneState.accessMode === 'foreign-readonly'}>
            <div class={styles.foreignStrip}>
              <span>{phoneState.accessOwnerName || 'Telefono ajeno'}</span>
              <span>&nbsp;&mdash;&nbsp;Solo lectura</span>
            </div>
          </Show>
          {props.children}
          <DynamicIsland />

          <Show when={!phoneState.requiresSetup && !phoneState.locked}>
            <button
              class={styles.multitaskBtn}
              type='button'
              onClick={() => setMultitaskOpen(true)}
              data-testid='multitask-btn'
              aria-label='Abrir apps recientes'
              aria-haspopup='dialog'
              aria-expanded={multitaskOpen()}
            >
              ▤
            </button>

            <Show when={multitaskOpen()}>
              <div
                class={styles.multitaskOverlay}
                onClick={() => setMultitaskOpen(false)}
              >
                <div
                  class={styles.multitaskPanel}
                  onClick={(event) => event.stopPropagation()}
                  role='dialog'
                  aria-modal='true'
                  aria-labelledby={multitaskTitleId}
                >
                  <h2 id={multitaskTitleId} class={styles.srOnly}>
                    Apps recientes
                  </h2>
                  <For each={recentRoutes()}>
                    {(route) => {
                      const app = APP_BY_ID[route];
                      const label = appName(
                        route,
                        app?.name || route,
                        currentLanguage(),
                      );
                      return (
                        <div class={styles.multitaskCard}>
                          <button
                            class={styles.multitaskOpen}
                            type='button'
                            onClick={() => {
                              router.navigate(route);
                              setMultitaskOpen(false);
                            }}
                          >
                            <img
                              src={app?.icon || './img/icons_ios/settings.svg'}
                              alt=''
                              aria-hidden='true'
                            />
                            <span>{label}</span>
                          </button>
                          <button
                            class={styles.multitaskClose}
                            type='button'
                            aria-label={`Cerrar ${label}`}
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
          </Show>

          <Show when={dialogOpen()}>
            <div
              class={styles.dialogOverlay}
              onClick={() =>
                closeDialog(dialogType() === 'confirm' ? false : null)
              }
            >
              <div
                class={styles.dialogCard}
                onClick={(event) => event.stopPropagation()}
                role={dialogType() === 'confirm' ? 'alertdialog' : 'dialog'}
                aria-modal='true'
                aria-labelledby={dialogTitleId}
                aria-describedby={dialogMessageId}
              >
                <h3 id={dialogTitleId}>{dialogTitle()}</h3>
                <p id={dialogMessageId}>{dialogMessage()}</p>
                <Show when={dialogType() === 'prompt'}>
                  <input
                    class='ios-input'
                    type='text'
                    value={dialogInput()}
                    placeholder={dialogPlaceholder()}
                    onInput={(event) =>
                      setDialogInput(event.currentTarget.value)
                    }
                  />
                </Show>
                <div class={styles.dialogActions}>
                  <button
                    class='ios-btn'
                    type='button'
                    onClick={() =>
                      closeDialog(dialogType() === 'confirm' ? false : null)
                    }
                  >
                    Cancelar
                  </button>
                  <button
                    class='ios-btn ios-btn-primary'
                    type='button'
                    onClick={() =>
                      closeDialog(
                        dialogType() === 'confirm' ? true : dialogInput(),
                      )
                    }
                  >
                    Aceptar
                  </button>
                </div>
              </div>
            </div>
          </Show>
          </LiveActivityProvider>
        </RouterContext.Provider>
      </div>
      <PhoneCaseSvg caseId={phoneState.settings.phoneCase} />
    </div>
  );
};

function Router() {
  const phoneState = usePhoneState();
  const { currentRoute, direction, openApps } = useRouter();
  const routeLanguage = () => phoneState.settings.language || 'es';
  const [leavingRoute, setLeavingRoute] = createSignal<string | null>(null);
  let lastRoute = currentRoute();

  createEffect(() => {
    const current = currentRoute();
    if (current !== lastRoute) {
      setLeavingRoute(lastRoute);
      lastRoute = current;
      window.setTimeout(() => setLeavingRoute(null), 350);
    }
  });

  const renderRoute = (route: AppRoute) => {
    if (route === 'home') return <HomeScreen />;

    if (!phoneState.enabledApps.includes(route)) return <HomeScreen />;

    const LazyApp = lazyApps[route as keyof typeof lazyApps];

    if (LazyApp) {
      const appLabel = appName(
        route,
        APP_BY_ID[route]?.name || route,
        routeLanguage(),
      );
      return (
        <Suspense fallback={<AppPlaceholder title={appLabel} rows={5} />}>
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
              [styles.routeVisible]: currentRoute() === route || leavingRoute() === route,
              [styles.routeHidden]: currentRoute() !== route && leavingRoute() !== route,
              [styles.routeForward]:
                currentRoute() === route && direction() === 'forward',
              [styles.routeBack]:
                currentRoute() === route && direction() === 'back',
              [styles.routeLeaveForward]:
                leavingRoute() === route && direction() === 'forward',
              [styles.routeLeaveBack]:
                leavingRoute() === route && direction() === 'back',
              [styles.routeTransparent]: route === 'camera',
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
