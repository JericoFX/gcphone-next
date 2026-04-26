import { Show, createEffect, createMemo, createSignal, Switch, Match, For, onCleanup } from 'solid-js';
import { useLiveActivity } from '../../../store/liveActivity';
import { useRouter } from '../../Phone/PhoneFrame';
import { IslandMusic } from './IslandMusic';
import { IslandRadio } from './IslandRadio';
import { IslandCall } from './IslandCall';
import styles from './DynamicIsland.module.scss';

export function DynamicIsland() {
  const { activities } = useLiveActivity();
  const router = useRouter();
  const [expanded, setExpanded] = createSignal(false);
  const [activeIndex, setActiveIndex] = createSignal(0);
  const [minimized, setMinimized] = createSignal(false);
  let minimizeTimer: number | undefined;
  let rotateTimer: number | undefined;

  const currentActivity = () => {
    const list = activities();
    const idx = activeIndex();
    return list[idx] || list[0];
  };

  const isHome = () => router.currentRoute() === 'home';
  const hasActivities = () => activities().length > 0;
  const multipleActivities = () => activities().length > 1;
  const activityCount = () => activities().length;
  const activitySignature = createMemo(() => (
    activities()
      .map((activity) => `${activity.type}:${activity.title}:${activity.subtitle || ''}`)
      .join('|')
  ));
  const shouldAutoMinimize = () => {
    const type = currentActivity()?.type;
    return type !== 'call' && type !== 'recording';
  };
  const minimizeDelayMs = () => (shouldAutoMinimize() ? 3200 : 6500);

  const dotColor = () => {
    const act = currentActivity();
    if (!act) return styles.dotMusic;
    if (act.type === 'call') return styles.dotCall;
    if (act.type === 'radio') return styles.dotRadio;
    if (act.type === 'recording') return styles.dotRecording;
    if (act.type === 'cityride') return styles.dotCityride;
    if (act.type === 'location') return styles.dotLocation;
    if (act.type === 'timer') return styles.dotTimer;
    return styles.dotMusic;
  };

  const handlePillClick = (e: MouseEvent) => {
    e.stopPropagation();
    if (!isHome()) {
      // Mini mode: tap navigates to home
      router.navigate('home');
      return;
    }
    if (expanded()) {
      const act = currentActivity();
      act?.onNavigate?.();
    } else {
      setMinimized(false);
      setExpanded(true);
    }
  };

  const collapse = () => {
    setExpanded(false);
    setMinimized(false);
  };

  createEffect(() => {
    activitySignature();
    const expandedNow = expanded();
    const homeNow = isHome();
    if (activeIndex() >= activities().length) setActiveIndex(0);
    setMinimized(false);
    if (minimizeTimer) window.clearTimeout(minimizeTimer);
    if (!hasActivities() || expandedNow || !homeNow) return;
    minimizeTimer = window.setTimeout(() => {
      if (!expanded() && isHome()) setMinimized(true);
    }, minimizeDelayMs());
  });

  createEffect(() => {
    activitySignature();
    const expandedNow = expanded();
    const homeNow = isHome();
    if (rotateTimer) window.clearInterval(rotateTimer);
    if (!multipleActivities() || expandedNow || !homeNow) return;
    rotateTimer = window.setInterval(() => {
      setActiveIndex((idx) => (idx + 1) % activities().length);
    }, minimized() ? 2600 : 3400);
  });

  onCleanup(() => {
    if (minimizeTimer) window.clearTimeout(minimizeTimer);
    if (rotateTimer) window.clearInterval(rotateTimer);
  });

  return (
    <Show when={hasActivities()}>
      {/* Overlay to close expanded (only on home) */}
      <Show when={expanded() && isHome()}>
        <div class={styles.overlay} onClick={collapse} />
      </Show>

      <div
        class={styles.island}
        classList={{
          [styles.islandMini]: !isHome(),
          [styles.islandMiniWithCount]: !isHome() && multipleActivities(),
          [styles.islandAutoMini]: isHome() && !expanded() && minimized(),
          [styles.islandCollapsed]: isHome() && !expanded() && !minimized(),
          [styles.islandExpanded]: isHome() && expanded(),
        }}
        onClick={handlePillClick}
      >
        {/* Mini mode: wave bars only (inside apps) */}
        <Show when={!isHome()}>
          <span class={styles.miniWave} />
          <span class={styles.miniWave} />
          <span class={styles.miniWave} />
          <Show when={multipleActivities()}>
            <span class={styles.miniCount}>{activityCount()}</span>
          </Show>
        </Show>

        {/* Collapsed view (home, not expanded) */}
        <Show when={isHome() && !expanded() && !minimized()}>
          <span class={`${styles.dot} ${dotColor()}`} />
          <span class={styles.pillTitle}>
            {currentActivity()?.title || ''}
          </span>
          <Show when={multipleActivities()}>
            <span class={styles.pillCount}>{activityCount()}</span>
          </Show>
        </Show>

        {/* Auto-mini view (home, idle) */}
        <Show when={isHome() && !expanded() && minimized()}>
          <span class={`${styles.dot} ${dotColor()}`} />
          <Show when={multipleActivities()}>
            <span class={styles.miniCount}>{activityCount()}</span>
          </Show>
        </Show>

        {/* Expanded view (home, expanded) */}
        <Show when={isHome() && expanded()}>
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
                  <span class={`${styles.dot} ${dotColor()}`} />
                  <div style={{ flex: '1', 'min-width': '0' }}>
                    <div class={styles.expandedTitle}>{currentActivity()!.title}</div>
                    <div class={styles.expandedSubtitle}>{currentActivity()!.subtitle || ''}</div>
                  </div>
                </div>
                <Show when={currentActivity()!.onStop}>
                  <div class={styles.expandedControls}>
                    <button
                      class={`${styles.controlBtn} ${styles.controlBtnDanger}`}
                      onClick={(e) => { e.stopPropagation(); currentActivity()!.onStop?.(); }}
                    >
                      ⏹
                    </button>
                  </div>
                </Show>
              </div>
            </Match>
          </Switch>

          {/* Activity dots */}
          <Show when={multipleActivities()}>
            <div class={styles.activityDots}>
              <For each={activities()}>
                {(_, idx) => (
                  <button
                    class={styles.activityDot}
                    classList={{ [styles.activityDotActive]: idx() === activeIndex() }}
                    onClick={(e) => { e.stopPropagation(); setActiveIndex(idx()); }}
                  />
                )}
              </For>
            </div>
          </Show>
        </Show>
      </div>
    </Show>
  );
}
