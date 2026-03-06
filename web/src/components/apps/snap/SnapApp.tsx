import { For, Show, createEffect, createMemo, createSignal, onCleanup } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchNui } from '../../../utils/fetchNui';
import { timeAgo } from '../../../utils/misc';
import { resolveMediaType, sanitizeMediaUrl, sanitizeText } from '../../../utils/sanitize';
import { useNuiEvent } from '../../../utils/useNui';
import { fetchLiveKitToken, fetchSocketToken } from '../../../utils/realtimeAuth';
import { connectLiveKit, disconnectLiveKit, setLiveKitCameraEnabled, setLiveKitMicrophoneEnabled } from '../../../utils/livekit';
import { startMockLiveFeed } from '../../../utils/liveMock';
import {
  connectSnapLiveSocket,
  disconnectSnapLiveSocket,
  deleteSnapLiveMessage,
  joinSnapLiveRoom,
  leaveSnapLiveRoom,
  muteSnapLiveUser,
  sendSnapLiveMessage,
  sendSnapLiveReaction,
  type SnapLiveReaction,
  type SnapLiveSocketMessage,
} from '../../../utils/socket';
import { AppScaffold } from '../../shared/layout';
import { useAppCache } from '../../../hooks';
import { MediaLightbox } from '../../shared/ui/MediaLightbox';
import { Modal, ModalActions, ModalButton } from '../../shared/ui/Modal';
import { ActionSheet } from '../../shared/ui/ActionSheet';
import { EmojiPickerButton } from '../../shared/ui/EmojiPicker';
import styles from './SnapApp.module.scss';

interface SnapPost {
  id: number;
  username?: string;
  display_name?: string;
  avatar?: string;
  media_url?: string;
  media_type?: 'image' | 'video';
  caption?: string;
  likes?: number;
  liked?: boolean;
  is_live?: boolean;
  is_own?: boolean;
}

interface SnapStory {
  id: number;
  username?: string;
  display_name?: string;
  avatar?: string;
  media_url?: string;
  media_type?: 'image' | 'video';
  expires_at?: string;
  is_own?: boolean;
}

interface SnapLive {
  id: number;
  username?: string;
  display_name?: string;
  avatar?: string;
  live_viewers?: number;
}

interface LiveStartResponse {
  success?: boolean;
  payload?: { postId?: number };
  error?: string;
}

const SNAP_MOCK_LIVE_ID = -999001;
const SNAP_MOCK_USERS = ['mika', 'luna', 'santi', 'mery', 'rodrigo'];
const SNAP_MOCK_LINES = [
  'Se ve re bien 🔥',
  'Vamos snap live 🙌',
  'Que buena toma 😮',
  'Jajaja top 😂',
  'Saludos desde LS ❤️',
  'Audio ok ✅',
  'Subi ese tema 🎵',
];

export function SnapApp() {
  const router = useRouter();
  const cache = useAppCache('snap');

  // Data
  const [posts, setPosts] = createSignal<SnapPost[]>([]);
  const [stories, setStories] = createSignal<SnapStory[]>([]);
  const [liveStreams, setLiveStreams] = createSignal<SnapLive[]>([]);
  const [myAccount, setMyAccount] = createSignal<any>(null);

  // UI State
  const [loading, setLoading] = createSignal(false);
  const [fabTooltipVisible, setFabTooltipVisible] = createSignal(false);
  const [activeStoryIndex, setActiveStoryIndex] = createSignal<number | null>(null);
  const [storyProgressPct, setStoryProgressPct] = createSignal(0);
  const [viewerUrl, setViewerUrl] = createSignal<string | null>(null);
  const [showActionSheet, setShowActionSheet] = createSignal(false);
  const [statusMessage, setStatusMessage] = createSignal('');
  const [deletePostId, setDeletePostId] = createSignal<number | null>(null);

  // Live Viewer
  const [activeLive, setActiveLive] = createSignal<SnapLive | null>(null);
  const [liveChatOpen, setLiveChatOpen] = createSignal(false);
  const [liveMessageInput, setLiveMessageInput] = createSignal('');
  const [liveMessages, setLiveMessages] = createSignal<SnapLiveSocketMessage[]>([]);
  const [liveFloating, setLiveFloating] = createSignal<SnapLiveSocketMessage[]>([]);
  const [liveReactions, setLiveReactions] = createSignal<SnapLiveReaction[]>([]);
  const [mutedUsers, setMutedUsers] = createSignal<string[]>([]);
  const [viewerMuted, setViewerMuted] = createSignal(false);
  const [liveStreaming, setLiveStreaming] = createSignal(false);
  const [liveConnected, setLiveConnected] = createSignal(false);

  // Create Post
  const [showCreatePost, setShowCreatePost] = createSignal(false);
  const [postMedia, setPostMedia] = createSignal('');
  const [postCaption, setPostCaption] = createSignal('');
  const [postMode, setPostMode] = createSignal<'post' | 'story'>('post');

  let storyTick: number | undefined;
  let floatingTimers = new Map<string, number>();
  let stopSnapMockFeed: (() => void) | undefined;

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

  const loadData = async () => {
    setLoading(true);
    
    // Load account
    const account = await fetchNui('snapGetAccount', {});
    setMyAccount(account);
    
    // Load posts
    const postsCacheKey = 'snap:feed';
    const cachedPosts = cache.get<SnapPost[]>(postsCacheKey);
    const postsData = cachedPosts ?? await fetchNui<SnapPost[]>('snapGetFeed', { limit: 30, offset: 0 }, []);
    if (!cachedPosts) cache.set(postsCacheKey, postsData || [], 30000);
    setPosts(postsData || []);
    
    // Load stories
    const storiesData = await fetchNui<SnapStory[]>('snapGetStories', {});
    setStories(storiesData || []);
    
    // Load live streams
    const liveData = await fetchNui<SnapLive[]>('snapGetLiveStreams', {});
    setLiveStreams(liveData || []);
    
    setLoading(false);
  };

  createEffect(() => {
    void loadData();
  });

  const handleStoryVideoTimeUpdate = (event: Event) => {
    const target = event.currentTarget as HTMLVideoElement | null;
    if (!target || target.duration <= 0) return;
    const pct = Math.min(100, (target.currentTime / target.duration) * 100);
    setStoryProgressPct(pct);
  };

  const handleStoryVideoEnded = () => {
    setStoryProgressPct(100);
    shiftStory(1);
  };

  useNuiEvent<SnapLive>('gcphone:snap:liveStarted', (live) => {
    setLiveStreams((prev) => {
      const next = prev.filter((entry) => entry.id !== live.id);
      return [live, ...next];
    });
  });

  useNuiEvent<number>('gcphone:snap:liveEnded', (liveId) => {
    setLiveStreams((prev) => prev.filter((entry) => entry.id !== Number(liveId)));
    if (activeLive()?.id === Number(liveId)) {
      void closeLiveViewer();
    }
  });

  let lastSharedMedia = '';
  createEffect(() => {
    const params = router.params();
    const sharedMedia = sanitizeMediaUrl(typeof params.postMedia === 'string' ? params.postMedia : '');
    const openComposer = params.openComposer === '1';
    if (!openComposer || !sharedMedia || sharedMedia === lastSharedMedia) return;
    lastSharedMedia = sharedMedia;
    setPostMedia(sharedMedia);
    setPostMode('post');
    setShowCreatePost(true);
  });

  onCleanup(() => {
    for (const timer of floatingTimers.values()) {
      window.clearTimeout(timer);
    }
    floatingTimers.clear();
    disconnectSnapLiveSocket();
    disconnectLiveKit();
    if (storyTick) {
      window.clearInterval(storyTick);
      storyTick = undefined;
    }
  });

  createEffect(() => {
    const onKey = (e: CustomEvent<string>) => {
      if (e.detail === 'Backspace') {
        if (liveChatOpen()) {
          setLiveChatOpen(false);
          return;
        }
        if (activeLive()) {
          void closeLiveViewer();
          return;
        }
        if (activeStoryIndex() !== null) {
          setActiveStoryIndex(null);
          return;
        }
        router.goBack();
      }
    };
    window.addEventListener('phone:keyUp', onKey as EventListener);
    onCleanup(() => window.removeEventListener('phone:keyUp', onKey as EventListener));
  });

  const toggleLike = async (e: Event, postId: number) => {
    e.stopPropagation();
    await fetchNui('snapToggleLike', { postId });
    setPosts(prev => prev.map(p => 
      p.id === postId ? { ...p, liked: !p.liked, likes: (p.likes || 0) + (p.liked ? -1 : 1) } : p
    ));
  };

  const deletePost = async (e: Event, postId: number) => {
    e.stopPropagation();
    setDeletePostId(postId);
  };

  const confirmDeletePost = async () => {
    const postId = deletePostId();
    if (!postId) return;

    await fetchNui('snapDeletePost', postId);
    setPosts(prev => prev.filter(p => p.id !== postId));
    setDeletePostId(null);
  };

  const formatStoryTime = (expiresAt?: string) => {
    if (!expiresAt) return '';
    const remaining = Math.max(0, new Date(expiresAt).getTime() - Date.now());
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    if (hours > 0) return `${hours}h`;
    const mins = Math.floor(remaining / (1000 * 60));
    return `${mins}m`;
  };

  const activeStory = () => {
    const idx = activeStoryIndex();
    return idx !== null ? stories()[idx] : null;
  };

  const isLiveOwner = createMemo(() => {
    const stream = activeLive();
    const username = myAccount()?.username;
    if (!stream || !username) return false;
    return stream.username === username;
  });

  const isMockLive = createMemo(() => {
    const stream = activeLive();
    return !!stream && Number(stream.id) < 0;
  });

  const openLiveViewer = async (live: SnapLive) => {
    const owner = !!(myAccount()?.username && live.username && myAccount()?.username === live.username);
    setStatusMessage('');
    setActiveLive(live);
    setLiveChatOpen(false);
    setLiveMessages([]);
    setLiveFloating([]);
    setLiveReactions([]);
    setMutedUsers([]);
    setViewerMuted(false);

    if (Number(live.id) < 0) {
      setLiveConnected(true);
      return;
    }

    const roomName = `snaplive-${live.id}`;
    const tokenPayload = await fetchLiveKitToken(roomName, owner, 1800);
    if (!tokenPayload?.success || !tokenPayload.token || !tokenPayload.url) {
      setStatusMessage('No se pudo abrir el live');
      setActiveLive(null);
      return;
    }

    try {
      await connectLiveKit(tokenPayload.url, tokenPayload.token, tokenPayload.maxDuration || 1800);
      if (owner) {
        await setLiveKitCameraEnabled(true);
        await setLiveKitMicrophoneEnabled(true);
      }

      const auth = await fetchSocketToken();
      if (auth?.success && auth.host && auth.token) {
        connectSnapLiveSocket(auth.host, auth.token, {
          onMessage: (message) => {
            setLiveMessages((prev) => [...prev.slice(-19), message]);
            setLiveFloating((prev) => [...prev.slice(-3), message]);
            const timer = window.setTimeout(() => {
              setLiveFloating((prev) => prev.filter((entry) => entry.id !== message.id));
              floatingTimers.delete(message.id);
            }, 4200);
            floatingTimers.set(message.id, timer);
          },
          onReaction: (reaction) => {
            setLiveReactions((prev) => [...prev.slice(-10), reaction]);
            window.setTimeout(() => {
              setLiveReactions((prev) => prev.filter((entry) => entry.id !== reaction.id));
            }, 2600);
          },
          onMessageDeleted: ({ messageId }) => {
            setLiveMessages((prev) => prev.filter((entry) => entry.id !== messageId));
            setLiveFloating((prev) => prev.filter((entry) => entry.id !== messageId));
          },
          onUserMuted: ({ username }) => {
            setMutedUsers((prev) => (prev.includes(username) ? prev : [...prev, username]));
            if (username === myAccount()?.username) {
              setViewerMuted(true);
            }
          },
        });
        joinSnapLiveRoom(String(live.id));
      }

      setLiveConnected(true);
    } catch (_err) {
      setStatusMessage('No se pudo conectar al live');
      setActiveLive(null);
      disconnectLiveKit();
      disconnectSnapLiveSocket();
    }
  };

  const closeLiveViewer = async () => {
    const stream = activeLive();
    const isMock = !!stream && Number(stream.id) < 0;
    if (stream) {
      if (!isMock) {
        leaveSnapLiveRoom(String(stream.id));
      }
      if (!isMock && liveStreaming() && isLiveOwner()) {
        await fetchNui('snapEndLive', stream.id);
      }
    }

    stopSnapMockFeed?.();
    stopSnapMockFeed = undefined;

    for (const timer of floatingTimers.values()) {
      window.clearTimeout(timer);
    }
    floatingTimers.clear();

    disconnectSnapLiveSocket();
    disconnectLiveKit();
    setActiveLive(null);
    setLiveStreaming(false);
    setLiveConnected(false);
    setLiveChatOpen(false);
    setLiveMessageInput('');
    setLiveMessages([]);
    setLiveFloating([]);
    setLiveReactions([]);
    setMutedUsers([]);
    setViewerMuted(false);
    if (isMock) {
      setLiveStreams((prev) => prev.filter((entry) => Number(entry.id) >= 0));
      return;
    }
    await loadData();
  };

  const startLive = async () => {
    setShowActionSheet(false);
    const result = await fetchNui<LiveStartResponse>('snapStartLive', {});
    if (!result?.success || !result.payload?.postId) {
      setStatusMessage('No se pudo iniciar el live');
      return;
    }

    const stream: SnapLive = {
      id: result.payload.postId,
      username: myAccount()?.username,
      display_name: myAccount()?.display_name,
      avatar: myAccount()?.avatar,
      live_viewers: 0,
    };
    setLiveStreaming(true);
    await openLiveViewer(stream);
  };

  const startMockLive = async () => {
    setShowActionSheet(false);
    const stream: SnapLive = {
      id: SNAP_MOCK_LIVE_ID,
      username: myAccount()?.username || 'mock_host',
      display_name: `${myAccount()?.display_name || 'Host'} (Mock)`,
      avatar: myAccount()?.avatar,
      live_viewers: 7,
    };
    setLiveStreams((prev) => [stream, ...prev.filter((entry) => Number(entry.id) >= 0)]);
    setLiveStreaming(false);
    await openLiveViewer(stream);
  };

  const sendLiveMessage = async () => {
    if (viewerMuted()) {
      setStatusMessage('Estas silenciado en este live');
      return;
    }

    const stream = activeLive();
    const content = sanitizeText(liveMessageInput(), 300);
    if (!stream || !content) return;
    if (Number(stream.id) < 0) {
      const message: SnapLiveSocketMessage = {
        id: `${Date.now()}-${Math.random()}`,
        liveId: String(stream.id),
        username: myAccount()?.username || 'viewer',
        avatar: myAccount()?.avatar,
        content,
        isMention: false,
        createdAt: Date.now(),
      };
      setLiveMessages((prev) => [...prev.slice(-19), message]);
      setLiveFloating((prev) => [...prev.slice(-3), message]);
      const timer = window.setTimeout(() => {
        setLiveFloating((prev) => prev.filter((entry) => entry.id !== message.id));
        floatingTimers.delete(message.id);
      }, 4200);
      floatingTimers.set(message.id, timer);
      setLiveMessageInput('');
      return;
    }
    const response = await sendSnapLiveMessage(String(stream.id), content);
    if (response?.success) {
      setLiveMessageInput('');
    }
  };

  const sendReaction = async (reaction: string) => {
    const stream = activeLive();
    if (!stream) return;
    if (Number(stream.id) < 0) {
      const payload: SnapLiveReaction = {
        id: `${Date.now()}-${Math.random()}`,
        liveId: String(stream.id),
        username: myAccount()?.username || 'viewer',
        avatar: myAccount()?.avatar,
        reaction,
        createdAt: Date.now(),
      };
      setLiveReactions((prev) => [...prev.slice(-10), payload]);
      window.setTimeout(() => {
        setLiveReactions((prev) => prev.filter((entry) => entry.id !== payload.id));
      }, 2600);
      return;
    }
    await sendSnapLiveReaction(String(stream.id), reaction);
  };

  const removeLiveMessage = async (messageId: string) => {
    const stream = activeLive();
    if (!stream || !isLiveOwner()) return;
    if (Number(stream.id) < 0) {
      setLiveMessages((prev) => prev.filter((entry) => entry.id !== messageId));
      setLiveFloating((prev) => prev.filter((entry) => entry.id !== messageId));
      return;
    }
    await deleteSnapLiveMessage(String(stream.id), messageId);
  };

  const muteLiveUser = async (username: string) => {
    const stream = activeLive();
    if (!stream || !isLiveOwner()) return;
    if (Number(stream.id) < 0) {
      setMutedUsers((prev) => (prev.includes(username) ? prev : [...prev, username]));
      return;
    }
    await muteSnapLiveUser(String(stream.id), username);
  };

  const openStory = (index: number) => {
    setStoryProgressPct(0);
    setActiveStoryIndex(index);
  };

  const shiftStory = (offset: number) => {
    const current = activeStoryIndex();
    if (current === null) return;
    const next = current + offset;
    if (next < 0 || next >= stories().length) {
      setActiveStoryIndex(null);
      setStoryProgressPct(0);
      return;
    }
    setStoryProgressPct(0);
    setActiveStoryIndex(next);
  };

  createEffect(() => {
    const story = activeStory();
    if (!story) {
      if (storyTick) window.clearInterval(storyTick);
      storyTick = undefined;
      setStoryProgressPct(0);
      return;
    }

    if (story.media_type === 'video') {
      return;
    }

    const durationMs = 5000;
    const startedAt = Date.now();
    if (storyTick) window.clearInterval(storyTick);
    storyTick = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const pct = Math.min(100, (elapsed / durationMs) * 100);
      setStoryProgressPct(pct);
      if (pct >= 100) {
        window.clearInterval(storyTick);
        storyTick = undefined;
        shiftStory(1);
      }
    }, 100);

    onCleanup(() => {
      if (storyTick) window.clearInterval(storyTick);
      storyTick = undefined;
    });
  });

  createEffect(() => {
    const stream = activeLive();
    if (!stream || Number(stream.id) >= 0) {
      stopSnapMockFeed?.();
      stopSnapMockFeed = undefined;
      return;
    }

    const mentionTarget = myAccount()?.username ? `@${myAccount()?.username}` : '@host';
    stopSnapMockFeed = startMockLiveFeed({
      users: SNAP_MOCK_USERS,
      lines: SNAP_MOCK_LINES,
      mentionTarget,
      onMessage: (entry) => {
        if (mutedUsers().includes(entry.user)) return;
        const message: SnapLiveSocketMessage = {
          id: entry.id,
          liveId: String(stream.id),
          username: entry.user,
          content: entry.text,
          isMention: entry.isMention,
          createdAt: entry.createdAt,
        };
        setLiveMessages((prev) => [...prev.slice(-19), message]);
        setLiveFloating((prev) => [...prev.slice(-3), message]);
        const timer = window.setTimeout(() => {
          setLiveFloating((prev) => prev.filter((msg) => msg.id !== message.id));
          floatingTimers.delete(message.id);
        }, 4200);
        floatingTimers.set(message.id, timer);
      },
      onReaction: (entry) => {
        const payload: SnapLiveReaction = {
          id: entry.id,
          liveId: String(stream.id),
          username: entry.user,
          reaction: entry.reaction,
          createdAt: entry.createdAt,
        };
        setLiveReactions((prev) => [...prev.slice(-10), payload]);
        window.setTimeout(() => {
          setLiveReactions((prev) => prev.filter((it) => it.id !== payload.id));
        }, 2600);
      },
    });

    onCleanup(() => {
      stopSnapMockFeed?.();
      stopSnapMockFeed = undefined;
    });
  });

  const publishPost = async () => {
    const media = sanitizeMediaUrl(postMedia());
    if (!media) {
      setStatusMessage('Selecciona una imagen o video para publicar.');
      return;
    }
    setStatusMessage('');
    
    setLoading(true);
    
    if (postMode() === 'story') {
      const result = await fetchNui<{ success?: boolean }>('snapPublishStory', {
        mediaUrl: media,
        mediaType: resolveMediaType(media)
      });
      if (result?.success) {
        setPostMedia('');
        setShowCreatePost(false);
        await loadData();
      }
    } else {
      const result = await fetchNui<{ success?: boolean }>('snapPublishPost', {
        mediaUrl: media,
        mediaType: resolveMediaType(media),
        caption: sanitizeText(postCaption(), 2200)
      });
      if (result?.success) {
        setPostMedia('');
        setPostCaption('');
        setShowCreatePost(false);
        cache.invalidate('snap:feed');
        await loadData();
      }
    }
    
    setLoading(false);
  };

  const attachFromGallery = async () => {
    const gallery = await fetchNui<any[]>('getGallery', undefined, []);
    if (gallery?.[0]?.url) {
      setPostMedia(sanitizeMediaUrl(gallery[0].url) || '');
    }
  };

  const openCamera = () => {
    router.navigate('camera', { target: 'snap' });
    setShowActionSheet(false);
  };

  return (
    <AppScaffold title="Snap" subtitle="Comparte momentos" onBack={() => router.goBack()} bodyClass={styles.body}>
      <div class={styles.snapApp}>
        {/* Stories Bar */}
        <div class={styles.storiesSection}>
          <div class={styles.storiesList}>
            {/* My Story */}
            <button class={styles.storyItem} onClick={() => setShowActionSheet(true)}>
              <div class={styles.storyAvatar} classList={{ [styles.hasStory]: false }}>
                <span>+</span>
              </div>
              <span class={styles.storyName}>Tu historia</span>
            </button>
            
            {/* Other Stories */}
            <For each={stories()}>
              {(story, index) => (
                <button class={styles.storyItem} onClick={() => openStory(index())}>
                  <div class={styles.storyAvatar} classList={{ [styles.hasStory]: true }}>
                    {story.avatar ? (
                      <img src={story.avatar} alt="" />
                    ) : (
                      <span>{(story.display_name || story.username || 'U').charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <span class={styles.storyName}>{story.display_name || story.username || 'Usuario'}</span>
                </button>
              )}
            </For>
          </div>
        </div>

        {/* Live Streams */}
        <Show when={statusMessage()}>
          <div style={{ padding: '8px 12px', 'margin-bottom': '8px', 'background-color': 'rgba(255, 159, 10, 0.14)', color: '#7a4a00', 'font-size': '12px', 'border-radius': '10px' }}>
            {statusMessage()}
          </div>
        </Show>

        <Show when={liveStreams().length > 0}>
          <div class={styles.liveSection}>
            <h4 class={styles.sectionTitle}>En vivo</h4>
            <div class={styles.liveList}>
              <For each={liveStreams()}>
                {(live) => (
                  <button class={styles.liveItem} onClick={() => void openLiveViewer(live)}>
                    <div class={styles.liveAvatar}>
                      {live.avatar ? (
                        <img src={live.avatar} alt="" />
                      ) : (
                        <span>{(live.display_name || live.username || 'U').charAt(0).toUpperCase()}</span>
                      )}
                      <span class={styles.liveBadge}>LIVE</span>
                    </div>
                    <span class={styles.liveName}>{live.display_name || live.username}</span>
                    <span class={styles.liveViewers}>{live.live_viewers || 0} viendo</span>
                  </button>
                )}
              </For>
            </div>
          </div>
        </Show>

        {/* Posts Grid */}
        <div class={styles.postsSection}>
          <h4 class={styles.sectionTitle}>Publicaciones</h4>
          <div class={styles.postsGrid}>
            <For each={posts()}>
              {(post) => (
                <div class={styles.postCard} onClick={() => post.media_url && setViewerUrl(post.media_url)}>
                  <div class={styles.postMedia}>
                    {resolveMediaType(post.media_url) === 'video' ? (
                      <video src={post.media_url} preload="metadata" />
                    ) : (
                      <img src={post.media_url || './img/background/back001.jpg'} alt="" />
                    )}
                    {resolveMediaType(post.media_url) === 'video' && (
                      <div class={styles.videoIndicator}>▶</div>
                    )}
                  </div>
                  
                  <div class={styles.postOverlay}>
                    <div class={styles.postHeader}>
                      <span class={styles.postAuthor}>{post.display_name || post.username}</span>
                    </div>
                    
                    <div class={styles.postActions}>
                      <button 
                        class={styles.actionBtn}
                        classList={{ [styles.liked]: post.liked }}
                        onClick={(e) => toggleLike(e, post.id)}
                      >
                        <span>{post.liked ? '♥' : '♡'}</span>
                        <span class={styles.count}>{post.likes || 0}</span>
                      </button>
                      
                      <Show when={post.is_own}>
                        <button class={styles.actionBtn} onClick={(e) => deletePost(e, post.id)}>
                          <span>🗑</span>
                        </button>
                      </Show>
                    </div>
                    
                    <Show when={post.caption}>
                      <p class={styles.postCaption}>{post.caption}</p>
                    </Show>
                  </div>
                </div>
              )}
            </For>
          </div>
          
          <Show when={!loading() && posts().length === 0}>
            <div class={styles.emptyState}>
              <p>No hay publicaciones</p>
              <p class={styles.emptyHint}>¡Sé el primero en compartir!</p>
            </div>
          </Show>
        </div>
      </div>

      {/* FAB */}
      <div class={styles.fabContainer}>
        <Show when={fabTooltipVisible()}>
          <div class={styles.fabTooltip}>Crear</div>
        </Show>
        <button 
          class={styles.fab}
          onClick={() => setShowActionSheet(true)}
          onPointerDown={showFabTooltip}
          onPointerUp={hideFabTooltip}
          onPointerLeave={hideFabTooltip}
        >
          +
        </button>
      </div>

      {/* Action Sheet */}
      <ActionSheet
        open={showActionSheet()}
        title="Crear"
        onClose={() => setShowActionSheet(false)}
        actions={[
          { label: '📷 Camara', tone: 'primary', onClick: openCamera },
          { label: '🖼 Galeria', tone: 'primary', onClick: () => { setShowActionSheet(false); setShowCreatePost(true); } },
          { label: '✨ Subir Story', onClick: () => { setPostMode('story'); setShowActionSheet(false); setShowCreatePost(true); } },
          { label: '🔴 Iniciar Live', onClick: () => void startLive() },
          { label: '🧪 Mock Live', onClick: () => void startMockLive() },
        ]}
      />

      {/* Create Post Modal */}
      <Modal
        open={showCreatePost()}
        title={postMode() === 'story' ? 'Subir Story' : 'Nueva Publicacion'}
        onClose={() => { setShowCreatePost(false); setPostMedia(''); setPostCaption(''); }}
        size="md"
      >
        <div class={styles.createContent}>
          <div class={styles.modeToggle}>
            <button 
              class={styles.modeBtn}
              classList={{ [styles.active]: postMode() === 'post' }}
              onClick={() => setPostMode('post')}
            >
              Publicacion
            </button>
            <button 
              class={styles.modeBtn}
              classList={{ [styles.active]: postMode() === 'story' }}
              onClick={() => setPostMode('story')}
            >
              Story
            </button>
          </div>

          <Show when={!postMedia()}>
            <div class={styles.uploadOptions}>
              <button class={styles.uploadBtn} onClick={openCamera}>
                <span class={styles.uploadIcon}>📷</span>
                <span>Camara</span>
              </button>
              <button class={styles.uploadBtn} onClick={attachFromGallery}>
                <span class={styles.uploadIcon}>🖼</span>
                <span>Galeria</span>
              </button>
            </div>
          </Show>

          <Show when={postMedia()}>
            <div class={styles.mediaPreview}>
              {resolveMediaType(postMedia()) === 'video' ? (
                <video src={postMedia()} controls playsinline />
              ) : (
                <img src={postMedia()} alt="" />
              )}
              <button class={styles.removeMedia} onClick={() => setPostMedia('')}>✕</button>
            </div>

            <Show when={postMode() === 'post'}>
              <EmojiPickerButton value={postCaption()} onChange={setPostCaption} maxLength={2200} />
      <textarea class={styles.captionInput}
                placeholder="Escribe un caption..."
                value={postCaption()}
                onInput={(e) => setPostCaption(e.currentTarget.value)}
                rows={3}
              />
            </Show>
          </Show>
        </div>

        <ModalActions>
          <ModalButton label="Cancelar" onClick={() => { setShowCreatePost(false); setPostMedia(''); setPostCaption(''); }} />
          <ModalButton 
            label={loading() ? 'Publicando...' : 'Publicar'}
            onClick={() => void publishPost()}
            tone="primary"
            disabled={!postMedia() || loading()}
          />
        </ModalActions>
      </Modal>

      {/* Story Viewer */}
      <Show when={activeStoryIndex() !== null && activeStory()}>
        <div class={styles.storyViewer}>
          <button 
            class={styles.storyClose}
            onClick={() => setActiveStoryIndex(null)}
          >
            ✕
          </button>
          
          <button 
            class={styles.storyNav}
            classList={{ [styles.disabled]: (activeStoryIndex() || 0) <= 0 }}
            onClick={() => shiftStory(-1)}
          >
            ‹
          </button>
          
          <button 
            class={styles.storyNav}
            classList={{ [styles.next]: true, [styles.disabled]: (activeStoryIndex() || 0) >= stories().length - 1 }}
            onClick={() => shiftStory(1)}
          >
            ›
          </button>

          <div class={styles.storyProgress}>
            <div 
              class={styles.progressBar}
              style={{ width: `${storyProgressPct()}%` }}
            />
          </div>

          <div class={styles.storyInfo}>
            <strong>{activeStory()?.display_name || activeStory()?.username}</strong>
            <span>{formatStoryTime(activeStory()?.expires_at)} restante</span>
          </div>

          {resolveMediaType(activeStory()?.media_url) === 'video' ? (
            <video 
              src={activeStory()?.media_url} 
              playsinline 
              autoplay
              muted={false}
              onTimeUpdate={handleStoryVideoTimeUpdate}
              onEnded={handleStoryVideoEnded}
              class={styles.storyMedia}
            />
          ) : (
            <img 
              src={activeStory()?.media_url} 
              alt="" 
              class={styles.storyMedia}
            />
          )}
        </div>
      </Show>

      {/* Live Viewer */}
      <Show when={activeLive()}>
        <div class={styles.liveViewer}>
          <button class={styles.storyClose} onClick={() => void closeLiveViewer()}>✕</button>

          <div class={styles.liveTopBar}>
            <div class={styles.liveOwnerInfo}>
              <strong>{activeLive()?.display_name || activeLive()?.username || 'Live'}</strong>
              <span>
                {isMockLive() ? 'MOCK LIVE' : (liveConnected() ? 'EN VIVO' : 'Conectando...')}
              </span>
            </div>
            <button class={styles.liveChatToggle} onClick={() => setLiveChatOpen((prev) => !prev)}>💬</button>
          </div>

          <div class={styles.liveVideoCanvas}>
            <div class={styles.livePlaceholder}>LiveKit video stream</div>
          </div>

          <div class={styles.liveFloatingLayer}>
            <For each={liveFloating()}>
              {(message) => (
                <div class={styles.liveFloatingMessage} classList={{ [styles.liveMention]: message.isMention }}>
                  <strong>@{message.username}</strong>
                  <p>{message.content}</p>
                </div>
              )}
            </For>

            <For each={liveReactions()}>
              {(reaction) => (
                <div class={styles.liveReactionBubble}>{reaction.reaction}</div>
              )}
            </For>
          </div>

          <div class={styles.liveReactionRow}>
            <button onClick={() => void sendReaction('👍')}>👍</button>
            <button onClick={() => void sendReaction('❤️')}>❤️</button>
            <button onClick={() => void sendReaction('😂')}>😂</button>
            <button onClick={() => void sendReaction('🔥')}>🔥</button>
            <button onClick={() => void sendReaction('👏')}>👏</button>
          </div>

          <Show when={liveChatOpen()}>
            <div class={styles.liveChatPanel}>
              <div class={styles.liveChatHeader}>Chat en vivo (max 20)</div>
              <div class={styles.liveChatList}>
                <For each={liveMessages()}>
                  {(message) => (
                    <div class={styles.liveChatItem} classList={{ [styles.liveMention]: message.isMention }}>
                      <div class={styles.liveChatBody}>
                        <strong>@{message.username}</strong>
                        <p>{message.content}</p>
                      </div>
                      <Show when={isLiveOwner() && message.username !== myAccount()?.username}>
                        <div class={styles.liveModerationCol}>
                          <button onClick={() => void removeLiveMessage(message.id)}>🗑</button>
                          <button onClick={() => void muteLiveUser(message.username)}>🚫</button>
                        </div>
                      </Show>
                    </div>
                  )}
                </For>
              </div>

              <Show when={viewerMuted()}>
                <div class={styles.liveMutedBanner}>Estas silenciado en este live</div>
              </Show>

              <Show
                when={!isLiveOwner()}
                fallback={<div class={styles.liveHostHint}>Sos host: hablas en vivo, moderas el chat.</div>}
              >
                <div class={styles.liveChatInputRow}>
                  <EmojiPickerButton value={liveMessageInput()} onChange={setLiveMessageInput} maxLength={300} />
                  <input
                    value={liveMessageInput()}
                    onInput={(e) => setLiveMessageInput(sanitizeText(e.currentTarget.value, 300))}
                    onKeyDown={(e) => e.key === 'Enter' && void sendLiveMessage()}
                    placeholder="Escribe en el live..."
                    disabled={viewerMuted()}
                  />
                  <button onClick={() => void sendLiveMessage()} disabled={viewerMuted() || !liveMessageInput().trim()}>
                    Enviar
                  </button>
                </div>
              </Show>
            </div>
          </Show>
        </div>
      </Show>

      <Modal
        open={deletePostId() !== null}
        title="Eliminar publicacion"
        onClose={() => setDeletePostId(null)}
        size="sm"
      >
        <p>Esta accion no se puede deshacer.</p>
        <ModalActions>
          <ModalButton label="Cancelar" onClick={() => setDeletePostId(null)} />
          <ModalButton label="Eliminar" tone="danger" onClick={() => void confirmDeletePost()} />
        </ModalActions>
      </Modal>

      <MediaLightbox url={viewerUrl()} onClose={() => setViewerUrl(null)} />
    </AppScaffold>
  );
}
