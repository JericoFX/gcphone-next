import { Switch, Match, For, Show } from 'solid-js';
import { FormField, FormCheckbox, FormTextarea } from './Modal';
import { sanitizeText } from '../../../utils/sanitize';
import type {
  SDKElement,
  SDKInputElement,
  SDKNumberElement,
  SDKTextareaElement,
  SDKSelectElement,
  SDKCheckboxElement,
  SDKHeaderElement,
  SDKLabelElement,
  SDKImageElement,
  SDKListElement,
  SDKListItem,
} from '../../../types/sdk';
import styles from './PhoneSDKModal.module.scss';

interface ElementProps {
  element: SDKElement;
  formData: Record<string, string | number | boolean>;
  onFormChange: (id: string, value: string | number | boolean) => void;
  onListSelect: (listId: string, itemId: string) => void;
  onNavigate: (viewId: string) => void;
  errors: Record<string, boolean>;
}

function SDKInput(props: { el: SDKInputElement; formData: ElementProps['formData']; onChange: ElementProps['onFormChange']; hasError: boolean }) {
  return (
    <div classList={{ [styles.fieldWrap]: true, [styles.fieldError]: props.hasError }}>
      <FormField
        label={sanitizeText(props.el.label, 60)}
        value={String(props.formData[props.el.id] ?? '')}
        onChange={(v) => {
          const val = props.el.maxLength ? v.slice(0, props.el.maxLength) : v;
          props.onChange(props.el.id, val);
        }}
        type="text"
        placeholder={props.el.placeholder ? sanitizeText(props.el.placeholder, 60) : undefined}
      />
      <Show when={props.hasError}>
        <span class={styles.errorText}>Required</span>
      </Show>
    </div>
  );
}

function SDKNumberInput(props: { el: SDKNumberElement; formData: ElementProps['formData']; onChange: ElementProps['onFormChange']; hasError: boolean }) {
  return (
    <div classList={{ [styles.fieldWrap]: true, [styles.fieldError]: props.hasError }}>
      <FormField
        label={sanitizeText(props.el.label, 60)}
        value={String(props.formData[props.el.id] ?? '')}
        onChange={(v) => {
          if (v === '' || v === '-') {
            props.onChange(props.el.id, v as unknown as number);
            return;
          }
          let num = Number(v);
          if (Number.isNaN(num)) return;
          if (props.el.min !== undefined && num < props.el.min) num = props.el.min;
          if (props.el.max !== undefined && num > props.el.max) num = props.el.max;
          props.onChange(props.el.id, num);
        }}
        type="number"
        placeholder={props.el.placeholder ? sanitizeText(props.el.placeholder, 60) : undefined}
      />
      <Show when={props.hasError}>
        <span class={styles.errorText}>Required</span>
      </Show>
    </div>
  );
}

function SDKTextareaField(props: { el: SDKTextareaElement; formData: ElementProps['formData']; onChange: ElementProps['onFormChange'] }) {
  return (
    <div class={styles.fieldWrap}>
      <FormTextarea
        label={sanitizeText(props.el.label, 60)}
        value={String(props.formData[props.el.id] ?? '')}
        onChange={(v) => {
          const val = props.el.maxLength ? v.slice(0, props.el.maxLength) : v;
          props.onChange(props.el.id, val);
        }}
        placeholder={props.el.placeholder ? sanitizeText(props.el.placeholder, 60) : undefined}
        rows={props.el.rows}
      />
    </div>
  );
}

function SDKSelect(props: { el: SDKSelectElement; formData: ElementProps['formData']; onChange: ElementProps['onFormChange']; hasError: boolean }) {
  return (
    <div classList={{ [styles.fieldWrap]: true, [styles.fieldError]: props.hasError }}>
      <div class={styles.selectField}>
        <label class={styles.selectLabel}>{sanitizeText(props.el.label, 60)}</label>
        <select
          class={styles.selectInput}
          value={String(props.formData[props.el.id] ?? '')}
          onChange={(e) => props.onChange(props.el.id, e.currentTarget.value)}
        >
          <option value="" disabled>Select...</option>
          <For each={props.el.options}>
            {(opt) => <option value={opt.value}>{sanitizeText(opt.label, 60)}</option>}
          </For>
        </select>
      </div>
      <Show when={props.hasError}>
        <span class={styles.errorText}>Required</span>
      </Show>
    </div>
  );
}

function SDKCheckboxField(props: { el: SDKCheckboxElement; formData: ElementProps['formData']; onChange: ElementProps['onFormChange'] }) {
  return (
    <div class={styles.fieldWrap}>
      <FormCheckbox
        label={sanitizeText(props.el.label, 60)}
        checked={Boolean(props.formData[props.el.id])}
        onChange={(v) => props.onChange(props.el.id, v)}
      />
    </div>
  );
}

function SDKHeader(props: { el: SDKHeaderElement }) {
  return <h3 class={styles.elementHeader}>{sanitizeText(props.el.text, 120)}</h3>;
}

function SDKLabel(props: { el: SDKLabelElement }) {
  const tone = () => props.el.tone || 'default';
  return (
    <p classList={{
      [styles.elementLabel]: true,
      [styles.labelMuted]: tone() === 'muted',
      [styles.labelDanger]: tone() === 'danger',
    }}>
      {sanitizeText(props.el.text, 500)}
    </p>
  );
}

function SDKDivider() {
  return <hr class={styles.elementDivider} />;
}

function SDKImage(props: { el: SDKImageElement }) {
  const safeUrl = () => {
    const url = (props.el.url || '').trim();
    if (!url.startsWith('https://')) return '';
    try { new URL(url); return url; } catch { return ''; }
  };

  return (
    <Show when={safeUrl()}>
      <div class={styles.imageWrap}>
        <img
          src={safeUrl()}
          alt=""
          class={styles.image}
          referrerpolicy="no-referrer"
          style={props.el.height ? { 'max-height': `${Math.min(props.el.height, 400)}px` } : undefined}
        />
      </div>
    </Show>
  );
}

function SDKList(props: { el: SDKListElement; onSelect: ElementProps['onListSelect']; onNavigate: ElementProps['onNavigate'] }) {
  const handleClick = (item: SDKListItem) => {
    if (item.disabled) return;
    if (item.navigateTo) {
      props.onNavigate(item.navigateTo);
    } else {
      props.onSelect(props.el.id, item.id);
    }
  };

  return (
    <div class={styles.list}>
      <For each={props.el.items}>
        {(item) => (
          <button
            class={styles.listItem}
            classList={{
              [styles.listItemPrimary]: item.tone === 'primary',
              [styles.listItemDanger]: item.tone === 'danger',
              [styles.listItemDisabled]: !!item.disabled,
            }}
            disabled={item.disabled}
            onClick={() => handleClick(item)}
          >
            <Show when={item.icon}>
              <span class={styles.listItemIcon}>{item.icon}</span>
            </Show>
            <div class={styles.listItemContent}>
              <span class={styles.listItemLabel}>{sanitizeText(item.label, 60)}</span>
              <Show when={item.description}>
                <span class={styles.listItemDesc}>{sanitizeText(item.description || '', 120)}</span>
              </Show>
            </div>
          </button>
        )}
      </For>
    </div>
  );
}

export function SDKElementRenderer(props: ElementProps) {
  return (
    <Switch>
      <Match when={props.element.type === 'input'}>
        <SDKInput
          el={props.element as SDKInputElement}
          formData={props.formData}
          onChange={props.onFormChange}
          hasError={!!(props.element.id && props.errors[props.element.id])}
        />
      </Match>
      <Match when={props.element.type === 'number'}>
        <SDKNumberInput
          el={props.element as SDKNumberElement}
          formData={props.formData}
          onChange={props.onFormChange}
          hasError={!!(props.element.id && props.errors[props.element.id])}
        />
      </Match>
      <Match when={props.element.type === 'textarea'}>
        <SDKTextareaField
          el={props.element as SDKTextareaElement}
          formData={props.formData}
          onChange={props.onFormChange}
        />
      </Match>
      <Match when={props.element.type === 'select'}>
        <SDKSelect
          el={props.element as SDKSelectElement}
          formData={props.formData}
          onChange={props.onFormChange}
          hasError={!!(props.element.id && props.errors[props.element.id])}
        />
      </Match>
      <Match when={props.element.type === 'checkbox'}>
        <SDKCheckboxField
          el={props.element as SDKCheckboxElement}
          formData={props.formData}
          onChange={props.onFormChange}
        />
      </Match>
      <Match when={props.element.type === 'header'}>
        <SDKHeader el={props.element as SDKHeaderElement} />
      </Match>
      <Match when={props.element.type === 'label'}>
        <SDKLabel el={props.element as SDKLabelElement} />
      </Match>
      <Match when={props.element.type === 'divider'}>
        <SDKDivider />
      </Match>
      <Match when={props.element.type === 'image'}>
        <SDKImage el={props.element as SDKImageElement} />
      </Match>
      <Match when={props.element.type === 'list'}>
        <SDKList
          el={props.element as SDKListElement}
          onSelect={props.onListSelect}
          onNavigate={props.onNavigate}
        />
      </Match>
    </Switch>
  );
}
