import { For, Show, createEffect, createSignal, onCleanup, onMount } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchNui } from '../../../utils/fetchNui';
import { timeAgo } from '../../../utils/misc';
import { sanitizeMediaUrl, sanitizeText } from '../../../utils/sanitize';
import { AppScaffold } from '../../shared/layout';
import { useAppCache } from '../../../hooks';
import { MediaLightbox } from '../../shared/ui/MediaLightbox';
import { Modal, ModalActions, ModalButton } from '../../shared/ui/Modal';
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
}

interface Comment {
  id: number;
  username?: string;
  display_name?: string;
  avatar?: string;
  content: string;
  created_at?: string;
}

export function ClipsApp() {
  const router = useRouter();
  const cache = useAppCache('clips');

  // Data
  const [clips, setClips] = createSignal<Clip[]>([]);
  const [currentClipIndex, setCurrentClipIndex] = createSignal(0);
  const [comments, setComments] = createSignal<Comment[]>([]);
  const [showComments, setShowComments] = createSignal(false);
  const [myAccount, setMyAccount] = createSignal<any>(null);

  // UI State
  const [loading, setLoading] = createSignal(false);
  const [fabTooltipVisible, setFabTooltipVisible] = createSignal(false);
  const [likeAnimation, setLikeAnimation] = createSignal<number | null>(null);
  const [viewerUrl, setViewerUrl] = createSignal<string | null>(null);

  // Upload
  const [showUpload, setShowUpload] = createSignal(false);
  const [uploadMedia, setUploadMedia] = createSignal('');
  const [uploadCaption, setUploadCaption] = createSignal('');

  // Comment
  const [commentText, setCommentText] = createSignal('');

  // Placeholder/Mock data for preview
  const placeholderClips: Clip[] = [
    {
      id: 1,
      username: 'usuario1',
      display_name: 'Juan Pérez',
      avatar: '',
      media_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      caption: '🎬 Mi primer video en Clips! #fyp #viral',
      likes: 234,
      liked: false,
      comments_count: 45,
      is_own: false
    },
    {
      id: 2,
      username: 'gamerpro',
      display_name: 'Gamer Pro',
      avatar: '',
      media_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
      caption: '🎮 Jugando en Los Santos #gaming #gta',
      likes: 1892,
      liked: true,
      comments_count: 156,
      is_own: false
    },
    {
      id: 3,
      username: 'miamigo',
      display_name: 'Mi Amigo',
      avatar: '',
      media_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      caption: '🔥 Increíble momento capturado! #epic',
      likes: 567,
      liked: false,
      comments_count: 89,
      is_own: true
    },
    {
      id: 4,
      username: 'ciudadano',
      display_name: 'Ciudadano LS',
      avatar: '',
      media_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
      caption: '🚗 Escapando de la policia... #chase #gta',
      likes: 3421,
      liked: false,
      comments_count: 234,
      is_own: false
    }
  ];

  const placeholderComments: Comment[] = [
    {
      id: 1,
      username: 'user1',
      display_name: 'Maria G.',
      avatar: '',
      content: '¡Increíble video! Me encantó 🔥',
      created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString() // 5 min ago
    },
    {
      id: 2,
      username: 'user2',
      display_name: 'Carlos R.',
      avatar: '',
      content: 'JAJAJAJA lo mejor que vi hoy 😂',
      created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString() // 15 min ago
    },
    {
      id: 3,
      username: 'user3',
      display_name: 'Ana M.',
      avatar: '',
      content: '¿Dónde fue eso? Se ve épico!',
      created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString() // 30 min ago
    }
  ];

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
    
    // Use placeholder data for preview
    const usePlaceholders = true; // Cambiar a false para usar datos reales
    
    if (usePlaceholders) {
      // Simular delay de carga
      await new Promise(resolve => setTimeout(resolve, 500));
      setClips(placeholderClips);
      setMyAccount({ username: 'tuusuario', display_name: 'Tu Nombre' });
    } else {
      const cached = cache.get<Clip[]>('clips:feed');
      const list = cached ?? await fetchNui<Clip[]>('clipsGetFeed', { limit: 40, offset: 0 }, []);
      
      if (!cached) cache.set('clips:feed', list || [], 60000);
      setClips(list || []);
      
      // Get account
      const account = await fetchNui('snapGetAccount', {});
      setMyAccount(account);
    }
    
    setLoading(false);
  };

  createEffect(() => {
    void loadClips();
  });

  createEffect(() => {
    const onKey = (e: CustomEvent<string>) => {
      if (e.detail === 'Backspace') {
        if (showComments()) {
          setShowComments(false);
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
    if (!confirm('¿Eliminar este clip?')) return;
    
    await fetchNui('clipsDeletePost', clipId);
    setClips(prev => prev.filter(c => c.id !== clipId));
    cache.invalidate('clips:feed');
  };

  const loadComments = async (clipId: number) => {
    // Use placeholder data for preview
    const usePlaceholders = true; // Cambiar a false para usar datos reales
    
    if (usePlaceholders) {
      await new Promise(resolve => setTimeout(resolve, 300));
      setComments(placeholderComments);
    } else {
      const cached = cache.get<Comment[]>(`clips:comments:${clipId}`);
      const list = cached ?? await fetchNui<Comment[]>('clipsGetComments', { clipId }, []);
      
      if (!cached) cache.set(`clips:comments:${clipId}`, list || [], 30000);
      setComments(list || []);
    }
  };

  const openComments = async (clipId: number) => {
    await loadComments(clipId);
    setShowComments(true);
  };

  const addComment = async () => {
    const currentClip = clips()[currentClipIndex()];
    if (!currentClip || !commentText().trim()) return;
    
    const result = await fetchNui<{ success?: boolean; comment?: Comment }>('clipsAddComment', {
      clipId: currentClip.id,
      content: commentText().trim()
    });
    
    if (result?.success && result.comment) {
      setCommentText('');
      setComments(prev => [...prev, result.comment!]);
      setClips(prev => prev.map(c => 
        c.id === currentClip.id ? { ...c, comments_count: (c.comments_count || 0) + 1 } : c
      ));
      cache.invalidate(`clips:comments:${currentClip.id}`);
    }
  };

  const publishClip = async () => {
    const media = sanitizeMediaUrl(uploadMedia());
    if (!media) {
      alert('Selecciona un video');
      return;
    }
    
    setLoading(true);
    const result = await fetchNui('clipsPublish', {
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
      alert('No se encontraron videos en la galeria');
    }
  };

  const openCamera = () => {
    router.navigate('camera', { target: 'clips' });
  };

  const scrollToNext = () => {
    const next = Math.min(clips().length - 1, currentClipIndex() + 1);
    setCurrentClipIndex(next);
  };

  const scrollToPrev = () => {
    const prev = Math.max(0, currentClipIndex() - 1);
    setCurrentClipIndex(prev);
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

  onMount(() => {
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
    }
  });

  return (
    <AppScaffold title="Clips" subtitle="Videos cortos" onBack={() => router.goBack()} bodyClass={styles.body}>
      <div class={styles.clipsApp}>
        {/* Feed */}
        <div 
          class={styles.feed} 
          ref={scrollContainer}
          onScroll={handleScroll}
        >
          <Show when={loading() && clips().length === 0}>
            <div class={styles.loading}>Cargando videos...</div>
          </Show>
          
          <For each={clips()}>
            {(clip, index) => (
              <div 
                class={styles.clipCard}
                onDblClick={() => handleDoubleTap(clip.id)}
              >
                {/* Video */}
                <video
                  class={styles.clipVideo}
                  src={clip.media_url}
                  controls={index() === currentClipIndex()}
                  playsinline
                  loop
                  preload={Math.abs(index() - currentClipIndex()) <= 1 ? "auto" : "metadata"}
                />
                
                {/* Like Animation */}
                <Show when={likeAnimation() === clip.id}>
                  <div class={styles.likeAnimation}>♥</div>
                </Show>
                
                {/* Overlay */}
                <div class={styles.clipOverlay}>
                  {/* Right Actions */}
                  <div class={styles.sideActions}>
                    <div class={styles.actionItem}>
                      <button 
                        class={styles.actionBtn}
                        classList={{ [styles.liked]: clip.liked }}
                        onClick={() => toggleLike(clip.id)}
                      >
                        {clip.liked ? '♥' : '♡'}
                      </button>
                      <span class={styles.actionCount}>{clip.likes || 0}</span>
                    </div>
                    
                    <div class={styles.actionItem}>
                      <button 
                        class={styles.actionBtn}
                        onClick={() => openComments(clip.id)}
                      >
                        💬
                      </button>
                      <span class={styles.actionCount}>{clip.comments_count || 0}</span>
                    </div>
                    
                    <div class={styles.actionItem}>
                      <button class={styles.actionBtn}>↗</button>
                      <span class={styles.actionCount}>Compartir</span>
                    </div>
                    
                    <Show when={clip.is_own}>
                      <div class={styles.actionItem}>
                        <button 
                          class={styles.actionBtn}
                          onClick={() => deleteClip(clip.id)}
                        >
                          🗑
                        </button>
                        <span class={styles.actionCount}>Eliminar</span>
                      </div>
                    </Show>
                  </div>
                  
                  {/* Bottom Info */}
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
                
                {/* Navigation Indicators */}
                <Show when={clips().length > 1}>
                  <div class={styles.navIndicators}>
                    <For each={clips()}>
                      {(_, i) => (
                        <div 
                          class={styles.indicator}
                          classList={{ [styles.active]: i() === currentClipIndex() }}
                          onClick={() => {
                            setCurrentClipIndex(i());
                            scrollContainer?.scrollTo({ top: i() * scrollContainer.clientHeight, behavior: 'smooth' });
                          }}
                        />
                      )}
                    </For>
                  </div>
                </Show>
              </div>
            )}
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

        {/* Comments Modal */}
        <Show when={showComments()}>
          <div class={styles.commentsModal}>
            <div class={styles.commentsHeader}>
              <h4>{comments().length} comentarios</h4>
              <button class={styles.closeBtn} onClick={() => setShowComments(false)}>✕</button>
            </div>
            
            <div class={styles.commentsList}>
              <For each={comments()}>
                {(comment) => (
                  <div class={styles.commentItem}>
                    <div class={styles.commentAvatar}>
                      {comment.avatar ? (
                        <img src={comment.avatar} alt="" />
                      ) : (
                        <span>{(comment.display_name || comment.username || 'U').charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div class={styles.commentContent}>
                      <strong>{comment.display_name || comment.username}</strong>
                      <p>{comment.content}</p>
                      <span class={styles.commentTime}>{comment.created_at ? timeAgo(comment.created_at) : 'ahora'}</span>
                    </div>
                  </div>
                )}
              </For>
              
              <Show when={comments().length === 0}>
                <div class={styles.emptyComments}>
                  <p>Sin comentarios aun</p>
                  <p>¡Sé el primero en comentar!</p>
                </div>
              </Show>
            </div>
            
            <div class={styles.commentInput}>
              <input
                type="text"
                placeholder="Escribe un comentario..."
                value={commentText()}
                onInput={(e) => setCommentText(e.currentTarget.value)}
                onKeyDown={(e) => e.key === 'Enter' && addComment()}
              />
              <button 
                onClick={addComment}
                disabled={!commentText().trim()}
              >
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

        <MediaLightbox url={viewerUrl()} onClose={() => setViewerUrl(null)} />
      </div>
    </AppScaffold>
  );
}
