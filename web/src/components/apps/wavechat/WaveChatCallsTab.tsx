import { Show } from 'solid-js';
import type { Accessor } from 'solid-js';
import { formatPhoneNumber, timeAgo } from '../../../utils/misc';
import { fetchNui } from '../../../utils/fetchNui';
import { getStoredLanguage, t } from '../../../i18n';
import { EmptyState } from '../../shared/ui/EmptyState';
import { VirtualList } from '../../shared/ui/VirtualList';
import styles from './WaveChatApp.module.scss';

export function WaveChatCallsTab(props: {
  callHistory: Accessor<any[]>;
  framework: string;
}) {
  const language = () => getStoredLanguage();

  return (
    <Show when={props.callHistory().length > 0} fallback={<EmptyState class={styles.emptyState} title={t('wavechat.no_recent_calls', language())} description={t('wavechat.no_recent_calls_desc', language())} />}>
      <VirtualList items={props.callHistory} itemHeight={72} overscan={4}>
        {(call) => (
          <div class={styles.callItem}>
            <div class={styles.callDirection}>{call.incoming ? t('wavechat.incoming', language()) : t('wavechat.outgoing', language())}</div>
            <div class={styles.info}>
              <div class={styles.name}>{call.hidden ? t('wavechat.private', language()) : formatPhoneNumber(call.num, props.framework || 'unknown')}</div>
              <div class={styles.previewText}>{timeAgo(call.time)}</div>
            </div>
            <button class={styles.statusBtn} onClick={() => fetchNui('startCall', { phoneNumber: call.num })}>{t('wavechat.call', language())}</button>
          </div>
        )}
      </VirtualList>
    </Show>
  );
}
