import { For, Show, batch, createEffect, createSignal, onCleanup } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { usePhone } from '../../../store/phone';
import { useNotifications } from '../../../store/notifications';
import { fetchNui } from '../../../utils/fetchNui';
import { APP_DEFINITIONS } from '../../../config/apps';
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

  createEffect(() => {
    const onKey = (e: CustomEvent<string>) => {
      if (e.detail === 'Backspace') router.goBack();
    };
    window.addEventListener('phone:keyUp', onKey as EventListener);
    onCleanup(() => window.removeEventListener('phone:keyUp', onKey as EventListener));
  });

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
    <div class="ios-page">
      <div class="ios-nav">
        <button class="ios-icon-btn k-touch-ripple" onClick={() => router.goBack()}>‹</button>
        <div class="ios-nav-title">Ajustes</div>
      </div>

      <div class="ios-content">
        <div class="ios-segment">
          <button class="ios-segment-btn" classList={{ 'ios-segment-btn-active': tab() === 'appearance' }} onClick={() => setTab('appearance')}>Apariencia</button>
          <button class="ios-segment-btn" classList={{ 'ios-segment-btn-active': tab() === 'sound' }} onClick={() => setTab('sound')}>Sonido</button>
          <button class="ios-segment-btn" classList={{ 'ios-segment-btn-active': tab() === 'security' }} onClick={() => setTab('security')}>Seguridad</button>
          <button class="ios-segment-btn" classList={{ 'ios-segment-btn-active': tab() === 'advanced' }} onClick={() => setTab('advanced')}>Avanzado</button>
        </div>

        <Show when={tab() === 'appearance'}>
          <div class="ios-section-title">Fondos</div>
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

          <div class="ios-section-title">Fuente de fondo</div>
          <div class="ios-list">
            <div class="ios-row">
              <span class="ios-label">Desde galeria</span>
              <button class="ios-btn ios-btn-primary" onClick={() => fetchNui('openGallery', { selectWallpaper: true })}>Elegir</button>
            </div>
            <div class="ios-row">
              <span class="ios-label">Aleatorio API</span>
              <button class="ios-btn" onClick={randomWallpaper}>Aplicar</button>
            </div>
          </div>

          <div class="ios-section-title">URL manual</div>
          <div class={`ios-card ${styles.inlineForm}`}>
            <input class="ios-input" type="url" placeholder="https://example.com/wallpaper.jpg" value={urlInput()} onInput={(e) => setUrlInput(e.currentTarget.value)} />
            <button class="ios-btn ios-btn-primary" onClick={applyUrlWallpaper}>Aplicar</button>
          </div>

          <div class="ios-section-title">Marco del telefono</div>
          <div class={`ios-card ${styles.inlineForm}`}>
            <select class="ios-select" value={phoneState.settings.coque} onChange={(e) => phoneActions.setCoque(e.currentTarget.value)}>
              <For each={coques}>{(coque) => <option value={coque}>{coque}</option>}</For>
            </select>
          </div>

          <div class="ios-section-title">Tema</div>
          <div class="ios-list">
            <SettingToggle
              label="Modo oscuro"
              active={phoneState.settings.theme === 'dark'}
              onClick={() => phoneActions.setTheme(phoneState.settings.theme === 'dark' ? 'light' : 'dark')}
            />
          </div>
        </Show>

        <Show when={tab() === 'sound'}>
          <div class="ios-section-title">Volumen</div>
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

          <div class="ios-section-title">Tono</div>
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

          <div class="ios-section-title">Musica</div>
          <div class="ios-list">
            <div class="ios-row">
              <span class="ios-label">Volumen multimedia</span>
              <button class="ios-btn" onClick={() => phoneActions.setVolume(Math.max(0, phoneState.settings.volume - 0.1))}>-</button>
              <span class="ios-value">{Math.round(phoneState.settings.volume * 100)}%</span>
              <button class="ios-btn" onClick={() => phoneActions.setVolume(Math.min(1, phoneState.settings.volume + 0.1))}>+</button>
            </div>
          </div>
        </Show>

        <Show when={tab() === 'security'}>
          <div class="ios-section-title">Bloqueo por PIN</div>
          <div class={`ios-card ${styles.pinCard}`}>
            <input class="ios-input" type="password" maxlength="4" placeholder="Nuevo PIN (4 digitos)" value={codeA()} onInput={(e) => setCodeA(e.currentTarget.value)} />
            <input class="ios-input" type="password" maxlength="4" placeholder="Confirmar PIN" value={codeB()} onInput={(e) => setCodeB(e.currentTarget.value)} />
            <button class="ios-btn ios-btn-primary" onClick={savePin}>Guardar PIN</button>
            <Show when={status()}>
              {(msg) => <div class={msg().type === 'ok' ? styles.ok : styles.error}>{msg().text}</div>}
            </Show>
          </div>
        </Show>

        <Show when={tab() === 'advanced'}>
          <div class="ios-section-title">Notificaciones por App</div>
          <div class={`ios-card ${styles.notificationCard}`}>
            <For each={APP_DEFINITIONS}>
              {(app) => {
                const unreadCount = notificationsActions.getUnreadCount(app.id);
                return (
                  <div class={styles.notificationRow}>
                    <img src={app.icon} alt={app.name} class={styles.notificationIcon} />
                    <span class={styles.notificationName}>{app.name}</span>
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

          <div class="ios-section-title">Sistema</div>
          <div class="ios-list">
            <div class="ios-row">
              <span class="ios-label">Gestos superior noti/control</span>
              <span class="ios-value">Desactivado</span>
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
                onInput={(e) => notificationsActions.setBrightness(Number(e.currentTarget.value) / 100)}
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
                onInput={(e) => phoneActions.setVolume(Number(e.currentTarget.value) / 100)}
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
