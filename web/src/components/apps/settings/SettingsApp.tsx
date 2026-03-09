import { For, Show, createSignal, onMount, Switch, Match } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { usePhone } from '../../../store/phone';
import { useNotifications } from '../../../store/notifications';
import { fetchNui } from '../../../utils/fetchNui';
import { APP_DEFINITIONS } from '../../../config/apps';
import { usePhoneKeyHandler } from '../../../hooks/usePhoneKeyHandler';
import { AppScaffold } from '../../shared/layout';
import { appName, t } from '../../../i18n';
import styles from './SettingsApp.module.scss';

// Audio player for ringtone preview
let currentAudio: HTMLAudioElement | null = null;
let currentRingtoneId: string | null = null;

interface ToneItem {
  id: string;
  name: string;
  file: string;
}

interface ToneCatalog {
  source?: {
    name?: string;
    license?: string;
    licenseUrl?: string;
    downloadPage?: string;
  };
  categories?: {
    ringtones?: ToneItem[];
    notifications?: ToneItem[];
    messages?: ToneItem[];
  };
}

type SettingsSection = 'main' | 'appearance' | 'sound' | 'security' | 'notifications' | 'system' | 'about';

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

const fallbackCatalog: ToneCatalog = {
  source: {
    name: 'Pixabay Sound Effects',
    license: 'Pixabay Content License',
    licenseUrl: 'https://pixabay.com/service/license-summary/',
    downloadPage: 'https://pixabay.com/sound-effects/',
  },
  categories: {
    ringtones: [
      { id: 'ring.ogg', name: 'Classic Ring', file: '/audio/ringtones/ring.ogg' },
      { id: 'ring2.ogg', name: 'Tone Two', file: '/audio/ringtones/ring2.ogg' },
      { id: 'iphone11.ogg', name: 'iPhone Style', file: '/audio/ringtones/iphone11.ogg' },
    ],
    notifications: [
      { id: 'soft-ping.ogg', name: 'Soft Ping', file: '/audio/notifications/soft-ping.ogg' },
      { id: 'glass.ogg', name: 'Glass', file: '/audio/notifications/glass.ogg' },
      { id: 'orbit.ogg', name: 'Orbit', file: '/audio/notifications/orbit.ogg' },
    ],
    messages: [
      { id: 'pop.ogg', name: 'Pop', file: '/audio/messages/pop.ogg' },
      { id: 'bubble.ogg', name: 'Bubble', file: '/audio/messages/bubble.ogg' },
      { id: 'tap.ogg', name: 'Tap', file: '/audio/messages/tap.ogg' },
    ],
  },
};

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

export function SettingsApp() {
  const router = useRouter();
  const [phoneState, phoneActions] = usePhone();
  const [notifications, notificationsActions] = useNotifications();

  const [section, setSection] = createSignal<SettingsSection>('main');
  const [urlInput, setUrlInput] = createSignal('');
  const [pinStep, setPinStep] = createSignal(1);
  const [pinCode, setPinCode] = createSignal('');
  const [pinConfirm, setPinConfirm] = createSignal('');
  const [status, setStatus] = createSignal<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [toneCatalog, setToneCatalog] = createSignal<ToneCatalog>(fallbackCatalog);
  const [liveLocationEnabled, setLiveLocationEnabled] = createSignal(false);
  const [liveLocationInterval, setLiveLocationInterval] = createSignal<10>(10);
  const [liveLocationStatus, setLiveLocationStatus] = createSignal('');
  const language = () => phoneState.settings.language || 'es';

  usePhoneKeyHandler({
    Backspace: () => {
      if (section() !== 'main') {
        setSection('main');
      } else {
        router.goBack();
      }
    },
  });

  onMount(async () => {
    try {
      const response = await fetch('./audio/catalog.json');
      if (response.ok) {
        const payload = await response.json() as ToneCatalog;
        setToneCatalog({
          source: payload.source || fallbackCatalog.source,
          categories: {
            ringtones: payload.categories?.ringtones?.length ? payload.categories.ringtones : fallbackCatalog.categories?.ringtones,
            notifications: payload.categories?.notifications?.length ? payload.categories.notifications : fallbackCatalog.categories?.notifications,
            messages: payload.categories?.messages?.length ? payload.categories.messages : fallbackCatalog.categories?.messages,
          },
        });
      }
    } catch (_err) {
      setToneCatalog(fallbackCatalog);
    }

    const persisted = window.localStorage.getItem('gcphone:liveLocationInterval');
    if (persisted === '10') setLiveLocationInterval(10);

    const state = await fetchNui<{ success?: boolean; active?: boolean; intervalSeconds?: number }>('getLiveLocationState', {}, { success: false, active: false, intervalSeconds: 10 });
    if (state?.success) {
      setLiveLocationEnabled(Boolean(state.active));
      setLiveLocationInterval(10);
    }
  });

  const updateLiveLocationInterval = async (seconds: 10) => {
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

  const playRingtonePreview = (ringtoneId: string) => {
    const catalog = toneCatalog();
    const items = [
      ...(catalog.categories?.ringtones || []),
      ...(catalog.categories?.notifications || []),
      ...(catalog.categories?.messages || []),
    ];
    const selected = items.find((entry) => entry.id === ringtoneId);
    if (!selected) return;

    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio = null;
    }
    
    if (currentRingtoneId === ringtoneId) {
      currentRingtoneId = null;
      return;
    }
    
    const audio = new Audio(selected.file);
    audio.volume = phoneState.settings.volume;
    audio.play().catch(() => {});
    
    currentAudio = audio;
    currentRingtoneId = ringtoneId;
    
    setTimeout(() => {
      if (currentAudio === audio) {
        audio.pause();
        currentAudio = null;
        currentRingtoneId = null;
      }
    }, 5000);
  };

  // Cell component helper
  const Cell = (props: {
    icon?: string;
    iconBg?: string;
    title: string;
    subtitle?: string;
    right?: 'chevron' | 'switch' | 'value';
    switchValue?: boolean;
    onSwitch?: () => void;
    onClick?: () => void;
    value?: string;
  }) => (
    <button 
      class={styles.cell} 
      classList={{ [styles.pressable]: props.onClick !== undefined }}
      onClick={props.onClick}
    >
      <div class={styles.cellLeft}>
        {props.icon && (
          <div class={`${styles.cellIcon} ${props.iconBg ? styles[props.iconBg] : ''}`}>
            {props.icon}
          </div>
        )}
        <div class={styles.cellText}>
          <div class={styles.cellTitle}>{props.title}</div>
          {props.subtitle && <div class={styles.cellSubtitle}>{props.subtitle}</div>}
        </div>
      </div>
      <div class={styles.cellRight}>
        {props.right === 'value' && props.value && (
          <span class={styles.cellValue}>{props.value}</span>
        )}
        {props.right === 'switch' && (
          <div 
            class={`${styles.switch} ${props.switchValue ? styles.switchActive : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              props.onSwitch?.();
            }}
            role="switch"
            aria-checked={props.switchValue}
          >
            <div class={styles.switchThumb} />
          </div>
        )}
        {props.right === 'chevron' && <div class={styles.chevron} />}
      </div>
    </button>
  );

  // Section header component
  const SectionHeader = (props: { title: string }) => (
    <div class={styles.sectionHeader}>{props.title}</div>
  );

  // Group container
  const Group = (props: { children: any }) => (
    <div class={styles.group}>{props.children}</div>
  );

  // MAIN VIEW
  const renderMain = () => (
    <div class={styles.content}>
      <SectionHeader title="GENERAL" />
      <Group>
        <Cell 
          icon="🎨" 
          iconBg="iconBlue"
          title="Apariencia" 
          subtitle="Fondo, idioma, tema"
          right="chevron"
          onClick={() => setSection('appearance')}
        />
        <Cell 
          icon="🔊" 
          iconBg="iconOrange"
          title="Sonido" 
          subtitle="Volumen, tono, perfil"
          right="chevron"
          onClick={() => setSection('sound')}
        />
        <Cell 
          icon="🔒" 
          iconBg="iconRed"
          title="Seguridad" 
          subtitle="PIN de desbloqueo"
          right="chevron"
          onClick={() => setSection('security')}
        />
      </Group>

      <SectionHeader title="SISTEMA" />
      <Group>
        <Cell 
          icon="🔔" 
          iconBg="iconRed"
          title="Notificaciones" 
          right="chevron"
          onClick={() => setSection('notifications')}
        />
        <Cell 
          icon="📍" 
          iconBg="iconBlue"
          title="Ubicación en tiempo real" 
          subtitle={liveLocationEnabled() ? 'Activo' : 'Inactivo'}
          right="chevron"
          onClick={() => setSection('system')}
        />
        <Cell 
          icon="✈️" 
          iconBg="iconOrange"
          title="Modo avión" 
          right="switch"
          switchValue={notifications.airplaneMode}
          onSwitch={() => notificationsActions.setAirplaneMode(!notifications.airplaneMode)}
        />
        <Cell 
          icon="🌙" 
          iconBg="iconPurple"
          title="No molestar" 
          right="switch"
          switchValue={notifications.doNotDisturb}
          onSwitch={() => notificationsActions.setDoNotDisturb(!notifications.doNotDisturb)}
        />
        <Cell 
          icon="🔇" 
          iconBg="iconGray"
          title="Modo silencio" 
          right="switch"
          switchValue={notifications.silentMode}
          onSwitch={() => notificationsActions.setSilentMode(!notifications.silentMode)}
        />
      </Group>

      <div class={styles.brightnessSection}>
        <div class={styles.brightnessHeader}>
          <span>☀️</span>
          <span>Brillo</span>
          <span class={styles.brightnessValue}>{Math.round(notifications.brightness * 100)}%</span>
        </div>
        <input
          class={styles.slider}
          type="range"
          min="40"
          max="120"
          value={Math.round(notifications.brightness * 100)}
          onInput={(e) => notificationsActions.setBrightness(Number(e.currentTarget.value) / 100)}
        />
      </div>

      <SectionHeader title="INFORMACIÓN" />
      <Group>
        <Cell 
          icon="ℹ️" 
          iconBg="iconGreen"
          title="Acerca de GCPhone" 
          right="chevron"
          onClick={() => setSection('about')}
        />
      </Group>
    </div>
  );

  // APPEARANCE VIEW
  const renderAppearance = () => (
    <div class={styles.content}>
      <SectionHeader title="FONDO DE PANTALLA" />
      <Group>
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
      </Group>

      <div class={styles.quickActions}>
        <button class={styles.actionBtn} onClick={() => fetchNui('openGallery', { selectWallpaper: true })}>
          📷 Galería
        </button>
        <button class={styles.actionBtn} onClick={randomWallpaper}>
          🎲 Aleatorio
        </button>
      </div>

      <div class={styles.customUrl}>
        <input
          type="url"
          placeholder="https://example.com/wallpaper.jpg"
          value={urlInput()}
          onInput={(e) => setUrlInput(e.currentTarget.value)}
        />
        <button onClick={applyUrlWallpaper}>Aplicar</button>
      </div>

      <SectionHeader title="IDIOMA" />
      <Group>
        <For each={languages}>
          {(lang) => (
            <button
              class={styles.langOption}
              classList={{ [styles.selected]: language() === lang.code }}
              onClick={() => phoneActions.setLanguage(lang.code as 'es' | 'en' | 'pt' | 'fr')}
            >
              <span class={styles.langFlag}>{lang.flag}</span>
              <span class={styles.langName}>{lang.name}</span>
              {language() === lang.code && <div class={styles.checkmark}>✓</div>}
            </button>
          )}
        </For>
      </Group>
    </div>
  );

  // SOUND VIEW
  const renderSound = () => (
    <div class={styles.content}>
      <SectionHeader title="VOLUMEN" />
      <div class={styles.volumeSection}>
        <div class={styles.volumeLabels}>
          <span>🔇</span>
          <span>{Math.round(phoneState.settings.volume * 100)}%</span>
          <span>🔊</span>
        </div>
        <input
          class={styles.slider}
          type="range"
          min="0"
          max="100"
          value={Math.round(phoneState.settings.volume * 100)}
          onInput={(e) => phoneActions.setVolume(Number(e.currentTarget.value) / 100)}
        />
      </div>

      <SectionHeader title="PERFIL DE AUDIO" />
      <Group>
        <For each={audioProfiles}>
          {(profile) => (
            <button
              class={styles.profileOption}
              classList={{ [styles.selected]: phoneState.settings.audioProfile === profile.id }}
              onClick={() => phoneActions.setAudioProfile(profile.id as 'normal' | 'street' | 'vehicle' | 'silent')}
            >
              <span class={styles.profileIcon}>{profile.icon}</span>
              <div class={styles.profileInfo}>
                <div class={styles.profileName}>{profile.name}</div>
                <div class={styles.profileDesc}>{profile.desc}</div>
              </div>
              {phoneState.settings.audioProfile === profile.id && <div class={styles.checkmark}>✓</div>}
            </button>
          )}
        </For>
      </Group>

      <SectionHeader title="TONOS" />
      <div class={styles.customUrl}>
        <div style={{ width: '100%' }}>
          <div style={{ 'font-weight': '700', 'font-size': '13px', color: '#111827', 'margin-bottom': '4px' }}>
            Biblioteca publica
          </div>
          <div style={{ 'font-size': '12px', color: '#6b7280', 'line-height': '1.45' }}>
            Fuente recomendada: {toneCatalog().source?.name || 'Pixabay Sound Effects'} - licencia {toneCatalog().source?.license || 'royalty-free'}.
          </div>
        </div>
        <button onClick={() => window.open(toneCatalog().source?.downloadPage || 'https://pixabay.com/sound-effects/', '_blank')}>Descargar</button>
      </div>

      <SectionHeader title="TONO DE LLAMADA" />
      <Group>
        <For each={toneCatalog().categories?.ringtones || []}>
          {(ringtone) => (
            <div class={styles.ringtoneItem}>
              <div class={styles.ringtoneLeft}>
                <div class={styles.ringtoneIcon}>🔔</div>
                <span class={styles.ringtoneName}>{ringtone.name}</span>
              </div>
              <div class={styles.ringtoneActions}>
                <button
                  class={styles.previewBtn}
                  onClick={() => playRingtonePreview(ringtone.id)}
                  title="Escuchar"
                >
                  {currentRingtoneId === ringtone.id ? '⏹️' : '▶️'}
                </button>
                <button
                  class={`${styles.selectBtn} ${(phoneState.settings.callRingtone || phoneState.settings.ringtone) === ringtone.id ? styles.selected : ''}`}
                  onClick={() => phoneActions.setCallRingtone(ringtone.id)}
                >
                  {(phoneState.settings.callRingtone || phoneState.settings.ringtone) === ringtone.id ? '✓' : 'Seleccionar'}
                </button>
              </div>
            </div>
          )}
        </For>
      </Group>

      <SectionHeader title="TONO DE NOTIFICACIONES" />
      <Group>
        <For each={toneCatalog().categories?.notifications || []}>
          {(tone) => (
            <div class={styles.ringtoneItem}>
              <div class={styles.ringtoneLeft}>
                <div class={styles.ringtoneIcon}>🔔</div>
                <span class={styles.ringtoneName}>{tone.name}</span>
              </div>
              <div class={styles.ringtoneActions}>
                <button class={styles.previewBtn} onClick={() => playRingtonePreview(tone.id)} title="Escuchar">
                  {currentRingtoneId === tone.id ? '⏹️' : '▶️'}
                </button>
                <button
                  class={`${styles.selectBtn} ${phoneState.settings.notificationTone === tone.id ? styles.selected : ''}`}
                  onClick={() => phoneActions.setNotificationTone(tone.id)}
                >
                  {phoneState.settings.notificationTone === tone.id ? '✓' : 'Seleccionar'}
                </button>
              </div>
            </div>
          )}
        </For>
      </Group>

      <SectionHeader title="TONO DE MENSAJES" />
      <Group>
        <For each={toneCatalog().categories?.messages || []}>
          {(tone) => (
            <div class={styles.ringtoneItem}>
              <div class={styles.ringtoneLeft}>
                <div class={styles.ringtoneIcon}>💬</div>
                <span class={styles.ringtoneName}>{tone.name}</span>
              </div>
              <div class={styles.ringtoneActions}>
                <button class={styles.previewBtn} onClick={() => playRingtonePreview(tone.id)} title="Escuchar">
                  {currentRingtoneId === tone.id ? '⏹️' : '▶️'}
                </button>
                <button
                  class={`${styles.selectBtn} ${phoneState.settings.messageTone === tone.id ? styles.selected : ''}`}
                  onClick={() => phoneActions.setMessageTone(tone.id)}
                >
                  {phoneState.settings.messageTone === tone.id ? '✓' : 'Seleccionar'}
                </button>
              </div>
            </div>
          )}
        </For>
      </Group>
    </div>
  );

  // SECURITY VIEW
  const renderSecurity = () => (
    <div class={styles.content}>
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
  );

  // NOTIFICATIONS VIEW
  const renderNotifications = () => (
    <div class={styles.content}>
      <SectionHeader title="APPS" />
      <Group>
        <For each={APP_DEFINITIONS.filter((app) => phoneState.enabledApps.includes(app.id))}>
          {(app) => {
            const unreadCount = notificationsActions.getUnreadCount(app.id);
            return (
              <div class={styles.appRow}>
                <div class={styles.appIcon}>
                  <img src={app.icon} alt={appName(app.id, app.name, language())} />
                </div>
                <div class={styles.appInfo}>
                  <div class={styles.appName}>{appName(app.id, app.name, language())}</div>
                  <div class={styles.appStatus}>{unreadCount > 0 ? `${unreadCount} sin leer` : 'Al día'}</div>
                </div>
                {unreadCount > 0 ? (
                  <div class={styles.badge}>{unreadCount}</div>
                ) : (
                  <div class={styles.okIcon}>✓</div>
                )}
              </div>
            );
          }}
        </For>
      </Group>

      <button
        class={styles.clearBtn}
        onClick={() => {
          for (const app of APP_DEFINITIONS) {
            notificationsActions.markAppAsRead(app.id);
          }
        }}
      >
        Marcar todas como leídas
      </button>
    </div>
  );

  // SYSTEM VIEW
  const renderSystem = () => (
    <div class={styles.content}>
      <SectionHeader title="UBICACIÓN EN TIEMPO REAL" />
      <Group>
        <div class={styles.locationRow}>
          <div class={styles.locationLeft}>
            <div class={`${styles.cellIcon} ${styles.iconBlue}`}>📍</div>
            <div>
              <div class={styles.cellTitle}>Compartir ubicación</div>
              <div class={styles.cellSubtitle}>{liveLocationEnabled() ? 'Activo' : 'Inactivo'}</div>
            </div>
          </div>
          <div 
            class={`${styles.switch} ${liveLocationEnabled() ? styles.switchActive : ''}`}
            onClick={() => void toggleLiveLocation()}
            role="switch"
            aria-checked={liveLocationEnabled()}
          >
            <div class={styles.switchThumb} />
          </div>
        </div>
      </Group>

      <Show when={liveLocationEnabled()}>
        <div class={styles.freqRow}>
          <button class={styles.freqBtn} onClick={() => void updateLiveLocationInterval(10)}>Cada 10s (fijo)</button>
        </div>
      </Show>

      <Show when={liveLocationStatus()}>
        <div class={`${styles.statusMsg} ${liveLocationEnabled() ? styles.success : styles.error}`}>
          {liveLocationStatus()}
        </div>
      </Show>
    </div>
  );

  // ABOUT VIEW
  const renderAbout = () => (
    <div class={styles.content}>
      <div class={styles.aboutHeader}>
        <div class={styles.aboutIcon}>📱</div>
        <div class={styles.aboutName}>GCPhone Next</div>
        <div class={styles.aboutVersion}>Versión 2.1.0</div>
      </div>

      <Group>
        <div class={styles.infoRow}>
          <span class={styles.infoLabel}>Número</span>
          <span class={styles.infoValue}>{phoneState.settings.phoneNumber || 'No asignado'}</span>
        </div>
        <div class={styles.infoRow}>
          <span class={styles.infoLabel}>Framework</span>
          <span class={styles.infoValue}>GCPhone Next</span>
        </div>
        <div class={styles.infoRow}>
          <span class={styles.infoLabel}>Plataforma</span>
          <span class={styles.infoValue}>FiveM</span>
        </div>
      </Group>
    </div>
  );

  const getTitle = () => {
    switch (section()) {
      case 'appearance': return 'Apariencia';
      case 'sound': return 'Sonido';
      case 'security': return 'Seguridad';
      case 'notifications': return 'Notificaciones';
      case 'system': return 'Sistema';
      case 'about': return 'Acerca de';
      default: return t('settings.title', language());
    }
  };

  return (
    <AppScaffold
      title={getTitle()}
      subtitle={undefined}
      onBack={() => section() !== 'main' ? setSection('main') : router.goBack()}
      bodyClass={`${styles.app} ${styles.settingsCanvas}`}
      bodyPadding="none"
    >
      <Switch>
        <Match when={section() === 'main'}>{renderMain()}</Match>
        <Match when={section() === 'appearance'}>{renderAppearance()}</Match>
        <Match when={section() === 'sound'}>{renderSound()}</Match>
        <Match when={section() === 'security'}>{renderSecurity()}</Match>
        <Match when={section() === 'notifications'}>{renderNotifications()}</Match>
        <Match when={section() === 'system'}>{renderSystem()}</Match>
        <Match when={section() === 'about'}>{renderAbout()}</Match>
      </Switch>
    </AppScaffold>
  );
}
