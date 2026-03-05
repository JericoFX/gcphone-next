import { For, Show, batch, createEffect, createSignal, onCleanup, onMount } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { usePhone } from '../../../store/phone';
import { useNotifications } from '../../../store/notifications';
import { fetchNui } from '../../../utils/fetchNui';
import { APP_DEFINITIONS } from '../../../config/apps';
import { appName, t } from '../../../i18n';
import styles from './SettingsApp.module.scss';

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

const coques = ['funda_azul.png', 'funda_roja.png', 'funda_negra.png'];

const ringtones = [
  { id: 'ring.ogg', name: 'Classic Ring' },
  { id: 'ring2.ogg', name: 'Tone Two' },
  { id: 'iphone11.ogg', name: 'iPhone Style' },
  { id: 'casa_papel.ogg', name: 'Casa de Papel' },
  { id: 'bella_ciao.ogg', name: 'Bella Ciao' },
];

export function SettingsApp() {
  const router = useRouter();
  const [phoneState, phoneActions] = usePhone();
  const [notifications, notificationsActions] = useNotifications();

  const [tab, setTab] = createSignal<SettingsTab>('appearance');
  const [urlInput, setUrlInput] = createSignal('');
  const [codeA, setCodeA] = createSignal('');
  const [codeB, setCodeB] = createSignal('');
  const [status, setStatus] = createSignal<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [haptics, setHaptics] = createSignal(true);
  const [animations, setAnimations] = createSignal(true);
  const [liveLocationEnabled, setLiveLocationEnabled] = createSignal(false);
  const [liveLocationInterval, setLiveLocationInterval] = createSignal<5 | 10>(10);
  const [liveLocationStatus, setLiveLocationStatus] = createSignal('');
  const language = () => phoneState.settings.language || 'es';

  createEffect(() => {
    const onKey = (e: CustomEvent<string>) => {
      if (e.detail === 'Backspace') router.goBack();
    };
    window.addEventListener('phone:keyUp', onKey as EventListener);
    onCleanup(() => window.removeEventListener('phone:keyUp', onKey as EventListener));
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
        setLiveLocationStatus('Ubicacion activa desactivada.');
      }
      return;
    }

    const contacts = await fetchNui<Array<{ number: string }>>('getContacts', {}, []);
    const recipients = (contacts || [])
      .map((row) => String(row?.number || '').trim())
      .filter((value) => value.length > 0);

    if (recipients.length === 0) {
      setLiveLocationStatus('No tienes contactos para compartir.');
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
      setLiveLocationStatus(`Ubicacion activa habilitada cada ${liveLocationInterval()}s.`);
      return;
    }

    setLiveLocationStatus(response?.error || 'No se pudo activar ubicacion activa.');
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

  const savePin = () => {
    const a = codeA().trim();
    const b = codeB().trim();

    if (!/^\d{4}$/.test(a)) {
      setStatus({ type: 'error', text: 'El PIN debe tener 4 digitos' });
      return;
    }

    if (a !== b) {
      setStatus({ type: 'error', text: 'Los PIN no coinciden' });
      return;
    }

    phoneActions.setLockCode(a);
    batch(() => {
      setCodeA('');
      setCodeB('');
      setStatus({ type: 'ok', text: 'PIN actualizado correctamente' });
    });
  };

  const SettingToggle = (props: { label: string; active: boolean; onClick: () => void }) => (
    <div class="ios-row">
      <span class="ios-label">{props.label}</span>
      <button class="ios18-switch" role="switch" aria-checked={props.active ? 'true' : 'false'} onClick={props.onClick}>
        <span class="ios18-switch__thumb" />
      </button>
    </div>
  );

  return (
    <div class={`ios-page ${styles.app}`}>
      <div class="ios-nav">
        <button class="ios-icon-btn k-touch-ripple" onClick={() => router.goBack()}>‹</button>
        <div class="ios-nav-title">{t('settings.title', language())}</div>
      </div>

      <div class={`ios-content ${styles.settingsCanvas}`}>
        <div class={`ios-segment ${styles.settingsTabs}`}>
          <button class="ios-segment-btn" classList={{ 'ios-segment-btn-active': tab() === 'appearance' }} onClick={() => setTab('appearance')}>{t('settings.tab.appearance', language())}</button>
          <button class="ios-segment-btn" classList={{ 'ios-segment-btn-active': tab() === 'sound' }} onClick={() => setTab('sound')}>{t('settings.tab.sound', language())}</button>
          <button class="ios-segment-btn" classList={{ 'ios-segment-btn-active': tab() === 'security' }} onClick={() => setTab('security')}>{t('settings.tab.security', language())}</button>
          <button class="ios-segment-btn" classList={{ 'ios-segment-btn-active': tab() === 'advanced' }} onClick={() => setTab('advanced')}>{t('settings.tab.advanced', language())}</button>
        </div>

        <Show when={tab() === 'appearance'}>
          <div class="ios-section-title">{t('settings.wallpapers', language())}</div>
          <div class={`ios-card ${styles.wallpaperCard}`}>
            <div class="ios-grid-3">
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
          </div>

          <div class="ios-section-title">{t('settings.wallpaper_source', language())}</div>
          <div class="ios-list">
            <div class="ios-row">
              <span class="ios-label">{t('settings.from_gallery', language())}</span>
              <button class="ios-btn ios-btn-primary" onClick={() => fetchNui('openGallery', { selectWallpaper: true })}>{t('settings.choose', language())}</button>
            </div>
            <div class="ios-row">
              <span class="ios-label">{t('settings.random_api', language())}</span>
              <button class="ios-btn" onClick={randomWallpaper}>{t('settings.apply', language())}</button>
            </div>
          </div>

          <div class="ios-section-title">{t('settings.manual_url', language())}</div>
          <div class={`ios-card ${styles.inlineForm}`}>
            <input class="ios-input" type="url" placeholder="https://example.com/wallpaper.jpg" value={urlInput()} onInput={(e) => setUrlInput(e.currentTarget.value)} />
            <button class="ios-btn ios-btn-primary" onClick={applyUrlWallpaper}>{t('settings.apply', language())}</button>
          </div>

          <div class="ios-section-title">{t('settings.frame', language())}</div>
          <div class={`ios-card ${styles.inlineForm}`}>
            <select class="ios-select" value={phoneState.settings.coque} onChange={(e) => phoneActions.setCoque(e.currentTarget.value)}>
              <For each={coques}>{(coque) => <option value={coque}>{coque}</option>}</For>
            </select>
          </div>

          <div class="ios-section-title">{t('settings.theme', language())}</div>
          <div class="ios-list">
            <div class="ios-row">
              <span class="ios-label">{t('settings.appearance', language())}</span>
              <div class="ios-segment">
                <button
                  class="ios-segment-btn"
                  classList={{ 'ios-segment-btn-active': phoneState.settings.theme === 'auto' }}
                  onClick={() => phoneActions.setTheme('auto')}
                >
                  Auto
                </button>
                <button
                  class="ios-segment-btn"
                  classList={{ 'ios-segment-btn-active': phoneState.settings.theme === 'light' }}
                  onClick={() => phoneActions.setTheme('light')}
                >
                  Claro
                </button>
                <button
                  class="ios-segment-btn"
                  classList={{ 'ios-segment-btn-active': phoneState.settings.theme === 'dark' }}
                  onClick={() => phoneActions.setTheme('dark')}
                >
                  Oscuro
                </button>
              </div>
            </div>
            <div class="ios-row">
              <span class="ios-label">{t('settings.language', language())}</span>
              <div class="ios-segment">
                <button
                  class="ios-segment-btn"
                  classList={{ 'ios-segment-btn-active': (phoneState.settings.language || 'es') === 'es' }}
                  onClick={() => phoneActions.setLanguage('es')}
                >
                  ES
                </button>
                <button
                  class="ios-segment-btn"
                  classList={{ 'ios-segment-btn-active': (phoneState.settings.language || 'es') === 'en' }}
                  onClick={() => phoneActions.setLanguage('en')}
                >
                  EN
                </button>
                <button
                  class="ios-segment-btn"
                  classList={{ 'ios-segment-btn-active': (phoneState.settings.language || 'es') === 'pt' }}
                  onClick={() => phoneActions.setLanguage('pt')}
                >
                  PT
                </button>
                <button
                  class="ios-segment-btn"
                  classList={{ 'ios-segment-btn-active': (phoneState.settings.language || 'es') === 'fr' }}
                  onClick={() => phoneActions.setLanguage('fr')}
                >
                  FR
                </button>
              </div>
            </div>
          </div>
        </Show>

        <Show when={tab() === 'sound'}>
          <div class="ios-section-title">{t('settings.volume', language())}</div>
          <div class={`ios-card ${styles.inlineForm}`}>
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(phoneState.settings.volume * 100)}
              onInput={(e) => phoneActions.setVolume(Number(e.currentTarget.value) / 100)}
            />
            <span class="ios-chip">{Math.round(phoneState.settings.volume * 100)}%</span>
          </div>

          <div class="ios-section-title">{t('settings.audio_profile', language())}</div>
          <div class="ios-list">
            <div class="ios-row">
              <span class="ios-label">{t('settings.context', language())}</span>
              <div class="ios-segment">
                <button
                  class="ios-segment-btn"
                  classList={{ 'ios-segment-btn-active': (phoneState.settings.audioProfile || 'normal') === 'normal' }}
                  onClick={() => phoneActions.setAudioProfile('normal')}
                >
                  Normal
                </button>
                <button
                  class="ios-segment-btn"
                  classList={{ 'ios-segment-btn-active': (phoneState.settings.audioProfile || 'normal') === 'street' }}
                  onClick={() => phoneActions.setAudioProfile('street')}
                >
                  Calle
                </button>
                <button
                  class="ios-segment-btn"
                  classList={{ 'ios-segment-btn-active': (phoneState.settings.audioProfile || 'normal') === 'vehicle' }}
                  onClick={() => phoneActions.setAudioProfile('vehicle')}
                >
                  Vehiculo
                </button>
                <button
                  class="ios-segment-btn"
                  classList={{ 'ios-segment-btn-active': (phoneState.settings.audioProfile || 'normal') === 'silent' }}
                  onClick={() => phoneActions.setAudioProfile('silent')}
                >
                  Silencio
                </button>
              </div>
            </div>
          </div>

          <div class="ios-section-title">{t('settings.ringtone', language())}</div>
          <div class="ios-list">
            <For each={ringtones}>
              {(ringtone) => (
                <div class="ios-row">
                  <span class="ios-label">{ringtone.name}</span>
                  <button
                    class="ios-btn"
                    classList={{ 'ios-btn-primary': phoneState.settings.ringtone === ringtone.id }}
                    onClick={() => phoneActions.setRingtone(ringtone.id)}
                  >
                    {phoneState.settings.ringtone === ringtone.id ? 'Activo' : 'Usar'}
                  </button>
                </div>
              )}
            </For>
          </div>
        </Show>

        <Show when={tab() === 'security'}>
          <div class="ios-section-title">{t('settings.pin_lock', language())}</div>
          <div class={`ios-card ${styles.pinCard}`}>
            <input class="ios-input" type="password" maxlength="4" placeholder={t('settings.new_pin', language())} value={codeA()} onInput={(e) => setCodeA(e.currentTarget.value)} />
            <input class="ios-input" type="password" maxlength="4" placeholder={t('settings.confirm_pin', language())} value={codeB()} onInput={(e) => setCodeB(e.currentTarget.value)} />
            <button class="ios-btn ios-btn-primary" onClick={savePin}>{t('settings.save_pin', language())}</button>
            <Show when={status()}>
              {(msg) => <div class={msg().type === 'ok' ? styles.ok : styles.error}>{msg().text}</div>}
            </Show>
          </div>
        </Show>

        <Show when={tab() === 'advanced'}>
          <div class="ios-section-title">{t('settings.app_notifications', language())}</div>
          <div class={`ios-card ${styles.notificationCard}`}>
            <For each={APP_DEFINITIONS.filter((app) => phoneState.enabledApps.includes(app.id))}>
              {(app) => {
                const unreadCount = notificationsActions.getUnreadCount(app.id);
                return (
                  <div class={styles.notificationRow}>
                    <img src={app.icon} alt={appName(app.id, app.name, language())} class={styles.notificationIcon} />
                    <span class={styles.notificationName}>{appName(app.id, app.name, language())}</span>
                    <Show when={unreadCount > 0}>
                      <span class={styles.notificationBadge}>{unreadCount}</span>
                    </Show>
                    <Show when={unreadCount === 0}>
                      <span class={styles.notificationOk}>✓</span>
                    </Show>
                  </div>
                );
              }}
            </For>
            <button 
              class={`ios-btn ${styles.clearAllBtn}`}
              onClick={() => {
                for (const app of APP_DEFINITIONS) {
                  notificationsActions.markAppAsRead(app.id);
                }
              }}
            >
              Marcar todas como leidas
            </button>
          </div>

          <div class="ios-section-title">{t('settings.system', language())}</div>
          <div class="ios-list">
            <div class="ios-row">
              <span class="ios-label">Compartir ubicacion activa</span>
              <button class="ios-btn" classList={{ 'ios-btn-primary': liveLocationEnabled() }} onClick={() => void toggleLiveLocation()}>
                {liveLocationEnabled() ? 'Activo' : 'Inactivo'}
              </button>
            </div>
            <div class={`ios-row ${styles.liveLocationRow}`}>
              <span class="ios-label">Frecuencia</span>
              <div class="ios-segment">
                <button class="ios-segment-btn" classList={{ 'ios-segment-btn-active': liveLocationInterval() === 5 }} onClick={() => void updateLiveLocationInterval(5)}>
                  5s
                </button>
                <button class="ios-segment-btn" classList={{ 'ios-segment-btn-active': liveLocationInterval() === 10 }} onClick={() => void updateLiveLocationInterval(10)}>
                  10s
                </button>
              </div>
            </div>
            <Show when={liveLocationStatus()}>
              <div class={`ios-row ${styles.liveLocationStatus}`}>{liveLocationStatus()}</div>
            </Show>
            <div class="ios-row">
              <span class="ios-label">Zona drag superior</span>
              <span class="ios-value">Minima</span>
            </div>
            <SettingToggle label="Modo avion" active={notifications.airplaneMode} onClick={() => notificationsActions.setAirplaneMode(!notifications.airplaneMode)} />
            <SettingToggle label="No molestar" active={notifications.doNotDisturb} onClick={() => notificationsActions.setDoNotDisturb(!notifications.doNotDisturb)} />
            <SettingToggle label="Datos moviles" active={notifications.mobileData} onClick={() => notificationsActions.setMobileData(!notifications.mobileData)} />
            <SettingToggle label="Modo silencio" active={notifications.silentMode} onClick={() => notificationsActions.setSilentMode(!notifications.silentMode)} />
            <SettingToggle label="Bloqueo de rotacion" active={notifications.rotationLock} onClick={() => notificationsActions.setRotationLock(!notifications.rotationLock)} />
            <div class="ios-row">
              <span class="ios-label">Brillo</span>
              <input
                class="ios-slider"
                type="range"
                min="40"
                max="120"
                value={Math.round(notifications.brightness * 100)}
                style={{ '--value-percent': `${((Math.round(notifications.brightness * 100) - 40) / (120 - 40)) * 100}%` }}
                onInput={(e) => {
                  const val = Number(e.currentTarget.value);
                  e.currentTarget.style.setProperty('--value-percent', `${((val - 40) / (120 - 40)) * 100}%`);
                  notificationsActions.setBrightness(val / 100);
                }}
              />
              <span class="ios-value">{Math.round(notifications.brightness * 100)}%</span>
            </div>
            <div class="ios-row">
              <span class="ios-label">Volumen</span>
              <input
                class="ios-slider"
                type="range"
                min="0"
                max="100"
                value={Math.round(phoneState.settings.volume * 100)}
                style={{ '--value-percent': `${Math.round(phoneState.settings.volume * 100)}%` }}
                onInput={(e) => {
                  const val = Number(e.currentTarget.value);
                  e.currentTarget.style.setProperty('--value-percent', `${val}%`);
                  phoneActions.setVolume(val / 100);
                }}
              />
              <span class="ios-value">{Math.round(phoneState.settings.volume * 100)}%</span>
            </div>
          </div>

          <div class="ios-section-title">Telefono</div>
          <div class="ios-list">
            <div class="ios-row">
              <span class="ios-label">Numero</span>
              <span class="ios-value">{phoneState.settings.phoneNumber || 'No asignado'}</span>
            </div>
            <div class="ios-row">
              <span class="ios-label">Version</span>
              <span class="ios-value">2.1.0</span>
            </div>
            <div class="ios-row">
              <span class="ios-label">Framework visual</span>
              <span class="ios-value">Konsta-inspired iOS (MIT)</span>
            </div>
            <div class="ios-row">
              <span class="ios-label">Animaciones UI</span>
              <button class="ios-btn" classList={{ 'ios-btn-primary': animations() }} onClick={() => setAnimations((v) => !v)}>
                {animations() ? 'Activo' : 'Inactivo'}
              </button>
            </div>
            <div class="ios-row">
              <span class="ios-label">Haptics</span>
              <button class="ios-btn" classList={{ 'ios-btn-primary': haptics() }} onClick={() => setHaptics((v) => !v)}>
                {haptics() ? 'Activo' : 'Inactivo'}
              </button>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}
