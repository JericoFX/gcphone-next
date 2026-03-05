import { For, Show, batch, createEffect, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import { usePhone } from '../../store/phone';
import { useNotifications } from '../../store/notifications';
import { formatDate, formatTime, t } from '../../i18n';
import styles from './LockScreen.module.scss';

export function LockScreen() {
  const [phoneState, phoneActions] = usePhone();
  const [notifications, notificationsActions] = useNotifications();
  const [code, setCode] = createSignal('');
  const [error, setError] = createSignal(false);
  const [attempts, setAttempts] = createSignal(0);
  const [currentTime, setCurrentTime] = createSignal(new Date());
  const [showPad, setShowPad] = createSignal(false);
  const language = () => phoneState.settings.language || 'es';

  let timer: number | undefined;

  const topNotifications = createMemo(() => notifications.history.slice(0, 3));

  onMount(() => {
    timer = window.setInterval(() => setCurrentTime(new Date()), 1000);
  });

  onCleanup(() => {
    if (timer) clearInterval(timer);
  });

  const submitUnlock = () => {
    if (phoneActions.unlock(code())) {
      batch(() => {
        setCode('');
        setAttempts(0);
        setShowPad(false);
      });
      return;
    }

    batch(() => {
      setError(true);
      setAttempts((prev) => prev + 1);
      setCode('');
    });
    window.setTimeout(() => setError(false), 520);
  };

  createEffect(() => {
    if (code().length === 4) submitUnlock();
  });

  const handleKeyPress = (num: string) => {
    if (code().length >= 4) return;
    setCode((prev) => prev + num);
  };

  const formatClockTime = (date: Date) => formatTime(date, language(), { hour: '2-digit', minute: '2-digit' });
  const formatClockDate = (date: Date) => formatDate(date, language(), { weekday: 'long', day: 'numeric', month: 'long' });

  const keypadKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

  return (
    <div class={styles.lockScreen}>
      <div class={styles.backgroundGlow} />

      <div class={styles.timeBlock}>
        <div class={styles.time}>{formatClockTime(currentTime())}</div>
        <div class={styles.date}>{formatClockDate(currentTime())}</div>
      </div>

      <div class={styles.widgetsRow}>
        <button class={styles.widget} onClick={() => notificationsActions.setDoNotDisturb(!notifications.doNotDisturb)}>
          <span class={styles.widgetLabel}>Focus</span>
          <strong>{notifications.doNotDisturb ? 'No molestar activo' : 'No molestar inactivo'}</strong>
        </button>
        <button class={styles.widget} onClick={() => setShowPad(true)}>
          <span class={styles.widgetLabel}>Unlock</span>
          <strong>Desliza arriba o toca para PIN</strong>
        </button>
      </div>

      <div class={styles.notificationsWrap}>
        <For each={topNotifications()}>
          {(item) => (
            <article class={styles.notificationCard}>
              <div class={styles.notificationTop}>
                <strong>{item.title}</strong>
                <span>{item.appId}</span>
              </div>
              <p>{item.message}</p>
            </article>
          )}
        </For>
      </div>

      <button class={styles.swipeHint} onClick={() => setShowPad(true)}>
        Desliza arriba para desbloquear
      </button>

      <Show when={showPad()}>
        <div class={styles.unlockSheet}>
          <div class={styles.sheetHandle} />
          <div class={styles.codeContainer}>
            <div class={styles.dots}>
              {[0, 1, 2, 3].map((i) => (
                <div class={styles.dot} classList={{ [styles.filled]: i < code().length, [styles.errorDot]: error() }} />
              ))}
            </div>
            <Show when={attempts() > 0}>
                <span class={styles.errorMsg}>PIN incorrecto ({attempts()})</span>
            </Show>
          </div>

          <div class={styles.keypad}>
            <For each={keypadKeys}>
              {(key) => (
                <Show when={key !== ''} fallback={<div />}>
                  <button class={styles.key} onClick={() => (key === 'del' ? setCode((prev) => prev.slice(0, -1)) : handleKeyPress(key))}>
                    {key === 'del' ? '⌫' : key}
                  </button>
                </Show>
              )}
            </For>
          </div>

          <div class={styles.sheetActions}>
            <button onClick={() => setShowPad(false)}>{t('lock.cancel', language())}</button>
            <button onClick={submitUnlock}>{t('lock.unlock', language())}</button>
          </div>
        </div>
      </Show>

      <div class={styles.bottomActions}>
        <button class={styles.bottomBtn}>🔦</button>
        <button class={styles.bottomBtn}>📷</button>
      </div>
    </div>
  );
}
