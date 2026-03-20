import { Show } from 'solid-js';
import { fetchNui } from '../../../utils/fetchNui';
import { SectionHeader } from '../../shared/ui/SectionBlock';
import { uiConfirm } from '../../../utils/uiDialog';
import { t } from '../../../i18n';
import { Cell, Group, IconImage, ICONS } from './settingsShared';
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
        <div class={styles.locationRow}>
          <div class={styles.locationLeft}>
            <div class={`${styles.cellIcon} ${styles.iconBlue}`}><IconImage src={ICONS.location} class={styles.cellIconImage} /></div>
            <div>
              <div class={styles.cellTitle}>{t('settings.share_location', props.language())}</div>
              <div class={styles.cellSubtitle}>{props.liveLocationEnabled() ? t('settings.active', props.language()) : t('settings.inactive', props.language())}</div>
            </div>
          </div>
          <div class={`${styles.switch} ${props.liveLocationEnabled() ? styles.switchActive : ''}`} onClick={() => props.toggleLiveLocation()} role="switch" aria-checked={props.liveLocationEnabled()}>
            <div class={styles.switchThumb} />
          </div>
        </div>
      </Group>

      <Show when={props.liveLocationEnabled()}>
        <div class={styles.freqRow}>
          <button class={styles.freqBtn} onClick={() => props.updateLiveLocationInterval(10)}>{t('settings.every_ten_seconds', props.language())}</button>
        </div>
        <button class={styles.clearBtn} style={{ color: 'var(--danger)', 'font-weight': '700', 'border-color': 'var(--danger)', 'margin-top': '12px' }} onClick={async () => {
          const response = await fetchNui<{ success?: boolean }>('stopLiveLocation', {}, { success: false });
          if (response?.success) { props.setLiveLocationEnabled(false); props.setLiveLocationStatus(t('settings.live_disabled', props.language())); }
        }}>
          Dejar de compartir
        </button>
      </Show>

      <Show when={props.liveLocationStatus()}>
        <div class={`${styles.statusMsg} ${props.liveLocationEnabled() ? styles.success : styles.error}`}>{props.liveLocationStatus()}</div>
      </Show>

      <SectionHeader title={t('settings.reset_group', props.language())} />
      <Group>
        <Cell icon={ICONS.trash} iconBg="iconRed" title={t('settings.erase_phone', props.language())} subtitle={t('settings.erase_phone_desc', props.language())} />
      </Group>
      <button class={styles.clearBtn} onClick={() => void handleFactoryReset()}>
        {t('settings.reset_title', props.language())}
      </button>
    </div>
  );
}
