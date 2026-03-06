import { For, Show, createEffect, createSignal } from 'solid-js';
import { AppScaffold } from '../../shared/layout/AppScaffold';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchNui } from '../../../utils/fetchNui';
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
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');
  const [notifications, setNotifications] = createSignal<InboxNotification[]>([]);
  const [unread, setUnread] = createSignal(0);

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
    await fetchNui<{ success?: boolean }>('notificationsMarkRead', { id }, { success: false });
    setNotifications((prev) => prev.map((entry) => (
      Number(entry.id) === Number(id)
        ? { ...entry, is_read: 1 }
        : entry
    )));
    setUnread((prev) => Math.max(0, prev - 1));
  };

  const deleteNotification = async (id: number) => {
    await fetchNui<{ success?: boolean }>('notificationsDelete', { id }, { success: false });
    setNotifications((prev) => prev.filter((entry) => Number(entry.id) !== Number(id)));
  };

  const markAllRead = async () => {
    await fetchNui<{ success?: boolean }>('notificationsMarkAllRead', {}, { success: false });
    setNotifications((prev) => prev.map((entry) => ({ ...entry, is_read: 1 })));
    setUnread(0);
  };

  createEffect(() => {
    void loadInbox();
  });

  return (
    <AppScaffold
      title="Inbox"
      onBack={() => router.goBack()}
      headerRight={(
        <button class="ios-action-btn" onClick={() => void markAllRead()} disabled={notifications().length === 0}>
          Leer todo
        </button>
      )}
    >
      <div class={styles.root}>
        <div class={styles.topMeta}>
          <span>No leidas: {unread()}</span>
          <button onClick={() => void loadInbox()} disabled={loading()}>{loading() ? 'Cargando...' : 'Actualizar'}</button>
        </div>

        <Show when={error()}>
          <p class={styles.error}>{error()}</p>
        </Show>

        <Show when={notifications().length > 0} fallback={<p class={styles.empty}>Sin notificaciones guardadas</p>}>
          <For each={notifications()}>
            {(entry) => (
              <div class={styles.item} classList={{ [styles.itemUnread]: Number(entry.is_read) === 0 }}>
                <button class={styles.itemMain} onClick={() => void markRead(entry.id)}>
                  <div class={styles.itemHeader}>
                    <strong>{entry.title}</strong>
                    <small>{new Date(Number(entry.createdAt) || Date.now()).toLocaleString()}</small>
                  </div>
                  <p>{entry.content}</p>
                  <span>{entry.app_id}</span>
                </button>
                <button class={styles.deleteBtn} onClick={() => void deleteNotification(entry.id)}>Eliminar</button>
              </div>
            )}
          </For>
        </Show>
      </div>
    </AppScaffold>
  );
}
