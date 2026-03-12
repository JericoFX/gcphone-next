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
import { useNuiCustomEvent } from '../utils/useNui';
import type { AppLayout, PhoneFeatureFlags, PhoneFramework, PhoneSettings, PhoneSetupPayload, PhoneState, PhoneSetupState } from '../types';
import { APP_IDS, DEFAULT_HOME_APPS, DEFAULT_MENU_APPS } from '../config/apps';
import { isEnvBrowser } from '../utils/misc';

interface PhoneContextValue {
  state: PhoneState;
  actions: {
    show: () => void;
    hide: () => void;
    toggle: () => void;
    unlock: (code: string) => Promise<boolean>;
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
    setLanguage: (language: 'es' | 'en' | 'pt' | 'fr') => void;
    setAudioProfile: (audioProfile: 'normal' | 'street' | 'vehicle' | 'silent') => void;
    setLockCode: (code: string) => void;
    factoryReset: () => Promise<boolean>;
    loadAppLayout: () => Promise<void>;
    saveAppLayout: () => Promise<void>;
    reorderApp: (target: 'home' | 'menu', appId: string, targetIndex: number) => void;
    moveApp: (appId: string, from: 'home' | 'menu', to: 'home' | 'menu', targetIndex?: number) => void;
  };
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
  theme: 'light',
  language: 'es',
  audioProfile: 'normal'
};

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

function normalizeLayout(layout?: Partial<AppLayout> | null, enabledApps: string[] = APP_IDS): AppLayout {
  const available = new Set(enabledApps);
  const home = Array.isArray(layout?.home) ? layout.home.filter((id): id is string => typeof id === 'string') : [];
  const menu = Array.isArray(layout?.menu) ? layout.menu.filter((id): id is string => typeof id === 'string') : [];

  const uniqueHome: string[] = [];
  const uniqueMenu: string[] = [];
  const used = new Set<string>();

  for (const id of home) {
    if (!APP_IDS.includes(id) || !available.has(id) || used.has(id)) continue;
    uniqueHome.push(id);
    used.add(id);
  }

  for (const id of menu) {
    if (!APP_IDS.includes(id) || !available.has(id) || used.has(id)) continue;
    uniqueMenu.push(id);
    used.add(id);
  }

  for (const id of APP_IDS) {
    if (!available.has(id)) continue;
    if (!used.has(id)) {
      if (DEFAULT_HOME_APPS.includes(id)) uniqueHome.push(id);
      else uniqueMenu.push(id);
      used.add(id);
    }
  }

  const pinnedHome = PINNED_HOME_APPS.filter((id) => available.has(id));
  const pinnedSet = new Set<string>(pinnedHome);
  const orderedHome = [...pinnedHome, ...uniqueHome.filter((id) => !pinnedSet.has(id))];
  const filteredMenu = uniqueMenu.filter((id) => !pinnedSet.has(id));

  return {
    home: orderedHome,
    menu: filteredMenu
  };
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

function normalizeLanguage(value?: string | null): 'es' | 'en' | 'pt' | 'fr' {
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
    enabledApps: [...APP_IDS],
    featureFlags: { ...defaultFeatureFlags },
    requiresSetup: false,
    setup: { ...defaultSetupState },
    accessMode: 'own',
    accessOwnerName: undefined,
    accessPhoneId: undefined,
  });

  const setLayout = (layout?: Partial<AppLayout> | null, enabledApps = state.enabledApps) => {
    setState('appLayout', normalizeLayout(layout, enabledApps));
  };

  const isReadOnly = () => state.accessMode === 'foreign-readonly';
  
  const actions = {
    show: () => {
      setState('visible', true);
    },
    hide: () => {
      setState('visible', false);
      setState('locked', true);
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
    lock: () => {
      setState('locked', true);
    },
    refreshSetupState: async () => {
      const payload = await fetchNui<{ success?: boolean; requiresSetup?: boolean; setup?: PhoneSetupState }>(
        'phoneGetSetupState',
        {},
        { success: false, requiresSetup: true, setup: { ...defaultSetupState, requiresSetup: true } },
      );

      setState('requiresSetup', payload?.requiresSetup === true);
      setState('setup', {
        ...defaultSetupState,
        ...(payload?.setup || {}),
        requiresSetup: payload?.requiresSetup === true,
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
      setState('settings', 'ringtone', ringtone);
      setState('settings', 'callRingtone', ringtone);
      fetchNui('setRingtone', { ringtone });
    },
    setCallRingtone: (ringtone: string) => {
      if (isReadOnly()) return;
      setState('settings', 'ringtone', ringtone);
      setState('settings', 'callRingtone', ringtone);
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
    setLanguage: (language: 'es' | 'en' | 'pt' | 'fr') => {
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
    setLockCode: (code: string) => {
      if (isReadOnly()) return;
      setState('settings', 'lockCode', code);
      fetchNui('setLockCode', { code });
    },
    factoryReset: async () => {
      if (isReadOnly()) return false;
      const response = await fetchNui<PhonePayload & { success?: boolean }>('factoryResetPhone', {}, { success: false } as PhonePayload & { success?: boolean });
      if (!response?.success) return false;

      window.localStorage.removeItem('gcphone:liveLocationInterval');

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
      const layout = await fetchNui<AppLayout | null>('getAppLayout', {});
      setLayout(layout, state.enabledApps);
    },
    saveAppLayout: async () => {
      if (isReadOnly()) return;
      await fetchNui('setAppLayout', { layout: state.appLayout });
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
      void actions.saveAppLayout();
    },
    moveApp: (appId: string, from: 'home' | 'menu', to: 'home' | 'menu', targetIndex?: number) => {
      if (from === to) {
        actions.reorderApp(to, appId, targetIndex ?? state.appLayout[to].length);
        return;
      }

      setState('appLayout', from, (current) => current.filter((id) => id !== appId));
      setState('appLayout', to, (current) => {
        if (current.includes(appId)) return current;
        const next = [...current];
        const at = typeof targetIndex === 'number' ? Math.max(0, Math.min(targetIndex, next.length)) : next.length;
        next.splice(at, 0, appId);
        return next;
      });

      void actions.saveAppLayout();
    }
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
          theme: data.theme || defaultSettings.theme,
          language: normalizeLanguage(data.language || window.localStorage.getItem('gcphone:language')),
          audioProfile: data.audioProfile || defaultSettings.audioProfile,
        });
      setLayout(data?.appLayout || defaultLayout, enabledApps);
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
      const shouldLock = useLockScreen && (forceLockScreen || !isEnvBrowser()) && !needsSetup;
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
             theme: data.theme || state.settings.theme,
             language: normalizeLanguage(data.language || state.settings.language || window.localStorage.getItem('gcphone:language')),
             audioProfile: data.audioProfile || state.settings.audioProfile,
          });
        setLayout(data.appLayout || state.appLayout, enabledApps);
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
