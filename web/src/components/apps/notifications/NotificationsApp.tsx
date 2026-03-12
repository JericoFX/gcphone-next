import { For, Show, createEffect, createSignal } from 'solid-js';
import { AppScaffold } from '../../shared/layout/AppScaffold';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchNui } from '../../../utils/fetchNui';
import { useNotifications } from '../../../store/notifications';
import { usePhone } from '../../../store/phone';
import { appName, t } from '../../../i18n';
import styles from './NotificationsApp.module.scss';

interface InboxNotification {
  id: number;
  app_id: string;
  title: string;
  content: string;
  avatar?: string | null;
  meta?: unknown;
  is_read: number;
  createdAt: number;
}

export function NotificationsApp() {
  const router = useRouter();
  const [phoneState] = usePhone();
  const [notificationsState, notificationsActions] = useNotifications();
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');
  const [notifications, setNotifications] = createSignal<InboxNotification[]>([]);
  const [unread, setUnread] = createSignal(0);
  const language = () => phoneState.settings.language || 'es';
  const recentItems = () => notificationsState.history.slice(0, 8);
  const localUnread = () => Array.from(new Set(recentItems().map((entry) => entry.appId))).reduce((count, appId) => count + notificationsActions.getUnreadCount(appId), 0);

  const loadInbox = async () => {
    setLoading(true);
    setError('');

    const payload = await fetchNui<{ success?: boolean; notifications?: InboxNotification[]; unread?: number; error?: string }>(
      'notificationsGet',
      { limit: 80, offset: 0 },
      { success: true, notifications: [], unread: 0 },
    );

    setLoading(false);
    if (!payload?.success) {
      setError(payload?.error || t('notifications.error_load', language()));
      return;
    }

    setNotifications(payload.notifications || []);
    setUnread(Number(payload.unread) || 0);
  };

  const markRead = async (id: number) => {
    const target = notifications().find((entry) => Number(entry.id) === Number(id));
    await fetchNui<{ success?: boolean }>('notificationsMarkRead', { id }, { success: false });
    setNotifications((prev) => prev.map((entry) => (
      Number(entry.id) === Number(id)
        ? { ...entry, is_read: 1 }
        : entry
    )));
    if (Number(target?.is_read) === 0) {
      setUnread((prev) => Math.max(0, prev - 1));
    }
  };

  const deleteNotification = async (id: number) => {
    await fetchNui<{ success?: boolean }>('notificationsDelete', { id }, { success: false });
    setNotifications((prev) => prev.filter((entry) => Number(entry.id) !== Number(id)));
  };

  const markAllRead = async () => {
    await fetchNui<{ success?: boolean }>('notificationsMarkAllRead', {}, { success: false });
    setNotifications((prev) => prev.map((entry) => ({ ...entry, is_read: 1 })));
    setUnread(0);
    for (const appId of Array.from(new Set(recentItems().map((entry) => entry.appId)))) {
      notificationsActions.markAppAsRead(appId);
    }
  };

  createEffect(() => {
    void loadInbox();
  });

  return (
    <AppScaffold
      title={t('notifications.inbox', language())}
      onBack={() => router.goBack()}
      headerRight={(
        <button class="ios-action-btn" onClick={() => void markAllRead()} disabled={notifications().length === 0}>
          {t('notifications.read_all', language())}
        </button>
      )}
    >
      <div class={styles.root}>
        <div class={styles.topMeta}>
          <span>{t('notifications.inbox', language())}: {unread()} · {t('notifications.center', language())}: {localUnread()}</span>
          <button onClick={() => void loadInbox()} disabled={loading()}>{loading() ? t('state.loading', language()) : t('notifications.refresh', language())}</button>
        </div>

        <div class={styles.quickBar}>
          <button class={styles.quickToggle} classList={{ [styles.quickToggleActive]: notificationsState.doNotDisturb }} onClick={() => notificationsActions.setDoNotDisturb(!notificationsState.doNotDisturb)}>
            {notificationsState.doNotDisturb ? t('notifications.dnd_on', language()) : t('notifications.dnd_off', language())}
          </button>
          <button class={styles.quickToggle} classList={{ [styles.quickToggleActive]: notificationsState.silentMode }} onClick={() => notificationsActions.setSilentMode(!notificationsState.silentMode)}>
            {notificationsState.silentMode ? t('notifications.silent_on', language()) : t('notifications.silent_off', language())}
          </button>
        </div>

        <Show when={recentItems().length > 0}>
          <section class={styles.section}>
            <div class={styles.sectionHeader}>
                <strong>{t('notifications.quick_center', language())}</strong>
                <span>{t('notifications.quick_center_desc', language())}</span>
            </div>
            <For each={recentItems()}>
              {(entry) => (
                <div class={styles.localItem}>
                  <button
                    class={styles.localMain}
                    onClick={() => {
                      notificationsActions.markAppAsRead(entry.appId);
                      if (entry.route) {
                        router.navigate(entry.route, entry.data as Record<string, unknown> | undefined);
                      }
                    }}
                  >
                    <div class={styles.itemHeader}>
                      <strong>{entry.title}</strong>
                      <small>{new Date(Number(entry.createdAt) || Date.now()).toLocaleString()}</small>
                    </div>
                    <p>{entry.message}</p>
                    <span>{appName(entry.appId, entry.appId, language())}</span>
                  </button>
                  <button class={styles.muteBtn} onClick={() => notificationsActions.toggleMuteApp(entry.appId)}>
                    {notificationsActions.isAppMuted(entry.appId) ? t('notifications.enable', language()) : t('notifications.mute', language())}
                  </button>
                </div>
              )}
            </For>
          </section>
        </Show>

        <Show when={error()}>
          <p class={styles.error}>{error()}</p>
        </Show>

        <section class={styles.section}>
          <div class={styles.sectionHeader}>
            <strong>{t('notifications.persistent_inbox', language())}</strong>
            <span>{t('notifications.persistent_inbox_desc', language())}</span>
          </div>
          <Show when={notifications().length > 0} fallback={<p class={styles.empty}>{t('notifications.none_saved', language())}</p>}>
            <For each={notifications()}>
              {(entry) => (
                <div class={styles.item} classList={{ [styles.itemUnread]: Number(entry.is_read) === 0 }}>
                  <button class={styles.itemMain} onClick={() => void markRead(entry.id)}>
                    <div class={styles.itemHeader}>
                      <strong>{entry.title}</strong>
                      <small>{new Date(Number(entry.createdAt) || Date.now()).toLocaleString()}</small>
                    </div>
                    <p>{entry.content}</p>
                    <span>{appName(entry.app_id, entry.app_id, language())}</span>
                  </button>
                  <button class={styles.deleteBtn} onClick={() => void deleteNotification(entry.id)}>{t('action.delete', language())}</button>
                </div>
              )}
            </For>
          </Show>
        </section>
      </div>
    </AppScaffold>
  );
}
