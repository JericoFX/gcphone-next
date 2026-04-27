import { For, Show, createMemo, createSignal, onMount } from 'solid-js';
import { useRouter } from '../../Phone/PhoneRouterContext';
import { usePhone } from '../../../store/phone';
import { usePhoneKeyHandler } from '../../../hooks/usePhoneKeyHandler';
import { t } from '../../../i18n';
import { fetchNui } from '../../../utils/fetchNui';
import { useNuiEvent } from '../../../utils/useNui';
import { AppScaffold } from '../../shared/layout';
import { useLiveActivity } from '../../../store/liveActivity';
import { useInternalEvent } from '../../../utils/internalEvents';
import { uiPrompt } from '../../../utils/uiDialog';
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

interface PlaylistTrack {
  url: string;
  videoId?: string;
  title: string;
  thumbnail?: string;
}

interface Playlist {
  id: string;
  name: string;
  tracks: PlaylistTrack[];
}

function loadPlaylists(): Playlist[] {
  try {
    const raw = window.localStorage.getItem('gcphone:musicPlaylists');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function savePlaylists(playlists: Playlist[]) {
  window.localStorage.setItem('gcphone:musicPlaylists', JSON.stringify(playlists));
}

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
  const [status, setStatus] = createSignal(t('music.status_idle', language()));
  const [catalogEnabled, setCatalogEnabled] = createSignal(true);
  const [privateMode, setPrivateMode] = createSignal(false);
  const [disclaimerDismissed, setDisclaimerDismissed] = createSignal(
    window.localStorage.getItem('gcphone:music:disclaimerDismissed') === 'true'
  );
  const [showUrlSection, setShowUrlSection] = createSignal(false);
  const [currentThumb, setCurrentThumb] = createSignal('');
  const [tab, setTab] = createSignal<'player' | 'playlists'>('player');
  const [playlists, setPlaylists] = createSignal<Playlist[]>(loadPlaylists());
  const [selectedPlaylist, setSelectedPlaylist] = createSignal<string | null>(null);
  const [queue, setQueue] = createSignal<PlaylistTrack[]>([]);
  const [queueIndex, setQueueIndex] = createSignal(0);
  const [shuffleMode, setShuffleMode] = createSignal(false);
  const [repeatMode, setRepeatMode] = createSignal<'off' | 'all' | 'one'>('off');
  const [addToPlaylistItem, setAddToPlaylistItem] = createSignal<SearchItem | null>(null);

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
  }, { routeId: 'music' });

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
    setStatus(t('music.broadcasting', language()));
    setBusyAction(false);
    setResults([]);
    setQuery('');
    setSearchError('');
  };

  const playManual = async () => {
    const url = manualUrl().trim();
    if (!url) return;

    setBusyAction(true);
    setStatus(t('music.sending_url', language()));

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
    setStatus(t('music.broadcasting', language()));
    setBusyAction(false);
  };

  const pause = async () => {
    setBusyAction(true);
    await fetchNui('musicPause');
    setIsPaused(true);
    setStatus(t('music.paused', language()));
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

  const createPlaylist = (name: string) => {
    const id = `pl_${Date.now()}`;
    const updated = [...playlists(), { id, name, tracks: [] }];
    setPlaylists(updated);
    savePlaylists(updated);
    setSelectedPlaylist(id);
  };

  const deletePlaylist = (id: string) => {
    const updated = playlists().filter((p) => p.id !== id);
    setPlaylists(updated);
    savePlaylists(updated);
    if (selectedPlaylist() === id) setSelectedPlaylist(null);
  };

  const addTrackToPlaylist = (playlistId: string, track: PlaylistTrack) => {
    const updated = playlists().map((p) => {
      if (p.id !== playlistId) return p;
      if (p.tracks.some((t) => t.url === track.url || (t.videoId && t.videoId === track.videoId))) return p;
      return { ...p, tracks: [...p.tracks, track] };
    });
    setPlaylists(updated);
    savePlaylists(updated);
  };

  const removeTrackFromPlaylist = (playlistId: string, trackIndex: number) => {
    const updated = playlists().map((p) => {
      if (p.id !== playlistId) return p;
      return { ...p, tracks: p.tracks.filter((_, i) => i !== trackIndex) };
    });
    setPlaylists(updated);
    savePlaylists(updated);
  };

  const playPlaylist = (playlist: Playlist, startIndex = 0) => {
    if (playlist.tracks.length === 0) return;
    let tracks = [...playlist.tracks];
    if (shuffleMode()) {
      tracks = tracks.sort(() => Math.random() - 0.5);
    }
    setQueue(tracks);
    setQueueIndex(startIndex);
    void playTrackFromQueue(tracks[startIndex]);
  };

  const playTrackFromQueue = async (track: PlaylistTrack) => {
    setBusyAction(true);
    await fetchNui('musicPlay', {
      ...(track.videoId ? { videoId: track.videoId } : { url: track.url }),
      title: track.title,
      volume: applyAudioProfile(volume() / 100),
      distance: distance(),
      private: privateMode(),
    });
    setNowPlaying(track.title);
    persistNowPlaying(track.title);
    setCurrentThumb(track.thumbnail || '');
    setIsPlaying(true);
    setIsPaused(false);
    setBusyAction(false);
  };

  const playNext = () => {
    if (queue().length === 0) return;
    let next = queueIndex() + 1;
    if (repeatMode() === 'one') {
      void playTrackFromQueue(queue()[queueIndex()]);
      return;
    }
    if (next >= queue().length) {
      if (repeatMode() === 'all') next = 0;
      else return;
    }
    setQueueIndex(next);
    void playTrackFromQueue(queue()[next]);
  };

  const playPrev = () => {
    if (queue().length === 0) return;
    const prev = Math.max(0, queueIndex() - 1);
    setQueueIndex(prev);
    void playTrackFromQueue(queue()[prev]);
  };

  const activePlaylist = () => playlists().find((p) => p.id === selectedPlaylist());

  return (
    <AppScaffold title={t('music.title', language())} onBack={() => router.goBack()} bodyClass={styles.content}>
      {/* Tab bar */}
      <div class={styles.tabBar}>
        <button class={styles.tabBtn} classList={{ [styles.tabBtnActive]: tab() === 'player' }} onClick={() => setTab('player')}>
          {t('music.now_playing', language()) || 'Reproductor'}
        </button>
        <button class={styles.tabBtn} classList={{ [styles.tabBtnActive]: tab() === 'playlists' }} onClick={() => setTab('playlists')}>
          Playlists
        </button>
      </div>

      <Show when={tab() === 'player'}>
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
              <div class={styles.track}>
                <img src={item.thumbnail || DEFAULT_THUMB} alt={item.title} loading="lazy" onClick={() => playFromResult(item)} />
                <div class={styles.trackMeta} onClick={() => playFromResult(item)}>
                  <div class={styles.trackTitle}>{item.title}</div>
                  <div class={styles.trackChannel}>{item.channel || t('music.channel_unnamed', language())}</div>
                </div>
                <button class={styles.trackAddBtn} onClick={() => setAddToPlaylistItem(item)}>+</button>
                <div class={styles.trackPlayBtn} onClick={() => playFromResult(item)}>
                  <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                </div>
              </div>
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

      {/* Queue controls */}
      <Show when={queue().length > 0}>
        <div class={styles.divider} />
        <div class={styles.queueControls}>
          <button class={styles.queueBtn} onClick={playPrev} disabled={queueIndex() === 0 && repeatMode() !== 'all'}>⏮</button>
          <span class={styles.queueInfo}>{queueIndex() + 1}/{queue().length}</span>
          <button class={styles.queueBtn} onClick={playNext} disabled={queueIndex() >= queue().length - 1 && repeatMode() !== 'all'}>⏭</button>
          <button class={styles.queueBtn} classList={{ [styles.queueBtnActive]: shuffleMode() }} onClick={() => setShuffleMode(!shuffleMode())}>🔀</button>
          <button class={styles.queueBtn} classList={{ [styles.queueBtnActive]: repeatMode() !== 'off' }} onClick={() => setRepeatMode(repeatMode() === 'off' ? 'all' : repeatMode() === 'all' ? 'one' : 'off')}>
            {repeatMode() === 'one' ? '🔂' : '🔁'}
          </button>
        </div>
      </Show>
      </Show>

      {/* Playlists Tab */}
      <Show when={tab() === 'playlists'}>
        <Show when={!selectedPlaylist()} fallback={
          <div class={styles.playlistDetail}>
            <div class={styles.playlistDetailHeader}>
              <button class={styles.backLink} onClick={() => setSelectedPlaylist(null)}>← Playlists</button>
              <h3>{activePlaylist()?.name}</h3>
              <button class={styles.playAllBtn} disabled={!activePlaylist()?.tracks.length} onClick={() => activePlaylist() && playPlaylist(activePlaylist()!)}>
                ▶ {t('music.play_all', language()) || 'Reproducir todo'}
              </button>
            </div>
            <Show when={activePlaylist()?.tracks.length === 0}>
              <div class={styles.emptyPlaylist}>{t('music.empty_playlist', language()) || 'Playlist vacia. Busca canciones y agregalas.'}</div>
            </Show>
            <div class={styles.results}>
              <For each={activePlaylist()?.tracks || []}>
                {(track, i) => (
                  <div class={styles.track}>
                    <img src={track.thumbnail || DEFAULT_THUMB} alt={track.title} loading="lazy" />
                    <div class={styles.trackMeta} onClick={() => { setTab('player'); void playTrackFromQueue(track); }}>
                      <div class={styles.trackTitle}>{track.title}</div>
                    </div>
                    <button class={styles.trackRemoveBtn} onClick={() => removeTrackFromPlaylist(selectedPlaylist()!, i())}>✕</button>
                  </div>
                )}
              </For>
            </div>
          </div>
        }>
          <div class={styles.playlistsList}>
            <button class={styles.createPlaylistBtn} onClick={async () => {
              const name = await uiPrompt(t('music.playlist_name_prompt', language()));
              if (name?.trim()) createPlaylist(name.trim());
            }}>
              + {t('music.new_playlist', language())}
            </button>
            <For each={playlists()}>
              {(pl) => (
                <div class={styles.playlistCard} onClick={() => setSelectedPlaylist(pl.id)}>
                  <div class={styles.playlistCardIcon}>🎵</div>
                  <div class={styles.playlistCardMeta}>
                    <strong>{pl.name}</strong>
                    <span>{pl.tracks.length} {pl.tracks.length === 1 ? 'cancion' : 'canciones'}</span>
                  </div>
                  <button class={styles.playlistDeleteBtn} onClick={(e) => { e.stopPropagation(); deletePlaylist(pl.id); }}>✕</button>
                </div>
              )}
            </For>
          </div>
        </Show>
      </Show>
      {/* Add to Playlist Selector */}
      <Show when={addToPlaylistItem()}>
        <div class={styles.playlistSelector} onClick={() => setAddToPlaylistItem(null)}>
          <div class={styles.playlistSelectorCard} onClick={(e) => e.stopPropagation()}>
            <div class={styles.playlistSelectorTitle}>{t('music.add_to_playlist', language()) || 'Agregar a playlist'}</div>
            <For each={playlists()}>
              {(pl) => (
                <button class={styles.playlistSelectorItem} onClick={() => {
                  const item = addToPlaylistItem();
                  if (item) {
                    addTrackToPlaylist(pl.id, { url: `https://youtube.com/watch?v=${item.videoId}`, videoId: item.videoId, title: item.title, thumbnail: item.thumbnail });
                    setStatus(`Agregado a "${pl.name}"`);
                  }
                  setAddToPlaylistItem(null);
                }}>
                  <span>{pl.name}</span>
                  <small>{pl.tracks.length} {pl.tracks.length === 1 ? 'cancion' : 'canciones'}</small>
                </button>
              )}
            </For>
            <button class={styles.playlistSelectorNew} onClick={async () => {
              const name = await uiPrompt(t('music.playlist_name', language()) || 'Nombre de la playlist:');
              if (name && name.trim()) {
                createPlaylist(name.trim());
                const item = addToPlaylistItem();
                const newPl = playlists().find(p => p.name === name.trim());
                if (item && newPl) {
                  addTrackToPlaylist(newPl.id, { url: `https://youtube.com/watch?v=${item.videoId}`, videoId: item.videoId, title: item.title, thumbnail: item.thumbnail });
                  setStatus(`Agregado a "${newPl.name}"`);
                }
                setAddToPlaylistItem(null);
              }
            }}>
              + {t('music.new_playlist', language()) || 'Nueva playlist'}
            </button>
            <button class={styles.playlistSelectorCancel} onClick={() => setAddToPlaylistItem(null)}>
              {t('action.cancel', language()) || 'Cancelar'}
            </button>
          </div>
        </div>
      </Show>
    </AppScaffold>
  );
}
