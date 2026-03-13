import { Show, onMount, onCleanup, createSignal, createMemo, createEffect } from 'solid-js';
import { PhoneProvider, ContactsProvider, MessagesProvider, NotificationsProvider, useNotifications, usePhone } from './store';
import { PhoneFrame } from './components/Phone/PhoneFrame';
import { LockScreen } from './components/LockScreen/LockScreen';
import { PhoneSetup } from './components/Setup/PhoneSetup';
import { ContactRequestNotification } from './components/shared/ContactRequest/ContactRequest';
import { PhoneNotificationBanner } from './components/shared/notifications/PhoneNotificationBanner';
import { PhoneAudioController } from './components/system/PhoneAudioController';
import { fetchNui } from './utils/fetchNui';
import { setNuiAuthToken } from './utils/fetchNui';
import { isEnvBrowser } from './utils/misc';
import { setupBrowserMock } from './mock/browserMock';
import { BrowserDevMenu } from './components/dev/BrowserDevMenu';
import { localeTagFromLanguage } from './i18n';
import { setLiveKitRemoteAudioPriority, setLiveKitRemoteAudioVolume } from './utils/livekit';
import { useWindowEvent } from './hooks';
import { emitInternalEvent, useInternalEvent } from './utils/internalEvents';
import './App.scss';

interface MusicNotificationState {
  isPlaying?: boolean;
  isPaused?: boolean;
  title?: string;
  volume?: number;
  distance?: number;
}

function PhoneContent() {
  const [phoneState] = usePhone();
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
      title: detail?.title || 'Aviso',
      message,
      durationMs: 3200,
      priority: 'normal',
    });
  });

  useInternalEvent<{ active?: boolean; listening?: boolean; peerId?: string | null }>('gcphone:nearbyVoiceState', (detail) => {
    const peerId = typeof detail?.peerId === 'string' ? detail.peerId.trim() : '';

    if (!detail?.active || !peerId) {
      setLiveKitRemoteAudioPriority(null);
      setLiveKitRemoteAudioVolume(1);
      return;
    }

    setLiveKitRemoteAudioPriority(peerId, {
      priorityScale: detail.listening ? 1 : 0.7,
      othersScale: detail.listening ? 0.35 : 0.18,
    });
  });

  useInternalEvent<{ active?: boolean; volume?: number }>('gcphone:nearbyVoiceVolume', (detail) => {
    if (!detail?.active) {
      setLiveKitRemoteAudioVolume(1);
      return;
    }

    setLiveKitRemoteAudioVolume(typeof detail.volume === 'number' ? detail.volume : 1);
  });

  onCleanup(() => {
    setLiveKitRemoteAudioPriority(null);
    setLiveKitRemoteAudioVolume(1);
  });

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

  return (
    <div class="gcphone-app" classList={{ [themeClass()]: true }}>
      <Show when={phoneState.visible}>
        <Show when={phoneState.locked} fallback={
          <PhoneFrame>
            <Show when={phoneState.requiresSetup} fallback={
              <>
                <PhoneFrame.Router />
                <ContactRequestNotification />
              </>
            }>
              <PhoneSetup />
            </Show>
          </PhoneFrame>
        }>
          <PhoneFrame>
            <LockScreen />
          </PhoneFrame>
        </Show>
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

  useWindowEvent('message', (event) => {
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

  useWindowEvent('keydown', (event) => {
    if (event.key === 'Escape') {
      fetchNui('closePhone');
    }
  });

  return (
    <PhoneProvider>
      <NotificationsProvider>
        <ContactsProvider>
          <MessagesProvider>
            <PhoneAudioController />
            <PhoneContent />
            <BrowserDevMenu />
          </MessagesProvider>
        </ContactsProvider>
      </NotificationsProvider>
    </PhoneProvider>
  );
}
