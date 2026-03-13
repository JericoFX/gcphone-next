import { Show, createEffect, createSignal, onCleanup, createUniqueId } from 'solid-js';
import type { PhoneNotification } from '../../../types';
import { useNotifications } from '../../../store/notifications';
import { getStoredLanguage, t } from '../../../i18n';
import styles from './PhoneNotificationBanner.module.scss';

const isAssetIcon = (icon?: string) => !!icon && /\.(svg|png|webp|jpg|jpeg)$/i.test(icon);

interface Props {
  preview?: boolean;
  onOpenRoute?: (route: string, data?: Record<string, unknown>) => void;
}

export function PhoneNotificationBanner(props: Props) {
  const [notifications, notificationsActions] = useNotifications();
  const [peekOpen, setPeekOpen] = createSignal(false);
  const [displayed, setDisplayed] = createSignal<PhoneNotification | null>(null);
  const [phase, setPhase] = createSignal<'idle' | 'enter' | 'exit'>('idle');
  const titleId = createUniqueId();
  const messageId = createUniqueId();
  let swapTimer: number | undefined;

  const clearSwapTimer = () => {
    if (swapTimer) {
      window.clearTimeout(swapTimer);
      swapTimer = undefined;
    }
  };

  createEffect(() => {
    const current = notifications.current;
    const currentId = current?.id;
    const visible = displayed();

    clearSwapTimer();

    if (!currentId) {
      if (visible) {
        setPhase('exit');
        swapTimer = window.setTimeout(() => {
          setDisplayed(null);
          setPhase('idle');
        }, 220);
      }
      setPeekOpen(false);
      return;
    }

    if (!visible) {
      setDisplayed(current);
      setPhase('enter');
      swapTimer = window.setTimeout(() => setPhase('idle'), 240);
    } else if (visible.id !== currentId) {
      setPhase('exit');
      swapTimer = window.setTimeout(() => {
        setDisplayed(current);
        setPhase('enter');
        swapTimer = window.setTimeout(() => setPhase('idle'), 240);
      }, 220);
    }

    if (props.preview) {
      setPeekOpen(true);
      return;
    }

    setPeekOpen(true);
    const timer = window.setTimeout(() => setPeekOpen(false), 2200);
    return () => window.clearTimeout(timer);
  });

  onCleanup(() => clearSwapTimer());

  const openNotification = () => {
    const current = displayed();
    if (!current) return;
    if (current.route && props.onOpenRoute) props.onOpenRoute(current.route, current.data || {});
    notificationsActions.dismissCurrent();
    setPeekOpen(false);
  };

  return (
    <Show when={displayed()}>
      {(notification) => (
        <div class={styles.stack}>
          <button
            class={styles.pulseLine}
            classList={{ [styles.preview]: !!props.preview }}
            type="button"
            onClick={() => setPeekOpen((value) => !value)}
            aria-label={t('notify.open', getStoredLanguage())}
          />
          <Show when={peekOpen() || !!props.preview}>
            <div
              class={styles.peekCard}
              classList={{ [styles.preview]: !!props.preview, [styles.enter]: phase() === 'enter', [styles.exit]: phase() === 'exit' }}
              role="status"
              aria-live="polite"
              aria-atomic="true"
              aria-labelledby={titleId}
              aria-describedby={messageId}
            >
              <div class={styles.icon}>
                <Show when={isAssetIcon(notification().icon)} fallback={notification().icon || '•'}>
                  <img src={notification().icon} alt="" draggable={false} />
                </Show>
              </div>
              <button class={styles.contentButton} type="button" onClick={openNotification}>
                <div class={styles.content}>
                  <div id={titleId} class={styles.title}>{notification().title}</div>
                  <div id={messageId} class={styles.message}>{notification().message}</div>
                </div>
              </button>
              <button
                class={styles.close}
                type="button"
                aria-label="Descartar notificacion"
                onClick={(event) => {
                  event.stopPropagation();
                  notificationsActions.dismissCurrent();
                  setPeekOpen(false);
                }}
              >
                <img src="./img/icons_ios/ui-close.svg" alt="" draggable={false} />
              </button>
            </div>
          </Show>
        </div>
      )}
    </Show>
  );
}
