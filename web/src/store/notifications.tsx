import { ParentComponent, batch, createContext, createEffect, createMemo, createSignal, onCleanup, useContext } from 'solid-js';
import { createStore } from 'solid-js/store';
import { useNuiCustomEvent } from '../utils/useNui';
import { sanitizeText } from '../utils/sanitize';
import { fetchKnownNui } from '../utils/fetchNui';
import type { PhoneNotification } from '../types';

export type FocusModeId = 'off' | 'personal' | 'work' | 'driving' | 'sleep';

export interface FocusModeConfig {
  allowedApps: string[];
  autoReply?: string;
}

const DEFAULT_FOCUS_CONFIGS: Record<string, FocusModeConfig> = {
  personal: { allowedApps: ['messages', 'calls', 'mail'], autoReply: '' },
  work: { allowedApps: ['calls', 'mail', 'messages', 'notes'], autoReply: '' },
  driving: { allowedApps: ['calls', 'maps'], autoReply: '' },
  sleep: { allowedApps: ['calls'], autoReply: '' },
};

export interface NotificationsState {
  queue: PhoneNotification[];
  history: PhoneNotification[];
  current: PhoneNotification | null;
  doNotDisturb: boolean;
  airplaneMode: boolean;
  silentMode: boolean;
  focusMode: FocusModeId;
  focusModeConfigs: Record<string, FocusModeConfig>;
  brightness: number;
  controlCenterOpen: boolean;
  notificationCenterOpen: boolean;
  notificationCompactMode: boolean;
  controlTilePreset: 'compact';
  controlTileOrder: string[];
  readAtByApp: Record<string, number>;
  mutedApps: string[];
}

export interface NotificationsActions {
  receive: (payload: Partial<PhoneNotification>) => void;
  remove: (id: string) => void;
  dismissCurrent: () => void;
  clear: () => void;
  setDoNotDisturb: (value: boolean) => void;
  setAirplaneMode: (value: boolean) => void;
  setSilentMode: (value: boolean) => void;
  setFocusMode: (mode: FocusModeId) => void;
  cycleFocusMode: () => void;
  updateFocusModeConfig: (mode: string, config: Partial<FocusModeConfig>) => void;
  setBrightness: (value: number) => void;
  toggleControlCenter: () => void;
  setControlCenterOpen: (value: boolean) => void;
  toggleNotificationCenter: () => void;
  setNotificationCenterOpen: (value: boolean) => void;
  toggleNotificationCompactMode: () => void;
  setControlTilePreset: (value: 'compact') => void;
  applyControlTileOrderPreset: (value: 'default' | 'commute' | 'focus') => void;
  markAppAsRead: (appId: string) => void;
  removeAppHistory: (appId: string) => void;
  getUnreadCount: (appId: string) => number;
  toggleMuteApp: (appId: string) => void;
  isAppMuted: (appId: string) => boolean;
}

type NotificationsStore = [NotificationsState, NotificationsActions];

const NotificationsContext = createContext<NotificationsStore>();

const MAX_QUEUE = 20;
const MAX_HISTORY = 40;
const DEFAULT_TILE_ORDER = ['airplane', 'dnd', 'silent', 'gps', 'preview'];
const MAX_MUTED_APPS = 40;
const MAX_READ_AT_ENTRIES = 100;

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
    sticky: payload.sticky === true,
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
  const persistedOrderRaw = window.localStorage.getItem('gcphone:controlTileOrder');
  const persistedOrder = normalizeTileOrder(persistedOrderRaw ? safeJsonParse(persistedOrderRaw) : null);
  const persistedMutedAppsRaw = window.localStorage.getItem('gcphone:mutedApps');
  const persistedMutedApps = normalizeMutedApps(persistedMutedAppsRaw ? safeJsonParse(persistedMutedAppsRaw) : null);

  const persistedFocusMode = (window.localStorage.getItem('gcphone:focusMode') || 'off') as FocusModeId;
  const persistedFocusConfigs = (() => {
    const raw = window.localStorage.getItem('gcphone:focusModeConfigs');
    if (!raw) return { ...DEFAULT_FOCUS_CONFIGS };
    const parsed = safeJsonParse(raw);
    return parsed && typeof parsed === 'object' ? { ...DEFAULT_FOCUS_CONFIGS, ...parsed } : { ...DEFAULT_FOCUS_CONFIGS };
  })();

  const [state, setState] = createStore<NotificationsState>({
    queue: [],
    history: [],
    current: null,
    doNotDisturb: false,
    airplaneMode: false,
    silentMode: false,
    focusMode: persistedFocusMode,
    focusModeConfigs: persistedFocusConfigs,
    brightness: 1,
    controlCenterOpen: false,
    notificationCenterOpen: false,
    notificationCompactMode: true,
    controlTilePreset: 'compact',
    controlTileOrder: persistedOrder,
    readAtByApp: {},
    mutedApps: persistedMutedApps,
  });

  const [timerVersion, setTimerVersion] = createSignal(0);
  let timeoutId: number | undefined;

  const unreadCountByApp = createMemo<Record<string, number>>(() => {
    const counts: Record<string, number> = {};

    for (const entry of state.history) {
      const appId = sanitizeText(entry.appId, 24);
      if (!appId) continue;

      const createdAt = Number(entry.createdAt) || 0;
      if (createdAt <= (state.readAtByApp[appId] || 0)) continue;

      counts[appId] = (counts[appId] || 0) + 1;
    }

    return counts;
  });

  const persistedPreferences = createMemo(() => ({
    notificationCompact: state.notificationCompactMode ? '1' : '0',
    controlTilePreset: state.controlTilePreset,
    controlTileOrder: JSON.stringify(state.controlTileOrder),
    mutedApps: JSON.stringify(state.mutedApps),
  }));

  const actions: NotificationsActions = {
    receive: (payload) => {
      const next = normalizeNotification(payload);
      if (!next) return;

      if (state.mutedApps.includes(next.appId) && next.priority !== 'high') return;

      if (state.doNotDisturb && next.priority !== 'high') return;

      if (state.focusMode !== 'off' && next.priority !== 'high') {
        const config = state.focusModeConfigs[state.focusMode];
        if (config && !config.allowedApps.includes(next.appId)) return;
      }

      setState('history', (current) => [next, ...current.filter((item) => item.id !== next.id)].slice(0, MAX_HISTORY));

      if (state.current?.id === next.id) {
        batch(() => {
          setState('current', next);
          setTimerVersion((v) => v + 1);
        });
        return;
      }

      if (state.queue.some((item) => item.id === next.id)) {
        setState('queue', (current) => current.map((item) => (item.id === next.id ? next : item)));
        return;
      }

      if (!state.current) {
        setState('current', next);
        return;
      }

      const nextQueue = [...state.queue, next].slice(-MAX_QUEUE);
      setState('queue', nextQueue);
    },
    remove: (id) => {
      const key = sanitizeText(id, 64);
      if (!key) return;

      setState('history', (current) => current.filter((item) => item.id !== key));
      setState('queue', (current) => current.filter((item) => item.id !== key));

      if (state.current?.id === key) {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = undefined;
        }

        if (state.queue.length > 0) {
          const [head, ...rest] = state.queue.filter((item) => item.id !== key);
          setState('queue', rest);
          setState('current', head || null);
        } else {
          setState('current', null);
        }

        setTimerVersion((v) => v + 1);
      }
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
      void fetchKnownNui('setAirplaneMode', { enabled: next }, true);
    },
    setSilentMode: (value) => {
      setState('silentMode', !!value);
    },
    setFocusMode: (mode: FocusModeId) => {
      setState('focusMode', mode);
      window.localStorage.setItem('gcphone:focusMode', mode);
    },
    cycleFocusMode: () => {
      const modes: FocusModeId[] = ['off', 'personal', 'work', 'driving', 'sleep'];
      const current = modes.indexOf(state.focusMode);
      const next = modes[(current + 1) % modes.length];
      setState('focusMode', next);
      window.localStorage.setItem('gcphone:focusMode', next);
    },
    updateFocusModeConfig: (mode: string, config: Partial<FocusModeConfig>) => {
      setState('focusModeConfigs', mode, (prev) => ({ ...prev, ...config }));
      window.localStorage.setItem('gcphone:focusModeConfigs', JSON.stringify(state.focusModeConfigs));
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
    setControlTilePreset: (value) => {
      setState('controlTilePreset', value);
    },
    applyControlTileOrderPreset: (value) => {
      if (value === 'commute') {
        setState('controlTileOrder', ['gps', 'silent', 'dnd', 'airplane', 'preview']);
        return;
      }
      if (value === 'focus') {
        setState('controlTileOrder', ['dnd', 'silent', 'airplane', 'gps', 'preview']);
        return;
      }
      setState('controlTileOrder', [...DEFAULT_TILE_ORDER]);
    },
    markAppAsRead: (appId: string) => {
      const key = sanitizeText(appId, 24);
      if (!key) return;
      const entries = Object.keys(state.readAtByApp);
      if (entries.length >= MAX_READ_AT_ENTRIES && !(key in state.readAtByApp)) {
        const sorted = entries.sort((a, b) => (state.readAtByApp[a] || 0) - (state.readAtByApp[b] || 0));
        const pruned = { ...state.readAtByApp };
        for (let i = 0; i < sorted.length - MAX_READ_AT_ENTRIES + 1; i++) {
          delete pruned[sorted[i]];
        }
        pruned[key] = Date.now();
        setState('readAtByApp', pruned);
      } else {
        setState('readAtByApp', key, Date.now());
      }
    },
    removeAppHistory: (appId: string) => {
      const key = sanitizeText(appId, 24);
      if (!key) return;
      setState('history', (current) => current.filter((item) => item.appId !== key));
      const nextQueue = state.queue.filter((item) => item.appId !== key);
      setState('queue', nextQueue);
      if (state.current?.appId === key) {
        const [head, ...rest] = nextQueue;
        setState('queue', rest);
        setState('current', head || null);
        setTimerVersion((v) => v + 1);
      }
    },
    getUnreadCount: (appId: string) => {
      const key = sanitizeText(appId, 24);
      if (!key) return 0;
      return unreadCountByApp()[key] || 0;
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

  useNuiCustomEvent<{ mode?: string }>('phone:focusMode', (payload) => {
    const mode = payload?.mode;
    if (mode === 'off' || mode === 'personal' || mode === 'work' || mode === 'driving' || mode === 'sleep') {
      actions.setFocusMode(mode);
    }
  });

  createEffect(() => {
    timerVersion();
    if (timeoutId) clearTimeout(timeoutId);

    const current = state.current;
    if (!current) return;
    if (current.sticky) return;

    timeoutId = window.setTimeout(() => {
      actions.dismissCurrent();
    }, current.durationMs);
  });

  createEffect(() => {
    const preferences = persistedPreferences();
    window.localStorage.setItem('gcphone:notificationCompact', preferences.notificationCompact);
    window.localStorage.setItem('gcphone:controlTilePreset', preferences.controlTilePreset);
    window.localStorage.setItem('gcphone:controlTileOrder', preferences.controlTileOrder);
    window.localStorage.setItem('gcphone:mutedApps', preferences.mutedApps);
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
