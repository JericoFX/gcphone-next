import { Show, onMount, onCleanup, createSignal, createMemo, createEffect } from 'solid-js';
import { PhoneProvider, ContactsProvider, MessagesProvider, NotificationsProvider, useNotifications, usePhone } from './store';
import { PhoneFrame } from './components/Phone/PhoneFrame';
import { LockScreen } from './components/LockScreen/LockScreen';
import { PhoneSetup } from './components/Setup/PhoneSetup';
import { ContactRequestNotification } from './components/shared/ContactRequest/ContactRequest';
import { PhoneNotificationBanner } from './components/shared/notifications/PhoneNotificationBanner';
import { fetchNui } from './utils/fetchNui';
import { setNuiAuthToken } from './utils/fetchNui';
import { isEnvBrowser } from './utils/misc';
import { setupBrowserMock } from './mock/browserMock';
import { localeTagFromLanguage } from './i18n';
import './App.scss';

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


  onMount(() => {
    const onUiAlert = (event: Event) => {
      const detail = (event as CustomEvent<{ title?: string; message?: string }>).detail;
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
    };

    window.addEventListener('phone:uiAlert', onUiAlert as EventListener);

    onCleanup(() => {
      window.removeEventListener('phone:uiAlert', onUiAlert as EventListener);
    });
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
          <Show when={phoneState.requiresSetup} fallback={
            <PhoneFrame>
              <PhoneFrame.Router />
              <ContactRequestNotification />
            </PhoneFrame>
          }>
            <PhoneSetup />
          </Show>
        }>
          <LockScreen />
        </Show>
      </Show>

      <Show when={!phoneState.visible && notifications.current}>
        <div class="notification-preview-shell">
          <div class="notification-preview-top">
            <PhoneNotificationBanner preview />
          </div>
        </div>
      </Show>
    </div>
  );
}

export function App() {
  onMount(() => {
    const handleNuiMessage = (event: MessageEvent) => {
      const payload = event.data as {
        action?: string;
        data?: unknown;
        keyUp?: string;
      };

      if (payload.keyUp) {
        window.dispatchEvent(new CustomEvent('phone:keyUp', { detail: payload.keyUp }));
      }

      if (payload.action) {
        if ((payload.action === 'initPhone' || payload.action === 'showPhone') && payload.data && typeof payload.data === 'object') {
          const token = (payload.data as { nuiAuthToken?: string }).nuiAuthToken;
          setNuiAuthToken(token);
        }
        window.dispatchEvent(new CustomEvent(payload.action, { detail: payload.data }));
      }

      if (payload.action === 'initPhone') {
        window.dispatchEvent(new CustomEvent('phone:init', { detail: payload.data }));
      }

      if (payload.action === 'showPhone') {
        window.dispatchEvent(new CustomEvent('phone:show', { detail: payload.data }));
      }

      if (payload.action === 'hidePhone') {
        window.dispatchEvent(new CustomEvent('phone:hide'));
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        fetchNui('closePhone');
      }
    };

    window.addEventListener('message', handleNuiMessage);
    window.addEventListener('keydown', handleEscape);

    if (isEnvBrowser()) {
      setupBrowserMock();
    }

    onCleanup(() => {
      window.removeEventListener('message', handleNuiMessage);
      window.removeEventListener('keydown', handleEscape);
    });
  });

  return (
    <PhoneProvider>
      <NotificationsProvider>
        <ContactsProvider>
          <MessagesProvider>
            <PhoneContent />
          </MessagesProvider>
        </ContactsProvider>
      </NotificationsProvider>
    </PhoneProvider>
  );
}
