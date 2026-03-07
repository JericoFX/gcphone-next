import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { usePhone } from '../../../store/phone';
import { usePhoneKeyHandler } from '../../../hooks/usePhoneKeyHandler';
import { t } from '../../../i18n';
import { fetchNui } from '../../../utils/fetchNui';
import { AppScaffold } from '../../shared/layout';
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
  };

  usePhoneKeyHandler({
    Backspace: () => {
      router.goBack();
    },
  });

  createEffect(() => {
    const onMessage = (event: MessageEvent<{ action?: string; data?: MusicStatePayload }>) => {
      if (event?.data?.action !== 'musicStateUpdated') return;
      applyServerState(event.data.data);
      setBusyAction(false);
    };

    window.addEventListener('message', onMessage as EventListener);

    onCleanup(() => {
      window.removeEventListener('message', onMessage as EventListener);
    });
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
    });

    setNowPlaying(track.title || 'YouTube');
    persistNowPlaying(track.title || 'YouTube');
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
    });

    setNowPlaying('URL manual');
    persistNowPlaying('URL manual');
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

  return (
    <AppScaffold title={t('music.title', language())} onBack={() => router.goBack()} bodyClass={styles.content}>
        <section class={styles.hero}>
          <div class={styles.heroBackdrop} />
          <div class={styles.heroText}>
            <div class={styles.kicker}>{stateLabel()}</div>
            <h2>{nowPlaying()}</h2>
            <p>{status()}</p>
          </div>
        </section>

        <section class="ios-list">
          <div class="ios-row">
            <span class="ios-label">{t('music.search_yt', language())}</span>
            <span class="ios-value">{results().length}</span>
          </div>
          <div class={styles.searchRow}>
            <input
              class={`ios-input ${styles.searchInput}`}
              type="text"
              placeholder={t('music.search_example', language())}
              value={query()}
              disabled={!catalogEnabled()}
              onInput={(e) => setQuery(e.currentTarget.value)}
            />
            <button class="ios-primary-btn" disabled={searching() || !catalogEnabled()} onClick={searchCatalog}>
              {searching() ? t('music.searching', language()) : t('music.search', language())}
            </button>
          </div>
          <Show when={searchError()}>
            <div class={styles.error}>{searchError()}</div>
          </Show>
        </section>

        <Show when={results().length > 0}>
          <section class={styles.results}>
            <For each={results()}>
              {(item) => (
                <button class={styles.track} onClick={() => playFromResult(item)} disabled={busyAction()}>
                  <img src={item.thumbnail || DEFAULT_THUMB} alt={item.title} loading="lazy" />
                  <div class={styles.trackMeta}>
                    <div class={styles.trackTitle}>{item.title}</div>
                    <div class={styles.trackChannel}>{item.channel || t('music.channel_unnamed', language())}</div>
                  </div>
                  <div class={styles.trackAction}>Play</div>
                </button>
              )}
            </For>
          </section>
        </Show>

        <section class="ios-list">
          <div class="ios-row">
            <span class="ios-label">{t('music.manual_url', language())}</span>
          </div>
          <div class={styles.searchRow}>
            <input
              class={`ios-input ${styles.searchInput}`}
              type="text"
              placeholder={t('music.manual_url_placeholder', language())}
              value={manualUrl()}
              onInput={(e) => setManualUrl(e.currentTarget.value)}
            />
            <button class="ios-secondary-btn" disabled={!manualUrl().trim() || busyAction()} onClick={playManual}>
              {t('settings.apply', language())}
            </button>
          </div>
        </section>

        <section class="ios-list">
          <div class="ios-row">
            <span class="ios-label">{t('music.controls', language())}</span>
          </div>

          <div class={styles.controls}>
            <button class="ios-secondary-btn" onClick={pause} disabled={!isPlaying() || isPaused() || busyAction()}>
              Pausar
            </button>
            <button class="ios-primary-btn" onClick={resume} disabled={!isPlaying() || !isPaused() || busyAction()}>
              Reanudar
            </button>
            <button class="ios-danger-btn" onClick={stop} disabled={!isPlaying() || busyAction()}>
              Detener
            </button>
          </div>

          <div class={styles.sliderGroup}>
            <div class={styles.sliderLabel}>
              <span>{t('settings.volume', language())}</span>
              <strong>{volume()}%</strong>
            </div>
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

          <div class={styles.sliderGroup}>
            <div class={styles.sliderLabel}>
              <span>Distancia 3D</span>
              <strong>{distance()}m</strong>
            </div>
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
        </section>
    </AppScaffold>
  );
}
