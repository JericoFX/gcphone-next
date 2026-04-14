import { Show } from 'solid-js';
import type { Accessor } from 'solid-js';
import { FormTextarea, Modal, ModalActions, ModalButton } from '../../shared/ui/Modal';
import { SheetIntro } from '../../shared/ui/SheetIntro';
import { MediaAttachmentPreview } from '../../shared/ui/MediaAttachmentPreview';
import { MediaActionButtons } from '../../shared/ui/MediaActionButtons';
import { sanitizeText } from '../../../utils/sanitize';
import { t } from '../../../i18n';
import type { ChirpTweet } from './ChirpTypes';
import styles from './ChirpApp.module.scss';

interface ChirpRechirpModalProps {
  open: Accessor<boolean>;
  onClose: () => void;
  language: Accessor<string>;
  target: Accessor<ChirpTweet | null>;
  comment: Accessor<string>;
  setComment: (value: string) => void;
  media: Accessor<string>;
  setMedia: (value: string) => void;
  onCameraClick: () => void;
  onGalleryClick: () => Promise<void>;
  onUrlClick: () => void;
  onSubmit: () => void;
}

export function ChirpRechirpModal(props: ChirpRechirpModalProps) {
  return (
    <Modal
      open={props.open()}
      title={t('chirp.rechirp', props.language())}
      onClose={props.onClose}
      size="md"
    >
      <div class={styles.composerContent}>
        <SheetIntro title={t('chirp.rechirp', props.language())} description={t('chirp.rechirp_desc', props.language())} />
        <FormTextarea
          label={t('chirp.optional_comment', props.language())}
          value={props.comment()}
          onChange={(value) => props.setComment(sanitizeText(value, 280))}
          placeholder={t('chirp.rechirp_placeholder', props.language())}
          rows={4}
        />
        <Show when={props.media()}>
          <MediaAttachmentPreview url={props.media()} />
        </Show>
        <div class={styles.composerActions}>
          <MediaActionButtons
            actions={[
              { icon: './img/icons_ios/camera.svg', label: t('chirp.camera', props.language()), onClick: props.onCameraClick },
              { icon: './img/icons_ios/gallery.svg', label: t('chirp.gallery', props.language()), onClick: props.onGalleryClick },
              { icon: './img/icons_ios/ui-link.svg', label: 'URL', onClick: props.onUrlClick },
              ...(props.media() ? [{ icon: './img/icons_ios/ui-close.svg', label: t('chirp.remove', props.language()), onClick: () => props.setMedia(''), tone: 'danger' as const }] : []),
            ]}
            variant="compact"
          />
        </div>
        <Show when={props.target()}>
          {(target) => (
            <div class={styles.quoteCard}>
              <div class={styles.quoteHeader}>
                <strong>{target().display_name || t('chirp.user', props.language())}</strong>
                <span class={styles.username}>@{target().username || 'user'}</span>
              </div>
              <p class={styles.quoteContent}>{target().content}</p>
            </div>
          )}
        </Show>
      </div>
      <ModalActions>
        <ModalButton label={t('action.cancel', props.language())} onClick={props.onClose} />
        <ModalButton label={t('chirp.rechirp_action', props.language())} tone="primary" onClick={props.onSubmit} />
      </ModalActions>
    </Modal>
  );
}
