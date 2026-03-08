import { Show, mergeProps, splitProps, type JSX, type ParentComponent, type ParentProps } from 'solid-js';
import { getStoredLanguage, tl } from '../../../i18n';
import styles from './Modal.module.scss';

export interface ModalProps extends ParentProps {
  open: boolean;
  title?: string;
  onClose: () => void;
  size?: 'sm' | 'md' | 'lg';
  class?: string;
}

export const Modal: ParentComponent<ModalProps> = (props) => {
  const merged = mergeProps({
    size: 'md' as const,
    class: undefined as string | undefined,
  }, props);

  const [local] = splitProps(merged, ['open', 'title', 'onClose', 'size', 'class', 'children']);

  return (
    <Show when={local.open}>
      <div class={styles.overlay} onClick={local.onClose}>
        <div
          classList={{
            [styles.modal]: true,
            [styles.sm]: local.size === 'sm',
            [styles.lg]: local.size === 'lg',
            [local.class || '']: !!local.class,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <Show when={local.title}>
            <div class={styles.header}>
              <h2 class={styles.title}>{tl(local.title || '', getStoredLanguage())}</h2>
            </div>
          </Show>
          <div class={styles.content}>{local.children}</div>
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
      {tl(props.label, getStoredLanguage())}
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
  const merged = mergeProps({
    type: 'text' as const,
    placeholder: undefined as string | undefined,
    class: undefined as string | undefined,
    disabled: false,
  }, props);

  const [local] = splitProps(merged, ['label', 'value', 'onChange', 'type', 'placeholder', 'class', 'disabled']);

  return (
    <div classList={{ [styles.field]: true, [local.class || '']: !!local.class }}>
      <label class={styles.label}>{tl(local.label, getStoredLanguage())}</label>
      <input
        class="ios-input"
        type={local.type}
        value={local.value}
        onInput={(e) => local.onChange(e.currentTarget.value)}
        placeholder={local.placeholder ? tl(local.placeholder, getStoredLanguage()) : undefined}
        disabled={local.disabled}
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
  const merged = mergeProps({
    placeholder: undefined as string | undefined,
    rows: 3,
    class: undefined as string | undefined,
    disabled: false,
  }, props);

  const [local] = splitProps(merged, ['label', 'value', 'onChange', 'placeholder', 'rows', 'class', 'disabled']);

  return (
    <div classList={{ [styles.field]: true, [local.class || '']: !!local.class }}>
      <label class={styles.label}>{tl(local.label, getStoredLanguage())}</label>
      <textarea
        class="ios-textarea"
        value={local.value}
        onInput={(e) => local.onChange(e.currentTarget.value)}
        placeholder={local.placeholder ? tl(local.placeholder, getStoredLanguage()) : undefined}
        rows={local.rows}
        disabled={local.disabled}
      />
    </div>
  );
}

export interface FormSectionProps extends ParentProps {
  label?: string;
  class?: string;
  labelClass?: string;
  contentClass?: string;
}

export const FormSection: ParentComponent<FormSectionProps> = (props) => {
  return (
    <div classList={{ [styles.field]: true, [props.class || '']: !!props.class }}>
      <Show when={props.label}>
        <label classList={{ [styles.label]: true, [props.labelClass || '']: !!props.labelClass }}>{props.label}</label>
      </Show>
      <div classList={{ [styles.sectionContent]: true, [props.contentClass || '']: !!props.contentClass }}>{props.children}</div>
    </div>
  );
};

export interface FormRowProps extends ParentProps {
  class?: string;
  columns?: 1 | 2 | 3;
}

export const FormRow: ParentComponent<FormRowProps> = (props) => {
  return (
    <div
      classList={{
        [styles.row]: true,
        [styles.rowThree]: props.columns === 3,
        [props.class || '']: !!props.class,
      }}
    >
      {props.children}
    </div>
  );
};

export interface FormCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: JSX.Element | string;
  class?: string;
  labelClass?: string;
  inputClass?: string;
}

export function FormCheckbox(props: FormCheckboxProps) {
  return (
    <label classList={{ [styles.checkboxLabel]: true, [props.labelClass || '']: !!props.labelClass, [props.class || '']: !!props.class }}>
      <input
        class={props.inputClass}
        type="checkbox"
        checked={props.checked}
        onChange={(event) => props.onChange(event.currentTarget.checked)}
      />
      <span>{props.label}</span>
    </label>
  );
}
