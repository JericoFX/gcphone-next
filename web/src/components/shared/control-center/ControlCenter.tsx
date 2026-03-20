import { For, Show, createMemo, createSignal, onMount, onCleanup } from 'solid-js';
import { fetchNui } from '../../../utils/fetchNui';
import { useNotifications } from '../../../store/notifications';
import { usePhone } from '../../../store/phone';
import { APP_BY_ID } from '../../../config/apps';
import { appName, formatDate, t } from '../../../i18n';
import { useInternalEvent, emitInternalEvent } from '../../../utils/internalEvents';
import styles from './ControlCenter.module.scss';

export function ControlCenter() {
  const [notifications, notificationsActions] = useNotifications();
  const [phoneState, phoneActions] = usePhone();
  const language = () => phoneState.settings.language || 'es';
  const [dragSurface, setDragSurface] = createSignal<'notifications' | 'control' | null>(null);
  const [dragProgress, setDragProgress] = createSignal(0);
  const [liveLocationEnabled, setLiveLocationEnabled] = createSignal(false);
  const [flashlightEnabled, setFlashlightEnabled] = createSignal(false);

  let sheetGestureStartX = 0;
  let sheetGestureStartY = 0;
  let topDragStartY = 0;
  let topDragPointerId = -1;

  const volumePercent = () => Math.round(phoneState.settings.volume * 100);
  const brightnessPercent = () => Math.round(notifications.brightness * 100);

  const groupedNotifications = createMemo(() => {
    const groups = new Map<string, Array<{ id: string; title: string; message: string; route?: string; data?: Record<string, unknown>; createdAt?: number }>>();
    for (const item of notifications.history) {
      const key = item.appId || 'system';
      const list = groups.get(key) || [];
      list.push({ id: item.id, title: item.title, message: item.message, route: item.route, data: item.data, createdAt: item.createdAt });
      groups.set(key, list);
    }
    return Array.from(groups.entries()).map(([appId, items]) => ({
      appId,
      items,
      icon: APP_BY_ID[appId]?.icon || './img/icons_ios/settings.svg',
      title: appName(appId, APP_BY_ID[appId]?.name || appId, language()).toUpperCase(),
    }));
  });

  const totalNotificationCount = createMemo(() => notifications.history.length);
  const mutedAppsCount = createMemo(() => notifications.mutedApps.length);

  const dayLabel = createMemo(() => {
    const now = new Date();
    const weekday = formatDate(now, language(), { weekday: 'long' });
    const shortDate = formatDate(now, language(), { day: 'numeric', month: 'short' });
    return `${weekday} ${shortDate}`;
  });

  async function syncLiveLocationState() {
    const result = await fetchNui<{ success?: boolean; active?: boolean }>('getLiveLocationState', {}, { success: false, active: false });
    setLiveLocationEnabled(result?.success === true && result.active === true);
  }

  async function syncFlashlightState() {
    const result = await fetchNui<{ enabled?: boolean }>('cameraGetFlashlightSettings', {}, { enabled: false });
    setFlashlightEnabled(result?.enabled === true);
  }

  async function toggleFlashlight() {
    const nextEnabled = !flashlightEnabled();
    const result = await fetchNui<{ success?: boolean; enabled?: boolean }>(
      'cameraToggleFlashlight',
      { enabled: nextEnabled },
      { success: true, enabled: nextEnabled },
    );
    if (result?.success) {
      setFlashlightEnabled(result.enabled === true);
    }
  }

  async function toggleGpsQuickAction() {
    if (liveLocationEnabled()) {
      const stopResult = await fetchNui<{ success?: boolean }>('stopLiveLocation', {}, { success: false });
      if (stopResult?.success) {
        setLiveLocationEnabled(false);
        notificationsActions.receive({
          appId: 'maps',
          title: 'GPS',
          message: 'Ubicacion en tiempo real desactivada',
          priority: 'normal',
        });
      }
      return;
    }

    const contacts = await fetchNui<Array<{ number: string }>>('getContacts', {}, []);
    const recipients = (contacts || [])
      .map((row) => String(row?.number || '').trim())
      .filter((value) => value.length > 0);

    if (recipients.length === 0) {
      notificationsActions.receive({
        appId: 'maps',
        title: 'GPS',
        message: 'Necesitas al menos un contacto para compartir ubicacion',
        priority: 'normal',
      });
      return;
    }

    await fetchNui('setLiveLocationInterval', { seconds: 10 }, { success: true });
    const startResult = await fetchNui<{ success?: boolean; error?: string }>('startLiveLocation', {
      recipients,
      durationMinutes: 15,
      updateIntervalSeconds: 10,
    }, { success: false });

    if (startResult?.success) {
      setLiveLocationEnabled(true);
      notificationsActions.receive({
        appId: 'maps',
        title: 'GPS',
        message: 'Ubicacion en tiempo real activada cada 10s',
        priority: 'normal',
        route: 'maps',
        data: { action: 'my-location' },
      });
      return;
    }

    notificationsActions.receive({
      appId: 'maps',
      title: 'GPS',
      message: startResult?.error || 'No se pudo activar el GPS',
      priority: 'normal',
    });
  }

  const visibleItemsForGroup = (items: Array<{ id: string; title: string; message: string; route?: string; data?: Record<string, unknown>; createdAt?: number }>) => {
    return items.slice(0, 2);
  };

  const SWIPE_THRESHOLD = 80;

  const createSwipeHandlers = (itemId: string) => {
    let startX = 0;
    let currentX = 0;
    let swiping = false;
    let itemEl: HTMLElement | null = null;
    let trackEl: HTMLElement | null = null;

    const onPointerDown = (e: PointerEvent) => {
      itemEl = e.currentTarget as HTMLElement;
      trackEl = itemEl.parentElement;
      startX = e.clientX;
      currentX = startX;
      swiping = true;
      itemEl.setPointerCapture(e.pointerId);
      itemEl.style.transition = 'none';
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!swiping || !itemEl) return;
      currentX = e.clientX;
      const deltaX = currentX - startX;
      itemEl.style.transform = `translate3d(${deltaX}px, 0, 0)`;

      if (trackEl) {
        const bgLeft = trackEl.querySelector('[data-swipe-bg-left]') as HTMLElement;
        const bgRight = trackEl.querySelector('[data-swipe-bg-right]') as HTMLElement;
        if (bgLeft) bgLeft.classList.toggle(styles.swipeBgVisible, deltaX < -30);
        if (bgRight) bgRight.classList.toggle(styles.swipeBgVisible, deltaX > 30);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!swiping || !itemEl) return;
      swiping = false;
      const deltaX = currentX - startX;
      const absX = Math.abs(deltaX);

      if (absX >= SWIPE_THRESHOLD) {
        itemEl.style.transition = '';
        const cls = deltaX < 0 ? styles.swipeDismissLeft : styles.swipeDismissRight;
        if (trackEl) trackEl.classList.add(cls);
        setTimeout(() => notificationsActions.remove(itemId), 220);
      } else {
        itemEl.style.transition = '';
        itemEl.style.transform = '';
        if (trackEl) {
          const bgLeft = trackEl.querySelector('[data-swipe-bg-left]') as HTMLElement;
          const bgRight = trackEl.querySelector('[data-swipe-bg-right]') as HTMLElement;
          if (bgLeft) bgLeft.classList.remove(styles.swipeBgVisible);
          if (bgRight) bgRight.classList.remove(styles.swipeBgVisible);
        }
      }
    };

    return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp };
  };

  const formatTime = (unix?: number) => {
    if (!unix || unix <= 0) return 'Ahora';
    const diffSeconds = Math.max(0, Math.floor((Date.now() - unix) / 1000));
    if (diffSeconds < 60) return 'Ahora';
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h`;
    return `${Math.floor(diffSeconds / 86400)}d`;
  };

  const handleSheetPointerDown = (e: PointerEvent) => {
    sheetGestureStartX = e.clientX;
    sheetGestureStartY = e.clientY;
  };

  const handleSheetPointerUp = (e: PointerEvent, sheet: 'notifications' | 'control') => {
    const deltaX = e.clientX - sheetGestureStartX;
    const deltaY = e.clientY - sheetGestureStartY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    const target = e.currentTarget as HTMLDivElement;
    const rect = target.getBoundingClientRect();
    const startedNearBottom = sheetGestureStartY > rect.bottom - rect.height * 0.28;

    if (startedNearBottom && deltaY < -80 && absY > absX) {
      if (sheet === 'notifications') notificationsActions.setNotificationCenterOpen(false);
      if (sheet === 'control') notificationsActions.setControlCenterOpen(false);
      return;
    }

    if (absX > 72 && absX > absY) {
      if (sheet === 'notifications' && deltaX < 0) {
        notificationsActions.setNotificationCenterOpen(false);
        notificationsActions.setControlCenterOpen(true);
      }
      if (sheet === 'control' && deltaX > 0) {
        notificationsActions.setControlCenterOpen(false);
        notificationsActions.setNotificationCenterOpen(true);
      }
    }
  };

  const openRoute = (route?: string, data?: Record<string, unknown>) => {
    if (!route) return;
    emitInternalEvent('phone:openRoute', { route, data: data || {} });
  };

  const topDragEnabled = createMemo(() => !notifications.controlCenterOpen && !notifications.notificationCenterOpen);

  const handleTopDragStart = (event: PointerEvent, target: 'notifications' | 'control') => {
    if (!topDragEnabled()) return;
    topDragStartY = event.clientY;
    topDragPointerId = event.pointerId;
    setDragSurface(target);
    setDragProgress(0);
    const current = event.currentTarget as HTMLElement;
    current.setPointerCapture(event.pointerId);
  };

  const handleTopDragMove = (event: PointerEvent) => {
    if (!topDragEnabled()) return;
    if (!dragSurface() || topDragPointerId !== event.pointerId) return;
    const deltaY = Math.max(0, event.clientY - topDragStartY);
    const progress = Math.min(1, deltaY / 96);
    setDragProgress(progress);
  };

  const handleTopDragEnd = (event: PointerEvent) => {
    if (!dragSurface() || topDragPointerId !== event.pointerId) return;
    if (dragProgress() >= 0.34) {
      if (dragSurface() === 'notifications') notificationsActions.setNotificationCenterOpen(true);
      if (dragSurface() === 'control') notificationsActions.setControlCenterOpen(true);
    }
    topDragPointerId = -1;
    setDragSurface(null);
    setDragProgress(0);
  };

  onMount(() => {
    void syncLiveLocationState();
    void syncFlashlightState();
  });

  useInternalEvent('phone:openControlCenter', () => notificationsActions.setControlCenterOpen(true));
  useInternalEvent('phone:openNotificationCenter', () => notificationsActions.setNotificationCenterOpen(true));

  return (
    <>
      <Show when={topDragEnabled()}>
        <div class={styles.topPullZone}>
          <div
            class={styles.pullHalf}
            onPointerDown={(event) => handleTopDragStart(event, 'notifications')}
            onPointerMove={handleTopDragMove}
            onPointerUp={handleTopDragEnd}
            onPointerCancel={handleTopDragEnd}
            data-testid="notification-center-toggle"
          />
          <div
            class={styles.pullHalf}
            onPointerDown={(event) => handleTopDragStart(event, 'control')}
            onPointerMove={handleTopDragMove}
            onPointerUp={handleTopDragEnd}
            onPointerCancel={handleTopDragEnd}
            data-testid="control-center-toggle"
          />
        </div>
      </Show>

      {/* ── Notification Center ── */}
      <Show when={notifications.notificationCenterOpen}>
        <div class={styles.overlay} data-testid="notification-center-sheet" onClick={() => notificationsActions.setNotificationCenterOpen(false)}>
          <div
            class={`${styles.sheet} ${styles.notificationSheet}`}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={handleSheetPointerDown}
            onPointerUp={(e) => handleSheetPointerUp(e, 'notifications')}
          >
            <div class={styles.sheetHeader}>
              <div class={styles.grabber} />
              <h3>{t('control.notifications', language())}</h3>
              <span class={styles.headerDate}>{dayLabel()}</span>
            </div>

            <div class={styles.summaryRow}>
              <article class={styles.summaryCard}>
                <span>Total</span>
                <strong>{totalNotificationCount()}</strong>
              </article>
              <article class={styles.summaryCard}>
                <span>Silenciadas</span>
                <strong>{mutedAppsCount()}</strong>
              </article>
            </div>

            <div class={styles.notificationList}>
              <Show when={groupedNotifications().length > 0} fallback={<div class={styles.empty}>{t('notifications.none_saved', language())}</div>}>
                <For each={groupedNotifications()}>
                  {(group) => (
                    <div class={styles.notificationGroup}>
                      <div class={styles.groupTitle}>
                        <img src={group.icon} alt="" />
                        <span>{group.title}</span>
                        <button
                          class={styles.muteAppBtn}
                          onClick={() => notificationsActions.toggleMuteApp(group.appId)}
                        >
                          {notificationsActions.isAppMuted(group.appId) ? t('notifications.enable', language()) : t('notifications.mute', language())}
                        </button>
                      </div>
                      <For each={visibleItemsForGroup(group.items)}>
                        {(item) => {
                          const swipe = createSwipeHandlers(item.id);
                          return (
                            <div class={styles.swipeTrack}>
                              <div class={`${styles.swipeBg} ${styles.swipeBgRight}`} data-swipe-bg-right>Eliminar</div>
                              <div class={`${styles.swipeBg} ${styles.swipeBgLeft}`} data-swipe-bg-left>Eliminar</div>
                              <button
                                class={styles.notificationItem}
                                onPointerDown={swipe.onPointerDown}
                                onPointerMove={swipe.onPointerMove}
                                onPointerUp={swipe.onPointerUp}
                                onPointerCancel={swipe.onPointerCancel}
                                onClick={() => {
                                  notificationsActions.markAppAsRead(group.appId);
                                  notificationsActions.setNotificationCenterOpen(false);
                                  openRoute(item.route, item.data);
                                }}
                              >
                                <strong>
                                  <span>{item.title}</span>
                                  <small>{formatTime(item.createdAt)}</small>
                                </strong>
                                <span>{item.message}</span>
                              </button>
                            </div>
                          );
                        }}
                      </For>
                      <Show when={group.items.length > 2}>
                        <div class={styles.moreCount}>+{group.items.length - 2} mas</div>
                      </Show>
                    </div>
                  )}
                </For>
              </Show>
            </div>

            <div class={styles.sheetFooter}>
              <button class={styles.clearBtn} onClick={() => notificationsActions.clear()}>{t('control.clear', language())}</button>
              <button class={styles.closeBtn} onClick={() => notificationsActions.setNotificationCenterOpen(false)}>{t('control.close', language())}</button>
            </div>
          </div>
        </div>
      </Show>

      {/* ── Control Center ── */}
      <Show when={notifications.controlCenterOpen}>
        <div class={styles.overlay} data-testid="control-center-sheet" onClick={() => notificationsActions.setControlCenterOpen(false)}>
          <div
            class={`${styles.sheet} ${styles.controlSheet}`}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={handleSheetPointerDown}
            onPointerUp={(e) => handleSheetPointerUp(e, 'control')}
          >
            <div class={styles.sheetHeader}>
              <div class={styles.grabber} />
            </div>

            {/* Connectivity module */}
            <div class={styles.connectivityModule}>
              <button
                class={styles.connectivityTile}
                classList={{ [styles.connectivityTileActive]: notifications.airplaneMode }}
                onClick={() => notificationsActions.setAirplaneMode(!notifications.airplaneMode)}
              >
                <span class={styles.tileIcon}>
                  <img src="./img/icons_ios/ui-plane.svg" alt="" draggable={false} />
                </span>
                <span class={styles.tileLabel}>{t('control.airplane', language())}</span>
              </button>

              <button
                class={styles.connectivityTile}
                classList={{ [styles.connectivityTileActive]: notifications.doNotDisturb }}
                onClick={() => notificationsActions.setDoNotDisturb(!notifications.doNotDisturb)}
              >
                <span class={styles.tileIcon}>
                  <img src="./img/icons_ios/ui-moon.svg" alt="" draggable={false} />
                </span>
                <span class={styles.tileLabel}>{t('control.dnd', language())}</span>
              </button>

              <button
                class={styles.connectivityTile}
                classList={{ [styles.connectivityTileActive]: notifications.silentMode }}
                onClick={() => notificationsActions.setSilentMode(!notifications.silentMode)}
              >
                <span class={styles.tileIcon}>
                  <img src="./img/icons_ios/ui-bell.svg" alt="" draggable={false} />
                </span>
                <span class={styles.tileLabel}>{t('control.silent', language())}</span>
              </button>

              <button
                class={styles.connectivityTile}
                classList={{ [styles.connectivityTileActive]: liveLocationEnabled() }}
                onClick={() => void toggleGpsQuickAction()}
              >
                <span class={styles.tileIcon}>
                  <img src="./img/icons_ios/ui-location.svg" alt="" draggable={false} />
                </span>
                <span class={styles.tileLabel}>GPS</span>
              </button>
            </div>

            {/* Quick actions row */}
            <div class={styles.quickRow}>
              <button
                class={styles.quickTile}
                classList={{ [styles.quickTileActive]: flashlightEnabled() }}
                onClick={() => void toggleFlashlight()}
              >
                <img src="./img/icons_ios/ui-flashlight.svg" alt="" draggable={false} />
              </button>

              <button
                class={styles.quickTile}
                onClick={() => {
                  notificationsActions.setControlCenterOpen(false);
                  emitInternalEvent('phone:openRoute', { route: 'camera', data: {} });
                }}
              >
                <img src="./img/icons_ios/camera.svg" alt="" draggable={false} />
              </button>

              <button
                class={styles.quickTile}
                onClick={() => {
                  notificationsActions.setControlCenterOpen(false);
                  emitInternalEvent('phone:lockPhone', {});
                }}
              >
                <img src="./img/icons_ios/ui-lock.svg" alt="" draggable={false} />
              </button>
            </div>

            {/* Brightness */}
            <div class={styles.sliderModule}>
              <div class={styles.sliderHeader}>
                <img src="./img/icons_ios/ui-sun.svg" alt="" class={styles.sliderIcon} draggable={false} />
                <span>{t('settings.brightness', language())}</span>
                <strong>{brightnessPercent()}%</strong>
              </div>
              <input
                class={`${styles.slider} ios-slider`}
                type="range"
                min="40"
                max="120"
                value={brightnessPercent()}
                style={{ '--value-percent': `${((brightnessPercent() - 40) / 80) * 100}%` }}
                onInput={(e) => {
                  const val = Number(e.currentTarget.value);
                  e.currentTarget.style.setProperty('--value-percent', `${((val - 40) / 80) * 100}%`);
                  notificationsActions.setBrightness(val / 100);
                }}
              />
            </div>

            {/* Volume */}
            <div class={styles.sliderModule}>
              <div class={styles.sliderHeader}>
                <img src="./img/icons_ios/ui-bell.svg" alt="" class={styles.sliderIcon} draggable={false} />
                <span>{t('settings.volume', language())}</span>
                <strong>{volumePercent()}%</strong>
              </div>
              <input
                class={`${styles.slider} ios-slider`}
                type="range"
                min="0"
                max="100"
                value={volumePercent()}
                style={{ '--value-percent': `${volumePercent()}%` }}
                onInput={(e) => {
                  const val = Number(e.currentTarget.value);
                  e.currentTarget.style.setProperty('--value-percent', `${val}%`);
                  phoneActions.setVolume(val / 100);
                }}
              />
            </div>

            <div class={styles.sheetFooter}>
              <button class={styles.closeBtn} onClick={() => notificationsActions.setControlCenterOpen(false)}>{t('control.close', language())}</button>
            </div>
          </div>
        </div>
      </Show>
    </>
  );
}
