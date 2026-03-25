import { Show, createSignal } from 'solid-js';
import type { Accessor } from 'solid-js';
import { fetchNui } from '../../../utils/fetchNui';
import { resolveMediaType, sanitizeMediaUrl, sanitizeText } from '../../../utils/sanitize';
import { EmojiPickerButton } from '../../shared/ui/EmojiPicker';
import { MediaActionButtons } from '../../shared/ui/MediaActionButtons';
import { MediaAttachmentPreview } from '../../shared/ui/MediaAttachmentPreview';
import { SegmentedTabs } from '../../shared/ui/SegmentedTabs';
import { SheetIntro } from '../../shared/ui/SheetIntro';
import { FormField, Modal, ModalActions, ModalButton } from '../../shared/ui/Modal';
import { t } from '../../../i18n';
import type { SnapAccount } from './SnapTypes';
import styles from './SnapApp.module.scss';

interface SnapCreatePostModalProps {
  open: Accessor<boolean>;
  onClose: () => void;
  media: Accessor<string>;
  setMedia: (v: string) => void;
  mode: Accessor<'post' | 'story'>;
  setMode: (v: 'post' | 'story') => void;
  loading: Accessor<boolean>;
  myAccount: Accessor<SnapAccount | null>;
  language: Accessor<string>;
  router: { navigate: (app: string, params?: Record<string, string>) => void };
  cache: { invalidate: (key: string) => void };
  onPublished: () => void;
  onStatusMessage: (msg: string) => void;
}

export function SnapCreatePostModal(props: SnapCreatePostModalProps) {
  const [postCaption, setPostCaption] = createSignal('');

  const postModeTabs = [
    { id: 'post', get label() { return t('snap.post_tab', props.language()); } },
    { id: 'story', get label() { return t('snap.story_tab', props.language()); } },
  ];

  const publishPost = async () => {
    const media = sanitizeMediaUrl(props.media());
    if (!media) {
      props.onStatusMessage(t('snap.select_media', props.language()));
      return;
    }
    props.onStatusMessage('');

    if (props.mode() === 'story') {
      const result = await fetchNui<{ success?: boolean }>('snapPublishStory', {
        mediaUrl: media,
        mediaType: resolveMediaType(media),
      });
      if (result?.success) {
        props.setMedia('');
        props.onClose();
        props.onPublished();
      }
    } else {
      const result = await fetchNui<{ success?: boolean }>('snapPublishPost', {
        mediaUrl: media,
        mediaType: resolveMediaType(media),
        caption: sanitizeText(postCaption(), 2200),
      });
      if (result?.success) {
        props.setMedia('');
        setPostCaption('');
        props.onClose();
        props.cache.invalidate('snap:feed');
        props.onPublished();
      }
    }
  };

  const attachFromGallery = async () => {
    const gallery = await fetchNui<any[]>('getGallery', undefined, []);
    if (gallery?.[0]?.url) {
      props.setMedia(sanitizeMediaUrl(gallery[0].url) || '');
    }
  };

  const openCamera = () => {
    const target = props.mode() === 'story' ? 'snap-story' : 'snap-post';
    props.router.navigate('camera', { target });
  };

  const handleClose = () => {
    props.onClose();
    props.setMedia('');
    setPostCaption('');
  };

  return (
    <Modal
      open={props.open()}
      title={props.mode() === 'story' ? t('snap.upload_story', props.language()) : t('snap.new_post', props.language())}
      onClose={handleClose}
      size="md"
    >
      <div class={styles.createContent}>
        <SheetIntro title={t('snap.create', props.language())} description={t('snap.create_desc', props.language())} />
        <div class={styles.modeToggle}>
          <SegmentedTabs items={postModeTabs} active={props.mode()} onChange={(id) => props.setMode(id as 'post' | 'story')} />
        </div>

        <Show when={!props.media()}>
          <MediaActionButtons
            actions={[
              { icon: './img/icons_ios/camera.svg', label: t('chirp.camera', props.language()), onClick: openCamera },
              { icon: './img/icons_ios/gallery.svg', label: t('chirp.gallery', props.language()), onClick: attachFromGallery },
            ]}
            variant="tiles"
          />
        </Show>

        <Show when={props.media()}>
          <MediaAttachmentPreview url={props.media()} removable onRemove={() => props.setMedia('')} />

          <Show when={props.mode() === 'post'}>
            <EmojiPickerButton value={postCaption()} onChange={setPostCaption} maxLength={2200} />
            <textarea
              class={styles.captionInput}
              placeholder={t('snap.caption', props.language())}
              value={postCaption()}
              onInput={(e) => setPostCaption(e.currentTarget.value)}
              rows={3}
            />
          </Show>
        </Show>
      </div>

      <ModalActions>
        <ModalButton label={t('action.cancel', props.language())} onClick={handleClose} />
        <ModalButton
          label={props.loading() ? t('chirp.publishing', props.language()) : t('news.post', props.language())}
          onClick={() => void publishPost()}
          tone="primary"
          disabled={!props.media() || props.loading()}
        />
      </ModalActions>
    </Modal>
  );
}
