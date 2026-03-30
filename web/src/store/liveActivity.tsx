import { createContext, createSignal, useContext, type ParentComponent } from 'solid-js';

export type LiveActivityType = 'music' | 'radio' | 'call' | 'cityride' | 'timer' | 'recording' | 'location';

export interface LiveActivity {
  type: LiveActivityType;
  title: string;
  subtitle?: string;
  icon?: string;
  isPlaying?: boolean;
  volume?: number;
  onPause?: () => void;
  onStop?: () => void;
  onVolumeUp?: () => void;
  onVolumeDown?: () => void;
  onNavigate?: () => void;
}

const PRIORITY: Record<LiveActivityType, number> = {
  call: 0,
  recording: 1,
  cityride: 2,
  radio: 3,
  music: 4,
  timer: 5,
  location: 6,
};

export interface LiveActivityStore {
  activities: () => LiveActivity[];
  topActivity: () => LiveActivity | undefined;
  setActivity: (type: LiveActivityType, data: Omit<LiveActivity, 'type'>) => void;
  removeActivity: (type: LiveActivityType) => void;
}

const LiveActivityContext = createContext<LiveActivityStore>();

export const LiveActivityProvider: ParentComponent = (props) => {
  const [activities, setActivities] = createSignal<LiveActivity[]>([]);

  const sorted = () => [...activities()].sort((a, b) => PRIORITY[a.type] - PRIORITY[b.type]);
  const topActivity = () => sorted()[0];

  const setActivity = (type: LiveActivityType, data: Omit<LiveActivity, 'type'>) => {
    setActivities((prev) => {
      const filtered = prev.filter((a) => a.type !== type);
      return [...filtered, { type, ...data }];
    });
  };

  const removeActivity = (type: LiveActivityType) => {
    setActivities((prev) => prev.filter((a) => a.type !== type));
  };

  const store: LiveActivityStore = {
    activities: sorted,
    topActivity,
    setActivity,
    removeActivity,
  };

  return (
    <LiveActivityContext.Provider value={store}>
      {props.children}
    </LiveActivityContext.Provider>
  );
};

export function useLiveActivity(): LiveActivityStore {
  const ctx = useContext(LiveActivityContext);
  if (!ctx) throw new Error('useLiveActivity must be used within LiveActivityProvider');
  return ctx;
}
