import { Show } from 'solid-js';
import type { Accessor } from 'solid-js';
import { Modal, ModalActions, ModalButton } from '../../shared/ui/Modal';
import { SheetIntro } from '../../shared/ui/SheetIntro';
import { MediaAttachmentPreview } from '../../shared/ui/MediaAttachmentPreview';
import { MediaActionButtons } from '../../shared/ui/MediaActionButtons';
import { EmojiPickerButton } from '../../shared/ui/EmojiPicker';
import { t } from '../../../i18n';
import styles from './ChirpApp.module.scss';

interface ChirpComposerModalProps {
  open: Accessor<boolean>;
  onClose: () => void;
  language: Accessor<string>;
  text: Accessor<string>;
  setText: (value: string) => void;
  charCount: Accessor<number>;
  media: Accessor<string>;
  setMedia: (value: string) => void;
  crossPostSnap: Accessor<boolean>;
  setCrossPostSnap: (value: boolean) => void;
  loading: Accessor<boolean>;
  onPublish: () => Promise<void>;
  onOpenCamera: () => void;
  onAttachFromGallery: () => Promise<void>;
  onAttachByUrl: () => void;
}

export function ChirpComposerModal(props: ChirpComposerModalProps) {
  return (
    <Modal
      open={props.open()}
      title={t('chirp.new', props.language())}
      onClose={props.onClose}
      size="md"
    >
      <div class={styles.composerContent}>
        <SheetIntro title={t('chirp.new', props.language())} description={t('chirp.new_desc', props.language())} />
        <EmojiPickerButton value={props.text()} onChange={props.setText} maxLength={280} />
        <textarea
          class={styles.composerTextarea}
          placeholder={t('chirp.placeholder', props.language())}
          value={props.text()}
          onInput={(e) => props.setText(e.currentTarget.value)}
          maxlength={280}
          rows={4}
        />

        <div class={styles.charCounter}>
          <span classList={{ [styles.limitReached]: props.charCount() >= 280 }}>
            {props.charCount()}/280
          </span>
        </div>

        <Show when={props.media()}>
          <MediaAttachmentPreview url={props.media()} />
        </Show>

        <div class={styles.composerActions}>
          <MediaActionButtons
            actions={[
              { icon: './img/icons_ios/camera.svg', label: t('chirp.camera', props.language()), onClick: props.onOpenCamera },
              { icon: './img/icons_ios/gallery.svg', label: t('chirp.gallery', props.language()), onClick: props.onAttachFromGallery },
              { icon: './img/icons_ios/ui-link.svg', label: 'URL', onClick: props.onAttachByUrl },
              ...(props.media() ? [{ icon: './img/icons_ios/ui-close.svg', label: t('chirp.remove', props.language()), onClick: () => props.setMedia(''), tone: 'danger' as const }] : []),
            ]}
            variant="compact"
          />
        </div>

        <Show when={props.media()}>
          <label class={styles.crossPostToggle}>
            <input type="checkbox" checked={props.crossPostSnap()} onChange={(e) => props.setCrossPostSnap(e.currentTarget.checked)} />
            <span>{t('chirp.cross_post_snap', props.language()) || 'Publicar en Snap'}</span>
          </label>
        </Show>
      </div>

      <ModalActions>
        <ModalButton label={t('action.cancel', props.language())} onClick={props.onClose} />
        <ModalButton
          label={props.loading() ? t('chirp.publishing', props.language()) : t('chirp.publish', props.language())}
          onClick={() => void props.onPublish()}
          tone="primary"
          disabled={!props.text().trim() || props.charCount() > 280 || props.loading()}
        />
      </ModalActions>
    </Modal>
  );
}
