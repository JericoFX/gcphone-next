import { For, Show, createSignal, onCleanup, onMount, Switch, Match } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { usePhone } from '../../../store/phone';
import { useNotifications } from '../../../store/notifications';
import { fetchNui } from '../../../utils/fetchNui';
import { APP_DEFINITIONS } from '../../../config/apps';
import { usePhoneKeyHandler } from '../../../hooks/usePhoneKeyHandler';
import { AppScaffold } from '../../shared/layout';
import { InlineNotice } from '../../shared/ui/InlineNotice';
import { SectionGroup, SectionHeader } from '../../shared/ui/SectionBlock';
import { appName, t } from '../../../i18n';
import { uiConfirm } from '../../../utils/uiDialog';
import { formatPhoneNumber } from '../../../utils/misc';
import { FALLBACK_AUDIO_CATALOG, type PhoneToneCatalog, type ToneCategory } from '../../../utils/phoneAudio';
import styles from './SettingsApp.module.scss';

type SettingsSection = 'main' | 'appearance' | 'sound' | 'security' | 'notifications' | 'system' | 'about';
type SecurityFlow = 'idle' | 'disable-lock' | 'change-verify' | 'change-new' | 'change-confirm';
const PIN_LENGTH = 4;

const ICONS = {
  appearance: './img/icons_ios/ui-palette.svg',
  sound: './img/icons_ios/speaker.svg',
  security: './img/icons_ios/ui-lock.svg',
  notifications: './img/icons_ios/ui-bell.svg',
  location: './img/icons_ios/ui-location.svg',
  airplane: './img/icons_ios/ui-plane.svg',
  moon: './img/icons_ios/ui-moon.svg',
  mute: './img/icons_ios/speaker-off.svg',
  info: './img/icons_ios/ui-info.svg',
  brightness: './img/icons_ios/ui-sun.svg',
  gallery: './img/icons_ios/gallery.svg',
  shuffle: './img/icons_ios/ui-shuffle.svg',
  normal: './img/icons_ios/speaker.svg',
  street: './img/icons_ios/ui-city.svg',
  vehicle: './img/icons_ios/car.svg',
  silent: './img/icons_ios/speaker-off.svg',
  ringtone: './img/icons_ios/ui-bell.svg',
  message: './img/icons_ios/ui-chat.svg',
  trash: './img/icons_ios/ui-trash.svg',
  check: './img/icons_ios/ui-check.svg',
  play: './img/icons_ios/ui-play.svg',
  stop: './img/icons_ios/ui-stop.svg',
  backspace: './img/icons_ios/ui-backspace.svg',
  appIcon: './img/icons_ios/settings.svg',
} as const;

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

const languages = [
  { code: 'es', name: 'Español', label: 'ES' },
  { code: 'en', name: 'English', label: 'EN' },
  { code: 'pt', name: 'Português', label: 'PT' },
  { code: 'fr', name: 'Français', label: 'FR' },
];

const audioProfiles = [
  { id: 'normal', name: 'Normal', desc: 'Uso general', icon: ICONS.normal },
  { id: 'street', name: 'Calle', desc: 'Exterior ruidoso', icon: ICONS.street },
  { id: 'vehicle', name: 'Vehículo', desc: 'En movimiento', icon: ICONS.vehicle },
  { id: 'silent', name: 'Silencio', desc: 'Sin sonido', icon: ICONS.silent },
];

export function SettingsApp() {
  const router = useRouter();
  const [phoneState, phoneActions] = usePhone();
  const [notifications, notificationsActions] = useNotifications();

  const [section, setSection] = createSignal<SettingsSection>('main');
  const [urlInput, setUrlInput] = createSignal('');
  const [securityFlow, setSecurityFlow] = createSignal<SecurityFlow>('idle');
  const [pinCode, setPinCode] = createSignal('');
  const [pinConfirm, setPinConfirm] = createSignal('');
  const [status, setStatus] = createSignal<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [toneCatalog, setToneCatalog] = createSignal<PhoneToneCatalog>(FALLBACK_AUDIO_CATALOG);
  const [previewToneId, setPreviewToneId] = createSignal<string | null>(null);
  const [liveLocationEnabled, setLiveLocationEnabled] = createSignal(false);
  const [liveLocationInterval, setLiveLocationInterval] = createSignal<10>(10);
  const [liveLocationStatus, setLiveLocationStatus] = createSignal('');
  const [resettingPhone, setResettingPhone] = createSignal(false);
  const [resetStatus, setResetStatus] = createSignal<{ type: 'ok' | 'error'; text: string } | null>(null);
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
        const payload = await response.json() as PhoneToneCatalog;
        setToneCatalog({
          source: payload.source || FALLBACK_AUDIO_CATALOG.source,
          categories: {
            ringtones: payload.categories?.ringtones?.length ? payload.categories.ringtones : FALLBACK_AUDIO_CATALOG.categories.ringtones,
            notifications: payload.categories?.notifications?.length ? payload.categories.notifications : FALLBACK_AUDIO_CATALOG.categories.notifications,
            messages: payload.categories?.messages?.length ? payload.categories.messages : FALLBACK_AUDIO_CATALOG.categories.messages,
            calling: payload.categories?.calling?.length ? payload.categories.calling : FALLBACK_AUDIO_CATALOG.categories.calling,
          },
        });
      }
    } catch (_err) {
      setToneCatalog(FALLBACK_AUDIO_CATALOG);
    }

    const persisted = window.localStorage.getItem('gcphone:liveLocationInterval');
    if (persisted === '10') setLiveLocationInterval(10);

    const state = await fetchNui<{ success?: boolean; active?: boolean; intervalSeconds?: number }>('getLiveLocationState', {}, { success: false, active: false, intervalSeconds: 10 });
    if (state?.success) {
      setLiveLocationEnabled(Boolean(state.active));
      setLiveLocationInterval(10);
    }
  });

  onCleanup(() => {
    window.dispatchEvent(new CustomEvent('gcphone:stopTonePreview'));
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
        setLiveLocationStatus(t('settings.live_disabled', language()));
      }
      return;
    }

    const contacts = await fetchNui<Array<{ number: string }>>('getContacts', {}, []);
    const recipients = (contacts || [])
      .map((row) => String(row?.number || '').trim())
      .filter((value) => value.length > 0);

    if (recipients.length === 0) {
      setLiveLocationStatus(t('settings.no_contacts_share', language()));
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
      setLiveLocationStatus(t('settings.live_enabled_every', language(), { seconds: liveLocationInterval() }));
      return;
    }

    setLiveLocationStatus(response?.error || t('settings.live_enable_failed', language()));
  };

  const handleFactoryReset = async () => {
    if (resettingPhone()) return;

    const confirmed = await uiConfirm(t('settings.reset_confirm_message', language()), {
      title: t('settings.reset_title', language()),
    });
    if (!confirmed) return;

    setResettingPhone(true);
    setResetStatus(null);
    const success = await phoneActions.factoryReset();
    setResettingPhone(false);
    setResetStatus(success
      ? { type: 'ok', text: t('settings.reset_success', language()) }
      : { type: 'error', text: t('settings.reset_failed', language()) });
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

  const resetSecurityFlow = () => {
    setSecurityFlow('idle');
    setPinCode('');
    setPinConfirm('');
  };

  const validateAndSavePin = () => {
    const code = pinCode();
    const confirm = pinConfirm();

    if (code !== confirm) {
      setStatus({ type: 'error', text: t('settings.pin_mismatch', language()) });
      setSecurityFlow('change-new');
      setPinCode('');
      setPinConfirm('');
      return;
    }

    phoneActions.setLockCode(code);
    phoneActions.setScreenLockEnabled(true);
    setStatus({ type: 'ok', text: t('settings.pin_saved', language()) });
    window.setTimeout(() => {
      resetSecurityFlow();
      setStatus(null);
    }, 2000);
  };

  const processSecurityEntry = async (value: string) => {
    if (securityFlow() === 'disable-lock') {
      const valid = await phoneActions.verifyPin(value);
      if (!valid) {
        setStatus({ type: 'error', text: 'PIN actual incorrecto' });
        setPinCode('');
        return;
      }

      phoneActions.setScreenLockEnabled(false);
      setStatus({ type: 'ok', text: 'Bloqueo de pantalla desactivado' });
      window.setTimeout(() => {
        resetSecurityFlow();
        setStatus(null);
      }, 1600);
      return;
    }

    if (securityFlow() === 'change-verify') {
      const valid = await phoneActions.verifyPin(value);
      if (!valid) {
        setStatus({ type: 'error', text: 'PIN actual incorrecto' });
        setPinCode('');
        return;
      }

      setStatus(null);
      setSecurityFlow('change-new');
      setPinCode('');
      return;
    }

    if (securityFlow() === 'change-new') {
      setPinCode(value);
      setPinConfirm('');
      setSecurityFlow('change-confirm');
      return;
    }

    if (securityFlow() === 'change-confirm') {
      setPinConfirm(value);
      window.setTimeout(() => validateAndSavePin(), 0);
    }
  };

  const handlePinDigit = (digit: string) => {
    if (securityFlow() === 'idle') return;
    const target = securityFlow() === 'change-confirm' ? pinConfirm() : pinCode();
    if (target.length >= PIN_LENGTH) return;

    const next = `${target}${digit}`;

    if (securityFlow() === 'change-confirm') {
      setPinConfirm(next);
    } else {
      setPinCode(next);
    }

    if (next.length === PIN_LENGTH) {
      void processSecurityEntry(next);
    }
  };

  const handlePinBackspace = () => {
    if (securityFlow() === 'change-confirm') {
      setPinConfirm(pinConfirm().slice(0, -1));
    } else {
      setPinCode(pinCode().slice(0, -1));
    }
    setStatus(null);
  };

  const getCurrentPin = () => securityFlow() === 'change-confirm' ? pinConfirm() : pinCode();
  const screenLockEnabled = () => phoneState.settings.screenLockEnabled !== false;
  const securityTitle = () => {
    switch (securityFlow()) {
      case 'disable-lock': return 'Confirma tu PIN actual';
      case 'change-verify': return 'Introduce tu PIN actual';
      case 'change-new': return 'Introduce el nuevo PIN';
      case 'change-confirm': return 'Confirma el nuevo PIN';
      default: return t('settings.tab.security', language());
    }
  };
  const securitySubtitle = () => {
    switch (securityFlow()) {
      case 'disable-lock': return 'Necesitamos validar el PIN antes de quitar el bloqueo de pantalla.';
      case 'change-verify': return 'Verifica el PIN actual antes de cambiarlo.';
      case 'change-new': return 'El PIN debe tener 4 digitos.';
      case 'change-confirm': return 'Vuelve a introducir el nuevo PIN.';
      default: return 'Configura el bloqueo de pantalla y administra el PIN del dispositivo.';
    }
  };

  const playRingtonePreview = (ringtoneId: string, category: ToneCategory) => {
    if (previewToneId() === ringtoneId) {
      setPreviewToneId(null);
      window.dispatchEvent(new CustomEvent('gcphone:stopTonePreview'));
      return;
    }

    setPreviewToneId(ringtoneId);
    window.dispatchEvent(new CustomEvent('gcphone:previewTone', {
      detail: {
        toneId: ringtoneId,
        category,
      },
    }));
  };

  const IconImage = (props: { src: string; class?: string; alt?: string }) => (
    <img class={props.class} src={props.src} alt={props.alt || ''} draggable={false} />
  );

  const CheckIcon = () => (
    <span class={styles.checkmark} aria-hidden="true">
      <IconImage src={ICONS.check} class={styles.checkIcon} />
    </span>
  );

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
            <IconImage src={props.icon} class={styles.cellIconImage} />
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

  const Group = (props: { children: any }) => <SectionGroup class={styles.group}>{props.children}</SectionGroup>;

  // MAIN VIEW
  const renderMain = () => (
    <div class={styles.content}>
      <SectionHeader title={t('settings.group.general', language())} />
      <Group>
        <Cell 
          icon={ICONS.appearance}
          iconBg="iconBlue"
          title={t('settings.appearance', language())} 
          subtitle={t('settings.subtitle.appearance', language())}
          right="chevron"
          onClick={() => setSection('appearance')}
        />
        <Cell 
          icon={ICONS.sound}
          iconBg="iconOrange"
          title={t('settings.tab.sound', language())} 
          subtitle={t('settings.subtitle.sound', language())}
          right="chevron"
          onClick={() => setSection('sound')}
        />
        <Cell 
          icon={ICONS.security}
          iconBg="iconRed"
          title={t('settings.tab.security', language())} 
          subtitle={t('settings.subtitle.security', language())}
          right="chevron"
          onClick={() => setSection('security')}
        />
      </Group>

      <SectionHeader title={t('settings.system', language()).toUpperCase()} />
      <Group>
        <Cell 
          icon={ICONS.notifications}
          iconBg="iconRed"
          title={t('control.notifications', language())} 
          right="chevron"
          onClick={() => setSection('notifications')}
        />
        <Cell 
          icon={ICONS.location}
          iconBg="iconBlue"
          title={t('settings.live_location', language())} 
          subtitle={liveLocationEnabled() ? t('settings.active', language()) : t('settings.inactive', language())}
          right="chevron"
          onClick={() => setSection('system')}
        />
        <Cell 
          icon={ICONS.airplane}
          iconBg="iconOrange"
          title={t('settings.airplane', language())} 
          right="switch"
          switchValue={notifications.airplaneMode}
          onSwitch={() => notificationsActions.setAirplaneMode(!notifications.airplaneMode)}
        />
        <Cell 
          icon={ICONS.moon}
          iconBg="iconPurple"
          title={t('settings.dnd', language())} 
          right="switch"
          switchValue={notifications.doNotDisturb}
          onSwitch={() => notificationsActions.setDoNotDisturb(!notifications.doNotDisturb)}
        />
        <Cell 
          icon={ICONS.mute}
          iconBg="iconGray"
          title={t('settings.silent', language())} 
          right="switch"
          switchValue={notifications.silentMode}
          onSwitch={() => notificationsActions.setSilentMode(!notifications.silentMode)}
        />
      </Group>

      <div class={styles.brightnessSection}>
        <div class={styles.brightnessHeader}>
          <span class={styles.brightnessTitle}>
            <IconImage src={ICONS.brightness} class={styles.inlineIcon} />
            <span>{t('settings.brightness', language())}</span>
          </span>
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

      <SectionHeader title={t('settings.info_group', language())} />
      <Group>
        <Cell 
          icon={ICONS.info}
          iconBg="iconGreen"
          title={t('settings.about_gcphone', language())} 
          right="chevron"
          onClick={() => setSection('about')}
        />
      </Group>
    </div>
  );

  // APPEARANCE VIEW
  const renderAppearance = () => {
    const themes = [
      { id: 'light', name: 'Claro', icon: ICONS.brightness },
      { id: 'dark', name: 'Oscuro', icon: ICONS.moon },
      { id: 'auto', name: 'Automatico', icon: ICONS.shuffle },
    ];
    
    return (
    <div class={styles.content}>
      <SectionHeader title={t('settings.appearance', language()).toUpperCase()} />
      <Group>
        <div class={styles.themeList}>
          <For each={themes}>
            {(theme) => (
              <button
                class={styles.themeOption}
                classList={{ [styles.selected]: phoneState.settings.theme === theme.id }}
                onClick={() => phoneActions.setTheme(theme.id as 'light' | 'dark' | 'auto')}
              >
                <span class={styles.themeIcon}>
                  <IconImage src={theme.icon} class={styles.themeIconImage} />
                </span>
                <span class={styles.themeName}>{theme.name}</span>
                {phoneState.settings.theme === theme.id && <CheckIcon />}
              </button>
            )}
          </For>
        </div>
      </Group>

      <SectionHeader title={t('settings.wallpapers', language()).toUpperCase()} />
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
          <IconImage src={ICONS.gallery} class={styles.actionIcon} />
          <span>{t('camera.gallery', language())}</span>
        </button>
        <button class={styles.actionBtn} onClick={randomWallpaper}>
          <IconImage src={ICONS.shuffle} class={styles.actionIcon} />
          <span>{t('settings.random_api', language())}</span>
        </button>
      </div>

      <div class={styles.customUrl}>
        <input
          type="url"
          placeholder="https://example.com/wallpaper.jpg"
          value={urlInput()}
          onInput={(e) => setUrlInput(e.currentTarget.value)}
        />
        <button onClick={applyUrlWallpaper}>{t('settings.apply', language())}</button>
      </div>

      <SectionHeader title={t('settings.language', language()).toUpperCase()} />
      <Group>
        <div class={styles.langList}>
          <For each={languages}>
            {(lang) => (
              <button
                class={styles.langOption}
                classList={{ [styles.selected]: language() === lang.code }}
                onClick={() => phoneActions.setLanguage(lang.code as 'es' | 'en' | 'pt' | 'fr')}
              >
                <span class={styles.langFlag}>{lang.label}</span>
                <span class={styles.langName}>{lang.name}</span>
                {language() === lang.code && <CheckIcon />}
              </button>
            )}
          </For>
        </div>
      </Group>
    </div>
    );
  };

  // SOUND VIEW
  const renderSound = () => (
    <div class={styles.content}>
      <SectionHeader title={t('settings.volume', language()).toUpperCase()} />
      <div class={styles.volumeSection}>
        <div class={styles.volumeLabels}>
          <IconImage src={ICONS.mute} class={styles.inlineIcon} />
          <span>{Math.round(phoneState.settings.volume * 100)}%</span>
          <IconImage src={ICONS.sound} class={styles.inlineIcon} />
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

      <SectionHeader title={t('settings.audio_profile', language()).toUpperCase()} />
      <Group>
        <For each={audioProfiles}>
          {(profile) => (
            <button
              class={styles.profileOption}
              classList={{ [styles.selected]: phoneState.settings.audioProfile === profile.id }}
              onClick={() => phoneActions.setAudioProfile(profile.id as 'normal' | 'street' | 'vehicle' | 'silent')}
            >
              <span class={styles.profileIcon}>
                <IconImage src={profile.icon} class={styles.profileIconImage} />
              </span>
              <div class={styles.profileInfo}>
                <div class={styles.profileName}>{profile.name}</div>
                <div class={styles.profileDesc}>{profile.desc}</div>
              </div>
              {phoneState.settings.audioProfile === profile.id && <CheckIcon />}
            </button>
          )}
        </For>
      </Group>

      <SectionHeader title={t('settings.ringtone', language()).toUpperCase()} />
      <div class={styles.customUrl}>
        <div class={styles.customUrlInfo}>
          <div class={styles.customUrlTitle}>
             {t('settings.public_library', language())}
          </div>
          <div class={styles.customUrlText}>
             {t('settings.public_library_desc', language(), { source: toneCatalog().source?.name || 'Pixabay Sound Effects', license: toneCatalog().source?.license || 'royalty-free' })}
          </div>
        </div>
        <button onClick={() => window.open(toneCatalog().source?.downloadPage || 'https://pixabay.com/sound-effects/', '_blank')}>{t('settings.download', language())}</button>
      </div>

      <SectionHeader title={t('settings.call_ringtone', language()).toUpperCase()} />
      <Group>
        <For each={toneCatalog().categories?.ringtones || []}>
          {(ringtone) => (
            <div class={styles.ringtoneItem}>
                <div class={styles.ringtoneLeft}>
                <div class={styles.ringtoneIcon}>
                  <IconImage src={ICONS.ringtone} class={styles.ringtoneIconImage} />
                </div>
                <span class={styles.ringtoneName}>{ringtone.name}</span>
              </div>
              <div class={styles.ringtoneActions}>
                <button
                  class={styles.previewBtn}
                  onClick={() => playRingtonePreview(ringtone.id, 'ringtone')}
                  title={t('settings.listen', language())}
                >
                  <IconImage src={previewToneId() === ringtone.id ? ICONS.stop : ICONS.play} class={styles.previewIcon} />
                </button>
                <button
                  class={`${styles.selectBtn} ${(phoneState.settings.callRingtone || phoneState.settings.ringtone) === ringtone.id ? styles.selected : ''}`}
                  onClick={() => phoneActions.setCallRingtone(ringtone.id)}
                >
                  {(phoneState.settings.callRingtone || phoneState.settings.ringtone) === ringtone.id ? <CheckIcon /> : t('settings.select', language())}
                </button>
              </div>
            </div>
          )}
        </For>
      </Group>

      <SectionHeader title={t('settings.notification_ringtone', language()).toUpperCase()} />
      <Group>
        <For each={toneCatalog().categories?.notifications || []}>
          {(tone) => (
            <div class={styles.ringtoneItem}>
                <div class={styles.ringtoneLeft}>
                <div class={styles.ringtoneIcon}>
                  <IconImage src={ICONS.ringtone} class={styles.ringtoneIconImage} />
                </div>
                <span class={styles.ringtoneName}>{tone.name}</span>
              </div>
              <div class={styles.ringtoneActions}>
                <button class={styles.previewBtn} onClick={() => playRingtonePreview(tone.id, 'notification')} title={t('settings.listen', language())}>
                  <IconImage src={previewToneId() === tone.id ? ICONS.stop : ICONS.play} class={styles.previewIcon} />
                </button>
                <button
                  class={`${styles.selectBtn} ${phoneState.settings.notificationTone === tone.id ? styles.selected : ''}`}
                  onClick={() => phoneActions.setNotificationTone(tone.id)}
                >
                  {phoneState.settings.notificationTone === tone.id ? <CheckIcon /> : t('settings.select', language())}
                </button>
              </div>
            </div>
          )}
        </For>
      </Group>

      <SectionHeader title={t('settings.message_ringtone', language()).toUpperCase()} />
      <Group>
        <For each={toneCatalog().categories?.messages || []}>
          {(tone) => (
            <div class={styles.ringtoneItem}>
                <div class={styles.ringtoneLeft}>
                <div class={styles.ringtoneIcon}>
                  <IconImage src={ICONS.message} class={styles.ringtoneIconImage} />
                </div>
                <span class={styles.ringtoneName}>{tone.name}</span>
              </div>
              <div class={styles.ringtoneActions}>
                <button class={styles.previewBtn} onClick={() => playRingtonePreview(tone.id, 'message')} title={t('settings.listen', language())}>
                  <IconImage src={previewToneId() === tone.id ? ICONS.stop : ICONS.play} class={styles.previewIcon} />
                </button>
                <button
                  class={`${styles.selectBtn} ${phoneState.settings.messageTone === tone.id ? styles.selected : ''}`}
                  onClick={() => phoneActions.setMessageTone(tone.id)}
                >
                  {phoneState.settings.messageTone === tone.id ? <CheckIcon /> : t('settings.select', language())}
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
      <Group>
        <div class={styles.locationRow}>
          <div class={styles.locationLeft}>
            <div class={`${styles.cellIcon} ${styles.iconGreen}`}>
              <IconImage src={ICONS.security} class={styles.cellIconImage} />
            </div>
            <div>
              <div class={styles.cellTitle}>Bloqueo de pantalla</div>
              <div class={styles.cellSubtitle}>{screenLockEnabled() ? 'El telefono pide PIN al abrirse.' : 'El telefono abre directo sin lock screen.'}</div>
            </div>
          </div>
          <div
            class={`${styles.switch} ${screenLockEnabled() ? styles.switchActive : ''}`}
            onClick={() => {
              setStatus(null);
              if (screenLockEnabled()) {
                resetSecurityFlow();
                setSecurityFlow('disable-lock');
                return;
              }

              phoneActions.setScreenLockEnabled(true);
              setStatus({ type: 'ok', text: 'Bloqueo de pantalla activado' });
            }}
            role="switch"
            aria-checked={screenLockEnabled()}
          >
            <div class={styles.switchThumb} />
          </div>
        </div>

        <div class={styles.locationRow}>
          <div class={styles.locationLeft}>
            <div class={`${styles.cellIcon} ${styles.iconRed}`}>
              <IconImage src={ICONS.security} class={styles.cellIconImage} />
            </div>
            <div>
              <div class={styles.cellTitle}>Cambiar PIN</div>
              <div class={styles.cellSubtitle}>Verifica tu PIN actual y despues introduce el nuevo.</div>
            </div>
          </div>
          <button
            class={styles.clearBtn}
            style={{ width: 'auto', margin: '0', padding: '10px 14px' }}
            onClick={() => {
              setStatus(null);
              resetSecurityFlow();
              setSecurityFlow('change-verify');
            }}
          >
            Cambiar
          </button>
        </div>
      </Group>

      <Show when={securityFlow() !== 'idle'}>
        <div class={styles.pinContainer}>
          <div class={styles.pinTitle}>{securityTitle()}</div>
          <div class={styles.cellSubtitle} style={{ 'text-align': 'center', 'margin-bottom': '12px' }}>{securitySubtitle()}</div>

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
              <IconImage src={ICONS.backspace} class={styles.keypadIcon} />
            </button>
          </div>

          <button class={styles.clearBtn} onClick={resetSecurityFlow}>Cancelar</button>
        </div>
      </Show>

      <Show when={status()}>
        {(msg) => (
          <div class={`${styles.pinMessage} ${styles[msg().type]}`}>
            {msg().text}
          </div>
        )}
      </Show>
    </div>
  );

  // NOTIFICATIONS VIEW
  const renderNotifications = () => (
    <div class={styles.content}>
      <SectionHeader title={t('home.section_apps', language()).toUpperCase()} />
      <Group>
        <For each={APP_DEFINITIONS.filter((app) => phoneState.enabledApps.includes(app.id))}>
          {(app) => {
            const unreadCount = notificationsActions.getUnreadCount(app.id);
            const muted = notificationsActions.isAppMuted(app.id);
            return (
              <div class={styles.appRow}>
                <div class={styles.appIcon}>
                  <img src={app.icon} alt={appName(app.id, app.name, language())} />
                </div>
                <div class={styles.appInfo}>
                  <div class={styles.appName}>{appName(app.id, app.name, language())}</div>
                  <div class={styles.appStatus}>{muted ? 'Notificaciones desactivadas' : unreadCount > 0 ? t('settings.unread_count', language(), { count: unreadCount }) : t('settings.up_to_date', language())}</div>
                </div>
                <div
                  class={`${styles.switch} ${!muted ? styles.switchActive : ''}`}
                  onClick={() => notificationsActions.toggleMuteApp(app.id)}
                  role="switch"
                  aria-checked={!muted}
                >
                  <div class={styles.switchThumb} />
                </div>
                {unreadCount > 0 ? (
                  <div class={styles.badge}>{unreadCount}</div>
                ) : (
                  <div class={styles.okIcon}>
                    <IconImage src={ICONS.check} class={styles.okIconImage} />
                  </div>
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
        {t('settings.mark_all_read', language())}
      </button>
    </div>
  );

  // SYSTEM VIEW
  const renderSystem = () => (
    <div class={styles.content}>
      <SectionHeader title={t('settings.live_location', language()).toUpperCase()} />
      <Group>
        <div class={styles.locationRow}>
          <div class={styles.locationLeft}>
            <div class={`${styles.cellIcon} ${styles.iconBlue}`}>
              <IconImage src={ICONS.location} class={styles.cellIconImage} />
            </div>
            <div>
              <div class={styles.cellTitle}>{t('settings.share_location', language())}</div>
              <div class={styles.cellSubtitle}>{liveLocationEnabled() ? t('settings.active', language()) : t('settings.inactive', language())}</div>
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
          <button class={styles.freqBtn} onClick={() => void updateLiveLocationInterval(10)}>{t('settings.every_ten_seconds', language())}</button>
        </div>
      </Show>

      <Show when={liveLocationStatus()}>
        <div class={`${styles.statusMsg} ${liveLocationEnabled() ? styles.success : styles.error}`}>
          {liveLocationStatus()}
        </div>
      </Show>

      <SectionHeader title={t('settings.reset_group', language())} />
      <Group>
        <Cell
          icon={ICONS.trash}
          iconBg="iconRed"
          title={t('settings.erase_phone', language())}
          subtitle={t('settings.erase_phone_desc', language())}
        />
      </Group>

      <button class={styles.clearBtn} onClick={() => void handleFactoryReset()} disabled={resettingPhone()}>
        {resettingPhone() ? t('settings.resetting', language()) : t('settings.reset_title', language())}
      </button>

      <Show when={resetStatus()}>
        {(msg) => (
          <div class={`${styles.statusMsg} ${msg().type === 'ok' ? styles.success : styles.error}`}>
            {msg().text}
          </div>
        )}
      </Show>
    </div>
  );

  // ABOUT VIEW
  const renderAbout = () => (
    <div class={styles.content}>
      <div class={styles.aboutHeader}>
        <div class={styles.aboutIcon}>
          <IconImage src={ICONS.appIcon} class={styles.aboutIconImage} alt="GCPhone Next" />
        </div>
        <div class={styles.aboutName}>GCPhone Next</div>
        <div class={styles.aboutVersion}>{t('settings.version_label', language())} 2.1.0</div>
      </div>

      <Group>
        <div class={styles.infoRow}>
          <span class={styles.infoLabel}>{t('settings.number', language())}</span>
          <span class={styles.infoValue}>{phoneState.settings.phoneNumber ? formatPhoneNumber(phoneState.settings.phoneNumber, phoneState.framework || 'unknown') : t('settings.unassigned', language())}</span>
        </div>
        <div class={styles.infoRow}>
          <span class={styles.infoLabel}>{t('settings.visual_framework', language())}</span>
          <span class={styles.infoValue}>{phoneState.framework || 'unknown'}</span>
        </div>
        <div class={styles.infoRow}>
          <span class={styles.infoLabel}>{t('settings.platform', language())}</span>
          <span class={styles.infoValue}>FiveM</span>
        </div>
      </Group>
    </div>
  );

  const getTitle = () => {
    switch (section()) {
      case 'appearance': return t('settings.appearance', language());
      case 'sound': return t('settings.tab.sound', language());
      case 'security': return t('settings.tab.security', language());
      case 'notifications': return t('control.notifications', language());
      case 'system': return t('settings.system', language());
      case 'about': return t('settings.about_gcphone', language());
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
      <Show when={phoneState.accessMode === 'foreign-readonly'}>
        <div class={styles.content}>
          <InlineNotice
            title={t('settings.foreign_phone', language())}
            message={t('settings.foreign_phone_desc', language(), { name: phoneState.accessOwnerName || t('common.other_person', language()) })}
          />
        </div>
      </Show>
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
