import { Show, type ParentComponent, type ParentProps } from 'solid-js';
import styles from './Modal.module.scss';

export interface ModalProps extends ParentProps {
  open: boolean;
  title?: string;
  onClose: () => void;
  size?: 'sm' | 'md' | 'lg';
  class?: string;
}

export const Modal: ParentComponent<ModalProps> = (props) => {
  return (
    <Show when={props.open}>
      <div class={styles.overlay} onClick={props.onClose}>
        <div
          classList={{
            [styles.modal]: true,
            [styles.sm]: props.size === 'sm',
            [styles.lg]: props.size === 'lg',
            [props.class || '']: !!props.class,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <Show when={props.title}>
            <div class={styles.header}>
              <h2 class={styles.title}>{props.title}</h2>
            </div>
          </Show>
          <div class={styles.content}>{props.children}</div>
        </div>
      </div>
    </Show>
  );
};

export interface ModalActionsProps extends ParentProps {
  class?: string;
}

export const ModalActions: ParentComponent<ModalActionsProps> = (props) => {
  return <div classList={{ [styles.actions]: true, [props.class || '']: !!props.class }}>{props.children}</div>;
};

export interface ModalButtonProps {
  label: string;
  onClick: () => void;
  tone?: 'default' | 'primary' | 'danger';
  class?: string;
  disabled?: boolean;
}

export function ModalButton(props: ModalButtonProps) {
  return (
    <button
      classList={{
        [styles.button]: true,
        [styles.primary]: props.tone === 'primary',
        [styles.danger]: props.tone === 'danger',
        [props.class || '']: !!props.class,
      }}
      onClick={props.onClick}
      disabled={props.disabled}
    >
      {props.label}
    </button>
  );
}

export interface FormFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'number' | 'tel' | 'url';
  placeholder?: string;
  class?: string;
  disabled?: boolean;
}

export function FormField(props: FormFieldProps) {
  return (
    <div classList={{ [styles.field]: true, [props.class || '']: !!props.class }}>
      <label class={styles.label}>{props.label}</label>
      <input
        class="ios-input"
        type={props.type || 'text'}
        value={props.value}
        onInput={(e) => props.onChange(e.currentTarget.value)}
        placeholder={props.placeholder}
        disabled={props.disabled}
      />
    </div>
  );
}

export interface FormTextareaProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  class?: string;
  disabled?: boolean;
}

export function FormTextarea(props: FormTextareaProps) {
  return (
    <div classList={{ [styles.field]: true, [props.class || '']: !!props.class }}>
      <label class={styles.label}>{props.label}</label>
      <textarea
        class="ios-textarea"
        value={props.value}
        onInput={(e) => props.onChange(e.currentTarget.value)}
        placeholder={props.placeholder}
        rows={props.rows || 3}
        disabled={props.disabled}
      />
    </div>
  );
}
