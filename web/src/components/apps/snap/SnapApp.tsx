import { For, Show, createEffect, createSignal, onCleanup } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchNui } from '../../../utils/fetchNui';
import { timeAgo } from '../../../utils/misc';
import { resolveMediaType, sanitizeMediaUrl, sanitizeText } from '../../../utils/sanitize';
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
  const [viewerUrl, setViewerUrl] = createSignal<string | null>(null);
  const [showActionSheet, setShowActionSheet] = createSignal(false);
  const [statusMessage, setStatusMessage] = createSignal('');
  const [deletePostId, setDeletePostId] = createSignal<number | null>(null);

  // Create Post
  const [showCreatePost, setShowCreatePost] = createSignal(false);
  const [postMedia, setPostMedia] = createSignal('');
  const [postCaption, setPostCaption] = createSignal('');
  const [postMode, setPostMode] = createSignal<'post' | 'story'>('post');

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

  createEffect(() => {
    const onKey = (e: CustomEvent<string>) => {
      if (e.detail === 'Backspace') {
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

  const openStory = (index: number) => {
    setActiveStoryIndex(index);
  };

  const shiftStory = (offset: number) => {
    const current = activeStoryIndex();
    if (current === null) return;
    const next = Math.max(0, Math.min(stories().length - 1, current + offset));
    setActiveStoryIndex(next);
  };

  const formatStoryTime = (expiresAt?: string) => {
    if (!expiresAt) return '';
    const remaining = Math.max(0, new Date(expiresAt).getTime() - Date.now());
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    if (hours > 0) return `${hours}h`;
    const mins = Math.floor(remaining / (1000 * 60));
    return `${mins}m`;
  };

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

  const activeStory = () => {
    const idx = activeStoryIndex();
    return idx !== null ? stories()[idx] : null;
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
                  <div class={styles.liveItem}>
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
                  </div>
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
              style={{ width: `${((activeStoryIndex() || 0) + 1) / stories().length * 100}%` }}
            />
          </div>

          <div class={styles.storyInfo}>
            <strong>{activeStory()?.display_name || activeStory()?.username}</strong>
            <span>{formatStoryTime(activeStory()?.expires_at)} restante</span>
          </div>

          {resolveMediaType(activeStory()?.media_url) === 'video' ? (
            <video 
              src={activeStory()?.media_url} 
              controls 
              playsinline 
              autoplay
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
