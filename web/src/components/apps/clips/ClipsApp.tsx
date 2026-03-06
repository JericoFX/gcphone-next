import { For, Show, createEffect, createSignal, onCleanup, onMount, batch } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchNui } from '../../../utils/fetchNui';
import { timeAgo } from '../../../utils/misc';
import { sanitizeMediaUrl, sanitizeText } from '../../../utils/sanitize';
import { AppScaffold } from '../../shared/layout';
import { useAppCache } from '../../../hooks';
import { MediaLightbox } from '../../shared/ui/MediaLightbox';
import { Modal, ModalActions, ModalButton } from '../../shared/ui/Modal';
import { EmojiPickerButton } from '../../shared/ui/EmojiPicker';
import { FloatingChat } from './components/FloatingChat';
import { GlobalChatPanel } from './components/GlobalChatPanel';
import styles from './ClipsApp.module.scss';

interface Clip {
  id: number;
  username?: string;
  display_name?: string;
  avatar?: string;
  media_url: string;
  caption?: string;
  likes?: number;
  liked?: boolean;
  comments_count?: number;
  is_own?: boolean;
  is_live?: boolean;
}

interface LiveMessage {
  id: string;
  username: string;
  avatar?: string;
  content: string;
  isMention: boolean;
  timestamp: number;
}

interface LiveReaction {
  id: string;
  username: string;
  reaction: string;
  timestamp: number;
}

const MOCK_VIDEO_URL = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

const MOCK_USERS = [
  { username: 'mika', display_name: 'Mika' },
  { username: 'rodrigo', display_name: 'Rodrigo' },
  { username: 'luna', display_name: 'Luna' },
  { username: 'santi', display_name: 'Santi' },
  { username: 'mery', display_name: 'Mery' },
];

const MOCK_MESSAGES = [
  'Que buen clip 🔥',
  'Se ve re bien 😮',
  'JAJA muy bueno 😂',
  'Ese plano esta tremendo 👏',
  'Dale otra vez 🙌',
  'Top top top 🚀',
  'Buenisimo el audio 🎵',
  'Te banco 💯',
];

export function ClipsApp() {
  const router = useRouter();
  const cache = useAppCache('clips');

  // Data
  const [clips, setClips] = createSignal<Clip[]>([]);
  const [currentClipIndex, setCurrentClipIndex] = createSignal(0);
  const [myAccount, setMyAccount] = createSignal<any>(null);

  // Live Chat State
  const [floatingMessages, setFloatingMessages] = createSignal<LiveMessage[]>([]);
  const [globalMessages, setGlobalMessages] = createSignal<LiveMessage[]>([]);
  const [reactions, setReactions] = createSignal<LiveReaction[]>([]);
  const [showGlobalChat, setShowGlobalChat] = createSignal(false);
  const [isLive, setIsLive] = createSignal(false);
  const [currentLiveClipId, setCurrentLiveClipId] = createSignal<string | null>(null);

  // Tabs
  const [currentTab, setCurrentTab] = createSignal<'feed' | 'myVideos'>('feed');

  // UI State
  const [loading, setLoading] = createSignal(false);
  const [fabTooltipVisible, setFabTooltipVisible] = createSignal(false);
  const [likeAnimation, setLikeAnimation] = createSignal<number | null>(null);
  const [viewerUrl, setViewerUrl] = createSignal<string | null>(null);
  const [pausedClips, setPausedClips] = createSignal<Set<number>>(new Set());
  const [statusMessage, setStatusMessage] = createSignal('');
  const [deleteClipId, setDeleteClipId] = createSignal<number | null>(null);
  const [mockLiveEnabled, setMockLiveEnabled] = createSignal(false);

  // Upload
  const [showUpload, setShowUpload] = createSignal(false);
  const [uploadMedia, setUploadMedia] = createSignal('');
  const [uploadCaption, setUploadCaption] = createSignal('');

  // Chat
  const [chatMessageText, setChatMessageText] = createSignal('');

  // FAB Tooltip
  let fabTimeout: number;
  const showFabTooltip = () => {
    setFabTooltipVisible(true);
    fabTimeout = window.setTimeout(() => setFabTooltipVisible(false), 2000);
  };
  const hideFabTooltip = () => {
    setFabTooltipVisible(false);
    if (fabTimeout) clearTimeout(fabTimeout);
  };

  const loadClips = async () => {
    setLoading(true);
    
    const account = await fetchNui('snapGetAccount', {});
    setMyAccount(account);
    
    if (currentTab() === 'myVideos') {
      const cached = cache.get<Clip[]>('clips:myvideos');
      const list = cached ?? await fetchNui<Clip[]>('clipsGetMyClips', { limit: 40, offset: 0 }, []);
      if (!cached) cache.set('clips:myvideos', list || [], 60000);
      setClips(list || []);
    } else {
      const cached = cache.get<Clip[]>('clips:feed');
      const list = cached ?? await fetchNui<Clip[]>('clipsGetFeed', { limit: 40, offset: 0 }, []);
      if (!cached) cache.set('clips:feed', list || [], 60000);
      setClips(list || []);
    }
    
    setCurrentClipIndex(0);
    setLoading(false);
  };

  createEffect(() => {
    void loadClips();
  });

  createEffect(() => {
    const onKey = (e: CustomEvent<string>) => {
      if (e.detail === 'Backspace') {
        if (showGlobalChat()) {
          setShowGlobalChat(false);
          return;
        }
        if (isLive()) {
          void leaveLive();
          return;
        }
        router.goBack();
      }
    };
    window.addEventListener('phone:keyUp', onKey as EventListener);
    onCleanup(() => window.removeEventListener('phone:keyUp', onKey as EventListener));
  });

  const toggleLike = async (clipId: number) => {
    const result = await fetchNui<{ liked?: boolean }>('clipsToggleLike', { postId: clipId });
    if (result?.liked !== undefined) {
      setClips(prev => prev.map(c => 
        c.id === clipId 
          ? { ...c, liked: result.liked, likes: (c.likes || 0) + (result.liked ? 1 : -1) }
          : c
      ));
    }
  };

  const handleDoubleTap = (clipId: number) => {
    setLikeAnimation(clipId);
    setTimeout(() => setLikeAnimation(null), 1000);
    
    const clip = clips().find(c => c.id === clipId);
    if (clip && !clip.liked) {
      void toggleLike(clipId);
    }
  };

  const deleteClip = async (clipId: number) => {
    setDeleteClipId(clipId);
  };

  const confirmDeleteClip = async () => {
    const clipId = deleteClipId();
    if (!clipId) return;

    await fetchNui('clipsDeletePost', clipId);
    setClips(prev => prev.filter(c => c.id !== clipId));
    cache.invalidate('clips:feed');
    cache.invalidate('clips:myvideos');
    setDeleteClipId(null);
  };

  // Live Chat Functions
  const startLive = async (clipId: number) => {
    const clip = clips().find(c => c.id === clipId);
    if (!clip) return;
    
    // Create live room
    await fetchNui('gcphone:live:create', { 
      clipId: String(clipId),
      avatar: clip.avatar 
    });
    
    batch(() => {
      setIsLive(true);
      setCurrentLiveClipId(String(clipId));
      setFloatingMessages([]);
      setGlobalMessages([]);
      setReactions([]);
    });
  };

  const joinLive = async (clipId: number) => {
    const clip = clips().find(c => c.id === clipId);
    if (!clip) return;
    
    // Join live room
    await fetchNui('gcphone:live:join', { clipId: String(clipId) });
    
    batch(() => {
      setIsLive(true);
      setCurrentLiveClipId(String(clipId));
      setShowGlobalChat(true);
    });
  };

  const leaveLive = async () => {
    const clipId = currentLiveClipId();
    if (!clipId) return;
    
    await fetchNui('gcphone:live:leave', { clipId });
    
    batch(() => {
      setIsLive(false);
      setCurrentLiveClipId(null);
      setFloatingMessages([]);
      setGlobalMessages([]);
      setReactions([]);
      setShowGlobalChat(false);
    });
  };

  const sendChatMessage = async () => {
    const content = sanitizeText(chatMessageText(), 500);
    if (!content || !currentLiveClipId()) return;
    
    await fetchNui('gcphone:live:message', { 
      clipId: currentLiveClipId(), 
      content 
    });
    
    setChatMessageText('');
  };

  const sendReaction = async (reaction: string) => {
    if (!currentLiveClipId()) return;
    
    await fetchNui('gcphone:live:reaction', { 
      clipId: currentLiveClipId(), 
      reaction 
    });
  };

  const deleteLiveMessage = async (messageId: string) => {
    if (!currentLiveClipId()) return;
    
    await fetchNui('gcphone:live:deleteMessage', { 
      clipId: currentLiveClipId(), 
      messageId 
    });
  };

  const muteUser = async (username: string) => {
    if (!currentLiveClipId()) return;
    
    await fetchNui('gcphone:live:mute', { 
      clipId: currentLiveClipId(), 
      username 
    });
  };

  const removeFloatingMessage = (id: string) => {
    setFloatingMessages(prev => prev.filter(m => m.id !== id));
  };

  const removeReaction = (id: string) => {
    setReactions(prev => prev.filter(r => r.id !== id));
  };

  // Legacy comment functions (for non-live clips)
  const openComments = async (clipId: number) => {
    const clip = clips().find((entry) => entry.id === clipId);
    if (!clip) return;
    
    if (clip.is_live) {
      // Live clip - join live room
      await joinLive(clipId);
    } else {
      // Regular clip - show legacy comments
      // TODO: Implement legacy comments
      setShowGlobalChat(true);
    }
  };

  const publishClip = async () => {
    const media = sanitizeMediaUrl(uploadMedia());
    if (!media) {
      setStatusMessage('Selecciona un video para subir.');
      return;
    }
    setStatusMessage('');
    
    setLoading(true);
    const result = await fetchNui<{ success?: boolean }>('clipsPublish', {
      mediaUrl: media,
      caption: sanitizeText(uploadCaption(), 500)
    });
    
    if (result?.success) {
      setUploadMedia('');
      setUploadCaption('');
      setShowUpload(false);
      cache.invalidate('clips:feed');
      await loadClips();
    }
    setLoading(false);
  };

  const attachFromGallery = async () => {
    const gallery = await fetchNui<any[]>('getGallery', undefined, []);
    const video = gallery?.find((g: any) => g.url?.match(/\.(mp4|webm|mov)$/i));
    if (video?.url) {
      setUploadMedia(sanitizeMediaUrl(video.url) || '');
    } else {
      setStatusMessage('No se encontraron videos en la galeria.');
    }
  };

  const openCamera = () => {
    router.navigate('camera', { target: 'clips' });
  };

  const togglePause = (clipId: number) => {
    setPausedClips(prev => {
      const next = new Set(prev);
      if (next.has(clipId)) {
        next.delete(clipId);
      } else {
        next.add(clipId);
      }
      return next;
    });
  };

  // Handle scroll
  let scrollContainer: HTMLDivElement | undefined;
  const handleScroll = () => {
    if (!scrollContainer) return;
    const scrollTop = scrollContainer.scrollTop;
    const clipHeight = scrollContainer.clientHeight;
    const newIndex = Math.round(scrollTop / clipHeight);
    setCurrentClipIndex(newIndex);
  };

  const currentClip = () => clips()[currentClipIndex()];
  const isOwner = () => !!currentClip()?.is_own;

  const startMockLive = () => {
    setMockLiveEnabled(true);
    setCurrentTab('feed');
    const mockClip = {
      id: 999999,
      username: myAccount()?.username || 'live_owner',
      display_name: myAccount()?.display_name || 'Tu Live',
      avatar: myAccount()?.avatar || undefined,
      media_url: MOCK_VIDEO_URL,
      caption: 'Mock Live activo para probar chat overlay.',
      likes: 145,
      liked: false,
      comments_count: 0,
      is_own: true,
      is_live: true,
    };
    setClips([mockClip]);
    setCurrentClipIndex(0);
    
    // Start live chat
    batch(() => {
      setIsLive(true);
      setCurrentLiveClipId('999999');
      setGlobalMessages([
        { id: '1', username: 'luna', avatar: undefined, content: 'Te vemos perfecto 👀', isMention: false, timestamp: Date.now() },
        { id: '2', username: 'santi', avatar: undefined, content: 'Subi el volumen 🔊', isMention: false, timestamp: Date.now() },
      ]);
    });
  };

  // Mock live chat effect
  createEffect(() => {
    if (!mockLiveEnabled() || !isLive()) return;
    
    const timer = window.setInterval(() => {
      const user = MOCK_USERS[Math.floor(Math.random() * MOCK_USERS.length)];
      const content = MOCK_MESSAGES[Math.floor(Math.random() * MOCK_MESSAGES.length)];
      const newMessage: LiveMessage = {
        id: String(Date.now() + Math.floor(Math.random() * 1000)),
        username: user.username,
        avatar: undefined,
        content,
        isMention: false,
        timestamp: Date.now(),
      };
      
      batch(() => {
        // Add to floating (auto-expires)
        setFloatingMessages(prev => [...prev, newMessage]);
        
        // Add to global (keep last 20)
        setGlobalMessages(prev => {
          const newMessages = [...prev, newMessage];
          if (newMessages.length > 20) {
            return newMessages.slice(newMessages.length - 20);
          }
          return newMessages;
        });
      });
    }, 2600);
    
    onCleanup(() => window.clearInterval(timer));
  });

  return (
    <AppScaffold title="Clips" subtitle="Videos cortos" onBack={() => router.goBack()} bodyClass={styles.body}>
      <div class={styles.clipsApp}>
        {/* Tabs */}
        <Show when={statusMessage()}>
          <div style={{ padding: '8px 12px', margin: '8px 12px', 'background-color': 'rgba(255, 159, 10, 0.14)', color: '#7a4a00', 'font-size': '12px', 'border-radius': '10px' }}>
            {statusMessage()}
          </div>
        </Show>

        <div class={styles.tabs}>
          <button 
            class={styles.tabBtn}
            classList={{ [styles.active]: currentTab() === 'feed' }}
            onClick={() => setCurrentTab('feed')}
          >
            Para ti
          </button>
          <button 
            class={styles.tabBtn}
            classList={{ [styles.active]: currentTab() === 'myVideos' }}
            onClick={() => setCurrentTab('myVideos')}
          >
            Mis Videos
          </button>
          <button
            class={styles.mockBtn}
            onClick={startMockLive}
          >
            Mock Live
          </button>
        </div>

        {/* Feed */}
        <div class={styles.feed} ref={scrollContainer} onScroll={handleScroll}>
          <Show when={loading() && clips().length === 0}>
            <div class={styles.loading}>Cargando videos...</div>
          </Show>
          
          <For each={clips()}>
            {(clip, index) => {
              const isPaused = () => pausedClips().has(clip.id);
              
              return (
                <div 
                  class={styles.clipCard}
                  onDblClick={(e) => {
                    e.preventDefault();
                    handleDoubleTap(clip.id);
                  }}
                >
                  <video
                    class={styles.clipVideo}
                    src={clip.media_url}
                    controls={false}
                    playsinline
                    loop
                    autoplay={index() === currentClipIndex() && !isPaused()}
                    preload={Math.abs(index() - currentClipIndex()) <= 1 ? "auto" : "metadata"}
                    onClick={() => togglePause(clip.id)}
                  />
                  
                  <Show when={isPaused()}>
                    <div class={styles.pauseIndicator}>▶</div>
                  </Show>
                  
                  <Show when={likeAnimation() === clip.id}>
                    <div class={styles.likeAnimation}>♥</div>
                  </Show>
                  
                  <div class={styles.clipOverlay}>
                      <div class={styles.sideActions} classList={{ [styles.sideActionsShifted]: showGlobalChat() && isOwner() }}>
                      <div class={styles.actionItem}>
                        <button 
                          class={styles.actionBtn}
                          classList={{ [styles.liked]: clip.liked }}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleLike(clip.id);
                          }}
                        >
                          {clip.liked ? '♥' : '♡'}
                        </button>
                        <span class={styles.actionCount}>{clip.likes || 0}</span>
                      </div>
                      
                      <div class={styles.actionItem}>
                        <button 
                          class={styles.actionBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            openComments(clip.id);
                          }}
                        >
                          💬
                        </button>
                        <span class={styles.actionCount}>{clip.comments_count || 0}</span>
                      </div>
                      
                      <div class={styles.actionItem}>
                        <button class={styles.actionBtn} onClick={(e) => e.stopPropagation()}>
                          ↗
                        </button>
                        <span class={styles.actionCount}>Compartir</span>
                      </div>
                      
                      <Show when={clip.is_own}>
                        <div class={styles.actionItem}>
                          <button 
                            class={styles.actionBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteClip(clip.id);
                            }}
                          >
                            🗑
                          </button>
                          <span class={styles.actionCount}>Eliminar</span>
                        </div>
                      </Show>
                    </div>
                    
                    <div class={styles.bottomInfo}>
                      <div class={styles.authorInfo}>
                        <div class={styles.authorAvatar}>
                          {clip.avatar ? (
                            <img src={clip.avatar} alt="" />
                          ) : (
                            <span>{(clip.display_name || clip.username || 'U').charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        <span class={styles.authorName}>@{clip.username || 'user'}</span>
                      </div>
                      
                      <Show when={clip.caption}>
                        <p class={styles.caption}>{clip.caption}</p>
                      </Show>
                      
                      <div class={styles.musicInfo}>
                        <span>🎵 Sonido original - {clip.display_name || clip.username}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }}
          </For>
          
          <Show when={!loading() && clips().length === 0}>
            <div class={styles.emptyState}>
              <p>No hay clips</p>
              <p class={styles.emptyHint}>¡Sé el primero en subir un video!</p>
            </div>
          </Show>
        </div>

        {/* FAB */}
        <div class={styles.fabContainer}>
          <Show when={fabTooltipVisible()}>
            <div class={styles.fabTooltip}>Subir video</div>
          </Show>
          <button 
            class={styles.fab}
            onClick={() => setShowUpload(true)}
            onPointerDown={showFabTooltip}
            onPointerUp={hideFabTooltip}
            onPointerLeave={hideFabTooltip}
          >
            +
          </button>
        </div>

        {/* Live Chat Floating Messages */}
        <Show when={isLive()}>
          <FloatingChat
            messages={floatingMessages()}
            reactions={reactions()}
            maxVisible={4}
            onMessageExpire={removeFloatingMessage}
            onReactionExpire={removeReaction}
          />
        </Show>

        {/* Chat Toggle Button */}
        <Show when={isLive()}>
          <button 
            class={styles.chatToggleBtn}
            onClick={() => setShowGlobalChat(!showGlobalChat())}
          >
            💬
            <Show when={globalMessages().length > 0}>
              <span class={styles.badge}>{Math.min(globalMessages().length, 20)}</span>
            </Show>
          </button>
        </Show>

        {/* Global Chat Panel */}
        <GlobalChatPanel
          messages={globalMessages()}
          isOpen={showGlobalChat()}
          isOwner={clips()[currentClipIndex()]?.is_own || false}
          myUsername={myAccount()?.username || ''}
          onClose={() => setShowGlobalChat(false)}
          onSend={sendChatMessage}
          onDelete={deleteLiveMessage}
          onMute={muteUser}
        />

        {/* Legacy Comments Modal - for non-live clips */}
        <Show when={showGlobalChat() && !isLive()}>
          <div class={styles.commentsModal}>
            <div class={styles.commentsHeader}>
              <h4>Comentarios</h4>
              <button class={styles.closeBtn} onClick={() => setShowGlobalChat(false)}>✕</button>
            </div>
            
            <div class={styles.commentsList}>
              <div class={styles.emptyComments}>
                <p>Sistema de comentarios legacy</p>
              </div>
            </div>
            
            <div class={styles.commentInput}>
              <EmojiPickerButton value={chatMessageText()} onChange={setChatMessageText} maxLength={500} />
              <input
                type="text"
                placeholder="Escribe un comentario..."
                value={chatMessageText()}
                onInput={(e) => setChatMessageText(sanitizeText(e.currentTarget.value, 500))}
                onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
              />
              <button onClick={sendChatMessage} disabled={!chatMessageText().trim()}>
                Enviar
              </button>
            </div>
          </div>
        </Show>

        {/* Upload Modal */}
        <Modal
          open={showUpload()}
          title="Subir Clip"
          onClose={() => { setShowUpload(false); setUploadMedia(''); setUploadCaption(''); }}
          size="md"
        >
          <div class={styles.uploadContent}>
            <Show when={!uploadMedia()}>
              <div class={styles.uploadOptions}>
                <button class={styles.uploadBtn} onClick={openCamera}>
                  <span class={styles.uploadIcon}>📷</span>
                  <span>Grabar video</span>
                </button>
                <button class={styles.uploadBtn} onClick={attachFromGallery}>
                  <span class={styles.uploadIcon}>🎬</span>
                  <span>Elegir de galeria</span>
                </button>
              </div>
            </Show>
            
            <Show when={uploadMedia()}>
              <div class={styles.videoPreview}>
                <video src={uploadMedia()} controls playsinline />
                <button class={styles.removeBtn} onClick={() => setUploadMedia('')}>✕</button>
              </div>
              
              <textarea
                class={styles.captionInput}
                placeholder="Describe tu video..."
                value={uploadCaption()}
                onInput={(e) => setUploadCaption(e.currentTarget.value)}
                rows={3}
              />
            </Show>
          </div>
          
          <ModalActions>
            <ModalButton label="Cancelar" onClick={() => { setShowUpload(false); setUploadMedia(''); setUploadCaption(''); }} />
            <ModalButton 
              label={loading() ? 'Subiendo...' : 'Subir'}
              onClick={() => void publishClip()}
              tone="primary"
              disabled={!uploadMedia() || loading()}
            />
          </ModalActions>
        </Modal>

        <Modal
          open={deleteClipId() !== null}
          title="Eliminar clip"
          onClose={() => setDeleteClipId(null)}
          size="sm"
        >
          <p>Esta accion no se puede deshacer.</p>
          <ModalActions>
            <ModalButton label="Cancelar" onClick={() => setDeleteClipId(null)} />
            <ModalButton label="Eliminar" tone="danger" onClick={() => void confirmDeleteClip()} />
          </ModalActions>
        </Modal>

        <MediaLightbox url={viewerUrl()} onClose={() => setViewerUrl(null)} />
      </div>
    </AppScaffold>
  );
}
