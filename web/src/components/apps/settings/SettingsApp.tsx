import { Show, createEffect, createSignal, onCleanup, onMount, Switch, Match } from 'solid-js';
import { useRouter } from '../../Phone/PhoneRouterContext';
import { usePhone } from '../../../store/phone';
import { useNotifications } from '../../../store/notifications';
import { fetchNui } from '../../../utils/fetchNui';
import { emitInternalEvent } from '../../../utils/internalEvents';
import { usePhoneKeyHandler } from '../../../hooks/usePhoneKeyHandler';
import { AppScaffold } from '../../shared/layout';
import { InlineNotice } from '../../shared/ui/InlineNotice';
import { t } from '../../../i18n';
import { TONE_CATALOG, type ToneCategory } from '../../../utils/phoneAudio';
import { useLiveActivity } from '../../../store/liveActivity';
import { SettingsMain } from './SettingsMain';
import { SettingsAppearance } from './SettingsAppearance';
import { SettingsSound } from './SettingsSound';
import { SettingsSecurity } from './SettingsSecurity';
import { SettingsNotifications } from './SettingsNotifications';
import { SettingsAppsPermissions } from './SettingsAppsPermissions';
import { SettingsSystem } from './SettingsSystem';
import { SettingsAbout } from './SettingsAbout';
import styles from './SettingsApp.module.scss';

type SettingsSection = 'main' | 'appearance' | 'sound' | 'security' | 'notifications' | 'appsandpermissions' | 'system' | 'about';

function isSettingsSection(value: unknown): value is SettingsSection {
  return (
    value === 'main' ||
    value === 'appearance' ||
    value === 'sound' ||
    value === 'security' ||
    value === 'notifications' ||
    value === 'appsandpermissions' ||
    value === 'system' ||
    value === 'about'
  );
}

export function SettingsApp() {
  const router = useRouter();
  const [phoneState, phoneActions] = usePhone();
  const [notifications, notificationsActions] = useNotifications();
  const { setActivity, removeActivity } = useLiveActivity();

  const [section, _setSection] = createSignal<SettingsSection>(
    (sessionStorage.getItem('gcphone:settingsSection') as SettingsSection) || 'main'
  );
  const setSection = (s: SettingsSection) => {
    sessionStorage.setItem('gcphone:settingsSection', s);
    _setSection(s);
  };
  const [urlInput, setUrlInput] = createSignal('');
  const toneCatalog = () => TONE_CATALOG;
  const [previewToneId, setPreviewToneId] = createSignal<string | null>(null);
  const [liveLocationEnabled, setLiveLocationEnabled] = createSignal(false);
  const [liveLocationInterval, setLiveLocationInterval] = createSignal<10>(10);
  const [liveLocationStatus, setLiveLocationStatus] = createSignal('');
  const [autoReplyEnabled, setAutoReplyEnabled] = createSignal(false);
  const [autoReplyMessage, setAutoReplyMessage] = createSignal('');
  const [statusToast, setStatusToast] = createSignal('');
  const language = () => phoneState.settings.language || 'es';
  let lastRouteSyncKey = '';

  createEffect(() => {
    const routeSection = router.params().section;
    const routeFocus = typeof router.params().focus === 'string' ? router.params().focus : '';
    const routeRequestId = router.params().requestId;
    const routeSyncKey = `${String(routeSection || '')}:${routeFocus}:${String(routeRequestId || '')}`;
    if (routeSyncKey === lastRouteSyncKey) return;

    if (isSettingsSection(routeSection) && routeSection !== section()) {
      lastRouteSyncKey = routeSyncKey;
      setSection(routeSection);
    }
  });

  const showToast = (msg: string) => {
    setStatusToast(msg);
    setTimeout(() => setStatusToast(''), 2500);
  };

  usePhoneKeyHandler({
    Backspace: () => {
      if (section() !== 'main') setSection('main');
      else router.goBack();
    },
  }, { routeId: 'settings' });

  onMount(async () => {
    const persisted = window.localStorage.getItem('gcphone:liveLocationInterval');
    if (persisted === '10') setLiveLocationInterval(10);

    const state = await fetchNui<{ success?: boolean; active?: boolean; intervalSeconds?: number }>('getLiveLocationState', {}, { success: false, active: false, intervalSeconds: 10 });
    if (state?.success) {
      setLiveLocationEnabled(Boolean(state.active));
      setLiveLocationInterval(10);
      if (state.active) {
        setActivity('location', {
          title: t('settings.live_location', language()),
          subtitle: `Cada 10 seg`,
          icon: './img/icons_ios/ui-location.svg',
          onStop: () => void toggleLiveLocation(),
          onNavigate: () => { router.navigate('settings'); },
        });
      }
    }

    const autoReply = await fetchNui<{ enabled?: boolean; message?: string }>('getAutoReply', {}, { enabled: false, message: '' });
    setAutoReplyEnabled(autoReply?.enabled === true);
    setAutoReplyMessage(autoReply?.message || '');
  });

  onCleanup(() => { emitInternalEvent('gcphone:stopTonePreview'); });

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
        removeActivity('location');
      }
      return;
    }

    const contacts = await fetchNui<Array<{ number: string }>>('getContacts', {}, []);
    const recipients = (contacts || []).map((row) => String(row?.number || '').trim()).filter((v) => v.length > 0);
    if (recipients.length === 0) { setLiveLocationStatus(t('settings.no_contacts_share', language())); return; }

    await fetchNui('setLiveLocationInterval', { seconds: liveLocationInterval() });
    const response = await fetchNui<{ success?: boolean; error?: string }>('startLiveLocation', { recipients, durationMinutes: 15, updateIntervalSeconds: liveLocationInterval() }, { success: false });

    if (response?.success) {
      setLiveLocationEnabled(true);
      setLiveLocationStatus(t('settings.live_enabled_every', language(), { seconds: liveLocationInterval() }));
      setActivity('location', {
        title: t('settings.live_location', language()),
        subtitle: `Cada ${liveLocationInterval()} seg`,
        icon: './img/icons_ios/ui-location.svg',
        onStop: () => void toggleLiveLocation(),
        onNavigate: () => { router.navigate('settings'); },
      });
      return;
    }
    setLiveLocationStatus(response?.error || t('settings.live_enable_failed', language()));
  };

  const playRingtonePreview = (ringtoneId: string, category: ToneCategory) => {
    if (previewToneId() === ringtoneId) {
      setPreviewToneId(null);
      emitInternalEvent('gcphone:stopTonePreview');
      return;
    }
    setPreviewToneId(ringtoneId);
    emitInternalEvent('gcphone:previewTone', { toneId: ringtoneId, category });
  };

  const screenLockEnabled = () => phoneState.settings.screenLockEnabled !== false;
  const notificationFocus = () => router.params().focus === 'muted' ? 'muted' : 'all';

  const getTitle = () => {
    switch (section()) {
      case 'appearance': return t('settings.appearance', language());
      case 'sound': return t('settings.tab.sound', language());
      case 'security': return t('settings.tab.security', language());
      case 'notifications': return t('control.notifications', language());
      case 'appsandpermissions': return 'Apps y Permisos';
      case 'system': return t('settings.system', language());
      case 'about': return t('settings.about_gcphone', language());
      default: return t('settings.title', language());
    }
  };

  return (
    <AppScaffold title={getTitle()} subtitle={undefined} onBack={() => section() !== 'main' ? setSection('main') : router.goBack()} bodyClass={`${styles.app} ${styles.settingsCanvas}`} bodyPadding="none">
      <Show when={statusToast()}>
        <div class={styles.settingsToast}>{statusToast()}</div>
      </Show>
      <Show when={phoneState.accessMode === 'foreign-readonly'}>
        <div class={styles.content}>
          <InlineNotice title={t('settings.foreign_phone', language())} message={t('settings.foreign_phone_desc', language(), { name: phoneState.accessOwnerName || t('common.other_person', language()) })} />
        </div>
      </Show>
      <Switch>
        <Match when={section() === 'main'}>
          <SettingsMain
            language={language}
            notifications={notifications}
            notificationsActions={notificationsActions}
            liveLocationEnabled={liveLocationEnabled}
            phoneVersion={phoneState.resourceVersion}
            playerName={phoneState.settings?.playerName || phoneState.playerName}
            phoneNumber={phoneState.settings?.phoneNumber}
            onNavigate={(s) => setSection(s as SettingsSection)}
          />
        </Match>
        <Match when={section() === 'appearance'}>
          <SettingsAppearance language={language} phoneState={phoneState} phoneActions={phoneActions} urlInput={urlInput} setUrlInput={setUrlInput} onStatus={showToast} />
        </Match>
        <Match when={section() === 'sound'}>
          <SettingsSound
            language={language}
            phoneState={phoneState}
            phoneActions={phoneActions}
            toneCatalog={toneCatalog}
            previewToneId={previewToneId}
            onPreview={playRingtonePreview}
            autoReplyEnabled={autoReplyEnabled}
            setAutoReplyEnabled={setAutoReplyEnabled}
            autoReplyMessage={autoReplyMessage}
            setAutoReplyMessage={setAutoReplyMessage}
          />
        </Match>
        <Match when={section() === 'security'}>
          <SettingsSecurity language={language} phoneActions={phoneActions} phoneState={phoneState} screenLockEnabled={screenLockEnabled} />
        </Match>
        <Match when={section() === 'notifications'}>
          <SettingsNotifications
            language={language}
            phoneState={phoneState}
            notifications={notifications}
            notificationsActions={notificationsActions}
            focus={notificationFocus()}
          />
        </Match>
        <Match when={section() === 'appsandpermissions'}>
          <SettingsAppsPermissions language={language} onBack={() => setSection('main')} />
        </Match>
        <Match when={section() === 'system'}>
          <SettingsSystem language={language} phoneActions={phoneActions} liveLocationEnabled={liveLocationEnabled} setLiveLocationEnabled={setLiveLocationEnabled} liveLocationStatus={liveLocationStatus} setLiveLocationStatus={setLiveLocationStatus} toggleLiveLocation={() => void toggleLiveLocation()} liveLocationInterval={liveLocationInterval} updateLiveLocationInterval={(s) => void updateLiveLocationInterval(s)} />
        </Match>
        <Match when={section() === 'about'}>
          <SettingsAbout language={language} phoneState={phoneState} onStatus={showToast} />
        </Match>
      </Switch>
    </AppScaffold>
  );
}
