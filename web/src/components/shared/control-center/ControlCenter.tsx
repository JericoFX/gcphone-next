import { For, Show, createEffect, createMemo, createSignal, onMount, onCleanup } from 'solid-js';
import { Motion, Presence } from '@motionone/solid';
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

function nfcSearchingLabel(lang: string): string {
  const labels: Record<string, string> = {
    es: 'Buscando personas...',
    en: 'Looking for nearby people...',
    fr: 'Recherche de personnes...',
    de: 'Suche nach Personen...',
    pt: 'Buscando pessoas...',
    ru: 'Looking for nearby people...',
    pl: 'Szukanie osob...',
    it: 'Ricerca persone...',
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

function notificationCountLabel(count: number, lang: string): string {
  const labels: Record<string, (value: number) => string> = {
    es: (value) => `${value} ${value === 1 ? 'notificacion' : 'notificaciones'}`,
    en: (value) => `${value} ${value === 1 ? 'notification' : 'notifications'}`,
    fr: (value) => `${value} ${value === 1 ? 'notification' : 'notifications'}`,
    de: (value) => `${value} ${value === 1 ? 'Mitteilung' : 'Mitteilungen'}`,
    pt: (value) => `${value} ${value === 1 ? 'notificacao' : 'notificacoes'}`,
    ru: (value) => `${value} notifications`,
    pl: (value) => `${value} ${value === 1 ? 'powiadomienie' : 'powiadomienia'}`,
    it: (value) => `${value} ${value === 1 ? 'notifica' : 'notifiche'}`,
  };
  return (labels[lang] || labels.en)(count);
}

function unreadCountLabel(count: number, lang: string): string {
  const labels: Record<string, (value: number) => string> = {
    es: (value) => `${value} ${value === 1 ? 'nueva' : 'nuevas'}`,
    en: (value) => `${value} ${value === 1 ? 'new' : 'new'}`,
    fr: (value) => `${value} ${value === 1 ? 'nouvelle' : 'nouvelles'}`,
    de: (value) => `${value} ${value === 1 ? 'neu' : 'neu'}`,
    pt: (value) => `${value} ${value === 1 ? 'nova' : 'novas'}`,
    ru: (value) => `${value} new`,
    pl: (value) => `${value} ${value === 1 ? 'nowe' : 'nowe'}`,
    it: (value) => `${value} ${value === 1 ? 'nuova' : 'nuove'}`,
  };
  return (labels[lang] || labels.en)(count);
}

function appsCountLabel(count: number, lang: string): string {
  const labels: Record<string, (value: number) => string> = {
    es: (value) => `${value} ${value === 1 ? 'app' : 'apps'}`,
    en: (value) => `${value} ${value === 1 ? 'app' : 'apps'}`,
    fr: (value) => `${value} ${value === 1 ? 'app' : 'apps'}`,
    de: (value) => `${value} ${value === 1 ? 'App' : 'Apps'}`,
    pt: (value) => `${value} ${value === 1 ? 'app' : 'apps'}`,
    ru: (value) => `${value} apps`,
    pl: (value) => `${value} ${value === 1 ? 'aplikacja' : 'aplikacje'}`,
    it: (value) => `${value} ${value === 1 ? 'app' : 'app'}`,
  };
  return (labels[lang] || labels.en)(count);
}

function mutedSummaryHintLabel(lang: string): string {
  const labels: Record<string, string> = {
    es: 'Abrir Ajustes > Notificaciones',
    en: 'Open Settings > Notifications',
    fr: 'Ouvrir Reglages > Notifications',
    de: 'Einstellungen > Mitteilungen offnen',
    pt: 'Abrir Ajustes > Notificacoes',
    ru: 'Open Settings > Notifications',
    pl: 'Otworz Ustawienia > Powiadomienia',
    it: 'Apri Impostazioni > Notifiche',
  };
  return labels[lang] || labels.en;
}

function groupedByAppLabel(lang: string): string {
  const labels: Record<string, string> = {
    es: 'Agrupadas por app',
    en: 'Grouped by app',
    fr: 'Groupees par app',
    de: 'Nach App gruppiert',
    pt: 'Agrupadas por app',
    ru: 'Grouped by app',
    pl: 'Pogrupowane wedlug aplikacji',
    it: 'Raggruppate per app',
  };
  return labels[lang] || labels.en;
}

function notificationPreviewLabel(title: string, message: string, appTitle: string): string {
  const trimmedTitle = title.trim();
  const trimmedMessage = message.trim();
  if (trimmedTitle && trimmedTitle !== appTitle) {
    return trimmedMessage ? `${trimmedTitle}: ${trimmedMessage}` : trimmedTitle;
  }
  return trimmedMessage || trimmedTitle || appTitle;
}

function showLessLabel(lang: string): string {
  const labels: Record<string, string> = {
    es: 'Mostrar menos',
    en: 'Show less',
    fr: 'Afficher moins',
    de: 'Weniger zeigen',
    pt: 'Mostrar menos',
    ru: 'Show less',
    pl: 'Pokaz mniej',
    it: 'Mostra meno',
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
  const [nfcRefreshing, setNfcRefreshing] = createSignal(false);
  const [nearbyPlayers, setNearbyPlayers] = createSignal<NearbyPlayerData[]>([]);
  const [nfcTargetServerId, setNfcTargetServerId] = createSignal<number | null>(null);
  const [expandedNotificationApps, setExpandedNotificationApps] = createSignal<string[]>([]);

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
    return Array.from(groups.entries())
      .map(([appId, items]) => {
        const latestAt = Math.max(...items.map((item) => Number(item.createdAt) || 0));
        return {
          appId,
          items,
          latestAt,
          unreadCount: notificationsActions.getUnreadCount(appId),
          muted: notificationsActions.isAppMuted(appId),
          icon: APP_BY_ID[appId]?.icon || './img/icons_ios/settings.svg',
          title: appName(appId, APP_BY_ID[appId]?.name || appId, language()),
        };
      })
      .sort((a, b) => b.latestAt - a.latestAt);
  });

  const totalNotificationCount = createMemo(() => notifications.history.length);
  const mutedAppsCount = createMemo(() => notifications.mutedApps.length);
  const mutedAppLabels = createMemo(() => (
    notifications.mutedApps
      .slice(0, 3)
      .map((appId) => appName(appId, APP_BY_ID[appId]?.name || appId, language()))
  ));
  const mutedSummaryLabel = createMemo(() => {
    if (mutedAppsCount() === 0) return mutedSummaryHintLabel(language());
    const names = mutedAppLabels().join(', ');
    const extra = mutedAppsCount() - mutedAppLabels().length;
    return extra > 0 ? `${names} +${extra}` : names;
  });

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
      setNfcRefreshing(false);
      return;
    }
    setNfcRefreshing(true);
    const previousSelectedId = nfcTargetServerId();
    const players = await fetchKnownNui('getNearbyPlayers', { maxDistance: 3.0 }, []);
    setNearbyPlayers(players);
    if (players.length === 0) {
      setNfcTargetServerId(null);
      setNfcRefreshing(false);
      return;
    }
    if (!previousSelectedId || !players.some((player) => player.serverId === previousSelectedId)) {
      setNfcTargetServerId(players[0].serverId);
    }
    setNfcRefreshing(false);
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
      setNfcRefreshing(true);
      notificationsActions.receive({
        id: 'control-nfc-status',
        appId: 'settings',
        title: 'NFC',
        message: `${nfcOnLabel(language())} - ${t('control.center', language())}`,
        priority: 'normal',
      });
      void syncNearbyPlayers();
      return;
    }
    notificationsActions.receive({
      id: 'control-nfc-status',
      appId: 'settings',
      title: 'NFC',
      message: `${nfcOffLabel(language())} - ${t('control.center', language())}`,
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
        message: `${nfcOffLabel(language())} - ${t('control.center', language())}`,
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
        message: `${nfcNoNearbyLabel(language())} - ${t('control.center', language())}`,
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

  const toggleNotificationGroup = (appId: string) => {
    setExpandedNotificationApps((current) => (
      current.includes(appId)
        ? current.filter((entry) => entry !== appId)
        : [...current, appId]
    ));
  };

  const openMutedNotificationSettings = () => {
    notificationsActions.setNotificationCenterOpen(false);
    emitInternalEvent('phone:openRoute', {
      route: 'settings',
      data: { section: 'notifications', focus: 'muted', requestId: Date.now() },
    });
  };

  const visibleItemsForGroup = (appId: string, items: Array<{ id: string; title: string; message: string; route?: string; data?: Record<string, unknown>; createdAt?: number }>) => {
    return expandedNotificationApps().includes(appId) ? items : items.slice(0, 2);
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
    let suppressClick = false;
    let itemEl: HTMLElement | null = null;
    let trackEl: HTMLElement | null = null;

    const onPointerDown = (e: PointerEvent) => {
      itemEl = e.currentTarget as HTMLElement;
      trackEl = itemEl.parentElement;
      startX = e.clientX;
      currentX = startX;
      swiping = true;
      suppressClick = false;
      itemEl.setPointerCapture(e.pointerId);
      itemEl.style.transition = 'none';
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!swiping || !itemEl) return;
      currentX = e.clientX;
      const deltaX = currentX - startX;
      if (Math.abs(deltaX) > 10) suppressClick = true;
      itemEl.style.transform = `translate3d(${deltaX}px, 0, 0)`;

      if (trackEl) {
        const bg = trackEl.querySelector('[data-swipe-bg]') as HTMLElement;
        if (bg) {
          bg.classList.toggle(styles.swipeBgVisible, Math.abs(deltaX) > 30);
          bg.classList.toggle(styles.swipeBgLeft, deltaX < 0);
          bg.classList.toggle(styles.swipeBgRight, deltaX > 0);
        }
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
          const bg = trackEl.querySelector('[data-swipe-bg]') as HTMLElement;
          if (bg) bg.className = styles.swipeBg;
        }
      }
    };

    const onClick = (event: MouseEvent, action: () => void) => {
      if (suppressClick) {
        suppressClick = false;
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      action();
    };

    return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onClick };
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

  const stopControlPointer = (event: PointerEvent) => {
    event.stopPropagation();
  };

  const stopControlClick = (event: MouseEvent) => {
    event.stopPropagation();
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
      <Presence>
        <Show when={notifications.notificationCenterOpen}>
          <Motion.div
            class={styles.overlay}
            data-testid="notification-center-sheet"
            onClick={() => notificationsActions.setNotificationCenterOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
          >
          <Motion.div
            class={`${styles.sheet} ${styles.notificationSheet}`}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={handleSheetPointerDown}
            onPointerUp={(e) => handleSheetPointerUp(e, 'notifications')}
            initial={{ y: -28, opacity: 0.92, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -24, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.26, easing: [0.32, 0.72, 0, 1] }}
          >
            <div class={styles.sheetHeader}>
              <div class={styles.grabber} />
              <h3>{t('control.notifications', language())}</h3>
              <span class={styles.headerDate}>{dayLabel()}</span>
            </div>

            <div class={styles.summaryRow}>
              <article class={styles.summaryCard} data-testid="notification-center-total-summary">
                <span>{t('control.notifications_total', language())}</span>
                <strong>{totalNotificationCount()}</strong>
                <small>{appsCountLabel(groupedNotifications().length, language())}</small>
              </article>
              <button
                type="button"
                class={`${styles.summaryCard} ${styles.summaryCardButton}`}
                data-testid="notification-muted-summary"
                onClick={openMutedNotificationSettings}
              >
                <div class={styles.summaryCardTop}>
                  <span>{t('control.muted', language())}</span>
                  <strong>{mutedAppsCount()}</strong>
                </div>
                <small>{mutedSummaryLabel()}</small>
              </button>
            </div>

            <div class={styles.notificationList}>
              <Show when={groupedNotifications().length > 0} fallback={
                <div class={styles.empty}>
                  <div class={styles.emptyBadge}>{groupedByAppLabel(language())}</div>
                  <strong>{t('notifications.none_saved', language())}</strong>
                  <span>{t('control.empty_notifications_desc', language())}</span>
                </div>
              }>
                <For each={groupedNotifications()}>
                  {(group, groupIndex) => (
                    <Motion.div
                      class={styles.notificationGroup}
                      classList={{ [styles.notificationGroupMuted]: group.muted }}
                      data-testid={`notification-center-group-${group.appId}`}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: Math.min(groupIndex(), 5) * 0.025 }}
                    >
                      <div class={styles.groupTitle}>
                        <img src={group.icon} alt="" />
                        <div class={styles.groupMeta}>
                          <div class={styles.groupNameRow}>
                            <span>{group.title}</span>
                            <Show when={group.muted}>
                              <em>{t('control.muted', language())}</em>
                            </Show>
                          </div>
                          <div class={styles.groupSummaryRow}>
                            <small class={styles.groupPreview}>
                              {notificationPreviewLabel(group.items[0]?.title || '', group.items[0]?.message || '', group.title)}
                            </small>
                            <small class={styles.groupStats}>
                              {group.unreadCount > 0
                                ? unreadCountLabel(group.unreadCount, language())
                                : notificationCountLabel(group.items.length, language())}
                              <Show when={group.latestAt > 0}> - {formatTime(group.latestAt)}</Show>
                            </small>
                          </div>
                        </div>
                        <Show when={group.unreadCount > 0}>
                          <b class={styles.groupUnreadBadge}>{group.unreadCount}</b>
                        </Show>
                      </div>
                      <div class={styles.groupActions} data-control-interactive="true">
                        <button
                          data-testid={`notification-center-group-read-${group.appId}`}
                          onClick={() => notificationsActions.markAppAsRead(group.appId)}
                          disabled={group.unreadCount <= 0}
                        >
                          {t('notifications.read_all', language())}
                        </button>
                        <button
                          data-testid={`notification-center-group-mute-${group.appId}`}
                          onClick={() => notificationsActions.toggleMuteApp(group.appId)}
                        >
                          {group.muted ? t('notifications.enable', language()) : t('notifications.mute', language())}
                        </button>
                        <button
                          class={styles.groupActionDanger}
                          data-testid={`notification-center-group-clear-${group.appId}`}
                          onClick={() => notificationsActions.removeAppHistory(group.appId)}
                        >
                          {t('control.clear', language())}
                        </button>
                      </div>
                      <For each={visibleItemsForGroup(group.appId, group.items)}>
                        {(item, itemIndex) => {
                          const swipe = createSwipeHandlers(item.id);
                          return (
                            <Motion.div
                              class={styles.swipeTrack}
                              data-control-interactive="true"
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.18, delay: Math.min(itemIndex(), 4) * 0.025 }}
                            >
                              <div class={styles.swipeBg} data-swipe-bg aria-hidden="true">{t('control.delete', language())}</div>
                              <button
                                class={styles.notificationItem}
                                classList={{ [styles.notificationItemUnread]: group.unreadCount > 0 && Number(item.createdAt || 0) > (notifications.readAtByApp[group.appId] || 0) }}
                                data-control-interactive="true"
                                data-testid={`notification-center-item-${item.id}`}
                                onPointerDown={swipe.onPointerDown}
                                onPointerMove={swipe.onPointerMove}
                                onPointerUp={swipe.onPointerUp}
                                onPointerCancel={swipe.onPointerCancel}
                                onClick={(event) => swipe.onClick(event, () => {
                                  notificationsActions.markAppAsRead(group.appId);
                                  notificationsActions.setNotificationCenterOpen(false);
                                  openRoute(item.route, item.data);
                                })}
                              >
                                <span class={styles.itemMeta}>
                                  <span>{item.title}</span>
                                  <small>{formatTime(item.createdAt)}</small>
                                </span>
                                <strong>
                                  <span>{group.title}</span>
                                </strong>
                                <span>{item.message}</span>
                              </button>
                            </Motion.div>
                          );
                        }}
                      </For>
                      <Show when={group.items.length > 2}>
                        <button
                          class={styles.moreCount}
                          data-testid={`notification-center-more-${group.appId}`}
                          onClick={() => toggleNotificationGroup(group.appId)}
                        >
                          {expandedNotificationApps().includes(group.appId)
                            ? showLessLabel(language())
                            : t('control.more_count', language(), { n: group.items.length - 2 })}
                        </button>
                      </Show>
                    </Motion.div>
                  )}
                </For>
              </Show>
            </div>

            <div class={styles.sheetFooter}>
              <button class={styles.clearBtn} data-testid="notification-center-clear" onClick={() => notificationsActions.clear()}>{t('control.clear', language())}</button>
              <button class={styles.closeBtn} data-testid="notification-center-close" onClick={() => notificationsActions.setNotificationCenterOpen(false)}>{t('control.close', language())}</button>
            </div>
          </Motion.div>
          </Motion.div>
        </Show>
      </Presence>

      {/* ── Control Center ── */}
      <Presence>
      <Show when={notifications.controlCenterOpen}>
        <Motion.div
          class={styles.overlay}
          data-testid="control-center-sheet"
          onClick={() => notificationsActions.setControlCenterOpen(false)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
        >
          <Motion.div
            class={`${styles.sheet} ${styles.controlSheet}`}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={handleSheetPointerDown}
            onPointerUp={(e) => handleSheetPointerUp(e, 'control')}
            initial={{ y: -30, opacity: 0.94, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -26, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.26, easing: [0.32, 0.72, 0, 1] }}
          >
            <div class={styles.sheetHeader}>
              <div class={styles.grabber} />
            </div>

            <div class={styles.controlMosaic}>
              <Motion.section
                class={`${styles.controlModule} ${styles.nfcModule}`}
                classList={{ [styles.nfcModuleOff]: !nfcEnabled() }}
                data-control-interactive="true"
                onPointerDown={stopControlPointer}
                onPointerMove={stopControlPointer}
                onPointerUp={stopControlPointer}
                onPointerCancel={stopControlPointer}
                onClick={stopControlClick}
                initial={false}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.2 }}
              >
                <div class={styles.nfcHeader}>
                  <button
                    class={styles.nfcTogglePill}
                    classList={{ [styles.nfcToggleActive]: nfcEnabled() }}
                    data-testid="control-center-nfc-toggle"
                    onClick={toggleNfc}
                    title={nfcEnabled() ? nfcOnLabel(language()) : nfcOffLabel(language())}
                  >
                    NFC
                  </button>
                  <button
                    class={styles.refreshButton}
                    classList={{ [styles.refreshButtonActive]: nfcEnabled() }}
                    onClick={() => nfcEnabled() ? void syncNearbyPlayers() : toggleNfc()}
                    title={nfcEnabled() ? t('control.nfc_refresh', language()) : nfcOffLabel(language())}
                    aria-label={nfcEnabled() ? t('control.nfc_refresh', language()) : nfcOffLabel(language())}
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
                  title={nearbyPlayers().length > 1 ? t('control.nfc_change_person', language()) : undefined}
                  aria-label={nearbyPlayers().length > 1 ? t('control.nfc_change_person', language()) : undefined}
                >
                  <span>{t('nfc.nearby_people', language())}</span>
                  <strong>
                    <Show when={nfcEnabled()} fallback={nfcOffLabel(language())}>
                      <Show when={selectedNfcTarget()} fallback={nfcRefreshing() ? nfcSearchingLabel(language()) : nfcNoNearbyLabel(language())}>
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
                    title={appName('wallet', 'Wallet', language())}
                    aria-label={appName('wallet', 'Wallet', language())}
                    onClick={() => openNfcRoute('wallet')}
                  >
                    <img src="./img/icons_ios/wallet.svg" alt="" draggable={false} />
                  </button>
                  <button
                    disabled={!nfcEnabled() || !selectedNfcTarget()}
                    title={appName('gallery', 'Gallery', language())}
                    aria-label={appName('gallery', 'Gallery', language())}
                    onClick={() => openNfcRoute('gallery')}
                  >
                    <img src="./img/icons_ios/gallery.svg" alt="" draggable={false} />
                  </button>
                  <button
                    disabled={!nfcEnabled() || !selectedNfcTarget()}
                    title={appName('documents', 'Documents', language())}
                    aria-label={appName('documents', 'Documents', language())}
                    onClick={() => openNfcRoute('documents')}
                  >
                    <img src="./img/icons_ios/documents.svg" alt="" draggable={false} />
                  </button>
                </div>
              </Motion.section>

              <Motion.section
                class={`${styles.controlModule} ${styles.verticalSliderModule}`}
                initial={{ opacity: 0, y: 10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.2, delay: 0.03 }}
              >
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
                    data-testid="control-center-brightness-slider"
                    data-control-interactive="true"
                    type="range"
                    min="40"
                    max="120"
                    value={brightnessPercent()}
                    onPointerDown={(event) => event.stopPropagation()}
                    onInput={(e) => notificationsActions.setBrightness(Number(e.currentTarget.value) / 100)}
                  />
                </div>
                <strong>{brightnessPercent()}%</strong>
              </Motion.section>

              <Motion.section
                class={`${styles.controlModule} ${styles.verticalSliderModule}`}
                initial={{ opacity: 0, y: 10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.2, delay: 0.06 }}
              >
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
                    data-testid="control-center-volume-slider"
                    data-control-interactive="true"
                    type="range"
                    min="0"
                    max="100"
                    value={volumePercent()}
                    onPointerDown={(event) => event.stopPropagation()}
                    onInput={(e) => phoneActions.setVolume(Number(e.currentTarget.value) / 100)}
                  />
                </div>
                <strong>{volumePercent()}%</strong>
              </Motion.section>

              <Motion.section
                class={`${styles.controlModule} ${styles.quickActionsModule}`}
                initial={{ opacity: 0, y: 10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.22, delay: 0.09 }}
              >
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
              </Motion.section>

              <Show when={flashlightEnabled()}>
                <Motion.section
                  class={`${styles.controlModule} ${styles.flashlightModule}`}
                  initial={{ opacity: 0, y: 10, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.98 }}
                  transition={{ duration: 0.18 }}
                >
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
                </Motion.section>
              </Show>
            </div>

            <div class={styles.sheetFooter}>
              <button class={styles.closeBtn} onClick={() => notificationsActions.setControlCenterOpen(false)}>{t('control.close', language())}</button>
            </div>
          </Motion.div>
        </Motion.div>
      </Show>
      </Presence>
    </>
  );
}
