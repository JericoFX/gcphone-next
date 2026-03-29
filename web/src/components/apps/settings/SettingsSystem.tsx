import { Show } from 'solid-js';
import { fetchNui } from '../../../utils/fetchNui';
import { SectionHeader } from '../../shared/ui/SectionBlock';
import { uiConfirm } from '../../../utils/uiDialog';
import { t } from '../../../i18n';
import { IconImage, ICONS } from './settingsShared';
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
      <div class="ios18-list">
        <div class="ios18-cell">
          <div style={{ display: 'flex', 'align-items': 'center', gap: '8px', flex: '1' }}>
            <div class={`${styles.settingsIcon} ${styles.iconGreen}`}>
              <IconImage src={ICONS.location} class={styles.settingsIconImg} />
            </div>
            <div style={{ display: 'flex', 'flex-direction': 'column', gap: '1px' }}>
              <span class="ios18-cell__title">
                {t('settings.share_location', props.language())}
              </span>
              <span class="ios18-cell__subtitle">
                {props.liveLocationEnabled()
                  ? t('settings.active', props.language())
                  : t('settings.inactive', props.language())}
              </span>
            </div>
          </div>
          <div
            class="ios18-switch"
            role="switch"
            aria-checked={props.liveLocationEnabled()}
            onClick={() => props.toggleLiveLocation()}
          >
            <div class="ios18-switch__thumb" />
          </div>
        </div>

        <Show when={props.liveLocationEnabled()}>
          <div class={styles.liveStatus}>
            <span class={styles.pulseDot} />
            <span class={styles.liveText}>
              {t('settings.live_enabled_every', props.language(), { seconds: props.liveLocationInterval() }) || `Cada ${props.liveLocationInterval()} segundos`}
            </span>
          </div>
        </Show>
      </div>

      <Show when={props.liveLocationStatus()}>
        <div class={`${styles.statusMsg} ${props.liveLocationEnabled() ? styles.success : styles.error}`}>
          {props.liveLocationStatus()}
        </div>
      </Show>

      <SectionHeader title={t('settings.reset_group', props.language()) || 'ZONA DE PELIGRO'} />
      <div class="ios18-list" classList={{ [styles.dangerGroup]: true }}>
        <button
          class="ios18-cell"
          style={{ cursor: 'pointer' }}
          onClick={() => void handleFactoryReset()}
        >
          <div style={{ display: 'flex', 'align-items': 'center', gap: '8px', flex: '1' }}>
            <div class={`${styles.settingsIcon} ${styles.iconRed}`}>
              <IconImage src={ICONS.trash} class={styles.settingsIconImg} />
            </div>
            <div style={{ display: 'flex', 'flex-direction': 'column', gap: '1px' }}>
              <span class="ios18-cell__title">{t('settings.erase_phone', props.language())}</span>
              <span class="ios18-cell__subtitle">{t('settings.erase_phone_desc', props.language())}</span>
            </div>
          </div>
          <div class={styles.chevron} />
        </button>
      </div>
    </div>
  );
}
