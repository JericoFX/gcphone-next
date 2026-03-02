import { createSignal, Show, createEffect, onCleanup, For, createMemo } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { usePhone } from '../../../store/phone';
import { sanitizeText, sanitizeUrl } from '../../../utils/sanitize';
import { fetchNui } from '../../../utils/fetchNui';
import styles from './MusicApp.module.scss';

interface YouTubeResult {
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
  duration: number;
}

interface Track extends YouTubeResult {
  url: string;
}

export function MusicApp() {
  const router = useRouter();
  const [phoneState, phoneActions] = usePhone();
  const [searchQuery, setSearchQuery] = createSignal('');
  const [results, setResults] = createSignal<YouTubeResult[]>([]);
  const [currentTrack, setCurrentTrack] = createSignal<Track | null>(null);
  const [playing, setPlaying] = createSignal(false);
  const [progress, setProgress] = createSignal(0);
  const [duration, setDuration] = createSignal(0);
  const [searchLoading, setSearchLoading] = createSignal(false);

  let audioRef: HTMLAudioElement | undefined;

  createEffect(() => {
    const onKey = (event: CustomEvent<string>) => {
      if (event.detail === 'Backspace') router.goBack();
    };
    window.addEventListener('phone:keyUp', onKey as EventListener);
    onCleanup(() => window.removeEventListener('phone:keyUp', onKey as EventListener));
  });

  createEffect(() => {
    if (!audioRef || !currentTrack()) return;
    audioRef.src = currentTrack()!.url;
    audioRef.volume = phoneState.settings.volume;
    if (playing()) void audioRef.play().catch(() => setPlaying(false));
  });

  const searchYouTube = async () => {
    const query = sanitizeText(searchQuery(), 80);
    if (!query) return;

    setSearchLoading(true);
    try {
      const data = await fetchNui<any[]>('musicSearchCatalog', { query }, []);
      const mapped = (data || [])
        .slice(0, 12)
        .filter((item: any) => item?.id && item?.title)
        .map((item: any) => ({
          id: sanitizeText(item.id, 24) || '',
          title: sanitizeText(item.title, 80) || 'Sin titulo',
          artist: sanitizeText(item.uploaderName || item.author, 40) || 'Desconocido',
          thumbnail: sanitizeUrl(item.thumbnail || `https://i.ytimg.com/vi/${item.id}/mqdefault.jpg`) || '',
          duration: Number(item.duration) || 0,
        }));
      setResults(mapped);
    } catch {
      setResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const playTrack = (track: YouTubeResult) => {
    const streamUrl = `https://piped.video/latest_version?id=${track.id}&itag=251`;
    setCurrentTrack({
      ...track,
      url: sanitizeUrl(streamUrl) || '',
    });
    setPlaying(true);
  };

  const togglePlayback = async () => {
    if (!audioRef) return;
    if (playing()) {
      audioRef.pause();
      setPlaying(false);
      return;
    }
    await audioRef.play().catch(() => setPlaying(false));
    setPlaying(true);
  };

  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent = createMemo(() => {
    const d = duration();
    if (!d || d <= 0) return 0;
    return Math.min(100, Math.max(0, (progress() / d) * 100));
  });

  return (
    <div class={styles.app}>
      <div class={styles.header}>
        <button class={styles.backBtn} onClick={() => router.goBack()}>‹</button>
        <h1>Musica</h1>
      </div>

      <div class={styles.searchBar}>
        <input
          type="text"
          placeholder="Buscar en YouTube..."
          value={searchQuery()}
          onInput={(e) => setSearchQuery(e.currentTarget.value)}
          onKeyDown={(e) => e.key === 'Enter' && searchYouTube()}
        />
        <button class={styles.searchBtn} onClick={searchYouTube} disabled={searchLoading()}>
          {searchLoading() ? '...' : '🔍'}
        </button>
      </div>

      <Show when={currentTrack()}>
        <div class={styles.nowPlaying}>
          <img
            class={styles.albumArt}
            src={currentTrack()?.thumbnail || './img/icons_ios/music.svg'}
            alt={currentTrack()?.title}
            classList={{ [styles.playing]: playing() }}
          />
          <div class={styles.trackInfo}>
            <strong>{currentTrack()?.title}</strong>
            <span>{currentTrack()?.artist}</span>
          </div>

          <div class={styles.progressRow}>
            <span class={styles.timeLabel}>{formatTime(progress())}</span>
            <div class={styles.progressBar}>
              <div class={styles.progressFill} style={{ width: `${progressPercent()}%` }} />
              <input
                type="range"
                class={styles.progressSlider}
                min="0"
                max={duration() || 100}
                value={progress()}
                onInput={(e) => {
                  if (audioRef) {
                    const val = Number(e.currentTarget.value);
                    audioRef.currentTime = val;
                    setProgress(val);
                  }
                }}
              />
            </div>
            <span class={styles.timeLabel}>{formatTime(duration())}</span>
          </div>

          <button class={styles.playBtn} onClick={togglePlayback}>
            {playing() ? '⏸' : '▶'}
          </button>

          <div class={styles.volumeRow}>
            <span>🔉</span>
            <input
              type="range"
              class={styles.volumeSlider}
              min="0"
              max="100"
              value={Math.round(phoneState.settings.volume * 100)}
              onInput={(e) => {
                const vol = Number(e.currentTarget.value) / 100;
                phoneActions.setVolume(vol);
                if (audioRef) audioRef.volume = vol;
              }}
            />
            <span>🔊</span>
          </div>
        </div>
      </Show>

      <div class={styles.results}>
        <Show when={searchLoading()}>
          <div class={styles.loadingHint}>Buscando...</div>
        </Show>
        <For each={results()}>
          {(track) => (
            <button class={styles.resultItem} onClick={() => playTrack(track)}>
              <img src={track.thumbnail} alt={track.title} />
              <div class={styles.resultInfo}>
                <strong>{track.title}</strong>
                <span>{track.artist} • {formatTime(track.duration)}</span>
              </div>
            </button>
          )}
        </For>
      </div>

      <audio
        ref={audioRef}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={() => audioRef && setProgress(audioRef.currentTime)}
        onLoadedMetadata={() => audioRef && setDuration(audioRef.duration)}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
        }}
      />
    </div>
  );
}
