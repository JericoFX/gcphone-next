import { For, Show } from 'solid-js';
import type { Accessor } from 'solid-js';
import { generateColorForString, timeAgo } from '../../../utils/misc';
import { getStoredLanguage, t } from '../../../i18n';
import { LetterAvatar } from '../../shared/ui/LetterAvatar';
import { EmptyState } from '../../shared/ui/EmptyState';
import type { WaveStatus, WaveStatusMediaConfig } from './WaveChatTypes';
import styles from './WaveChatApp.module.scss';

interface StatusRows {
  mine: WaveStatus[];
  others: WaveStatus[];
}

export function WaveChatStatusTab(props: {
  statusRows: Accessor<StatusRows>;
  statusMediaConfig: Accessor<WaveStatusMediaConfig>;
  getContactName: (number: string) => string;
  getStatusSummary: (status: WaveStatus) => string;
  onCreatePhotoStatus: () => void;
  onCreateGalleryStatus: () => void;
  onCreateVideoStatus: () => void;
  onOpenStatus: (status: WaveStatus) => void;
}) {
  const language = () => getStoredLanguage();

  return (
    <div class={styles.statusPanel}>
      <div class={styles.statusHero}>
        <div class={styles.statusHeroHeader}>
          <div>
            <span class={styles.statusHeroEyebrow}>WaveChat Status</span>
            <h3>{t('wavechat.status_ephemeral', language())}</h3>
            <p>{t('wavechat.status_desc', language())}</p>
          </div>
          <div class={styles.statusHeroStats}>
            <strong>{props.statusRows().mine.length}</strong>
            <span>{t('wavechat.mine', language())}</span>
          </div>
        </div>
        <div class={styles.statusComposer}>
          <button class={styles.statusBtn} onClick={props.onCreatePhotoStatus} disabled={!props.statusMediaConfig().canUploadImage}>{t('wavechat.photo', language())}</button>
          <button class={styles.statusBtn} onClick={props.onCreateGalleryStatus} disabled={!props.statusMediaConfig().canUploadImage}>{t('wavechat.gallery', language())}</button>
          <button class={styles.statusBtn} onClick={props.onCreateVideoStatus} disabled={!props.statusMediaConfig().canUploadVideo}>{t('wavechat.video_10s', language())}</button>
        </div>
      </div>

      <Show when={props.statusRows().mine.length > 0}>
        <div class={styles.statusSectionTitle}>{t('wavechat.my_status', language())}</div>
        <For each={props.statusRows().mine}>
          {(status) => (
            <div class={styles.statusItem} onClick={() => props.onOpenStatus(status)}>
              <div class={styles.statusRing}>
                <LetterAvatar class={styles.avatar} color={generateColorForString(status.phone_number)} label={status.contact_name || t('wavechat.me', language())} />
              </div>
              <div class={styles.info}>
                <div class={styles.name}>{t('wavechat.my_status', language())}</div>
                <div class={styles.previewText}>{props.getStatusSummary(status)}</div>
              </div>
              <div class={styles.statusMeta}>
                <span class={styles.time}>{timeAgo(status.created_at)}</span>
                <span class={styles.statusBadge}>{status.media_type === 'video' ? t('wavechat.video', language()) : t('wavechat.photo', language())}</span>
              </div>
            </div>
          )}
        </For>
      </Show>

      <div class={styles.statusSectionTitle}>{t('wavechat.recents', language())}</div>
      <Show when={props.statusRows().others.length > 0} fallback={<div class={styles.statusEmpty}>{t('wavechat.no_statuses', language())}</div>}>
        <For each={props.statusRows().others}>
          {(status) => (
            <div class={styles.statusItem} onClick={() => props.onOpenStatus(status)}>
              <div class={styles.statusRing}>
                <LetterAvatar class={styles.avatar} color={generateColorForString(status.phone_number)} label={status.contact_name || props.getContactName(status.phone_number)} />
              </div>
              <div class={styles.info}>
                <div class={styles.name}>{status.contact_name || props.getContactName(status.phone_number)}</div>
                <div class={styles.previewText}>{props.getStatusSummary(status)}</div>
              </div>
              <div class={styles.statusMeta}>
                <span class={styles.time}>{timeAgo(status.created_at)}</span>
                <button class={styles.statusBtn} onClick={(e) => { e.stopPropagation(); props.onOpenStatus(status); }}>{t('wavechat.view', language())}</button>
              </div>
            </div>
          )}
        </For>
      </Show>
    </div>
  );
}
