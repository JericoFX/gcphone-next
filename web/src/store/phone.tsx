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
import { useNuiCustomEvent } from '../utils/useNui';
import type { AppLayout, PhoneFeatureFlags, PhoneSettings, PhoneState } from '../types';
import { APP_IDS, DEFAULT_HOME_APPS, DEFAULT_MENU_APPS } from '../config/apps';
import { isEnvBrowser } from '../utils/misc';

interface PhoneContextValue {
  state: PhoneState;
  actions: {
    show: () => void;
    hide: () => void;
    toggle: () => void;
    unlock: (code: string) => boolean;
    lock: () => void;
    setWallpaper: (url: string) => void;
    setRingtone: (ringtone: string) => void;
    setVolume: (volume: number) => void;
    setTheme: (theme: 'auto' | 'light' | 'dark') => void;
    setLanguage: (language: 'es' | 'en' | 'pt' | 'fr') => void;
    setAudioProfile: (audioProfile: 'normal' | 'street' | 'vehicle' | 'silent') => void;
    setLockCode: (code: string) => void;
    setCoque: (coque: string) => void;
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
  ringtone: 'ring.ogg',
  volume: 0.5,
  lockCode: '0000',
  coque: 'sin_funda.png',
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
  documents: true,
  music: true,
  yellowpages: true,
};

const defaultLayout: AppLayout = {
  home: [...DEFAULT_HOME_APPS],
  menu: [...DEFAULT_MENU_APPS]
};

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

  return {
    home: uniqueHome,
    menu: uniqueMenu
  };
}

function normalizeFeatureFlags(input?: Partial<PhoneFeatureFlags> | null): PhoneFeatureFlags {
  return {
    appstore: input?.appstore !== false,
    wavechat: input?.wavechat !== false,
    darkrooms: input?.darkrooms !== false,
    clips: input?.clips !== false,
    wallet: input?.wallet !== false,
    documents: input?.documents !== false,
    music: input?.music !== false,
    yellowpages: input?.yellowpages !== false,
  };
}

function normalizeLanguage(value?: string | null): 'es' | 'en' | 'pt' | 'fr' {
  if (value === 'en' || value === 'pt' || value === 'fr') return value;
  return 'es';
}

function enabledAppsFromFlags(flags: PhoneFeatureFlags): string[] {
  const byFlag: Record<keyof PhoneFeatureFlags, string[]> = {
    appstore: ['appstore'],
    wavechat: ['wavechat'],
    darkrooms: ['darkrooms'],
    clips: ['clips'],
    wallet: ['wallet'],
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
    settings: { ...defaultSettings },
    appLayout: { ...defaultLayout },
    enabledApps: [...APP_IDS],
    featureFlags: { ...defaultFeatureFlags },
  });

  const setLayout = (layout?: Partial<AppLayout> | null, enabledApps = state.enabledApps) => {
    setState('appLayout', normalizeLayout(layout, enabledApps));
  };
  
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
    unlock: (code: string) => {
      if (state.settings.lockCode === code) {
        setState('locked', false);
        return true;
      }
      return false;
    },
    lock: () => {
      setState('locked', true);
    },
    setWallpaper: (url: string) => {
      setState('settings', 'wallpaper', url);
      fetchNui('setWallpaper', { url });
    },
    setRingtone: (ringtone: string) => {
      setState('settings', 'ringtone', ringtone);
      fetchNui('setRingtone', { ringtone });
    },
    setVolume: (volume: number) => {
      setState('settings', 'volume', volume);
      fetchNui('setVolume', { volume });
    },
    setTheme: (theme: 'auto' | 'light' | 'dark') => {
      setState('settings', 'theme', theme);
      fetchNui('setTheme', { theme });
    },
    setLanguage: (language: 'es' | 'en' | 'pt' | 'fr') => {
      setState('settings', 'language', language);
      window.localStorage.setItem('gcphone:language', language);
      fetchNui('setLanguage', { language });
    },
    setAudioProfile: (audioProfile: 'normal' | 'street' | 'vehicle' | 'silent') => {
      setState('settings', 'audioProfile', audioProfile);
      fetchNui('setAudioProfile', { audioProfile });
    },
    setLockCode: (code: string) => {
      setState('settings', 'lockCode', code);
      fetchNui('setLockCode', { code });
    },
    setCoque: (coque: string) => {
      setState('settings', 'coque', coque);
      fetchNui('setCoque', { coque });
    },
    loadAppLayout: async () => {
      const layout = await fetchNui<AppLayout | null>('getAppLayout', {});
      setLayout(layout, state.enabledApps);
    },
    saveAppLayout: async () => {
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
  
  useNuiCustomEvent<PhoneSettings & { appLayout?: AppLayout; enabledApps?: string[]; featureFlags?: Partial<PhoneFeatureFlags> }>('phone:init', (data) => {
    const flags = normalizeFeatureFlags(data?.featureFlags);
    const enabledApps = Array.isArray(data?.enabledApps) && data.enabledApps.length > 0
      ? data.enabledApps.filter((id): id is string => typeof id === 'string' && APP_IDS.includes(id))
      : enabledAppsFromFlags(flags);

    batch(() => {
      setState('initialized', true);
      setState('featureFlags', flags);
      setState('enabledApps', enabledApps);
      setState('settings', {
        phoneNumber: data.phoneNumber || '',
          wallpaper: data.wallpaper || defaultSettings.wallpaper,
          ringtone: data.ringtone || defaultSettings.ringtone,
          volume: data.volume ?? defaultSettings.volume,
          lockCode: data.lockCode || defaultSettings.lockCode,
          coque: data.coque || defaultSettings.coque,
          theme: data.theme || defaultSettings.theme,
          language: normalizeLanguage(data.language || window.localStorage.getItem('gcphone:language')),
          audioProfile: data.audioProfile || defaultSettings.audioProfile,
        });
      setLayout(data?.appLayout || defaultLayout, enabledApps);
      });
  });

  useNuiCustomEvent<PhoneSettings & { appLayout?: AppLayout; enabledApps?: string[]; featureFlags?: Partial<PhoneFeatureFlags> }>('phone:show', (data) => {
    const flags = normalizeFeatureFlags(data?.featureFlags || state.featureFlags);
    const enabledApps = Array.isArray(data?.enabledApps) && data.enabledApps.length > 0
      ? data.enabledApps.filter((id): id is string => typeof id === 'string' && APP_IDS.includes(id))
      : state.enabledApps;

    batch(() => {
      setState('visible', true);
      setState('initialized', true);
      setState('featureFlags', flags);
      setState('enabledApps', enabledApps);
      if (data) {
        setState('settings', {
          phoneNumber: data.phoneNumber || state.settings.phoneNumber,
           wallpaper: data.wallpaper || state.settings.wallpaper,
           ringtone: data.ringtone || state.settings.ringtone,
           volume: data.volume ?? state.settings.volume,
            lockCode: data.lockCode || state.settings.lockCode,
            coque: data.coque || state.settings.coque,
            theme: data.theme || state.settings.theme,
            language: normalizeLanguage(data.language || state.settings.language || window.localStorage.getItem('gcphone:language')),
            audioProfile: data.audioProfile || state.settings.audioProfile,
          });
        setLayout(data.appLayout || state.appLayout, enabledApps);
        }
     });
  });
  
  useNuiCustomEvent<void>('phone:hide', () => {
    batch(() => {
      setState('visible', false);
      setState('locked', true);
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
