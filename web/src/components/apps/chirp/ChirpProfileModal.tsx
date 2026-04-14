import type { Accessor } from 'solid-js';
import { FormField, Modal, ModalActions, ModalButton } from '../../shared/ui/Modal';
import { SheetIntro } from '../../shared/ui/SheetIntro';
import { t } from '../../../i18n';
import styles from './ChirpApp.module.scss';

interface ChirpProfileModalProps {
  open: Accessor<boolean>;
  onClose: () => void;
  language: Accessor<string>;
  displayName: Accessor<string>;
  setDisplayName: (value: string) => void;
  isPrivate: Accessor<boolean>;
  setIsPrivate: (value: boolean) => void;
  onSave: () => Promise<void>;
}

export function ChirpProfileModal(props: ChirpProfileModalProps) {
  return (
    <Modal
      open={props.open()}
      title={t('chirp.edit_profile', props.language())}
      onClose={props.onClose}
      size="md"
    >
      <SheetIntro title={t('chirp.profile_title', props.language())} description={t('chirp.profile_desc', props.language())} />
      <FormField
        label={t('chirp.visible_name', props.language())}
        value={props.displayName()}
        onChange={props.setDisplayName}
        placeholder={t('chirp.your_name', props.language())}
        disabled
      />
      <label class={styles.privateToggle}>
        <input
          type="checkbox"
          checked={props.isPrivate()}
          onChange={(e) => props.setIsPrivate(e.currentTarget.checked)}
        />
        <span>{t('chirp.private_account', props.language())}</span>
      </label>
      <ModalActions>
        <ModalButton label={t('action.cancel', props.language())} onClick={props.onClose} />
        <ModalButton label={t('notes.save', props.language())} tone="primary" onClick={() => void props.onSave()} />
      </ModalActions>
    </Modal>
  );
}
