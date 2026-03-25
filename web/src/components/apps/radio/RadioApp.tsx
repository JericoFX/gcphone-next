import { For, Show, createSignal, onMount, onCleanup, batch } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchNui } from '../../../utils/fetchNui';
import { sanitizeText } from '../../../utils/sanitize';
import { usePhoneKeyHandler } from '../../../hooks/usePhoneKeyHandler';
import { fetchLiveKitToken } from '../../../utils/realtimeAuth';
import { connectLiveKit, disconnectLiveKit, setLiveKitMicrophoneEnabled } from '../../../utils/livekit';
import { AppScaffold } from '../../shared/layout';
import { ScreenState } from '../../shared/ui/ScreenState';
import { t } from '../../../i18n';
import { usePhone } from '../../../store/phone';
import styles from './RadioApp.module.scss';

interface RadioStation {
  id: number;
  hostName: string;
  stationName: string;
  description: string;
  category: string;
  livekitRoom: string;
  listenerCount: number;
  createdAt: number;
}

interface CreateStationResult {
  success: boolean;
  station?: RadioStation;
  error?: string;
}

interface JoinStationResult {
  success: boolean;
  station?: RadioStation;
  error?: string;
}

interface MusicSearchResult {
  videoId: string;
  title: string;
  channel: string;
  thumbnail: string;
}

interface MusicSearchResponse {
  success: boolean;
  results: MusicSearchResult[];
  error?: string;
}

interface Playlist {
  id: number;
  name: string;
  songs: MusicSearchResult[];
  created_at: string;
  expires_at: string;
}

type RadioView = 'list' | 'create' | 'broadcasting' | 'listening';

const CATEGORIES = ['music', 'news', 'talk', 'emergency', 'community', 'other'] as const;

const POLL_INTERVAL_MS = 5000;
const MAX_QUEUE_SIZE = 10;

export function RadioApp() {
  const router = useRouter();
  const [phoneState] = usePhone();
  const language = () => phoneState.settings.language || 'es';
  const getCategoryLabel = (cat: string) => t('radio.category.' + cat, language()) || cat;

  const [view, setView] = createSignal<RadioView>('list');
  const [stations, setStations] = createSignal<RadioStation[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  // Create form
  const [formName, setFormName] = createSignal('');
  const [formDescription, setFormDescription] = createSignal('');
  const [formCategory, setFormCategory] = createSignal<string>('music');
  const [creating, setCreating] = createSignal(false);

  // Active session
  const [activeStation, setActiveStation] = createSignal<RadioStation | null>(null);
  const [muted, setMuted] = createSignal(false);
  const [livekitConnected, setLivekitConnected] = createSignal(false);

  // Music controls (host only)
  const [musicQuery, setMusicQuery] = createSignal('');
  const [musicResults, setMusicResults] = createSignal<MusicSearchResult[]>([]);
  const [musicSearching, setMusicSearching] = createSignal(false);
  const [musicPlaying, setMusicPlaying] = createSignal(false);
  const [musicTitle, setMusicTitle] = createSignal('');
  const [musicVolume, setMusicVolume] = createSignal(0.5);
  const [musicPrivate, setMusicPrivate] = createSignal(false);
  const [disclaimerDismissed, setDisclaimerDismissed] = createSignal(
    window.localStorage.getItem('gcphone:music:disclaimerDismissed') === 'true'
  );

  // Queue
  const [queue, setQueue] = createSignal<MusicSearchResult[]>([]);
  const [currentQueueIndex, setCurrentQueueIndex] = createSignal(-1);

  // Playlists
  const [playlists, setPlaylists] = createSignal<Playlist[]>([]);
  const [showPlaylists, setShowPlaylists] = createSignal(false);
  const [savingPlaylist, setSavingPlaylist] = createSignal(false);
  const [playlistNameInput, setPlaylistNameInput] = createSignal('');
  const [showSavePrompt, setShowSavePrompt] = createSignal(false);

  // Ducking (host)
  const [duckPressed, setDuckPressed] = createSignal(false);

  // Ducking (listener)
  const [isDucked, setIsDucked] = createSignal(false);

  const dismissDisclaimer = () => {
    setDisclaimerDismissed(true);
    window.localStorage.setItem('gcphone:music:disclaimerDismissed', 'true');
  };

  let pollTimer: ReturnType<typeof setInterval> | undefined;

  const loadStations = async () => {
    try {
      const list = await fetchNui<RadioStation[]>('radioGetStations', {}, []);
      setStations(list || []);
      setError(null);
    } catch {
      setError(t('radio.error_loading', language()));
    } finally {
      setLoading(false);
    }
  };

  const startPolling = () => {
    stopPolling();
    pollTimer = setInterval(() => {
      if (view() === 'list') {
        void loadStations();
      }
    }, POLL_INTERVAL_MS);
  };

  const stopPolling = () => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = undefined;
    }
  };

  onMount(() => {
    void loadStations();
    startPolling();
  });

  onCleanup(() => {
    stopPolling();
    void cleanupSession();
  });

  const cleanupSession = async () => {
    const station = activeStation();
    if (!station) return;

    const currentView = view();
    if (currentView === 'broadcasting') {
      await fetchNui('radioEndStation', { stationId: station.id }, { success: false });
    } else if (currentView === 'listening') {
      await fetchNui('radioLeaveStation', { stationId: station.id }, { success: false });
    }

    disconnectLiveKit();
    batch(() => {
      setActiveStation(null);
      setLivekitConnected(false);
      setMuted(false);
      setMusicPlaying(false);
      setMusicTitle('');
      setMusicResults([]);
      setQueue([]);
      setCurrentQueueIndex(-1);
      setDuckPressed(false);
      setIsDucked(false);
    });
  };

  // Listen for server-forced station end (host disconnected)
  const handleStationEnded = (event: MessageEvent) => {
    const payload = event.data;
    if (payload?.action !== 'gcphone:radio:stationEnded') return;

    const station = activeStation();
    if (station && station.id === payload.data) {
      disconnectLiveKit();
      batch(() => {
        setActiveStation(null);
        setLivekitConnected(false);
        setMuted(false);
        setQueue([]);
        setCurrentQueueIndex(-1);
        setIsDucked(false);
        setView('list');
      });
    }
  };

  const handleMusicUpdate = (event: MessageEvent) => {
    const p = event.data;
    if (p?.action !== 'gcphone:radio:musicUpdate') return;
    const d = p.data;
    if (!d) return;
    const station = activeStation();
    if (station && station.id === d.stationId) {
      const wasPlaying = musicPlaying();
      batch(() => {
        setMusicPlaying(d.isPlaying || false);
        setMusicTitle(d.title || '');
      });

      // Auto-play next in queue when song ends (host only)
      if (wasPlaying && !d.isPlaying && view() === 'broadcasting') {
        void playNextInQueue();
      }
    }
  };

  const handleMusicDucked = (event: MessageEvent) => {
    const p = event.data;
    if (p?.action !== 'gcphone:radio:musicDucked') return;
    const d = p.data;
    if (!d) return;
    const station = activeStation();
    if (station && station.id === d.stationId) {
      setIsDucked(d.ducked || false);
    }
  };

  onMount(() => {
    window.addEventListener('message', handleStationEnded);
    window.addEventListener('message', handleMusicUpdate);
    window.addEventListener('message', handleMusicDucked);
  });

  onCleanup(() => {
    window.removeEventListener('message', handleStationEnded);
    window.removeEventListener('message', handleMusicUpdate);
    window.removeEventListener('message', handleMusicDucked);
  });

  const connectToLiveKit = async (roomName: string, isHost: boolean) => {
    const tokenPayload = await fetchLiveKitToken(roomName, isHost, 3600);
    if (!tokenPayload?.success || !tokenPayload.url || !tokenPayload.token) {
      return false;
    }

    try {
      await connectLiveKit(tokenPayload.url, tokenPayload.token, tokenPayload.maxDuration || 3600, {
        onCallTimeout: () => {
          void cleanupSession();
          setView('list');
        },
      });

      if (isHost) {
        await setLiveKitMicrophoneEnabled(true);
      }

      setLivekitConnected(true);
      return true;
    } catch {
      disconnectLiveKit();
      return false;
    }
  };

  // --- Queue ---

  const addToQueue = (song: MusicSearchResult) => {
    if (queue().length >= MAX_QUEUE_SIZE) return;
    setQueue(prev => [...prev, song]);
  };

  const removeFromQueue = (index: number) => {
    const cur = currentQueueIndex();
    setQueue(prev => prev.filter((_, i) => i !== index));
    // Adjust current index if needed
    if (index < cur) {
      setCurrentQueueIndex(cur - 1);
    } else if (index === cur) {
      // Removed the currently playing song — don't change index, next playNextInQueue handles it
    }
  };

  const clearQueue = () => {
    setQueue([]);
    setCurrentQueueIndex(-1);
  };

  const playNextInQueue = async () => {
    const q = queue();
    const nextIdx = currentQueueIndex() + 1;
    if (nextIdx >= q.length) {
      setCurrentQueueIndex(-1);
      return;
    }
    setCurrentQueueIndex(nextIdx);
    await handleMusicPlay(q[nextIdx]);
  };

  const startQueue = async () => {
    const q = queue();
    if (q.length === 0) return;
    setCurrentQueueIndex(0);
    await handleMusicPlay(q[0]);
  };

  // --- Playlists ---

  const loadPlaylists = async () => {
    try {
      const result = await fetchNui<Playlist[]>('radioGetPlaylists', {}, []);
      setPlaylists(result || []);
    } catch {
      setPlaylists([]);
    }
  };

  const handleSavePlaylist = async () => {
    const name = playlistNameInput().trim();
    if (!name || queue().length === 0) return;
    setSavingPlaylist(true);
    try {
      await fetchNui('radioSavePlaylist', {
        name: sanitizeText(name, 60),
        songs: queue(),
      }, { success: false });
      batch(() => {
        setShowSavePrompt(false);
        setPlaylistNameInput('');
      });
    } finally {
      setSavingPlaylist(false);
    }
  };

  const handleLoadPlaylist = async (playlist: Playlist) => {
    setQueue(playlist.songs.slice(0, MAX_QUEUE_SIZE));
    setCurrentQueueIndex(-1);
    setShowPlaylists(false);
  };

  const handleDeletePlaylist = async (id: number) => {
    await fetchNui('radioDeletePlaylist', { id }, { success: false });
    setPlaylists(prev => prev.filter(p => p.id !== id));
  };

  const handleShowPlaylists = async () => {
    if (showPlaylists()) {
      setShowPlaylists(false);
      return;
    }
    await loadPlaylists();
    setShowPlaylists(true);
  };

  // --- Duck ---

  const onDuckDown = () => {
    setDuckPressed(true);
    const station = activeStation();
    if (station) {
      void fetchNui('radioMusicDuck', { stationId: station.id }, { success: false });
    }
  };

  const onDuckUp = () => {
    setDuckPressed(false);
    const station = activeStation();
    if (station) {
      void fetchNui('radioMusicUnduck', { stationId: station.id }, { success: false });
    }
  };

  // --- Handlers ---

  const handleCreate = async () => {
    const name = sanitizeText(formName(), 60);
    const description = sanitizeText(formDescription(), 200);
    if (!name) return;

    setCreating(true);
    try {
      const result = await fetchNui<CreateStationResult>('radioCreateStation', {
        stationName: name,
        description,
        category: formCategory(),
      }, { success: false });

      if (!result?.success || !result.station) {
        setCreating(false);
        return;
      }

      const station = result.station;
      const connected = await connectToLiveKit(station.livekitRoom, true);

      if (!connected) {
        await fetchNui('radioEndStation', { stationId: station.id }, { success: false });
        setCreating(false);
        return;
      }

      batch(() => {
        setActiveStation(station);
        setMuted(false);
        setView('broadcasting');
        setFormName('');
        setFormDescription('');
        setFormCategory('music');
        setCreating(false);
      });
    } catch {
      setCreating(false);
    }
  };

  const handleJoin = async (station: RadioStation) => {
    const result = await fetchNui<JoinStationResult>('radioJoinStation', {
      stationId: station.id,
    }, { success: false });

    if (!result?.success || !result.station) return;

    const joined = result.station;
    const connected = await connectToLiveKit(joined.livekitRoom, false);

    if (!connected) {
      await fetchNui('radioLeaveStation', { stationId: joined.id }, { success: false });
      return;
    }

    batch(() => {
      setActiveStation(joined);
      setMuted(false);
      setView('listening');
    });
  };

  const handleEndBroadcast = async () => {
    const station = activeStation();
    if (!station) return;

    if (musicPlaying()) {
      await fetchNui('radioStopMusic', { stationId: station.id }, { success: false });
    }

    await fetchNui('radioEndStation', { stationId: station.id }, { success: false });
    disconnectLiveKit();

    batch(() => {
      setActiveStation(null);
      setLivekitConnected(false);
      setMuted(false);
      setQueue([]);
      setCurrentQueueIndex(-1);
      setDuckPressed(false);
      setView('list');
    });

    void loadStations();
  };

  const handleLeave = async () => {
    const station = activeStation();
    if (!station) return;

    await fetchNui('radioLeaveStation', { stationId: station.id }, { success: false });
    disconnectLiveKit();

    batch(() => {
      setActiveStation(null);
      setLivekitConnected(false);
      setMuted(false);
      setIsDucked(false);
      setView('list');
    });

    void loadStations();
  };

  const handleMuteToggle = async () => {
    const next = !muted();
    setMuted(next);
    await setLiveKitMicrophoneEnabled(!next);
  };

  const handleMusicSearch = async () => {
    const query = musicQuery().trim();
    const station = activeStation();
    if (!query || !station) return;

    setMusicSearching(true);
    try {
      const result = await fetchNui<MusicSearchResponse>('radioSearchMusic', {
        stationId: station.id,
        query,
      }, { success: false, results: [] });
      setMusicResults(result?.results || []);
    } catch {
      setMusicResults([]);
    } finally {
      setMusicSearching(false);
    }
  };

  const handleMusicPlay = async (result: MusicSearchResult) => {
    const station = activeStation();
    if (!station) return;

    const resp = await fetchNui<{ success: boolean; title?: string }>('radioPlayMusic', {
      stationId: station.id,
      videoId: result.videoId,
      title: result.title,
      volume: musicVolume(),
      private: musicPrivate(),
    }, { success: false });

    if (resp?.success) {
      batch(() => {
        setMusicPlaying(true);
        setMusicTitle(result.title);
        setMusicResults([]);
        setMusicQuery('');
      });
    }
  };

  const handleMusicStop = async () => {
    const station = activeStation();
    if (!station) return;

    await fetchNui('radioStopMusic', { stationId: station.id }, { success: false });
    batch(() => {
      setMusicPlaying(false);
      setMusicTitle('');
    });
  };

  const handleMusicVolumeChange = async (vol: number) => {
    setMusicVolume(vol);
    const station = activeStation();
    if (!station || !musicPlaying()) return;
    await fetchNui('radioSetMusicVolume', {
      stationId: station.id,
      volume: vol,
    }, { success: false });
  };

  const handleBack = () => {
    const v = view();
    if (v === 'create') {
      setView('list');
    } else if (v === 'broadcasting') {
      void handleEndBroadcast();
    } else if (v === 'listening') {
      void handleLeave();
    } else {
      router.goBack();
    }
  };

  usePhoneKeyHandler({
    Backspace: handleBack,
  });

  // Helper: get the current playing song from queue
  const currentQueueSong = () => {
    const idx = currentQueueIndex();
    const q = queue();
    if (idx >= 0 && idx < q.length) return q[idx];
    return null;
  };

  // --- Render ---

  return (
    <AppScaffold
      title={t('radio.title', language())}
      onBack={handleBack}
      action={view() === 'list' ? { icon: '+', onClick: () => setView('create') } : undefined}
    >
      {/* Station List */}
      <Show when={view() === 'list'}>
        <ScreenState
          loading={loading()}
          error={error()}
          empty={stations().length === 0}
          emptyTitle={t('radio.empty_title', language())}
          emptyDescription={t('radio.empty_desc', language())}
        >
          <div class={styles.stationList}>
            <For each={stations()}>
              {(station) => (
                <button class={styles.stationCard} onClick={() => void handleJoin(station)}>
                  <div class={styles.cardTop}>
                    <span class={styles.liveBadge}>LIVE</span>
                    <span class={styles.categoryBadge}>{getCategoryLabel(station.category)}</span>
                  </div>
                  <div class={styles.cardBody}>
                    <strong class={styles.stationName}>{station.stationName}</strong>
                    <Show when={station.description}>
                      <p class={styles.stationDesc}>{station.description}</p>
                    </Show>
                    <span class={styles.hostLabel}>Host: {station.hostName}</span>
                  </div>
                  <div class={styles.cardFooter}>
                    <span class={styles.listenerCount}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                        <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
                      </svg>
                      {station.listenerCount}
                    </span>
                  </div>
                </button>
              )}
            </For>
          </div>
        </ScreenState>
      </Show>

      {/* Create Station */}
      <Show when={view() === 'create'}>
        <div class={styles.createForm}>
          <div class={`ios-card ${styles.formCard}`}>
            <div class={styles.formHeader}>
              <span class={styles.eyebrow}>{t('radio.new_station_eyebrow', language())}</span>
              <h3>{t('radio.new_station_title', language())}</h3>
            </div>

            <div class={styles.formField}>
              <label class={styles.fieldLabel}>{t('radio.form.name', language())}</label>
              <input
                class="ios-input"
                type="text"
                placeholder={t('radio.form.name_placeholder', language())}
                value={formName()}
                onInput={(e) => setFormName(e.currentTarget.value)}
                maxLength={60}
              />
            </div>

            <div class={styles.formField}>
              <label class={styles.fieldLabel}>{t('radio.form.description', language())}</label>
              <textarea
                class="ios-textarea"
                placeholder={t('radio.form.description_placeholder', language())}
                value={formDescription()}
                onInput={(e) => setFormDescription(e.currentTarget.value)}
                maxLength={200}
                rows={3}
              />
            </div>

            <div class={styles.formField}>
              <label class={styles.fieldLabel}>{t('radio.form.category', language())}</label>
              <div class={styles.categoryGrid}>
                <For each={[...CATEGORIES]}>
                  {(cat) => (
                    <button
                      type="button"
                      classList={{
                        [styles.categoryChip]: true,
                        [styles.categoryChipSelected]: formCategory() === cat,
                      }}
                      onClick={() => setFormCategory(cat)}
                    >
                      {getCategoryLabel(cat)}
                    </button>
                  )}
                </For>
              </div>
            </div>

            <div class={styles.formActions}>
              <button class="ios-btn" onClick={() => setView('list')}>{t('common.cancel', language())}</button>
              <button
                class="ios-btn ios-btn-primary"
                onClick={() => void handleCreate()}
                disabled={creating() || !formName().trim()}
              >
                {creating() ? t('radio.creating', language()) : t('radio.broadcast', language())}
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* Broadcasting View (Host) */}
      <Show when={view() === 'broadcasting'}>
        <div class={styles.broadcastView}>
          {/* ON AIR */}
          <div class={styles.onAirBlock}>
            <div class={styles.pulseRing}>
              <div class={styles.pulseCore} />
            </div>
            <span class={styles.onAirLabel}>ON AIR</span>
          </div>

          <strong class={styles.activeStationName}>{activeStation()?.stationName}</strong>
          <span class={styles.activeCategory}>
            {getCategoryLabel(activeStation()?.category || '')}
          </span>

          <Show when={activeStation()?.description}>
            <p class={styles.activeDesc}>{activeStation()?.description}</p>
          </Show>

          <div class={styles.broadcastMeta}>
            <span class={styles.listenerCount}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
              </svg>
              {activeStation()?.listenerCount ?? 0} {t('radio.listeners', language())}
            </span>
          </div>

          {/* Mic Controls: Mute + Duck */}
          <div class={styles.controlsRow}>
            <button
              classList={{
                [styles.controlBtn]: true,
                [styles.controlBtnActive]: muted(),
              }}
              onClick={() => void handleMuteToggle()}
            >
              {muted() ? t('radio.mic_off', language()) : t('radio.mic_on', language())}
            </button>
            <button
              classList={{
                [styles.controlBtn]: true,
                [styles.duckBtn]: true,
                [styles.duckBtnActive]: duckPressed(),
              }}
              onPointerDown={onDuckDown}
              onPointerUp={onDuckUp}
              onPointerLeave={onDuckUp}
            >
              {duckPressed() ? t('radio.speaking', language()) : t('radio.press_to_talk', language())}
            </button>
          </div>

          {/* Now Playing */}
          <Show when={musicPlaying()}>
            <div class={styles.section}>
              <span class={styles.sectionTitle}>{t('radio.music_eyebrow', language())}</span>
              <div class={styles.nowPlaying}>
                <Show when={currentQueueSong()?.thumbnail}>
                  <img class={styles.nowPlayingThumb} src={currentQueueSong()?.thumbnail} alt="" loading="lazy" />
                </Show>
                <div class={styles.nowPlayingInfo}>
                  <span class={styles.nowPlayingLabel}>Now Playing</span>
                  <span class={styles.nowPlayingTitle}>{musicTitle()}</span>
                </div>
                <button class={styles.musicStopBtn} onClick={() => void handleMusicStop()}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1" /></svg>
                </button>
              </div>
              <div class={styles.volumeRow}>
                <span class={styles.volumeLabel}>Vol</span>
                <input
                  type="range"
                  class={styles.volumeSlider}
                  min="0"
                  max="1"
                  step="0.05"
                  value={musicVolume()}
                  onInput={(e) => void handleMusicVolumeChange(parseFloat(e.currentTarget.value))}
                />
              </div>
            </div>
          </Show>

          {/* Queue */}
          <div class={styles.section}>
            <span class={styles.sectionTitle}>Queue ({queue().length}/{MAX_QUEUE_SIZE})</span>
            <Show when={queue().length > 0} fallback={<span class={styles.queueEmpty}>No songs in queue</span>}>
              <div class={styles.queueList}>
                <For each={queue()}>
                  {(song, i) => (
                    <div classList={{ [styles.queueItem]: true, [styles.queueItemActive]: i() === currentQueueIndex() }}>
                      <span class={styles.queueIndex}>{i() + 1}</span>
                      <img class={styles.queueThumb} src={song.thumbnail} alt="" loading="lazy" />
                      <span class={styles.queueTitle}>{song.title}</span>
                      <button class={styles.queueRemoveBtn} onClick={() => removeFromQueue(i())}>&#10005;</button>
                    </div>
                  )}
                </For>
              </div>
              <div class={styles.playlistActions}>
                <Show when={!musicPlaying()}>
                  <button class={styles.playlistBtn} onClick={() => void startQueue()}>Play Queue</button>
                </Show>
                <button class={styles.clearQueueBtn} onClick={clearQueue}>Clear Queue</button>
              </div>
            </Show>
          </div>

          {/* Music Search */}
          <div class={styles.section}>
            <span class={styles.sectionTitle}>Search Music</span>

            <Show when={!disclaimerDismissed()}>
              <div class={styles.disclaimer}>
                <span class={styles.disclaimerText}>
                  {t('radio.music_disclaimer', language())}
                </span>
                <button class={styles.disclaimerClose} onClick={dismissDisclaimer}>&#10005;</button>
              </div>
            </Show>

            <div class={styles.toggleRow}>
              <span class={styles.toggleLabel}>{t('radio.music_private', language())}</span>
              <button
                classList={{ [styles.toggle]: true, [styles.toggleActive]: musicPrivate() }}
                onClick={() => setMusicPrivate(!musicPrivate())}
              >
                <span class={styles.toggleKnob} />
              </button>
            </div>

            <div class={styles.searchRow}>
              <input
                class="ios-input"
                type="text"
                placeholder={t('radio.music_search_placeholder', language())}
                value={musicQuery()}
                onInput={(e) => setMusicQuery(e.currentTarget.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleMusicSearch(); }}
              />
              <button
                class="ios-btn ios-btn-primary"
                onClick={() => void handleMusicSearch()}
                disabled={musicSearching() || !musicQuery().trim()}
              >
                {musicSearching() ? '...' : t('common.search', language())}
              </button>
            </div>

            <Show when={musicResults().length > 0}>
              <div class={styles.resultsList}>
                <For each={musicResults()}>
                  {(result) => (
                    <div class={styles.resultItem}>
                      <img class={styles.resultThumb} src={result.thumbnail} alt="" loading="lazy" />
                      <div class={styles.resultInfo}>
                        <span class={styles.resultTitle}>{result.title}</span>
                        <span class={styles.resultChannel}>{result.channel}</span>
                      </div>
                      <button
                        class={styles.addQueueBtn}
                        onClick={() => addToQueue(result)}
                        disabled={queue().length >= MAX_QUEUE_SIZE}
                        title="Add to queue"
                      >
                        +
                      </button>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </div>

          {/* Playlists */}
          <div class={styles.section}>
            <span class={styles.sectionTitle}>Playlists</span>
            <div class={styles.playlistActions}>
              <button
                class={styles.playlistBtn}
                onClick={() => {
                  if (showSavePrompt()) {
                    setShowSavePrompt(false);
                  } else {
                    setShowSavePrompt(true);
                    setShowPlaylists(false);
                  }
                }}
                disabled={queue().length === 0}
              >
                Save Queue
              </button>
              <button
                class={styles.playlistBtn}
                onClick={() => void handleShowPlaylists()}
              >
                {showPlaylists() ? t('radio.hide', language()) : t('radio.load_playlist', language())}
              </button>
            </div>

            <Show when={showSavePrompt()}>
              <div class={styles.savePrompt}>
                <input
                  class="ios-input"
                  type="text"
                  placeholder={t('radio.playlist_name', language())}
                  value={playlistNameInput()}
                  onInput={(e) => setPlaylistNameInput(e.currentTarget.value)}
                  maxLength={60}
                  onKeyDown={(e) => { if (e.key === 'Enter') void handleSavePlaylist(); }}
                />
                <button
                  class="ios-btn ios-btn-primary"
                  onClick={() => void handleSavePlaylist()}
                  disabled={savingPlaylist() || !playlistNameInput().trim()}
                >
                  {savingPlaylist() ? '...' : t('radio.save', language())}
                </button>
              </div>
            </Show>

            <Show when={showPlaylists()}>
              <Show when={playlists().length > 0} fallback={<span class={styles.queueEmpty}>No saved playlists</span>}>
                <div class={styles.playlistList}>
                  <For each={playlists()}>
                    {(pl) => (
                      <div class={styles.playlistCard}>
                        <div class={styles.playlistInfo} onClick={() => void handleLoadPlaylist(pl)}>
                          <span class={styles.playlistName}>{pl.name}</span>
                          <span class={styles.playlistMeta}>{pl.songs.length} songs</span>
                        </div>
                        <button
                          class={styles.playlistDeleteBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDeletePlaylist(pl.id);
                          }}
                        >
                          &#10005;
                        </button>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </Show>
          </div>

          {/* End Broadcast */}
          <button class={styles.endBroadcastBtn} onClick={() => void handleEndBroadcast()}>
            {t('radio.end_broadcast', language())}
          </button>

          <Show when={!livekitConnected()}>
            <span class={styles.connectionStatus}>{t('radio.connecting', language())}</span>
          </Show>
        </div>
      </Show>

      {/* Listening View */}
      <Show when={view() === 'listening'}>
        <div class={styles.listeningView}>
          <div class={styles.listeningIndicator}>
            <div class={styles.wave}>
              <span /><span /><span /><span /><span />
            </div>
          </div>

          <strong class={styles.activeStationName}>{activeStation()?.stationName}</strong>
          <span class={styles.activeCategory}>
            {getCategoryLabel(activeStation()?.category || '')}
          </span>
          <span class={styles.hostInfo}>Host: {activeStation()?.hostName}</span>

          <Show when={activeStation()?.description}>
            <p class={styles.activeDesc}>{activeStation()?.description}</p>
          </Show>

          <Show when={musicPlaying()}>
            <div class={styles.nowPlaying}>
              <div class={styles.nowPlayingInfo}>
                <span class={styles.nowPlayingLabel}>Now Playing</span>
                <span class={styles.nowPlayingTitle}>{musicTitle()}</span>
              </div>
            </div>
          </Show>

          {/* Duck indicator */}
          <Show when={isDucked()}>
            <div class={styles.duckIndicator}>
              <span class={styles.duckIndicatorIcon}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" x2="12" y1="19" y2="22" />
                </svg>
              </span>
              <span class={styles.duckIndicatorText}>Host is speaking</span>
            </div>
          </Show>

          <div class={styles.listeningControls}>
            <button class={`${styles.controlBtn} ${styles.controlBtnDanger}`} onClick={() => void handleLeave()}>
              {t('radio.leave', language())}
            </button>
          </div>

          <Show when={!livekitConnected()}>
            <span class={styles.connectionStatus}>{t('radio.connecting', language())}</span>
          </Show>
        </div>
      </Show>
    </AppScaffold>
  );
}
