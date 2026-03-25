import { For, Show } from 'solid-js';
import { t } from '../../../i18n';
import {
  RadioStation,
  MusicSearchResult,
  MAX_QUEUE_SIZE,
  getCategoryLabel,
} from './radioShared';
import { RadioNowPlaying } from './RadioNowPlaying';
import styles from './RadioApp.module.scss';

interface RadioBroadcastProps {
  station: () => RadioStation;
  language: () => string;
  musicPlaying: () => boolean;
  musicTitle: () => string;
  musicVolume: () => number;
  musicPrivate: () => boolean;
  muted: () => boolean;
  duckPressed: () => boolean;
  livekitConnected: () => boolean;
  queue: () => MusicSearchResult[];
  currentQueueIndex: () => number;
  musicQuery: () => string;
  musicResults: () => MusicSearchResult[];
  musicSearching: () => boolean;
  disclaimerDismissed: () => boolean;
  streamerMode: boolean;
  onToggleMute: () => void;
  onDuckDown: () => void;
  onDuckUp: () => void;
  onTogglePrivate: () => void;
  onMusicSearch: () => void;
  onMusicPlay: (song: MusicSearchResult) => void;
  onMusicStop: () => void;
  onVolumeChange: (v: number) => void;
  onQueryChange: (v: string) => void;
  onAddToQueue: (song: MusicSearchResult) => void;
  onRemoveFromQueue: (index: number) => void;
  onClearQueue: () => void;
  onStartQueue: () => void;
  onDismissDisclaimer: () => void;
  onEndBroadcast: () => void;
}

export function RadioBroadcast(props: RadioBroadcastProps) {
  return (
    <div class={styles.broadcastView}>

      {/* 1. ON AIR bar */}
      <div class={styles.onAirBar}>
        <div class={styles.onAirBadge}>
          <span class={styles.pulseDot} />
          {'ON AIR'}
        </div>
        <span class={styles.activeStationName}>
          {props.station().stationName}
        </span>
        <span class={styles.activeCategory}>
          {getCategoryLabel(props.station().category, props.language())}
        </span>
      </div>

      {/* 2. Now Playing (compact) */}
      <RadioNowPlaying
        station={props.station()}
        musicTitle={props.musicTitle()}
        musicPlaying={props.musicPlaying()}
        size="compact"
        onStop={props.musicPlaying() ? props.onMusicStop : undefined}
        volume={props.musicVolume()}
        onVolume={props.onVolumeChange}
        streamerMode={props.streamerMode}
        language={props.language}
      />

      {/* 3. Mic row */}
      <div class={styles.micRow}>
        {/* Mute button */}
        <button
          classList={{
            [styles.micBtn]: true,
            [styles.micBtnActive]: props.muted(),
          }}
          onClick={props.onToggleMute}
          aria-label={
            props.muted()
              ? t('radio.mic_off', props.language()) || 'Mic apagado'
              : t('radio.mic_on', props.language()) || 'Mic encendido'
          }
        >
          <Show
            when={props.muted()}
            fallback={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" x2="12" y1="19" y2="22" />
              </svg>
            }
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="2" x2="22" y1="2" y2="22" />
              <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
              <path d="M5 10v2a7 7 0 0 0 12 5" />
              <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
              <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
              <line x1="12" x2="12" y1="19" y2="22" />
            </svg>
          </Show>
        </button>

        {/* PTT button */}
        <button
          classList={{
            [styles.pttBtn]: true,
            [styles.pttBtnActive]: props.duckPressed(),
          }}
          onPointerDown={props.onDuckDown}
          onPointerUp={props.onDuckUp}
          onPointerLeave={props.onDuckUp}
          style={{ 'user-select': 'none', 'touch-action': 'none' }}
        >
          {props.duckPressed()
            ? t('radio.speaking', props.language()) || 'Hablando...'
            : t('radio.press_to_talk', props.language()) || 'Mantener para hablar'}
        </button>
      </div>

      {/* 4. Modo audifono */}
      <div class={styles.audioModeRow}>
        <div class={styles.audioModeLabel}>
          <span class="ios18-cell__title">
            {t('radio.music_private', props.language()) || 'Modo audifono'}
          </span>
          <span class="ios18-cell__subtitle">
            {t('radio.music_private_caption', props.language()) ||
              'La musica solo se escucha para ti'}
          </span>
        </div>
        <div
          class="ios18-switch"
          role="switch"
          aria-checked={props.musicPrivate()}
          onClick={props.onTogglePrivate}
        >
          <div class="ios18-switch__thumb" />
        </div>
      </div>

      {/* 5. Queue section */}
      <div class={styles.queueSection}>
        <div style={{ display: 'flex', 'align-items': 'center', 'justify-content': 'space-between' }}>
          <span class={styles.sectionTitle}>
            {t('radio.queue', props.language()) || 'Cola'} ({props.queue().length}/{MAX_QUEUE_SIZE})
          </span>
          <Show when={props.queue().length > 0}>
            <button class={styles.queueRemoveBtn} onClick={props.onClearQueue}>
              {t('radio.clear_queue', props.language()) || 'Limpiar'}
            </button>
          </Show>
        </div>

        <Show
          when={props.queue().length > 0}
          fallback={
            <span class={styles.queueEmpty}>
              {t('radio.queue_empty', props.language()) || 'Sin canciones en cola'}
            </span>
          }
        >
          <div class={styles.queueList}>
            <For each={props.queue()}>
              {(song, i) => (
                <div
                  classList={{
                    [styles.queueItem]: true,
                    [styles.queueItemActive]: i() === props.currentQueueIndex(),
                  }}
                >
                  <span class={styles.queueIndex}>{i() + 1}</span>
                  <img
                    class={styles.queueThumb}
                    src={song.thumbnail}
                    alt=""
                    loading="lazy"
                  />
                  <span class={styles.queueTitle}>{song.title}</span>
                  <button
                    class={styles.queueRemoveBtn}
                    onClick={() => props.onRemoveFromQueue(i())}
                    aria-label={t('radio.remove', props.language()) || 'Quitar'}
                  >
                    &#10005;
                  </button>
                </div>
              )}
            </For>
          </div>

          <Show when={!props.musicPlaying()}>
            <button class={styles.playlistBtn} onClick={props.onStartQueue}>
              {t('radio.start_queue', props.language()) || 'Iniciar cola'}
            </button>
          </Show>
        </Show>
      </div>

      {/* 6. Search section */}
      <div class={styles.section}>
        <span class={styles.sectionTitle}>
          {t('radio.search_music', props.language()) || 'Buscar musica'}
        </span>

        {/* Disclaimer */}
        <Show when={!props.disclaimerDismissed()}>
          <div class={styles.disclaimer}>
            <span class={styles.disclaimerText}>
              {t('radio.music_disclaimer', props.language())}
            </span>
            <button
              class={styles.disclaimerClose}
              onClick={props.onDismissDisclaimer}
              aria-label={t('common.close', props.language()) || 'Cerrar'}
            >
              &#10005;
            </button>
          </div>
        </Show>

        {/* Search input + button */}
        <div class={styles.searchRow}>
          <input
            class="ios18-input"
            type="text"
            placeholder={
              t('radio.music_search_placeholder', props.language()) ||
              'Buscar cancion...'
            }
            value={props.musicQuery()}
            onInput={(e) => props.onQueryChange(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') props.onMusicSearch();
            }}
          />
          <button
            class={styles.addQueueBtn}
            style={{ width: 'auto', padding: '0 12px', 'border-radius': 'var(--r-md)', 'font-size': '12px' }}
            onClick={props.onMusicSearch}
            disabled={props.musicSearching() || !props.musicQuery().trim()}
          >
            {props.musicSearching()
              ? '...'
              : t('common.search', props.language()) || 'Buscar'}
          </button>
        </div>

        {/* Search results */}
        <Show when={props.musicResults().length > 0}>
          <div class={styles.resultsList}>
            <For each={props.musicResults()}>
              {(result) => (
                <div class={styles.resultItem}>
                  <img
                    class={styles.resultThumb}
                    src={result.thumbnail}
                    alt=""
                    loading="lazy"
                  />
                  <div class={styles.resultInfo}>
                    <span class={styles.resultTitle}>{result.title}</span>
                    <span class={styles.resultChannel}>{result.channel}</span>
                  </div>
                  <button
                    class={styles.addQueueBtn}
                    onClick={() => props.onAddToQueue(result)}
                    disabled={props.queue().length >= MAX_QUEUE_SIZE}
                    aria-label={t('radio.add_to_queue', props.language()) || 'Agregar a cola'}
                  >
                    +
                  </button>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>

      {/* Connection status */}
      <Show when={!props.livekitConnected()}>
        <span class={styles.connectionStatus}>
          {t('radio.connecting', props.language()) || 'Conectando...'}
        </span>
      </Show>

      {/* 7. Footer: end broadcast */}
      <button
        class={styles.endBtn}
        onClick={props.onEndBroadcast}
      >
        {t('radio.end_broadcast', props.language()) || 'Terminar emision'}
      </button>
    </div>
  );
}
