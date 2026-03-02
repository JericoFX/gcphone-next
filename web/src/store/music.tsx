/**
 * Music store for gcphone-next
 * Manages music state, playback, and remote sounds
 */

import { createContext, useContext, createSignal, createEffect, onCleanup, JSX } from 'solid-js';
import { globalAudioPlayer, TrackInfo, getYoutubeId } from '../utils/audioCore';
import { fetchNui } from '../utils/fetchNui';

export interface MusicState {
  currentTrack: TrackInfo | null;
  playing: boolean;
  loading: boolean;
  error: string | null;
  currentTime: number;
  duration: number;
  volume: number;
  searchResults: TrackInfo[];
  searchLoading: boolean;
  nearbyCount: number;
}

interface MusicActions {
  search: (query: string) => Promise<void>;
  playTrack: (track: TrackInfo) => Promise<void>;
  pause: () => void;
  resume: () => Promise<void>;
  stop: () => void;
  seek: (time: number) => void;
  setVolume: (vol: number) => void;
  clearError: () => void;
}

type MusicStore = [() => MusicState, MusicActions];

const MusicContext = createContext<MusicStore>();

export function MusicProvider(props: { children: JSX.Element }) {
  const [currentTrack, setCurrentTrack] = createSignal<TrackInfo | null>(null);
  const [playing, setPlaying] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [currentTime, setCurrentTime] = createSignal(0);
  const [duration, setDuration] = createSignal(0);
  const [volume, setVolumeState] = createSignal(0.15);
  const [searchResults, setSearchResults] = createSignal<TrackInfo[]>([]);
  const [searchLoading, setSearchLoading] = createSignal(false);
  const [nearbyCount, setNearbyCount] = createSignal(0);

  createEffect(() => {
    const unsubPlay = globalAudioPlayer.on('play', () => setPlaying(true));
    const unsubPause = globalAudioPlayer.on('pause', () => setPlaying(false));
    const unsubEnd = globalAudioPlayer.on('end', () => {
      setPlaying(false);
      setCurrentTime(0);
    });
    const unsubTime = globalAudioPlayer.on('timeupdate', (data) => {
      setCurrentTime(data.currentTime);
    });
    const unsubReady = globalAudioPlayer.on('ready', (data) => {
      setLoading(false);
      setDuration(data.duration);
    });
    const unsubLoading = globalAudioPlayer.on('loading', () => setLoading(true));
    const unsubError = globalAudioPlayer.on('error', (data) => {
      setLoading(false);
      setError(data.error || 'Error de reproduccion');
    });

    onCleanup(() => {
      unsubPlay();
      unsubPause();
      unsubEnd();
      unsubTime();
      unsubReady();
      unsubLoading();
      unsubError();
    });
  });

  const search = async (query: string) => {
    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    setError(null);

    try {
      const results = await fetchNui<TrackInfo[]>('musicSearchITunes', { query }, []);
      setSearchResults(results || []);
    } catch (e) {
      setError('Error al buscar');
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const playTrack = async (track: TrackInfo) => {
    if (!track) return;

    setLoading(true);
    setError(null);
    setCurrentTrack(track);
    setCurrentTime(0);

    try {
      let playUrl = track.youtubeId 
        ? `https://www.youtube.com/watch?v=${track.youtubeId}`
        : track.previewUrl;

      if (!playUrl) {
        throw new Error('No hay fuente de audio');
      }

      await globalAudioPlayer.load(playUrl);
      globalAudioPlayer.setVolume(volume());
      await globalAudioPlayer.play();

      await fetchNui('musicPlay', {
        youtubeId: track.youtubeId,
        previewUrl: track.previewUrl,
        title: track.title,
        artist: track.artist,
        duration: track.duration,
      }, {});
    } catch (e: any) {
      setError(e?.message || 'Error al reproducir');
      setLoading(false);
    }
  };

  const pause = () => {
    globalAudioPlayer.pause();
    fetchNui('musicPause', {}, {});
  };

  const resume = async () => {
    await globalAudioPlayer.play();
    fetchNui('musicResume', {}, {});
  };

  const stop = () => {
    globalAudioPlayer.stop();
    setPlaying(false);
    setCurrentTime(0);
    fetchNui('musicStop', {}, {});
  };

  const seek = (time: number) => {
    globalAudioPlayer.seek(time);
    setCurrentTime(time);
  };

  const setVolume = (vol: number) => {
    const clampedVol = Math.max(0, Math.min(1, vol));
    setVolumeState(clampedVol);
    globalAudioPlayer.setVolume(clampedVol);
    fetchNui('musicSetVolume', { volume: clampedVol }, {});
  };

  const clearError = () => setError(null);

  const state = () => ({
    currentTrack: currentTrack(),
    playing: playing(),
    loading: loading(),
    error: error(),
    currentTime: currentTime(),
    duration: duration(),
    volume: volume(),
    searchResults: searchResults(),
    searchLoading: searchLoading(),
    nearbyCount: nearbyCount(),
  });

  const actions: MusicActions = {
    search,
    playTrack,
    pause,
    resume,
    stop,
    seek,
    setVolume,
    clearError,
  };

  return (
    <MusicContext.Provider value={[state, actions]}>
      {props.children}
    </MusicContext.Provider>
  );
}

export function useMusic(): MusicStore {
  const store = useContext(MusicContext);
  if (!store) {
    throw new Error('useMusic must be used within a MusicProvider');
  }
  return store;
}
