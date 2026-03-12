import { Show } from 'solid-js';
import { getStoredLanguage, t } from '../../../i18n';
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
          <div class={styles.title}>{t('state.loading', getStoredLanguage())}</div>
        </div>
      </Show>

      <Show when={!props.loading && props.error}>
        <div class={styles.stateWrap}>
          <div class={styles.title}>{t('state.error', getStoredLanguage())}</div>
          <div class={styles.desc}>{props.error}</div>
        </div>
      </Show>

      <Show when={!props.loading && !props.error && props.empty}>
        <div class={styles.stateWrap}>
          <div class={styles.title}>{props.emptyTitle || t('state.empty', getStoredLanguage())}</div>
          <div class={styles.desc}>{props.emptyDescription || t('state.empty_desc', getStoredLanguage())}</div>
        </div>
      </Show>

      <Show when={!props.loading && !props.error && !props.empty}>{props.children}</Show>
    </>
  );
}
