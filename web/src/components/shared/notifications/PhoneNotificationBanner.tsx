import { Show } from 'solid-js';
import { useNotifications } from '../../../store/notifications';
import styles from './PhoneNotificationBanner.module.scss';

interface Props {
  preview?: boolean;
  onOpenRoute?: (route: string, data?: Record<string, unknown>) => void;
}

export function PhoneNotificationBanner(props: Props) {
  const [notifications, notificationsActions] = useNotifications();

  const openNotification = () => {
    const current = notifications.current;
    if (!current) return;
    if (current.route && props.onOpenRoute) props.onOpenRoute(current.route, current.data || {});
    notificationsActions.dismissCurrent();
  };

  return (
    <Show when={notifications.current}>
      {(notification) => (
        <button
          class={styles.banner}
          classList={{ [styles.preview]: !!props.preview }}
          onClick={openNotification}
        >
          <div class={styles.icon}>{notification().icon || '•'}</div>
          <div class={styles.content}>
            <div class={styles.title}>{notification().title}</div>
            <div class={styles.message}>{notification().message}</div>
          </div>
          <span class={styles.close} onClick={(event) => { event.stopPropagation(); notificationsActions.dismissCurrent(); }}>✕</span>
        </button>
      )}
    </Show>
  );
}
