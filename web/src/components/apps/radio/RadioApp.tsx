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

type RadioView = 'list' | 'create' | 'broadcasting' | 'listening';

const CATEGORIES = ['music', 'news', 'talk', 'emergency', 'community', 'other'] as const;

const POLL_INTERVAL_MS = 5000;

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
      batch(() => {
        setMusicPlaying(d.isPlaying || false);
        setMusicTitle(d.title || '');
      });
    }
  };

  onMount(() => {
    window.addEventListener('message', handleStationEnded);
    window.addEventListener('message', handleMusicUpdate);
  });

  onCleanup(() => {
    window.removeEventListener('message', handleStationEnded);
    window.removeEventListener('message', handleMusicUpdate);
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

          <div class={styles.broadcastControls}>
            <button
              classList={{
                [styles.controlBtn]: true,
                [styles.controlBtnActive]: muted(),
              }}
              onClick={() => void handleMuteToggle()}
            >
              {muted() ? 'Mic OFF' : 'Mic ON'}
            </button>
            <button class={`${styles.controlBtn} ${styles.controlBtnDanger}`} onClick={() => void handleEndBroadcast()}>
              {t('radio.end_broadcast', language())}
            </button>
          </div>

          {/* Music Section */}
          <div class={styles.musicSection}>
            <span class={styles.eyebrow}>{t('radio.music_eyebrow', language())}</span>

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

            <Show when={musicPlaying()}>
              <div class={styles.musicNowPlaying}>
                <span class={styles.musicNote}>&#9835;</span>
                <span class={styles.musicNowTitle}>{musicTitle()}</span>
                <button class={styles.musicStopBtn} onClick={() => void handleMusicStop()}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1" /></svg>
                </button>
              </div>
              <div class={styles.musicVolumeRow}>
                <span class={styles.musicVolumeLabel}>Vol</span>
                <input
                  type="range"
                  class={styles.musicVolumeSlider}
                  min="0"
                  max="1"
                  step="0.05"
                  value={musicVolume()}
                  onInput={(e) => void handleMusicVolumeChange(parseFloat(e.currentTarget.value))}
                />
              </div>
            </Show>

            <Show when={!musicPlaying()}>
              <div class={styles.musicSearchRow}>
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
                <div class={styles.musicResultsList}>
                  <For each={musicResults()}>
                    {(result) => (
                      <button class={styles.musicResultItem} onClick={() => void handleMusicPlay(result)}>
                        <img
                          class={styles.musicThumb}
                          src={result.thumbnail}
                          alt=""
                          loading="lazy"
                        />
                        <div class={styles.musicResultInfo}>
                          <span class={styles.musicResultTitle}>{result.title}</span>
                          <span class={styles.musicResultChannel}>{result.channel}</span>
                        </div>
                      </button>
                    )}
                  </For>
                </div>
              </Show>
            </Show>
          </div>

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
            <div class={styles.musicNowPlaying}>
              <span class={styles.musicNote}>&#9835;</span>
              <span class={styles.musicNowTitle}>{musicTitle()}</span>
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
