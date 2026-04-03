import type { Accessor } from 'solid-js';
import { sanitizeText } from '../../../utils/sanitize';
import { t } from '../../../i18n';
import { FormField } from '../../shared/ui/Modal';
import styles from './SnapApp.module.scss';

interface SnapProfileTabProps {
  language: Accessor<string>;
  profileDisplayName: Accessor<string>;
  setProfileDisplayName: (value: string) => void;
  profilePrivate: Accessor<boolean>;
  setProfilePrivate: (value: boolean) => void;
  onSaveProfile: () => void;
}

export function SnapProfileTab(props: SnapProfileTabProps) {
  return (
    <div class={styles.profileTab}>
      <h4 class={styles.sectionTitle}>{t('chirp.profile', props.language())}</h4>

      <div class={styles.profileHelper}>
        {t('snap.profile_hint', props.language())}
      </div>

      <FormField
        label={t('chirp.visible_name', props.language())}
        value={props.profileDisplayName()}
        onChange={(value) => props.setProfileDisplayName(sanitizeText(value, 50))}
        placeholder={t('chirp.your_name', props.language())}
        disabled
      />

      <label class={styles.privacyRow}>
        <input
          type="checkbox"
          checked={props.profilePrivate()}
          onChange={(e) => props.setProfilePrivate(e.currentTarget.checked)}
        />
        <span>{t('chirp.private', props.language())}</span>
      </label>

      <div class={styles.profileSaveRow}>
        <button class={styles.acceptBtn} onClick={() => void props.onSaveProfile()}>
          {t('news.save_profile', props.language())}
        </button>
      </div>
    </div>
  );
}
