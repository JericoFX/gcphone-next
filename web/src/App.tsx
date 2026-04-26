import { Show, onMount, onCleanup, createSignal, createMemo, createEffect } from 'solid-js';
import { Motion, Presence } from '@motionone/solid';
import { PhoneProvider, ContactsProvider, MessagesProvider, NotificationsProvider, useNotifications, usePhone } from './store';
import { PhoneFrame } from './components/Phone/PhoneFrame';
import { LockScreen } from './components/LockScreen/LockScreen';
import { PhoneSetup } from './components/Setup/PhoneSetup';
import { ContactRequestNotification } from './components/shared/ContactRequest/ContactRequest';
import { PhoneNotificationBanner } from './components/shared/notifications/PhoneNotificationBanner';
import { IncomingShareModal } from './components/shared/ui/IncomingShareModal';
import { PhoneSDKModal } from './components/shared/ui/PhoneSDKModal';
import { PermissionModal } from './components/shared/ui/PermissionModal';
import { SDKProvider } from './store/sdk';
import { PermissionsProvider } from './store/permissions';
import { CarPlayOverlay } from './components/shared/ui/CarPlayOverlay';
import { PhoneAudioController } from './components/system/PhoneAudioController';
import { fetchNui } from './utils/fetchNui';
import { setNuiAuthToken } from './utils/fetchNui';
import { isEnvBrowser } from './utils/misc';
import { setupBrowserMock } from './mock/browserMock';
import { BrowserDevMenu } from './components/dev/BrowserDevMenu';
import { localeTagFromLanguage, t } from './i18n';
import { useWindowEvent } from './hooks';
import { emitInternalEvent, useInternalEvent } from './utils/internalEvents';
import { setupMugshotListener } from './utils/mugshot';
import './App.scss';

setupMugshotListener();

interface MusicNotificationState {
  isPlaying?: boolean;
  isPaused?: boolean;
  title?: string;
  volume?: number;
  distance?: number;
}

function PhoneContent() {
  const [phoneState, phoneActions] = usePhone();
  const [notifications, notificationsActions] = useNotifications();
  const [prefersDark, setPrefersDark] = createSignal(false);

  onMount(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    setPrefersDark(media.matches);

    const handler = (event: MediaQueryListEvent) => setPrefersDark(event.matches);
    media.addEventListener('change', handler);

    onCleanup(() => {
      media.removeEventListener('change', handler);
    });
  });


  useInternalEvent<MusicNotificationState>('musicStateUpdated', (detail) => {
    const safeDetail = detail || {};
    const title = typeof safeDetail.title === 'string' ? safeDetail.title.trim() : '';
    const isPlaying = safeDetail.isPlaying === true;
    const isPaused = safeDetail.isPaused === true;

    window.localStorage.setItem('gcphone:musicSession', JSON.stringify({
      isPlaying,
      isPaused,
      title,
      volume: typeof safeDetail.volume === 'number' ? safeDetail.volume : undefined,
      distance: typeof safeDetail.distance === 'number' ? safeDetail.distance : undefined,
    }));

    if (!isPlaying && !isPaused) {
      notificationsActions.remove('music-now-playing');
      return;
    }

    notificationsActions.receive({
      id: 'music-now-playing',
      appId: 'music',
      title: 'Music',
      message: `${isPaused ? 'Pausado' : 'Reproduciendo'}: ${title || 'Sin musica'}`,
      durationMs: 2800,
      priority: 'normal',
      route: 'music',
    });
  });

  useInternalEvent<{ title?: string; message?: string }>('phone:uiAlert', (detail) => {
    const message = typeof detail?.message === 'string' ? detail.message.trim() : '';
    if (!message) return;

    notificationsActions.receive({
      id: `ui-alert-${Date.now()}`,
      appId: 'system',
      title: detail?.title || t('common.notice', phoneState.settings.language),
      message,
      durationMs: 3200,
      priority: 'normal',
    });
  });

  useInternalEvent('phone:lockPhone', () => {
    phoneActions.lock();
  });

  /* Audio priority/volume now handled by FiveM Mumble voice targets */

  const themeClass = createMemo(() => {
    const theme = phoneState.settings.theme;
    if (theme === 'dark') return 'theme-dark';
    if (theme === 'light') return 'theme-light';
    return prefersDark() ? 'theme-dark' : 'theme-light';
  });

  createEffect(() => {
    const lang = phoneState.settings.language || 'es';
    document.documentElement.lang = localeTagFromLanguage(lang);
    window.localStorage.setItem('gcphone:language', lang);
  });

  const ACCENT_COLORS: Record<string, { tint: string; tintRgb: string; tint2: string }> = {
    blue:   { tint: '#007aff', tintRgb: '0, 122, 255', tint2: '#0a84ff' },
    purple: { tint: '#af52de', tintRgb: '175, 82, 222', tint2: '#bf5af2' },
    pink:   { tint: '#ff2d55', tintRgb: '255, 45, 85', tint2: '#ff375f' },
    red:    { tint: '#ff3b30', tintRgb: '255, 59, 48', tint2: '#ff453a' },
    orange: { tint: '#ff9500', tintRgb: '255, 149, 0', tint2: '#ff9f0a' },
    green:  { tint: '#34c759', tintRgb: '52, 199, 89', tint2: '#30d158' },
    teal:   { tint: '#5ac8fa', tintRgb: '90, 200, 250', tint2: '#64d2ff' },
  };

  const FONT_SCALES: Record<string, string> = {
    small: '0.88',
    default: '1',
    large: '1.12',
    xl: '1.24',
  };

  createEffect(() => {
    const accent = phoneState.settings.accentColor || 'blue';
    const fontSize = phoneState.settings.fontSize || 'default';
    const root = document.querySelector('.gcphone-app') as HTMLElement | null;
    if (!root) return;

    const colors = ACCENT_COLORS[accent] || ACCENT_COLORS.blue;
    root.style.setProperty('--tint', colors.tint);
    root.style.setProperty('--tint-rgb', colors.tintRgb);
    root.style.setProperty('--tint-2', colors.tint2);

    const scale = FONT_SCALES[fontSize] || '1';
    document.documentElement.style.setProperty('--text-scale', scale);
  });

  return (
    <div class="gcphone-app" classList={{ [themeClass()]: true }}>
      <Show when={phoneState.visible}>
        <PhoneFrame router={!phoneState.locked && !phoneState.requiresSetup}>
          <Presence exitBeforeEnter>
            <Show when={phoneState.locked} fallback={
              <Motion.div
                class="phone-system-stage"
                initial={{ opacity: 0, y: 18, scale: 1.018 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -14, scale: 0.986 }}
                transition={{ duration: 0.28, easing: [0.32, 0.72, 0, 1] }}
              >
                <Show when={phoneState.requiresSetup} fallback={
                  <>
                    <ContactRequestNotification />
                    <IncomingShareModal />
                    <PhoneSDKModal />
                    <PermissionModal />
                    <CarPlayOverlay />
                  </>
                }>
                  <PhoneSetup />
                </Show>
              </Motion.div>
            }>
              <Motion.div
                class="phone-system-stage"
                initial={{ opacity: 1, y: 0, scale: 1 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -34, scale: 1.04 }}
                transition={{ duration: 0.24, easing: [0.4, 0, 0.2, 1] }}
              >
                <LockScreen />
              </Motion.div>
            </Show>
          </Presence>
        </PhoneFrame>
      </Show>

      <Show when={!phoneState.visible && notifications.current}>
        <div class="notification-preview-shell" aria-live="polite" aria-atomic="true">
          <div class="notification-preview-phone">
            <div class="notification-preview-screen">
              <div class="notification-preview-banner-wrap">
                <PhoneNotificationBanner preview />
              </div>
            </div>
            <img class="notification-preview-frame" src="./img/phone/frame-clean.svg" alt="frame" />
          </div>
        </div>
      </Show>
    </div>
  );
}

export function App() {
  onMount(() => {
    if (isEnvBrowser()) {
      setupBrowserMock();
    }
  });

  useWindowEvent<MessageEvent>('message', (event) => {
    if (!event.data || typeof event.data !== 'object') return;

    const payload = event.data as {
      action?: string;
      data?: unknown;
      keyUp?: string;
    };

    if (payload.keyUp) {
      emitInternalEvent('phone:keyUp', payload.keyUp);
    }

    if (payload.action) {
      if ((payload.action === 'initPhone' || payload.action === 'showPhone') && payload.data && typeof payload.data === 'object') {
        const token = (payload.data as { nuiAuthToken?: string }).nuiAuthToken;
        setNuiAuthToken(token);
      }
      emitInternalEvent(payload.action, payload.data);
    }

    if (payload.action === 'initPhone') {
      emitInternalEvent('phone:init', payload.data);
    }

    if (payload.action === 'showPhone') {
      emitInternalEvent('phone:show', payload.data);
    }

    if (payload.action === 'hidePhone') {
      emitInternalEvent('phone:hide');
    }
  });

  useWindowEvent<KeyboardEvent>('keydown', (event) => {
    if (event.key === 'Escape') {
      fetchNui('closePhone');
    }
  });

  return (
    <PhoneProvider>
      <NotificationsProvider>
        <ContactsProvider>
          <MessagesProvider>
            <SDKProvider>
              <PermissionsProvider>
                <PhoneAudioController />
                <PhoneContent />
                <BrowserDevMenu />
              </PermissionsProvider>
            </SDKProvider>
          </MessagesProvider>
        </ContactsProvider>
      </NotificationsProvider>
    </PhoneProvider>
  );
}
