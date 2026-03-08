import { For, Show, batch, createEffect, createSignal, onCleanup, onMount } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { usePhone } from '../../../store/phone';
import { useNotifications } from '../../../store/notifications';
import { fetchNui } from '../../../utils/fetchNui';
import { APP_DEFINITIONS } from '../../../config/apps';
import { usePhoneKeyHandler } from '../../../hooks/usePhoneKeyHandler';
import { appName, t } from '../../../i18n';
import styles from './SettingsApp.module.scss';

// Audio player for ringtone preview
let currentAudio: HTMLAudioElement | null = null;
let currentRingtoneId: string | null = null;

type SettingsTab = 'appearance' | 'sound' | 'security' | 'advanced';

const wallpapers = [
  './img/background/back001.jpg',
  './img/background/back002.jpg',
  './img/background/back003.jpg',
  './img/background/color.jpg',
  './img/background/humo.jpg',
  './img/background/iluminacion.jpg',
  './img/background/neon.jpg',
  './img/background/oscuridad.jpg',
  './img/background/paisajes.jpg',
  './img/background/playa.jpg',
  './img/background/tokio.jpg',
];

const ringtones = [
  { id: 'ring.ogg', name: 'Classic Ring', icon: '🔔' },
  { id: 'ring2.ogg', name: 'Tone Two', icon: '🎵' },
  { id: 'iphone11.ogg', name: 'iPhone Style', icon: '📱' },
  { id: 'casa_papel.ogg', name: 'Casa de Papel', icon: '🎭' },
  { id: 'bella_ciao.ogg', name: 'Bella Ciao', icon: '🎺' },
];

const languages = [
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
];

const audioProfiles = [
  { id: 'normal', name: 'Normal', desc: 'Uso general', icon: '🔊' },
  { id: 'street', name: 'Calle', desc: 'Exterior ruidoso', icon: '🏙️' },
  { id: 'vehicle', name: 'Vehículo', desc: 'En movimiento', icon: '🚗' },
  { id: 'silent', name: 'Silencio', desc: 'Sin sonido', icon: '🔇' },
];

const navItems: { id: SettingsTab; label: string; icon: string }[] = [
  { id: 'appearance', label: 'Apariencia', icon: '🎨' },
  { id: 'sound', label: 'Sonido', icon: '🔊' },
  { id: 'security', label: 'Seguridad', icon: '🔒' },
  { id: 'advanced', label: 'Avanzado', icon: '⚙️' },
];

export function SettingsApp() {
  const router = useRouter();
  const [phoneState, phoneActions] = usePhone();
  const [notifications, notificationsActions] = useNotifications();

  const [tab, setTab] = createSignal<SettingsTab>('appearance');
  const [urlInput, setUrlInput] = createSignal('');
  const [pinStep, setPinStep] = createSignal(1);
  const [pinCode, setPinCode] = createSignal('');
  const [pinConfirm, setPinConfirm] = createSignal('');
  const [status, setStatus] = createSignal<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [liveLocationEnabled, setLiveLocationEnabled] = createSignal(false);
  const [liveLocationInterval, setLiveLocationInterval] = createSignal<5 | 10>(10);
  const [liveLocationStatus, setLiveLocationStatus] = createSignal('');
  const language = () => phoneState.settings.language || 'es';

  usePhoneKeyHandler({
    Backspace: () => {
      router.goBack();
    },
  });

  onMount(async () => {
    const persisted = window.localStorage.getItem('gcphone:liveLocationInterval');
    if (persisted === '5') setLiveLocationInterval(5);
    if (persisted === '10') setLiveLocationInterval(10);

    const state = await fetchNui<{ success?: boolean; active?: boolean; intervalSeconds?: number }>('getLiveLocationState', {}, { success: false, active: false, intervalSeconds: 10 });
    if (state?.success) {
      setLiveLocationEnabled(Boolean(state.active));
      if (state.intervalSeconds === 5 || state.intervalSeconds === 10) {
        setLiveLocationInterval(state.intervalSeconds);
      }
    }
  });

  const updateLiveLocationInterval = async (seconds: 5 | 10) => {
    setLiveLocationInterval(seconds);
    window.localStorage.setItem('gcphone:liveLocationInterval', String(seconds));
    await fetchNui('setLiveLocationInterval', { seconds });
  };

  const toggleLiveLocation = async () => {
    if (liveLocationEnabled()) {
      const response = await fetchNui<{ success?: boolean }>('stopLiveLocation', {}, { success: false });
      if (response?.success) {
        setLiveLocationEnabled(false);
        setLiveLocationStatus('Ubicación activa desactivada');
      }
      return;
    }

    const contacts = await fetchNui<Array<{ number: string }>>('getContacts', {}, []);
    const recipients = (contacts || [])
      .map((row) => String(row?.number || '').trim())
      .filter((value) => value.length > 0);

    if (recipients.length === 0) {
      setLiveLocationStatus('No tienes contactos para compartir');
      return;
    }

    await fetchNui('setLiveLocationInterval', { seconds: liveLocationInterval() });
    const response = await fetchNui<{ success?: boolean; error?: string }>('startLiveLocation', {
      recipients,
      durationMinutes: 15,
      updateIntervalSeconds: liveLocationInterval(),
    }, { success: false });

    if (response?.success) {
      setLiveLocationEnabled(true);
      setLiveLocationStatus(`Ubicación activa cada ${liveLocationInterval()}s`);
      return;
    }

    setLiveLocationStatus(response?.error || 'No se pudo activar ubicación');
  };

  const randomWallpaper = () => {
    const random = Math.floor(Math.random() * 1000);
    phoneActions.setWallpaper(`https://picsum.photos/seed/${random}/326/742`);
  };

  const applyUrlWallpaper = () => {
    const value = urlInput().trim();
    if (!value) return;
    phoneActions.setWallpaper(value);
    setUrlInput('');
  };

  const handlePinDigit = (digit: string) => {
    if (pinStep() === 1) {
      if (pinCode().length < 4) {
        setPinCode(pinCode() + digit);
        if (pinCode().length === 3) {
          setPinStep(2);
        }
      }
    } else {
      if (pinConfirm().length < 4) {
        setPinConfirm(pinConfirm() + digit);
        if (pinConfirm().length === 3) {
          validateAndSavePin();
        }
      }
    }
  };

  const handlePinBackspace = () => {
    if (pinStep() === 2 && pinConfirm().length === 0) {
      setPinStep(1);
      setPinCode(pinCode().slice(0, -1));
    } else if (pinStep() === 2) {
      setPinConfirm(pinConfirm().slice(0, -1));
    } else {
      setPinCode(pinCode().slice(0, -1));
    }
    setStatus(null);
  };

  const validateAndSavePin = () => {
    const code = pinCode();
    const confirm = pinConfirm();

    if (code !== confirm) {
      setStatus({ type: 'error', text: 'Los PIN no coinciden' });
      setPinStep(1);
      setPinCode('');
      setPinConfirm('');
      return;
    }

    phoneActions.setLockCode(code);
    setStatus({ type: 'ok', text: 'PIN guardado correctamente' });
    setTimeout(() => {
      setPinStep(1);
      setPinCode('');
      setPinConfirm('');
      setStatus(null);
    }, 2000);
  };

  const getCurrentPin = () => pinStep() === 1 ? pinCode() : pinConfirm();

  const renderNav = () => (
    <div class={styles.navGrid}>
      <For each={navItems}>
        {(item) => (
          <button
            class={styles.navItem}
            classList={{ [styles.active]: tab() === item.id }}
            onClick={() => {
              setTab(item.id);
              setStatus(null);
            }}
          >
            <div class={styles.navIcon}>{item.icon}</div>
            <span class={styles.navLabel}>{item.label}</span>
          </button>
        )}
      </For>
    </div>
  );

  const renderAppearance = () => (
    <div class={styles.sectionContainer}>
      <div class={styles.sectionCard}>
        <div class={styles.sectionHeader}>
          <div class={`${styles.sectionIcon} ${styles['icon-wallpaper']}`}>🖼️</div>
          <span class={styles.sectionTitle}>Fondo de pantalla</span>
        </div>

        <Show when={phoneState.settings.wallpaper}>
          <div class={styles.wallpaperPreview}>
            <img src={phoneState.settings.wallpaper} alt="Current wallpaper" />
          </div>
        </Show>

        <div class={styles.wallpaperGrid}>
          <For each={wallpapers}>
            {(wallpaper) => (
              <button
                class={styles.wallpaperItem}
                classList={{ [styles.selected]: phoneState.settings.wallpaper === wallpaper }}
                onClick={() => phoneActions.setWallpaper(wallpaper)}
              >
                <img src={wallpaper} alt="Wallpaper" />
              </button>
            )}
          </For>
        </div>

        <div class={styles.quickActions}>
          <button class={styles.actionBtn} onClick={() => fetchNui('openGallery', { selectWallpaper: true })}>
            📷 Galería
          </button>
          <button class={styles.actionBtn} onClick={randomWallpaper}>
            🎲 Aleatorio
          </button>
        </div>

        <div class={styles.customUrlInput}>
          <input
            type="url"
            placeholder="https://example.com/wallpaper.jpg"
            value={urlInput()}
            onInput={(e) => setUrlInput(e.currentTarget.value)}
          />
          <button onClick={applyUrlWallpaper}>Aplicar</button>
        </div>
      </div>

      <div class={styles.sectionCard}>
        <div class={styles.sectionHeader}>
          <div class={`${styles.sectionIcon} ${styles['icon-language']}`}>🌐</div>
          <span class={styles.sectionTitle}>Idioma</span>
        </div>
        <div class={styles.languageOptions}>
          <For each={languages}>
            {(lang) => (
              <button
                class={styles.langOption}
                classList={{ [styles.selected]: language() === lang.code }}
                onClick={() => phoneActions.setLanguage(lang.code as 'es' | 'en' | 'pt' | 'fr')}
              >
                <div class={styles.langFlag}>{lang.flag}</div>
                <span class={styles.langName}>{lang.name}</span>
              </button>
            )}
          </For>
        </div>
      </div>
    </div>
  );

  const playRingtonePreview = (ringtoneId: string) => {
    // Stop current audio if playing
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio = null;
    }
    
    // If clicking the same ringtone that's playing, just stop it
    if (currentRingtoneId === ringtoneId) {
      currentRingtoneId = null;
      return;
    }
    
    // Play new ringtone
    const audio = new Audio(`./audio/ringtones/${ringtoneId}`);
    audio.volume = phoneState.settings.volume;
    audio.play().catch(() => {
      // Audio playback failed (browser policy, etc.)
    });
    
    currentAudio = audio;
    currentRingtoneId = ringtoneId;
    
    // Auto-stop after 5 seconds
    setTimeout(() => {
      if (currentAudio === audio) {
        audio.pause();
        currentAudio = null;
        currentRingtoneId = null;
      }
    }, 5000);
  };

  const renderSound = () => (
    <div class={styles.sectionContainer}>
      <div class={styles.sectionCard}>
        <div class={styles.sectionHeader}>
          <div class={`${styles.sectionIcon} ${styles['icon-volume']}`}>🔊</div>
          <span class={styles.sectionTitle}>Volumen</span>
        </div>
        <div class={styles.volumeControl}>
          <span>🔇</span>
          <input
            class={styles.volumeSlider}
            type="range"
            min="0"
            max="100"
            value={Math.round(phoneState.settings.volume * 100)}
            onInput={(e) => phoneActions.setVolume(Number(e.currentTarget.value) / 100)}
          />
          <span>🔊</span>
          <span class={styles.volumeValue}>{Math.round(phoneState.settings.volume * 100)}%</span>
        </div>
      </div>

      <div class={styles.sectionCard}>
        <div class={styles.sectionHeader}>
          <div class={`${styles.sectionIcon} ${styles['icon-profile']}`}>🎧</div>
          <span class={styles.sectionTitle}>Perfil de audio</span>
        </div>
        <div class={styles.audioProfiles}>
          <For each={audioProfiles}>
            {(profile) => (
              <button
                class={styles.profileOption}
                classList={{ [styles.selected]: phoneState.settings.audioProfile === profile.id }}
                onClick={() => phoneActions.setAudioProfile(profile.id as 'normal' | 'street' | 'vehicle' | 'silent')}
              >
                <span class={styles.profileIcon}>{profile.icon}</span>
                <span class={styles.profileName}>{profile.name}</span>
                <span class={styles.profileDesc}>{profile.desc}</span>
              </button>
            )}
          </For>
        </div>
      </div>

      <div class={styles.sectionCard}>
        <div class={styles.sectionHeader}>
          <div class={`${styles.sectionIcon} ${styles['icon-ringtone']}`}>🎵</div>
          <span class={styles.sectionTitle}>Tono de llamada</span>
        </div>
        <div class={styles.ringtoneList}>
          <For each={ringtones}>
            {(ringtone) => (
              <div
                class={styles.ringtoneItem}
                classList={{ [styles.selected]: phoneState.settings.ringtone === ringtone.id }}
              >
                <div class={styles.ringtoneIcon}>{ringtone.icon}</div>
                <span class={styles.ringtoneName}>{ringtone.name}</span>
                <div class={styles.ringtoneActions}>
                  <button
                    class={styles.previewBtn}
                    onClick={() => playRingtonePreview(ringtone.id)}
                    title="Escuchar"
                  >
                    {currentRingtoneId === ringtone.id ? '⏹️' : '▶️'}
                  </button>
                  <button
                    class={styles.selectBtn}
                    classList={{ [styles.selected]: phoneState.settings.ringtone === ringtone.id }}
                    onClick={() => phoneActions.setRingtone(ringtone.id)}
                  >
                    {phoneState.settings.ringtone === ringtone.id ? '✓' : t('common.select', language())}
                  </button>
                </div>
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  );

  const renderSecurity = () => (
    <div class={styles.sectionContainer}>
      <div class={styles.sectionCard}>
        <div class={styles.pinContainer}>
          <div class={styles.pinTitle}>
            {pinStep() === 1 ? 'Ingresa un PIN de 4 dígitos' : 'Confirma tu PIN'}
          </div>

          <div class={styles.pinDots}>
            <For each={[0, 1, 2, 3]}>
              {(i) => (
                <div
                  class={styles.pinDot}
                  classList={{ [styles.filled]: getCurrentPin().length > i }}
                />
              )}
            </For>
          </div>

          <div class={styles.pinKeypad}>
            <For each={['1', '2', '3', '4', '5', '6', '7', '8', '9']}>
              {(digit) => (
                <button class={styles.pinKey} onClick={() => handlePinDigit(digit)}>
                  {digit}
                </button>
              )}
            </For>
            <div />
            <button class={styles.pinKey} onClick={() => handlePinDigit('0')}>
              0
            </button>
            <button class={styles.pinBackspace} onClick={handlePinBackspace}>
              ⌫
            </button>
          </div>

          <Show when={status()}>
            {(msg) => (
              <div class={`${styles.pinMessage} ${styles[msg().type]}`}>
                {msg().text}
              </div>
            )}
          </Show>
        </div>
      </div>
    </div>
  );

  const renderAdvanced = () => (
    <div class={styles.sectionContainer}>
      <div class={styles.sectionCard}>
        <div class={styles.sectionHeader}>
          <div class={`${styles.sectionIcon} ${styles['icon-notifications']}`}>🔔</div>
          <span class={styles.sectionTitle}>Notificaciones por app</span>
        </div>
        <div class={styles.notificationsGrid}>
          <For each={APP_DEFINITIONS.filter((app) => phoneState.enabledApps.includes(app.id))}>
            {(app) => {
              const unreadCount = notificationsActions.getUnreadCount(app.id);
              return (
                <div class={styles.notificationApp}>
                  <div class={styles.notificationAppIcon}>
                    <img src={app.icon} alt={appName(app.id, app.name, language())} />
                  </div>
                  <div class={styles.notificationAppInfo}>
                    <div class={styles.notificationAppName}>
                      {appName(app.id, app.name, language())}
                    </div>
                    <div class={styles.notificationAppStatus}>
                      {unreadCount > 0 ? `${unreadCount} sin leer` : 'Al día'}
                    </div>
                  </div>
                  <Show when={unreadCount > 0}>
                    <div class={styles.notificationBadge}>{unreadCount}</div>
                  </Show>
                  <Show when={unreadCount === 0}>
                    <div class={styles.notificationOk}>✓</div>
                  </Show>
                </div>
              );
            }}
          </For>
        </div>
        <button
          class={styles.clearAllBtn}
          onClick={() => {
            for (const app of APP_DEFINITIONS) {
              notificationsActions.markAppAsRead(app.id);
            }
          }}
        >
          Marcar todas como leídas
        </button>
      </div>

      <div class={styles.sectionCard}>
        <div class={styles.sectionHeader}>
          <div class={`${styles.sectionIcon} ${styles['icon-location']}`}>📍</div>
          <span class={styles.sectionTitle}>Ubicación en tiempo real</span>
        </div>
        <div class={styles.liveLocationControl}>
          <div class={styles.locationToggle}>
            <div class={styles.locationLabel}>
              <div class={`${styles.locationIcon} ${styles['icon-location']}`}>📍</div>
              <div>
                <div class={styles.locationText}>Compartir ubicación</div>
                <div class={styles.locationStatus}>
                  {liveLocationEnabled() ? 'Activo' : 'Inactivo'}
                </div>
              </div>
            </div>
            <div
              class={styles.toggleSwitch}
              classList={{ [styles.active]: liveLocationEnabled() }}
              onClick={() => void toggleLiveLocation()}
            >
              <div class={styles.toggleThumb} />
            </div>
          </div>

          <Show when={liveLocationEnabled()}>
            <div class={styles.locationFrequency}>
              <button
                class={styles.freqBtn}
                classList={{ [styles.selected]: liveLocationInterval() === 5 }}
                onClick={() => void updateLiveLocationInterval(5)}
              >
                Cada 5s
              </button>
              <button
                class={styles.freqBtn}
                classList={{ [styles.selected]: liveLocationInterval() === 10 }}
                onClick={() => void updateLiveLocationInterval(10)}
              >
                Cada 10s
              </button>
            </div>
          </Show>

          <Show when={liveLocationStatus()}>
            <div class={`${styles.statusMessage} ${liveLocationEnabled() ? styles.success : styles.error}`}>
              {liveLocationStatus()}
            </div>
          </Show>
        </div>
      </div>

      <div class={styles.sectionCard}>
        <div class={styles.sectionHeader}>
          <div class={`${styles.sectionIcon} ${styles['icon-system']}`}>⚙️</div>
          <span class={styles.sectionTitle}>Sistema</span>
        </div>
        <div class={styles.togglesList}>
          <div class={styles.toggleItem}>
            <span class={styles.toggleLabel}>
              <span class={`${styles.toggleIcon} ${styles['icon-system']}`}>✈️</span>
              Modo avión
            </span>
            <div
              class={styles.toggleSwitch}
              classList={{ [styles.active]: notifications.airplaneMode }}
              onClick={() => notificationsActions.setAirplaneMode(!notifications.airplaneMode)}
            >
              <div class={styles.toggleThumb} />
            </div>
          </div>
          <div class={styles.toggleItem}>
            <span class={styles.toggleLabel}>
              <span class={`${styles.toggleIcon} ${styles['icon-system']}`}>🌙</span>
              No molestar
            </span>
            <div
              class={styles.toggleSwitch}
              classList={{ [styles.active]: notifications.doNotDisturb }}
              onClick={() => notificationsActions.setDoNotDisturb(!notifications.doNotDisturb)}
            >
              <div class={styles.toggleThumb} />
            </div>
          </div>
          <div class={styles.toggleItem}>
            <span class={styles.toggleLabel}>
              <span class={`${styles.toggleIcon} ${styles['icon-system']}`}>🔇</span>
              Modo silencio
            </span>
            <div
              class={styles.toggleSwitch}
              classList={{ [styles.active]: notifications.silentMode }}
              onClick={() => notificationsActions.setSilentMode(!notifications.silentMode)}
            >
              <div class={styles.toggleThumb} />
            </div>
          </div>
        </div>
      </div>

      <div class={styles.sectionCard}>
        <div class={styles.sectionHeader}>
          <div class={`${styles.sectionIcon} ${styles['icon-volume']}`}>☀️</div>
          <span class={styles.sectionTitle}>Brillo</span>
        </div>
        <div class={styles.volumeControl}>
          <span>🌑</span>
          <input
            class={styles.volumeSlider}
            type="range"
            min="40"
            max="120"
            value={Math.round(notifications.brightness * 100)}
            onInput={(e) => {
              const val = Number(e.currentTarget.value);
              notificationsActions.setBrightness(val / 100);
            }}
          />
          <span>☀️</span>
          <span class={styles.volumeValue}>{Math.round(notifications.brightness * 100)}%</span>
        </div>
      </div>

      <div class={styles.sectionCard}>
        <div class={styles.sectionHeader}>
          <div class={`${styles.sectionIcon} ${styles['icon-info']}`}>ℹ️</div>
          <span class={styles.sectionTitle}>Información</span>
        </div>
        <div class={styles.appInfo}>
          <div class={styles.infoRow}>
            <span class={styles.infoLabel}>Número</span>
            <span class={styles.infoValue}>{phoneState.settings.phoneNumber || 'No asignado'}</span>
          </div>
          <div class={styles.infoRow}>
            <span class={styles.infoLabel}>Versión</span>
            <span class={styles.infoValue}>2.1.0</span>
          </div>
          <div class={styles.infoRow}>
            <span class={styles.infoLabel}>Framework</span>
            <span class={styles.infoValue}>GCPhone Next</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div class={`ios-page ${styles.app}`}>
      <div class="ios-nav">
        <button class="ios-icon-btn k-touch-ripple" onClick={() => router.goBack()}>‹</button>
        <div class="ios-nav-title">{t('settings.title', language())}</div>
      </div>

      <div class={`ios-content ${styles.settingsCanvas}`}>
        <div class={styles.settingsHeader}>
          <div class={styles.settingsTitle}>{t('settings.title', language())}</div>
          <div class={styles.settingsSubtitle}>Personaliza tu experiencia</div>
        </div>

        {renderNav()}

        <Show when={tab() === 'appearance'}>{renderAppearance()}</Show>
        <Show when={tab() === 'sound'}>{renderSound()}</Show>
        <Show when={tab() === 'security'}>{renderSecurity()}</Show>
        <Show when={tab() === 'advanced'}>{renderAdvanced()}</Show>
      </div>
    </div>
  );
}
