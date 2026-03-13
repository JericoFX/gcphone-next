import { createEffect, createSignal, onCleanup, onMount } from 'solid-js';
import { useWindowEvent } from '../../../../hooks';
import { t } from '../../../../i18n';

export function useHomeDesktopState(language: () => string) {
  const [desktopPage, setDesktopPage] = createSignal(0);
  const [currentTime, setCurrentTime] = createSignal(new Date());
  const [musicNowPlaying, setMusicNowPlaying] = createSignal('');

  let timer: number | undefined;

  onMount(() => {
    const savedPage = Number(window.localStorage.getItem('gcphone:desktopPage') || '0');
    if (Number.isFinite(savedPage) && savedPage >= 0) setDesktopPage(savedPage);

    timer = window.setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    setMusicNowPlaying(window.localStorage.getItem('gcphone:musicNowPlaying') || t('home.music_idle', language()));
  });

  createEffect(() => {
    window.localStorage.setItem('gcphone:desktopPage', String(desktopPage()));
  });

  useWindowEvent<StorageEvent>('storage', () => {
    setMusicNowPlaying(window.localStorage.getItem('gcphone:musicNowPlaying') || t('home.music_idle', language()));
  });

  onCleanup(() => {
    if (timer) clearInterval(timer);
  });

  return {
    currentTime,
    desktopPage,
    setDesktopPage,
    musicNowPlaying,
  };
}
