import { For, Show } from 'solid-js';
import type { Accessor } from 'solid-js';
import { Modal, ModalActions, ModalButton } from '../../shared/ui/Modal';
import { t } from '../../../i18n';
import type { ChirpFollowRequest } from './ChirpTypes';
import styles from './ChirpApp.module.scss';

interface ChirpRequestsModalProps {
  open: Accessor<boolean>;
  onClose: () => void;
  pendingRequests: Accessor<ChirpFollowRequest[]>;
  sentRequests: Accessor<ChirpFollowRequest[]>;
  requestsLoading: Accessor<boolean>;
  language: Accessor<string>;
  onRespond: (id: number, accept: boolean) => Promise<void>;
  onCancel: (accountId: number) => Promise<void>;
}

export function ChirpRequestsModal(props: ChirpRequestsModalProps) {
  return (
    <Modal
      open={props.open()}
      title={t('chirp.requests', props.language())}
      onClose={props.onClose}
      size="md"
    >
      <div class={styles.requestsWrap}>
        <div class={styles.requestsSection}>
          <h4>{t('chirp.requests_received', props.language())}</h4>
          <Show when={!props.requestsLoading()} fallback={<p>{t('state.loading', props.language())}</p>}>
            <For each={props.pendingRequests()}>
              {(request) => (
                <div class={styles.requestRow}>
                  <div class={styles.requestIdentity}>
                    <strong>{request.display_name || request.username || t('chirp.user', props.language())}</strong>
                    <span>@{request.username || 'user'}</span>
                  </div>
                  <div class={styles.requestActions}>
                    <button class={styles.ghostBtn} onClick={() => void props.onRespond(request.id, false)}>{t('wallet.reject', props.language())}</button>
                    <button class={styles.primaryBtn} onClick={() => void props.onRespond(request.id, true)}>{t('chirp.accept', props.language())}</button>
                  </div>
                </div>
              )}
            </For>
            <Show when={props.pendingRequests().length === 0}>
              <p>{t('chirp.no_pending_requests', props.language())}</p>
            </Show>
          </Show>
        </div>

        <div class={styles.requestsSection}>
          <h4>{t('chirp.requests_sent', props.language())}</h4>
          <Show when={!props.requestsLoading()} fallback={<p>{t('state.loading', props.language())}</p>}>
            <For each={props.sentRequests()}>
              {(request) => (
                <div class={styles.requestRow}>
                  <div class={styles.requestIdentity}>
                    <strong>{request.display_name || request.username || t('chirp.user', props.language())}</strong>
                    <span>@{request.username || 'user'}</span>
                  </div>
                  <div class={styles.requestActions}>
                    <button class={styles.ghostBtn} onClick={() => void props.onCancel(request.account_id)}>{t('action.cancel', props.language())}</button>
                  </div>
                </div>
              )}
            </For>
            <Show when={props.sentRequests().length === 0}>
              <p>{t('chirp.no_sent_requests', props.language())}</p>
            </Show>
          </Show>
        </div>
      </div>

      <ModalActions>
        <ModalButton label={t('control.close', props.language())} onClick={props.onClose} />
      </ModalActions>
    </Modal>
  );
}
