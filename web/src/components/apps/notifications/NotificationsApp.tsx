import { For, Show, createSignal, onMount, batch } from 'solid-js';
import { AppScaffold } from '../../shared/layout/AppScaffold';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchNui } from '../../../utils/fetchNui';
import { useNotifications } from '../../../store/notifications';
import { usePhone } from '../../../store/phone';
import { APP_BY_ID } from '../../../config/apps';
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

  const loadInbox = async () => {
    setLoading(true);
    setError('');

    const payload = await fetchNui<{ success?: boolean; notifications?: InboxNotification[]; unread?: number; error?: string }>(
      'notificationsGet',
      { limit: 80, offset: 0 },
      { success: true, notifications: [], unread: 0 },
    );

    batch(() => {
      setLoading(false);
      if (!payload?.success) {
        setError(payload?.error || t('notifications.error_load', language()));
        return;
      }
      setNotifications(payload.notifications || []);
      setUnread(Number(payload.unread) || 0);
    });
  };

  const markRead = async (id: number) => {
    const target = notifications().find((entry) => Number(entry.id) === Number(id));
    await fetchNui<{ success?: boolean }>('notificationsMarkRead', { id }, { success: false });
    setNotifications((prev) => prev.map((entry) => (
      Number(entry.id) === Number(id) ? { ...entry, is_read: 1 } : entry
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
    batch(() => {
      setNotifications((prev) => prev.map((entry) => ({ ...entry, is_read: 1 })));
      setUnread(0);
    });
    for (const appId of Array.from(new Set(recentItems().map((entry) => entry.appId)))) {
      notificationsActions.markAppAsRead(appId);
    }
  };

  const relativeTime = (timestamp: number) => {
    const diff = Math.max(0, Math.floor((Date.now() - (Number(timestamp) || Date.now())) / 1000));
    if (diff < 60) return t('time.now', language());
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
    return new Date(Number(timestamp)).toLocaleDateString();
  };

  const appLabel = (appId: string) => appName(appId, appId, language());
  const appIcon = (appId: string) => APP_BY_ID[appId]?.icon || './img/icons_ios/ui-bell.svg';

  onMount(() => {
    void loadInbox();
  });

  return (
    <AppScaffold
      title={t('notifications.inbox', language())}
      onBack={() => router.goBack()}
      headerRight={(
        <button class={styles.markAllBtn} onClick={() => void markAllRead()} disabled={notifications().length === 0 && recentItems().length === 0}>
          {t('notifications.read_all', language())}
        </button>
      )}
    >
      <div class={styles.root}>
        {/* ── Status bar ── */}
        <div class={styles.statusBar}>
          <div class={styles.statusPill}>
            <img src="./img/icons_ios/ui-bell.svg" alt="" class={styles.statusIcon} />
            <strong>{unread()}</strong>
            <span>{t('notifications.unread', language())}</span>
          </div>
          <div class={styles.statusPill}>
            <img src="./img/icons_ios/ui-moon.svg" alt="" class={styles.statusIcon} />
            <strong>{notificationsState.doNotDisturb ? 'ON' : 'OFF'}</strong>
            <span>DND</span>
          </div>
          <button class={styles.refreshBtn} onClick={() => void loadInbox()} disabled={loading()}>
            <img src="./img/icons_ios/ui-shuffle.svg" alt="" class={styles.refreshIcon} classList={{ [styles.spinning]: loading() }} />
          </button>
        </div>

        {/* ── Quick toggles ── */}
        <div class={styles.toggleRow}>
          <button
            class={styles.toggle}
            classList={{ [styles.toggleActive]: notificationsState.doNotDisturb }}
            onClick={() => notificationsActions.setDoNotDisturb(!notificationsState.doNotDisturb)}
          >
            <img src="./img/icons_ios/ui-moon.svg" alt="" class={styles.toggleIcon} />
            <div>
              <strong>{t('settings.dnd', language())}</strong>
              <span>{notificationsState.doNotDisturb ? t('notifications.dnd_on', language()) : t('notifications.dnd_off', language())}</span>
            </div>
          </button>
          <button
            class={styles.toggle}
            classList={{ [styles.toggleActive]: notificationsState.silentMode }}
            onClick={() => notificationsActions.setSilentMode(!notificationsState.silentMode)}
          >
            <img src="./img/icons_ios/ui-bell.svg" alt="" class={styles.toggleIcon} />
            <div>
              <strong>{t('settings.silent', language())}</strong>
              <span>{notificationsState.silentMode ? t('notifications.silent_on', language()) : t('notifications.silent_off', language())}</span>
            </div>
          </button>
        </div>

        {/* ── Recent (in-memory) ── */}
        <Show when={recentItems().length > 0}>
          <section class={styles.section}>
            <h4 class={styles.sectionTitle}>{t('notifications.quick_center', language())}</h4>
            <div class={styles.feed}>
              <For each={recentItems()}>
                {(entry, index) => (
                  <article
                    class={styles.card}
                    style={{ 'animation-delay': `${index() * 30}ms` }}
                    onClick={() => {
                      notificationsActions.markAppAsRead(entry.appId);
                      if (entry.route) {
                        router.navigate(entry.route, entry.data as Record<string, unknown> | undefined);
                      }
                    }}
                  >
                    <div class={styles.cardIcon}>
                      <img src={appIcon(entry.appId)} alt="" />
                    </div>
                    <div class={styles.cardBody}>
                      <div class={styles.cardTop}>
                        <strong>{entry.title}</strong>
                        <span class={styles.cardTime}>{relativeTime(Number(entry.createdAt))}</span>
                      </div>
                      <p>{entry.message}</p>
                      <span class={styles.cardApp}>{appLabel(entry.appId)}</span>
                    </div>
                    <button
                      class={styles.muteBtn}
                      onClick={(e) => { e.stopPropagation(); notificationsActions.toggleMuteApp(entry.appId); }}
                    >
                      {notificationsActions.isAppMuted(entry.appId) ? t('notifications.enable', language()) : t('notifications.mute', language())}
                    </button>
                  </article>
                )}
              </For>
            </div>
          </section>
        </Show>

        {/* ── Error ── */}
        <Show when={error()}>
          <div class={styles.errorBanner}>
            <img src="./img/icons_ios/ui-warning.svg" alt="" />
            <span>{error()}</span>
          </div>
        </Show>

        {/* ── Persistent inbox ── */}
        <section class={styles.section}>
          <h4 class={styles.sectionTitle}>{t('notifications.persistent_inbox', language())}</h4>

          <Show
            when={notifications().length > 0}
            fallback={
              <div class={styles.emptyState}>
                <div class={styles.emptyIcon}>
                  <img src="./img/icons_ios/ui-bell.svg" alt="" />
                </div>
                <strong>{t('notifications.none_saved', language())}</strong>
                <span>{t('notifications.none_saved', language())}</span>
              </div>
            }
          >
            <div class={styles.feed}>
              <For each={notifications()}>
                {(entry, index) => (
                  <article
                    class={styles.card}
                    classList={{ [styles.cardUnread]: Number(entry.is_read) === 0 }}
                    style={{ 'animation-delay': `${index() * 25}ms` }}
                    onClick={() => void markRead(entry.id)}
                  >
                    <div class={styles.cardIcon}>
                      <img src={appIcon(entry.app_id)} alt="" />
                      <Show when={Number(entry.is_read) === 0}>
                        <span class={styles.unreadDot} />
                      </Show>
                    </div>
                    <div class={styles.cardBody}>
                      <div class={styles.cardTop}>
                        <strong>{entry.title}</strong>
                        <span class={styles.cardTime}>{relativeTime(Number(entry.createdAt))}</span>
                      </div>
                      <p>{entry.content}</p>
                      <span class={styles.cardApp}>{appLabel(entry.app_id)}</span>
                    </div>
                    <button
                      class={styles.deleteBtn}
                      onClick={(e) => { e.stopPropagation(); void deleteNotification(entry.id); }}
                    >
                      <img src="./img/icons_ios/ui-trash.svg" alt="" />
                    </button>
                  </article>
                )}
              </For>
            </div>
          </Show>
        </section>
      </div>
    </AppScaffold>
  );
}
