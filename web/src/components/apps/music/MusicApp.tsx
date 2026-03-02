/**
 * Music App - iOS 18 Style
 * gcphone-next
 */

import { createSignal, createEffect, onCleanup, Show, For, createMemo } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { useMusic } from '../../../store/music';
import styles from './MusicApp.module.scss';

export function MusicApp() {
  const router = useRouter();
  const [state, actions] = useMusic();
  const [searchQuery, setSearchQuery] = createSignal('');
  const [showSearch, setShowSearch] = createSignal(true);

  createEffect(() => {
    const onKey = (event: CustomEvent<string>) => {
      if (event.detail === 'Backspace') router.goBack();
    };
    window.addEventListener('phone:keyUp', onKey as EventListener);
    onCleanup(() => window.removeEventListener('phone:keyUp', onKey as EventListener));
  });

  const handleSearch = async () => {
    const query = searchQuery().trim();
    if (query.length < 2) return;
    await actions.search(query);
  };

  const handlePlayTrack = async (track: any) => {
    setShowSearch(false);
    await actions.playTrack(track);
  };

  const formatTime = (seconds: number): string => {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent = createMemo(() => {
    const d = state().duration;
    if (!d || d <= 0) return 0;
    return Math.min(100, Math.max(0, (state().currentTime / d) * 100));
  });

  const handleSeek = (e: Event) => {
    const target = e.currentTarget as HTMLInputElement;
    const time = parseFloat(target.value);
    actions.seek(time);
  };

  const handleVolumeChange = (e: Event) => {
    const target = e.currentTarget as HTMLInputElement;
    const vol = parseFloat(target.value) / 100;
    actions.setVolume(vol);
  };

  const togglePlayPause = async () => {
    if (state().playing) {
      actions.pause();
    } else {
      await actions.resume();
    }
  };

  return (
    <div class={styles.app}>
      <div class={styles.header}>
        <button class={styles.backBtn} onClick={() => router.goBack()}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <h1>Musica</h1>
        <button class={styles.searchToggle} onClick={() => setShowSearch(!showSearch())}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/>
            <path d="M16 16L20 20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <Show when={state().error}>
        <div class={styles.errorBanner}>
          <span>{state().error}</span>
          <button onClick={actions.clearError}>x</button>
        </div>
      </Show>

      <Show when={state().currentTrack}>
        <div class={styles.nowPlaying}>
          <div class={styles.artworkContainer}>
            <div classList={{ [styles.artwork]: true, [styles.spinning]: state().playing }}>
              <img 
                src={state().currentTrack?.thumbnail || './img/icons_ios/music.svg'} 
                alt={state().currentTrack?.title}
              />
            </div>
            <Show when={state().loading}>
              <div class={styles.loadingOverlay}>
                <div class={styles.spinner}></div>
              </div>
            </Show>
          </div>

          <div class={styles.trackInfo}>
            <h2 class={styles.trackTitle}>{state().currentTrack?.title}</h2>
            <p class={styles.trackArtist}>{state().currentTrack?.artist}</p>
          </div>

          <div class={styles.progressContainer}>
            <span class={styles.timeLabel}>{formatTime(state().currentTime)}</span>
            <div class={styles.progressBar}>
              <div class={styles.progressFill} style={{ width: `${progressPercent()}%` }} />
              <input
                type="range"
                class={styles.progressSlider}
                min="0"
                max={state().duration || 100}
                value={state().currentTime}
                onInput={handleSeek}
              />
            </div>
            <span class={styles.timeLabel}>{formatTime(state().duration)}</span>
          </div>

          <div class={styles.controls}>
            <button class={styles.controlBtn} onClick={() => actions.seek(0)}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 6h2v12H6V6zm3.5 6l8.5 6V6l-8.5 6z"/>
              </svg>
            </button>
            
            <button classList={{ [styles.playBtn]: true, [styles.playing]: state().playing }} onClick={togglePlayPause}>
              <Show when={state().playing} fallback={
                <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              }>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                </svg>
              </Show>
            </button>

            <button class={styles.controlBtn} onClick={() => actions.stop()}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 6h12v12H6z"/>
              </svg>
            </button>
          </div>

          <div class={styles.volumeContainer}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" class={styles.volumeIcon}>
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
            </svg>
            <input
              type="range"
              class={styles.volumeSlider}
              min="0"
              max="100"
              value={Math.round(state().volume * 100)}
              onInput={handleVolumeChange}
            />
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" class={styles.volumeIcon}>
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
            </svg>
          </div>

          <div class={styles.distanceIndicator}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
            <span>15m</span>
          </div>
        </div>
      </Show>

      <Show when={showSearch()}>
        <div class={styles.searchBar}>
          <input
            type="text"
            placeholder="Buscar canciones..."
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button class={styles.searchBtn} onClick={handleSearch} disabled={state().searchLoading}>
            <Show when={state().searchLoading} fallback={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/>
                <path d="M16 16L20 20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            }>
              <div class={styles.searchSpinner}></div>
            </Show>
          </button>
        </div>
      </Show>

      <div class={styles.results}>
        <Show when={state().searchLoading && state().searchResults.length === 0}>
          <div class={styles.loadingState}>
            <div class={styles.spinner}></div>
            <span>Buscando...</span>
          </div>
        </Show>

        <Show when={!state().searchLoading && state().searchResults.length === 0 && searchQuery().length > 0}>
          <div class={styles.emptyState}>
            <span>No se encontraron resultados</span>
          </div>
        </Show>

        <For each={state().searchResults}>
          {(track) => (
            <button 
              classList={{ 
                [styles.resultItem]: true,
                [styles.active]: state().currentTrack?.id === track.id
              }} 
              onClick={() => handlePlayTrack(track)}
            >
              <img src={track.thumbnail} alt={track.title} class={styles.resultThumb} />
              <div class={styles.resultInfo}>
                <strong class={styles.resultTitle}>{track.title}</strong>
                <span class={styles.resultMeta}>{track.artist} - {formatTime(track.duration)}</span>
              </div>
              <div class={styles.playIndicator}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </div>
            </button>
          )}
        </For>
      </div>
    </div>
  );
}
