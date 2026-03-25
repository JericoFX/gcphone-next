import { For, Show } from 'solid-js';
import type { Accessor } from 'solid-js';
import { EmptyState } from '../../shared/ui/EmptyState';
import { Modal } from '../../shared/ui/Modal';
import { SheetIntro } from '../../shared/ui/SheetIntro';
import { t } from '../../../i18n';
import type { SnapFollowRequest } from './SnapTypes';
import styles from './SnapApp.module.scss';

interface SnapRequestsModalProps {
  open: Accessor<boolean>;
  onClose: () => void;
  pendingRequests: Accessor<SnapFollowRequest[]>;
  sentRequests: Accessor<SnapFollowRequest[]>;
  requestsLoading: Accessor<boolean>;
  language: Accessor<string>;
  onRespond: (id: number, accept: boolean) => Promise<void>;
  onCancel: (accountId: number) => Promise<void>;
}

export function SnapRequestsModal(props: SnapRequestsModalProps) {
  return (
    <Modal
      open={props.open()}
      title={t('chirp.requests', props.language())}
      onClose={props.onClose}
      size="lg"
    >
      <div class={styles.requestsBlock}>
        <SheetIntro title={t('chirp.requests', props.language())} description={t('snap.requests_desc', props.language())} />
        <h4>{t('chirp.requests_received', props.language())}</h4>
        <Show when={!props.requestsLoading()} fallback={<p>{t('state.loading', props.language())}</p>}>
          <Show when={props.pendingRequests().length > 0} fallback={<EmptyState title={t('snap.no_pending', props.language())} description={t('snap.no_pending_desc', props.language())} />}>
            <For each={props.pendingRequests()}>
              {(request) => (
                <div class={styles.requestRow}>
                  <div class={styles.requestIdentity}>
                    <strong>{request.display_name || request.username || t('snap.user_fallback', props.language())}</strong>
                    <span>@{request.username || request.from_identifier || 'user'}</span>
                  </div>
                  <div class={styles.requestActions}>
                    <button onClick={() => void props.onRespond(request.id, false)}>{t('wallet.reject', props.language())}</button>
                    <button class={styles.acceptBtn} onClick={() => void props.onRespond(request.id, true)}>{t('chirp.accept', props.language())}</button>
                  </div>
                </div>
              )}
            </For>
          </Show>
        </Show>
      </div>

      <div class={styles.requestsBlock}>
        <h4>{t('chirp.requests_sent', props.language())}</h4>
        <Show when={props.sentRequests().length > 0} fallback={<EmptyState title={t('snap.no_sent', props.language())} description={t('snap.no_sent_desc', props.language())} />}>
          <For each={props.sentRequests()}>
            {(request) => (
              <div class={styles.requestRow}>
                <div class={styles.requestIdentity}>
                  <strong>{request.display_name || request.username || t('snap.user_fallback', props.language())}</strong>
                  <span>@{request.username || request.to_identifier || 'user'}</span>
                </div>
                <div class={styles.requestActions}>
                  <button onClick={() => void props.onCancel(request.account_id)}>{t('action.cancel', props.language())}</button>
                </div>
              </div>
            )}
          </For>
        </Show>
      </div>
    </Modal>
  );
}
