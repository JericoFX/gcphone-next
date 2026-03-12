import { For, Show, batch, createEffect, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import { usePhone } from '../../store/phone';
import { useNotifications } from '../../store/notifications';
import { formatPhoneNumber } from '../../utils/misc';
import { fetchNui } from '../../utils/fetchNui';
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
  const [swipeValue, setSwipeValue] = createSignal(0);
  const [flashlightSupported, setFlashlightSupported] = createSignal(false);
  const [flashlightEnabled, setFlashlightEnabled] = createSignal(false);
  const [pendingRoute, setPendingRoute] = createSignal<string | null>(null);
  const language = () => phoneState.settings.language || 'es';

  let timer: number | undefined;

  const topNotifications = createMemo(() => notifications.history.slice(0, 3));

  onMount(() => {
    timer = window.setInterval(() => setCurrentTime(new Date()), 1000);
    void (async () => {
      const capabilities = await fetchNui<{ flashlight?: boolean; flashlightEnabled?: boolean }>('cameraGetCapabilities', undefined, {
        flashlight: false,
        flashlightEnabled: false,
      });
      setFlashlightSupported(capabilities?.flashlight === true);
      setFlashlightEnabled(capabilities?.flashlightEnabled === true);
    })();
  });

  onCleanup(() => {
    if (timer) clearInterval(timer);
  });

  const submitUnlock = async () => {
    if (await phoneActions.unlock(code())) {
      const route = pendingRoute();
      batch(() => {
        setCode('');
        setAttempts(0);
        setShowPad(false);
        setPendingRoute(null);
      });
      if (route) {
        window.setTimeout(() => {
          window.dispatchEvent(new CustomEvent('phone:openRoute', { detail: { route } }));
        }, 60);
      }
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
    if (code().length === 4) void submitUnlock();
  });

  const handleKeyPress = (num: string) => {
    if (code().length >= 4) return;
    setCode((prev) => prev + num);
  };

  const toggleFlashlight = async () => {
    if (!flashlightSupported()) return;
    const nextEnabled = !flashlightEnabled();
    const result = await fetchNui<{ success?: boolean; enabled?: boolean }>('cameraToggleFlashlight', { enabled: nextEnabled }, { success: true, enabled: nextEnabled });
    if (result?.success) {
      setFlashlightEnabled(result.enabled === true);
    }
  };

  const openCameraQuickAction = () => {
    setPendingRoute('camera');
    setShowPad(true);
    setError(false);
    setSwipeValue(0);
  };

  const triggerUnlockSheet = (route?: string | null) => {
    setPendingRoute(route || null);
    setShowPad(true);
    setError(false);
    setSwipeValue(0);
  };

  const handleSwipeInput = (value: number) => {
    setSwipeValue(value);
    if (value >= 92) {
      triggerUnlockSheet(pendingRoute());
    }
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

      <Show when={phoneState.imei || phoneState.deviceOwnerName || phoneState.settings.phoneNumber}>
        <div class={styles.deviceIdentity}>
          <div class={styles.deviceIdentityTop}>
            <span class={styles.deviceIdentityLabel}>Device Info</span>
            <Show when={phoneState.isStolen}>
              <span class={styles.deviceIdentityFlag}>Reportado</span>
            </Show>
          </div>
          <Show when={phoneState.deviceOwnerName}>
            <div class={styles.deviceIdentityRow}>
              <span>Propietario</span>
              <strong>{phoneState.deviceOwnerName}</strong>
            </div>
          </Show>
          <Show when={phoneState.settings.phoneNumber}>
            <div class={styles.deviceIdentityRow}>
              <span>Numero</span>
              <strong>{formatPhoneNumber(phoneState.settings.phoneNumber, phoneState.framework || 'unknown')}</strong>
            </div>
          </Show>
          <Show when={phoneState.imei}>
            <div class={styles.deviceIdentityRow}>
              <span>IMEI</span>
              <strong>{phoneState.imei}</strong>
            </div>
          </Show>
        </div>
      </Show>

      <div class={styles.widgetsRow}>
        <button class={styles.widget} onClick={() => notificationsActions.setDoNotDisturb(!notifications.doNotDisturb)}>
          <span class={styles.widgetLabel}>Focus</span>
          <strong>{notifications.doNotDisturb ? 'No molestar activo' : 'No molestar inactivo'}</strong>
        </button>
        <button class={styles.widget} onClick={() => triggerUnlockSheet()}>
          <span class={styles.widgetLabel}>Unlock</span>
          <strong>{pendingRoute() === 'camera' ? 'Desbloquear para abrir camara' : 'Desliza arriba o toca para PIN'}</strong>
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

      <div class={styles.swipeHint}>
        <span>{pendingRoute() === 'camera' ? 'Desliza para abrir la camara' : 'Desliza para desbloquear'}</span>
        <input
          class={styles.swipeControl}
          type="range"
          min="0"
          max="100"
          value={swipeValue()}
          onInput={(event) => handleSwipeInput(Number(event.currentTarget.value))}
          onChange={(event) => {
            if (Number(event.currentTarget.value) < 92) {
              setSwipeValue(0);
            }
          }}
        />
      </div>

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
            <button onClick={() => {
              setShowPad(false);
              setPendingRoute(null);
              setSwipeValue(0);
            }}>{t('lock.cancel', language())}</button>
            <button onClick={() => void submitUnlock()}>{t('lock.unlock', language())}</button>
          </div>
        </div>
      </Show>

      <div class={styles.bottomActions}>
        <button class={styles.bottomBtn} classList={{ [styles.bottomBtnActive]: flashlightEnabled() }} onClick={() => void toggleFlashlight()} disabled={!flashlightSupported()}>
          <img src="./img/icons_ios/ui-flashlight.svg" alt="" draggable={false} />
        </button>
        <button class={styles.bottomBtn} onClick={openCameraQuickAction}>
          <img src="./img/icons_ios/camera.svg" alt="" draggable={false} />
        </button>
      </div>
    </div>
  );
}
