import { formatPhoneNumber } from '../../../utils/misc';
import { t } from '../../../i18n';
import { Group, IconImage, ICONS } from './settingsShared';
import styles from './SettingsApp.module.scss';

interface SettingsAboutProps {
  language: () => string;
  phoneState: any;
}

export function SettingsAbout(props: SettingsAboutProps) {
  const version = () => props.phoneState.resourceVersion || '2.1.0';
  const author = () => props.phoneState.resourceAuthor || 'JericoFX';

  return (
    <div class={styles.content}>
      <div class={styles.aboutHeader}>
        <div class={styles.aboutIcon}><IconImage src={ICONS.appIcon} class={styles.aboutIconImage} alt="GCPhone Next" /></div>
        <div class={styles.aboutName}>GCPhone Next</div>
        <div class={styles.aboutVersion}>{t('settings.version_label', props.language())} {version()}</div>
      </div>
      <Group>
        <div class={styles.infoRow}>
          <span class={styles.infoLabel}>{t('settings.number', props.language())}</span>
          <span class={styles.infoValue}>{props.phoneState.settings.phoneNumber ? formatPhoneNumber(props.phoneState.settings.phoneNumber, props.phoneState.framework || 'unknown') : t('settings.unassigned', props.language())}</span>
        </div>
        <div class={styles.infoRow}>
          <span class={styles.infoLabel}>{t('settings.visual_framework', props.language())}</span>
          <span class={styles.infoValue}>{props.phoneState.framework || 'unknown'}</span>
        </div>
        <div class={styles.infoRow}>
          <span class={styles.infoLabel}>{t('settings.platform', props.language())}</span>
          <span class={styles.infoValue}>FiveM</span>
        </div>
        <div class={styles.infoRow}>
          <span class={styles.infoLabel}>Author</span>
          <span class={styles.infoValue}>{author()}</span>
        </div>
      </Group>
    </div>
  );
}
