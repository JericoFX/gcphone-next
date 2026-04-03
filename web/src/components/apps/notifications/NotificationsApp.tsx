import { For, Show, createSignal, createMemo, onMount, batch } from 'solid-js';
import { AppScaffold } from '../../shared/layout/AppScaffold';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchNui } from '../../../utils/fetchNui';
import { useNotifications } from '../../../store/notifications';
import { SkeletonList } from '../../shared/ui/SkeletonList';
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

interface NotificationGroup {
  appId: string;
  label: string;
  icon: string;
  items: InboxNotification[];
  unreadCount: number;
  latestAt: number;
}

function groupByApp(notifications: InboxNotification[], language: () => string): NotificationGroup[] {
  const map = new Map<string, InboxNotification[]>();

  for (const entry of notifications) {
    const appId = entry.app_id || 'system';
    const list = map.get(appId);
    if (list) {
      list.push(entry);
    } else {
      map.set(appId, [entry]);
    }
  }

  const groups: NotificationGroup[] = [];
  for (const [appId, items] of map) {
    items.sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
    groups.push({
      appId,
      label: appName(appId, appId, language()),
      icon: APP_BY_ID[appId]?.icon || './img/icons_ios/ui-bell.svg',
      items,
      unreadCount: items.filter((entry) => Number(entry.is_read) === 0).length,
      latestAt: Number(items[0]?.createdAt) || 0,
    });
  }

  groups.sort((a, b) => b.latestAt - a.latestAt);
  return groups;
}

export function NotificationsApp() {
  const router = useRouter();
  const [phoneState] = usePhone();
  const [notificationsState, notificationsActions] = useNotifications();
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');
  const [notifications, setNotifications] = createSignal<InboxNotification[]>([]);
  const [unread, setUnread] = createSignal(0);
  const [expandedApp, setExpandedApp] = createSignal<string | null>(null);
  const language = () => phoneState.settings.language || 'es';
  const recentItems = () => notificationsState.history.slice(0, 8);

  const groups = createMemo(() => groupByApp(notifications(), language));

  const recentGroups = createMemo(() => {
    const items = recentItems();
    const map = new Map<string, typeof items>();
    for (const entry of items) {
      const appId = entry.appId || 'system';
      const list = map.get(appId);
      if (list) list.push(entry);
      else map.set(appId, [entry]);
    }
    return Array.from(map.entries()).map(([appId, entries]) => ({
      appId,
      label: appName(appId, appId, language()),
      icon: APP_BY_ID[appId]?.icon || './img/icons_ios/ui-bell.svg',
      items: entries,
    }));
  });

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

  const deleteGroup = async (appId: string) => {
    const groupItems = notifications().filter((entry) => (entry.app_id || 'system') === appId);
    for (const entry of groupItems) {
      await fetchNui<{ success?: boolean }>('notificationsDelete', { id: entry.id }, { success: false });
    }
    setNotifications((prev) => prev.filter((entry) => (entry.app_id || 'system') !== appId));
    setUnread((prev) => Math.max(0, prev - groupItems.filter((e) => Number(e.is_read) === 0).length));
    if (expandedApp() === appId) setExpandedApp(null);
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

  const toggleGroup = (appId: string) => {
    setExpandedApp((prev) => prev === appId ? null : appId);
  };

  const relativeTime = (timestamp: number) => {
    const diff = Math.max(0, Math.floor((Date.now() - (Number(timestamp) || Date.now())) / 1000));
    if (diff < 60) return t('time.now', language());
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
    return new Date(Number(timestamp)).toLocaleDateString();
  };

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
        {/* Status bar */}
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

        {/* Quick toggles */}
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

        {/* Recent (in-memory) grouped */}
        <Show when={recentGroups().length > 0}>
          <section class={styles.section}>
            <h4 class={styles.sectionTitle}>{t('notifications.quick_center', language())}</h4>
            <div class={styles.feed}>
              <For each={recentGroups()}>
                {(group) => (
                  <div class={styles.groupBlock}>
                    <article
                      class={styles.alfaCard}
                      onClick={() => {
                        if (group.items.length === 1) {
                          notificationsActions.markAppAsRead(group.appId);
                          const entry = group.items[0];
                          if (entry.route) router.navigate(entry.route, entry.data as Record<string, unknown> | undefined);
                          return;
                        }
                        toggleGroup(`recent-${group.appId}`);
                      }}
                    >
                      <div class={styles.cardIcon}>
                        <img src={group.icon} alt="" />
                      </div>
                      <div class={styles.cardBody}>
                        <div class={styles.cardTop}>
                          <strong>{group.label}</strong>
                          <Show when={group.items.length > 1}>
                            <span class={styles.groupBadge}>{group.items.length}</span>
                          </Show>
                        </div>
                        <p>{group.items[0].message}</p>
                      </div>
                      <Show when={group.items.length > 1}>
                        <div class={styles.expandArrow} classList={{ [styles.expandArrowOpen]: expandedApp() === `recent-${group.appId}` }}>
                          <img src="./img/icons_ios/ui-chevron-down.svg" alt="" />
                        </div>
                      </Show>
                    </article>
                    <Show when={expandedApp() === `recent-${group.appId}`}>
                      <div class={styles.groupExpanded}>
                        <For each={group.items.slice(1)}>
                          {(entry) => (
                            <article
                              class={styles.card}
                              onClick={() => {
                                notificationsActions.markAppAsRead(entry.appId);
                                if (entry.route) router.navigate(entry.route, entry.data as Record<string, unknown> | undefined);
                              }}
                            >
                              <div class={styles.cardBody}>
                                <div class={styles.cardTop}>
                                  <strong>{entry.title}</strong>
                                  <span class={styles.cardTime}>{relativeTime(Number(entry.createdAt))}</span>
                                </div>
                                <p>{entry.message}</p>
                              </div>
                            </article>
                          )}
                        </For>
                      </div>
                    </Show>
                  </div>
                )}
              </For>
            </div>
          </section>
        </Show>

        {/* Error */}
        <Show when={error()}>
          <div class={styles.errorBanner}>
            <img src="./img/icons_ios/ui-warning.svg" alt="" />
            <span>{error()}</span>
          </div>
        </Show>

        {/* Persistent inbox grouped */}
        <section class={styles.section}>
          <h4 class={styles.sectionTitle}>{t('notifications.persistent_inbox', language())}</h4>

          <Show when={loading()}>
            <SkeletonList rows={4} />
          </Show>

          <Show
            when={!loading() && groups().length > 0}
            fallback={
              <div class={styles.emptyState}>
                <div class={styles.emptyIcon}>
                  <img src="./img/icons_ios/ui-bell.svg" alt="" />
                </div>
                <strong>{t('notifications.none_saved', language())}</strong>
              </div>
            }
          >
            <div class={styles.feed}>
              <For each={groups()}>
                {(group) => (
                  <div class={styles.groupBlock}>
                    {/* Alfa card — the latest notification in the group */}
                    <article
                      class={styles.alfaCard}
                      classList={{ [styles.cardUnread]: group.unreadCount > 0 }}
                      onClick={() => {
                        if (group.items.length === 1) {
                          void markRead(group.items[0].id);
                          return;
                        }
                        toggleGroup(group.appId);
                      }}
                    >
                      <div class={styles.cardIcon}>
                        <img src={group.icon} alt="" />
                        <Show when={group.unreadCount > 0}>
                          <span class={styles.unreadDot} />
                        </Show>
                      </div>
                      <div class={styles.cardBody}>
                        <div class={styles.cardTop}>
                          <strong>{group.label}</strong>
                          <Show when={group.items.length > 1}>
                            <span class={styles.groupBadge}>{group.items.length}</span>
                          </Show>
                          <span class={styles.cardTime}>{relativeTime(group.latestAt)}</span>
                        </div>
                        <p>{group.items[0].content}</p>
                      </div>
                      <div class={styles.alfaActions}>
                        <Show when={group.items.length > 1}>
                          <div class={styles.expandArrow} classList={{ [styles.expandArrowOpen]: expandedApp() === group.appId }}>
                            <img src="./img/icons_ios/ui-chevron-down.svg" alt="" />
                          </div>
                        </Show>
                        <button
                          class={styles.deleteBtn}
                          onClick={(e) => { e.stopPropagation(); void deleteGroup(group.appId); }}
                        >
                          <img src="./img/icons_ios/ui-trash.svg" alt="" />
                        </button>
                      </div>
                    </article>

                    {/* Expanded children */}
                    <Show when={expandedApp() === group.appId}>
                      <div class={styles.groupExpanded}>
                        <For each={group.items.slice(1)}>
                          {(entry) => (
                            <article
                              class={styles.card}
                              classList={{ [styles.cardUnread]: Number(entry.is_read) === 0 }}
                              onClick={() => void markRead(entry.id)}
                            >
                              <div class={styles.cardBody}>
                                <div class={styles.cardTop}>
                                  <strong>{entry.title}</strong>
                                  <span class={styles.cardTime}>{relativeTime(Number(entry.createdAt))}</span>
                                </div>
                                <p>{entry.content}</p>
                              </div>
                            </article>
                          )}
                        </For>
                      </div>
                    </Show>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </section>
      </div>
    </AppScaffold>
  );
}
