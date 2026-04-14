import type { Accessor } from 'solid-js';
import { FormField, Modal, ModalActions, ModalButton } from '../../shared/ui/Modal';
import { t } from '../../../i18n';

interface ChirpAttachUrlModalProps {
  open: Accessor<boolean>;
  onClose: () => void;
  language: Accessor<string>;
  value: Accessor<string>;
  setValue: (value: string) => void;
  onConfirm: () => void;
}

export function ChirpAttachUrlModal(props: ChirpAttachUrlModalProps) {
  return (
    <Modal
      open={props.open()}
      title={t('chirp.attach_url', props.language())}
      onClose={props.onClose}
      size="sm"
    >
      <FormField
        label={t('chirp.media_url', props.language())}
        value={props.value()}
        onChange={props.setValue}
        placeholder="https://..."
      />
      <ModalActions>
        <ModalButton label={t('action.cancel', props.language())} onClick={props.onClose} />
        <ModalButton label={t('messages.attach', props.language())} tone="primary" onClick={props.onConfirm} />
      </ModalActions>
    </Modal>
  );
}
