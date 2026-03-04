import { Show, createEffect, createSignal } from 'solid-js';
import { useNotifications } from '../../../store/notifications';
import styles from './PhoneNotificationBanner.module.scss';

interface Props {
  preview?: boolean;
  onOpenRoute?: (route: string, data?: Record<string, unknown>) => void;
}

export function PhoneNotificationBanner(props: Props) {
  const [notifications, notificationsActions] = useNotifications();
  const [peekOpen, setPeekOpen] = createSignal(false);

  createEffect(() => {
    const currentId = notifications.current?.id;
    if (!currentId) {
      setPeekOpen(false);
      return;
    }

    if (props.preview) {
      setPeekOpen(true);
      return;
    }

    setPeekOpen(true);
    const timer = window.setTimeout(() => setPeekOpen(false), 2200);
    return () => window.clearTimeout(timer);
  });

  const openNotification = () => {
    const current = notifications.current;
    if (!current) return;
    if (current.route && props.onOpenRoute) props.onOpenRoute(current.route, current.data || {});
    notificationsActions.dismissCurrent();
    setPeekOpen(false);
  };

  return (
    <Show when={notifications.current}>
      {(notification) => (
        <div class={styles.stack}>
          <button
            class={styles.pulseLine}
            classList={{ [styles.preview]: !!props.preview }}
            onClick={() => setPeekOpen((value) => !value)}
            aria-label="Abrir notificacion"
          />
          <Show when={peekOpen() || !!props.preview}>
            <button class={styles.peekCard} classList={{ [styles.preview]: !!props.preview }} onClick={openNotification}>
              <div class={styles.icon}>{notification().icon || '•'}</div>
              <div class={styles.content}>
                <div class={styles.title}>{notification().title}</div>
                <div class={styles.message}>{notification().message}</div>
              </div>
              <span
                class={styles.close}
                onClick={(event) => {
                  event.stopPropagation();
                  notificationsActions.dismissCurrent();
                  setPeekOpen(false);
                }}
              >
                ✕
              </span>
            </button>
          </Show>
        </div>
      )}
    </Show>
  );
}
