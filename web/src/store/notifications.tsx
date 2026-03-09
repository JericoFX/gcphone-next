import { ParentComponent, createContext, createEffect, createSignal, onCleanup, useContext } from 'solid-js';
import { createStore } from 'solid-js/store';
import { useNuiCustomEvent } from '../utils/useNui';
import { sanitizeText } from '../utils/sanitize';
import { fetchNui } from '../utils/fetchNui';
import type { PhoneNotification } from '../types';

interface NotificationsState {
  queue: PhoneNotification[];
  history: PhoneNotification[];
  current: PhoneNotification | null;
  doNotDisturb: boolean;
  airplaneMode: boolean;
  silentMode: boolean;
  brightness: number;
  controlCenterOpen: boolean;
  notificationCenterOpen: boolean;
  notificationCompactMode: boolean;
  controlTilePreset: 'compact' | 'default' | 'large';
  controlTileOrder: string[];
  readAtByApp: Record<string, number>;
  mutedApps: string[];
}

interface NotificationsActions {
  receive: (payload: Partial<PhoneNotification>) => void;
  dismissCurrent: () => void;
  clear: () => void;
  setDoNotDisturb: (value: boolean) => void;
  setAirplaneMode: (value: boolean) => void;
  setSilentMode: (value: boolean) => void;
  setBrightness: (value: number) => void;
  toggleControlCenter: () => void;
  setControlCenterOpen: (value: boolean) => void;
  toggleNotificationCenter: () => void;
  setNotificationCenterOpen: (value: boolean) => void;
  toggleNotificationCompactMode: () => void;
  setControlTilePreset: (value: 'compact' | 'default' | 'large') => void;
  applyControlTileOrderPreset: (value: 'default' | 'commute' | 'focus') => void;
  markAppAsRead: (appId: string) => void;
  getUnreadCount: (appId: string) => number;
  toggleMuteApp: (appId: string) => void;
  isAppMuted: (appId: string) => boolean;
}

type NotificationsStore = [NotificationsState, NotificationsActions];

const NotificationsContext = createContext<NotificationsStore>();

const MAX_QUEUE = 20;
const MAX_HISTORY = 40;
const DEFAULT_TILE_ORDER = ['airplane', 'dnd', 'data', 'silent', 'gps', 'preview'];
const MAX_MUTED_APPS = 40;

function safeJsonParse(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeTileOrder(value: unknown) {
  if (!Array.isArray(value)) return DEFAULT_TILE_ORDER;
  const known = new Set(DEFAULT_TILE_ORDER);
  const list = value
    .map((entry) => sanitizeText(String(entry || ''), 24))
    .filter((entry) => known.has(entry));

  for (const id of DEFAULT_TILE_ORDER) {
    if (!list.includes(id)) list.push(id);
  }

  return list.slice(0, DEFAULT_TILE_ORDER.length);
}

function normalizeNotification(payload: Partial<PhoneNotification>): PhoneNotification | null {
  const title = sanitizeText(payload.title, 48);
  const message = sanitizeText(payload.message, 140);
  if (!title && !message) return null;

  return {
    id: sanitizeText(payload.id || `${Date.now()}-${Math.random()}`, 64) || `${Date.now()}`,
    appId: sanitizeText(payload.appId || 'system', 24) || 'system',
    title: title || 'Notificacion',
    message,
    icon: sanitizeText(payload.icon || '', 8),
    durationMs: Math.max(1200, Math.min(Number(payload.durationMs || 3200), 12000)),
    priority: payload.priority === 'high' ? 'high' : payload.priority === 'low' ? 'low' : 'normal',
    route: sanitizeText(payload.route || '', 40) || undefined,
    data: payload.data && typeof payload.data === 'object' ? payload.data : undefined,
    createdAt: Number(payload.createdAt) > 0 ? Number(payload.createdAt) : Date.now(),
  };
}

function normalizeMutedApps(value: unknown) {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const next: string[] = [];
  for (const item of value) {
    const appId = sanitizeText(String(item || ''), 24);
    if (!appId || seen.has(appId)) continue;
    seen.add(appId);
    next.push(appId);
    if (next.length >= MAX_MUTED_APPS) break;
  }
  return next;
}

export const NotificationsProvider: ParentComponent = (props) => {
  const persistedCompactMode = window.localStorage.getItem('gcphone:notificationCompact') === '1';
  const persistedOrderRaw = window.localStorage.getItem('gcphone:controlTileOrder');
  const persistedOrder = normalizeTileOrder(persistedOrderRaw ? safeJsonParse(persistedOrderRaw) : null);
  const persistedMutedAppsRaw = window.localStorage.getItem('gcphone:mutedApps');
  const persistedMutedApps = normalizeMutedApps(persistedMutedAppsRaw ? safeJsonParse(persistedMutedAppsRaw) : null);

  const [state, setState] = createStore<NotificationsState>({
    queue: [],
    history: [],
    current: null,
    doNotDisturb: false,
    airplaneMode: false,
    silentMode: false,
    brightness: 1,
    controlCenterOpen: false,
    notificationCenterOpen: false,
    notificationCompactMode: persistedCompactMode,
    controlTilePreset: 'compact',
    controlTileOrder: persistedOrder,
    readAtByApp: {},
    mutedApps: persistedMutedApps,
  });

  const [timerVersion, setTimerVersion] = createSignal(0);
  let timeoutId: number | undefined;

  const actions: NotificationsActions = {
    receive: (payload) => {
      const next = normalizeNotification(payload);
      if (!next) return;

      setState('history', (current) => [next, ...current.filter((item) => item.id !== next.id)].slice(0, MAX_HISTORY));

      if (state.mutedApps.includes(next.appId) && next.priority !== 'high') return;

      if (state.doNotDisturb && next.priority !== 'high') return;

      if (state.current?.id === next.id || state.queue.some((item) => item.id === next.id)) return;

      if (!state.current) {
        setState('current', next);
        return;
      }

      const nextQueue = [...state.queue, next].slice(-MAX_QUEUE);
      setState('queue', nextQueue);
    },
    dismissCurrent: () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = undefined;
      }
      if (state.queue.length > 0) {
        const [head, ...rest] = state.queue;
        setState('queue', rest);
        setState('current', head);
      } else {
        setState('current', null);
      }
      setTimerVersion((v) => v + 1);
    },
    clear: () => {
      setState('queue', []);
      setState('current', null);
      setState('history', []);
      setState('readAtByApp', {});
    },
    setDoNotDisturb: (value) => {
      setState('doNotDisturb', !!value);
    },
    setAirplaneMode: (value) => {
      const next = !!value;
      setState('airplaneMode', next);
      void fetchNui('setAirplaneMode', { enabled: next }, true);
    },
    setSilentMode: (value) => {
      setState('silentMode', !!value);
    },
    setBrightness: (value) => {
      const next = Math.max(0.4, Math.min(1.2, Number(value) || 1));
      setState('brightness', next);
    },
    toggleControlCenter: () => {
      setState('controlCenterOpen', (prev) => !prev);
    },
    setControlCenterOpen: (value) => {
      setState('controlCenterOpen', !!value);
    },
    toggleNotificationCenter: () => {
      setState('notificationCenterOpen', (prev) => !prev);
    },
    setNotificationCenterOpen: (value) => {
      setState('notificationCenterOpen', !!value);
    },
    toggleNotificationCompactMode: () => {
      setState('notificationCompactMode', (prev) => !prev);
    },
    setControlTilePreset: () => {
      setState('controlTilePreset', 'compact');
    },
    applyControlTileOrderPreset: (value) => {
      if (value === 'commute') {
        setState('controlTileOrder', ['data', 'gps', 'silent', 'dnd', 'airplane', 'preview']);
        return;
      }
      if (value === 'focus') {
        setState('controlTileOrder', ['dnd', 'silent', 'airplane', 'data', 'gps', 'preview']);
        return;
      }
      setState('controlTileOrder', [...DEFAULT_TILE_ORDER]);
    },
    markAppAsRead: (appId: string) => {
      const key = sanitizeText(appId, 24);
      if (!key) return;
      setState('readAtByApp', key, Date.now());
    },
    getUnreadCount: (appId: string) => {
      const key = sanitizeText(appId, 24);
      if (!key) return 0;
      const localRead = state.readAtByApp[key] || 0;
      return state.history.filter((n) => n.appId === key && (n.createdAt || 0) > localRead).length;
    },
    toggleMuteApp: (appId: string) => {
      const key = sanitizeText(appId, 24);
      if (!key) return;
      setState('mutedApps', (current) => {
        if (current.includes(key)) return current.filter((entry) => entry !== key);
        const next = [key, ...current.filter((entry) => entry !== key)];
        return next.slice(0, MAX_MUTED_APPS);
      });
    },
    isAppMuted: (appId: string) => {
      const key = sanitizeText(appId, 24);
      if (!key) return false;
      return state.mutedApps.includes(key);
    },
  };

  useNuiCustomEvent<Partial<PhoneNotification>>('phone:notification', (payload) => {
    actions.receive(payload || {});
  });

  createEffect(() => {
    timerVersion();
    if (timeoutId) clearTimeout(timeoutId);

    const current = state.current;
    if (!current) return;

    timeoutId = window.setTimeout(() => {
      actions.dismissCurrent();
    }, current.durationMs);
  });

  createEffect(() => {
    window.localStorage.setItem('gcphone:notificationCompact', state.notificationCompactMode ? '1' : '0');
    window.localStorage.setItem('gcphone:controlTilePreset', state.controlTilePreset);
    window.localStorage.setItem('gcphone:controlTileOrder', JSON.stringify(state.controlTileOrder));
    window.localStorage.setItem('gcphone:mutedApps', JSON.stringify(state.mutedApps));
  });

  onCleanup(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });

  return <NotificationsContext.Provider value={[state, actions]}>{props.children}</NotificationsContext.Provider>;
};

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
}
