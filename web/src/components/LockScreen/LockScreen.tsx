import { For, Show, batch, createEffect, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import { usePhone } from '../../store/phone';
import { useNotifications } from '../../store/notifications';
import { formatPhoneNumber } from '../../utils/misc';
import { fetchNui } from '../../utils/fetchNui';
import { formatDate, formatTime, t } from '../../i18n';
import styles from './LockScreen.module.scss';

interface PendingDestination {
  route: string;
  data?: Record<string, unknown>;
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" rx="1.5" fill="currentColor" />
      <rect x="14" y="5" width="4" height="14" rx="1.5" fill="currentColor" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 6.5C8 5.72 8.85 5.24 9.52 5.64L18.1 10.64C18.76 11.03 18.76 11.97 18.1 12.36L9.52 17.36C8.85 17.76 8 17.28 8 16.5V6.5Z" fill="currentColor" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
    </svg>
  );
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
  const [keypadExpanded, setKeypadExpanded] = createSignal(true);
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
  const language = () => phoneState.settings.language || 'es';
  const swipeUnlockEnabled = () => phoneState.settings.swipeUnlock === true;

  let timer: number | undefined;
  let swipePointerId: number | null = null;
  let swipeStartY: number | null = null;

  const visibleNotifications = createMemo(() => (
    notifications.history
      .filter((item) => item.id !== 'music-now-playing')
      .slice(0, keypadExpanded() ? 3 : 5)
  ));
  const hasNotifications = createMemo(() => visibleNotifications().length > 0);
  const emergencyContacts = createMemo(() => phoneState.setup.emergencyContacts || []);
  const matchedEmergencyContact = createMemo(() => emergencyContacts().find((entry) => entry.number === emergencyDial().trim()));

  const musicStatusLabel = createMemo(() => {
    const current = musicState();
    if (current.isPlaying && current.isPaused) return `Pausado: ${current.title || 'Sin musica'}`;
    if (current.isPlaying) return `Reproduciendo: ${current.title || 'Sin musica'}`;
    return 'Sin musica';
  });

  const musicVolumePercent = createMemo(() => Math.round(musicState().volume * 100));

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
    setKeypadExpanded(true);
    setMusicState(readStoredMusicSession());

    const onMusicStateUpdated = (event: Event) => {
      applyMusicState((event as CustomEvent<Partial<MusicSessionState>>).detail || {});
    };

    window.addEventListener('musicStateUpdated', onMusicStateUpdated as EventListener);

    void (async () => {
      const capabilities = await fetchNui<{ flashlight?: boolean; flashlightEnabled?: boolean }>('cameraGetCapabilities', undefined, {
        flashlight: false,
        flashlightEnabled: false,
      });
      setFlashlightSupported(capabilities?.flashlight === true);
      setFlashlightEnabled(capabilities?.flashlightEnabled === true);
    })();

    onCleanup(() => {
      window.removeEventListener('musicStateUpdated', onMusicStateUpdated as EventListener);
    });
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
        window.dispatchEvent(new CustomEvent('phone:openRoute', { detail: { route: destination.route, data: destination.data || {} } }));
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
    if (phoneState.locked) {
      setKeypadExpanded(true);
    }
  });

  createEffect(() => {
    if (hasNotifications()) {
      setActiveWidget(0);
      return;
    }

    if (activeWidget() > 1) {
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
    setKeypadExpanded(true);
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
  const totalCarouselItems = () => (hasNotifications() ? 3 : 2);

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

      <div class={styles.contentArea}>
        <Show
          when={!keypadExpanded()}
          fallback={(
            <div class={styles.widgetCarousel}>
              <div class={styles.widgetViewport}>
                <Show when={hasNotifications() && activeWidget() === 0}>
                  <section class={`${styles.widgetPanel} ${styles.primaryPanel}`}>
                    <div class={styles.notificationCenterHeader}>
                      <span class={styles.widgetLabel}>Notificaciones</span>
                      <span class={styles.widgetMeta}>{visibleNotifications().length}</span>
                    </div>
                    <div class={`${styles.notificationList} ${styles.notificationListCompact}`}>
                      <For each={visibleNotifications()}>
                        {(item) => (
                          <button
                            class={styles.notificationCard}
                            classList={{ [styles.notificationCardInteractive]: !!item.route }}
                            onClick={() => handleNotificationClick(item.route, item.data)}
                            disabled={!item.route}
                          >
                            <div class={styles.notificationTop}>
                              <strong>{item.title}</strong>
                              <span>{item.appId}</span>
                            </div>
                            <p>{item.message}</p>
                          </button>
                        )}
                      </For>
                    </div>
                  </section>
                </Show>

                <Show when={activeWidget() === (hasNotifications() ? 1 : 0)}>
                  <section class={styles.widgetPanel}>
                    <div class={styles.widgetHeader}>
                      <span class={styles.widgetLabel}>Device Info</span>
                      <Show when={phoneState.isStolen}>
                        <span class={styles.widgetFlag}>Reportado</span>
                      </Show>
                    </div>
                    <div class={styles.deviceInfoRows}>
                      <Show when={phoneState.deviceOwnerName}>
                        <div class={styles.deviceIdentityRow}>
                          <span>Propietario</span>
                          <strong>{phoneState.deviceOwnerName}</strong>
                        </div>
                      </Show>
                      <Show when={phoneState.settings.phoneNumber}>
                        <div class={styles.deviceIdentityRow}>
                          <span>Numero</span>
                          <strong>{formatPhoneNumber(phoneState.settings.phoneNumber, phoneState.framework || 'unknown')}</strong>
                        </div>
                      </Show>
                      <Show when={phoneState.imei}>
                        <div class={styles.deviceIdentityRow}>
                          <span>IMEI</span>
                          <strong>{phoneState.imei}</strong>
                        </div>
                      </Show>
                    </div>
                  </section>
                </Show>

                <Show when={activeWidget() === (hasNotifications() ? 2 : 1)}>
                  <section class={`${styles.widgetPanel} ${styles.musicPanel}`}>
                    <div class={styles.widgetHeader}>
                      <span class={styles.widgetLabel}>Musica</span>
                      <span class={styles.widgetMeta}>{musicVolumePercent()}%</span>
                    </div>
                    <strong class={styles.widgetTitle}>{musicStatusLabel()}</strong>
                    <div class={styles.musicControls}>
                      <button class={styles.musicIconBtn} onClick={() => void (musicState().isPaused ? resumeMusic() : pauseMusic())} disabled={!musicState().isPlaying} aria-label={musicState().isPaused ? 'Reanudar musica' : 'Pausar musica'}>
                        <Show when={musicState().isPaused} fallback={<PauseIcon />}>
                          <PlayIcon />
                        </Show>
                      </button>
                      <button class={styles.musicIconBtn} onClick={() => void stopMusic()} disabled={!musicState().isPlaying} aria-label="Detener musica">
                        <StopIcon />
                      </button>
                    </div>
                    <div class={styles.volumeControls}>
                      <button class={styles.volumeBtn} onClick={() => void updateMusicVolume(-0.1)} disabled={!musicState().isPlaying}>-</button>
                      <div class={styles.volumeBar}><span style={{ width: `${musicVolumePercent()}%` }} /></div>
                      <button class={styles.volumeBtn} onClick={() => void updateMusicVolume(0.1)} disabled={!musicState().isPlaying}>+</button>
                    </div>
                  </section>
                </Show>
              </div>
              <div class={styles.carouselDots}>
                <For each={Array.from({ length: totalCarouselItems() }, (_, index) => index)}>
                  {(index) => (
                    <button class={styles.dotBtn} classList={{ [styles.dotBtnActive]: activeWidget() === index }} onClick={() => setActiveWidget(index)} aria-label={`Widget ${index + 1}`} />
                  )}
                </For>
              </div>
            </div>
          )}
        >
          <div class={styles.widgetStack}>
            <Show when={hasNotifications()}>
              <section class={`${styles.notificationCenter} ${styles.primaryPanel}`}>
                <div class={styles.notificationCenterHeader}>
                  <span class={styles.widgetLabel}>Notificaciones</span>
                  <span class={styles.widgetMeta}>{visibleNotifications().length}</span>
                </div>
                <div class={styles.notificationList}>
                  <For each={visibleNotifications()}>
                    {(item) => (
                      <button
                        class={styles.notificationCard}
                        classList={{ [styles.notificationCardInteractive]: !!item.route }}
                        onClick={() => handleNotificationClick(item.route, item.data)}
                        disabled={!item.route}
                      >
                        <div class={styles.notificationTop}>
                          <strong>{item.title}</strong>
                          <span>{item.appId}</span>
                        </div>
                        <p>{item.message}</p>
                      </button>
                    )}
                  </For>
                </div>
              </section>
            </Show>

            <section class={styles.widgetPanel}>
              <div class={styles.widgetHeader}>
                <span class={styles.widgetLabel}>Device Info</span>
                <Show when={phoneState.isStolen}>
                  <span class={styles.widgetFlag}>Reportado</span>
                </Show>
              </div>
              <div class={styles.deviceInfoRows}>
                <Show when={phoneState.deviceOwnerName}>
                  <div class={styles.deviceIdentityRow}>
                    <span>Propietario</span>
                    <strong>{phoneState.deviceOwnerName}</strong>
                  </div>
                </Show>
                <Show when={phoneState.settings.phoneNumber}>
                  <div class={styles.deviceIdentityRow}>
                    <span>Numero</span>
                    <strong>{formatPhoneNumber(phoneState.settings.phoneNumber, phoneState.framework || 'unknown')}</strong>
                  </div>
                </Show>
                <Show when={phoneState.imei}>
                  <div class={styles.deviceIdentityRow}>
                    <span>IMEI</span>
                    <strong>{phoneState.imei}</strong>
                  </div>
                </Show>
              </div>
            </section>

            <section class={`${styles.widgetPanel} ${styles.musicPanel}`}>
              <div class={styles.widgetHeader}>
                <span class={styles.widgetLabel}>Musica</span>
                <span class={styles.widgetMeta}>{musicVolumePercent()}%</span>
              </div>
              <strong class={styles.widgetTitle}>{musicStatusLabel()}</strong>
              <div class={styles.musicControls}>
                <button class={styles.musicIconBtn} onClick={() => void (musicState().isPaused ? resumeMusic() : pauseMusic())} disabled={!musicState().isPlaying} aria-label={musicState().isPaused ? 'Reanudar musica' : 'Pausar musica'}>
                  <Show when={musicState().isPaused} fallback={<PauseIcon />}>
                    <PlayIcon />
                  </Show>
                </button>
                <button class={styles.musicIconBtn} onClick={() => void stopMusic()} disabled={!musicState().isPlaying} aria-label="Detener musica">
                  <StopIcon />
                </button>
              </div>
              <div class={styles.volumeControls}>
                <button class={styles.volumeBtn} onClick={() => void updateMusicVolume(-0.1)} disabled={!musicState().isPlaying}>-</button>
                <div class={styles.volumeBar}><span style={{ width: `${musicVolumePercent()}%` }} /></div>
                <button class={styles.volumeBtn} onClick={() => void updateMusicVolume(0.1)} disabled={!musicState().isPlaying}>+</button>
              </div>
            </section>
          </div>
        </Show>
      </div>

      <Show
        when={keypadExpanded()}
        fallback={(
          <div class={styles.unlockSheetCollapsed}>
            <button class={styles.expandKeypadBtn} onClick={() => setKeypadExpanded(true)}>
              Mostrar teclado
            </button>
            <Show when={pendingDestination()?.route}>
              <span class={styles.pendingHint}>Desbloquea para continuar</span>
            </Show>
          </div>
        )}
      >
        <div class={styles.unlockSheet}>
          <button class={styles.sheetHandle} onClick={() => setKeypadExpanded(false)} aria-label="Minimizar teclado" />
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
            <For each={keypadKeys}>
              {(key) => (
                <Show when={key !== ''} fallback={<div class={styles.keySpacer} />}>
                  <button class={styles.key} onClick={() => (key === 'del' ? setCode((prev) => prev.slice(0, -1)) : handleKeyPress(key))}>
                    {key === 'del' ? '⌫' : key}
                  </button>
                </Show>
              )}
            </For>
          </div>

          <div class={styles.sheetActions}>
            <button onClick={() => {
              setPendingDestination(null);
              setCode('');
              setError(false);
              setKeypadExpanded(false);
            }}>{t('lock.cancel', language())}</button>
            <button onClick={() => void submitUnlock()}>{t('lock.unlock', language())}</button>
          </div>
        </div>
      </Show>

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
              <button class={styles.emergencyActionBtn} onClick={clearEmergencyDial}>C</button>
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
        <button class={styles.bottomBtn} onClick={() => setEmergencySheetOpen(true)}>SOS</button>
      </div>
    </div>
  );
}
