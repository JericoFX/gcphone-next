import { Show } from 'solid-js';
import { getStoredLanguage, tl } from '../../../i18n';
import styles from './ScreenState.module.scss';

interface ScreenStateProps {
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  children: any;
}

export function ScreenState(props: ScreenStateProps) {
  return (
    <>
      <Show when={props.loading}>
        <div class={styles.stateWrap}>
          <div class={styles.loader} />
          <div class={styles.title}>{tl('Cargando...', getStoredLanguage())}</div>
        </div>
      </Show>

      <Show when={!props.loading && props.error}>
        <div class={styles.stateWrap}>
          <div class={styles.title}>{tl('Error', getStoredLanguage())}</div>
          <div class={styles.desc}>{props.error}</div>
        </div>
      </Show>

      <Show when={!props.loading && !props.error && props.empty}>
        <div class={styles.stateWrap}>
          <div class={styles.title}>{tl(props.emptyTitle || 'Sin contenido', getStoredLanguage())}</div>
          <div class={styles.desc}>{tl(props.emptyDescription || 'No hay datos para mostrar.', getStoredLanguage())}</div>
        </div>
      </Show>

      <Show when={!props.loading && !props.error && !props.empty}>{props.children}</Show>
    </>
  );
}
