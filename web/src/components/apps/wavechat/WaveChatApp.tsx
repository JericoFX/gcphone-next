import { createMemo, createSelector, createSignal, For, Show, createEffect, onCleanup, onMount } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { useMessages } from '../../../store/messages';
import { useContacts } from '../../../store/contacts';
import { usePhoneKeyHandler } from '../../../hooks/usePhoneKeyHandler';
import { fetchNui } from '../../../utils/fetchNui';
import { useNuiCustomEvent } from '../../../utils/useNui';
import { formatPhoneNumber, generateColorForString, timeAgo } from '../../../utils/misc';
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
import { EmojiPickerButton } from '../../shared/ui/EmojiPicker';
import { AppScaffold } from '../../shared/layout';
import { getStoredLanguage, t } from '../../../i18n';
import { useWaveChatDerivedData } from './hooks/useWaveChatDerivedData';
import { useWaveChatRouteSync } from './hooks/useWaveChatRouteSync';
import styles from './WaveChatApp.module.scss';

interface GifResult {
  id: string;
  url: string;
}

interface UploadConfig {
  uploadUrl: string;
  uploadField: string;
}

interface WaveChatGroup {
  id: number;
  name: string;
  members?: number;
}

interface WaveChatInvite {
  id: number;
  group_id: number;
  group_name: string;
  inviter_number?: string;
  created_at?: string;
}

interface WaveChatGroupMessage {
  id: number | string;
  group_id: number;
  sender_number?: string;
  message: string;
  media_url?: string;
  created_at?: string;
}

interface WaveStatus {
  id: number;
  identifier?: string;
  phone_number: string;
  media_url: string;
  media_type: 'image' | 'video';
  caption?: string;
  views?: number;
  created_at?: string;
  expires_at?: string;
  contact_name?: string;
}

interface WaveStatusMediaConfig {
  provider?: string;
  canUploadImage?: boolean;
  canUploadVideo?: boolean;
  maxVideoDurationSeconds?: number;
}

interface WaveSocketAuth {
  success?: boolean;
  host?: string;
  token?: string;
}

function extractCoords(text?: string): { x: number; y: number } | null {
  if (!text) return null;
  const match = text.match(/LOC:([\-\d.]+),\s*([\-\d.]+)/i);
  if (!match) return null;
  const x = Number(match[1]);
  const y = Number(match[2]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

export function WaveChatApp() {
  const router = useRouter();
  const [phoneState] = usePhone();
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
  const [groupMessages, setGroupMessages] = createSignal<Record<number, WaveChatGroupMessage[]>>({});
  const [groupMessageInput, setGroupMessageInput] = createSignal('');
  const [showCreateGroupModal, setShowCreateGroupModal] = createSignal(false);
  const waveTabs = [
    { id: 'chats', label: 'Chats' },
    { id: 'status', label: 'Estado' },
    { id: 'calls', label: 'Llamadas' },
    { id: 'groups', label: 'Grupos' },
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
  const isSelectedGroup = createSelector(selectedGroupId);

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

    await messagesActions.send(number, content, media || undefined);
    setMessageInput('');
    setAttachmentUrl(null);
  };

  const attachFromGallery = async () => {
    const gallery = await fetchNui<any[]>('getGallery', undefined, []);
    if (gallery && gallery.length > 0) {
      const nextUrl = sanitizeMediaUrl(gallery[0].url);
      if (nextUrl) setAttachmentUrl(nextUrl);
    }
    setShowAttachSheet(false);
  };

  const attachFromCamera = async () => {
    const shot = await fetchNui<{ url?: string }>('takePhoto', {} as any, { url: '' } as any);
    if (shot?.url) {
      const nextUrl = sanitizeMediaUrl(shot.url);
      if (nextUrl) {
        setAttachmentUrl(nextUrl);
        setShowAttachSheet(false);
        return;
      }
    }
    setShowAttachSheet(false);
  };

  const attachByUrl = async () => {
    const input = await uiPrompt('Pega URL de imagen, video, audio o GIF', { title: 'Adjuntar' });
    const nextUrl = sanitizeMediaUrl(input);
    if (nextUrl) {
      setAttachmentUrl(nextUrl);
    } else if (input && input.trim()) {
      uiAlert('URL invalida o formato no permitido');
    }
    setShowAttachSheet(false);
  };

  const createStatusFromMedia = async (mediaUrl: string, mediaType: 'image' | 'video') => {
    const safeUrl = sanitizeMediaUrl(mediaUrl);
    if (!safeUrl) {
      uiAlert('Media invalida para estado');
      return;
    }

    if (mediaType === 'video' && !statusMediaConfig().canUploadVideo) {
      uiAlert('El endpoint de video no esta disponible para estados');
      return;
    }

    if (mediaType === 'image' && !statusMediaConfig().canUploadImage) {
      uiAlert('No hay endpoint de imagen configurado para estados');
      return;
    }

    const caption = sanitizeText((await uiPrompt('Texto del estado (opcional)', { title: 'Nuevo estado' })) || '', 140);
    const result = await fetchNui<{ success?: boolean; error?: string }>('wavechatCreateStatus', {
      mediaUrl: safeUrl,
      mediaType,
      caption,
    }, { success: false });

    if (!result?.success) {
      uiAlert(result?.error || 'No se pudo publicar el estado');
      return;
    }

    await loadStatuses();
  };

  const createPhotoStatus = async () => {
    if (!statusMediaConfig().canUploadImage) {
      uiAlert('No hay endpoint configurado para estados con foto');
      return;
    }

    const shot = await fetchNui<{ url?: string }>('takePhoto', {} as any, { url: '' } as any);
    if (!shot?.url) return;
    await createStatusFromMedia(shot.url, 'image');
  };

  const createGalleryStatus = async () => {
    if (!statusMediaConfig().canUploadImage) {
      uiAlert('No hay endpoint configurado para estados con foto');
      return;
    }

    const gallery = await fetchNui<any[]>('getGallery', undefined, []);
    const image = gallery?.find((item: any) => {
      const url = sanitizeMediaUrl(item?.url);
      return url && resolveMediaType(url) === 'image';
    });
    if (!image?.url) {
      uiAlert('No se encontraron fotos en la galeria');
      return;
    }

    await createStatusFromMedia(image.url, 'image');
  };

  const createVideoStatus = async () => {
    const mediaConfig = await fetchNui<WaveStatusMediaConfig>('wavechatGetStatusMediaConfig', {}, { canUploadVideo: false, maxVideoDurationSeconds: 10 });
    setStatusMediaConfig(mediaConfig || { canUploadImage: false, canUploadVideo: false, maxVideoDurationSeconds: 10 });

    if (!mediaConfig?.canUploadVideo) {
      uiAlert('No hay endpoint de video disponible para estados');
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
      uiAlert('No se pudo grabar el video del estado');
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
    const input = await uiPrompt('Pega URL de audio (mp3, ogg, wav, m4a)', { title: 'Adjuntar' });
    const nextUrl = sanitizeMediaUrl(input);
    if (nextUrl && resolveMediaType(nextUrl) === 'audio') {
      setAttachmentUrl(nextUrl);
    } else if (input && input.trim()) {
      uiAlert('URL de audio invalida');
    }
    setShowAttachSheet(false);
  };

  const getContactName = (number: string) => {
    return contactDisplayByNumber().get(number) || number;
  };

  const isKnownContact = (number: string) => knownContactNumbers().has(number);

  const addContactFromMessage = async (display: string, number: string) => {
    if (isKnownContact(number)) {
      uiAlert('El contacto ya existe');
      return;
    }
    const added = await contactsActions.add(display, number);
    uiAlert(added ? 'Contacto agregado' : 'No se pudo agregar el contacto');
  };

  const getPreviewText = (message: any) => {
    if (getMediaUrl(message)) return 'Adjunto multimedia';
    const shared = parseSharedContactMessage(message?.message);
    if (shared) return `Contacto: ${shared.display}`;
    return sanitizeText(message?.message || '', 80) || 'Mensaje';
  };

  const getStatusSummary = (status: WaveStatus) => {
    if (status.caption) return status.caption;
    return status.media_type === 'video' ? 'Video efimero de 10 segundos' : 'Foto efimera';
  };

  const sendLocationText = async () => {
    const number = selectedConversation();
    if (!number) return;
    const x = Number(await uiPrompt('Coordenada X', { title: 'Compartir ubicacion' }));
    const y = Number(await uiPrompt('Coordenada Y', { title: 'Compartir ubicacion' }));
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    await messagesActions.send(number, `📍 Ubicacion compartida LOC:${x.toFixed(2)},${y.toFixed(2)}`);
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
      uiAlert('Grabacion de audio no disponible en este entorno');
      return;
    }

    const uploadConfig = await fetchNui<UploadConfig>('getUploadConfig', {}, { uploadUrl: '', uploadField: 'files[]' });
    if (!uploadConfig?.uploadUrl) {
      uiAlert('Configura Config.Gallery.UploadUrl para enviar audios');
      return;
    }

    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: BlobPart[] = [];
      mediaRecorder = new MediaRecorder(mediaStream);
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        setUploadingVoice(true);
        try {
          const blob = new Blob(chunks, { type: mediaRecorder?.mimeType || 'audio/webm' });
          const formData = new FormData();
          formData.append(uploadConfig.uploadField || 'files[]', blob, 'voice-note.webm');

          const response = await fetch(uploadConfig.uploadUrl, { method: 'POST', body: formData });
          if (!response.ok) throw new Error('upload_failed');
          const payload = (await response.json()) as { url?: string; files?: Array<{ url?: string }> };
          const uploadedUrl = sanitizeMediaUrl(payload?.files?.[0]?.url || payload?.url);
          if (uploadedUrl && resolveMediaType(uploadedUrl) === 'audio') {
            setAttachmentUrl(uploadedUrl);
          } else {
             uiAlert('Respuesta de upload invalida para audio');
          }
        } catch (_err) {
           uiAlert('No se pudo subir la nota de voz');
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
      uiAlert('No se pudo iniciar la grabacion');
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
          <ConversationView
            phoneNumber={selectedConversation()!}
            contactName={routeConversationName() || getContactName(selectedConversation()!)}
            messages={selectedConversationMessages()}
            messageInput={messageInput()}
            attachmentUrl={attachmentUrl()}
            showAttachSheet={showAttachSheet()}
            setShowAttachSheet={setShowAttachSheet}
            onInput={setMessageInput}
            onSend={sendMessage}
            onAttachGallery={attachFromGallery}
            onAttachCamera={attachFromCamera}
            onAttachUrl={attachByUrl}
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
        <AppScaffold title='WaveChat' subtitle='Chats, grupos y llamadas' onBack={() => router.goBack()} bodyPadding='none'>
          <div class={styles.app}>
            <div class={styles.tabs}>
              <SegmentedTabs items={waveTabs} active={activeTab()} onChange={(id) => setActiveTab(id as 'chats' | 'status' | 'calls' | 'groups')} />
            </div>

            <div class={styles.list}>
          <Show when={activeTab() === 'chats'}>
            <Show when={conversations().length > 0} fallback={<EmptyState class={styles.emptyState} title="Sin chats por ahora" description="Tus conversaciones apareceran aqui." />}>
              <VirtualList items={conversations} itemHeight={78} overscan={5}>
                {(convo, index) => (
                  <div
                    class={styles.conversationItem}
                    classList={{ [styles.selected]: isSelectedConversationIndex(index()) }}
                    onClick={() => openConversation(convo.number, convo.display)}
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
                      Borrar
                    </button>
                  </div>
                )}
              </VirtualList>
            </Show>
          </Show>

          <Show when={activeTab() === 'status'}>
            <div class={styles.statusPanel}>
              <div class={styles.statusHero}>
                <div class={styles.statusHeroHeader}>
                  <div>
                    <span class={styles.statusHeroEyebrow}>WaveChat Status</span>
                    <h3>Estados efimeros</h3>
                    <p>Se borran solos en 24 horas. Foto si hay endpoint; video solo si Lua confirma subida y hasta 10 segundos.</p>
                  </div>
                  <div class={styles.statusHeroStats}>
                    <strong>{statusRows().mine.length}</strong>
                    <span>mios</span>
                  </div>
                </div>
                <div class={styles.statusComposer}>
                  <button class={styles.statusBtn} onClick={() => void createPhotoStatus()} disabled={!statusMediaConfig().canUploadImage}>Foto</button>
                  <button class={styles.statusBtn} onClick={() => void createGalleryStatus()} disabled={!statusMediaConfig().canUploadImage}>Galeria</button>
                  <button class={styles.statusBtn} onClick={() => void createVideoStatus()} disabled={!statusMediaConfig().canUploadVideo}>Video 10s</button>
                </div>
              </div>

              <Show when={statusRows().mine.length > 0}>
                <div class={styles.statusSectionTitle}>Mi estado</div>
                <For each={statusRows().mine}>
                  {(status) => (
                    <div class={styles.statusItem} onClick={() => void openStatus(status)}>
                      <div class={styles.statusRing}>
                        <LetterAvatar class={styles.avatar} color={generateColorForString(status.phone_number)} label={status.contact_name || 'Yo'} />
                      </div>
                      <div class={styles.info}>
                        <div class={styles.name}>Mi estado</div>
                        <div class={styles.previewText}>{getStatusSummary(status)}</div>
                      </div>
                      <div class={styles.statusMeta}>
                        <span class={styles.time}>{timeAgo(status.created_at)}</span>
                        <span class={styles.statusBadge}>{status.media_type === 'video' ? 'Video' : 'Foto'}</span>
                      </div>
                    </div>
                  )}
                </For>
              </Show>

              <div class={styles.statusSectionTitle}>Recientes</div>
              <Show when={statusRows().others.length > 0} fallback={<div class={styles.statusEmpty}>Tus contactos aun no publicaron estados.</div>}>
                <For each={statusRows().others}>
                  {(status) => (
                    <div class={styles.statusItem} onClick={() => void openStatus(status)}>
                      <div class={styles.statusRing}>
                        <LetterAvatar class={styles.avatar} color={generateColorForString(status.phone_number)} label={status.contact_name || getContactName(status.phone_number)} />
                      </div>
                      <div class={styles.info}>
                        <div class={styles.name}>{status.contact_name || getContactName(status.phone_number)}</div>
                        <div class={styles.previewText}>{getStatusSummary(status)}</div>
                      </div>
                      <div class={styles.statusMeta}>
                        <span class={styles.time}>{timeAgo(status.created_at)}</span>
                        <button class={styles.statusBtn} onClick={(e) => { e.stopPropagation(); void openStatus(status); }}>Ver</button>
                      </div>
                    </div>
                  )}
                </For>
              </Show>
            </div>
          </Show>

          <Show when={activeTab() === 'calls'}>
            <Show when={callHistory().length > 0} fallback={<EmptyState class={styles.emptyState} title="Sin llamadas recientes" description="Tu historial de llamadas aparecera aqui." />}>
              <VirtualList items={callHistory} itemHeight={72} overscan={4}>
                {(call) => (
                  <div class={styles.callItem}>
                    <div class={styles.callDirection}>{call.incoming ? 'Entrante' : 'Saliente'}</div>
                    <div class={styles.info}>
                      <div class={styles.name}>{call.hidden ? 'Privado' : formatPhoneNumber(call.num, phoneState.framework || 'unknown')}</div>
                      <div class={styles.previewText}>{timeAgo(call.time)}</div>
                    </div>
                    <button class={styles.statusBtn} onClick={() => fetchNui('startCall', { phoneNumber: call.num })}>Llamar</button>
                  </div>
                )}
              </VirtualList>
            </Show>
          </Show>

          <Show when={activeTab() === 'groups'}>
            <Show when={groupInvites().length > 0}>
              <div class={styles.groupInvitesPanel}>
                <div class={styles.statusSectionTitle}>Invitaciones pendientes</div>
                <For each={groupInvites()}>
                  {(invite) => (
                    <div class={styles.groupInviteItem}>
                      <div class={styles.info}>
                        <div class={styles.name}>{invite.group_name}</div>
                        <div class={styles.previewText}>Te invito {invite.inviter_number ? getContactName(invite.inviter_number) : 'un contacto'}</div>
                      </div>
                      <div class={styles.groupInviteActions}>
                        <button class={styles.groupSecondaryBtn} onClick={() => void respondToInvite(invite.id, false)}>Rechazar</button>
                        <button class={styles.statusBtn} onClick={() => void respondToInvite(invite.id, true)}>Aceptar</button>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </Show>
            <div class={styles.groupsHeadRow}>
              <button class={styles.statusBtn} onClick={() => setShowCreateGroupModal(true)}>Crear grupo</button>
            </div>
            <VirtualList items={groups} itemHeight={74} overscan={4}>
              {(group) => (
                <button
                  class={styles.conversationItem}
                  classList={{ [styles.selected]: isSelectedGroup(group.id) }}
                  onClick={() => {
                    setSelectedGroupId(group.id);
                    void loadGroupMessages(group.id);
                  }}
                >
                  <LetterAvatar class={styles.avatar} color={generateColorForString(String(group.id))} label={group.name} />
                  <div class={styles.info}>
                    <div class={styles.topRow}>
                      <span class={styles.name}>{group.name}</span>
                      <span class={styles.time}>{group.members || 1} miembros</span>
                    </div>
                    <div class={styles.previewText}>Grupo de WaveChat</div>
                  </div>
                </button>
              )}
            </VirtualList>

            <Show when={selectedGroupId()}>
              <div class={styles.groupThread}>
                <div class={styles.groupThreadHeader}>
                  <div>
                    <h4>{groups().find((entry) => entry.id === selectedGroupId())?.name || 'Grupo'}</h4>
                    <p>Persistencia batch por socket y maximo 30 mensajes guardados.</p>
                  </div>
                  <span>{selectedGroupMessages().length}/30</span>
                </div>
                <Show when={selectedGroupTypingList().length > 0}>
                  <div class={styles.groupTypingRow}>
                    {selectedGroupTypingList().join(', ')} escribiendo...
                  </div>
                </Show>
                <For each={selectedGroupMessages()}>
                  {(msg) => (
                    <div class={styles.groupMsgRow}>
                      <div class={styles.groupMsgMeta}>
                        <strong>{msg.sender_number ? getContactName(msg.sender_number) : 'usuario'}</strong>
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
                                <img class={styles.groupMediaPreview} src={mediaUrl()} alt="Adjunto" onClick={() => setViewerUrl(mediaUrl())} />
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
                  <EmojiPickerButton value={groupMessageInput()} onChange={setGroupMessageInput} maxLength={800} />
                  <input value={groupMessageInput()} onInput={(e) => {
                    const next = e.currentTarget.value;
                    setGroupMessageInput(next);
                    if (selectedGroupId() && socketReady() && isWaveSocketConnected()) {
                      sendWaveTyping(String(selectedGroupId()!), next.trim().length > 0);
                    }
                  }} placeholder="Mensaje al grupo" />
                  <button class={styles.sendBtn} onClick={() => void sendGroupMessage()}>➤</button>
                </div>
              </div>
            </Show>
          </Show>
            </div>
          </div>
        </AppScaffold>
      </Show>

      <Modal open={showGifPicker()} title="GIFs" onClose={() => setShowGifPicker(false)} size="lg">
        <div class={styles.gifPanel}>
          <SheetIntro title="Buscar GIF" description="Encuentra una reaccion rapida y agregala al mensaje actual." />
          <div class={styles.gifSearchRow}>
            <SearchInput
              value={gifQuery()}
              onInput={(value) => setGifQuery(sanitizeText(value, 80))}
              placeholder="Buscar GIF"
              class={styles.gifSearchInputRoot}
              inputClass={styles.gifSearchInput}
            />
            <button onClick={() => void searchGifs()}>Buscar</button>
          </div>
          <Show when={!gifLoading()} fallback={<div class={styles.gifEmpty}>Buscando...</div>}>
            <Show when={gifResults().length > 0} fallback={<div class={styles.gifEmpty}>Sin resultados</div>}>
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
            <ModalButton label="Cerrar" onClick={() => setShowGifPicker(false)} />
          </ModalActions>
        </div>
      </Modal>
      <Modal open={showCreateGroupModal()} title="Nuevo grupo" onClose={closeCreateGroupModal} size="lg">
        <div class={styles.groupModalBody}>
          <SheetIntro title="Crear grupo" description="Elige un nombre claro y suma contactos para iniciar la conversacion compartida." />
          <label class={styles.groupField}>
            <span>Nombre del grupo</span>
            <input
              value={groupNameDraft()}
              onInput={(e) => setGroupNameDraft(sanitizeText(e.currentTarget.value, 80))}
              placeholder="Ej. Familia, Trabajo, Amigos"
            />
          </label>

          <label class={styles.groupField}>
            <span>Buscar contactos</span>
            <SearchInput
              value={groupContactSearch()}
              onInput={(value) => setGroupContactSearch(sanitizeText(value, 80))}
              placeholder="Buscar por nombre o numero"
              class={styles.groupSearchInputRoot}
              inputClass={styles.groupSearchInput}
            />
          </label>

          <div class={styles.groupSelectionSummary}>
            <strong>{groupMemberDraft().length}</strong>
            <span>contactos seleccionados</span>
          </div>

          <div class={styles.groupChecklist}>
            <For each={selectableContacts()}>
              {(contact) => {
                const safeNumber = sanitizePhone(contact.number);
                return (
                  <label class={styles.groupChecklistItem}>
                    <input
                      type="checkbox"
                      checked={groupMemberDraft().includes(safeNumber)}
                      onChange={() => toggleGroupMember(safeNumber)}
                    />
                    <div class={styles.groupChecklistInfo}>
                      <strong>{contact.display}</strong>
                      <span>{formatPhoneNumber(contact.number, phoneState.framework || 'unknown')}</span>
                    </div>
                  </label>
                );
              }}
            </For>
            <Show when={selectableContacts().length === 0}>
              <div class={styles.groupChecklistEmpty}>No hay contactos disponibles para agregar.</div>
            </Show>
          </div>
          <ModalActions>
            <ModalButton label="Cancelar" onClick={closeCreateGroupModal} />
            <ModalButton label="Crear" tone="primary" onClick={() => void createGroup()} disabled={!groupNameDraft().trim()} />
          </ModalActions>
        </div>
      </Modal>
      <MediaLightbox url={viewerUrl()} onClose={() => setViewerUrl(null)} />
    </>
  );
}

function ConversationView(props: {
  phoneNumber: string;
  contactName: string;
  messages: any[];
  messageInput: string;
  attachmentUrl: string | null;
  showAttachSheet: boolean;
  setShowAttachSheet: (value: boolean) => void;
  onInput: (value: string) => void;
  onSend: () => void;
  onAttachGallery: () => void;
  onAttachCamera: () => void;
  onAttachUrl: () => void;
  onAttachAudioUrl: () => void;
  onSendLocation: () => void;
  isRecordingVoice: boolean;
  recordingSeconds: number;
  uploadingVoice: boolean;
  onStartVoiceRecording: () => void;
  onStopVoiceRecording: () => void;
  onOpenGifPicker: () => void;
  onClearAttachment: () => void;
  onOpenViewer: (url: string | null) => void;
  getMediaUrl: (msg: any) => string | undefined;
  isKnownContact: (number: string) => boolean;
  onAddContact: (display: string, number: string) => void;
  onBack: () => void;
  onOpenCoords: (x: number, y: number) => void;
  onDeleteConversation: () => void;
  framework?: 'esx' | 'qbcore' | 'qbox' | 'unknown';
}) {
  const language = () => getStoredLanguage();
  let messagesEnd: HTMLDivElement | undefined;

  onMount(() => {
    messagesEnd?.scrollIntoView({ behavior: 'auto' });
  });

  createEffect(() => {
    if (props.messages.length > 0) {
      messagesEnd?.scrollIntoView({ behavior: 'smooth' });
    }
  });

  return (
    <div class={styles.thread}>
      <div class={styles.nav}>
        <button class={styles.iconBtn} onClick={props.onBack}>
          <img src="./img/icons_ios/ui-chevron-left.svg" alt="" draggable={false} />
        </button>
        <div class={styles.navTitle}>{props.contactName}</div>
        <button class={styles.deleteConversationBtn} onClick={props.onDeleteConversation}>Borrar</button>
      </div>

      <div class={styles.messagesList}>
        <For each={props.messages}>
          {(msg) => {
            const shared = parseSharedContactMessage(msg.message);
            const messageText = sanitizeText(msg.message || '', 800);
            const coords = extractCoords(msg.message);
            const mediaUrl = props.getMediaUrl(msg);
            const mediaType = resolveMediaType(mediaUrl);

            return (
            <div class={styles.bubble} classList={{ [styles.sent]: msg.owner === 1, [styles.received]: msg.owner === 0 }}>
              <Show when={shared} fallback={
                <>
                  <Show when={messageText}>
                    <span class={styles.messageText}>{messageText}</span>
                  </Show>
                  <Show when={coords}>
                    {(coords) => (
                      <button class={styles.mapBtn} onClick={() => props.onOpenCoords(coords().x, coords().y)}>
                        Abrir en mapa
                      </button>
                    )}
                  </Show>
                </>
              }>
                {(shared) => (
                  <div class={styles.contactCard}>
                    <div class={styles.contactCardLabel}>Contacto compartido</div>
                    <div class={styles.contactCardName}>{shared().display}</div>
                    <div class={styles.contactCardNumber}>{formatPhoneNumber(shared().number, props.framework || 'unknown')}</div>
                    <button
                      class={styles.contactCardBtn}
                      disabled={props.isKnownContact(shared().number)}
                      onClick={() => props.onAddContact(shared().display, shared().number)}
                    >
                      {props.isKnownContact(shared().number) ? 'Ya agregado' : 'Agregar contacto'}
                    </button>
                  </div>
                )}
              </Show>
              <Show when={mediaUrl}>
                <Show when={mediaType === 'image'}>
                  <img class={styles.mediaPreview} src={mediaUrl!} alt="adjunto" onClick={() => props.onOpenViewer(mediaUrl || null)} />
                </Show>
                <Show when={mediaType === 'video'}>
                  <video class={styles.mediaPreview} src={mediaUrl!} controls playsinline preload="metadata" />
                </Show>
                <Show when={mediaType === 'audio'}>
                  <audio class={styles.audioPreview} src={mediaUrl!} controls preload="metadata" />
                </Show>
              </Show>
              <span class={styles.messageTime}>{timeAgo(msg.time)}</span>
            </div>
          )}}
        </For>
        <div ref={messagesEnd} />
      </div>

      <Show when={props.attachmentUrl}>
        <div class={styles.attachmentPreview}>
          <Show when={resolveMediaType(props.attachmentUrl || undefined) === 'image'}>
            <img src={props.attachmentUrl!} alt="adjunto" onClick={() => props.onOpenViewer(props.attachmentUrl)} />
          </Show>
          <Show when={resolveMediaType(props.attachmentUrl || undefined) === 'video'}>
            <video src={props.attachmentUrl!} controls playsinline preload="metadata" />
          </Show>
          <Show when={resolveMediaType(props.attachmentUrl || undefined) === 'audio'}>
            <audio class={styles.audioPreview} src={props.attachmentUrl!} controls preload="metadata" />
          </Show>
          <button onClick={props.onClearAttachment}>Quitar</button>
        </div>
      </Show>

      <div class={styles.inputContainer}>
        <button class={styles.attachBtn} onClick={() => props.setShowAttachSheet(true)}>
          ＋
        </button>
        <EmojiPickerButton value={props.messageInput} onChange={props.onInput} maxLength={800} />
        <input
          type="text"
          placeholder={t('messages.message_placeholder', language())}
          value={props.messageInput}
          onInput={(e) => props.onInput(e.currentTarget.value)}
          onKeyPress={(e) => e.key === 'Enter' && props.onSend()}
        />
        <button class={styles.sendBtn} onClick={props.onSend}>
          ➤
        </button>
      </div>

      <Show when={props.uploadingVoice}>
        <div class={styles.voiceUploading}>{t('wavechat.uploading_voice', language())}</div>
      </Show>

      <ActionSheet
        open={props.showAttachSheet}
        title={t('messages.attach', language())}
        onClose={() => props.setShowAttachSheet(false)}
        actions={[
          { label: t('messages.attach_gallery', language()), tone: 'primary', onClick: props.onAttachGallery },
          { label: t('messages.attach_camera', language()), onClick: props.onAttachCamera },
          { label: t('wavechat.search_gif', language()), onClick: props.onOpenGifPicker },
          { label: t('messages.attach_url', language()), onClick: props.onAttachUrl },
          { label: t('wavechat.attach_audio_url', language()), onClick: props.onAttachAudioUrl },
          { label: props.isRecordingVoice ? t('wavechat.stop_recording', language(), { seconds: props.recordingSeconds }) : t('wavechat.record_voice', language()), onClick: props.isRecordingVoice ? props.onStopVoiceRecording : props.onStartVoiceRecording },
          { label: t('maps.share_location', language()), onClick: props.onSendLocation },
          { label: t('messages.remove_attachment', language()), tone: 'danger', onClick: props.onClearAttachment },
        ]}
      />
    </div>
  );
}
