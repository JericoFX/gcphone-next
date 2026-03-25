import { For, Show, createMemo, createSignal, onMount } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { usePhone } from '../../../store/phone';
import { usePhoneKeyHandler } from '../../../hooks/usePhoneKeyHandler';
import { t } from '../../../i18n';
import { fetchNui } from '../../../utils/fetchNui';
import { useNuiEvent } from '../../../utils/useNui';
import { AppScaffold } from '../../shared/layout';
import { useLiveActivity } from '../../../store/liveActivity';
import { useInternalEvent } from '../../../utils/internalEvents';
import styles from './MusicApp.module.scss';

interface SearchItem {
  videoId: string;
  title: string;
  channel?: string;
  thumbnail?: string;
  url?: string;
}

interface SearchResponse {
  success?: boolean;
  error?: string;
  results?: SearchItem[];
}

interface MusicStatePayload {
  success?: boolean;
  error?: string;
  isPlaying?: boolean;
  isPaused?: boolean;
  title?: string;
  volume?: number;
  distance?: number;
}

const DEFAULT_THUMB = './img/icons_ios/music.svg';

export function MusicApp() {
  const router = useRouter();
  const [phoneState] = usePhone();
  const language = () => phoneState.settings.language || 'es';
  const { setActivity, removeActivity } = useLiveActivity();

  const [query, setQuery] = createSignal('');
  const [searching, setSearching] = createSignal(false);
  const [searchError, setSearchError] = createSignal('');
  const [results, setResults] = createSignal<SearchItem[]>([]);

  const [manualUrl, setManualUrl] = createSignal('');
  const [nowPlaying, setNowPlaying] = createSignal(t('music.no_playback', language()));
  const [isPlaying, setIsPlaying] = createSignal(false);
  const [isPaused, setIsPaused] = createSignal(false);

  const [volume, setVolume] = createSignal(15);
  const [distance, setDistance] = createSignal(15);
  const [busyAction, setBusyAction] = createSignal(false);
  const [status, setStatus] = createSignal('Busca una pista y reproduccela para toda la zona.');
  const [catalogEnabled, setCatalogEnabled] = createSignal(true);
  const [privateMode, setPrivateMode] = createSignal(false);
  const [disclaimerDismissed, setDisclaimerDismissed] = createSignal(
    window.localStorage.getItem('gcphone:music:disclaimerDismissed') === 'true'
  );
  const [showUrlSection, setShowUrlSection] = createSignal(false);
  const [currentThumb, setCurrentThumb] = createSignal('');

  const stateLabel = createMemo(() => {
    if (isPaused()) return 'Pausado';
    if (isPlaying()) return 'En vivo';
    return 'Idle';
  });

  const persistNowPlaying = (title: string) => {
    const value = title?.trim() || t('music.no_music', language());
    window.localStorage.setItem('gcphone:musicNowPlaying', value);
    window.dispatchEvent(new StorageEvent('storage', { key: 'gcphone:musicNowPlaying', newValue: value }));
  };

  const dismissDisclaimer = () => {
    setDisclaimerDismissed(true);
    window.localStorage.setItem('gcphone:music:disclaimerDismissed', 'true');
  };

  const applyServerState = (payload?: MusicStatePayload) => {
    if (!payload || typeof payload !== 'object') return;

    if (typeof payload.isPlaying === 'boolean') {
      setIsPlaying(payload.isPlaying);
      if (!payload.isPlaying) {
        setIsPaused(false);
      }
    }

    if (typeof payload.isPaused === 'boolean') {
      setIsPaused(payload.isPaused);
    }

    if (typeof payload.title === 'string' && payload.title.trim()) {
      const track = payload.title.trim();
      setNowPlaying(track);
      persistNowPlaying(track);
    }

    if (typeof payload.volume === 'number') {
      setVolume(Math.round(Math.max(0, Math.min(1, payload.volume)) * 100));
    }

    if (typeof payload.distance === 'number') {
      setDistance(Math.round(Math.max(5, Math.min(80, payload.distance))));
    }

    if (payload.error) {
      setStatus(`Error: ${payload.error}`);
    }

    syncLiveActivity();
  };

  const syncLiveActivity = () => {
    if (isPlaying() || isPaused()) {
      setActivity('music', {
        title: nowPlaying(),
        subtitle: isPaused() ? 'Pausado' : 'Reproduciendo',
        icon: './img/icons_ios/music.svg',
        isPlaying: isPlaying() && !isPaused(),
        volume: volume(),
        onPause: () => handlePlayPause(),
        onStop: () => void stop(),
        onVolumeUp: () => void syncAudioControls(Math.min(100, volume() + 10), distance()),
        onVolumeDown: () => void syncAudioControls(Math.max(0, volume() - 10), distance()),
        onNavigate: () => router.navigate('music'),
      });
    } else {
      removeActivity('music');
    }
  };

  usePhoneKeyHandler({
    Backspace: () => {
      router.goBack();
    },
  });

  useInternalEvent<{ route: string }>('phone:appForceClose', (detail) => {
    if (detail?.route === 'music') {
      void fetchNui('musicStop', {}, {});
      removeActivity('music');
    }
  });

  useNuiEvent<MusicStatePayload>('musicStateUpdated', (payload) => {
    applyServerState(payload);
    setBusyAction(false);
  });

  onMount(() => {
    void (async () => {
      const response = await fetchNui<{ enabled?: boolean }>('musicCanSearchCatalog', {}, { enabled: false });
      const enabled = response?.enabled === true;
      setCatalogEnabled(enabled);
      if (!enabled) {
        setQuery('');
        setResults([]);
        setSearchError('Busqueda desactivada: falta API key de YouTube en el servidor.');
      }
    })();
  });

  const searchCatalog = async () => {
    const term = query().trim();
    if (!catalogEnabled()) {
      setSearchError('Busqueda desactivada: falta API key de YouTube en el servidor.');
      setResults([]);
      return;
    }

    if (!term) {
      setSearchError('Escribe algo para buscar.');
      setResults([]);
      return;
    }

    setSearching(true);
    setSearchError('');

    const response = await fetchNui<SearchResponse>('musicSearchCatalog', { query: term, limit: 12 });

    setSearching(false);

    if (!response || response.success === false) {
      setResults([]);
      setSearchError(response?.error || 'No se pudo consultar YouTube.');
      return;
    }

    const list = Array.isArray(response.results) ? response.results : [];
    setResults(list);
    setSearchError(list.length === 0 ? t('music.no_results', language()) : '');
  };

  const playFromResult = async (track: SearchItem) => {
    setBusyAction(true);
    setStatus('Resolviendo stream y enviando al servidor...');

    await fetchNui('musicPlay', {
      videoId: track.videoId,
      title: track.title,
      volume: applyAudioProfile(volume() / 100),
      distance: distance(),
      private: privateMode(),
    });

    setNowPlaying(track.title || 'YouTube');
    persistNowPlaying(track.title || 'YouTube');
    setCurrentThumb(track.thumbnail || '');
    setIsPlaying(true);
    setIsPaused(false);
    setStatus('Transmitiendo para jugadores cercanos.');
    setBusyAction(false);
  };

  const playManual = async () => {
    const url = manualUrl().trim();
    if (!url) return;

    setBusyAction(true);
    setStatus('Enviando URL al servidor...');

    await fetchNui('musicPlay', {
      url,
      title: 'URL manual',
      volume: applyAudioProfile(volume() / 100),
      distance: distance(),
      private: privateMode(),
    });

    setNowPlaying('URL manual');
    persistNowPlaying('URL manual');
    setCurrentThumb('');
    setIsPlaying(true);
    setIsPaused(false);
    setStatus('Transmitiendo para jugadores cercanos.');
    setBusyAction(false);
  };

  const pause = async () => {
    setBusyAction(true);
    await fetchNui('musicPause');
    setIsPaused(true);
    setStatus('Pausado.');
    setBusyAction(false);
  };

  const resume = async () => {
    setBusyAction(true);
    await fetchNui('musicResume');
    setIsPaused(false);
    setStatus('Reproduciendo.');
    setBusyAction(false);
  };

  const stop = async () => {
    setBusyAction(true);
    await fetchNui('musicStop');
    setIsPlaying(false);
    setIsPaused(false);
    setNowPlaying(t('music.no_playback', language()));
    persistNowPlaying(t('music.no_music', language()));
    setCurrentThumb('');
    setStatus('Detenido.');
    setBusyAction(false);
  };

  const syncAudioControls = async (nextVolume: number, nextDistance: number) => {
    setVolume(nextVolume);
    setDistance(nextDistance);

    if (!isPlaying()) return;
    await fetchNui('musicSetVolume', {
      volume: applyAudioProfile(nextVolume / 100),
      distance: nextDistance,
    });
  };

  const applyAudioProfile = (baseVolume: number) => {
    const profile = phoneState.settings.audioProfile || 'normal';
    if (profile === 'silent') return 0;
    if (profile === 'street') return Math.min(1, baseVolume * 1.2);
    if (profile === 'vehicle') return Math.min(1, baseVolume * 1.1);
    return baseVolume;
  };

  const handlePlayPause = () => {
    if (!isPlaying()) return;
    if (isPaused()) {
      void resume();
    } else {
      void pause();
    }
  };

  return (
    <AppScaffold title={t('music.title', language())} onBack={() => router.goBack()} bodyClass={styles.content}>
      {/* Disclaimer */}
      <Show when={!disclaimerDismissed()}>
        <div class={styles.disclaimer}>
          <span class={styles.disclaimerText}>
            Este recurso no se hace responsable del contenido musical reproducido. El uso es responsabilidad exclusiva del usuario.
          </span>
          <button class={styles.disclaimerClose} onClick={dismissDisclaimer}>✕</button>
        </div>
      </Show>

      {/* Now Playing Hero */}
      <section class={styles.hero}>
        <div class={styles.heroBackdrop} />
        <div class={styles.artwork}>
          <Show
            when={currentThumb()}
            fallback={
              <div class={styles.artworkPlaceholder}>
                <svg viewBox="0 0 24 24"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" /></svg>
              </div>
            }
          >
            <img src={currentThumb()} alt={nowPlaying()} />
          </Show>
        </div>
        <div class={styles.heroText}>
          <h2 class={styles.heroTitle}>{nowPlaying()}</h2>
          <span
            class={styles.statusBadge}
            classList={{
              [styles.statusLive]: isPlaying() && !isPaused(),
              [styles.statusPaused]: isPaused(),
              [styles.statusIdle]: !isPlaying(),
            }}
          >
            {stateLabel()}
          </span>
        </div>
      </section>

      {/* Player Controls */}
      <div class={styles.playerControls}>
        <button
          class={`${styles.controlBtn} ${styles.controlBtnSecondary}`}
          onClick={stop}
          disabled={!isPlaying() || busyAction()}
        >
          <svg viewBox="0 0 24 24"><path d="M6 6h12v12H6z" /></svg>
        </button>
        <button
          class={`${styles.controlBtn} ${styles.controlBtnPrimary}`}
          onClick={handlePlayPause}
          disabled={!isPlaying() || busyAction()}
        >
          <Show
            when={isPlaying() && !isPaused()}
            fallback={<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>}
          >
            <svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
          </Show>
        </button>
      </div>

      {/* Status line */}
      <div class={styles.statusText}>{status()}</div>

      {/* Sliders */}
      <div class={styles.slidersSection}>
        <div class={styles.sliderRow}>
          <div class={styles.sliderIcon}>
            <svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8.18v7.64a4.49 4.49 0 0 0 2.5-3.82zM14 3.23v2.06a7 7 0 0 1 0 13.42v2.06A9 9 0 0 0 14 3.23z" /></svg>
          </div>
          <div class={styles.sliderTrack}>
            <input
              class="ios-slider"
              type="range"
              min="0"
              max="100"
              value={volume()}
              style={{ '--value-percent': `${volume()}%` }}
              onInput={(e) => {
                const val = Number(e.currentTarget.value);
                e.currentTarget.style.setProperty('--value-percent', `${val}%`);
                void syncAudioControls(val, distance());
              }}
            />
          </div>
          <span class={styles.sliderValue}>{volume()}%</span>
        </div>
        <div class={styles.sliderRow}>
          <div class={styles.sliderIcon}>
            <svg viewBox="0 0 24 24"><path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3a4.24 4.24 0 0 0-6 0zm-4-4l2 2a7.07 7.07 0 0 1 10 0l2-2C14.34 8.34 9.66 8.34 5 13z" /></svg>
          </div>
          <div class={styles.sliderTrack}>
            <input
              class="ios-slider"
              type="range"
              min="5"
              max="30"
              value={distance()}
              style={{ '--value-percent': `${((distance() - 5) / (30 - 5)) * 100}%` }}
              onInput={(e) => {
                const val = Number(e.currentTarget.value);
                e.currentTarget.style.setProperty('--value-percent', `${((val - 5) / (30 - 5)) * 100}%`);
                void syncAudioControls(volume(), val);
              }}
            />
          </div>
          <span class={styles.sliderValue}>{distance()}m</span>
        </div>
      </div>

      {/* Private Mode */}
      <div class={styles.toggleRow}>
        <span class={styles.toggleLabel}>Solo yo</span>
        <button
          classList={{ [styles.toggle]: true, [styles.toggleActive]: privateMode() }}
          onClick={() => setPrivateMode(!privateMode())}
        >
          <span class={styles.toggleKnob} />
        </button>
      </div>

      <div class={styles.divider} />

      {/* Search */}
      <div class={styles.sectionHeader}>{t('music.search_yt', language())}</div>
      <div class={styles.searchRow}>
        <input
          class={styles.searchInput}
          type="text"
          placeholder={t('music.search_example', language())}
          value={query()}
          disabled={!catalogEnabled()}
          onInput={(e) => setQuery(e.currentTarget.value)}
        />
        <button class={styles.searchBtn} disabled={searching() || !catalogEnabled()} onClick={searchCatalog}>
          {searching() ? t('music.searching', language()) : t('music.search', language())}
        </button>
      </div>
      <Show when={searchError()}>
        <div class={styles.error}>{searchError()}</div>
      </Show>

      {/* Results */}
      <Show when={results().length > 0}>
        <div class={styles.results}>
          <For each={results()}>
            {(item) => (
              <button class={styles.track} onClick={() => playFromResult(item)} disabled={busyAction()}>
                <img src={item.thumbnail || DEFAULT_THUMB} alt={item.title} loading="lazy" />
                <div class={styles.trackMeta}>
                  <div class={styles.trackTitle}>{item.title}</div>
                  <div class={styles.trackChannel}>{item.channel || t('music.channel_unnamed', language())}</div>
                </div>
                <div class={styles.trackPlayBtn}>
                  <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                </div>
              </button>
            )}
          </For>
        </div>
      </Show>

      <div class={styles.divider} />

      {/* Manual URL */}
      <button class={styles.urlToggle} onClick={() => setShowUrlSection(!showUrlSection())}>
        <span
          class={styles.urlToggleArrow}
          classList={{ [styles.urlToggleArrowOpen]: showUrlSection() }}
        >
          &#9654;
        </span>
        {t('music.manual_url', language())}
      </button>
      <Show when={showUrlSection()}>
        <div class={styles.urlSection}>
          <div class={styles.urlRow}>
            <input
              class={styles.searchInput}
              type="text"
              placeholder={t('music.manual_url_placeholder', language())}
              value={manualUrl()}
              onInput={(e) => setManualUrl(e.currentTarget.value)}
            />
            <button class={styles.urlBtn} disabled={!manualUrl().trim() || busyAction()} onClick={playManual}>
              {t('settings.apply', language())}
            </button>
          </div>
        </div>
      </Show>
    </AppScaffold>
  );
}
