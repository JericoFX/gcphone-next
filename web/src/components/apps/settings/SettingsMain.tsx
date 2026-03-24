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
  onNavigate: (section: string) => void;
}

export function SettingsMain(props: SettingsMainProps) {
  return (
    <div class={styles.content}>
      <SectionHeader title={t('settings.quick_controls', props.language()) || 'CONTROLES RAPIDOS'} />
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

      <SectionHeader title={t('settings.settings_group', props.language()) || 'AJUSTES'} />
      <Group>
        <Cell icon={ICONS.appearance} iconBg="iconBlue" title={t('settings.appearance', props.language())} right="chevron" onClick={() => props.onNavigate('appearance')} />
        <Cell icon={ICONS.sound} iconBg="iconOrange" title={t('settings.tab.sound', props.language())} right="chevron" onClick={() => props.onNavigate('sound')} />
        <Cell icon={ICONS.security} iconBg="iconRed" title={t('settings.tab.security', props.language())} right="chevron" onClick={() => props.onNavigate('security')} />
        <Cell icon={ICONS.notifications} iconBg="iconOrange" title={t('control.notifications', props.language())} right="chevron" onClick={() => props.onNavigate('notifications')} />
      </Group>

      <SectionHeader title={t('settings.system_group', props.language()) || 'SISTEMA'} />
      <Group>
        <Cell icon={ICONS.location} iconBg="iconGray" title={t('settings.system', props.language())} right="chevron" onClick={() => props.onNavigate('system')} />
        <Cell icon={ICONS.info} iconBg="iconGray" title={t('settings.about_gcphone', props.language())} right="value+chevron" value={props.phoneVersion || ''} onClick={() => props.onNavigate('about')} />
      </Group>
    </div>
  );
}
