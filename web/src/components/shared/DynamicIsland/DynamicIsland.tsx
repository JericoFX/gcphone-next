import { Motion, Presence } from '@motionone/solid';
import { For, Match, Show, Switch, createEffect, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import { useLiveActivity, type LiveActivity } from '../../../store/liveActivity';
import { useRouter } from '../../Phone/PhoneFrame';
import { IslandMusic } from './IslandMusic';
import { IslandRadio } from './IslandRadio';
import { IslandCall } from './IslandCall';
import styles from './DynamicIsland.module.scss';

const MOTION_EASING = [0.32, 0.72, 0, 1];
const NO_MOTION_STATE = { opacity: 1, y: 0, scale: 1 };
const NO_MOTION_TRANSITION = { duration: 0.01 };

const ACTIVITY_TYPE_LABELS: Record<LiveActivity['type'], string> = {
  music: 'Music',
  radio: 'Radio',
  call: 'Call',
  cityride: 'CityRide',
  timer: 'Timer',
  recording: 'Recording',
  location: 'Location',
};

function isAssetIcon(icon?: string): boolean {
  return typeof icon === 'string' && /^(?:\.\.\/|\.\/|\/|https?:\/\/)/.test(icon);
}

function getActivityKey(activity?: LiveActivity): string {
  if (!activity) return 'none';

  return [
    activity.type,
    activity.id || '',
    activity.title,
    activity.subtitle || '',
    activity.icon || '',
    activity.isPlaying ? '1' : '0',
    typeof activity.volume === 'number' ? String(activity.volume) : '',
  ].join(':');
}

function getToneClass(activity: LiveActivity | undefined): string {
  if (!activity) return styles.dotMusic;
  if (activity.type === 'call') return styles.dotCall;
  if (activity.type === 'radio') return styles.dotRadio;
  if (activity.type === 'recording') return styles.dotRecording;
  if (activity.type === 'cityride') return styles.dotCityride;
  if (activity.type === 'location') return styles.dotLocation;
  if (activity.type === 'timer') return styles.dotTimer;
  return styles.dotMusic;
}

function getActivityTypeLabel(activity?: LiveActivity): string {
  if (!activity) return '';
  return ACTIVITY_TYPE_LABELS[activity.type];
}

function ActivityVisual(props: { activity?: LiveActivity; compact?: boolean; expanded?: boolean }) {
  const icon = () => props.activity?.icon?.trim();
  const iconIsAsset = () => isAssetIcon(icon());
  const toneClass = () => getToneClass(props.activity);

  return (
    <span
      class={styles.activityVisual}
      classList={{
        [styles.activityVisualCompact]: props.compact === true,
        [styles.activityVisualExpanded]: props.expanded === true,
      }}
    >
      <Show when={icon()} fallback={<span class={`${styles.activityPulseDot} ${toneClass()}`} />}>
        <Show
          when={iconIsAsset()}
          fallback={<span class={styles.activityGlyph}>{icon()}</span>}
        >
          <img class={styles.activityIcon} src={icon()} alt="" />
        </Show>
      </Show>
    </span>
  );
}

function ActivityStack(props: { primary?: LiveActivity; secondary?: LiveActivity; compact?: boolean; expanded?: boolean }) {
  return (
    <span
      class={styles.activityStack}
      classList={{
        [styles.activityStackCompact]: props.compact === true,
        [styles.activityStackExpanded]: props.expanded === true,
      }}
    >
      <ActivityVisual activity={props.primary} compact={props.compact} expanded={props.expanded} />
      <Show when={props.secondary}>
        <span class={styles.activityStackSecondary}>
          <ActivityVisual activity={props.secondary} compact={props.compact} expanded={props.expanded} />
        </span>
      </Show>
    </span>
  );
}

export function DynamicIsland(props: { locked?: boolean }) {
  const { activities } = useLiveActivity();
  const router = useRouter();
  const [expanded, setExpanded] = createSignal(false);
  const [activeIndex, setActiveIndex] = createSignal(0);
  const [minimized, setMinimized] = createSignal(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = createSignal(false);
  let compactTimer: number | undefined;
  let minimizeTimer: number | undefined;
  let rotateTimer: number | undefined;
  let previousSignature: string | undefined;
  let previousKeys: string[] = [];

  const currentActivity = createMemo(() => {
    const list = activities();
    return list[activeIndex()] || list[0];
  });
  const nextActivity = createMemo(() => {
    const list = activities();
    if (list.length < 2) return undefined;
    return list[(activeIndex() + 1) % list.length];
  });

  const isHome = () => router.currentRoute() === 'home';
  const isLocked = () => props.locked === true;
  const hasActivities = () => activities().length > 0;
  const multipleActivities = () => activities().length > 1;
  const activityCount = () => activities().length;
  const islandTransition = createMemo(() => (
    prefersReducedMotion()
      ? NO_MOTION_TRANSITION
      : { duration: expanded() ? 0.28 : 0.22, easing: MOTION_EASING }
  ));
  const islandInnerInitial = createMemo(() => (prefersReducedMotion() ? NO_MOTION_STATE : { opacity: 0, y: 6, scale: 0.985 }));
  const islandInnerExit = createMemo(() => (prefersReducedMotion() ? NO_MOTION_STATE : { opacity: 0, y: -5, scale: 0.985 }));
  const islandInnerTransition = createMemo(() => (prefersReducedMotion() ? NO_MOTION_TRANSITION : { duration: 0.22, easing: MOTION_EASING }));
  const activityPosition = () => {
    if (!currentActivity()) return 0;
    return Math.min(activeIndex(), activities().length - 1) + 1;
  };
  const activityPositionLabel = () => `${activityPosition()}/${activityCount()}`;
  const activitySignature = createMemo(() => activities().map((activity) => getActivityKey(activity)).join('|'));
  const activeTypeLabel = createMemo(() => getActivityTypeLabel(currentActivity()));
  const nextTypeLabel = createMemo(() => getActivityTypeLabel(nextActivity()));
  const viewKey = createMemo(() => (
    `${isHome() ? (expanded() ? 'expanded' : minimized() ? 'mini' : 'compact') : 'away'}:${getActivityKey(currentActivity())}:${activityPositionLabel()}`
  ));
  const shouldAutoMinimize = () => {
    const type = currentActivity()?.type;
    return type !== 'call' && type !== 'recording';
  };
  const compactDelayMs = () => (shouldAutoMinimize() ? 2800 : 5000);
  const minimizeDelayMs = () => (shouldAutoMinimize() ? 2400 : 3600);

  const pickChangedActivity = (currentKeys: string[], nextKeys: string[]) => {
    const newIndex = nextKeys.findIndex((key) => !currentKeys.includes(key));
    if (newIndex >= 0) return newIndex;

    const changedIndex = nextKeys.findIndex((key, index) => key !== currentKeys[index]);
    if (changedIndex >= 0) return changedIndex;

    return Math.min(activeIndex(), nextKeys.length - 1);
  };

  const handlePillClick = (event: MouseEvent) => {
    event.stopPropagation();

    if (!isHome()) {
      router.navigate('home');
      return;
    }

    if (isLocked()) return;

    if (expanded()) {
      currentActivity()?.onNavigate?.();
      return;
    }

    setMinimized(false);
    setExpanded(true);
  };

  const collapse = () => {
    setExpanded(false);
    setMinimized(false);
  };

  const cycleActivity = (event: MouseEvent) => {
    event.stopPropagation();
    if (!multipleActivities()) return;
    setActiveIndex((index) => (index + 1) % activities().length);
    setMinimized(false);
  };

  const focusActivity = (event: MouseEvent, index: number) => {
    event.stopPropagation();
    setActiveIndex(index);
    setMinimized(false);
  };

  onMount(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncReducedMotion = () => setPrefersReducedMotion(media.matches);
    syncReducedMotion();
    media.addEventListener('change', syncReducedMotion);
    onCleanup(() => media.removeEventListener('change', syncReducedMotion));
  });

  createEffect(() => {
    const signature = activitySignature();
    const nextKeys = signature ? signature.split('|') : [];
    const homeNow = isHome();

    if (!nextKeys.length) {
      previousSignature = undefined;
      previousKeys = [];
      setExpanded(false);
      setMinimized(false);
      setActiveIndex(0);
      return;
    }

    if (activeIndex() >= nextKeys.length) setActiveIndex(0);

    if (!previousSignature) {
      setActiveIndex(0);
      if (homeNow && !isLocked()) {
        setMinimized(false);
        setExpanded(true);
      }
    } else if (previousSignature !== signature) {
      setActiveIndex(pickChangedActivity(previousKeys, nextKeys));
      if (homeNow && !isLocked()) {
        setMinimized(false);
        setExpanded(true);
      }
    }

    previousSignature = signature;
    previousKeys = nextKeys;
  });

  createEffect(() => {
    activitySignature();
    const homeNow = isHome();
    const expandedNow = expanded();
    const minimizedNow = minimized();

    if (compactTimer) window.clearTimeout(compactTimer);
    if (minimizeTimer) window.clearTimeout(minimizeTimer);

    if (!hasActivities()) return;

    if (isLocked()) {
      setExpanded(false);
      setMinimized(true);
      return;
    }

    if (!homeNow) {
      setExpanded(false);
      setMinimized(false);
      return;
    }

    if (expandedNow) {
      compactTimer = window.setTimeout(() => {
        if (isHome() && expanded()) setExpanded(false);
      }, compactDelayMs());
      return;
    }

    if (!minimizedNow) {
      minimizeTimer = window.setTimeout(() => {
        if (isHome() && !expanded()) setMinimized(true);
      }, minimizeDelayMs());
    }
  });

  createEffect(() => {
    activitySignature();
    const homeNow = isHome();
    const expandedNow = expanded();
    const minimizedNow = minimized();
    const lockedNow = isLocked();
    const reducedMotionNow = prefersReducedMotion();

    if (rotateTimer) window.clearInterval(rotateTimer);
    if (!multipleActivities() || expandedNow || !homeNow || lockedNow || reducedMotionNow) return;

    rotateTimer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % activities().length);
    }, minimizedNow ? 2600 : 3800);
  });

  onCleanup(() => {
    if (compactTimer) window.clearTimeout(compactTimer);
    if (minimizeTimer) window.clearTimeout(minimizeTimer);
    if (rotateTimer) window.clearInterval(rotateTimer);
  });

  return (
    <Show when={hasActivities()}>
      <Show when={expanded() && isHome() && !isLocked()}>
        <div class={styles.overlay} data-testid="dynamic-island-overlay" onClick={collapse} />
      </Show>

      <div class={styles.islandSlot} classList={{ [styles.islandSlotLocked]: isLocked() }}>
        <Motion.div
          class={styles.island}
          data-testid="dynamic-island"
          data-activity-count={activityCount()}
          data-active-activity-id={currentActivity()?.id || currentActivity()?.type || ''}
          classList={{
            [styles.islandLocked]: isLocked(),
            [styles.islandMini]: !isHome(),
            [styles.islandMiniWithCount]: !isHome() && multipleActivities(),
            [styles.islandAutoMini]: isHome() && !expanded() && minimized(),
            [styles.islandAutoMiniWithCount]: isHome() && !expanded() && minimized() && multipleActivities(),
            [styles.islandCollapsed]: isHome() && !expanded() && !minimized(),
            [styles.islandCollapsedMulti]: isHome() && !expanded() && !minimized() && multipleActivities(),
            [styles.islandExpanded]: isHome() && expanded(),
          }}
          onClick={handlePillClick}
          title={multipleActivities() ? `${currentActivity()?.title || ''} (${activityPositionLabel()})` : currentActivity()?.title}
          animate={{ scale: expanded() ? 1 : 0.998, y: 0 }}
          transition={islandTransition()}
        >
          <Presence exitBeforeEnter>
            <Motion.div
              key={viewKey()}
              class={styles.islandInner}
              initial={islandInnerInitial()}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={islandInnerExit()}
              transition={islandInnerTransition()}
            >
              <Show when={!isHome()}>
                <div class={styles.miniContent}>
                  <ActivityStack primary={currentActivity()} secondary={nextActivity()} compact />
                  <Show when={multipleActivities()}>
                    <button
                      type="button"
                      class={`${styles.activityPeekButton} ${styles.activityPeekButtonMini}`}
                      data-testid="dynamic-island-activity-count"
                      onClick={cycleActivity}
                      aria-label="Alternar actividad"
                    >
                      <span class={styles.activityPeekCount}>{activityPositionLabel()}</span>
                    </button>
                  </Show>
                </div>
              </Show>

              <Show when={isHome() && !expanded() && !minimized()}>
                <div class={styles.compactContent} classList={{ [styles.compactContentMulti]: multipleActivities() }}>
                  <ActivityStack primary={currentActivity()} secondary={nextActivity()} compact />
                  <div class={styles.compactText}>
                    <Show when={multipleActivities()}>
                      <span class={styles.pillEyebrow}>{activeTypeLabel()}</span>
                    </Show>
                    <span class={styles.pillTitle}>{currentActivity()?.title || ''}</span>
                  </div>
                  <Show when={multipleActivities()}>
                    <button
                      type="button"
                      class={styles.activityPeekButton}
                      data-testid="dynamic-island-activity-count"
                      onClick={cycleActivity}
                      aria-label="Alternar actividad"
                    >
                      <ActivityVisual activity={nextActivity()} compact />
                      <span class={styles.activityPeekLabel}>{nextTypeLabel()}</span>
                      <span class={styles.activityPeekCount}>{activityPositionLabel()}</span>
                    </button>
                  </Show>
                </div>
              </Show>

              <Show when={isHome() && !expanded() && minimized()}>
                <div class={styles.miniContent}>
                  <ActivityStack primary={currentActivity()} secondary={nextActivity()} compact />
                  <Show when={multipleActivities()}>
                    <button
                      type="button"
                      class={`${styles.activityPeekButton} ${styles.activityPeekButtonMini}`}
                      data-testid="dynamic-island-activity-count"
                      onClick={cycleActivity}
                      aria-label="Alternar actividad"
                    >
                      <span class={styles.activityPeekCount}>{activityPositionLabel()}</span>
                    </button>
                  </Show>
                </div>
              </Show>

              <Show when={isHome() && expanded()}>
                <div class={styles.expandedShell}>
                  <Switch>
                    <Match when={currentActivity()?.type === 'music'}>
                      <IslandMusic activity={currentActivity()!} />
                    </Match>
                    <Match when={currentActivity()?.type === 'radio'}>
                      <IslandRadio activity={currentActivity()!} />
                    </Match>
                    <Match when={currentActivity()?.type === 'call'}>
                      <IslandCall activity={currentActivity()!} />
                    </Match>
                    <Match when={currentActivity()?.type === 'cityride' || currentActivity()?.type === 'timer' || currentActivity()?.type === 'recording' || currentActivity()?.type === 'location'}>
                      <div class={styles.expandedContent}>
                        <div class={styles.expandedHeader}>
                          <ActivityVisual activity={currentActivity()} expanded />
                          <div class={styles.expandedText}>
                            <div class={styles.expandedTitle}>{currentActivity()!.title}</div>
                            <div class={styles.expandedSubtitle}>{currentActivity()!.subtitle || ''}</div>
                          </div>
                        </div>
                        <Show when={currentActivity()!.onStop}>
                          <div class={styles.expandedControls}>
                            <button
                              type="button"
                              class={`${styles.controlBtn} ${styles.controlBtnDanger}`}
                              onClick={(event) => { event.stopPropagation(); currentActivity()!.onStop?.(); }}
                            >
                              ⏹
                            </button>
                          </div>
                        </Show>
                      </div>
                    </Match>
                  </Switch>

                  <Show when={multipleActivities()}>
                    <div class={styles.activityPager}>
                      <Motion.button
                        type="button"
                        class={styles.activityPeekButton}
                        data-testid="dynamic-island-activity-count"
                        onClick={cycleActivity}
                        aria-label="Alternar actividad"
                        animate={{ x: 0, opacity: 1 }}
                        transition={prefersReducedMotion() ? NO_MOTION_TRANSITION : { duration: 0.18, easing: MOTION_EASING }}
                      >
                        <ActivityVisual activity={nextActivity()} compact />
                        <span class={styles.activityPeekLabel}>{nextTypeLabel()}</span>
                        <span class={styles.activityPeekCount}>{activityPositionLabel()}</span>
                      </Motion.button>
                      <div class={styles.activityDots}>
                        <For each={activities()}>
                          {(activity, index) => (
                            <button
                              type="button"
                              class={styles.activityDot}
                              data-testid="dynamic-island-activity-dot"
                              classList={{ [styles.activityDotActive]: index() === activeIndex() }}
                              onClick={(event) => focusActivity(event, index())}
                              aria-label={`Ver actividad ${index() + 1}: ${getActivityTypeLabel(activity)}`}
                            />
                          )}
                        </For>
                      </div>
                    </div>
                  </Show>
                </div>
              </Show>
            </Motion.div>
          </Presence>
        </Motion.div>
      </div>
    </Show>
  );
}
