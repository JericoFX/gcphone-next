import { 
  createContext, 
  useContext, 
  ParentComponent,
  onMount,
  batch,
  createMemo
} from 'solid-js';
import { createStore } from 'solid-js/store';
import { fetchNui } from '../utils/fetchNui';
import { normalizeAppLanguage } from '../utils/misc';
import type { AppLanguage } from '../i18n';
import { useNuiCustomEvent } from '../utils/useNui';
import type { AppLayout, PhoneFeatureFlags, PhoneFramework, PhoneSettings, PhoneSetupPayload, PhoneState, PhoneSetupState } from '../types';
import type { Folder, WidgetLayout, WidgetType, WidgetSize, IconShape } from '../types/home';
import { DEFAULT_WIDGET_LAYOUT, MAX_WIDGETS, PINNED_APP_IDS } from '../types/home';
import { APP_IDS, DEFAULT_HOME_APPS, DEFAULT_MENU_APPS } from '../config/apps';
import * as folderOps from '../utils/folderOps';
import type { NormalizeContext } from '../utils/folderOps';
import { isEnvBrowser } from '../utils/misc';

export interface PhoneActions {
  show: () => void;
  hide: () => void;
  toggle: () => void;
  unlock: (code: string) => Promise<boolean>;
  verifyPin: (code: string) => Promise<boolean>;
  lock: () => void;
  refreshSetupState: () => Promise<void>;
  completeSetup: (payload: PhoneSetupPayload) => Promise<{ success: boolean; error?: string }>;
  setWallpaper: (url: string) => void;
  setRingtone: (ringtone: string) => void;
  setCallRingtone: (ringtone: string) => void;
  setNotificationTone: (tone: string) => void;
  setMessageTone: (tone: string) => void;
  setVolume: (volume: number) => void;
  setTheme: (theme: 'auto' | 'light' | 'dark') => void;
  setAccentColor: (color: string) => void;
  setFontSize: (size: string) => void;
  setPhoneCase: (phoneCase: string) => void;
  setLanguage: (language: AppLanguage) => void;
  setStreamerMode: (enabled: boolean) => void;
  setAudioProfile: (audioProfile: 'normal' | 'street' | 'vehicle' | 'silent') => void;
  setLockCode: (code: string) => void;
  setPhoneScale: (scale: number) => void;
  setSwipeUnlock: (enabled: boolean) => void;
  setScreenLockEnabled: (enabled: boolean) => void;
  unlockDirect: () => void;
  factoryReset: () => Promise<boolean>;
  loadAppLayout: () => Promise<void>;
  saveAppLayout: () => Promise<void>;
  reorderApp: (target: 'home' | 'menu', appId: string, targetIndex: number) => void;
  moveApp: (appId: string, from: 'home' | 'menu', to: 'home' | 'menu', targetIndex?: number) => void;
  createFolder: (name: string, apps: string[], color: string) => string;
  updateFolder: (folderId: string, updates: Partial<Pick<Folder, 'name' | 'color' | 'apps'>>) => void;
  deleteFolder: (folderId: string) => void;
  addAppToFolder: (folderId: string, appId: string) => void;
  removeAppFromFolder: (folderId: string, appId: string) => void;
  mergeTwoAppsIntoFolder: (appId1: string, appId2: string) => string;
  setIconShape: (shape: IconShape) => void;
  loadWidgetLayout: () => Promise<void>;
  saveWidgetLayout: () => Promise<void>;
  addWidget: (type: WidgetType, size: WidgetSize) => void;
  removeWidget: (widgetId: string) => void;
  reorderWidget: (widgetId: string, targetIndex: number) => void;
  resizeWidget: (widgetId: string, size: WidgetSize) => void;
}

interface PhoneContextValue {
  state: PhoneState;
  actions: PhoneActions;
}

const PhoneContext = createContext<PhoneContextValue>();
const PhoneStateContext = createContext<PhoneState>();
const PhoneActionsContext = createContext<PhoneContextValue['actions']>();

const defaultSettings: PhoneSettings = {
  phoneNumber: '',
  wallpaper: './img/background/back001.jpg',
  ringtone: 'call_1',
  callRingtone: 'call_1',
  notificationTone: 'notif_1',
  messageTone: 'msg_1',
  volume: 0.5,
  lockCode: '0000',
  swipeUnlock: false,
  screenLockEnabled: true,
  theme: 'light',
  language: 'es',
  audioProfile: 'normal',
  accentColor: window.localStorage.getItem('gcphone:accentColor') || 'blue',
  fontSize: window.localStorage.getItem('gcphone:fontSize') || 'default',
  phoneCase: window.localStorage.getItem('gcphone:phoneCase') || 'default',
  streamerMode: false,
  iconShape: window.localStorage.getItem('gcphone:iconShape') as IconShape || 'squircle',
};

function readSwipeUnlockPreference() {
  return window.localStorage.getItem('gcphone:swipeUnlock') === '1';
}

function readScreenLockPreference() {
  const stored = window.localStorage.getItem('gcphone:screenLockEnabled');
  return stored !== '0';
}

function readPhoneScalePreference(): number {
  const stored = window.localStorage.getItem('gcphone:phoneScale');
  if (!stored) return 1;
  const val = parseFloat(stored);
  return isNaN(val) ? 1 : Math.max(0.7, Math.min(1, val));
}

const defaultFeatureFlags: PhoneFeatureFlags = {
  appstore: true,
  wavechat: true,
  darkrooms: true,
  clips: true,
  wallet: true,
  mail: true,
  documents: true,
  music: true,
  yellowpages: true,
};

const defaultSetupState: PhoneSetupState = {
  requiresSetup: false,
  hasSnap: true,
  hasChirp: true,
  hasClips: true,
  hasMail: true,
  mailDomain: '',
};

const defaultLayout: AppLayout = {
  home: [...DEFAULT_HOME_APPS],
  menu: [...DEFAULT_MENU_APPS]
};

type PhonePayload = PhoneSettings & {
  framework?: PhoneFramework;
  imei?: string;
  deviceOwnerName?: string;
  isStolen?: boolean;
  stolenAt?: string | null;
  stolenReason?: string | null;
  appLayout?: AppLayout;
  enabledApps?: string[];
  featureFlags?: Partial<PhoneFeatureFlags>;
  requiresSetup?: boolean;
  setup?: PhoneSetupState;
  useLockScreen?: boolean;
  forceLockScreen?: boolean;
  accessMode?: 'own' | 'foreign-readonly' | 'foreign-full';
  accessOwnerName?: string;
  accessPhoneId?: string;
};

const PINNED_HOME_APPS = ['contacts', 'messages', 'mail'] as const;
const REQUIRED_ENABLED_APPS = ['contacts', 'messages', 'mail'] as const;

function normalizeFramework(value: unknown): PhoneFramework {
  if (value === 'esx' || value === 'qbcore' || value === 'qbox') return value;
  return 'unknown';
}

function ensureRequiredEnabledApps(enabledApps: string[]): string[] {
  const active = new Set<string>();

  for (const appId of enabledApps) {
    if (APP_IDS.includes(appId)) active.add(appId);
  }

  for (const appId of REQUIRED_ENABLED_APPS) {
    active.add(appId);
  }

  return APP_IDS.filter((appId) => active.has(appId));
}

const ALLOWED_APP_IDS: ReadonlySet<string> = new Set(APP_IDS);

function buildNormalizeContext(enabledApps: string[]): NormalizeContext {
  return {
    allowedAppIds: ALLOWED_APP_IDS,
    enabledAppIds: new Set(enabledApps),
    defaultHomeIds: DEFAULT_HOME_APPS,
    pinnedHomeIds: PINNED_HOME_APPS,
  };
}

function normalizeLayout(layout?: Partial<AppLayout> | null, enabledApps: string[] = APP_IDS): AppLayout {
  return folderOps.normalizeLayout(layout, buildNormalizeContext(enabledApps));
}

function normalizeFeatureFlags(input?: Partial<PhoneFeatureFlags> | null): PhoneFeatureFlags {
  return {
    appstore: input?.appstore !== false,
    wavechat: input?.wavechat !== false,
    darkrooms: input?.darkrooms !== false,
    clips: input?.clips !== false,
    wallet: input?.wallet !== false,
    mail: input?.mail !== false,
    documents: input?.documents !== false,
    music: input?.music !== false,
    yellowpages: input?.yellowpages !== false,
  };
}

function normalizeLanguage(value?: string | null): AppLanguage {
  return normalizeAppLanguage(value);
}

function enabledAppsFromFlags(flags: PhoneFeatureFlags): string[] {
  const byFlag: Record<keyof PhoneFeatureFlags, string[]> = {
    appstore: ['appstore'],
    wavechat: ['wavechat'],
    darkrooms: ['darkrooms'],
    clips: ['clips'],
    wallet: ['wallet'],
    mail: ['mail'],
    documents: ['documents'],
    music: ['music'],
    yellowpages: ['yellowpages'],
  };

  const blocked = new Set<string>();
  (Object.keys(byFlag) as Array<keyof PhoneFeatureFlags>).forEach((key) => {
    if (flags[key]) return;
    byFlag[key].forEach((id) => blocked.add(id));
  });

  return APP_IDS.filter((id) => !blocked.has(id));
}

export const PhoneProvider: ParentComponent = (props) => {
  const [state, setState] = createStore<PhoneState>({
    visible: false,
    locked: true,
    initialized: false,
    framework: 'unknown',
    imei: undefined,
    deviceOwnerName: undefined,
    isStolen: false,
    stolenAt: undefined,
    stolenReason: undefined,
    settings: { ...defaultSettings },
    appLayout: { ...defaultLayout },
    layoutVersion: 0,
    enabledApps: [...APP_IDS],
    featureFlags: { ...defaultFeatureFlags },
    requiresSetup: false,
    setup: { ...defaultSetupState },
    accessMode: 'own',
    accessOwnerName: undefined,
    accessPhoneId: undefined,
    widgetLayout: { ...DEFAULT_WIDGET_LAYOUT },
  });

  const setLayout = (layout?: Partial<AppLayout> | null, enabledApps = state.enabledApps) => {
    setState('appLayout', normalizeLayout(layout, enabledApps));
  };

  const isReadOnly = () => state.accessMode === 'foreign-readonly';

  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let savingPromise: Promise<void> | null = null;
  const SAVE_DEBOUNCE_MS = 400;
  const scheduleSave = () => {
    if (isReadOnly()) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = undefined;
      scheduleSave();
    }, SAVE_DEBOUNCE_MS);
  };
  
  const actions = {
    show: () => {
      setState('visible', true);
    },
    hide: () => {
      batch(() => {
        setState('visible', false);
        setState('locked', state.settings.screenLockEnabled !== false);
      });
    },
    toggle: () => {
      setState('visible', v => !v);
    },
    unlock: async (code: string) => {
      const payload = await fetchNui<{ success?: boolean; unlocked?: boolean }>('phoneVerifyPin', { pin: code }, { success: false, unlocked: false });
      if (payload?.success && payload?.unlocked) {
        setState('locked', false);
        return true;
      }
      return false;
    },
    verifyPin: async (code: string) => {
      const payload = await fetchNui<{ success?: boolean; unlocked?: boolean }>('phoneVerifyPin', { pin: code }, { success: false, unlocked: false });
      return payload?.success === true && payload?.unlocked === true;
    },
    unlockDirect: () => {
      setState('locked', false);
    },
    lock: () => {
      setState('locked', state.settings.screenLockEnabled !== false);
    },
    refreshSetupState: async () => {
      const payload = await fetchNui<{ success?: boolean; requiresSetup?: boolean; setup?: PhoneSetupState }>(
        'phoneGetSetupState',
        {},
        { success: false, requiresSetup: true, setup: { ...defaultSetupState, requiresSetup: true } },
      );

      batch(() => {
        setState('requiresSetup', payload?.requiresSetup === true);
        setState('setup', {
          ...defaultSetupState,
          ...(payload?.setup || {}),
          requiresSetup: payload?.requiresSetup === true,
        });
      });
    },
    completeSetup: async (payload) => {
      if (isReadOnly()) return { success: false, error: 'READ_ONLY' };
      const response = await fetchNui<{ success?: boolean; error?: string; requiresSetup?: boolean; setup?: PhoneSetupState }>(
        'phoneCompleteSetup',
        payload,
        { success: false, error: 'NO_RESPONSE' },
      );

      if (response?.success) {
        batch(() => {
          if (payload.theme) setState('settings', 'theme', payload.theme);
          if (payload.language) {
            setState('settings', 'language', payload.language);
            window.localStorage.setItem('gcphone:language', payload.language);
          }
          if (payload.audioProfile) setState('settings', 'audioProfile', payload.audioProfile);
          setState('requiresSetup', response.requiresSetup === true);
          setState('setup', {
            ...defaultSetupState,
            ...(response.setup || {}),
            requiresSetup: response.requiresSetup === true,
          });
        });
      }

      return {
        success: response?.success === true,
        error: response?.error,
      };
    },
    setWallpaper: (url: string) => {
      if (isReadOnly()) return;
      setState('settings', 'wallpaper', url);
      fetchNui('setWallpaper', { url });
    },
    setRingtone: (ringtone: string) => {
      if (isReadOnly()) return;
      batch(() => {
        setState('settings', 'ringtone', ringtone);
        setState('settings', 'callRingtone', ringtone);
      });
      fetchNui('setRingtone', { ringtone });
    },
    setCallRingtone: (ringtone: string) => {
      if (isReadOnly()) return;
      batch(() => {
        setState('settings', 'ringtone', ringtone);
        setState('settings', 'callRingtone', ringtone);
      });
      fetchNui('setCallRingtone', { ringtone });
    },
    setNotificationTone: (tone: string) => {
      if (isReadOnly()) return;
      setState('settings', 'notificationTone', tone);
      fetchNui('setNotificationTone', { tone });
    },
    setMessageTone: (tone: string) => {
      if (isReadOnly()) return;
      setState('settings', 'messageTone', tone);
      fetchNui('setMessageTone', { tone });
    },
    setVolume: (volume: number) => {
      if (isReadOnly()) return;
      setState('settings', 'volume', volume);
      fetchNui('setVolume', { volume });
    },
    setTheme: (theme: 'auto' | 'light' | 'dark') => {
      if (isReadOnly()) return;
      setState('settings', 'theme', theme);
      fetchNui('setTheme', { theme });
    },
    setAccentColor: (color: string) => {
      if (isReadOnly()) return;
      setState('settings', 'accentColor', color);
      window.localStorage.setItem('gcphone:accentColor', color);
    },
    setFontSize: (size: string) => {
      if (isReadOnly()) return;
      setState('settings', 'fontSize', size);
      window.localStorage.setItem('gcphone:fontSize', size);
    },
    setPhoneCase: (phoneCase: string) => {
      if (isReadOnly()) return;
      setState('settings', 'phoneCase', phoneCase);
      window.localStorage.setItem('gcphone:phoneCase', phoneCase);
    },
    setLanguage: (language: AppLanguage) => {
      if (isReadOnly()) return;
      setState('settings', 'language', language);
      window.localStorage.setItem('gcphone:language', language);
      fetchNui('setLanguage', { language });
    },
    setAudioProfile: (audioProfile: 'normal' | 'street' | 'vehicle' | 'silent') => {
      if (isReadOnly()) return;
      setState('settings', 'audioProfile', audioProfile);
      fetchNui('setAudioProfile', { audioProfile });
    },
    setStreamerMode: (enabled: boolean) => {
      if (isReadOnly()) return;
      setState('settings', 'streamerMode', enabled);
      fetchNui('setStreamerMode', { enabled });
    },
    setLockCode: (code: string) => {
      if (isReadOnly()) return;
      setState('settings', 'lockCode', code);
      fetchNui('setLockCode', { code });
    },
    setPhoneScale: (scale: number) => {
      const clamped = Math.max(0.7, Math.min(1, Math.round(scale * 100) / 100));
      setState('settings', 'phoneScale', clamped);
      window.localStorage.setItem('gcphone:phoneScale', String(clamped));
    },
    setSwipeUnlock: (enabled: boolean) => {
      if (isReadOnly()) return;
      const next = enabled === true;
      setState('settings', 'swipeUnlock', next);
      window.localStorage.setItem('gcphone:swipeUnlock', next ? '1' : '0');
    },
    setScreenLockEnabled: (enabled: boolean) => {
      if (isReadOnly()) return;
      const next = enabled === true;
      window.localStorage.setItem('gcphone:screenLockEnabled', next ? '1' : '0');
      batch(() => {
        setState('settings', 'screenLockEnabled', next);
        if (!next) {
          setState('locked', false);
        }
      });
    },
    factoryReset: async () => {
      if (isReadOnly()) return false;
      const response = await fetchNui<PhonePayload & { success?: boolean }>('factoryResetPhone', {}, { success: false } as PhonePayload & { success?: boolean });
      if (!response?.success) return false;

      window.localStorage.removeItem('gcphone:liveLocationInterval');
      window.localStorage.removeItem('gcphone:swipeUnlock');
      window.localStorage.removeItem('gcphone:screenLockEnabled');

      const flags = normalizeFeatureFlags(response.featureFlags);
      const enabledApps = ensureRequiredEnabledApps(Array.isArray(response.enabledApps) && response.enabledApps.length > 0
        ? response.enabledApps.filter((id): id is string => typeof id === 'string' && APP_IDS.includes(id))
        : enabledAppsFromFlags(flags));

      batch(() => {
        setState('featureFlags', flags);
        setState('enabledApps', enabledApps);
        setState('settings', {
          phoneNumber: response.phoneNumber || state.settings.phoneNumber,
          wallpaper: response.wallpaper || defaultSettings.wallpaper,
          ringtone: response.ringtone || defaultSettings.ringtone,
          callRingtone: response.callRingtone || response.ringtone || defaultSettings.callRingtone,
          notificationTone: response.notificationTone || defaultSettings.notificationTone,
          messageTone: response.messageTone || defaultSettings.messageTone,
          volume: response.volume ?? defaultSettings.volume,
          lockCode: '',
          swipeUnlock: readSwipeUnlockPreference(),
          screenLockEnabled: readScreenLockPreference(),
          phoneScale: readPhoneScalePreference(),
          theme: response.theme || defaultSettings.theme,
          language: normalizeLanguage(response.language || defaultSettings.language),
          audioProfile: response.audioProfile || defaultSettings.audioProfile,
        });
        setLayout(response.appLayout || defaultLayout, enabledApps);
        setState('framework', normalizeFramework(response.framework));
        setState('imei', response.imei);
        setState('deviceOwnerName', response.deviceOwnerName);
        setState('isStolen', response.isStolen === true);
        setState('stolenAt', response.stolenAt);
        setState('stolenReason', response.stolenReason);
        setState('requiresSetup', response.requiresSetup === true);
        setState('setup', {
          ...defaultSetupState,
          ...(response.setup || {}),
          requiresSetup: response.requiresSetup === true,
        });
        setState('accessMode', response.accessMode || 'own');
        setState('accessOwnerName', response.accessOwnerName);
        setState('accessPhoneId', response.accessPhoneId);
        setState('locked', false);
      });

      return true;
    },
    loadAppLayout: async () => {
      const res = await fetchNui<{ layout?: AppLayout | null; version?: number } | AppLayout | null>('getAppLayout', {}, null);
      if (res && typeof res === 'object' && 'layout' in res) {
        setLayout(res.layout ?? null, state.enabledApps);
        setState('layoutVersion', typeof res.version === 'number' ? res.version : 0);
      } else {
        setLayout(res as AppLayout | null, state.enabledApps);
        setState('layoutVersion', 0);
      }
    },
    saveAppLayout: async () => {
      if (isReadOnly()) return;
      if (savingPromise) {
        await savingPromise;
        scheduleSave();
        return;
      }
      const attempt = (async () => {
        const snapshot = state.appLayout;
        const response = await fetchNui<{ ok?: boolean; version?: number; layout?: AppLayout; reason?: string } | null>(
          'setAppLayout',
          { layout: snapshot, version: state.layoutVersion },
          null,
        );
        if (!response) return;
        if (response.ok === true) {
          if (typeof response.version === 'number') setState('layoutVersion', response.version);
          return;
        }
        if (response.reason === 'version_conflict') {
          batch(() => {
            if (response.layout) setLayout(response.layout, state.enabledApps);
            if (typeof response.version === 'number') setState('layoutVersion', response.version);
          });
          return;
        }
        if (response.reason === 'rate_limited') {
          scheduleSave();
        }
      })();
      savingPromise = attempt;
      try {
        await attempt;
      } finally {
        savingPromise = null;
      }
    },
    reorderApp: (target: 'home' | 'menu', appId: string, targetIndex: number) => {
      setState('appLayout', target, (current) => {
        const next = [...current];
        const fromIndex = next.indexOf(appId);
        if (fromIndex === -1) return current;
        next.splice(fromIndex, 1);

        const clamped = Math.max(0, Math.min(targetIndex, next.length));
        next.splice(clamped, 0, appId);
        return next;
      });
      scheduleSave();
    },
    moveApp: (appId: string, from: 'home' | 'menu', to: 'home' | 'menu', targetIndex?: number) => {
      if (from === to) {
        actions.reorderApp(to, appId, targetIndex ?? state.appLayout[to].length);
        return;
      }

      batch(() => {
        setState('appLayout', from, (current) => current.filter((id) => id !== appId));
        setState('appLayout', to, (current) => {
          if (current.includes(appId)) return current;
          const next = [...current];
          const at = typeof targetIndex === 'number' ? Math.max(0, Math.min(targetIndex, next.length)) : next.length;
          next.splice(at, 0, appId);
          return next;
        });
      });

      scheduleSave();
    },
    createFolder: (name: string, apps: string[], color: string): string => {
      if (isReadOnly()) return '';
      const ctx = buildNormalizeContext(state.enabledApps);
      const [first, second, ...rest] = apps.filter((a) => !PINNED_APP_IDS.includes(a as typeof PINNED_APP_IDS[number]));
      if (!first || !second) return '';
      const merge = folderOps.createFolderFromMerge(state.appLayout, first, second, ctx, name);
      if (!merge.ok) return '';
      let layout = merge.layout;
      const createdId = layout.folders?.[layout.folders.length - 1]?.id;
      if (!createdId) return '';
      const colorRes = folderOps.recolorFolder(layout, createdId, color, ctx);
      if (colorRes.ok) layout = colorRes.layout;
      for (const extra of rest) {
        const res = folderOps.addAppToFolder(layout, createdId, extra, ctx);
        if (res.ok) layout = res.layout;
      }
      setState('appLayout', layout);
      scheduleSave();
      return createdId;
    },
    updateFolder: (folderId: string, updates: Partial<Pick<Folder, 'name' | 'color' | 'apps'>>) => {
      if (isReadOnly()) return;
      const ctx = buildNormalizeContext(state.enabledApps);
      let layout = state.appLayout;
      let changed = false;

      if (updates.name !== undefined) {
        const res = folderOps.renameFolder(layout, folderId, updates.name, ctx);
        if (res.ok) { layout = res.layout; changed = true; }
      }
      if (updates.color !== undefined) {
        const res = folderOps.recolorFolder(layout, folderId, updates.color, ctx);
        if (res.ok) { layout = res.layout; changed = true; }
      }
      if (Array.isArray(updates.apps)) {
        const current = layout.folders?.find((f) => f.id === folderId);
        if (current) {
          const nextSet = new Set(updates.apps);
          for (const appId of current.apps) {
            if (nextSet.has(appId)) continue;
            const res = folderOps.removeAppFromFolder(layout, folderId, appId, ctx);
            if (res.ok) { layout = res.layout; changed = true; }
          }
          for (const appId of updates.apps) {
            const res = folderOps.addAppToFolder(layout, folderId, appId, ctx);
            if (res.ok) { layout = res.layout; changed = true; }
          }
        }
      }

      if (changed) {
        setState('appLayout', layout);
        scheduleSave();
      }
    },
    deleteFolder: (folderId: string) => {
      if (isReadOnly()) return;
      const res = folderOps.deleteFolder(state.appLayout, folderId, buildNormalizeContext(state.enabledApps));
      if (!res.ok) return;
      setState('appLayout', res.layout);
      scheduleSave();
    },
    addAppToFolder: (folderId: string, appId: string) => {
      if (isReadOnly()) return;
      const res = folderOps.addAppToFolder(state.appLayout, folderId, appId, buildNormalizeContext(state.enabledApps));
      if (!res.ok) return;
      setState('appLayout', res.layout);
      scheduleSave();
    },
    removeAppFromFolder: (folderId: string, appId: string) => {
      if (isReadOnly()) return;
      const ctx = buildNormalizeContext(state.enabledApps);
      const res = folderOps.removeAppFromFolder(state.appLayout, folderId, appId, ctx);
      if (!res.ok) return;
      const folderAfter = res.layout.folders?.find((f) => f.id === folderId);
      let layout = res.layout;
      if (!folderAfter) {
        setState('appLayout', layout);
      } else if (folderAfter.apps.length === 0) {
        const del = folderOps.deleteFolder(layout, folderId, ctx);
        if (del.ok) layout = del.layout;
        setState('appLayout', layout);
      } else {
        setState('appLayout', layout);
      }
      scheduleSave();
    },
    mergeTwoAppsIntoFolder: (appId1: string, appId2: string): string => {
      if (isReadOnly()) return '';
      const ctx = buildNormalizeContext(state.enabledApps);
      const res = folderOps.createFolderFromMerge(state.appLayout, appId1, appId2, ctx, 'New Folder');
      if (!res.ok) return '';
      const createdId = res.layout.folders?.[res.layout.folders.length - 1]?.id ?? '';
      setState('appLayout', res.layout);
      scheduleSave();
      return createdId;
    },
    setIconShape: (shape: IconShape) => {
      if (isReadOnly()) return;
      setState('settings', 'iconShape', shape);
      window.localStorage.setItem('gcphone:iconShape', shape);
    },
    loadWidgetLayout: async () => {
      const layout = await fetchNui<WidgetLayout | null>('getWidgetLayout', {});
      if (layout && Array.isArray(layout.widgets)) {
        setState('widgetLayout', layout);
      }
    },
    saveWidgetLayout: async () => {
      if (isReadOnly()) return;
      await fetchNui('setWidgetLayout', { layout: state.widgetLayout });
    },
    addWidget: (type: WidgetType, size: WidgetSize) => {
      if (isReadOnly()) return;
      const current = state.widgetLayout?.widgets || [];
      if (current.length >= MAX_WIDGETS) return;
      const id = crypto.randomUUID();
      setState('widgetLayout', 'widgets', [...current, { id, type, size }]);
      void actions.saveWidgetLayout();
    },
    removeWidget: (widgetId: string) => {
      if (isReadOnly()) return;
      setState('widgetLayout', 'widgets', (ws) => ws.filter(w => w.id !== widgetId));
      void actions.saveWidgetLayout();
    },
    reorderWidget: (widgetId: string, targetIndex: number) => {
      if (isReadOnly()) return;
      setState('widgetLayout', 'widgets', (current) => {
        const next = [...current];
        const fromIdx = next.findIndex(w => w.id === widgetId);
        if (fromIdx === -1) return current;
        const [item] = next.splice(fromIdx, 1);
        const clamped = Math.max(0, Math.min(targetIndex, next.length));
        next.splice(clamped, 0, item);
        return next;
      });
      void actions.saveWidgetLayout();
    },
    resizeWidget: (widgetId: string, size: WidgetSize) => {
      if (isReadOnly()) return;
      setState('widgetLayout', 'widgets', (ws) =>
        ws.map(w => w.id === widgetId ? { ...w, size } : w)
      );
      void actions.saveWidgetLayout();
    },
  };

  useNuiCustomEvent<PhonePayload>('phone:init', (data) => {
    const flags = normalizeFeatureFlags(data?.featureFlags);
    const enabledApps = ensureRequiredEnabledApps(Array.isArray(data?.enabledApps) && data.enabledApps.length > 0
      ? data.enabledApps.filter((id): id is string => typeof id === 'string' && APP_IDS.includes(id))
      : enabledAppsFromFlags(flags));

    batch(() => {
      setState('initialized', true);
      setState('featureFlags', flags);
      setState('enabledApps', enabledApps);
      setState('settings', {
        phoneNumber: data.phoneNumber || '',
          wallpaper: data.wallpaper || defaultSettings.wallpaper,
          ringtone: data.ringtone || defaultSettings.ringtone,
          callRingtone: data.callRingtone || data.ringtone || defaultSettings.callRingtone,
          notificationTone: data.notificationTone || defaultSettings.notificationTone,
          messageTone: data.messageTone || defaultSettings.messageTone,
          volume: data.volume ?? defaultSettings.volume,
          lockCode: '',
          swipeUnlock: readSwipeUnlockPreference(),
          screenLockEnabled: readScreenLockPreference(),
          phoneScale: readPhoneScalePreference(),
          theme: data.theme || defaultSettings.theme,
          language: normalizeLanguage(data.language || window.localStorage.getItem('gcphone:language')),
          audioProfile: data.audioProfile || defaultSettings.audioProfile,
        });
      setLayout(data?.appLayout || defaultLayout, enabledApps);
      setState('layoutVersion', 0);
      setState('framework', normalizeFramework(data?.framework));
      setState('imei', data?.imei);
      setState('deviceOwnerName', data?.deviceOwnerName);
      setState('isStolen', data?.isStolen === true);
      setState('stolenAt', data?.stolenAt);
      setState('stolenReason', data?.stolenReason);
      setState('requiresSetup', data?.requiresSetup === true);
      setState('setup', {
        ...defaultSetupState,
        ...(data?.setup || {}),
        requiresSetup: data?.requiresSetup === true,
      });
      setState('accessMode', data?.accessMode || 'own');
      setState('accessOwnerName', data?.accessOwnerName);
      setState('accessPhoneId', data?.accessPhoneId);
      if (data?.requiresSetup === true) {
        setState('locked', false);
      }
      });
    void actions.loadAppLayout();
  });

  useNuiCustomEvent<PhonePayload>('phone:show', (data) => {
    const flags = normalizeFeatureFlags(data?.featureFlags || state.featureFlags);
    const enabledApps = ensureRequiredEnabledApps(Array.isArray(data?.enabledApps) && data.enabledApps.length > 0
      ? data.enabledApps.filter((id): id is string => typeof id === 'string' && APP_IDS.includes(id))
      : state.enabledApps);

    batch(() => {
      const needsSetup = data?.requiresSetup === true;
      const useLockScreen = data?.useLockScreen ?? state.locked;
      const forceLockScreen = data?.forceLockScreen === true;
      const shouldLock = state.settings.screenLockEnabled !== false && useLockScreen && (forceLockScreen || !isEnvBrowser()) && !needsSetup;
      setState('visible', true);
      setState('locked', shouldLock);
      setState('initialized', true);
      setState('featureFlags', flags);
      setState('enabledApps', enabledApps);
      if (data) {
        setState('settings', {
          phoneNumber: data.phoneNumber || state.settings.phoneNumber,
            wallpaper: data.wallpaper || state.settings.wallpaper,
            ringtone: data.ringtone || state.settings.ringtone,
            callRingtone: data.callRingtone || data.ringtone || state.settings.callRingtone,
            notificationTone: data.notificationTone || state.settings.notificationTone,
            messageTone: data.messageTone || state.settings.messageTone,
             volume: data.volume ?? state.settings.volume,
              lockCode: '',
              swipeUnlock: readSwipeUnlockPreference(),
              screenLockEnabled: readScreenLockPreference(),
              theme: data.theme || state.settings.theme,
             language: normalizeLanguage(data.language || state.settings.language || window.localStorage.getItem('gcphone:language')),
             audioProfile: data.audioProfile || state.settings.audioProfile,
          });
        setLayout(data.appLayout || state.appLayout, enabledApps);
        if (data.appLayout) setState('layoutVersion', 0);
        setState('framework', normalizeFramework(data.framework));
        setState('imei', data.imei);
        setState('deviceOwnerName', data.deviceOwnerName);
        setState('isStolen', data.isStolen === true);
        setState('stolenAt', data.stolenAt);
        setState('stolenReason', data.stolenReason);
        setState('requiresSetup', data?.requiresSetup === true);
        setState('setup', {
          ...defaultSetupState,
          ...(data?.setup || state.setup || {}),
          requiresSetup: data?.requiresSetup === true,
        });
        setState('accessMode', data?.accessMode || 'own');
        setState('accessOwnerName', data?.accessOwnerName);
        setState('accessPhoneId', data?.accessPhoneId);
        }
     });
    if (data?.appLayout) void actions.loadAppLayout();
  });

  useNuiCustomEvent<{ isStolen?: boolean; reason?: string }>('phone:stolenUpdate', (data) => {
    if (!data) return;
    batch(() => {
      setState('isStolen', data.isStolen === true);
      if (data.isStolen) {
        setState('stolenReason', data.reason || undefined);
      } else {
        setState('stolenAt', undefined);
        setState('stolenReason', undefined);
      }
    });
  });

  useNuiCustomEvent<void>('phone:hide', () => {
    batch(() => {
      setState('visible', false);
      setState('locked', true);
      setState('imei', undefined);
      setState('deviceOwnerName', undefined);
      setState('isStolen', false);
      setState('stolenAt', undefined);
      setState('stolenReason', undefined);
      setState('accessMode', 'own');
      setState('accessOwnerName', undefined);
      setState('accessPhoneId', undefined);
    });
  });
  
  onMount(() => {
    fetchNui('nuiReady', {}, true);
    void actions.loadAppLayout();
    void actions.loadWidgetLayout();
    if (isEnvBrowser()) {
      setState('locked', false);
    }
  });
  
  return (
    <PhoneActionsContext.Provider value={actions}>
      <PhoneStateContext.Provider value={state}>
        <PhoneContext.Provider value={createMemo(() => ({ state, actions }))()}>
          {props.children}
        </PhoneContext.Provider>
      </PhoneStateContext.Provider>
    </PhoneActionsContext.Provider>
  );
};

export function usePhone() {
  const context = useContext(PhoneContext);
  if (!context) {
    throw new Error('usePhone must be used within PhoneProvider');
  }
  return [context.state, context.actions] as const;
}

export function usePhoneState() {
  const context = useContext(PhoneStateContext);
  if (!context) {
    throw new Error('usePhoneState must be used within PhoneProvider');
  }
  return context;
}

export function usePhoneActions() {
  const context = useContext(PhoneActionsContext);
  if (!context) {
    throw new Error('usePhoneActions must be used within PhoneProvider');
  }
  return context;
}
