import { createContext, createSignal, useContext, type ParentComponent } from 'solid-js';
import { useInternalEvent } from '../utils/internalEvents';

export type LiveActivityType = 'music' | 'radio' | 'call' | 'cityride' | 'timer' | 'recording' | 'location';

export interface LiveActivity {
  id?: string;
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
  removeActivity: (type: LiveActivityType, id?: string) => void;
  clearActivities: () => void;
}

const LiveActivityContext = createContext<LiveActivityStore>();

export const LiveActivityProvider: ParentComponent = (props) => {
  const [activities, setActivities] = createSignal<LiveActivity[]>([]);

  const sorted = () => [...activities()].sort((a, b) => PRIORITY[a.type] - PRIORITY[b.type]);
  const topActivity = () => sorted()[0];
  const activityIdentity = (activity: Pick<LiveActivity, 'type' | 'id'>) => `${activity.type}:${activity.id || activity.type}`;
  const isLiveActivityType = (value: unknown): value is LiveActivityType => (
    typeof value === 'string' && value in PRIORITY
  );

  const setActivity = (type: LiveActivityType, data: Omit<LiveActivity, 'type'>) => {
    const identity = activityIdentity({ type, id: data.id });
    setActivities((prev) => {
      const filtered = prev.filter((a) => activityIdentity(a) !== identity);
      return [...filtered, { type, ...data }];
    });
  };

  const removeActivity = (type: LiveActivityType, id?: string) => {
    if (!id) {
      setActivities((prev) => prev.filter((a) => a.type !== type));
      return;
    }

    const identity = activityIdentity({ type, id });
    setActivities((prev) => prev.filter((a) => activityIdentity(a) !== identity));
  };

  const clearActivities = () => {
    setActivities([]);
  };

  useInternalEvent<{ activities?: Array<Partial<LiveActivity>>; clear?: boolean }>('gcphone:mockLiveActivities', (detail) => {
    if (detail?.clear) {
      clearActivities();
      return;
    }

    const next = Array.isArray(detail?.activities)
      ? detail.activities
        .filter((activity): activity is LiveActivity => (
          isLiveActivityType(activity?.type)
          && typeof activity.title === 'string'
          && activity.title.trim().length > 0
        ))
        .map((activity) => ({
          id: typeof activity.id === 'string' ? activity.id : undefined,
          type: activity.type,
          title: activity.title,
          subtitle: typeof activity.subtitle === 'string' ? activity.subtitle : undefined,
          icon: typeof activity.icon === 'string' ? activity.icon : undefined,
          isPlaying: activity.isPlaying === true,
          volume: typeof activity.volume === 'number' ? activity.volume : undefined,
        }))
      : [];

    setActivities(next);
  });

  const store: LiveActivityStore = {
    activities: sorted,
    topActivity,
    setActivity,
    removeActivity,
    clearActivities,
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
