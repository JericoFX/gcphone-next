import { Show } from 'solid-js';
import { t } from '../../../i18n';
import { RadioStation, getCategoryLabel } from './radioShared';
import { RadioNowPlaying } from './RadioNowPlaying';
import styles from './RadioApp.module.scss';

interface RadioListeningProps {
  station: () => RadioStation;
  language: () => string;
  musicPlaying: () => boolean;
  musicTitle: () => string;
  musicVolume: () => number;
  isDucked: () => boolean;
  livekitConnected: () => boolean;
  streamerMode: boolean;
  onLeave: () => void;
  onShare: () => void;
  onVolumeChange: (v: number) => void;
}

export function RadioListening(props: RadioListeningProps) {
  return (
    <div class={styles.listeningView}>
      {/* 1. Now Playing large */}
      <RadioNowPlaying
        station={props.station()}
        musicTitle={props.musicTitle()}
        musicPlaying={props.musicPlaying()}
        size="large"
        volume={props.musicVolume()}
        onVolume={props.onVolumeChange}
        streamerMode={props.streamerMode}
        language={props.language}
      />

      {/* 2. Station name + category pill + host */}
      <strong class={styles.listeningStation}>
        {props.station().stationName}
      </strong>

      <div class={styles.listeningMeta}>
        <span class={styles.categoryPill}>
          {getCategoryLabel(props.station().category, props.language())}
        </span>
        <span class={styles.hostName}>{props.station().hostName}</span>
      </div>

      {/* 3. Wave indicator when isDucked */}
      <Show when={props.isDucked()}>
        <div class={styles.waveIndicator}>
          <span class={styles.waveBar} />
          <span class={styles.waveBar} style={{ 'animation-delay': '0.15s' }} />
          <span class={styles.waveBar} style={{ 'animation-delay': '0.3s' }} />
        </div>
        <span class={styles.speakingLabel}>
          {t('radio.host_speaking', props.language()) || 'Hablando'}
        </span>
      </Show>

      {/* 4. Streamer mode notice */}
      <Show when={props.streamerMode}>
        <span class={styles.streamerNotice}>
          {t('radio.streamer_notice', props.language()) ||
            'Modo Streamer — musica silenciada'}
        </span>
      </Show>

      {/* Connection status */}
      <Show when={!props.livekitConnected()}>
        <span class={styles.connectionStatus}>
          {t('radio.connecting', props.language()) || 'Conectando...'}
        </span>
      </Show>

      <button class={styles.leaveBtn} onClick={props.onShare}>
        {t('action.share', props.language()) || 'Compartir'}
      </button>

      {/* 5. Salir button */}
      <button class={styles.leaveBtn} onClick={props.onLeave}>
        {t('radio.leave', props.language()) || 'Salir'}
      </button>
    </div>
  );
}
