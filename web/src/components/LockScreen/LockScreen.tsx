import { For, Index, Show, batch, createEffect, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import { usePhone } from '../../store/phone';
import { useNotifications } from '../../store/notifications';
import { fetchNui } from '../../utils/fetchNui';
import { formatDate, formatTime, t } from '../../i18n';
import { emitInternalEvent, useInternalEvent } from '../../utils/internalEvents';
import { LockScreenWidgets } from './LockScreenWidgets';
import styles from './LockScreen.module.scss';

interface PendingDestination {
  route: string;
  data?: Record<string, unknown>;
}

interface MusicSessionState {
  isPlaying: boolean;
  isPaused: boolean;
  title: string;
  volume: number;
  distance: number;
}

const DEFAULT_MUSIC_STATE: MusicSessionState = {
  isPlaying: false,
  isPaused: false,
  title: '',
  volume: 0.15,
  distance: 15,
};

function readStoredMusicSession(): MusicSessionState {
  try {
    const raw = window.localStorage.getItem('gcphone:musicSession');
    if (!raw) return DEFAULT_MUSIC_STATE;
    const parsed = JSON.parse(raw) as Partial<MusicSessionState>;
    return {
      isPlaying: parsed.isPlaying === true,
      isPaused: parsed.isPaused === true,
      title: typeof parsed.title === 'string' ? parsed.title.trim() : '',
      volume: typeof parsed.volume === 'number' ? Math.max(0, Math.min(1, parsed.volume)) : DEFAULT_MUSIC_STATE.volume,
      distance: typeof parsed.distance === 'number' ? Math.max(5, Math.min(30, parsed.distance)) : DEFAULT_MUSIC_STATE.distance,
    };
  } catch {
    return DEFAULT_MUSIC_STATE;
  }
}

export function LockScreen() {
  const [phoneState, phoneActions] = usePhone();
  const [notifications] = useNotifications();
  const [code, setCode] = createSignal('');
  const [error, setError] = createSignal(false);
  const [attempts, setAttempts] = createSignal(0);
  const [currentTime, setCurrentTime] = createSignal(new Date());
  const [flashlightSupported, setFlashlightSupported] = createSignal(false);
  const [flashlightEnabled, setFlashlightEnabled] = createSignal(false);
  const [pendingDestination, setPendingDestination] = createSignal<PendingDestination | null>(null);
  const [activeWidget, setActiveWidget] = createSignal(0);
  const [musicState, setMusicState] = createSignal<MusicSessionState>(DEFAULT_MUSIC_STATE);
  const [swipeUnlockProgress, setSwipeUnlockProgress] = createSignal(0);
  const [emergencySheetOpen, setEmergencySheetOpen] = createSignal(false);
  const [emergencyDial, setEmergencyDial] = createSignal('');
  const [emergencyStatus, setEmergencyStatus] = createSignal('');
  const [imeiModalOpen, setImeiModalOpen] = createSignal(false);
  const [sosStatus, setSosStatus] = createSignal<'idle' | 'sending' | 'sent'>('idle');
  const language = () => phoneState.settings.language || 'es';
  const swipeUnlockEnabled = () => phoneState.settings.swipeUnlock === true;

  let timer: number | undefined;
  let swipePointerId: number | null = null;
  let swipeStartY: number | null = null;

  const visibleNotifications = createMemo(() => (
    notifications.history
      .filter((item) => item.id !== 'music-now-playing')
      .slice(0, 5)
  ));
  const emergencyContacts = createMemo(() => phoneState.setup.emergencyContacts || []);
  const matchedEmergencyContact = createMemo(() => emergencyContacts().find((entry) => entry.number === emergencyDial().trim()));

  const musicStatusLabel = createMemo(() => {
    const current = musicState();
    if (current.isPlaying && current.isPaused) return `Pausado: ${current.title || 'Sin musica'}`;
    if (current.isPlaying) return `Reproduciendo: ${current.title || 'Sin musica'}`;
    return 'Sin musica';
  });

  const musicVolumePercent = createMemo(() => Math.round(musicState().volume * 100));

  const musicTitle = createMemo(() => {
    const current = musicState();
    if (current.isPlaying && current.title) return current.title;
    return '';
  });

  const applyMusicState = (payload?: Partial<MusicSessionState>) => {
    if (!payload || typeof payload !== 'object') return;
    setMusicState((current) => ({
      isPlaying: typeof payload.isPlaying === 'boolean' ? payload.isPlaying : current.isPlaying,
      isPaused: typeof payload.isPaused === 'boolean' ? payload.isPaused : current.isPaused,
      title: typeof payload.title === 'string' ? payload.title.trim() : current.title,
      volume: typeof payload.volume === 'number' ? Math.max(0, Math.min(1, payload.volume)) : current.volume,
      distance: typeof payload.distance === 'number' ? Math.max(5, Math.min(30, payload.distance)) : current.distance,
    }));
  };

  onMount(() => {
    timer = window.setInterval(() => setCurrentTime(new Date()), 1000);
    setMusicState(readStoredMusicSession());

    void (async () => {
      const capabilities = await fetchNui<{ flashlight?: boolean; flashlightEnabled?: boolean }>('cameraGetCapabilities', undefined, {
        flashlight: false,
        flashlightEnabled: false,
      });
      setFlashlightSupported(capabilities?.flashlight === true);
      setFlashlightEnabled(capabilities?.flashlightEnabled === true);
    })();
  });

  useInternalEvent<Partial<MusicSessionState>>('musicStateUpdated', (detail) => {
    applyMusicState(detail || {});
  });

  onCleanup(() => {
    if (timer) clearInterval(timer);
  });

  const finalizeUnlock = () => {
    const destination = pendingDestination();
    batch(() => {
      setCode('');
      setAttempts(0);
      setPendingDestination(null);
      setSwipeUnlockProgress(0);
    });
    if (destination?.route) {
      window.setTimeout(() => {
        emitInternalEvent('phone:openRoute', { route: destination.route, data: destination.data || {} });
      }, 60);
    }
  };

  const submitUnlock = async () => {
    if (await phoneActions.unlock(code())) {
      finalizeUnlock();
      return;
    }

    batch(() => {
      setError(true);
      setAttempts((prev) => prev + 1);
      setCode('');
    });
    window.setTimeout(() => setError(false), 520);
  };

  createEffect(() => {
    if (code().length === 4) void submitUnlock();
  });

  createEffect(() => {
    if (activeWidget() > 2) {
      setActiveWidget(0);
    }
  });

  const handleKeyPress = (num: string) => {
    if (code().length >= 4) return;
    setCode((prev) => prev + num);
  };

  const toggleFlashlight = async () => {
    if (!flashlightSupported()) return;
    const nextEnabled = !flashlightEnabled();
    const result = await fetchNui<{ success?: boolean; enabled?: boolean }>('cameraToggleFlashlight', { enabled: nextEnabled }, { success: true, enabled: nextEnabled });
    if (result?.success) {
      setFlashlightEnabled(result.enabled === true);
    }
  };

  const requestUnlockForRoute = (route: string, data?: Record<string, unknown>) => {
    setPendingDestination({ route, data });
    setError(false);
    setSwipeUnlockProgress(0);
  };

  const openCameraQuickAction = () => {
    requestUnlockForRoute('camera');
  };

  const handleNotificationClick = (route?: string, data?: Record<string, unknown>) => {
    if (!route) return;
    requestUnlockForRoute(route, data);
  };

  const updateMusicVolume = async (delta: number) => {
    const current = musicState();
    const nextVolume = Math.max(0, Math.min(1, current.volume + delta));
    setMusicState((prev) => ({ ...prev, volume: nextVolume }));
    await fetchNui('musicSetVolume', {
      volume: nextVolume,
      distance: current.distance,
    });
  };

  const pauseMusic = async () => {
    if (!musicState().isPlaying || musicState().isPaused) return;
    await fetchNui('musicPause');
  };

  const resumeMusic = async () => {
    if (!musicState().isPlaying || !musicState().isPaused) return;
    await fetchNui('musicResume');
  };

  const stopMusic = async () => {
    if (!musicState().isPlaying) return;
    await fetchNui('musicStop');
  };

  const reportImeiViewed = async (context: 'lockscreen') => {
    await fetchNui('phoneReportImeiViewed', { context }, { success: true });
  };

  const appendEmergencyDial = (value: string) => {
    setEmergencyStatus('');
    setEmergencyDial((current) => (current + value).slice(0, 20));
  };

  const deleteEmergencyDial = () => {
    setEmergencyStatus('');
    setEmergencyDial((current) => current.slice(0, -1));
  };

  const clearEmergencyDial = () => {
    setEmergencyStatus('');
    setEmergencyDial('');
  };

  const openImeiModal = async () => {
    await reportImeiViewed('lockscreen');
    setImeiModalOpen(true);
    setEmergencyStatus('');
  };

  const startEmergencyCall = async () => {
    const dialed = emergencyDial().trim();
    if (!dialed) return;

    if (dialed === '*#06#') {
      await openImeiModal();
      return;
    }

    const target = matchedEmergencyContact();
    if (!target) {
      setEmergencyStatus(emergencyContacts().length > 0 ? 'Solo numeros de emergencia configurados' : 'No hay numeros de emergencia');
      return;
    }

    const result = await fetchNui<{ error?: string }>('startCall', { phoneNumber: target.number, extraData: { source: 'lockscreen' } }, {});
    if (result?.error) {
      setEmergencyStatus('No se pudo iniciar la llamada');
      return;
    }

    setEmergencyStatus(`Llamando a ${target.label}`);
  };

  const unlockWithSwipe = () => {
    if (!swipeUnlockEnabled()) return;
    phoneActions.unlockDirect();
    finalizeUnlock();
  };

  const resetSwipeGesture = () => {
    swipePointerId = null;
    swipeStartY = null;
    setSwipeUnlockProgress(0);
  };

  const handleSwipeUnlockPointerDown = (event: PointerEvent) => {
    if (!swipeUnlockEnabled()) return;
    swipePointerId = event.pointerId;
    swipeStartY = event.clientY;
    setSwipeUnlockProgress(0);
  };

  const handleSwipeUnlockPointerMove = (event: PointerEvent) => {
    if (!swipeUnlockEnabled() || swipePointerId !== event.pointerId || swipeStartY === null) return;
    const delta = Math.max(0, swipeStartY - event.clientY);
    const progress = Math.min(100, (delta / 110) * 100);
    setSwipeUnlockProgress(progress);
  };

  const handleSwipeUnlockPointerEnd = (event: PointerEvent) => {
    if (swipePointerId !== event.pointerId) return;
    const shouldUnlock = swipeUnlockEnabled() && swipeUnlockProgress() >= 100;
    resetSwipeGesture();
    if (shouldUnlock) {
      unlockWithSwipe();
    }
  };

  const formatClockTime = (date: Date) => formatTime(date, language(), { hour: '2-digit', minute: '2-digit' });
  const formatClockDate = (date: Date) => formatDate(date, language(), { weekday: 'long', day: 'numeric', month: 'long' });
  const keypadKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];
  const totalCarouselItems = () => 3;

  return (
    <div class={styles.lockScreen}>
      <div
        class={styles.wallpaperBg}
        style={{ 'background-image': `url(${phoneState.settings.wallpaper})` }}
      />
      <div class={styles.wallpaperBlurOverlay} />
      <div class={styles.wallpaperNoise} />

      <div class={styles.timeBlock}>
        <div class={styles.time}>{formatClockTime(currentTime())}</div>
        <div class={styles.date}>{formatClockDate(currentTime())}</div>
      </div>

      <Show when={musicTitle()}>
        <div class={styles.nowPlayingWidget}>
          <img src="./img/icons_ios/music.svg" alt="" />
          <span>{musicTitle()}</span>
        </div>
      </Show>

      <div class={styles.contentArea}>
        <LockScreenWidgets
          compact={false}
          hasNotifications={visibleNotifications().length > 0}
          activeWidget={activeWidget()}
          visibleNotifications={visibleNotifications()}
          totalCarouselItems={totalCarouselItems()}
          onSelectWidget={setActiveWidget}
          onNotificationClick={handleNotificationClick}
          deviceOwnerName={phoneState.deviceOwnerName}
          phoneNumber={phoneState.settings.phoneNumber}
          imei={phoneState.imei}
          framework={phoneState.framework}
          isStolen={phoneState.isStolen}
          musicState={musicState()}
          musicStatusLabel={musicStatusLabel()}
          musicVolumePercent={musicVolumePercent()}
          onPauseResume={() => void (musicState().isPaused ? resumeMusic() : pauseMusic())}
          onStop={() => void stopMusic()}
          onVolumeDown={() => void updateMusicVolume(-0.1)}
          onVolumeUp={() => void updateMusicVolume(0.1)}
        />
      </div>

      <div class={styles.unlockSheet}>
        <div class={styles.sheetHandle} aria-hidden="true" />
          <div class={styles.codeContainer}>
            <span class={styles.unlockTitle}>{pendingDestination()?.route === 'camera' ? 'Abrir camara' : 'Desbloquear Gcphone-Next'}</span>
            <div class={styles.dots}>
              {[0, 1, 2, 3].map((i) => (
                <div class={styles.dot} classList={{ [styles.filled]: i < code().length, [styles.errorDot]: error() }} />
              ))}
            </div>
            <Show when={attempts() > 0}>
              <span class={styles.errorMsg}>PIN incorrecto ({attempts()})</span>
            </Show>
          </div>

          <div class={styles.keypad}>
            <Index each={keypadKeys}>
              {(key) => (
                <Show when={key() !== ''} fallback={<div class={styles.keySpacer} />}>
                  <button class={styles.key} onClick={() => (key() === 'del' ? setCode((prev) => prev.slice(0, -1)) : handleKeyPress(key()))}>
                    {key() === 'del' ? '⌫' : key()}
                  </button>
                </Show>
              )}
            </Index>
          </div>

          <div class={styles.sheetActions}>
              <button onClick={() => {
                setPendingDestination(null);
                setCode('');
                setError(false);
              }}>{t('lock.cancel', language())}</button>
              <button onClick={() => void submitUnlock()}>{t('lock.unlock', language())}</button>
          </div>
      </div>

      <Show when={emergencySheetOpen()}>
        <div class={styles.emergencySheetOverlay} onClick={() => setEmergencySheetOpen(false)}>
          <div class={styles.emergencySheet} onClick={(event) => event.stopPropagation()}>
            <div class={styles.emergencyHeader}>
              <div>
                <strong>{emergencyDial() || '...'}</strong>
                <span>{matchedEmergencyContact() ? `${matchedEmergencyContact()?.label}: ${matchedEmergencyContact()?.number}` : 'Marca *#06# para ver el IMEI'}</span>
              </div>
              <button class={styles.emergencyCallBtn} onClick={() => void startEmergencyCall()}>Llamar</button>
            </div>

            <div class={styles.emergencyTagRow}>
              <For each={emergencyContacts()}>
                {(contact) => (
                  <button class={styles.emergencyTag} onClick={() => {
                    setEmergencyStatus('');
                    setEmergencyDial(contact.number);
                  }}>
                    {contact.label}
                  </button>
                )}
              </For>
            </div>

            <div class={styles.emergencyKeypad}>
              <For each={['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#']}>
                {(key) => <button class={styles.emergencyKey} onClick={() => appendEmergencyDial(key)}>{key}</button>}
              </For>
            </div>

            <div class={styles.emergencyActions}>
              <button class={styles.emergencyActionBtn} onClick={deleteEmergencyDial}>⌫</button>
              <button
                class={styles.emergencyActionBtn}
                classList={{ [styles.emergencySosSent]: sosStatus() === 'sent' }}
                disabled={sosStatus() === 'sending'}
                onClick={async () => {
                  setSosStatus('sending');
                  await fetchNui('emergencySOS', {});
                  setSosStatus('sent');
                  window.setTimeout(() => setSosStatus('idle'), 2000);
                }}
              >
                {sosStatus() === 'sent' ? 'Enviado!' : 'SOS'}
              </button>
              <button class={styles.emergencyActionBtn} onClick={() => setEmergencySheetOpen(false)}>Cerrar</button>
            </div>

            <Show when={emergencyStatus()}>
              <p class={styles.emergencyStatus}>{emergencyStatus()}</p>
            </Show>
          </div>
        </div>
      </Show>

      <Show when={imeiModalOpen()}>
        <div class={styles.imeiModalOverlay} onClick={() => setImeiModalOpen(false)}>
          <div class={styles.imeiModalCard} onClick={(event) => event.stopPropagation()}>
            <h3>IMEI</h3>
            <p>{phoneState.imei || 'N/A'}</p>
            <button class={styles.emergencyActionBtn} onClick={() => setImeiModalOpen(false)}>Cerrar</button>
          </div>
        </div>
      </Show>

      <div class={styles.bottomActions}>
        <button class={styles.bottomBtn} classList={{ [styles.bottomBtnActive]: flashlightEnabled() }} onClick={() => void toggleFlashlight()} disabled={!flashlightSupported()}>
          <img src="./img/icons_ios/ui-flashlight.svg" alt="" draggable={false} />
        </button>
        <button class={styles.bottomBtn} onClick={openCameraQuickAction}>
          <img src="./img/icons_ios/camera.svg" alt="" draggable={false} />
        </button>
        <Show when={swipeUnlockEnabled()}>
          <div
            class={styles.swipeUnlockDock}
            onPointerDown={handleSwipeUnlockPointerDown}
            onPointerMove={handleSwipeUnlockPointerMove}
            onPointerUp={handleSwipeUnlockPointerEnd}
            onPointerCancel={handleSwipeUnlockPointerEnd}
          >
            <div class={styles.swipeUnlockTrack}>
              <div class={styles.swipeUnlockFill} style={{ height: `${swipeUnlockProgress()}%` }} />
              <div class={styles.swipeUnlockHandle} style={{ transform: `translateY(-${Math.min(swipeUnlockProgress(), 92)}%)` }}>
                <span class={styles.swipeUnlockArrow}>⌃</span>
              </div>
            </div>
            <span class={styles.swipeUnlockLabel}>Desliza hacia arriba</span>
          </div>
        </Show>
        <button class={styles.sosBtn} onClick={() => setEmergencySheetOpen(true)}>SOS</button>
      </div>
    </div>
  );
}
