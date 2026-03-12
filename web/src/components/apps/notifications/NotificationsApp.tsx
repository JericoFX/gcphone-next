import { For, Show, createEffect, createSignal } from 'solid-js';
import { AppScaffold } from '../../shared/layout/AppScaffold';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchNui } from '../../../utils/fetchNui';
import { useNotifications } from '../../../store/notifications';
import { usePhone } from '../../../store/phone';
import { appName } from '../../../i18n';
import { APP_BY_ID } from '../../../config/apps';
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
      setError(payload?.error || 'No se pudo cargar el inbox');
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
      title="Inbox"
      onBack={() => router.goBack()}
      headerRight={(
        <button class="ios-action-btn" onClick={() => void markAllRead()} disabled={notifications().length === 0 && recentItems().length === 0}>
          Leer todo
        </button>
      )}
    >
      <div class={styles.root}>
        <section class={`ios-card ${styles.summaryCard}`}>
          <div class={styles.summaryMain}>
            <div>
              <span class={styles.eyebrow}>RESUMEN</span>
              <h3>{unread()} sin leer en inbox</h3>
            </div>
            <button class="ios-btn" onClick={() => void loadInbox()} disabled={loading()}>
              {loading() ? 'Cargando...' : 'Actualizar'}
            </button>
          </div>
          <div class={styles.summaryChips}>
            <span class={`ios-chip ${styles.summaryChip}`}>Inbox {unread()}</span>
            <span class={`ios-chip ${styles.summaryChip}`}>Centro {localUnread()}</span>
          </div>
        </section>

        <section class={`ios-card ${styles.quickCard}`}>
          <div class={styles.sectionHeader}>
            <div>
              <span class={styles.eyebrow}>ATAJOS</span>
              <strong>Ajustes rapidos</strong>
            </div>
            <span>Control inmediato del telefono</span>
          </div>

          <div class={styles.quickBar}>
            <button class={styles.quickToggle} classList={{ [styles.quickToggleActive]: notificationsState.doNotDisturb }} onClick={() => notificationsActions.setDoNotDisturb(!notificationsState.doNotDisturb)}>
              <span>No molestar</span>
              <strong>{notificationsState.doNotDisturb ? 'Activo' : 'Apagado'}</strong>
            </button>
            <button class={styles.quickToggle} classList={{ [styles.quickToggleActive]: notificationsState.silentMode }} onClick={() => notificationsActions.setSilentMode(!notificationsState.silentMode)}>
              <span>Silencio</span>
              <strong>{notificationsState.silentMode ? 'Activo' : 'Apagado'}</strong>
            </button>
          </div>
        </section>

        <Show when={recentItems().length > 0}>
          <section class={styles.section}>
            <div class={styles.sectionHeader}>
              <div>
                <span class={styles.eyebrow}>CENTRO RAPIDO</span>
                <strong>Actividad reciente</strong>
              </div>
              <span>Banner local por app</span>
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
                      {notificationsActions.isAppMuted(entry.appId) ? 'Activar' : 'Silenciar'}
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
              <span class={styles.eyebrow}>INBOX PERSISTENTE</span>
              <strong>Historial guardado</strong>
            </div>
            <span>Guardado por el servidor</span>
          </div>

          <Show when={notifications().length > 0} fallback={<p class={styles.empty}>Sin notificaciones guardadas</p>}>
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
                    <button class="ios-btn ios-btn-danger" onClick={() => void deleteNotification(entry.id)}>Eliminar</button>
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
