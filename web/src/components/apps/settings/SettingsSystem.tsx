import { Show } from 'solid-js';
import { fetchNui } from '../../../utils/fetchNui';
import { SectionHeader } from '../../shared/ui/SectionBlock';
import { uiConfirm } from '../../../utils/uiDialog';
import { t } from '../../../i18n';
import { Cell, Group, ICONS, InlineExpander } from './settingsShared';
import styles from './SettingsApp.module.scss';

interface SettingsSystemProps {
  language: () => string;
  phoneActions: any;
  liveLocationEnabled: () => boolean;
  setLiveLocationEnabled: (v: boolean) => void;
  liveLocationStatus: () => string;
  setLiveLocationStatus: (v: string) => void;
  toggleLiveLocation: () => void;
  liveLocationInterval: () => number;
  updateLiveLocationInterval: (s: 10) => void;
}

export function SettingsSystem(props: SettingsSystemProps) {
  let resetting = false;

  const handleFactoryReset = async () => {
    if (resetting) return;
    const confirmed = await uiConfirm(t('settings.reset_confirm_message', props.language()), { title: t('settings.reset_title', props.language()) });
    if (!confirmed) return;
    resetting = true;
    await props.phoneActions.factoryReset();
    resetting = false;
  };

  return (
    <div class={styles.content}>
      <SectionHeader title={t('settings.live_location', props.language()).toUpperCase()} />
      <Group>
        <Cell
          icon={ICONS.location} iconBg="iconGreen"
          title={t('settings.share_location', props.language()) || 'Ubicacion en vivo'}
          subtitle={props.liveLocationEnabled() ? t('settings.active', props.language()) : t('settings.inactive', props.language())}
          right="switch"
          switchValue={props.liveLocationEnabled()}
          onSwitch={() => props.toggleLiveLocation()}
        />
        <InlineExpander open={props.liveLocationEnabled}>
          <div class={styles.liveStatus}>
            <span class={styles.pulseDot} />
            <span class={styles.liveText}>
              {t('settings.live_enabled_every', props.language(), { seconds: props.liveLocationInterval() }) || `Cada ${props.liveLocationInterval()} segundos`}
            </span>
          </div>
        </InlineExpander>
      </Group>

      <Show when={props.liveLocationStatus()}>
        <div class={`${styles.statusMsg} ${props.liveLocationEnabled() ? styles.success : styles.error}`}>
          {props.liveLocationStatus()}
        </div>
      </Show>

      <SectionHeader title={t('settings.reset_group', props.language()) || 'ZONA DE PELIGRO'} />
      <Group class={styles.dangerGroup}>
        <Cell
          icon={ICONS.trash} iconBg="iconRed"
          title={t('settings.erase_phone', props.language())}
          subtitle={t('settings.erase_phone_desc', props.language())}
          right="chevron"
          onClick={() => void handleFactoryReset()}
        />
      </Group>
    </div>
  );
}
