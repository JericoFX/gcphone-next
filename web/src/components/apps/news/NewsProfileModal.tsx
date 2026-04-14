import type { Accessor } from 'solid-js';
import { Modal, ModalActions, ModalButton } from '../../shared/ui/Modal';
import { SheetIntro } from '../../shared/ui/SheetIntro';
import { MediaActionButtons } from '../../shared/ui/MediaActionButtons';
import { MediaAttachmentPreview } from '../../shared/ui/MediaAttachmentPreview';
import { sanitizeMediaUrl } from '../../../utils/sanitize';
import { t } from '../../../i18n';
import styles from './NewsApp.module.scss';

interface NewsProfileModalProps {
  open: Accessor<boolean>;
  onClose: () => void;
  language: Accessor<string>;
  displayName: Accessor<string>;
  setDisplayName: (value: string) => void;
  bio: Accessor<string>;
  setBio: (value: string) => void;
  avatar: Accessor<string>;
  setAvatar: (value: string) => void;
  onAttachFromGallery: () => void;
  onAttachFromCamera: () => void;
  onOpenAvatar: () => void;
  onSave: () => Promise<void>;
}

export function NewsProfileModal(props: NewsProfileModalProps) {
  return (
    <Modal open={props.open()} title={t('news.profile_title', props.language())} onClose={props.onClose} size="md">
      <div class={styles.modalContent}>
        <SheetIntro title={t('news.editorial_profile', props.language())} description={t('news.editorial_profile_desc', props.language())} />
        <input
          type="text"
          placeholder="Nombre visible"
          value={props.displayName()}
          onInput={(event) => props.setDisplayName(event.currentTarget.value)}
        />
        <textarea
          placeholder="Bio o firma editorial"
          value={props.bio()}
          onInput={(event) => props.setBio(event.currentTarget.value)}
        />
        <div class={styles.composeAttachments}>
          <MediaActionButtons
            actions={[
              { icon: './img/icons_ios/gallery.svg', label: t('camera.gallery', props.language()), onClick: props.onAttachFromGallery },
              { icon: './img/icons_ios/camera.svg', label: t('chirp.camera', props.language()), onClick: props.onAttachFromCamera },
              ...(props.avatar() ? [{ icon: './img/icons_ios/ui-close.svg', label: 'Quitar', onClick: () => props.setAvatar(''), tone: 'danger' as const }] : []),
            ]}
            variant="compact"
            class={styles.composeMediaButtons}
          />
          <input type="text" placeholder="URL de avatar" value={props.avatar()} onInput={(event) => props.setAvatar(sanitizeMediaUrl(event.currentTarget.value) || '')} />
        </div>
        <MediaAttachmentPreview url={props.avatar()} mediaClass={styles.composePreviewMedia} onOpen={props.onOpenAvatar} />
        <ModalActions>
          <ModalButton label={t('action.cancel', props.language())} onClick={props.onClose} />
          <ModalButton label={t('news.save_profile', props.language())} tone="primary" onClick={() => void props.onSave()} />
        </ModalActions>
      </div>
    </Modal>
  );
}
