import { createMemo, createSelector, createSignal, For, Show, createEffect, onCleanup, onMount } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { useMessages } from '../../../store/messages';
import { useContacts } from '../../../store/contacts';
import { usePhoneKeyHandler } from '../../../hooks/usePhoneKeyHandler';
import { useContextMenu } from '../../../hooks/useContextMenu';
import { useMediaAttachment } from '../../../hooks/useMediaAttachment';
import { getPlayerCoords, formatLocationMessage } from '../../../utils/playerLocation';
import { fetchNui } from '../../../utils/fetchNui';
import { useNuiCustomEvent } from '../../../utils/useNui';
import { generateColorForString, timeAgo } from '../../../utils/misc';
import { resolveMediaType, sanitizeMediaUrl, sanitizePhone, sanitizeText } from '../../../utils/sanitize';
import { parseSharedContactMessage } from '../../../utils/contactShare';
import { fetchSocketToken } from '../../../utils/realtimeAuth';
import { uiPrompt } from '../../../utils/uiDialog';
import { uiAlert } from '../../../utils/uiAlert';
import { connectWaveSocket, disconnectWaveSocket, isWaveSocketConnected, joinWaveRoom, sendWaveMessage, sendWaveTyping, type WaveSocketMessage } from '../../../utils/socket';
import { usePhone } from '../../../store/phone';
import { ActionSheet } from '../../shared/ui/ActionSheet';
import { EmptyState } from '../../shared/ui/EmptyState';
import { LetterAvatar } from '../../shared/ui/LetterAvatar';
import { MediaLightbox } from '../../shared/ui/MediaLightbox';
import { Modal, ModalActions, ModalButton } from '../../shared/ui/Modal';
import { SearchInput } from '../../shared/ui/SearchInput';
import { SegmentedTabs } from '../../shared/ui/SegmentedTabs';
import { SheetIntro } from '../../shared/ui/SheetIntro';
import { VirtualList } from '../../shared/ui/VirtualList';
import { AppScaffold } from '../../shared/layout';
import { getStoredLanguage, t } from '../../../i18n';
import { useWaveChatDerivedData } from './hooks/useWaveChatDerivedData';
import { useWaveChatRouteSync } from './hooks/useWaveChatRouteSync';
import { WaveChatConversationView } from './WaveChatConversationView';
import { WaveChatStatusTab } from './WaveChatStatusTab';
import { WaveChatCallsTab } from './WaveChatCallsTab';
import { WaveChatGroupsTab } from './WaveChatGroupsTab';
import type { GifResult, WaveChatGroup, WaveChatInvite, WaveChatGroupMessage, WaveStatus, WaveStatusMediaConfig, WaveSocketAuth } from './WaveChatTypes';
import styles from './WaveChatApp.module.scss';

export function WaveChatApp() {
  const router = useRouter();
  const [phoneState] = usePhone();
  const language = () => getStoredLanguage();
  const [messagesState, messagesActions] = useMessages();
  const [contactsState, contactsActions] = useContacts();
  const [selectedConversation, setSelectedConversation] = createSignal<string | null>(null);
  const [messageInput, setMessageInput] = createSignal('');
  const [attachmentUrl, setAttachmentUrl] = createSignal<string | null>(null);
  const [viewerUrl, setViewerUrl] = createSignal<string | null>(null);
  const [routeConversationName, setRouteConversationName] = createSignal('');
  const [selectedIndex, setSelectedIndex] = createSignal(-1);
  const [showAttachSheet, setShowAttachSheet] = createSignal(false);
  const [showGifPicker, setShowGifPicker] = createSignal(false);
  const [activeTab, setActiveTab] = createSignal<'chats' | 'status' | 'calls' | 'groups'>('chats');
  const [gifQuery, setGifQuery] = createSignal('party');
  const [gifLoading, setGifLoading] = createSignal(false);
  const [gifResults, setGifResults] = createSignal<GifResult[]>([]);
  const [isRecordingVoice, setIsRecordingVoice] = createSignal(false);
  const [recordingSeconds, setRecordingSeconds] = createSignal(0);
  const [uploadingVoice, setUploadingVoice] = createSignal(false);
  const [callHistory, setCallHistory] = createSignal<any[]>([]);
  const [groups, setGroups] = createSignal<WaveChatGroup[]>([]);
  const [groupInvites, setGroupInvites] = createSignal<WaveChatInvite[]>([]);
  const [statuses, setStatuses] = createSignal<WaveStatus[]>([]);
  const [statusMediaConfig, setStatusMediaConfig] = createSignal<WaveStatusMediaConfig>({ canUploadImage: false, canUploadVideo: false, maxVideoDurationSeconds: 10 });
  const [selectedGroupId, setSelectedGroupId] = createSignal<number | null>(null);
  const ctxMenu = useContextMenu<any>();
  const [groupMessages, setGroupMessages] = createSignal<Record<number, WaveChatGroupMessage[]>>({});
  const [groupMessageInput, setGroupMessageInput] = createSignal('');
  const [showCreateGroupModal, setShowCreateGroupModal] = createSignal(false);
  const waveTabs = [
    { id: 'chats', label: t('wavechat.tab.chats', language()) },
    { id: 'status', label: t('wavechat.tab.status', language()) },
    { id: 'calls', label: t('wavechat.tab.calls', language()) },
    { id: 'groups', label: t('wavechat.tab.groups', language()) },
  ];
  const [groupNameDraft, setGroupNameDraft] = createSignal('');
  const [groupContactSearch, setGroupContactSearch] = createSignal('');
  const [groupMemberDraft, setGroupMemberDraft] = createSignal<string[]>([]);
  const [socketReady, setSocketReady] = createSignal(false);
  const [groupTyping, setGroupTyping] = createSignal<Record<number, string[]>>({});

  let mediaRecorder: MediaRecorder | null = null;
  let mediaStream: MediaStream | null = null;
  let recordingInterval: number | undefined;
  const typingTimers = new Map<string, number>();
  const myNumber = createMemo(() => phoneState.settings.phoneNumber || '');

  const {
    contactDisplayByNumber,
    knownContactNumbers,
    selectableContacts,
    conversations,
    statusRows,
  } = useWaveChatDerivedData({
    contacts: () => contactsState.contacts,
    messages: () => messagesState.messages,
    statuses,
    groupContactSearch,
    ownNumber: myNumber,
  });

  const getMediaUrl = (msg: any): string | undefined => sanitizeMediaUrl(msg.mediaUrl || msg.media_url) || undefined;

  const loadCallHistory = async () => {
    const history = await fetchNui<any[]>('getCallHistory', undefined, []);
    setCallHistory(history || []);
  };

  const loadGroups = async () => {
    const list = await fetchNui<WaveChatGroup[]>('wavechatGetGroups', {}, []);
    setGroups(list || []);
  };

  const loadGroupInvites = async () => {
    const list = await fetchNui<WaveChatInvite[]>('wavechatGetInvites', {}, []);
    setGroupInvites(list || []);
  };

  const loadStatuses = async () => {
    const [list, mediaConfig] = await Promise.all([
      fetchNui<WaveStatus[]>('wavechatGetStatuses', {}, []),
      fetchNui<WaveStatusMediaConfig>('wavechatGetStatusMediaConfig', {}, { canUploadImage: false, canUploadVideo: false, maxVideoDurationSeconds: 10 }),
    ]);

    setStatuses((list || []).map((entry) => ({
      ...entry,
      media_url: sanitizeMediaUrl(entry.media_url) || '',
      caption: sanitizeText(entry.caption || '', 140),
      contact_name: sanitizeText(entry.contact_name || '', 80),
    })).filter((entry) => entry.media_url));
    setStatusMediaConfig(mediaConfig || { canUploadImage: false, canUploadVideo: false, maxVideoDurationSeconds: 10 });
  };

  const reconnectWaveRealtime = async () => {
    disconnectWaveSocket();

    const auth = await fetchSocketToken() as WaveSocketAuth | undefined;
    if (!auth?.success || !auth.host || !auth.token) {
      setSocketReady(false);
      return false;
    }

    connectWaveSocket(auth.host, auth.token, {
      onMessage: (payload: WaveSocketMessage) => {
        const groupId = Number(payload.roomId);
        if (!Number.isFinite(groupId)) return;
        const mapped: WaveChatGroupMessage = {
          id: payload.id,
          group_id: groupId,
          sender_number: payload.senderPhone,
          message: payload.content,
          media_url: payload.mediaUrl,
          created_at: new Date(payload.createdAt).toISOString(),
        };

        setGroupMessages((prev) => {
          const current = prev[groupId] || [];
          if (current.some((m) => m.id === mapped.id)) return prev;
          return { ...prev, [groupId]: [...current, mapped] };
        });
      },
      onTyping: (payload) => {
        const groupId = Number(payload.roomId);
        if (!Number.isFinite(groupId)) return;

        setGroupTyping((prev) => {
          const current = prev[groupId] || [];
          if (payload.typing) {
            if (current.includes(payload.phone)) return prev;
            return { ...prev, [groupId]: [...current, payload.phone] };
          }
          return { ...prev, [groupId]: current.filter((x) => x !== payload.phone) };
        });

        const timerKey = `${groupId}:${payload.phone}`;
        const prevTimer = typingTimers.get(timerKey);
        if (prevTimer) window.clearTimeout(prevTimer);

        if (payload.typing) {
          const timer = window.setTimeout(() => {
            setGroupTyping((prev) => {
              const current = prev[groupId] || [];
              return { ...prev, [groupId]: current.filter((x) => x !== payload.phone) };
            });
            typingTimers.delete(timerKey);
          }, 1600);
          typingTimers.set(timerKey, timer);
        } else {
          typingTimers.delete(timerKey);
        }
      },
      onDisconnect: () => setSocketReady(false),
      onReconnect: () => {
        setSocketReady(true);
        syncWaveRooms();
      },
      onReconnectFailed: () => {
        setSocketReady(false);
      },
    });

    setSocketReady(true);
    syncWaveRooms();
    return true;
  };

  const syncWaveRooms = () => {
    if (!socketReady() || !isWaveSocketConnected()) return;
    for (const group of groups()) {
      if (group?.id) {
        joinWaveRoom(String(group.id));
      }
    }
  };

  const loadGroupMessages = async (groupId: number) => {
    const list = await fetchNui<WaveChatGroupMessage[]>('wavechatGetGroupMessages', { groupId }, []);
    setGroupMessages((prev) => ({ ...prev, [groupId]: list || [] }));
  };

  const closeCreateGroupModal = () => {
    setShowCreateGroupModal(false);
    setGroupNameDraft('');
    setGroupContactSearch('');
    setGroupMemberDraft([]);
  };

  const toggleGroupMember = (number: string) => {
    const safeNumber = sanitizePhone(number);
    if (!safeNumber) return;
    setGroupMemberDraft((prev) => (
      prev.includes(safeNumber)
        ? prev.filter((entry) => entry !== safeNumber)
        : [...prev, safeNumber].slice(0, 24)
    ));
  };

  const createGroup = async () => {
    const name = sanitizeText(groupNameDraft(), 80);
    if (!name) return;
    const members = groupMemberDraft().map((entry) => sanitizePhone(entry)).filter(Boolean);
    const result = await fetchNui<{ success?: boolean; groupId?: number }>('wavechatCreateGroup', { name, members }, { success: false });
    if (result?.success) {
      await loadGroups();
      await loadGroupInvites();
      await reconnectWaveRealtime();
      if (result.groupId) {
        setSelectedGroupId(result.groupId);
        await loadGroupMessages(result.groupId);
      }
      closeCreateGroupModal();
    }
  };

  const respondToInvite = async (inviteId: number, accept: boolean) => {
    const result = await fetchNui<{ success?: boolean; payload?: { accepted?: boolean; groupId?: number } }>('wavechatRespondInvite', { inviteId, accept }, { success: false });
    if (!result?.success) return;

    await loadGroupInvites();
    await loadGroups();
    await reconnectWaveRealtime();

    if (accept && result.payload?.groupId) {
      setSelectedGroupId(result.payload.groupId);
      await loadGroupMessages(result.payload.groupId);
    }
  };

  const sendGroupMessage = async () => {
    const groupId = selectedGroupId();
    const content = sanitizeText(groupMessageInput(), 800);
    if (!groupId || !content) return;

    const result = socketReady() && isWaveSocketConnected()
      ? await sendWaveMessage(String(groupId), content)
      : await fetchNui<{ success?: boolean; message?: WaveChatGroupMessage }>('wavechatSendGroupMessage', { groupId, message: content }, { success: false });

    if (result?.success) {
      setGroupMessageInput('');
      sendWaveTyping(String(groupId), false);
    }
  };

  const isSelectedConversationIndex = createSelector(selectedIndex);

  const selectedConversationMessages = createMemo(() => {
    const number = selectedConversation();
    if (!number) return [];
    return messagesActions.getConversation(number);
  });

  const selectedGroupMessages = createMemo(() => {
    const groupId = selectedGroupId();
    if (!groupId) return [];
    return groupMessages()[groupId] || [];
  });

  const selectedGroupTypingList = createMemo(() => {
    const groupId = selectedGroupId();
    if (!groupId) return [] as string[];
    return groupTyping()[groupId] || [];
  });

  createEffect(() => {
    const maxIndex = conversations().length - 1;
    if (maxIndex < 0) {
      setSelectedIndex(-1);
      return;
    }

    if (selectedIndex() > maxIndex) {
      setSelectedIndex(maxIndex);
    }
  });

  useWaveChatRouteSync({
    routeParams: router.params,
    setSelectedConversation,
    setRouteConversationName,
    setActiveTab,
    setAttachmentUrl,
    markAsRead: messagesActions.markAsRead,
  });

  const searchGifs = async () => {
    const query = sanitizeText(gifQuery(), 80);
    if (!query) return;

    setGifLoading(true);
    try {
      const data = await fetchNui<Array<{ id: string; url: string }>>('wavechatSearchGifs', { query }, []);
      const mapped = (data || [])
        .map((item) => ({ id: item.id, url: sanitizeMediaUrl(item.url) }))
        .filter((item): item is GifResult => Boolean(item.url));
      setGifResults(mapped);
    } catch (_err) {
      setGifResults([]);
    } finally {
      setGifLoading(false);
    }
  };

  usePhoneKeyHandler({
    ArrowUp: () => {
      if (selectedConversation()) return;
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    },
    ArrowDown: () => {
      if (selectedConversation()) return;
      const convos = conversations();
      setSelectedIndex((prev) => Math.min(convos.length - 1, prev + 1));
    },
    Enter: () => {
      if (selectedConversation()) return;
      const convos = conversations();
      if (selectedIndex() >= 0 && selectedIndex() < convos.length) {
        openConversation(convos[selectedIndex()].number, convos[selectedIndex()].display);
      }
    },
    Backspace: () => {
      if (selectedConversation()) {
        setSelectedConversation(null);
        setRouteConversationName('');
        return;
      }
      router.goBack();
    },
  });

  onMount(() => {
    void loadCallHistory();
    void loadGroups();
    void loadGroupInvites();
    void loadStatuses();
  });

  createEffect(() => {
    const groupId = selectedGroupId();
    if (!groupId) return;
    void loadGroupMessages(groupId);
  });

  createEffect(() => {
    groups();
    if (!socketReady() || !isWaveSocketConnected()) return;
    syncWaveRooms();
  });

  onMount(() => {
    void (async () => {
      await reconnectWaveRealtime();
    })();
  });

  useNuiCustomEvent<WaveChatGroupMessage>('wavechatGroupMessage', (message) => {
    if (!message || !message.group_id) return;
    setGroupMessages((prev) => {
      const current = prev[message.group_id] || [];
      return { ...prev, [message.group_id]: [...current, message] };
    });
  });

  const openConversation = (number: string, display?: string) => {
    setSelectedConversation(number);
    setRouteConversationName(sanitizeText(display, 80));
    messagesActions.markAsRead(number);
  };

  const deleteConversation = async (number: string) => {
    const ok = await messagesActions.deleteConversation(number);
    if (ok && selectedConversation() === number) {
      setSelectedConversation(null);
      setRouteConversationName('');
    }
  };

  const sendMessage = async () => {
    const number = selectedConversation();
    const content = sanitizeText(messageInput(), 800);
    const media = sanitizeMediaUrl(attachmentUrl());
    if (!number || (!content && !media)) return;

    await messagesActions.send({ phoneNumber: number, message: content, mediaUrl: media || undefined });
    setMessageInput('');
    setAttachmentUrl(null);
  };

  const media = useMediaAttachment({
    onAttached: (url) => { setAttachmentUrl(url); setShowAttachSheet(false); },
  });

  const createStatusFromMedia = async (mediaUrl: string, mediaType: 'image' | 'video') => {
    const safeUrl = sanitizeMediaUrl(mediaUrl);
    if (!safeUrl) {
      uiAlert(t('wavechat.invalid_status_media', language()));
      return;
    }

    if (mediaType === 'video' && !statusMediaConfig().canUploadVideo) {
      uiAlert(t('wavechat.status_video_unavailable', language()));
      return;
    }

    if (mediaType === 'image' && !statusMediaConfig().canUploadImage) {
      uiAlert(t('wavechat.status_image_unavailable', language()));
      return;
    }

    const caption = sanitizeText((await uiPrompt(t('wavechat.status_caption_prompt', language()), { title: t('wavechat.status_new', language()) })) || '', 140);
    const result = await fetchNui<{ success?: boolean; error?: string }>('wavechatCreateStatus', {
      mediaUrl: safeUrl,
      mediaType,
      caption,
    }, { success: false });

    if (!result?.success) {
      uiAlert(result?.error || t('wavechat.status_publish_failed', language()));
      return;
    }

    await loadStatuses();
  };

  const createPhotoStatus = async () => {
    if (!statusMediaConfig().canUploadImage) {
      uiAlert(t('wavechat.status_photo_unavailable', language()));
      return;
    }

    const shot = await fetchNui<{ url?: string }>('takePhoto', {} as any, { url: '' } as any);
    if (!shot?.url) return;
    await createStatusFromMedia(shot.url, 'image');
  };

  const createGalleryStatus = async () => {
    if (!statusMediaConfig().canUploadImage) {
      uiAlert(t('wavechat.status_photo_unavailable', language()));
      return;
    }

    const gallery = await fetchNui<any[]>('getGallery', undefined, []);
    const image = gallery?.find((item: any) => {
      const url = sanitizeMediaUrl(item?.url);
      return url && resolveMediaType(url) === 'image';
    });
    if (!image?.url) {
      uiAlert(t('wavechat.no_gallery_photos', language()));
      return;
    }

    await createStatusFromMedia(image.url, 'image');
  };

  const createVideoStatus = async () => {
    const mediaConfig = await fetchNui<WaveStatusMediaConfig>('wavechatGetStatusMediaConfig', {}, { canUploadVideo: false, maxVideoDurationSeconds: 10 });
    setStatusMediaConfig(mediaConfig || { canUploadImage: false, canUploadVideo: false, maxVideoDurationSeconds: 10 });

    if (!mediaConfig?.canUploadVideo) {
      uiAlert(t('wavechat.status_video_endpoint_unavailable', language()));
      return;
    }

    const storage = await fetchNui<{ uploadUrl?: string; uploadField?: string; customUploadUrl?: string; customUploadField?: string }>('getStorageConfig', undefined, {
      uploadUrl: '',
      uploadField: 'files[]',
      customUploadUrl: '',
      customUploadField: 'files[]',
    });

    const result = await fetchNui<{ url?: string; error?: string }>('captureCameraVideoSession', {
      url: storage?.uploadUrl || storage?.customUploadUrl || '',
      field: storage?.uploadField || storage?.customUploadField || 'files[]',
      durationSeconds: Math.max(5, Math.min(10, Number(mediaConfig.maxVideoDurationSeconds || 10))),
    }, { url: '', error: 'video_not_supported' });

    if (!result?.url) {
      uiAlert(t('wavechat.status_record_failed', language()));
      return;
    }

    await createStatusFromMedia(result.url, 'video');
  };

  const openStatus = async (status: WaveStatus) => {
    setViewerUrl(status.media_url);
    if (status.id) {
      await fetchNui('wavechatMarkStatusViewed', status.id, { success: true });
    }
  };

  const attachAudioUrl = async () => {
    const input = await uiPrompt(t('wavechat.prompt.audio_url', language()), { title: t('wavechat.attach', language()) });
    const nextUrl = sanitizeMediaUrl(input);
    if (nextUrl && resolveMediaType(nextUrl) === 'audio') {
      setAttachmentUrl(nextUrl);
    } else if (input && input.trim()) {
      uiAlert(t('wavechat.invalid_audio_url', language()));
    }
    setShowAttachSheet(false);
  };

  const getContactName = (number: string) => {
    return contactDisplayByNumber().get(number) || number;
  };

  const isKnownContact = (number: string) => knownContactNumbers().has(number);

  const addContactFromMessage = async (display: string, number: string) => {
    if (isKnownContact(number)) {
      uiAlert(t('wavechat.contact_exists', language()));
      return;
    }
    const added = await contactsActions.add(display, number);
    uiAlert(added ? t('wavechat.contact_saved', language()) : t('wavechat.contact_add_failed', language()));
  };

  const getPreviewText = (message: any) => {
    if (getMediaUrl(message)) return t('wavechat.attachment_media', language());
    const shared = parseSharedContactMessage(message?.message);
    if (shared) return t('wavechat.contact_prefix', language(), { name: shared.display });
    return sanitizeText(message?.message || '', 80) || t('wavechat.message', language());
  };

  const getStatusSummary = (status: WaveStatus) => {
    if (status.caption) return status.caption;
    return status.media_type === 'video' ? t('wavechat.status_video_summary', language()) : t('wavechat.status_photo_summary', language());
  };

  const sendLocationText = async () => {
    const number = selectedConversation();
    if (!number) return;
    const coords = await getPlayerCoords();
    if (!coords) return;
    await messagesActions.send({ phoneNumber: number, message: formatLocationMessage(coords, t('maps.share_location', language())) });
  };

  const clearRecordingTimer = () => {
    if (recordingInterval) {
      clearInterval(recordingInterval);
      recordingInterval = undefined;
    }
  };

  const cleanupRecorder = () => {
    clearRecordingTimer();
    if (mediaStream) {
      for (const track of mediaStream.getTracks()) track.stop();
      mediaStream = null;
    }
    mediaRecorder = null;
    setIsRecordingVoice(false);
  };

  const startVoiceRecording = async () => {
    if (isRecordingVoice()) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      uiAlert(t('wavechat.voice_unavailable', language()));
      return;
    }

    const uploadConfig = await fetchNui<{ url?: string; field?: string; headers?: Record<string, string>; useProxy?: boolean }>(
      'getAudioUploadConfig', {}, { url: '', field: 'file' }
    );
    if (!uploadConfig?.url && !uploadConfig?.useProxy) {
      uiAlert(t('wavechat.storage_unconfigured', language()));
      return;
    }

    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: BlobPart[] = [];
      mediaRecorder = new MediaRecorder(mediaStream, { mimeType: 'audio/webm;codecs=opus' });
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        setUploadingVoice(true);
        try {
          const blob = new Blob(chunks, { type: 'audio/webm' });
          let uploadedUrl: string | undefined;

          if (uploadConfig.useProxy) {
            const reader = new FileReader();
            const base64 = await new Promise<string>((resolve) => {
              reader.onloadend = () => resolve((reader.result as string).split(',')[1] || '');
              reader.readAsDataURL(blob);
            });
            const proxyResult = await fetchNui<{ url?: string; error?: string }>(
              'proxyUpload', { base64, filename: 'voice-note.webm', contentType: 'audio/webm' }, { error: 'PROXY_FAILED' }
            );
            uploadedUrl = sanitizeMediaUrl(proxyResult?.url);
          } else {
            const headers = new Headers();
            if (uploadConfig.headers) {
              for (const [k, v] of Object.entries(uploadConfig.headers)) headers.append(k, v);
            }
            const formData = new FormData();
            formData.append(uploadConfig.field || 'file', blob, 'voice-note.webm');
            const response = await fetch(uploadConfig.url!, { method: 'POST', headers, body: formData });
            if (!response.ok) throw new Error('upload_failed');
            const payload = await response.json();
            uploadedUrl = sanitizeMediaUrl(payload?.data?.url || payload?.url || payload?.link);
          }

          if (uploadedUrl) {
            setAttachmentUrl(uploadedUrl);
          } else {
            uiAlert(t('wavechat.upload_invalid_audio', language()));
          }
        } catch (_err) {
          uiAlert(t('wavechat.voice_upload_failed', language()));
        } finally {
          setUploadingVoice(false);
          cleanupRecorder();
        }
      };

      mediaRecorder.start();
      setRecordingSeconds(0);
      setIsRecordingVoice(true);
      recordingInterval = window.setInterval(() => setRecordingSeconds((prev) => prev + 1), 1000);
    } catch (_err) {
      cleanupRecorder();
      uiAlert(t('wavechat.voice_start_failed', language()));
    }
  };

  const stopVoiceRecording = () => {
    if (!mediaRecorder || mediaRecorder.state !== 'recording') {
      cleanupRecorder();
      return;
    }
    mediaRecorder.stop();
  };

  onCleanup(() => {
    cleanupRecorder();
    for (const timer of typingTimers.values()) {
      window.clearTimeout(timer);
    }
    typingTimers.clear();
    disconnectWaveSocket();
  });

  return (
    <>
      <Show
        when={!selectedConversation()}
        fallback={
          <WaveChatConversationView
            phoneNumber={selectedConversation()!}
            contactName={routeConversationName() || getContactName(selectedConversation()!)}
            messages={selectedConversationMessages()}
            messageInput={messageInput()}
            attachmentUrl={attachmentUrl()}
            showAttachSheet={showAttachSheet()}
            setShowAttachSheet={setShowAttachSheet}
            onInput={setMessageInput}
            onSend={sendMessage}
            onAttachGallery={media.attachFromGallery}
            onAttachCamera={media.attachFromCamera}
            onAttachUrl={media.attachByUrl}
            onAttachAudioUrl={attachAudioUrl}
            onSendLocation={sendLocationText}
            isRecordingVoice={isRecordingVoice()}
            recordingSeconds={recordingSeconds()}
            uploadingVoice={uploadingVoice()}
            onStartVoiceRecording={startVoiceRecording}
            onStopVoiceRecording={stopVoiceRecording}
            onOpenGifPicker={() => {
              setShowGifPicker(true);
              setShowAttachSheet(false);
              if (gifResults().length === 0) void searchGifs();
            }}
            onClearAttachment={() => setAttachmentUrl(null)}
            onOpenViewer={setViewerUrl}
            getMediaUrl={getMediaUrl}
            isKnownContact={isKnownContact}
            onAddContact={addContactFromMessage}
            onBack={() => {
              setSelectedConversation(null);
              setRouteConversationName('');
            }}
            onOpenCoords={(x, y) => router.navigate('maps', { x, y })}
            onDeleteConversation={() => void deleteConversation(selectedConversation()!)}
            framework={phoneState.framework || 'unknown'}
          />
        }
      >
        <AppScaffold title='WaveChat' subtitle={t('wavechat.subtitle', language())} onBack={() => router.goBack()} bodyPadding='none'>
          <div class={styles.app}>
            <div class={styles.tabs}>
              <SegmentedTabs items={waveTabs} active={activeTab()} onChange={(id) => setActiveTab(id as 'chats' | 'status' | 'calls' | 'groups')} />
            </div>

            <div class={styles.list}>
          <Show when={activeTab() === 'chats'}>
            <Show when={conversations().length > 0} fallback={<EmptyState class={styles.emptyState} title={t('wavechat.no_chats', language())} description={t('wavechat.no_chats_desc', language())} />}>
              <VirtualList items={conversations} itemHeight={78} overscan={5}>
                {(convo, index) => (
                  <div
                    class={styles.conversationItem}
                    classList={{ [styles.selected]: isSelectedConversationIndex(index()) }}
                    onClick={() => openConversation(convo.number, convo.display)}
                    onContextMenu={ctxMenu.onContextMenu(convo)}
                  >
                    <LetterAvatar class={styles.avatar} color={generateColorForString(convo.number)} label={convo.display} />
                    <div class={styles.info}>
                      <div class={styles.topRow}>
                        <span class={styles.name}>{convo.display}</span>
                        <span class={styles.time}>{timeAgo(convo.lastMessage.time)}</span>
                      </div>
                      <div class={styles.previewRow}>
                        <Show when={convo.unread > 0}>
                          <span class={styles.unreadBadge}>{convo.unread}</span>
                        </Show>
                        <span class={styles.previewText}>
                          {getPreviewText(convo.lastMessage)}
                        </span>
                      </div>
                    </div>
                    <button class={styles.deleteConversationBtn} onClick={(e) => { e.stopPropagation(); void deleteConversation(convo.number); }}>
                      {t('wavechat.delete', language())}
                    </button>
                  </div>
                )}
              </VirtualList>
            </Show>
          </Show>

          <Show when={activeTab() === 'status'}>
            <WaveChatStatusTab
              statusRows={statusRows}
              statusMediaConfig={statusMediaConfig}
              getContactName={getContactName}
              getStatusSummary={getStatusSummary}
              onCreatePhotoStatus={() => void createPhotoStatus()}
              onCreateGalleryStatus={() => void createGalleryStatus()}
              onCreateVideoStatus={() => void createVideoStatus()}
              onOpenStatus={(status) => void openStatus(status)}
            />
          </Show>

          <Show when={activeTab() === 'calls'}>
            <WaveChatCallsTab
              callHistory={callHistory}
              framework={phoneState.framework || 'unknown'}
            />
          </Show>

          <Show when={activeTab() === 'groups'}>
            <WaveChatGroupsTab
              groups={groups}
              groupInvites={groupInvites}
              selectedGroupId={selectedGroupId}
              selectedGroupMessages={selectedGroupMessages}
              selectedGroupTypingList={selectedGroupTypingList}
              groupMessageInput={groupMessageInput}
              setGroupMessageInput={setGroupMessageInput}
              socketReady={socketReady}
              isRecordingVoice={isRecordingVoice}
              recordingSeconds={recordingSeconds}
              showCreateGroupModal={showCreateGroupModal}
              groupNameDraft={groupNameDraft}
              groupContactSearch={groupContactSearch}
              groupMemberDraft={groupMemberDraft}
              selectableContacts={selectableContacts}
              framework={phoneState.framework || 'unknown'}
              getContactName={getContactName}
              onSelectGroup={(groupId) => {
                setSelectedGroupId(groupId);
                void loadGroupMessages(groupId);
              }}
              onRespondToInvite={(inviteId, accept) => void respondToInvite(inviteId, accept)}
              onSendGroupMessage={() => void sendGroupMessage()}
              onStartVoiceRecording={startVoiceRecording}
              onStopVoiceRecording={stopVoiceRecording}
              onOpenViewer={setViewerUrl}
              onShowCreateGroupModal={setShowCreateGroupModal}
              onSetGroupNameDraft={setGroupNameDraft}
              onSetGroupContactSearch={setGroupContactSearch}
              onToggleGroupMember={toggleGroupMember}
              onCreateGroup={() => void createGroup()}
              onCloseCreateGroupModal={closeCreateGroupModal}
            />
          </Show>
            </div>
          </div>
        </AppScaffold>
      </Show>

      <Modal open={showGifPicker()} title="GIFs" onClose={() => setShowGifPicker(false)} size="lg">
        <div class={styles.gifPanel}>
          <SheetIntro title={t('wavechat.search_gif', language())} description={t('wavechat.search_gif_desc', language())} />
          <div class={styles.gifSearchRow}>
            <SearchInput
              value={gifQuery()}
              onInput={(value) => setGifQuery(sanitizeText(value, 80))}
              placeholder={t('wavechat.search_gif', language())}
              class={styles.gifSearchInputRoot}
              inputClass={styles.gifSearchInput}
            />
            <button onClick={() => void searchGifs()}>{t('wavechat.search', language())}</button>
          </div>
          <Show when={!gifLoading()} fallback={<div class={styles.gifEmpty}>{t('wavechat.searching', language())}</div>}>
            <Show when={gifResults().length > 0} fallback={<div class={styles.gifEmpty}>{t('wavechat.no_results', language())}</div>}>
              <div class={styles.gifGrid}>
                <For each={gifResults()}>
                  {(gif) => (
                    <button
                      class={styles.gifItem}
                      onClick={() => {
                        setAttachmentUrl(gif.url);
                        setShowGifPicker(false);
                      }}
                    >
                      <img src={gif.url} alt="gif" />
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </Show>
          <ModalActions>
            <ModalButton label={t('wavechat.close', language())} onClick={() => setShowGifPicker(false)} />
          </ModalActions>
        </div>
      </Modal>
      <MediaLightbox url={viewerUrl()} onClose={() => setViewerUrl(null)} />
      <ActionSheet
        open={ctxMenu.isOpen()}
        title={ctxMenu.item()?.display || 'Chat'}
        onClose={ctxMenu.close}
        actions={[
          { label: t('contacts.send_message', language()), tone: 'primary' as const, onClick: () => { const c = ctxMenu.item(); ctxMenu.close(); if (c) openConversation(c.number, c.display); } },
          { label: t('contacts.call', language()), onClick: () => { const c = ctxMenu.item(); ctxMenu.close(); if (c) fetchNui('startCall', { number: c.number }); } },
          { label: t('action.delete', language()), tone: 'danger' as const, onClick: () => { const c = ctxMenu.item(); ctxMenu.close(); if (c) void deleteConversation(c.number); } },
        ]}
      />
    </>
  );
}
