import { For, Show, createEffect, createSignal } from 'solid-js';
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

  const formatTime = (timestamp: number) => new Date(Number(timestamp) || Date.now()).toLocaleString();

  const appLabel = (appId: string) => appName(appId, appId, language());

  const appIcon = (appId: string) => APP_BY_ID[appId]?.icon || './img/icons_ios/ui-list.svg';

  createEffect(() => {
    void loadInbox();
  });

  return (
    <AppScaffold
      title={t('notifications.inbox', language())}
      onBack={() => router.goBack()}
      headerRight={(
        <button class="ios-action-btn" onClick={() => void markAllRead()} disabled={notifications().length === 0 && recentItems().length === 0}>
          {t('notifications.read_all', language())}
        </button>
      )}
    >
      <div class={styles.root}>
        <section class={`ios-card ${styles.summaryCard}`}>
          <div class={styles.summaryMain}>
            <div>
              <span class={styles.eyebrow}>{t('notifications.inbox', language()).toUpperCase()}</span>
              <h3>{unread()} {t('notifications.unread', language())}</h3>
            </div>
            <button class="ios-btn" onClick={() => void loadInbox()} disabled={loading()}>
              {loading() ? t('state.loading', language()) : t('notifications.refresh', language())}
            </button>
          </div>
          <div class={styles.summaryChips}>
            <span class={`ios-chip ${styles.summaryChip}`}>{t('notifications.inbox', language())} {unread()}</span>
            <span class={`ios-chip ${styles.summaryChip}`}>{t('notifications.center', language())} {localUnread()}</span>
          </div>
        </section>

        <section class={`ios-card ${styles.quickCard}`}>
          <div class={styles.sectionHeader}>
            <div>
              <span class={styles.eyebrow}>{t('notifications.quick_center', language()).toUpperCase()}</span>
              <strong>{t('notifications.quick_center_desc', language())}</strong>
            </div>
            <span>{t('notifications.center', language())}</span>
          </div>

          <div class={styles.quickBar}>
            <button class={styles.quickToggle} classList={{ [styles.quickToggleActive]: notificationsState.doNotDisturb }} onClick={() => notificationsActions.setDoNotDisturb(!notificationsState.doNotDisturb)}>
              <span>{t('settings.dnd', language())}</span>
              <strong>{notificationsState.doNotDisturb ? t('notifications.dnd_on', language()) : t('notifications.dnd_off', language())}</strong>
            </button>
            <button class={styles.quickToggle} classList={{ [styles.quickToggleActive]: notificationsState.silentMode }} onClick={() => notificationsActions.setSilentMode(!notificationsState.silentMode)}>
              <span>{t('settings.silent', language())}</span>
              <strong>{notificationsState.silentMode ? t('notifications.silent_on', language()) : t('notifications.silent_off', language())}</strong>
            </button>
          </div>
        </section>

        <Show when={recentItems().length > 0}>
          <section class={styles.section}>
            <div class={styles.sectionHeader}>
              <div>
                <span class={styles.eyebrow}>{t('notifications.quick_center', language()).toUpperCase()}</span>
                <strong>{t('notifications.quick_center_desc', language())}</strong>
              </div>
              <span>{t('notifications.center', language())}</span>
            </div>

            <div class={styles.feed}>
              <For each={recentItems()}>
                {(entry) => (
                  <article class={`ios-card ${styles.itemCard}`}>
                    <button
                      class={styles.itemMain}
                      onClick={() => {
                        notificationsActions.markAppAsRead(entry.appId);
                        if (entry.route) {
                          router.navigate(entry.route, entry.data as Record<string, unknown> | undefined);
                        }
                      }}
                    >
                      <div class={styles.itemLead}>
                        <div class={styles.iconWrap}>
                          <img src={appIcon(entry.appId)} alt="" draggable={false} />
                        </div>
                        <div class={styles.itemText}>
                          <div class={styles.itemHeader}>
                            <strong>{entry.title}</strong>
                            <small>{formatTime(Number(entry.createdAt))}</small>
                          </div>
                          <p>{entry.message}</p>
                          <span class={styles.appMeta}>{appLabel(entry.appId)}</span>
                        </div>
                      </div>
                    </button>
                    <button class="ios-btn" onClick={() => notificationsActions.toggleMuteApp(entry.appId)}>
                      {notificationsActions.isAppMuted(entry.appId) ? t('notifications.enable', language()) : t('notifications.mute', language())}
                    </button>
                  </article>
                )}
              </For>
            </div>
          </section>
        </Show>

        <Show when={error()}>
          <p class={styles.error}>{error()}</p>
        </Show>

        <section class={styles.section}>
          <div class={styles.sectionHeader}>
            <div>
              <span class={styles.eyebrow}>{t('notifications.persistent_inbox', language()).toUpperCase()}</span>
              <strong>{t('notifications.persistent_inbox_desc', language())}</strong>
            </div>
            <span>{t('notifications.inbox', language())}</span>
          </div>

          <Show when={notifications().length > 0} fallback={<p class={styles.empty}>{t('notifications.none_saved', language())}</p>}>
            <div class={styles.feed}>
              <For each={notifications()}>
                {(entry) => (
                  <article class={`ios-card ${styles.itemCard}`} classList={{ [styles.itemUnread]: Number(entry.is_read) === 0 }}>
                    <button class={styles.itemMain} onClick={() => void markRead(entry.id)}>
                      <div class={styles.itemLead}>
                        <div class={styles.iconWrap}>
                          <img src={appIcon(entry.app_id)} alt="" draggable={false} />
                        </div>
                        <div class={styles.itemText}>
                          <div class={styles.itemHeader}>
                            <strong>{entry.title}</strong>
                            <small>{formatTime(Number(entry.createdAt))}</small>
                          </div>
                          <p>{entry.content}</p>
                          <span class={styles.appMeta}>{appLabel(entry.app_id)}</span>
                        </div>
                      </div>
                    </button>
                    <button class="ios-btn ios-btn-danger" onClick={() => void deleteNotification(entry.id)}>{t('action.delete', language())}</button>
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
