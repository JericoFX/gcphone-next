import { Motion } from '@motionone/solid';
import { SectionHeader } from '../../shared/ui/SectionBlock';
import { t } from '../../../i18n';
import { Cell, Group, ICONS } from './settingsShared';
import styles from './SettingsApp.module.scss';

interface SettingsMainProps {
  language: () => string;
  notifications: any;
  notificationsActions: any;
  liveLocationEnabled: () => boolean;
  phoneVersion?: string;
  playerName?: string;
  phoneNumber?: string;
  onNavigate: (section: string) => void;
}

export function SettingsMain(props: SettingsMainProps) {
  return (
    <div class={styles.content}>
      <Motion.div
        class={styles.profileBanner}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, easing: [0.32, 0.72, 0, 1] }}
        onClick={() => props.onNavigate('about')}
      >
        <div class={styles.profileAvatar}>
          <span>{(props.playerName || 'U').charAt(0).toUpperCase()}</span>
        </div>
        <div class={styles.profileInfo}>
          <strong class={styles.profileName}>{props.playerName || t('settings.citizen', props.language())}</strong>
          <span class={styles.profileSub}>{props.phoneNumber || t('settings.phone_settings', props.language())}</span>
        </div>
        <div class={styles.chevron} />
      </Motion.div>

      <SectionHeader title={t('settings.quick_controls', props.language())} />
      <Group>
        <Cell
          icon={ICONS.airplane} iconBg="iconOrange"
          title={t('settings.airplane', props.language())}
          right="switch"
          switchValue={props.notifications.airplaneMode}
          onSwitch={() => props.notificationsActions.setAirplaneMode(!props.notifications.airplaneMode)}
        />
        <Cell
          icon={ICONS.moon} iconBg="iconPurple"
          title={t('settings.dnd', props.language())}
          right="switch"
          switchValue={props.notifications.doNotDisturb}
          onSwitch={() => props.notificationsActions.setDoNotDisturb(!props.notifications.doNotDisturb)}
        />
        <Cell
          icon={ICONS.mute} iconBg="iconRed"
          title={t('settings.silent', props.language())}
          right="switch"
          switchValue={props.notifications.silentMode}
          onSwitch={() => props.notificationsActions.setSilentMode(!props.notifications.silentMode)}
        />
        <Cell
          icon={ICONS.brightness} iconBg="iconBlue"
          title={t('settings.brightness', props.language())}
          right="slider"
          sliderMin={40}
          sliderMax={120}
          sliderValue={Math.round(props.notifications.brightness * 100)}
          onSlider={(v) => props.notificationsActions.setBrightness(v / 100)}
        />
      </Group>

      <SectionHeader title={t('settings.settings_group', props.language())} />
      <Group>
        <Cell icon={ICONS.appearance} iconBg="iconBlue" title={t('settings.appearance', props.language())} right="chevron" onClick={() => props.onNavigate('appearance')} />
        <Cell icon={ICONS.sound} iconBg="iconPink" title={t('settings.tab.sound', props.language())} right="chevron" onClick={() => props.onNavigate('sound')} />
        <Cell icon={ICONS.security} iconBg="iconRed" title={t('settings.tab.security', props.language())} right="chevron" onClick={() => props.onNavigate('security')} />
        <Cell icon={ICONS.notifications} iconBg="iconRed" title={t('control.notifications', props.language())} right="chevron" onClick={() => props.onNavigate('notifications')} />
      </Group>

      <SectionHeader title={t('settings.system_group', props.language())} />
      <Group>
        <Cell icon={ICONS.location} iconBg="iconBlue" title={t('settings.system', props.language())} right="chevron" onClick={() => props.onNavigate('system')} />
        <Cell icon={ICONS.info} iconBg="iconGray" title={t('settings.about_gcphone', props.language())} right="value+chevron" value={props.phoneVersion || ''} onClick={() => props.onNavigate('about')} />
      </Group>
    </div>
  );
}
