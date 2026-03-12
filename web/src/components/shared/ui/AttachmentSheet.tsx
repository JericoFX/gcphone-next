import { Show } from 'solid-js';
import { getStoredLanguage, t } from '../../../i18n';
import { ActionSheet, type ActionSheetAction } from './ActionSheet';
import type { UseMediaAttachmentOptions } from '@/hooks/useMediaAttachment';

export interface AttachmentSheetProps {
  open: boolean;
  onClose: () => void;
  onGallery: () => void;
  onCamera: () => void;
  onUrl: () => void;
  onRemove?: () => void;
  hasAttachment?: boolean;
  title?: string;
}

export function AttachmentSheet(props: AttachmentSheetProps) {
  const actions = (): ActionSheetAction[] => {
    const base: ActionSheetAction[] = [
      { label: t('attachment.from_gallery', getStoredLanguage()), tone: 'primary', onClick: props.onGallery },
      { label: t('attachment.take_photo', getStoredLanguage()), onClick: props.onCamera },
      { label: t('attachment.paste_url', getStoredLanguage()), onClick: props.onUrl },
    ];

    if (props.hasAttachment && props.onRemove) {
      base.push({ label: t('messages.remove_attachment', getStoredLanguage()), tone: 'danger', onClick: props.onRemove });
    }

    return base;
  };

  return (
    <ActionSheet
      open={props.open}
      title={props.title || t('messages.attach', getStoredLanguage())}
      onClose={props.onClose}
      actions={actions()}
    />
  );
}
