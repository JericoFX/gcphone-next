import { For, createSignal } from 'solid-js';
import { t } from '../../../i18n';
import { CATEGORIES, getCategoryLabel } from './radioShared';
import styles from './RadioApp.module.scss';

interface RadioCreateProps {
  language: () => string;
  formName: () => string;
  setFormName: (v: string) => void;
  formDescription: () => string;
  setFormDescription: (v: string) => void;
  formCategory: () => string;
  setFormCategory: (v: string) => void;
  creating: () => boolean;
  onSubmit: () => void;
  onCancel: () => void;
}

export function RadioCreate(props: RadioCreateProps) {
  const [nameError, setNameError] = createSignal(false);

  const handleSubmit = () => {
    if (!props.formName().trim()) {
      setNameError(true);
      return;
    }
    setNameError(false);
    props.onSubmit();
  };

  return (
    <div class={styles.createForm}>
      {/* Name + Description */}
      <ul class="ios18-list">
        <li class="ios18-cell" style={{ 'flex-direction': 'column', 'align-items': 'flex-start', gap: '4px' }}>
          <span class="ios18-cell__title">
            {t('radio.form.name', props.language()) || 'Nombre'}
          </span>
          <input
            class="ios18-input"
            type="text"
            placeholder={
              t('radio.form.name_placeholder', props.language())
            }
            value={props.formName()}
            onInput={(e) => {
              props.setFormName(e.currentTarget.value);
              if (nameError()) setNameError(false);
            }}
            maxLength={60}
          />
          <span
            class={styles.formError}
            style={{ display: nameError() ? 'block' : 'none' }}
          >
            {t('radio.form.name_required', props.language()) ||
              'El nombre es obligatorio'}
          </span>
        </li>

        <li class="ios18-cell" style={{ 'flex-direction': 'column', 'align-items': 'flex-start', gap: '4px' }}>
          <span class="ios18-cell__title">
            {t('radio.form.description', props.language()) || 'Descripcion'}
          </span>
          <textarea
            class="ios18-textarea"
            placeholder={
              t('radio.form.description_placeholder', props.language()) ||
              'Descripcion opcional'
            }
            value={props.formDescription()}
            onInput={(e) => props.setFormDescription(e.currentTarget.value)}
            maxLength={200}
            rows={3}
          />
        </li>
      </ul>

      {/* Category segment */}
      <div class="ios-segment" style={{ 'flex-wrap': 'wrap' }}>
        <For each={[...CATEGORIES]}>
          {(cat) => (
            <button
              type="button"
              class="ios-segment-btn"
              classList={{ 'ios-segment-btn-active': props.formCategory() === cat }}
              onClick={() => props.setFormCategory(cat)}
            >
              {getCategoryLabel(cat, props.language())}
            </button>
          )}
        </For>
      </div>

      {/* Actions */}
      <div class={styles.formActions}>
        <button
          type="button"
          class="ios18-cell"
          style={{ cursor: 'pointer', border: 'none' }}
          onClick={props.onCancel}
          disabled={props.creating()}
        >
          <span class="ios18-cell__title">
            {t('common.cancel', props.language()) || 'Cancelar'}
          </span>
        </button>

        <button
          type="button"
          class="ios18-cell"
          style={{
            cursor: 'pointer',
            border: 'none',
            background: 'var(--tint)',
            color: '#fff',
            'border-radius': 'var(--r-lg)',
          }}
          onClick={handleSubmit}
          disabled={props.creating()}
        >
          <span class="ios18-cell__title">
            {props.creating()
              ? t('radio.creating', props.language()) || 'Creando...'
              : t('radio.broadcast', props.language()) || 'Emitir'}
          </span>
        </button>
      </div>
    </div>
  );
}
