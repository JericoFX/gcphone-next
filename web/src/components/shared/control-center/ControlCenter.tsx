import { For, Show, createEffect, createMemo, createSignal, onMount, onCleanup } from 'solid-js';
import { fetchKnownNui } from '../../../utils/fetchNui';
import { useNotifications } from '../../../store/notifications';
import { usePhone } from '../../../store/phone';
import { APP_BY_ID } from '../../../config/apps';
import { appName, formatDate, t } from '../../../i18n';
import { useInternalEvent, emitInternalEvent } from '../../../utils/internalEvents';
import type { FocusModeId } from '../../../store/notifications';
import type { NearbyPlayerData } from '../../../types/nui';
import styles from './ControlCenter.module.scss';

const TOP_PULL_OPEN_DISTANCE = 112;
const TOP_PULL_OPEN_PROGRESS = 0.56;

const FOCUS_MODE_ICONS: Record<FocusModeId, string> = {
  off: './img/icons_ios/ui-moon.svg',
  personal: './img/icons_ios/ui-moon.svg',
  work: './img/icons_ios/ui-briefcase.svg',
  driving: './img/icons_ios/ui-car.svg',
  sleep: './img/icons_ios/ui-moon.svg',
};

const FOCUS_MODE_LABELS: Record<FocusModeId, Record<string, string>> = {
  off: { es: 'Enfoque', en: 'Focus', fr: 'Concentration', de: 'Fokus', pt: 'Foco', ru: 'Фокус', pl: 'Skupienie', it: 'Focus' },
  personal: { es: 'Personal', en: 'Personal', fr: 'Personnel', de: 'Persoenlich', pt: 'Pessoal', ru: 'Личный', pl: 'Osobisty', it: 'Personale' },
  work: { es: 'Trabajo', en: 'Work', fr: 'Travail', de: 'Arbeit', pt: 'Trabalho', ru: 'Работа', pl: 'Praca', it: 'Lavoro' },
  driving: { es: 'Conduccion', en: 'Driving', fr: 'Conduite', de: 'Fahren', pt: 'Dirigindo', ru: 'Вождение', pl: 'Jazda', it: 'Guida' },
  sleep: { es: 'Dormir', en: 'Sleep', fr: 'Sommeil', de: 'Schlafen', pt: 'Dormir', ru: 'Сон', pl: 'Sen', it: 'Sonno' },
};

function focusModeIcon(mode: FocusModeId): string {
  return FOCUS_MODE_ICONS[mode] || FOCUS_MODE_ICONS.off;
}

function focusModeLabel(mode: FocusModeId, lang: string): string {
  return FOCUS_MODE_LABELS[mode]?.[lang] || FOCUS_MODE_LABELS[mode]?.en || 'Focus';
}

function lockLabel(lang: string): string {
  const labels: Record<string, string> = {
    es: 'Bloquear',
    en: 'Lock',
    fr: 'Verrouiller',
    de: 'Sperren',
    pt: 'Bloquear',
    ru: 'Lock',
    pl: 'Zablokuj',
    it: 'Blocca',
  };
  return labels[lang] || labels.en;
}

function nfcNoNearbyLabel(lang: string): string {
  const labels: Record<string, string> = {
    es: 'No hay personas cerca',
    en: 'No people nearby',
    fr: 'Personne a proximite',
    de: 'Niemand in der Nahe',
    pt: 'Nao ha pessoas por perto',
    ru: 'No people nearby',
    pl: 'Brak osob w poblizu',
    it: 'Nessuno nelle vicinanze',
  };
  return labels[lang] || labels.en;
}

function nfcOffLabel(lang: string): string {
  const labels: Record<string, string> = {
    es: 'NFC desactivado',
    en: 'NFC off',
    fr: 'NFC desactive',
    de: 'NFC aus',
    pt: 'NFC desativado',
    ru: 'NFC off',
    pl: 'NFC wylaczony',
    it: 'NFC disattivato',
  };
  return labels[lang] || labels.en;
}

function nfcOnLabel(lang: string): string {
  const labels: Record<string, string> = {
    es: 'NFC activado',
    en: 'NFC on',
    fr: 'NFC active',
    de: 'NFC an',
    pt: 'NFC ativado',
    ru: 'NFC on',
    pl: 'NFC wlaczony',
    it: 'NFC attivo',
  };
  return labels[lang] || labels.en;
}

function streamerControlLabel(lang: string): string {
  const labels: Record<string, string> = {
    es: 'Streamer',
    en: 'Streamer',
    fr: 'Streamer',
    de: 'Streamer',
    pt: 'Streamer',
    ru: 'Streamer',
    pl: 'Streamer',
    it: 'Streamer',
  };
  return labels[lang] || labels.en;
}

function getInitialNfcEnabled(): boolean {
  try {
    return window.localStorage.getItem('gcphone:nfc-enabled') === '1';
  } catch {
    return false;
  }
}

export function ControlCenter() {
  const [notifications, notificationsActions] = useNotifications();
  const [phoneState, phoneActions] = usePhone();
  const language = () => phoneState.settings.language || 'es';
  const [dragSurface, setDragSurface] = createSignal<'notifications' | 'control' | null>(null);
  const [dragProgress, setDragProgress] = createSignal(0);
  const [liveLocationEnabled, setLiveLocationEnabled] = createSignal(false);
  const [flashlightEnabled, setFlashlightEnabled] = createSignal(false);
  const [flashlightLumens, setFlashlightLumens] = createSignal(1200);
  const [flashlightMinLumens, setFlashlightMinLumens] = createSignal(350);
  const [flashlightMaxLumens, setFlashlightMaxLumens] = createSignal(2200);
  const [flashlightKelvin, setFlashlightKelvin] = createSignal(5200);
  const [nfcEnabled, setNfcEnabled] = createSignal(getInitialNfcEnabled());
  const [nearbyPlayers, setNearbyPlayers] = createSignal<NearbyPlayerData[]>([]);
  const [nfcTargetServerId, setNfcTargetServerId] = createSignal<number | null>(null);

  let sheetGestureStartX = 0;
  let sheetGestureStartY = 0;
  let topDragStartY = 0;
  let topDragPointerId = -1;

  const volumePercent = () => Math.round(phoneState.settings.volume * 100);
  const brightnessPercent = () => Math.round(notifications.brightness * 100);
  const flashlightPercent = () => {
    const min = flashlightMinLumens();
    const max = Math.max(min + 1, flashlightMaxLumens());
    return Math.round(((flashlightLumens() - min) / (max - min)) * 100);
  };
  const selectedNfcTarget = createMemo(() => {
    const selectedId = nfcTargetServerId();
    return nearbyPlayers().find((player) => player.serverId === selectedId) || nearbyPlayers()[0] || null;
  });
  const selectedNfcTargetIndex = createMemo(() => {
    const selected = selectedNfcTarget();
    if (!selected) return -1;
    return nearbyPlayers().findIndex((player) => player.serverId === selected.serverId);
  });

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
    const result = await fetchKnownNui('getLiveLocationState', {}, { success: false, active: false });
    setLiveLocationEnabled(result?.success === true && result.active === true);
  }

  async function syncFlashlightState() {
    const result = await fetchKnownNui('cameraGetFlashlightSettings', {}, { success: false, enabled: false });
    setFlashlightEnabled(result?.enabled === true);
    if (typeof result?.lumens === 'number') setFlashlightLumens(Math.round(result.lumens));
    if (typeof result?.minLumens === 'number') setFlashlightMinLumens(Math.round(result.minLumens));
    if (typeof result?.maxLumens === 'number') setFlashlightMaxLumens(Math.round(result.maxLumens));
    if (typeof result?.kelvin === 'number') setFlashlightKelvin(Math.round(result.kelvin));
  }

  async function toggleFlashlight() {
    const nextEnabled = !flashlightEnabled();
    const result = await fetchKnownNui(
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
      const stopResult = await fetchKnownNui('stopLiveLocation', {}, { success: false });
      if (stopResult?.success) {
        setLiveLocationEnabled(false);
        notificationsActions.receive({
          appId: 'maps',
          title: 'GPS',
          message: t('control.gps_disabled', language()),
          priority: 'normal',
        });
      }
      return;
    }

    const contacts = await fetchKnownNui('getContacts', undefined, []);
    const recipients = (contacts || [])
      .map((row) => String(row?.number || '').trim())
      .filter((value) => value.length > 0);

    if (recipients.length === 0) {
      notificationsActions.receive({
        appId: 'maps',
        title: 'GPS',
        message: t('control.gps_need_contact', language()),
        priority: 'normal',
      });
      return;
    }

    await fetchKnownNui('setLiveLocationInterval', { seconds: 10 }, { success: true });
    const startResult = await fetchKnownNui('startLiveLocation', {
      recipients,
      durationMinutes: 15,
      updateIntervalSeconds: 10,
    }, { success: false });

    if (startResult?.success) {
      setLiveLocationEnabled(true);
      notificationsActions.receive({
        appId: 'maps',
        title: 'GPS',
        message: t('control.gps_enabled', language()),
        priority: 'normal',
        route: 'maps',
        data: { action: 'my-location' },
      });
      return;
    }

    notificationsActions.receive({
      appId: 'maps',
      title: 'GPS',
      message: startResult?.error || t('control.gps_failed', language()),
      priority: 'normal',
    });
  }

  async function syncNearbyPlayers() {
    if (!nfcEnabled()) {
      setNearbyPlayers([]);
      setNfcTargetServerId(null);
      return;
    }
    const players = await fetchKnownNui('getNearbyPlayers', { maxDistance: 3.0 }, []);
    setNearbyPlayers(players);
    if (players.length === 0) {
      setNfcTargetServerId(null);
      return;
    }
    const selectedId = nfcTargetServerId();
    if (!selectedId || !players.some((player) => player.serverId === selectedId)) {
      setNfcTargetServerId(players[0].serverId);
    }
  }

  function toggleNfc() {
    const nextEnabled = !nfcEnabled();
    setNfcEnabled(nextEnabled);
    try {
      window.localStorage.setItem('gcphone:nfc-enabled', nextEnabled ? '1' : '0');
    } catch {
      // localStorage is best-effort in browser preview and NUI.
    }
    if (nextEnabled) {
      notificationsActions.receive({
        id: 'control-nfc-status',
        appId: 'settings',
        title: 'NFC',
        message: `${nfcOnLabel(language())} - Centro de control`,
        priority: 'normal',
      });
      void syncNearbyPlayers();
      return;
    }
    setNearbyPlayers([]);
    setNfcTargetServerId(null);
    notificationsActions.receive({
      id: 'control-nfc-status',
      appId: 'settings',
      title: 'NFC',
      message: `${nfcOffLabel(language())} - Centro de control`,
      priority: 'normal',
    });
  }

  function cycleNfcTarget() {
    const players = nearbyPlayers();
    if (players.length <= 1) return;
    const currentIndex = Math.max(0, selectedNfcTargetIndex());
    const next = players[(currentIndex + 1) % players.length];
    setNfcTargetServerId(next.serverId);
  }

  function openNfcRoute(route: 'wallet' | 'gallery' | 'documents') {
    if (!nfcEnabled()) {
      notificationsActions.receive({
        id: 'control-nfc-status',
        appId: 'settings',
        title: 'NFC',
        message: `${nfcOffLabel(language())} - Centro de control`,
        priority: 'normal',
      });
      return;
    }

    const target = selectedNfcTarget();
    if (!target) {
      notificationsActions.receive({
        id: 'control-nfc-nearby',
        appId: 'settings',
        title: 'NFC',
        message: `${nfcNoNearbyLabel(language())} - Centro de control`,
        priority: 'normal',
      });
      return;
    }

    const nfcActionByRoute = {
      wallet: 'create_invoice',
      gallery: 'share_photo',
      documents: 'share_document',
    } as const;

    notificationsActions.setControlCenterOpen(false);
    emitInternalEvent('phone:openRoute', {
      route,
      data: {
        nfcAction: nfcActionByRoute[route],
        targetServerId: target.serverId,
        requestId: Date.now(),
      },
    });
  }

  const visibleItemsForGroup = (items: Array<{ id: string; title: string; message: string; route?: string; data?: Record<string, unknown>; createdAt?: number }>) => {
    return items.slice(0, 2);
  };

  const SWIPE_THRESHOLD = 80;
  const swipeDismissTimers = new Set<number>();

  onCleanup(() => {
    for (const id of swipeDismissTimers) window.clearTimeout(id);
    swipeDismissTimers.clear();
  });

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
        const timerId = window.setTimeout(() => {
          swipeDismissTimers.delete(timerId);
          notificationsActions.remove(itemId);
        }, 220);
        swipeDismissTimers.add(timerId);
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
    if (!unix || unix <= 0) return t('control.now', language());
    const diffSeconds = Math.max(0, Math.floor((Date.now() - unix) / 1000));
    if (diffSeconds < 60) return t('control.now', language());
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h`;
    return `${Math.floor(diffSeconds / 86400)}d`;
  };

  const handleSheetPointerDown = (e: PointerEvent) => {
    if ((e.target as HTMLElement | null)?.closest('[data-control-interactive="true"]')) return;
    sheetGestureStartX = e.clientX;
    sheetGestureStartY = e.clientY;
  };

  const handleSheetPointerUp = (e: PointerEvent, sheet: 'notifications' | 'control') => {
    if ((e.target as HTMLElement | null)?.closest('[data-control-interactive="true"]')) return;
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
    const progress = Math.min(1, deltaY / TOP_PULL_OPEN_DISTANCE);
    setDragProgress(progress);
  };

  const handleTopDragEnd = (event: PointerEvent) => {
    if (!dragSurface() || topDragPointerId !== event.pointerId) return;
    if (dragProgress() >= TOP_PULL_OPEN_PROGRESS) {
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
    if (nfcEnabled()) void syncNearbyPlayers();
  });

  createEffect(() => {
    if (!notifications.controlCenterOpen) return;
    void syncLiveLocationState();
    void syncFlashlightState();
    if (nfcEnabled()) void syncNearbyPlayers();
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
                <span>{t('control.muted', language())}</span>
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
                        <Show when={group.items.length > 1}>
                          <small>{group.items.length}</small>
                        </Show>
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
                              <div class={`${styles.swipeBg} ${styles.swipeBgRight}`} data-swipe-bg-right aria-hidden="true">{t('control.delete', language())}</div>
                              <div class={`${styles.swipeBg} ${styles.swipeBgLeft}`} data-swipe-bg-left aria-hidden="true">{t('control.delete', language())}</div>
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
                        <div class={styles.moreCount}>{t('control.more_count', language(), { n: group.items.length - 2 })}</div>
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

            <div class={styles.controlMosaic}>
              <section
                class={`${styles.controlModule} ${styles.nfcModule}`}
                classList={{ [styles.nfcModuleOff]: !nfcEnabled() }}
              >
                <div class={styles.nfcHeader}>
                  <button
                    class={styles.nfcTogglePill}
                    classList={{ [styles.nfcToggleActive]: nfcEnabled() }}
                    onClick={toggleNfc}
                    title={nfcEnabled() ? 'NFC on' : nfcOffLabel(language())}
                  >
                    NFC
                  </button>
                  <button
                    class={styles.refreshButton}
                    classList={{ [styles.refreshButtonActive]: nfcEnabled() }}
                    onClick={() => nfcEnabled() ? void syncNearbyPlayers() : toggleNfc()}
                    title={nfcEnabled() ? 'Actualizar NFC' : nfcOffLabel(language())}
                  >
                    <img src="./img/icons_ios/ui-location.svg" alt="" draggable={false} />
                  </button>
                </div>
                <div class={styles.nfcRadarMini} aria-hidden="true">
                  <span class={styles.nfcRadarPulse} />
                  <span class={styles.nfcRadarDot} />
                </div>
                <button
                  class={styles.nfcTarget}
                  disabled={!nfcEnabled() || nearbyPlayers().length <= 1}
                  onClick={cycleNfcTarget}
                  title={nearbyPlayers().length > 1 ? 'Cambiar persona NFC' : undefined}
                >
                  <span>{t('nfc.nearby_people', language())}</span>
                  <strong>
                    <Show when={nfcEnabled()} fallback={nfcOffLabel(language())}>
                      <Show when={selectedNfcTarget()} fallback={nfcNoNearbyLabel(language())}>
                      {(target) => `${target().name} - ${target().distance.toFixed(1)}m`}
                      </Show>
                    </Show>
                  </strong>
                  <Show when={nfcEnabled() && nearbyPlayers().length > 1}>
                    <small>{selectedNfcTargetIndex() + 1}/{nearbyPlayers().length}</small>
                  </Show>
                </button>
                <div class={styles.nfcActionRow}>
                  <button
                    disabled={!nfcEnabled() || !selectedNfcTarget()}
                    onClick={() => openNfcRoute('wallet')}
                  >
                    <img src="./img/icons_ios/wallet.svg" alt="" draggable={false} />
                  </button>
                  <button
                    disabled={!nfcEnabled() || !selectedNfcTarget()}
                    onClick={() => openNfcRoute('gallery')}
                  >
                    <img src="./img/icons_ios/gallery.svg" alt="" draggable={false} />
                  </button>
                  <button
                    disabled={!nfcEnabled() || !selectedNfcTarget()}
                    onClick={() => openNfcRoute('documents')}
                  >
                    <img src="./img/icons_ios/documents.svg" alt="" draggable={false} />
                  </button>
                </div>
              </section>

              <section class={`${styles.controlModule} ${styles.verticalSliderModule}`}>
                <img src="./img/icons_ios/ui-sun.svg" alt="" class={styles.sliderIcon} draggable={false} />
                <div
                  class={styles.verticalSliderShell}
                  style={{ '--slider-fill': `${((brightnessPercent() - 40) / 80) * 100}%` }}
                  data-control-interactive="true"
                  onPointerDown={(event) => event.stopPropagation()}
                  onPointerMove={(event) => event.stopPropagation()}
                  onPointerUp={(event) => event.stopPropagation()}
                  onPointerCancel={(event) => event.stopPropagation()}
                >
                  <span class={styles.verticalSliderFill} />
                  <input
                    class={styles.verticalSliderInput}
                    type="range"
                    min="40"
                    max="120"
                    value={brightnessPercent()}
                    onPointerDown={(event) => event.stopPropagation()}
                    onInput={(e) => notificationsActions.setBrightness(Number(e.currentTarget.value) / 100)}
                  />
                </div>
                <strong>{brightnessPercent()}%</strong>
              </section>

              <section class={`${styles.controlModule} ${styles.verticalSliderModule}`}>
                <img src="./img/icons_ios/ui-bell.svg" alt="" class={styles.sliderIcon} draggable={false} />
                <div
                  class={`${styles.verticalSliderShell} ${styles.verticalSliderShellBlue}`}
                  style={{ '--slider-fill': `${volumePercent()}%` }}
                  data-control-interactive="true"
                  onPointerDown={(event) => event.stopPropagation()}
                  onPointerMove={(event) => event.stopPropagation()}
                  onPointerUp={(event) => event.stopPropagation()}
                  onPointerCancel={(event) => event.stopPropagation()}
                >
                  <span class={styles.verticalSliderFill} />
                  <input
                    class={styles.verticalSliderInput}
                    type="range"
                    min="0"
                    max="100"
                    value={volumePercent()}
                    onPointerDown={(event) => event.stopPropagation()}
                    onInput={(e) => phoneActions.setVolume(Number(e.currentTarget.value) / 100)}
                  />
                </div>
                <strong>{volumePercent()}%</strong>
              </section>

              <section class={`${styles.controlModule} ${styles.quickActionsModule}`}>
                <button
                  class={styles.controlRoundButton}
                  classList={{ [styles.roundActiveBlue]: notifications.airplaneMode }}
                  onClick={() => notificationsActions.setAirplaneMode(!notifications.airplaneMode)}
                  title={t('control.airplane', language())}
                >
                  <img src="./img/icons_ios/ui-plane.svg" alt="" draggable={false} />
                  <span>{t('control.airplane', language())}</span>
                </button>
                <button
                  class={styles.controlRoundButton}
                  classList={{ [styles.roundActivePurple]: notifications.focusMode !== 'off' }}
                  onClick={() => notificationsActions.cycleFocusMode()}
                  title={focusModeLabel(notifications.focusMode, language())}
                >
                  <img src={focusModeIcon(notifications.focusMode)} alt="" draggable={false} />
                  <span>{focusModeLabel(notifications.focusMode, language())}</span>
                </button>
                <button
                  class={styles.controlRoundButton}
                  classList={{ [styles.roundActiveRed]: notifications.silentMode }}
                  onClick={() => notificationsActions.setSilentMode(!notifications.silentMode)}
                  title={t('control.silent', language())}
                >
                  <img src="./img/icons_ios/ui-bell.svg" alt="" draggable={false} />
                  <span>{t('control.silent', language())}</span>
                </button>
                <button
                  class={styles.controlRoundButton}
                  classList={{ [styles.roundActiveBlue]: liveLocationEnabled() }}
                  onClick={() => void toggleGpsQuickAction()}
                  title="GPS"
                >
                  <img src="./img/icons_ios/ui-location.svg" alt="" draggable={false} />
                  <span>GPS</span>
                </button>
                <button
                  class={styles.controlRoundButton}
                  classList={{ [styles.roundActiveYellow]: flashlightEnabled() }}
                  onClick={() => void toggleFlashlight()}
                  title={t('control.flashlight', language())}
                >
                  <img src="./img/icons_ios/ui-flashlight.svg" alt="" draggable={false} />
                  <span>{t('control.flashlight', language())}</span>
                </button>
                <button
                  class={styles.controlRoundButton}
                  classList={{ [styles.roundActiveGreen]: phoneState.settings.streamerMode === true }}
                  onClick={() => void phoneActions.setStreamerMode(!phoneState.settings.streamerMode)}
                  title={t('settings.streamer_mode', language())}
                >
                  <img src="./img/icons_ios/ui-eye.svg" alt="" draggable={false} />
                  <span>{streamerControlLabel(language())}</span>
                </button>
                <button
                  class={styles.controlRoundButton}
                  onClick={() => {
                    notificationsActions.setControlCenterOpen(false);
                    emitInternalEvent('phone:openRoute', { route: 'camera', data: {} });
                  }}
                  title={appName('camera', 'Camera', language())}
                >
                  <img src="./img/icons_ios/camera.svg" alt="" draggable={false} />
                  <span>{appName('camera', 'Camera', language())}</span>
                </button>
                <button
                  class={styles.controlRoundButton}
                  onClick={() => {
                    notificationsActions.setControlCenterOpen(false);
                    emitInternalEvent('phone:lockPhone', {});
                  }}
                  title={lockLabel(language())}
                >
                  <img src="./img/icons_ios/ui-lock.svg" alt="" draggable={false} />
                  <span>{lockLabel(language())}</span>
                </button>
              </section>

              <Show when={flashlightEnabled()}>
                <section class={`${styles.controlModule} ${styles.flashlightModule}`}>
                  <div class={styles.flashlightHeader}>
                    <img src="./img/icons_ios/ui-flashlight.svg" alt="" draggable={false} />
                    <span>{t('control.flashlight', language())}</span>
                    <strong>{Math.max(10, flashlightPercent())}%</strong>
                  </div>
                  <input
                    class={`${styles.slider} ios-slider`}
                    type="range"
                    min="10"
                    max="100"
                    value={Math.max(10, flashlightPercent())}
                    style={{ '--value-percent': `${Math.max(10, flashlightPercent())}%` }}
                    data-control-interactive="true"
                    onPointerDown={(event) => event.stopPropagation()}
                    onPointerMove={(event) => event.stopPropagation()}
                    onPointerUp={(event) => event.stopPropagation()}
                    onPointerCancel={(event) => event.stopPropagation()}
                    onInput={(e) => {
                      const percent = Number(e.currentTarget.value);
                      const lumens = Math.round(flashlightMinLumens() + ((flashlightMaxLumens() - flashlightMinLumens()) * percent) / 100);
                      e.currentTarget.style.setProperty('--value-percent', `${percent}%`);
                      setFlashlightLumens(lumens);
                      void fetchKnownNui('cameraSetFlashlightSettings', { lumens, kelvin: flashlightKelvin() }, { success: true });
                    }}
                  />
                </section>
              </Show>
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
