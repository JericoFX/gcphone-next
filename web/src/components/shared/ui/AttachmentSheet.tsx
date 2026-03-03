import { Show } from 'solid-js';
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
      { label: 'Elegir desde galeria', tone: 'primary', onClick: props.onGallery },
      { label: 'Tomar foto con camara', onClick: props.onCamera },
      { label: 'Pegar URL multimedia', onClick: props.onUrl },
    ];

    if (props.hasAttachment && props.onRemove) {
      base.push({ label: 'Quitar adjunto', tone: 'danger', onClick: props.onRemove });
    }

    return base;
  };

  return (
    <ActionSheet
      open={props.open}
      title={props.title || 'Adjuntar'}
      onClose={props.onClose}
      actions={actions()}
    />
  );
}
