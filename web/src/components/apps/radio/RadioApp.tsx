import { Switch, Match, createSignal, onMount, onCleanup, batch } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchNui } from '../../../utils/fetchNui';
import { useLiveActivity } from '../../../store/liveActivity';
import { useInternalEvent } from '../../../utils/internalEvents';
import { sanitizeText } from '../../../utils/sanitize';
import { usePhoneKeyHandler } from '../../../hooks/usePhoneKeyHandler';
import { initSession, disconnectAll, enableMicrophone, setMicrophoneEnabled } from '../../../utils/peerManager';
import { useNuiEvent } from '../../../utils/useNui';
import { isEnvBrowser } from '../../../utils/misc';
import { AppScaffold } from '../../shared/layout';
import { t } from '../../../i18n';
import { usePhone } from '../../../store/phone';
import {
  RadioStation,
  CreateStationResult,
  JoinStationResult,
  MusicSearchResult,
  MusicSearchResponse,
  RadioView,
  MAX_QUEUE_SIZE,
} from './radioShared';
import { RadioStationList } from './RadioStationList';
import { RadioCreate } from './RadioCreate';
import { RadioBroadcast } from './RadioBroadcast';
import { RadioListening } from './RadioListening';
import styles from './RadioApp.module.scss';

export function RadioApp() {
  const router = useRouter();
  const [phoneState] = usePhone();
  const language = () => phoneState.settings.language || 'es';
  const streamerMode = () => (phoneState.settings as any).streamerMode ?? false;
  const { setActivity, removeActivity } = useLiveActivity();

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

  // Ducking (host)
  const [duckPressed, setDuckPressed] = createSignal(false);

  // Ducking (listener)
  const [isDucked, setIsDucked] = createSignal(false);

  const dismissDisclaimer = () => {
    setDisclaimerDismissed(true);
    window.localStorage.setItem('gcphone:music:disclaimerDismissed', 'true');
  };

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

  onMount(() => {
    void loadStations();
  });

  onCleanup(() => {
    void cleanupSession();
  });

  // ── NUI Event hooks ──

  // New event: station created (e.g. another player opens a station)
  useNuiEvent<RadioStation>('radioStationCreated', (station) => {
    setStations(prev => [...prev, station]);
  });

  // Existing event: station ended (server-forced, host disconnected)
  // Keep 'gcphone:radio:stationEnded' name so Lua server code needs no changes
  useNuiEvent<number>('gcphone:radio:stationEnded', (stationId) => {
    setStations(prev => prev.filter(s => s.id !== stationId));
    const station = activeStation();
    if (station && station.id === stationId) {
      disconnectAll();
      batch(() => {
        setActiveStation(null);
        setLivekitConnected(false);
        setMuted(false);
        setQueue([]);
        setCurrentQueueIndex(-1);
        setIsDucked(false);
        setView('list');
      });
      removeActivity('radio');
    }
  });

  // New event: station updated (e.g. listener count change)
  useNuiEvent<RadioStation>('radioStationUpdated', (station) => {
    setStations(prev => prev.map(s => s.id === station.id ? station : s));
    // Also update activeStation if it matches
    const active = activeStation();
    if (active && active.id === station.id) {
      setActiveStation(station);
    }
  });

  // Existing event: music update
  useNuiEvent<any>('gcphone:radio:musicUpdate', (d) => {
    if (!d) return;
    const station = activeStation();
    if (station && station.id === d.stationId) {
      const wasPlaying = musicPlaying();
      batch(() => {
        setMusicPlaying(d.isPlaying || false);
        setMusicTitle(d.title || '');
      });

      setActivity('radio', {
        title: station.stationName,
        subtitle: d.isPlaying ? (d.title || 'EN VIVO') : 'EN VIVO',
        icon: './img/icons_ios/radio.svg',
        isPlaying: true,
        volume: Math.round(musicVolume() * 100),
        onStop: () => view() === 'broadcasting' ? void handleEndBroadcast() : void handleLeave(),
        onVolumeUp: () => void handleMusicVolumeChange(Math.min(1, musicVolume() + 0.1)),
        onVolumeDown: () => void handleMusicVolumeChange(Math.max(0, musicVolume() - 0.1)),
        onNavigate: () => router.navigate('radio'),
      });

      // Auto-play next in queue when song ends (host only)
      if (wasPlaying && !d.isPlaying && view() === 'broadcasting') {
        void playNextInQueue();
      }
    }
  });

  // Existing event: music ducked
  useNuiEvent<any>('gcphone:radio:musicDucked', (d) => {
    if (!d) return;
    const station = activeStation();
    if (station && station.id === d.stationId) {
      setIsDucked(d.ducked || false);
    }
  });

  // ── LiveKit ──

  const connectToLiveKit = async (roomName: string, isHost: boolean) => {
    if (isEnvBrowser()) {
      await new Promise(r => setTimeout(r, 300));
      setLivekitConnected(true);
      if (isHost) setMuted(false);
      return true;
    }

    try {
      await initSession(3600, {
        onCallTimeout: () => {
          void cleanupSession();
          setView('list');
        },
      });

      if (isHost) {
        await enableMicrophone();
      }

      setLivekitConnected(true);
      return true;
    } catch {
      disconnectAll();
      return false;
    }
  };

  const cleanupSession = async () => {
    const station = activeStation();
    if (!station) return;

    const currentView = view();
    if (currentView === 'broadcasting') {
      await fetchNui('radioEndStation', { stationId: station.id }, { success: false });
    } else if (currentView === 'listening') {
      await fetchNui('radioLeaveStation', { stationId: station.id }, { success: false });
    }

    disconnectAll();
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

  // ── Queue ──

  const addToQueue = (song: MusicSearchResult) => {
    if (queue().length >= MAX_QUEUE_SIZE) return;
    setQueue(prev => [...prev, song]);
  };

  const removeFromQueue = (index: number) => {
    const cur = currentQueueIndex();
    setQueue(prev => prev.filter((_, i) => i !== index));
    if (index < cur) {
      setCurrentQueueIndex(cur - 1);
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

  // ── Duck ──

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

  // ── Handlers ──

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

      setActivity('radio', {
        title: station.stationName,
        subtitle: 'EN VIVO',
        icon: './img/icons_ios/radio.svg',
        isPlaying: true,
        volume: Math.round(musicVolume() * 100),
        onStop: () => void handleEndBroadcast(),
        onVolumeUp: () => void handleMusicVolumeChange(Math.min(1, musicVolume() + 0.1)),
        onVolumeDown: () => void handleMusicVolumeChange(Math.max(0, musicVolume() - 0.1)),
        onNavigate: () => router.navigate('radio'),
      });
    } catch {
      setCreating(false);
    }
  };

  const handleJoin = async (stationId: number) => {
    const result = await fetchNui<JoinStationResult>('radioJoinStation', {
      stationId,
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

    setActivity('radio', {
      title: joined.stationName,
      subtitle: 'EN VIVO',
      icon: './img/icons_ios/radio.svg',
      isPlaying: true,
      volume: Math.round(musicVolume() * 100),
      onStop: () => void handleLeave(),
      onVolumeUp: () => void handleMusicVolumeChange(Math.min(1, musicVolume() + 0.1)),
      onVolumeDown: () => void handleMusicVolumeChange(Math.max(0, musicVolume() - 0.1)),
      onNavigate: () => router.navigate('radio'),
    });
  };

  const handleEndBroadcast = async () => {
    const station = activeStation();
    if (!station) return;

    if (musicPlaying()) {
      await fetchNui('radioStopMusic', { stationId: station.id }, { success: false });
    }

    await fetchNui('radioEndStation', { stationId: station.id }, { success: false });
    disconnectAll();

    batch(() => {
      setActiveStation(null);
      setLivekitConnected(false);
      setMuted(false);
      setQueue([]);
      setCurrentQueueIndex(-1);
      setDuckPressed(false);
      setView('list');
    });

    removeActivity('radio');
    void loadStations();
  };

  const handleLeave = async () => {
    const station = activeStation();
    if (!station) return;

    await fetchNui('radioLeaveStation', { stationId: station.id }, { success: false });
    disconnectAll();

    batch(() => {
      setActiveStation(null);
      setLivekitConnected(false);
      setMuted(false);
      setIsDucked(false);
      setView('list');
    });

    removeActivity('radio');
    void loadStations();
  };

  const handleMuteToggle = async () => {
    const next = !muted();
    setMuted(next);
    setMicrophoneEnabled(!next);
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

  const getTitle = () => {
    const v = view();
    if (v === 'create') return t('radio.new_station_title', language()) || 'Nueva Estacion';
    if (v === 'broadcasting') return t('radio.on_air', language()) || 'En Vivo';
    if (v === 'listening') return activeStation()?.stationName || t('radio.title', language());
    return t('radio.title', language());
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

  useInternalEvent<{ route: string }>('phone:appForceClose', (detail) => {
    if (detail?.route === 'radio') {
      void cleanupSession();
      removeActivity('radio');
      setView('list');
    }
  });

  // ── Render ──

  return (
    <AppScaffold title={getTitle()} onBack={handleBack} bodyClass={styles.radioContent} bodyPadding="none">
      <Switch>
        <Match when={view() === 'list'}>
          <RadioStationList
            stations={stations}
            loading={loading}
            error={error}
            language={language}
            onJoin={handleJoin}
            onCreate={() => setView('create')}
          />
        </Match>

        <Match when={view() === 'create'}>
          <RadioCreate
            language={language}
            formName={formName}
            setFormName={setFormName}
            formDescription={formDescription}
            setFormDescription={setFormDescription}
            formCategory={formCategory}
            setFormCategory={setFormCategory}
            creating={creating}
            onSubmit={() => void handleCreate()}
            onCancel={() => setView('list')}
          />
        </Match>

        <Match when={view() === 'broadcasting'}>
          <RadioBroadcast
            station={() => activeStation()!}
            language={language}
            musicPlaying={musicPlaying}
            musicTitle={musicTitle}
            musicVolume={musicVolume}
            musicPrivate={musicPrivate}
            muted={muted}
            duckPressed={duckPressed}
            livekitConnected={livekitConnected}
            queue={queue}
            currentQueueIndex={currentQueueIndex}
            musicQuery={musicQuery}
            musicResults={musicResults}
            musicSearching={musicSearching}
            disclaimerDismissed={disclaimerDismissed}
            streamerMode={streamerMode()}
            onToggleMute={() => void handleMuteToggle()}
            onDuckDown={onDuckDown}
            onDuckUp={onDuckUp}
            onTogglePrivate={() => setMusicPrivate(!musicPrivate())}
            onMusicSearch={() => void handleMusicSearch()}
            onMusicPlay={(song) => void handleMusicPlay(song)}
            onMusicStop={() => void handleMusicStop()}
            onVolumeChange={(v) => void handleMusicVolumeChange(v)}
            onQueryChange={setMusicQuery}
            onAddToQueue={addToQueue}
            onRemoveFromQueue={removeFromQueue}
            onClearQueue={clearQueue}
            onStartQueue={() => void startQueue()}
            onDismissDisclaimer={dismissDisclaimer}
            onEndBroadcast={() => void handleEndBroadcast()}
          />
        </Match>

        <Match when={view() === 'listening'}>
          <RadioListening
            station={() => activeStation()!}
            language={language}
            musicPlaying={musicPlaying}
            musicTitle={musicTitle}
            musicVolume={musicVolume}
            isDucked={isDucked}
            livekitConnected={livekitConnected}
            streamerMode={streamerMode()}
            onLeave={() => void handleLeave()}
            onVolumeChange={(v) => void handleMusicVolumeChange(v)}
          />
        </Match>
      </Switch>
    </AppScaffold>
  );
}
