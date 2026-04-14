import type { Accessor } from 'solid-js';
import { Modal, ModalActions, ModalButton } from '../../shared/ui/Modal';
import { SheetIntro } from '../../shared/ui/SheetIntro';
import { MediaActionButtons } from '../../shared/ui/MediaActionButtons';
import { MediaAttachmentPreview } from '../../shared/ui/MediaAttachmentPreview';
import { sanitizeMediaUrl, sanitizeText } from '../../../utils/sanitize';
import { t } from '../../../i18n';
import styles from './NewsApp.module.scss';

interface NewsComposeModalProps {
  open: Accessor<boolean>;
  onClose: () => void;
  language: Accessor<string>;
  title: Accessor<string>;
  setTitle: (value: string) => void;
  content: Accessor<string>;
  setContent: (value: string) => void;
  mediaUrl: Accessor<string>;
  setMediaUrl: (value: string) => void;
  category: Accessor<string>;
  setCategory: (value: string) => void;
  onAttachFromGallery: () => void;
  onAttachFromCamera: () => void;
  onAttachByUrl: () => void;
  onOpenMedia: () => void;
  onPublish: () => Promise<void>;
}

export function NewsComposeModal(props: NewsComposeModalProps) {
  return (
    <Modal open={props.open()} title={t('news.publish', props.language())} onClose={props.onClose} size="lg">
      <div class={styles.modalContent}>
        <SheetIntro title="Nueva cobertura" description="Publica un titular claro, agrega contexto y adjunta media si ayuda a contar la historia." />
        <input type="text" placeholder="Titulo" value={props.title()} onInput={(event) => props.setTitle(event.currentTarget.value)} />
        <textarea placeholder="Contenido" value={props.content()} onInput={(event) => props.setContent(event.currentTarget.value)} />
        <div class={styles.composeAttachments}>
          <MediaActionButtons
            actions={[
              { icon: './img/icons_ios/gallery.svg', label: t('camera.gallery', props.language()), onClick: props.onAttachFromGallery },
              { icon: './img/icons_ios/camera.svg', label: t('chirp.camera', props.language()), onClick: props.onAttachFromCamera },
              { icon: './img/icons_ios/ui-link.svg', label: 'URL', onClick: props.onAttachByUrl },
              ...(props.mediaUrl() ? [{ icon: './img/icons_ios/ui-close.svg', label: 'Quitar', onClick: () => props.setMediaUrl(''), tone: 'danger' as const }] : []),
            ]}
            variant="compact"
            class={styles.composeMediaButtons}
          />
          <input type="text" placeholder="URL media (opcional)" value={props.mediaUrl()} onInput={(event) => props.setMediaUrl(sanitizeMediaUrl(event.currentTarget.value))} />
        </div>
        <MediaAttachmentPreview url={props.mediaUrl()} mediaClass={styles.composePreviewMedia} onOpen={props.onOpenMedia} />
        <input type="text" placeholder="Categoria" value={props.category()} onInput={(event) => props.setCategory(sanitizeText(event.currentTarget.value, 30))} />
        <ModalActions>
          <ModalButton label={t('action.cancel', props.language())} onClick={props.onClose} />
          <ModalButton label={t('news.post', props.language())} tone="primary" onClick={() => void props.onPublish()} />
        </ModalActions>
      </div>
    </Modal>
  );
}
