import { Show } from 'solid-js';
import styles from './MediaPreview.module.scss';

type MediaType = 'image' | 'video' | 'audio' | 'unknown';

function detectMediaType(url: string): MediaType {
  if (/\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(url)) return 'image';
  if (/\.(mp4|webm|mov|m3u8)(\?.*)?$/i.test(url)) return 'video';
  if (/\.(mp3|ogg|wav|m4a|aac)(\?.*)?$/i.test(url)) return 'audio';
  return 'unknown';
}

export interface MediaPreviewProps {
  url: string;
  class?: string;
  onClick?: () => void;
  showControls?: boolean;
  autoPlay?: boolean;
  muted?: boolean;
}

export function MediaPreview(props: MediaPreviewProps) {
  const mediaType = () => detectMediaType(props.url);

  return (
    <div
      classList={{
        [styles.preview]: true,
        [styles.clickable]: !!props.onClick,
        [props.class || '']: !!props.class,
      }}
      onClick={props.onClick}
    >
      <Show when={mediaType() === 'image'}>
        <img src={props.url} alt="media" class={styles.media} loading="lazy" />
      </Show>
      <Show when={mediaType() === 'video'}>
        <video
          src={props.url}
          class={styles.media}
          controls={props.showControls !== false}
          playsinline
          preload="metadata"
          autoplay={props.autoPlay}
          muted={props.muted}
        />
      </Show>
      <Show when={mediaType() === 'audio'}>
        <div class={styles.audioWrapper}>
          <div class={styles.audioIcon}>♪</div>
          <audio
            src={props.url}
            controls={props.showControls !== false}
            preload="metadata"
            class={styles.audioPlayer}
          />
        </div>
      </Show>
      <Show when={mediaType() === 'unknown'}>
        <div class={styles.unknown}>
          <span class={styles.unknownIcon}>📄</span>
          <span class={styles.unknownText}>Archivo</span>
        </div>
      </Show>
    </div>
  );
}

export interface MediaGridProps {
  items: { url: string; type?: 'image' | 'video' | 'audio' }[];
  columns?: 2 | 3 | 4;
  class?: string;
  onItemClick?: (url: string, index: number) => void;
}

export function MediaGrid(props: MediaGridProps) {
  const columns = () => props.columns || 3;

  return (
    <div
      classList={{
        [styles.grid]: true,
        [styles.cols2]: columns() === 2,
        [styles.cols4]: columns() === 4,
        [props.class || '']: !!props.class,
      }}
    >
      {props.items.map((item, index) => (
        <MediaPreview
          url={item.url}
          onClick={() => props.onItemClick?.(item.url, index)}
          showControls={false}
        />
      ))}
    </div>
  );
}
