import { createSignal, For, Show, createEffect, onCleanup, batch, untrack } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { usePhoneState } from '../../../store/phone';
import { fetchNui } from '../../../utils/fetchNui';
import { useNuiEvent } from '../../../utils/useNui';
import { formatPhoneNumber, generateColorForString, timeAgo } from '../../../utils/misc';
import { sanitizePhone, sanitizeText } from '../../../utils/sanitize';
import { uiPrompt } from '../../../utils/uiDialog';
import { usePhoneKeyHandler } from '../../../hooks/usePhoneKeyHandler';
import { useContextMenu } from '../../../hooks/useContextMenu';
import { ScreenState } from '../../shared/ui/ScreenState';
import { SkeletonList } from '../../shared/ui/SkeletonList';
import { ActionSheet } from '../../shared/ui/ActionSheet';
import { InlineNotice } from '../../shared/ui/InlineNotice';
import { LetterAvatar } from '../../shared/ui/LetterAvatar';
import { AppFAB, AppScaffold, AppTabs } from '../../shared/layout';
import { useNotifications } from '../../../store/notifications';
import { t } from '../../../i18n';
import { fetchLiveKitToken } from '../../../utils/realtimeAuth';
import { connectLiveKit, disconnectLiveKit, setLiveKitCameraEnabled, setLiveKitMicrophoneEnabled, getCallRemainingTime } from '../../../utils/livekit';
import type { Call } from '../../../types';
import type { TabItem } from '../../shared/layout';
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
  const phoneState = usePhoneState();
  const [notifications, notificationsActions] = useNotifications();
  const [activeTab, setActiveTab] = createSignal<TabType>('recents');
  const [callHistory, setCallHistory] = createSignal<Call[]>([]);
  const [dialNumber, setDialNumber] = createSignal('');
  const [inCall, setInCall] = createSignal(false);
  const [callInfo, setCallInfo] = createSignal<any>(null);
  const [contacts, setContacts] = createSignal<any[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [showQuickActions, setShowQuickActions] = createSignal(false);
  const ctxMenu = useContextMenu<any>();
  const [videoMode, setVideoMode] = createSignal(false);
  const [videoStatus, setVideoStatus] = createSignal('');
  const [videoParticipants, setVideoParticipants] = createSignal<string[]>([]);
  const [localVideoIdentity, setLocalVideoIdentity] = createSignal('');
  const language = () => phoneState.settings.language || 'es';
  const [speedDials, setSpeedDials] = createSignal<Record<string, { number: string; name: string }>>(
    JSON.parse(localStorage.getItem('gcphone:speedDials') || '{}'),
  );
  let longPressTimer: number | undefined;

  const handleKeyPointerDown = (key: string) => {
    if (!['1','2','3','4','5','6','7','8','9'].includes(key)) return;
    longPressTimer = window.setTimeout(() => {
      longPressTimer = undefined;
      const entry = speedDials()[key];
      if (entry) {
        void startCall(entry.number, entry.name);
      } else {
        void (async () => {
          const result = await uiPrompt(`Asignar marcado rapido al ${key}`, {
            title: 'Marcado Rapido',
            placeholder: 'Numero de telefono',
          });
          if (result && result.trim()) {
            const sanitized = sanitizePhone(result.trim());
            if (!sanitized) return;
            setSpeedDials((prev) => {
              const next = { ...prev, [key]: { number: sanitized, name: sanitized } };
              localStorage.setItem('gcphone:speedDials', JSON.stringify(next));
              return next;
            });
          }
        })();
      }
    }, 800);
  };

  const handleKeyPointerUp = (key: string) => {
    if (longPressTimer !== undefined) {
      clearTimeout(longPressTimer);
      longPressTimer = undefined;
      dialKeyPress(key);
    }
  };

  const handleKeyPointerLeave = (key: string) => {
    if (longPressTimer !== undefined) {
      clearTimeout(longPressTimer);
      longPressTimer = undefined;
      dialKeyPress(key);
    }
  };

  const mediaHosts = new Map<string, HTMLDivElement>();
  const participantTracks = new Map<string, MediaTrackEntry[]>();
  const isReadOnly = () => phoneState.accessMode === 'foreign-readonly';

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
  
  usePhoneKeyHandler({
    Backspace: () => {
      if (inCall()) {
        void endCall();
        return;
      }
      router.goBack();
    },
  });
  
  const startCall = async (number: string, displayName?: string) => {
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

    if (isReadOnly()) {
      notificationsActions.receive({ appId: 'calls', title: 'Solo lectura', message: 'No puedes llamar desde un telefono ajeno', icon: '🔒', durationMs: 2200 });
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
        setCallInfo({
          ...result,
          displayName: sanitizeText(displayName, 80) || result?.displayName,
        });
        setInCall(true);
      });
    }
  };

  createEffect(() => {
    const params = router.params();
    const number = sanitizePhone(typeof params.phoneNumber === 'string' ? params.phoneNumber : typeof params.number === 'string' ? params.number : '');
    const displayName = sanitizeText(
      typeof params.display === 'string' ? params.display : typeof params.displayName === 'string' ? params.displayName : '',
      80,
    );
    const autoStart = params.autoStartCall === true || params.autoStart === true;

    if (!number || untrack(() => inCall())) return;

    setDialNumber(number);
    setActiveTab('keypad');

    if (autoStart) {
      void startCall(number, displayName);
    }
  });
  
  const endCall = async () => {
    if (callInfo()?.id) {
      await fetchNui('endCall', { callId: callInfo().id });
    }
    resetCallUi();
  };

  const rejectWithMessage = async () => {
    const currentCall = callInfo();
    if (!currentCall?.id) return;
    const target = currentCall.receiverNum;
    if (target) {
      await fetchNui('sendMessage', {
        phoneNumber: target,
        message: 'Ahora no puedo hablar, te llamo en un momento.',
      });
    }
    await fetchNui('rejectCall', { callId: currentCall.id });
    resetCallUi();
    void loadHistory();
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
    const tokenPayload = await fetchLiveKitToken(roomName, true, 300);
    if (!tokenPayload?.success || !tokenPayload.token || !tokenPayload.url) {
      setVideoStatus('No se pudo iniciar video');
      return;
    }

    try {
      await connectLiveKit(tokenPayload.url, tokenPayload.token, tokenPayload.maxDuration || 300, {
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
        onCallTimeout: () => {
          setVideoStatus('Limite de tiempo alcanzado');
          resetCallUi();
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
      setVideoStatus(t('calls.video_active', language()));
    } catch (_err) {
      setVideoStatus(t('calls.video_error', language()));
      disconnectLiveKit();
    }
  };

  onCleanup(() => {
    if (longPressTimer !== undefined) clearTimeout(longPressTimer);
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

  const tabs: TabItem[] = [
    { id: 'favorites', label: t('calls.tab.favorites', language()), icon: './img/icons_ios/star-fill.svg' },
    { id: 'recents', label: t('calls.tab.recents', language()), icon: './img/icons_ios/clock.svg' },
    { id: 'contacts', label: t('calls.tab.contacts', language()), icon: './img/icons_ios/person.svg' },
    { id: 'keypad', label: t('calls.tab.keypad', language()), icon: './img/icons_ios/grid.svg' },
  ];
  
  return (
    <Show
      when={inCall()}
      fallback={
        <AppScaffold
          title={t('calls.title', language())}
          onBack={() => router.goBack()}
          footer={<AppTabs tabs={tabs} active={activeTab()} onChange={(id) => setActiveTab(id as TabType)} />}
          footerFixed
        >
          <div class={styles.content}>
            <Show when={isReadOnly()}>
              <InlineNotice title={t('calls.readonly_title', language())} message={t('calls.readonly_message', language(), { name: phoneState.accessOwnerName || t('common.other_person', language()) })} />
            </Show>
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
                    {(key) => {
                      const isSpeedDialKey = ['1','2','3','4','5','6','7','8','9'].includes(key);
                      return (
                        <button
                          class={styles.key}
                          onClick={isSpeedDialKey ? undefined : () => dialKeyPress(key)}
                          onPointerDown={isSpeedDialKey ? () => handleKeyPointerDown(key) : undefined}
                          onPointerUp={isSpeedDialKey ? () => handleKeyPointerUp(key) : undefined}
                          onPointerLeave={isSpeedDialKey ? () => handleKeyPointerLeave(key) : undefined}
                        >
                          {key}
                          <Show when={isSpeedDialKey && speedDials()[key]}>
                            <span class={styles.speedDialDot} />
                          </Show>
                        </button>
                      );
                    }}
                  </For>
                </div>
                
                <button 
                  class={styles.callBtn}
                  onClick={() => dialNumber() && startCall(dialNumber())}
                   disabled={!dialNumber() || isReadOnly()}
                 >
                  <img src="./img/icons_ios/phone-solid.svg" alt={t('calls.call', language())} />
                </button>
              </div>
            </Show>
            
            <Show when={activeTab() === 'recents'}>
              <Show when={loading()} fallback={<ScreenState loading={false} empty={callHistory().length === 0} emptyTitle={t('calls.empty_history_title', language())} emptyDescription={t('calls.empty_history_desc', language())}>
              <div class={styles.historyList}>
                <For each={callHistory()}>
                  {(call) => (
                    <div
                      class={styles.historyItem}
                      onContextMenu={ctxMenu.onContextMenu(call)}
                    >
                      <div
                        class={styles.callIcon}
                        classList={{
                          [styles.missed]: !call.accepts && call.incoming,
                          [styles.outgoing]: !call.incoming
                        }}
                      >
                        <img src={getHistoryIcon(call)} alt={t('calls.status', language())} />
                      </div>
                      <div class={styles.info}>
                        <span class={styles.number}>
                          {call.hidden ? '###-####' : formatPhoneNumber(call.num, phoneState.framework || 'unknown')}
                        </span>
                        <span class={styles.time}>{timeAgo(call.time)}</span>
                      </div>
                        <button 
                          class={styles.callBtn}
                          onClick={() => startCall(call.num)}
                          disabled={isReadOnly()}
                        >
                        <img src="./img/icons_ios/phone-solid.svg" alt={t('calls.call', language())} />
                      </button>
                        <button
                          class={styles.callbackBtn}
                          onClick={() => startCall(call.num)}
                          disabled={isReadOnly()}
                        >
                        {t('calls.callback', language())}
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
                <span>{t('calls.no_favorites', language())}</span>
              </div>
            </Show>
            
            <Show when={activeTab() === 'contacts'}>
              <Show when={loading()} fallback={<ScreenState loading={false} empty={contacts().length === 0} emptyTitle={t('calls.empty_contacts_title', language())} emptyDescription={t('calls.empty_contacts_desc', language())}>
                <div class={styles.historyList}>
                  <For each={contacts()}>
                    {(contact) => (
                      <div class={styles.historyItem}>
                        <LetterAvatar class={styles.callIcon} color={generateColorForString(contact.number)} label={contact.display} />
                        <div class={styles.info}>
                          <span class={styles.number}>{contact.display}</span>
                          <span class={styles.time}>{formatPhoneNumber(contact.number, phoneState.framework || 'unknown')}</span>
                        </div>
                         <button class={styles.callBtn} onClick={() => startCall(contact.number, contact.display)} disabled={isReadOnly()}>
                           <img src="./img/icons_ios/ui-phone.svg" alt="" draggable={false} />
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

          <Show when={!isReadOnly()}>
            <AppFAB class={styles.fab} icon="+" onClick={() => setShowQuickActions(true)} />
          </Show>

          <ActionSheet
            open={!isReadOnly() && showQuickActions()}
            title={t('calls.new_action', language())}
            onClose={() => setShowQuickActions(false)}
            actions={[
              { label: t('calls.new_number', language()), tone: 'primary', onClick: () => { setActiveTab('keypad'); } },
              { label: t('calls.tab.recents', language()), onClick: () => { setActiveTab('recents'); } },
              { label: t('calls.tab.contacts', language()), onClick: () => { setActiveTab('contacts'); } },
            ]}
          />

          <ActionSheet
            open={ctxMenu.isOpen()}
            title={ctxMenu.item()?.num ? formatPhoneNumber(ctxMenu.item().num, phoneState.framework || 'unknown') : ''}
            onClose={ctxMenu.close}
            actions={[
              {
                label: t('calls.callback', language()),
                tone: 'primary',
                onClick: () => {
                  const c = ctxMenu.item();
                  if (!c) return;
                  ctxMenu.close();
                  void startCall(c.num);
                },
              },
              {
                label: t('contacts.send_message', language()),
                onClick: () => {
                  const c = ctxMenu.item();
                  if (!c) return;
                  ctxMenu.close();
                  router.navigate('messages', { phoneNumber: c.num });
                },
              },
            ]}
          />
        </AppScaffold>
      }
    >
        <ActiveCallView
          callInfo={callInfo()}
          framework={phoneState.framework || 'unknown'}
          videoMode={videoMode()}
          videoStatus={videoStatus()}
          videoParticipants={videoParticipants()}
          onMediaHost={setMediaHost}
          onStartVideo={startVideoCall}
          onToggleMute={handleMuteToggle}
          onRejectWithMessage={rejectWithMessage}
          onEnd={endCall}
        />
    </Show>
  );
}

function ActiveCallView(props: { callInfo: any; framework: 'esx' | 'qbcore' | 'qbox' | 'unknown'; videoMode: boolean; videoStatus: string; videoParticipants: string[]; onMediaHost: (identity: string, element?: HTMLDivElement) => void; onStartVideo: () => void; onToggleMute: (nextMuted: boolean) => Promise<void>; onRejectWithMessage: () => void; onEnd: () => void }) {
  const phoneState = usePhoneState();
  const language = () => phoneState.settings.language || 'es';
  const [duration, setDuration] = createSignal(0);
  const [muted, setMuted] = createSignal(false);
  const [speaker, setSpeaker] = createSignal(false);
  const [remainingTime, setRemainingTime] = createSignal<number | null>(null);

  let timer: number | undefined;
  let countdownTimer: number | undefined;

  createEffect(() => {
    timer = setInterval(() => {
      setDuration((d) => d + 1);
    }, 1000);

    countdownTimer = setInterval(() => {
      const remaining = getCallRemainingTime();
      setRemainingTime(remaining && remaining > 0 ? remaining : 0);
    }, 1000);

    onCleanup(() => {
      if (timer) clearInterval(timer);
      if (countdownTimer) clearInterval(countdownTimer);
    });
  });

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  const formatRemainingTime = (seconds: number) => {
    if (!seconds || seconds <= 0) return ''
    if (seconds < 60) return `${seconds}s`
    return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`
  }

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
          {(props.callInfo?.displayName || props.callInfo?.receiverNum)?.charAt(0) || '?'}
        </div>
        <div class={styles.name}>
          {props.callInfo?.displayName || (props.callInfo?.receiverNum ? formatPhoneNumber(props.callInfo.receiverNum, props.framework) : t('calls.calling', language()))}
        </div>
        <Show when={remainingTime() !== null && remainingTime()! > 0 && remainingTime()! <= 60 && props.videoMode}>
          <div class={styles.callTimer}>
            <span class={styles.timerWarning}>{t('calls.limit', language())}: {formatRemainingTime(remainingTime()!)}</span>
          </div>
        </Show>
        <div class={styles.status}>
          {formatDuration(duration())}
        </div>
      </div>

      <div class={styles.callActions}>
        <button
          class={styles.actionBtn}
          classList={{ [styles.active]: muted() }}
          onClick={() => {
            setMuted(!muted())
            void props.onToggleMute(!muted())
          }}
        >
          <span class={styles.icon}><img src="./img/icons_ios/mic-off.svg" alt={t('calls.mute', language())} /></span>
          <span class={styles.label}>{t('calls.mute', language())}</span>
        </button>
        <button
          class={styles.actionBtn}
          classList={{ [styles.active]: speaker() }}
          onClick={() => setSpeaker(!speaker())}
        >
          <span class={styles.icon}><img src="./img/icons_ios/speaker.svg" alt={t('calls.speaker', language())} /></span>
          <span class={styles.label}>{t('calls.speaker', language())}</span>
        </button>
        <button class={styles.actionBtn}>
          <span class={styles.icon}><img src="./img/icons_ios/add-call.svg" alt={t('calls.add', language())} /></span>
          <span class={styles.label}>{t('calls.add', language())}</span>
        </button>
        <button class={styles.actionBtn} onClick={props.onStartVideo}>
          <span class={styles.icon}><img src="./img/icons_ios/video-call.svg" alt="Video" /></span>
          <span class={styles.label}>{t('calls.video', language())}</span>
        </button>
      </div>

      <Show when={!props.videoMode}>
        <button class={styles.startVideoBtn} onClick={props.onStartVideo}>{t('calls.start_video', language())}</button>
      </Show>

      <Show when={props.callInfo?.incoming === true}>
        <button class={styles.rejectMessageBtn} onClick={props.onRejectWithMessage}>{t('calls.reject_with_message', language())}</button>
      </Show>

      <button class={styles.endCallBtn} onClick={props.onEnd}>
        <img src="./img/icons_ios/phone-end.svg" alt={t('calls.hangup', language())} />
      </button>
    </div>
  )
}
