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
  let swapTimerA: number | undefined;
  let swapTimerB: number | undefined;

  const clearSwapTimers = () => {
    if (swapTimerA) { window.clearTimeout(swapTimerA); swapTimerA = undefined; }
    if (swapTimerB) { window.clearTimeout(swapTimerB); swapTimerB = undefined; }
  };

  createEffect(() => {
    const current = notifications.current;
    const currentId = current?.id;
    const visible = displayed();

    clearSwapTimers();

    if (!currentId) {
      if (visible) {
        setPhase('exit');
        swapTimerA = window.setTimeout(() => {
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
      swapTimerA = window.setTimeout(() => setPhase('idle'), 240);
    } else if (visible.id !== currentId) {
      setPhase('exit');
      swapTimerA = window.setTimeout(() => {
        setDisplayed(current);
        setPhase('enter');
        swapTimerB = window.setTimeout(() => setPhase('idle'), 240);
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

  onCleanup(() => clearSwapTimers());

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
                aria-label={t('control.close', getStoredLanguage())}
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
