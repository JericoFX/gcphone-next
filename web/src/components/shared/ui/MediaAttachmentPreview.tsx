import { Show } from 'solid-js';
import { resolveMediaType } from '../../../utils/sanitize';
import styles from './MediaAttachmentPreview.module.scss';

interface MediaAttachmentPreviewProps {
  url: string | null | undefined;
  alt?: string;
  removable?: boolean;
  removeLabel?: string;
  onRemove?: () => void;
  onOpen?: () => void;
  class?: string;
  mediaClass?: string;
  removeClass?: string;
}

export function MediaAttachmentPreview(props: MediaAttachmentPreviewProps) {
  const mediaType = () => resolveMediaType(props.url || '');

  return (
    <Show when={props.url}>
      <div class={styles.preview} classList={{ [props.class || '']: !!props.class }}>
        <Show
          when={mediaType() === 'video'}
          fallback={<img class={props.mediaClass} src={props.url!} alt={props.alt || ''} onClick={props.onOpen} />}
        >
          <video class={props.mediaClass} src={props.url!} controls playsinline preload="metadata" onClick={props.onOpen} />
        </Show>

        <Show when={props.removable && props.onRemove}>
          <button class={styles.removeButton} classList={{ [props.removeClass || '']: !!props.removeClass }} onClick={props.onRemove}>
            {props.removeLabel || '✕'}
          </button>
        </Show>
      </div>
    </Show>
  );
}
