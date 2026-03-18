import { Show } from 'solid-js';
import { fetchNui } from '../../../utils/fetchNui';
import { SectionHeader } from '../../shared/ui/SectionBlock';
import { uiPrompt } from '../../../utils/uiDialog';
import { t } from '../../../i18n';
import { Cell, Group, ICONS, IconImage } from './settingsShared';
import styles from './SettingsApp.module.scss';

interface SettingsMainProps {
  language: () => string;
  notifications: any;
  notificationsActions: any;
  autoReplyEnabled: () => boolean;
  setAutoReplyEnabled: (v: boolean) => void;
  autoReplyMessage: () => string;
  setAutoReplyMessage: (v: string) => void;
  liveLocationEnabled: () => boolean;
  onNavigate: (section: string) => void;
}

export function SettingsMain(props: SettingsMainProps) {
  return (
    <div class={styles.content}>
      <SectionHeader title={t('settings.group.general', props.language())} />
      <Group>
        <Cell icon={ICONS.appearance} iconBg="iconBlue" title={t('settings.appearance', props.language())} subtitle={t('settings.subtitle.appearance', props.language())} right="chevron" onClick={() => props.onNavigate('appearance')} />
        <Cell icon={ICONS.sound} iconBg="iconOrange" title={t('settings.tab.sound', props.language())} subtitle={t('settings.subtitle.sound', props.language())} right="chevron" onClick={() => props.onNavigate('sound')} />
        <Cell icon={ICONS.security} iconBg="iconRed" title={t('settings.tab.security', props.language())} subtitle={t('settings.subtitle.security', props.language())} right="chevron" onClick={() => props.onNavigate('security')} />
      </Group>

      <SectionHeader title={t('settings.system', props.language()).toUpperCase()} />
      <Group>
        <Cell icon={ICONS.notifications} iconBg="iconRed" title={t('control.notifications', props.language())} right="chevron" onClick={() => props.onNavigate('notifications')} />
        <Cell icon={ICONS.location} iconBg="iconBlue" title={t('settings.live_location', props.language())} subtitle={props.liveLocationEnabled() ? t('settings.active', props.language()) : t('settings.inactive', props.language())} right="chevron" onClick={() => props.onNavigate('system')} />
        <Cell icon={ICONS.airplane} iconBg="iconOrange" title={t('settings.airplane', props.language())} right="switch" switchValue={props.notifications.airplaneMode} onSwitch={() => props.notificationsActions.setAirplaneMode(!props.notifications.airplaneMode)} />
        <Cell icon={ICONS.moon} iconBg="iconPurple" title={t('settings.dnd', props.language())} right="switch" switchValue={props.notifications.doNotDisturb} onSwitch={() => props.notificationsActions.setDoNotDisturb(!props.notifications.doNotDisturb)} />
        <Cell icon={ICONS.mute} iconBg="iconGray" title={t('settings.silent', props.language())} right="switch" switchValue={props.notifications.silentMode} onSwitch={() => props.notificationsActions.setSilentMode(!props.notifications.silentMode)} />
        <Cell
          icon={ICONS.moon}
          iconBg="iconGreen"
          title="Auto-respuesta"
          subtitle={props.autoReplyEnabled() ? 'Activa' : 'Inactiva'}
          right="switch"
          switchValue={props.autoReplyEnabled()}
          onSwitch={async () => {
            const next = !props.autoReplyEnabled();
            if (!next) {
              await fetchNui('setAutoReply', { enabled: false, message: '' }, { success: true });
              props.setAutoReplyEnabled(false);
              props.setAutoReplyMessage('');
              return;
            }
            const msg = props.autoReplyMessage() || 'No puedo responder ahora, te escribo luego.';
            const result = await fetchNui<{ success?: boolean; enabled?: boolean; message?: string }>('setAutoReply', { enabled: true, message: msg }, { success: true, enabled: true, message: msg });
            if (result?.success) {
              props.setAutoReplyEnabled(result.enabled === true);
              props.setAutoReplyMessage(result.message || msg);
            }
          }}
        />
        <Show when={props.autoReplyEnabled()}>
          <Cell
            icon={ICONS.moon}
            iconBg="iconGreen"
            title="Mensaje auto"
            subtitle={props.autoReplyMessage() || 'Sin mensaje'}
            onClick={async () => {
              const input = await uiPrompt('Escribe tu mensaje de auto-respuesta:', { title: 'Auto-respuesta', defaultValue: props.autoReplyMessage() });
              if (typeof input === 'string' && input.trim()) {
                const result = await fetchNui<{ success?: boolean; message?: string }>('setAutoReply', { enabled: true, message: input.trim() }, { success: true, message: input.trim() });
                if (result?.success) {
                  props.setAutoReplyMessage(result.message || input.trim());
                }
              }
            }}
          />
        </Show>
      </Group>

      <div class={styles.brightnessSection}>
        <div class={styles.brightnessHeader}>
          <span class={styles.brightnessTitle}>
            <IconImage src={ICONS.brightness} class={styles.inlineIcon} />
            <span>{t('settings.brightness', props.language())}</span>
          </span>
          <span class={styles.brightnessValue}>{Math.round(props.notifications.brightness * 100)}%</span>
        </div>
        <input class={styles.slider} type="range" min="40" max="120" value={Math.round(props.notifications.brightness * 100)} onInput={(e) => props.notificationsActions.setBrightness(Number(e.currentTarget.value) / 100)} />
      </div>

      <SectionHeader title={t('settings.info_group', props.language())} />
      <Group>
        <Cell icon={ICONS.info} iconBg="iconGreen" title={t('settings.about_gcphone', props.language())} right="chevron" onClick={() => props.onNavigate('about')} />
      </Group>
    </div>
  );
}
