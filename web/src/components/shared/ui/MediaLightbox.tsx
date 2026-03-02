import { Show } from 'solid-js';
import { resolveMediaType } from '../../../utils/sanitize';
import styles from './MediaLightbox.module.scss';

interface Props {
  url: string | null;
  onClose: () => void;
}

export function MediaLightbox(props: Props) {
  return (
    <Show when={props.url}>
      <div class={styles.overlay} onClick={props.onClose}>
        <button class={styles.closeBtn} onClick={props.onClose}>✕</button>
        <div class={styles.content} onClick={(event) => event.stopPropagation()}>
          <Show when={resolveMediaType(props.url || undefined) === 'video'} fallback={<img src={props.url!} alt="media" />}>
            <video src={props.url!} controls playsinline preload="metadata" autoplay />
          </Show>
        </div>
      </div>
    </Show>
  );
}
