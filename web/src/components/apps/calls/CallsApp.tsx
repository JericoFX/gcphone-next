import { createSignal, For, Show, createEffect, onCleanup, batch } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchNui } from '../../../utils/fetchNui';
import { useNuiEvent } from '../../../utils/useNui';
import { generateColorForString, timeAgo } from '../../../utils/misc';
import { ScreenState } from '../../shared/ui/ScreenState';
import { SkeletonList } from '../../shared/ui/SkeletonList';
import { ActionSheet } from '../../shared/ui/ActionSheet';
import { useNotifications } from '../../../store/notifications';
import { fetchLiveKitToken } from '../../../utils/realtimeAuth';
import { connectLiveKit, disconnectLiveKit, setLiveKitCameraEnabled, setLiveKitMicrophoneEnabled } from '../../../utils/livekit';
import type { Call } from '../../../types';
import styles from './CallsApp.module.scss';

type TabType = 'favorites' | 'recents' | 'contacts' | 'keypad';
type TrackKind = 'audio' | 'video';

interface MediaTrackEntry {
  sid: string;
  kind: TrackKind;
  element: HTMLMediaElement;
}

export function CallsApp() {
  const router = useRouter();
  const [notifications, notificationsActions] = useNotifications();
  const [activeTab, setActiveTab] = createSignal<TabType>('recents');
  const [callHistory, setCallHistory] = createSignal<Call[]>([]);
  const [dialNumber, setDialNumber] = createSignal('');
  const [inCall, setInCall] = createSignal(false);
  const [callInfo, setCallInfo] = createSignal<any>(null);
  const [contacts, setContacts] = createSignal<any[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [showQuickActions, setShowQuickActions] = createSignal(false);
  const [videoMode, setVideoMode] = createSignal(false);
  const [videoStatus, setVideoStatus] = createSignal('');
  const [videoParticipants, setVideoParticipants] = createSignal<string[]>([]);
  const [localVideoIdentity, setLocalVideoIdentity] = createSignal('');
  const mediaHosts = new Map<string, HTMLDivElement>();
  const participantTracks = new Map<string, MediaTrackEntry[]>();

  const renderParticipantMedia = (identity: string) => {
    const host = mediaHosts.get(identity);
    if (!host) return;

    host.innerHTML = '';
    const tracks = participantTracks.get(identity) || [];
    const videoTrack = tracks.find((entry) => entry.kind === 'video');
    const audioTracks = tracks.filter((entry) => entry.kind === 'audio');

    if (videoTrack) {
      videoTrack.element.className = styles.videoElement;
      videoTrack.element.muted = false;
      host.classList.add(styles.hasVideo);
      host.appendChild(videoTrack.element);
    } else {
      host.classList.remove(styles.hasVideo);
    }

    for (const audio of audioTracks) {
      audio.element.style.display = 'none';
      host.appendChild(audio.element);
    }
  };

  const upsertParticipant = (identity: string) => {
    setVideoParticipants((prev) => (prev.includes(identity) ? prev : [...prev, identity]));
  };

  const removeParticipant = (identity: string) => {
    setVideoParticipants((prev) => prev.filter((x) => x !== identity));
    const entries = participantTracks.get(identity) || [];
    for (const entry of entries) {
      entry.element.remove();
    }
    participantTracks.delete(identity);
  };

  const addTrack = (identity: string, track: MediaTrackEntry) => {
    const isLocal = identity === localVideoIdentity();
    if (isLocal && track.kind === 'audio') {
      track.element.muted = true;
    }
    const entries = participantTracks.get(identity) || [];
    const deduped = entries.filter((entry) => entry.sid !== track.sid);
    for (const prev of entries) {
      if (prev.sid === track.sid) {
        prev.element.remove();
      }
    }
    participantTracks.set(identity, [...deduped, track]);
    upsertParticipant(identity);
    renderParticipantMedia(identity);
  };

  const removeTrack = (identity: string, sid: string) => {
    const entries = participantTracks.get(identity) || [];
    const next: MediaTrackEntry[] = [];
    for (const entry of entries) {
      if (entry.sid === sid) {
        entry.element.remove();
      } else {
        next.push(entry);
      }
    }
    participantTracks.set(identity, next);
    renderParticipantMedia(identity);
  };

  const setMediaHost = (identity: string, element?: HTMLDivElement) => {
    if (element) {
      mediaHosts.set(identity, element);
      renderParticipantMedia(identity);
      return;
    }
    mediaHosts.delete(identity);
  };

  const clearVideoState = () => {
    for (const entries of participantTracks.values()) {
      for (const entry of entries) {
        entry.element.remove();
      }
    }
    participantTracks.clear();
    for (const host of mediaHosts.values()) {
      host.innerHTML = '';
      host.classList.remove(styles.hasVideo);
    }
  };

  const resetCallUi = () => {
    disconnectLiveKit();
    clearVideoState();
    batch(() => {
      setInCall(false);
      setCallInfo(null);
      setVideoMode(false);
      setVideoStatus('');
      setVideoParticipants([]);
      setLocalVideoIdentity('');
    });
  };
  
  const loadHistory = async () => {
    const history = await fetchNui<Call[]>('getCallHistory', undefined, []);
    setCallHistory(history || []);
    const allContacts = await fetchNui<any[]>('getContacts', undefined, []);
    setContacts(allContacts || []);
    setLoading(false);
  };
  
  createEffect(() => {
    loadHistory();
  });
  
  createEffect(() => {
    const handleKeyUp = (e: CustomEvent<string>) => {
      const key = e.detail;
      
      if (inCall()) {
        if (key === 'Backspace') {
          endCall();
        }
        return;
      }
      
      switch (key) {
        case 'Backspace':
          router.goBack();
          break;
      }
    };
    
    window.addEventListener('phone:keyUp', handleKeyUp as EventListener);
    onCleanup(() => window.removeEventListener('phone:keyUp', handleKeyUp as EventListener));
  });
  
  const startCall = async (number: string) => {
    if (notifications.airplaneMode) {
      notificationsActions.receive({
        appId: 'calls',
        title: 'Modo avion activo',
        message: 'Desactiva modo avion para realizar llamadas',
        icon: '📵',
        durationMs: 2800,
      });
      return;
    }

    const result = await fetchNui<any>('startCall', { phoneNumber: number });

    if (result?.error === 'AIRPLANE_MODE_CALL_BLOCKED') {
      notificationsActions.receive({
        appId: 'calls',
        title: 'Modo avion activo',
        message: 'Desactiva modo avion para realizar llamadas',
        icon: '📵',
        durationMs: 2800,
      });
      return;
    }

    if (result?.error === 'TARGET_AIRPLANE_MODE') {
      notificationsActions.receive({
        appId: 'calls',
        title: 'No disponible',
        message: 'El destinatario no puede recibir llamadas en este momento',
        icon: '📵',
        durationMs: 2800,
      });
      return;
    }

    if (result?.error === 'RATE_LIMIT') {
      notificationsActions.receive({
        appId: 'calls',
        title: 'Espera un momento',
        message: 'Estas intentando llamar demasiado rapido',
        icon: '⏳',
        durationMs: 2200,
      });
      return;
    }
    
    if (result) {
      batch(() => {
        setCallInfo(result);
        setInCall(true);
      });
    }
  };
  
  const endCall = async () => {
    if (callInfo()?.id) {
      await fetchNui('endCall', { callId: callInfo().id });
    }
    resetCallUi();
  };

  const handleMuteToggle = async (nextMuted: boolean) => {
    if (!videoMode()) return;
    await setLiveKitMicrophoneEnabled(!nextMuted);
  };

  const startVideoCall = async () => {
    const currentCall = callInfo();
    if (!currentCall?.id) return;

    setVideoStatus('Conectando video...');
    const roomName = `call-${currentCall.id}`;
    const tokenPayload = await fetchLiveKitToken(roomName, true);
    if (!tokenPayload?.success || !tokenPayload.token || !tokenPayload.url) {
      setVideoStatus('No se pudo iniciar video');
      return;
    }

    try {
      await connectLiveKit(tokenPayload.url, tokenPayload.token, {
        onParticipantConnected: (identity) => {
          upsertParticipant(identity);
        },
        onParticipantDisconnected: (identity) => {
          removeParticipant(identity);
        },
        onTrackSubscribed: ({ participantIdentity, trackSid, kind, element }) => {
          addTrack(participantIdentity, { sid: trackSid, kind, element });
        },
        onTrackUnsubscribed: ({ participantIdentity, trackSid }) => {
          removeTrack(participantIdentity, trackSid);
        },
        onLocalTrackPublished: ({ participantIdentity, trackSid, kind, element }) => {
          addTrack(participantIdentity, { sid: trackSid, kind, element });
        },
        onLocalTrackUnpublished: ({ participantIdentity, trackSid }) => {
          removeTrack(participantIdentity, trackSid);
        },
      });

      await setLiveKitCameraEnabled(true);
      await setLiveKitMicrophoneEnabled(true);

      const local = tokenPayload.identity || 'local';
      const remote = currentCall.receiverNum || 'participant';
      setLocalVideoIdentity(local);

      upsertParticipant(local);
      upsertParticipant(remote);
      setVideoMode(true);
      setVideoStatus('Video activo');
    } catch (_err) {
      setVideoStatus('Error de conexion de video');
      disconnectLiveKit();
    }
  };

  onCleanup(() => {
    resetCallUi();
  });

  useNuiEvent<any>('incomingCall', (payload) => {
    const incoming = payload || {};
    setCallInfo((prev) => ({
      ...(prev || {}),
      id: incoming.id,
      receiverNum: incoming.transmitterNum || incoming.receiverNum || prev?.receiverNum || '',
      incoming: true,
    }));
    setInCall(true);
  });

  useNuiEvent<any>('callAccepted', (payload) => {
    const accepted = payload || {};
    setCallInfo((prev) => ({ ...(prev || {}), ...accepted }));
    setInCall(true);
  });

  useNuiEvent<any>('callRejected', () => {
    resetCallUi();
    void loadHistory();
  });

  useNuiEvent<any>('callEnded', () => {
    resetCallUi();
    void loadHistory();
  });
  
  const dialKeyPress = (num: string) => {
    setDialNumber(prev => prev + num);
  };
  
  const dialDelete = () => {
    setDialNumber(prev => prev.slice(0, -1));
  };

  const getHistoryIcon = (call: Call) => {
    if (!call.accepts && call.incoming) return './img/icons_ios/phone-missed.svg';
    if (call.incoming) return './img/icons_ios/phone-incoming.svg';
    return './img/icons_ios/phone-outgoing.svg';
  };
  
  const keypadKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
  
  return (
    <div class="ios-page">
      <div class="ios-nav">
        <button class="ios-icon-btn" onClick={() => router.goBack()}>
          ‹
        </button>
        <div class="ios-nav-title">Llamadas</div>
      </div>
      
      <Show when={inCall()} fallback={
        <>
          <div class={styles.content}>
            <Show when={activeTab() === 'keypad'}>
              <div class={styles.keypadView}>
                <div class={styles.dialDisplay}>
                  <span>{dialNumber()}</span>
                  <button class={styles.deleteBtn} onClick={dialDelete}>
                    ⌫
                  </button>
                </div>
                
                <div class={styles.keypad}>
                  <For each={keypadKeys}>
                    {(key) => (
                      <button class={styles.key} onClick={() => dialKeyPress(key)}>
                        {key}
                      </button>
                    )}
                  </For>
                </div>
                
                <button 
                  class={styles.callBtn}
                  onClick={() => dialNumber() && startCall(dialNumber())}
                  disabled={!dialNumber()}
                >
                  <img src="./img/icons_ios/phone-solid.svg" alt="Llamar" />
                </button>
              </div>
            </Show>
            
            <Show when={activeTab() === 'recents'}>
              <Show when={loading()} fallback={<ScreenState loading={false} empty={callHistory().length === 0} emptyTitle="Sin llamadas" emptyDescription="Tu historial aparecera aqui.">
              <div class={styles.historyList}>
                <For each={callHistory()}>
                  {(call) => (
                    <div class={styles.historyItem}>
                      <div 
                        class={styles.callIcon}
                        classList={{
                          [styles.missed]: !call.accepts && call.incoming,
                          [styles.outgoing]: !call.incoming
                        }}
                      >
                        <img src={getHistoryIcon(call)} alt="estado" />
                      </div>
                      <div class={styles.info}>
                        <span class={styles.number}>
                          {call.hidden ? '###-####' : call.num}
                        </span>
                        <span class={styles.time}>{timeAgo(call.time)}</span>
                      </div>
                      <button 
                        class={styles.callBtn}
                        onClick={() => startCall(call.num)}
                      >
                        <img src="./img/icons_ios/phone-solid.svg" alt="Llamar" />
                      </button>
                    </div>
                  )}
                </For>
              </div>
              </ScreenState>}>
                <SkeletonList rows={6} avatar />
              </Show>
            </Show>
            
            <Show when={activeTab() === 'favorites'}>
              <div class={styles.emptyState}>
                <span>No hay favoritos</span>
              </div>
            </Show>
            
            <Show when={activeTab() === 'contacts'}>
              <Show when={loading()} fallback={<ScreenState loading={false} empty={contacts().length === 0} emptyTitle="Sin contactos" emptyDescription="Agrega contactos para llamar rapido.">
                <div class={styles.historyList}>
                  <For each={contacts()}>
                    {(contact) => (
                      <div class={styles.historyItem}>
                        <div class={styles.callIcon} style={{ color: generateColorForString(contact.number) }}>
                          ●
                        </div>
                        <div class={styles.info}>
                          <span class={styles.number}>{contact.display}</span>
                          <span class={styles.time}>{contact.number}</span>
                        </div>
                        <button class={styles.callBtn} onClick={() => startCall(contact.number)}>
                          📞
                        </button>
                      </div>
                    )}
                  </For>
                </div>
              </ScreenState>}>
                <SkeletonList rows={6} avatar />
              </Show>
            </Show>
          </div>
          
          <div class={styles.tabs}>
            <button 
              class={styles.tab}
              classList={{ [styles.active]: activeTab() === 'favorites' }}
              onClick={() => setActiveTab('favorites')}
            >
              <span class={styles.icon}><img src="./img/icons_ios/star-fill.svg" alt="Favoritos" /></span>
              <span class={styles.label}>Favoritos</span>
            </button>
            <button 
              class={styles.tab}
              classList={{ [styles.active]: activeTab() === 'recents' }}
              onClick={() => setActiveTab('recents')}
            >
              <span class={styles.icon}><img src="./img/icons_ios/clock.svg" alt="Recientes" /></span>
              <span class={styles.label}>Recientes</span>
            </button>
            <button 
              class={styles.tab}
              classList={{ [styles.active]: activeTab() === 'contacts' }}
              onClick={() => setActiveTab('contacts')}
            >
              <span class={styles.icon}><img src="./img/icons_ios/person.svg" alt="Contactos" /></span>
              <span class={styles.label}>Contactos</span>
            </button>
            <button 
              class={styles.tab}
              classList={{ [styles.active]: activeTab() === 'keypad' }}
              onClick={() => setActiveTab('keypad')}
            >
              <span class={styles.icon}><img src="./img/icons_ios/grid.svg" alt="Teclado" /></span>
              <span class={styles.label}>Teclado</span>
            </button>
          </div>

          <button class={styles.fab} onClick={() => setShowQuickActions(true)}>+</button>

          <ActionSheet
            open={showQuickActions()}
            title="Nueva accion"
            onClose={() => setShowQuickActions(false)}
            actions={[
              { label: 'Nuevo numero', tone: 'primary', onClick: () => { setActiveTab('keypad'); } },
              { label: 'Recientes', onClick: () => { setActiveTab('recents'); } },
              { label: 'Contactos', onClick: () => { setActiveTab('contacts'); } },
            ]}
          />
        </>
      }>
        <ActiveCallView 
          callInfo={callInfo()}
          videoMode={videoMode()}
          videoStatus={videoStatus()}
          videoParticipants={videoParticipants()}
          onMediaHost={setMediaHost}
          onStartVideo={startVideoCall}
          onToggleMute={handleMuteToggle}
          onEnd={endCall}
        />
      </Show>
    </div>
  );
}

function ActiveCallView(props: { callInfo: any; videoMode: boolean; videoStatus: string; videoParticipants: string[]; onMediaHost: (identity: string, element?: HTMLDivElement) => void; onStartVideo: () => void; onToggleMute: (nextMuted: boolean) => Promise<void>; onEnd: () => void }) {
  const [duration, setDuration] = createSignal(0);
  const [muted, setMuted] = createSignal(false);
  const [speaker, setSpeaker] = createSignal(false);
  
  let timer: number | undefined;
  
  createEffect(() => {
    timer = window.setInterval(() => {
      setDuration(prev => prev + 1);
    }, 1000);
    onCleanup(() => {
      if (timer) window.clearInterval(timer);
    });
  });
  
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <div class={styles.activeCall}>
      <Show when={props.videoMode}>
        <div class={styles.videoStatus}>{props.videoStatus}</div>
        <div class={styles.videoGrid}>
          <For each={props.videoParticipants}>
            {(participant) => (
              <div class={styles.videoTile}>
                <div class={styles.videoMedia} ref={(el) => props.onMediaHost(participant, el)} />
                <div class={styles.videoAvatar}>{participant.charAt(0).toUpperCase()}</div>
                <div class={styles.videoName}>{participant}</div>
              </div>
            )}
          </For>
        </div>
      </Show>
      <div class={styles.callerInfo}>
        <div class={styles.avatar}>
          {props.callInfo?.receiverNum?.charAt(0) || '?'}
        </div>
        <div class={styles.name}>
          {props.callInfo?.receiverNum || 'Llamando...'}
        </div>
        <div class={styles.status}>
          {formatDuration(duration())}
        </div>
      </div>
      
      <div class={styles.callActions}>
        <button 
          class={styles.actionBtn}
          classList={{ [styles.active]: muted() }}
          onClick={() => {
            const next = !muted();
            setMuted(next);
            void props.onToggleMute(next);
          }}
        >
          <span class={styles.icon}><img src="./img/icons_ios/mic-off.svg" alt="Silenciar" /></span>
          <span class={styles.label}>Silenciar</span>
        </button>
        <button 
          class={styles.actionBtn}
          classList={{ [styles.active]: speaker() }}
          onClick={() => setSpeaker(prev => !prev)}
        >
          <span class={styles.icon}><img src="./img/icons_ios/speaker.svg" alt="Altavoz" /></span>
          <span class={styles.label}>Altavoz</span>
        </button>
        <button class={styles.actionBtn}>
          <span class={styles.icon}><img src="./img/icons_ios/add-call.svg" alt="Añadir" /></span>
          <span class={styles.label}>Añadir</span>
        </button>
        <button class={styles.actionBtn} onClick={props.onStartVideo}>
          <span class={styles.icon}><img src="./img/icons_ios/video-call.svg" alt="Video" /></span>
          <span class={styles.label}>Video</span>
        </button>
      </div>

      <Show when={!props.videoMode}>
        <button class={styles.startVideoBtn} onClick={props.onStartVideo}>Iniciar video</button>
      </Show>
      
      <button class={styles.endCallBtn} onClick={props.onEnd}>
        <img src="./img/icons_ios/phone-end.svg" alt="Colgar" />
      </button>
    </div>
  );
}
