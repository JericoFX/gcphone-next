import { createSelector, For, Show } from 'solid-js';
import type { Accessor } from 'solid-js';
import { generateColorForString, formatPhoneNumber, timeAgo } from '../../../utils/misc';
import { resolveMediaType } from '../../../utils/sanitize';
import { sanitizePhone, sanitizeText } from '../../../utils/sanitize';
import { isWaveSocketConnected, sendWaveTyping } from '../../../utils/socket';
import { getStoredLanguage, t } from '../../../i18n';
import { LetterAvatar } from '../../shared/ui/LetterAvatar';
import { EmojiPickerButton } from '../../shared/ui/EmojiPicker';
import { Modal, ModalActions, ModalButton } from '../../shared/ui/Modal';
import { SearchInput } from '../../shared/ui/SearchInput';
import { SheetIntro } from '../../shared/ui/SheetIntro';
import { VirtualList } from '../../shared/ui/VirtualList';
import type { WaveChatGroup, WaveChatInvite, WaveChatGroupMessage } from './WaveChatTypes';
import styles from './WaveChatApp.module.scss';

interface SelectableContact {
  display: string;
  number: string;
}

export function WaveChatGroupsTab(props: {
  groups: Accessor<WaveChatGroup[]>;
  groupInvites: Accessor<WaveChatInvite[]>;
  selectedGroupId: Accessor<number | null>;
  selectedGroupMessages: Accessor<WaveChatGroupMessage[]>;
  selectedGroupTypingList: Accessor<string[]>;
  groupMessageInput: Accessor<string>;
  setGroupMessageInput: (value: string) => void;
  socketReady: Accessor<boolean>;
  isRecordingVoice: Accessor<boolean>;
  recordingSeconds: Accessor<number>;
  showCreateGroupModal: Accessor<boolean>;
  groupNameDraft: Accessor<string>;
  groupContactSearch: Accessor<string>;
  groupMemberDraft: Accessor<string[]>;
  selectableContacts: Accessor<SelectableContact[]>;
  framework: string;
  getContactName: (number: string) => string;
  onSelectGroup: (groupId: number) => void;
  onRespondToInvite: (inviteId: number, accept: boolean) => void;
  onSendGroupMessage: () => void;
  onStartVoiceRecording: () => void;
  onStopVoiceRecording: () => void;
  onOpenViewer: (url: string | null) => void;
  onShowCreateGroupModal: (show: boolean) => void;
  onSetGroupNameDraft: (value: string) => void;
  onSetGroupContactSearch: (value: string) => void;
  onToggleGroupMember: (number: string) => void;
  onCreateGroup: () => void;
  onCloseCreateGroupModal: () => void;
}) {
  const language = () => getStoredLanguage();
  const isSelectedGroup = createSelector(props.selectedGroupId);

  return (
    <>
      <Show when={props.groupInvites().length > 0}>
        <div class={styles.groupInvitesPanel}>
          <div class={styles.statusSectionTitle}>{t('wavechat.pending_invites', language())}</div>
          <For each={props.groupInvites()}>
            {(invite) => (
              <div class={styles.groupInviteItem}>
                <div class={styles.info}>
                  <div class={styles.name}>{invite.group_name}</div>
                  <div class={styles.previewText}>{t('wavechat.invited_you', language(), { name: invite.inviter_number ? props.getContactName(invite.inviter_number) : t('wavechat.a_contact', language()) })}</div>
                </div>
                <div class={styles.groupInviteActions}>
                  <button class={styles.groupSecondaryBtn} onClick={() => props.onRespondToInvite(invite.id, false)}>{t('wavechat.reject', language())}</button>
                  <button class={styles.statusBtn} onClick={() => props.onRespondToInvite(invite.id, true)}>{t('wavechat.accept', language())}</button>
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>
      <div class={styles.groupsHeadRow}>
        <button class={styles.statusBtn} onClick={() => props.onShowCreateGroupModal(true)}>{t('wavechat.create_group', language())}</button>
      </div>
      <VirtualList items={props.groups} itemHeight={74} overscan={4}>
        {(group) => (
          <button
            class={styles.conversationItem}
            classList={{ [styles.selected]: isSelectedGroup(group.id) }}
            onClick={() => props.onSelectGroup(group.id)}
          >
            <LetterAvatar class={styles.avatar} color={generateColorForString(String(group.id))} label={group.name} />
            <div class={styles.info}>
              <div class={styles.topRow}>
                <span class={styles.name}>{group.name}</span>
                <span class={styles.time}>{group.members || 1} {t('wavechat.members', language())}</span>
              </div>
              <div class={styles.previewText}>{t('wavechat.group_chat', language())}</div>
            </div>
          </button>
        )}
      </VirtualList>

      <Show when={props.selectedGroupId()}>
        <div class={styles.groupThread}>
          <div class={styles.groupThreadHeader}>
            <div>
              <h4>{props.groups().find((entry) => entry.id === props.selectedGroupId())?.name || t('wavechat.group', language())}</h4>
              <p>{t('wavechat.group_persistence', language())}</p>
            </div>
            <span>{props.selectedGroupMessages().length}/30</span>
          </div>
          <Show when={props.selectedGroupTypingList().length > 0}>
            <div class={styles.groupTypingRow}>
              {props.selectedGroupTypingList().join(', ')} {t('wavechat.typing', language())}...
            </div>
          </Show>
          <For each={props.selectedGroupMessages()}>
            {(msg) => (
              <div class={styles.groupMsgRow}>
                <div class={styles.groupMsgMeta}>
                  <strong>{msg.sender_number ? props.getContactName(msg.sender_number) : t('wavechat.unknown_user', language())}</strong>
                  <span>{timeAgo(msg.created_at)}</span>
                </div>
                <Show when={msg.message}>
                  <span>{msg.message}</span>
                </Show>
                <Show when={msg.media_url}>
                  {(mediaUrl) => {
                    const mediaType = resolveMediaType(mediaUrl());
                    return (
                      <>
                        <Show when={mediaType === 'image'}>
                          <img class={styles.groupMediaPreview} src={mediaUrl()} alt="" onClick={() => props.onOpenViewer(mediaUrl())} />
                        </Show>
                        <Show when={mediaType === 'video'}>
                          <video class={styles.groupMediaPreview} src={mediaUrl()} controls playsinline />
                        </Show>
                      </>
                    );
                  }}
                </Show>
              </div>
            )}
          </For>
          <div class={styles.inputContainer}>
            <EmojiPickerButton value={props.groupMessageInput()} onChange={props.setGroupMessageInput} maxLength={800} />
            <input value={props.groupMessageInput()} onInput={(e) => {
              const next = e.currentTarget.value;
              props.setGroupMessageInput(next);
              if (props.selectedGroupId() && props.socketReady() && isWaveSocketConnected()) {
                sendWaveTyping(String(props.selectedGroupId()!), next.trim().length > 0);
              }
            }} placeholder={t('wavechat.group_message', language())} />
            <button
              class={styles.sendBtn}
              classList={{ [styles.sendBtnRecording]: props.isRecordingVoice() }}
              onPointerDown={() => {
                (window as any).__gcGrpSendTimer = setTimeout(() => {
                  (window as any).__gcGrpSendTimer = null;
                  if (props.isRecordingVoice()) { props.onStopVoiceRecording(); } else { props.onStartVoiceRecording(); }
                }, 500);
              }}
              onPointerUp={() => {
                if ((window as any).__gcGrpSendTimer) {
                  clearTimeout((window as any).__gcGrpSendTimer);
                  (window as any).__gcGrpSendTimer = null;
                  props.onSendGroupMessage();
                }
              }}
              onPointerLeave={() => {
                if ((window as any).__gcGrpSendTimer) {
                  clearTimeout((window as any).__gcGrpSendTimer);
                  (window as any).__gcGrpSendTimer = null;
                }
              }}
            >{props.isRecordingVoice() ? `⏹ ${props.recordingSeconds()}s` : '➤'}</button>
          </div>
        </div>
      </Show>

      <Modal open={props.showCreateGroupModal()} title={t('wavechat.create_group', language())} onClose={props.onCloseCreateGroupModal} size="lg">
        <div class={styles.groupModalBody}>
          <SheetIntro title={t('wavechat.create_group', language())} description={t('wavechat.create_group_desc', language())} />
          <label class={styles.groupField}>
            <span>{t('wavechat.group_name', language())}</span>
            <input
              value={props.groupNameDraft()}
              onInput={(e) => props.onSetGroupNameDraft(sanitizeText(e.currentTarget.value, 80))}
              placeholder={t('wavechat.group_name_placeholder', language())}
            />
          </label>

          <label class={styles.groupField}>
            <span>{t('wavechat.search_contacts', language())}</span>
            <SearchInput
              value={props.groupContactSearch()}
              onInput={(value) => props.onSetGroupContactSearch(sanitizeText(value, 80))}
              placeholder={t('wavechat.search_contacts_placeholder', language())}
              class={styles.groupSearchInputRoot}
              inputClass={styles.groupSearchInput}
            />
          </label>

          <div class={styles.groupSelectionSummary}>
            <strong>{props.groupMemberDraft().length}</strong>
            <span>{t('wavechat.selected_contacts', language())}</span>
          </div>

          <div class={styles.groupChecklist}>
            <For each={props.selectableContacts()}>
              {(contact) => {
                const safeNumber = sanitizePhone(contact.number);
                return (
                  <label class={styles.groupChecklistItem}>
                    <input
                      type="checkbox"
                      checked={props.groupMemberDraft().includes(safeNumber)}
                      onChange={() => props.onToggleGroupMember(safeNumber)}
                    />
                    <div class={styles.groupChecklistInfo}>
                      <strong>{contact.display}</strong>
                      <span>{formatPhoneNumber(contact.number, props.framework || 'unknown')}</span>
                    </div>
                  </label>
                );
              }}
            </For>
            <Show when={props.selectableContacts().length === 0}>
              <div class={styles.groupChecklistEmpty}>{t('wavechat.no_contacts_add', language())}</div>
            </Show>
          </div>
          <ModalActions>
            <ModalButton label={t('wavechat.cancel', language())} onClick={props.onCloseCreateGroupModal} />
            <ModalButton label={t('wavechat.create', language())} tone="primary" onClick={props.onCreateGroup} disabled={!props.groupNameDraft().trim()} />
          </ModalActions>
        </div>
      </Modal>
    </>
  );
}
