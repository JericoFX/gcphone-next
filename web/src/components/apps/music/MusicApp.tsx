import { For, Show, createEffect, createSignal, onCleanup } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { usePhone } from '../../../store/phone';
import { fetchNui } from '../../../utils/fetchNui';
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

  const [query, setQuery] = createSignal('');
  const [searching, setSearching] = createSignal(false);
  const [searchError, setSearchError] = createSignal('');
  const [results, setResults] = createSignal<SearchItem[]>([]);

  const [manualUrl, setManualUrl] = createSignal('');
  const [nowPlaying, setNowPlaying] = createSignal('Sin reproduccion activa');
  const [isPlaying, setIsPlaying] = createSignal(false);
  const [isPaused, setIsPaused] = createSignal(false);

  const [volume, setVolume] = createSignal(15);
  const [distance, setDistance] = createSignal(15);
  const [busyAction, setBusyAction] = createSignal(false);
  const [status, setStatus] = createSignal('Busca una pista y reproduccela para toda la zona.');

  const persistNowPlaying = (title: string) => {
    const value = title?.trim() || 'Sin musica';
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

  createEffect(() => {
    const onKey = (e: CustomEvent<string>) => {
      if (e.detail === 'Backspace') router.goBack();
    };

    const onMessage = (event: MessageEvent<{ action?: string; data?: MusicStatePayload }>) => {
      if (event?.data?.action !== 'musicStateUpdated') return;
      applyServerState(event.data.data);
      setBusyAction(false);
    };

    window.addEventListener('phone:keyUp', onKey as EventListener);
    window.addEventListener('message', onMessage as EventListener);

    onCleanup(() => {
      window.removeEventListener('phone:keyUp', onKey as EventListener);
      window.removeEventListener('message', onMessage as EventListener);
    });
  });

  const searchCatalog = async () => {
    const term = query().trim();
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
    setSearchError(list.length === 0 ? 'Sin resultados.' : '');
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
    setNowPlaying('Sin reproduccion activa');
    persistNowPlaying('Sin musica');
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
    <div class="ios-page">
      <div class={`ios-nav ${styles.nav}`}>
        <button class="ios-icon-btn" onClick={() => router.goBack()}>
          ‹
        </button>
        <div class="ios-nav-title">Musica</div>
      </div>

      <div class={`ios-content ${styles.content}`}>
        <section class={styles.hero}>
          <div class={styles.heroBackdrop} />
          <div class={styles.heroText}>
            <div class={styles.kicker}>Servidor</div>
            <h2>{nowPlaying()}</h2>
            <p>{status()}</p>
          </div>
        </section>

        <section class="ios-list">
          <div class="ios-row">
            <span class="ios-label">Buscar en YouTube</span>
          </div>
          <div class={styles.searchRow}>
            <input
              class={`ios-input ${styles.searchInput}`}
              type="text"
              placeholder="Ej: Daft Punk - One More Time"
              value={query()}
              onInput={(e) => setQuery(e.currentTarget.value)}
            />
            <button class="ios-primary-btn" disabled={searching()} onClick={searchCatalog}>
              {searching() ? 'Buscando...' : 'Buscar'}
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
                    <div class={styles.trackChannel}>{item.channel || 'Canal sin nombre'}</div>
                  </div>
                  <div class={styles.trackAction}>Play</div>
                </button>
              )}
            </For>
          </section>
        </Show>

        <section class="ios-list">
          <div class="ios-row">
            <span class="ios-label">URL manual</span>
          </div>
          <div class={styles.searchRow}>
            <input
              class={`ios-input ${styles.searchInput}`}
              type="text"
              placeholder="https://youtube.com/watch?v=..."
              value={manualUrl()}
              onInput={(e) => setManualUrl(e.currentTarget.value)}
            />
            <button class="ios-secondary-btn" disabled={!manualUrl().trim() || busyAction()} onClick={playManual}>
              Enviar
            </button>
          </div>
        </section>

        <section class="ios-list">
          <div class="ios-row">
            <span class="ios-label">Controles</span>
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
              <span>Volumen</span>
              <strong>{volume()}%</strong>
            </div>
            <input
              class="ios-slider"
              type="range"
              min="0"
              max="100"
              value={volume()}
              onInput={(e) => {
                void syncAudioControls(Number(e.currentTarget.value), distance());
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
              onInput={(e) => {
                void syncAudioControls(volume(), Number(e.currentTarget.value));
              }}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
