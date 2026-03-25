import { Show, createEffect, createSignal, onCleanup } from 'solid-js';
import type { Accessor } from 'solid-js';
import { resolveMediaType } from '../../../utils/sanitize';
import { t } from '../../../i18n';
import type { SnapStory } from './SnapTypes';
import styles from './SnapApp.module.scss';

interface SnapStoryViewerOverlayProps {
  stories: Accessor<SnapStory[]>;
  activeIndex: Accessor<number | null>;
  setActiveIndex: (idx: number | null) => void;
  language: Accessor<string>;
}

export function SnapStoryViewerOverlay(props: SnapStoryViewerOverlayProps) {
  const [storyProgressPct, setStoryProgressPct] = createSignal(0);
  let storyTick: number | undefined;

  const activeStory = () => {
    const idx = props.activeIndex();
    return idx !== null ? props.stories()[idx] : null;
  };

  const shiftStory = (offset: number) => {
    const current = props.activeIndex();
    if (current === null) return;
    const next = current + offset;
    if (next < 0 || next >= props.stories().length) {
      props.setActiveIndex(null);
      setStoryProgressPct(0);
      return;
    }
    setStoryProgressPct(0);
    props.setActiveIndex(next);
  };

  const formatStoryTime = (expiresAt?: string) => {
    if (!expiresAt) return '';
    const remaining = Math.max(0, new Date(expiresAt).getTime() - Date.now());
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    if (hours > 0) return `${hours}h`;
    const mins = Math.floor(remaining / (1000 * 60));
    return `${mins}m`;
  };

  const handleStoryVideoTimeUpdate = (event: Event) => {
    const target = event.currentTarget as HTMLVideoElement | null;
    if (!target || target.duration <= 0) return;
    const pct = Math.min(100, (target.currentTime / target.duration) * 100);
    setStoryProgressPct(pct);
  };

  const handleStoryVideoEnded = () => {
    setStoryProgressPct(100);
    shiftStory(1);
  };

  createEffect(() => {
    const story = activeStory();
    if (!story) {
      if (storyTick) window.clearInterval(storyTick);
      storyTick = undefined;
      setStoryProgressPct(0);
      return;
    }

    if (story.media_type === 'video') {
      return;
    }

    const durationMs = 5000;
    const startedAt = Date.now();
    if (storyTick) window.clearInterval(storyTick);
    storyTick = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const pct = Math.min(100, (elapsed / durationMs) * 100);
      setStoryProgressPct(pct);
      if (pct >= 100) {
        window.clearInterval(storyTick);
        storyTick = undefined;
        shiftStory(1);
      }
    }, 100);

    onCleanup(() => {
      if (storyTick) window.clearInterval(storyTick);
      storyTick = undefined;
    });
  });

  onCleanup(() => {
    if (storyTick) {
      window.clearInterval(storyTick);
      storyTick = undefined;
    }
  });

  return (
    <Show when={props.activeIndex() !== null && activeStory()}>
      <div class={styles.storyViewer}>
        <button
          class={styles.storyClose}
          onClick={() => props.setActiveIndex(null)}
        >
          <img src="./img/icons_ios/ui-close.svg" alt="" draggable={false} />
        </button>

        <button
          class={styles.storyNav}
          classList={{ [styles.disabled]: (props.activeIndex() || 0) <= 0 }}
          onClick={() => shiftStory(-1)}
        >
          <img src="./img/icons_ios/ui-chevron-left.svg" alt="" draggable={false} />
        </button>

        <button
          class={styles.storyNav}
          classList={{ [styles.next]: true, [styles.disabled]: (props.activeIndex() || 0) >= props.stories().length - 1 }}
          onClick={() => shiftStory(1)}
        >
          <img src="./img/icons_ios/ui-chevron-right.svg" alt="" draggable={false} />
        </button>

        <div class={styles.storyProgress}>
          <div
            class={styles.progressBar}
            style={{ width: `${storyProgressPct()}%` }}
          />
        </div>

        <div class={styles.storyInfo}>
          <strong>{activeStory()?.display_name || activeStory()?.username}</strong>
          <span>{formatStoryTime(activeStory()?.expires_at)} {t('snap.remaining', props.language())}</span>
        </div>

        {resolveMediaType(activeStory()?.media_url) === 'video' ? (
          <video
            src={activeStory()?.media_url}
            playsinline
            autoplay
            muted={false}
            onTimeUpdate={handleStoryVideoTimeUpdate}
            onEnded={handleStoryVideoEnded}
            class={styles.storyMedia}
          />
        ) : (
          <img
            src={activeStory()?.media_url}
            alt=""
            class={styles.storyMedia}
          />
        )}
      </div>
    </Show>
  );
}
