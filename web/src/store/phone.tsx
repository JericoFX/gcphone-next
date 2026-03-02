import { 
  createContext, 
  useContext, 
  ParentComponent,
  onMount,
  batch
} from 'solid-js';
import { createStore } from 'solid-js/store';
import { fetchNui } from '../utils/fetchNui';
import { useNuiCustomEvent } from '../utils/useNui';
import type { AppLayout, PhoneSettings, PhoneState } from '../types';
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
    setLockCode: (code: string) => void;
    setCoque: (coque: string) => void;
    loadAppLayout: () => Promise<void>;
    saveAppLayout: () => Promise<void>;
    reorderApp: (target: 'home' | 'menu', appId: string, targetIndex: number) => void;
    moveApp: (appId: string, from: 'home' | 'menu', to: 'home' | 'menu', targetIndex?: number) => void;
  };
}

const PhoneContext = createContext<PhoneContextValue>();

const defaultSettings: PhoneSettings = {
  phoneNumber: '',
  wallpaper: './img/background/back001.jpg',
  ringtone: 'ring.ogg',
  volume: 0.5,
  lockCode: '0000',
  coque: 'sin_funda.png',
  theme: 'light'
};

const defaultLayout: AppLayout = {
  home: [...DEFAULT_HOME_APPS],
  menu: [...DEFAULT_MENU_APPS]
};

function normalizeLayout(layout?: Partial<AppLayout> | null): AppLayout {
  const home = Array.isArray(layout?.home) ? layout.home.filter((id): id is string => typeof id === 'string') : [];
  const menu = Array.isArray(layout?.menu) ? layout.menu.filter((id): id is string => typeof id === 'string') : [];

  const uniqueHome: string[] = [];
  const uniqueMenu: string[] = [];
  const used = new Set<string>();

  for (const id of home) {
    if (!APP_IDS.includes(id) || used.has(id)) continue;
    uniqueHome.push(id);
    used.add(id);
  }

  for (const id of menu) {
    if (!APP_IDS.includes(id) || used.has(id)) continue;
    uniqueMenu.push(id);
    used.add(id);
  }

  for (const id of APP_IDS) {
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

export const PhoneProvider: ParentComponent = (props) => {
  const [state, setState] = createStore<PhoneState>({
    visible: false,
    locked: false,
    initialized: false,
    settings: { ...defaultSettings },
    appLayout: { ...defaultLayout }
  });

  const setLayout = (layout?: Partial<AppLayout> | null) => {
    setState('appLayout', normalizeLayout(layout));
  };
  
  const actions = {
    show: () => {
      setState('visible', true);
    },
    hide: () => {
      setState('visible', false);
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
      setLayout(layout);
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
  
  useNuiCustomEvent<PhoneSettings>('phone:init', (data) => {
    batch(() => {
      setState('initialized', true);
      setState('settings', {
        phoneNumber: data.phoneNumber || '',
          wallpaper: data.wallpaper || defaultSettings.wallpaper,
          ringtone: data.ringtone || defaultSettings.ringtone,
          volume: data.volume ?? defaultSettings.volume,
          lockCode: data.lockCode || defaultSettings.lockCode,
          coque: data.coque || defaultSettings.coque,
          theme: data.theme || defaultSettings.theme
        });
      });
  });
  
  useNuiCustomEvent<PhoneSettings>('phone:show', (data) => {
    batch(() => {
      setState('visible', true);
      setState('initialized', true);
      if (data) {
        setState('settings', {
          phoneNumber: data.phoneNumber || state.settings.phoneNumber,
           wallpaper: data.wallpaper || state.settings.wallpaper,
           ringtone: data.ringtone || state.settings.ringtone,
           volume: data.volume ?? state.settings.volume,
           lockCode: data.lockCode || state.settings.lockCode,
           coque: data.coque || state.settings.coque,
           theme: data.theme || state.settings.theme
         });
       }
     });
  });
  
  useNuiCustomEvent<void>('phone:hide', () => {
    setState('visible', false);
  });
  
  onMount(() => {
    fetchNui('nuiReady', {}, true);
    void actions.loadAppLayout();
    if (isEnvBrowser()) {
      setState('locked', false);
    }
  });
  
  return (
    <PhoneContext.Provider value={{ state, actions }}>
      {props.children}
    </PhoneContext.Provider>
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
  const context = useContext(PhoneContext);
  if (!context) {
    throw new Error('usePhoneState must be used within PhoneProvider');
  }
  return context.state;
}

export function usePhoneActions() {
  const context = useContext(PhoneContext);
  if (!context) {
    throw new Error('usePhoneActions must be used within PhoneProvider');
  }
  return context.actions;
}
