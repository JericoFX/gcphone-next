import { createSignal, For, Show, createEffect, onCleanup, onMount } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { useMessages } from '../../../store/messages';
import { useContacts } from '../../../store/contacts';
import { fetchNui } from '../../../utils/fetchNui';
import { useNuiCustomEvent } from '../../../utils/useNui';
import { generateColorForString, timeAgo } from '../../../utils/misc';
import { resolveMediaType, sanitizeMediaUrl, sanitizeText } from '../../../utils/sanitize';
import { fetchSocketToken } from '../../../utils/realtimeAuth';
import { connectWaveSocket, disconnectWaveSocket, getWaveRecent, isWaveSocketConnected, joinWaveRoom, leaveWaveRoom, sendWaveMessage, sendWaveTyping, type WaveSocketMessage } from '../../../utils/socket';
import { ActionSheet } from '../../shared/ui/ActionSheet';
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

interface WaveChatGroupMessage {
  id: number;
  group_id: number;
  sender_number?: string;
  message: string;
  media_url?: string;
  created_at?: string;
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
  const [messagesState, messagesActions] = useMessages();
  const [contactsState] = useContacts();
  const [selectedConversation, setSelectedConversation] = createSignal<string | null>(null);
  const [messageInput, setMessageInput] = createSignal('');
  const [attachmentUrl, setAttachmentUrl] = createSignal<string | null>(null);
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
  const [selectedGroupId, setSelectedGroupId] = createSignal<number | null>(null);
  const [groupMessages, setGroupMessages] = createSignal<Record<number, WaveChatGroupMessage[]>>({});
  const [groupMessageInput, setGroupMessageInput] = createSignal('');
  const [socketReady, setSocketReady] = createSignal(false);
  const [groupTyping, setGroupTyping] = createSignal<Record<number, string[]>>({});

  let mediaRecorder: MediaRecorder | null = null;
  let mediaStream: MediaStream | null = null;
  let recordingInterval: number | undefined;
  const typingTimers = new Map<string, number>();

  const getMediaUrl = (msg: any): string | undefined => sanitizeMediaUrl(msg.mediaUrl || msg.media_url) || undefined;

  const loadCallHistory = async () => {
    const history = await fetchNui<any[]>('getCallHistory', undefined, []);
    setCallHistory(history || []);
  };

  const loadGroups = async () => {
    const list = await fetchNui<WaveChatGroup[]>('wavechatGetGroups', {}, []);
    setGroups(list || []);
  };

  const loadGroupMessages = async (groupId: number) => {
    const list = await fetchNui<WaveChatGroupMessage[]>('wavechatGetGroupMessages', { groupId }, []);
    setGroupMessages((prev) => ({ ...prev, [groupId]: list || [] }));
  };

  const createGroup = async () => {
    const name = sanitizeText(window.prompt('Nombre del grupo') || '', 80);
    if (!name) return;
    const membersRaw = sanitizeText(window.prompt('Numeros (separados por coma)') || '', 200);
    const members = membersRaw
      .split(',')
      .map((x) => sanitizeText(x, 20))
      .filter(Boolean);
    const result = await fetchNui<{ success?: boolean; groupId?: number }>('wavechatCreateGroup', { name, members }, { success: false });
    if (result?.success) {
      await loadGroups();
      if (result.groupId) {
        setSelectedGroupId(result.groupId);
        await loadGroupMessages(result.groupId);
      }
    }
  };

  const sendGroupMessage = async () => {
    const groupId = selectedGroupId();
    const content = sanitizeText(groupMessageInput(), 800);
    if (!groupId || !content) return;
    if (socketReady() && isWaveSocketConnected()) {
      const ack = await sendWaveMessage(String(groupId), content);
      if (ack?.success) {
        setGroupMessageInput('');
        sendWaveTyping(String(groupId), false);
      }
      return;
    }
    const result = await fetchNui<{ success?: boolean; message?: WaveChatGroupMessage }>('wavechatSendGroupMessage', { groupId, message: content }, { success: false });
    if (result?.success) {
      setGroupMessageInput('');
      await loadGroupMessages(groupId);
    }
  };

  const conversations = () => {
    const convos: Map<string, { number: string; display: string; lastMessage: any; unread: number }> = new Map();

    for (const msg of messagesState.messages) {
      const number = msg.owner === 1 ? msg.receiver : msg.transmitter;

      if (!convos.has(number)) {
        const contact = contactsState.contacts.find((c) => c.number === number);
        convos.set(number, {
          number,
          display: contact?.display || number,
          lastMessage: msg,
          unread: 0,
        });
      }

      const convo = convos.get(number)!;
      if (new Date(msg.time) > new Date(convo.lastMessage.time)) {
        convo.lastMessage = msg;
      }

      if (!msg.isRead && msg.owner === 0) {
        convo.unread++;
      }
    }

    return Array.from(convos.values()).sort(
      (a, b) => new Date(b.lastMessage.time).getTime() - new Date(a.lastMessage.time).getTime(),
    );
  };

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

  createEffect(() => {
    const handleKeyUp = (e: CustomEvent<string>) => {
      const key = e.detail;

      if (selectedConversation()) {
        if (key === 'Backspace') {
          setSelectedConversation(null);
        }
        return;
      }

      const convos = conversations();

      switch (key) {
        case 'ArrowUp':
          setSelectedIndex((prev) => Math.max(0, prev - 1));
          break;
        case 'ArrowDown':
          setSelectedIndex((prev) => Math.min(convos.length - 1, prev + 1));
          break;
        case 'Enter':
          if (selectedIndex() >= 0 && selectedIndex() < convos.length) {
            setSelectedConversation(convos[selectedIndex()].number);
          }
          break;
        case 'Backspace':
          router.goBack();
          break;
      }
    };

    window.addEventListener('phone:keyUp', handleKeyUp as EventListener);
    onCleanup(() => window.removeEventListener('phone:keyUp', handleKeyUp as EventListener));
  });

  createEffect(() => {
    void loadCallHistory();
    void loadGroups();
  });

  createEffect(() => {
    const groupId = selectedGroupId();
    if (!groupId) return;
    if (!socketReady() || !isWaveSocketConnected()) return;

    joinWaveRoom(String(groupId));
    onCleanup(() => leaveWaveRoom(String(groupId)));
    void (async () => {
      const history = await getWaveRecent(String(groupId), 120);
      if (!history?.success || !history.messages) return;
      const mapped: WaveChatGroupMessage[] = history.messages.map((msg) => ({
        id: msg.id,
        group_id: Number(groupId),
        sender_number: msg.senderPhone,
        message: msg.content,
        created_at: new Date(msg.createdAt).toISOString(),
      }));
      setGroupMessages((prev) => ({ ...prev, [groupId]: mapped }));
    })();
  });

  onMount(() => {
    void (async () => {
      const auth = await fetchSocketToken();
      if (!auth?.success || !auth.host || !auth.token) {
        setSocketReady(false);
        return;
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
      });

      setSocketReady(true);
    })();
  });

  useNuiCustomEvent<WaveChatGroupMessage>('wavechatGroupMessage', (message) => {
    if (!message || !message.group_id) return;
    setGroupMessages((prev) => {
      const current = prev[message.group_id] || [];
      return { ...prev, [message.group_id]: [...current, message] };
    });
  });

  const openConversation = (number: string) => {
    setSelectedConversation(number);
    messagesActions.markAsRead(number);
  };

  const deleteConversation = async (number: string) => {
    const ok = await messagesActions.deleteConversation(number);
    if (ok && selectedConversation() === number) {
      setSelectedConversation(null);
    }
  };

  const getConversationMessages = () => {
    const number = selectedConversation();
    if (!number) return [];
    return messagesActions.getConversation(number);
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

  const attachByUrl = () => {
    const input = window.prompt('Pega URL de imagen, video, audio o GIF');
    const nextUrl = sanitizeMediaUrl(input);
    if (nextUrl) {
      setAttachmentUrl(nextUrl);
    } else if (input && input.trim()) {
      window.alert('URL invalida o formato no permitido');
    }
    setShowAttachSheet(false);
  };

  const attachAudioUrl = () => {
    const input = window.prompt('Pega URL de audio (mp3, ogg, wav, m4a)');
    const nextUrl = sanitizeMediaUrl(input);
    if (nextUrl && resolveMediaType(nextUrl) === 'audio') {
      setAttachmentUrl(nextUrl);
    } else if (input && input.trim()) {
      window.alert('URL de audio invalida');
    }
    setShowAttachSheet(false);
  };

  const getContactName = (number: string) => {
    const contact = contactsState.contacts.find((c) => c.number === number);
    return contact?.display || number;
  };

  const sendLocationText = async () => {
    const number = selectedConversation();
    if (!number) return;
    const x = Number(window.prompt('Coordenada X'));
    const y = Number(window.prompt('Coordenada Y'));
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
      window.alert('Grabacion de audio no disponible en este entorno');
      return;
    }

    const uploadConfig = await fetchNui<UploadConfig>('getUploadConfig', {}, { uploadUrl: '', uploadField: 'files[]' });
    if (!uploadConfig?.uploadUrl) {
      window.alert('Configura Config.Gallery.UploadUrl para enviar audios');
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
            window.alert('Respuesta de upload invalida para audio');
          }
        } catch (_err) {
          window.alert('No se pudo subir la nota de voz');
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
      window.alert('No se pudo iniciar la grabacion');
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
    <div class={styles.app}>
      <Show
        when={!selectedConversation()}
        fallback={
          <ConversationView
            phoneNumber={selectedConversation()!}
            contactName={getContactName(selectedConversation()!)}
            messages={getConversationMessages()}
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
            getMediaUrl={getMediaUrl}
            onBack={() => setSelectedConversation(null)}
            onOpenCoords={(x, y) => router.navigate('maps', { x, y })}
            onDeleteConversation={() => void deleteConversation(selectedConversation()!)}
          />
        }
      >
        <div class={styles.nav}>
          <button class={styles.iconBtn} onClick={() => router.goBack()}>
            ‹
          </button>
          <div class={styles.navTitle}>WaveChat</div>
          <button class={styles.iconBtn}>💬</button>
        </div>
        <div class={styles.tabs}>
          <button class={styles.tabBtn} classList={{ [styles.tabActive]: activeTab() === 'chats' }} onClick={() => setActiveTab('chats')}>Chats</button>
          <button class={styles.tabBtn} classList={{ [styles.tabActive]: activeTab() === 'status' }} onClick={() => setActiveTab('status')}>Estado</button>
          <button class={styles.tabBtn} classList={{ [styles.tabActive]: activeTab() === 'calls' }} onClick={() => setActiveTab('calls')}>Llamadas</button>
          <button class={styles.tabBtn} classList={{ [styles.tabActive]: activeTab() === 'groups' }} onClick={() => setActiveTab('groups')}>Grupos</button>
        </div>

        <div class={styles.list}>
          <Show when={activeTab() === 'chats'}>
            <For each={conversations()}>
              {(convo, index) => (
                <div
                  class={styles.conversationItem}
                  classList={{ [styles.selected]: selectedIndex() === index() }}
                  onClick={() => openConversation(convo.number)}
                >
                  <div class={styles.avatar} style={{ 'background-color': generateColorForString(convo.number) }}>
                    {convo.display.charAt(0).toUpperCase()}
                  </div>
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
                        {getMediaUrl(convo.lastMessage) ? 'Adjunto multimedia' : convo.lastMessage.message}
                      </span>
                    </div>
                  </div>
                  <button class={styles.deleteConversationBtn} onClick={(e) => { e.stopPropagation(); void deleteConversation(convo.number); }}>
                    Borrar
                  </button>
                </div>
              )}
            </For>
          </Show>

          <Show when={activeTab() === 'status'}>
            <For each={conversations()}>
              {(convo) => (
                <div class={styles.statusItem}>
                  <div class={styles.avatar} style={{ 'background-color': generateColorForString(convo.number) }}>
                    {convo.display.charAt(0).toUpperCase()}
                  </div>
                  <div class={styles.info}>
                    <div class={styles.name}>{convo.display}</div>
                    <div class={styles.previewText}>Ultima actividad {timeAgo(convo.lastMessage.time)}</div>
                  </div>
                  <button class={styles.statusBtn}>Ver</button>
                </div>
              )}
            </For>
          </Show>

          <Show when={activeTab() === 'calls'}>
            <For each={callHistory()}>
              {(call) => (
                <div class={styles.callItem}>
                  <div class={styles.callDirection}>{call.incoming ? 'Entrante' : 'Saliente'}</div>
                  <div class={styles.info}>
                    <div class={styles.name}>{call.hidden ? 'Privado' : call.num}</div>
                    <div class={styles.previewText}>{timeAgo(call.time)}</div>
                  </div>
                  <button class={styles.statusBtn} onClick={() => fetchNui('startCall', { phoneNumber: call.num })}>Llamar</button>
                </div>
              )}
            </For>
          </Show>

          <Show when={activeTab() === 'groups'}>
            <div class={styles.groupsHeadRow}>
              <button class={styles.statusBtn} onClick={() => void createGroup()}>Crear grupo</button>
            </div>
            <For each={groups()}>
              {(group) => (
                <button
                  class={styles.conversationItem}
                  classList={{ [styles.selected]: selectedGroupId() === group.id }}
                  onClick={() => {
                    setSelectedGroupId(group.id);
                    void loadGroupMessages(group.id);
                  }}
                >
                  <div class={styles.avatar} style={{ 'background-color': generateColorForString(String(group.id)) }}>
                    {group.name.charAt(0).toUpperCase()}
                  </div>
                  <div class={styles.info}>
                    <div class={styles.topRow}>
                      <span class={styles.name}>{group.name}</span>
                      <span class={styles.time}>{group.members || 1} miembros</span>
                    </div>
                    <div class={styles.previewText}>Grupo de WaveChat</div>
                  </div>
                </button>
              )}
            </For>

            <Show when={selectedGroupId()}>
              <div class={styles.groupThread}>
                <Show when={(groupTyping()[selectedGroupId()!] || []).length > 0}>
                  <div class={styles.groupTypingRow}>
                    {(groupTyping()[selectedGroupId()!] || []).join(', ')} escribiendo...
                  </div>
                </Show>
                <For each={groupMessages()[selectedGroupId()!] || []}>
                  {(msg) => (
                    <div class={styles.groupMsgRow}>
                      <strong>{msg.sender_number || 'usuario'}</strong>
                      <span>{msg.message}</span>
                    </div>
                  )}
                </For>
                <div class={styles.inputContainer}>
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
      </Show>

      <Show when={showGifPicker()}>
        <div class={styles.gifOverlay}>
          <div class={styles.gifPanel}>
            <div class={styles.gifHeader}>
              <strong>GIFs</strong>
              <button onClick={() => setShowGifPicker(false)}>Cerrar</button>
            </div>
            <div class={styles.gifSearchRow}>
              <input
                type="text"
                placeholder="Buscar GIF"
                value={gifQuery()}
                onInput={(e) => setGifQuery(sanitizeText(e.currentTarget.value, 80))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void searchGifs();
                }}
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
          </div>
        </div>
      </Show>
    </div>
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
  getMediaUrl: (msg: any) => string | undefined;
  onBack: () => void;
  onOpenCoords: (x: number, y: number) => void;
  onDeleteConversation: () => void;
}) {
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
          ‹
        </button>
        <div class={styles.navTitle}>{props.contactName}</div>
        <button class={styles.deleteConversationBtn} onClick={props.onDeleteConversation}>Borrar</button>
      </div>

      <div class={styles.messagesList}>
        <For each={props.messages}>
          {(msg) => (
            <div class={styles.bubble} classList={{ [styles.sent]: msg.owner === 1, [styles.received]: msg.owner === 0 }}>
              <Show when={sanitizeText(msg.message || '', 800)}>
                <span class={styles.messageText}>{sanitizeText(msg.message || '', 800)}</span>
              </Show>
              <Show when={extractCoords(msg.message)}>
                {(coords) => (
                  <button class={styles.mapBtn} onClick={() => props.onOpenCoords(coords().x, coords().y)}>
                    Abrir en mapa
                  </button>
                )}
              </Show>
              <Show when={props.getMediaUrl(msg)}>
                <Show when={resolveMediaType(props.getMediaUrl(msg)) === 'image'}>
                  <img class={styles.mediaPreview} src={props.getMediaUrl(msg)!} alt="adjunto" />
                </Show>
                <Show when={resolveMediaType(props.getMediaUrl(msg)) === 'video'}>
                  <video class={styles.mediaPreview} src={props.getMediaUrl(msg)!} controls playsinline preload="metadata" />
                </Show>
                <Show when={resolveMediaType(props.getMediaUrl(msg)) === 'audio'}>
                  <audio class={styles.audioPreview} src={props.getMediaUrl(msg)!} controls preload="metadata" />
                </Show>
              </Show>
              <span class={styles.messageTime}>{timeAgo(msg.time)}</span>
            </div>
          )}
        </For>
        <div ref={messagesEnd} />
      </div>

      <Show when={props.attachmentUrl}>
        <div class={styles.attachmentPreview}>
          <Show when={resolveMediaType(props.attachmentUrl || undefined) === 'image'}>
            <img src={props.attachmentUrl!} alt="adjunto" />
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
        <input
          type="text"
          placeholder="Mensaje"
          value={props.messageInput}
          onInput={(e) => props.onInput(e.currentTarget.value)}
          onKeyPress={(e) => e.key === 'Enter' && props.onSend()}
        />
        <button class={styles.sendBtn} onClick={props.onSend}>
          ➤
        </button>
      </div>

      <Show when={props.uploadingVoice}>
        <div class={styles.voiceUploading}>Subiendo nota de voz...</div>
      </Show>

      <ActionSheet
        open={props.showAttachSheet}
        title="Adjuntar"
        onClose={() => props.setShowAttachSheet(false)}
        actions={[
          { label: 'Foto desde galeria', tone: 'primary', onClick: props.onAttachGallery },
          { label: 'Tomar foto con camara', onClick: props.onAttachCamera },
          { label: 'Buscar GIF', onClick: props.onOpenGifPicker },
          { label: 'Pegar URL multimedia', onClick: props.onAttachUrl },
          { label: 'Pegar URL de audio', onClick: props.onAttachAudioUrl },
          { label: props.isRecordingVoice ? `Detener grabacion (${props.recordingSeconds}s)` : 'Grabar nota de voz', onClick: props.isRecordingVoice ? props.onStopVoiceRecording : props.onStartVoiceRecording },
          { label: 'Compartir ubicacion', onClick: props.onSendLocation },
          { label: 'Quitar adjunto', tone: 'danger', onClick: props.onClearAttachment },
        ]}
      />
    </div>
  );
}
