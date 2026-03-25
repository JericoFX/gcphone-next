import { Show } from 'solid-js';
import { t } from '../../../i18n';
import {
  RadioStation,
  getCategoryGradient,
  getCategoryIcon,
} from './radioShared';
import styles from './RadioApp.module.scss';

interface RadioNowPlayingProps {
  station: RadioStation;
  musicTitle: string;
  musicPlaying: boolean;
  size: 'compact' | 'large';
  onStop?: () => void;
  volume?: number;
  onVolume?: (v: number) => void;
  streamerMode?: boolean;
  language: () => string;
}

export function RadioNowPlaying(props: RadioNowPlayingProps) {
  const artworkClass = () =>
    props.size === 'compact' ? styles.artworkCompact : styles.artworkLarge;

  const iconSize = () => (props.size === 'compact' ? 40 : 64);

  return (
    <div
      classList={{
        [styles.nowPlayingWidget]: true,
        [styles.nowPlayingCompact]: props.size === 'compact',
        [styles.nowPlayingLarge]: props.size === 'large',
      }}
    >
      {/* Artwork */}
      <div
        class={`${styles.artwork} ${artworkClass()}`}
        style={{ background: getCategoryGradient(props.station.category) }}
      >
        <img
          class={styles.artworkIcon}
          src={getCategoryIcon(props.station.category)}
          alt=""
          width={iconSize()}
          height={iconSize()}
          style={{ filter: 'brightness(0) invert(1)', opacity: '0.4' }}
        />
      </div>

      {/* Track info + controls */}
      <div class={styles.trackInfo}>
        <span class={styles.trackLabel}>
          {t('radio.now_playing', props.language()) || 'Now Playing'}
        </span>
        <span class={styles.trackTitle}>
          {props.musicPlaying && props.musicTitle
            ? props.musicTitle
            : t('radio.no_music', props.language()) || 'Sin musica'}
        </span>

        {/* Controls */}
        <div class={styles.controls}>
          <Show when={props.onStop}>
            <button
              class={styles.stopBtn}
              onClick={props.onStop}
              aria-label={t('radio.stop_music', props.language()) || 'Stop'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="1" />
              </svg>
            </button>
          </Show>

          <Show when={props.onVolume !== undefined}>
            <input
              type="range"
              class={styles.volumeSlider}
              min="0"
              max="1"
              step="0.05"
              value={props.volume ?? 0.5}
              onInput={(e) => props.onVolume?.(parseFloat(e.currentTarget.value))}
              aria-label={t('radio.volume', props.language()) || 'Volume'}
            />
          </Show>
        </div>

        {/* Streamer mode notice */}
        <Show when={props.streamerMode}>
          <span class={styles.streamerNotice}>
            {t('radio.streamer_notice', props.language()) ||
              'Modo Streamer — musica silenciada'}
          </span>
        </Show>
      </div>
    </div>
  );
}
