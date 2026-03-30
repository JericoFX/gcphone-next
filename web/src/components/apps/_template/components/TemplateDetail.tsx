import { Show } from 'solid-js';
import { Modal, ModalActions, ModalButton } from '@/components/shared/ui/Modal';

interface TemplateItem {
  id: number;
  title: string;
  description: string;
  favorite: boolean;
  createdAt: string;
}

interface TemplateDetailProps {
  item: TemplateItem;
  onClose: () => void;
}

export function TemplateDetail(props: TemplateDetailProps) {
  return (
    <Modal open title={props.item.title} onClose={props.onClose} size="sm">
      <div class="ios-content">
        <p>{props.item.description}</p>
        <Show when={props.item.favorite} fallback={<span class="ios-chip">Not a favorite</span>}>
          <span class="ios-chip">Favorite</span>
        </Show>
        <p style={{ 'font-size': '11px', color: 'var(--text-3)', 'margin-top': '8px' }}>
          {props.item.createdAt}
        </p>
      </div>
      <ModalActions>
        <ModalButton label="Close" onClick={props.onClose} />
      </ModalActions>
    </Modal>
  );
}
