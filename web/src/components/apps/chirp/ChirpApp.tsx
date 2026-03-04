import { For, Show, createEffect, createSignal, onCleanup, onMount } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchNui } from '../../../utils/fetchNui';
import { timeAgo } from '../../../utils/misc';
import { resolveMediaType, sanitizeMediaUrl, sanitizeText } from '../../../utils/sanitize';
import { AppScaffold } from '../../shared/layout';
import { useAppCache } from '../../../hooks';
import { MediaLightbox } from '../../shared/ui/MediaLightbox';
import { Modal, ModalActions, ModalButton, FormField } from '../../shared/ui/Modal';
import styles from './ChirpApp.module.scss';

interface ChirpTweet {
  id: number;
  display_name?: string;
  username?: string;
  avatar?: string;
  content: string;
  media_url?: string;
  likes?: number;
  liked?: boolean;
  rechirps?: number;
  rechirped?: boolean;
  replies?: number;
  created_at?: string;
  verified?: boolean;
  is_own?: boolean;
}

interface ChirpComment {
  id: number;
  username?: string;
  display_name?: string;
  avatar?: string;
  content: string;
  created_at?: string;
}

type TabMode = 'forYou' | 'following' | 'myActivity';

export function ChirpApp() {
  const router = useRouter();
  const cache = useAppCache('chirp');

  // View state
  const [currentTab, setCurrentTab] = createSignal<TabMode>('forYou');
  const [selectedTweet, setSelectedTweet] = createSignal<ChirpTweet | null>(null);
  const [viewMode, setViewMode] = createSignal<'list' | 'detail'>('list');

  // Data
  const [tweets, setTweets] = createSignal<ChirpTweet[]>([]);
  const [comments, setComments] = createSignal<ChirpComment[]>([]);

  // UI State
  const [loading, setLoading] = createSignal(false);
  const [fabTooltipVisible, setFabTooltipVisible] = createSignal(false);

  // Composer
  const [showComposer, setShowComposer] = createSignal(false);
  const [composerText, setComposerText] = createSignal('');
  const [composerMedia, setComposerMedia] = createSignal('');
  const [charCount, setCharCount] = createSignal(0);

  // Comments
  const [showComments, setShowComments] = createSignal(false);
  const [commentText, setCommentText] = createSignal('');
  const [statusMessage, setStatusMessage] = createSignal('');
  const [deleteTweetId, setDeleteTweetId] = createSignal<number | null>(null);
  const [deleteCommentId, setDeleteCommentId] = createSignal<number | null>(null);
  const [showAttachUrlModal, setShowAttachUrlModal] = createSignal(false);
  const [attachUrlInput, setAttachUrlInput] = createSignal('');

  // Viewer
  const [viewerUrl, setViewerUrl] = createSignal<string | null>(null);
  const [query, setQuery] = createSignal('');

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

  // Character counter
  createEffect(() => {
    setCharCount(composerText().length);
  });

  const loadTweets = async () => {
    setLoading(true);
    const cacheKey = `tweets:${currentTab()}`;
    const cached = cache.get<ChirpTweet[]>(cacheKey);
    
    const list = cached ?? await fetchNui<ChirpTweet[]>('chirpGetTweets', { 
      tab: currentTab(), 
      limit: 50, 
      offset: 0 
    }, []);
    
    if (!cached) cache.set(cacheKey, list || [], 30000);
    setTweets(list || []);
    setLoading(false);
  };

  createEffect(() => {
    void loadTweets();
  });

  createEffect(() => {
    const onKey = (e: CustomEvent<string>) => {
      if (e.detail === 'Backspace') {
        if (viewMode() === 'detail') {
          setViewMode('list');
          setSelectedTweet(null);
          setComments([]);
          return;
        }
        router.goBack();
      }
    };
    window.addEventListener('phone:keyUp', onKey as EventListener);
    onCleanup(() => window.removeEventListener('phone:keyUp', onKey as EventListener));
  });

  const openTweetDetail = async (tweet: ChirpTweet) => {
    setSelectedTweet(tweet);
    setViewMode('detail');
    
    const cacheKey = `comments:${tweet.id}`;
    const cached = cache.get<ChirpComment[]>(cacheKey);
    const list = cached ?? await fetchNui<ChirpComment[]>('chirpGetComments', { tweetId: tweet.id }, []);
    
    if (!cached) cache.set(cacheKey, list || [], 60000);
    setComments(list || []);
  };

  const toggleLike = async (e: Event, tweetId: number) => {
    e.stopPropagation();
    const result = await fetchNui<{ liked?: boolean }>('chirpToggleLike', { tweetId });
    if (result?.liked !== undefined) {
      setTweets(prev => prev.map(t => 
        t.id === tweetId 
          ? { ...t, liked: result.liked, likes: (t.likes || 0) + (result.liked ? 1 : -1) }
          : t
      ));
      if (selectedTweet()?.id === tweetId) {
        setSelectedTweet(prev => prev ? { 
          ...prev, 
          liked: result.liked, 
          likes: (prev.likes || 0) + (result.liked ? 1 : -1) 
        } : null);
      }
    }
  };

  const toggleRechirp = async (e: Event, tweetId: number) => {
    e.stopPropagation();
    const result = await fetchNui<{ rechirped?: boolean }>('chirpToggleRechirp', { tweetId });
    if (result?.rechirped !== undefined) {
      setTweets(prev => prev.map(t => 
        t.id === tweetId 
          ? { ...t, rechirped: result.rechirped, rechirps: (t.rechirps || 0) + (result.rechirped ? 1 : -1) }
          : t
      ));
      if (selectedTweet()?.id === tweetId) {
        setSelectedTweet(prev => prev ? { 
          ...prev, 
          rechirped: result.rechirped, 
          rechirps: (prev.rechirps || 0) + (result.rechirped ? 1 : -1) 
        } : null);
      }
    }
  };

  const publishTweet = async () => {
    const content = sanitizeText(composerText(), 280);
    const media = sanitizeMediaUrl(composerMedia());
    
    if (!content) return;
    
    setLoading(true);
    const result = await fetchNui<{ success?: boolean; tweet?: ChirpTweet }>('chirpPublishTweet', { 
      content, 
      mediaUrl: media 
    });
    
    if (result?.success) {
      setComposerText('');
      setComposerMedia('');
      setShowComposer(false);
      cache.invalidate(`tweets:${currentTab()}`);
      await loadTweets();
    }
    setLoading(false);
  };

  const addComment = async () => {
    const tweet = selectedTweet();
    if (!tweet || !commentText().trim()) return;
    
    const result = await fetchNui<{ success?: boolean; comment?: ChirpComment }>('chirpAddComment', {
      tweetId: tweet.id,
      content: commentText().trim()
    });
    
    if (result?.success && result.comment) {
      setCommentText('');
      setComments(prev => [...prev, result.comment!]);
      setTweets(prev => prev.map(t => 
        t.id === tweet.id ? { ...t, replies: (t.replies || 0) + 1 } : t
      ));
      setSelectedTweet(prev => prev ? { ...prev, replies: (prev.replies || 0) + 1 } : null);
      cache.invalidate(`comments:${tweet.id}`);
    }
  };

  const deleteTweet = async (e: Event, tweetId: number) => {
    e.stopPropagation();
    setDeleteTweetId(tweetId);
  };

  const confirmDeleteTweet = async () => {
    const tweetId = deleteTweetId();
    if (!tweetId) return;

    await fetchNui('chirpDeleteTweet', tweetId);
    setTweets(prev => prev.filter(t => t.id !== tweetId));
    if (selectedTweet()?.id === tweetId) {
      setViewMode('list');
      setSelectedTweet(null);
    }
    setDeleteTweetId(null);
  };

  const deleteComment = async (commentId: number) => {
    setDeleteCommentId(commentId);
  };

  const confirmDeleteComment = async () => {
    const commentId = deleteCommentId();
    if (!commentId) return;

    await fetchNui('chirpDeleteComment', { commentId });
    setComments(prev => prev.filter(c => c.id !== commentId));
    
    const tweet = selectedTweet();
    if (tweet) {
      setTweets(prev => prev.map(t => 
        t.id === tweet.id ? { ...t, replies: Math.max(0, (t.replies || 0) - 1) } : t
      ));
      setSelectedTweet(prev => prev ? { 
        ...prev, 
        replies: Math.max(0, (prev.replies || 0) - 1) 
      } : null);
      cache.invalidate(`comments:${tweet.id}`);
    }
    setDeleteCommentId(null);
  };

  const attachFromGallery = async () => {
    const gallery = await fetchNui<any[]>('getGallery', undefined, []);
    if (gallery?.[0]?.url) {
      setComposerMedia(sanitizeMediaUrl(gallery[0].url) || '');
    }
  };

  const attachByUrl = () => {
    setAttachUrlInput(composerMedia());
    setShowAttachUrlModal(true);
  };

  const confirmAttachUrl = () => {
    const url = sanitizeMediaUrl(attachUrlInput());
    if (!url) {
      setStatusMessage('URL invalida o formato no permitido.');
      return;
    }

    setComposerMedia(url);
    setStatusMessage('');
    setShowAttachUrlModal(false);
  };

  const openCamera = () => {
    router.navigate('camera', { target: 'chirp' });
  };

  // Render Tweet Card
  const TweetCard = (props: { tweet: ChirpTweet }) => {
    const tweet = props.tweet;
    return (
      <article class={styles.tweetCard} onClick={() => openTweetDetail(tweet)}>
        <div class={styles.tweetHeader}>
          <div class={styles.avatar}>
            {tweet.avatar ? (
              <img src={tweet.avatar} alt="" />
            ) : (
              <span>{(tweet.display_name || 'U').charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div class={styles.tweetMeta}>
            <div class={styles.nameRow}>
              <strong>{tweet.display_name || 'Usuario'}</strong>
              {tweet.verified && <span class={styles.verified}>✓</span>}
              <span class={styles.username}>@{tweet.username || 'user'}</span>
            </div>
            <span class={styles.time}>{tweet.created_at ? timeAgo(tweet.created_at) : 'ahora'}</span>
          </div>
        </div>
        
        <p class={styles.tweetContent}>{tweet.content}</p>
        
        <Show when={tweet.media_url}>
          {resolveMediaType(tweet.media_url) === 'image' ? (
            <img 
              class={styles.tweetMedia} 
              src={tweet.media_url} 
              alt="" 
              onClick={(e) => { e.stopPropagation(); setViewerUrl(tweet.media_url!); }}
            />
          ) : (
            <video 
              class={styles.tweetMedia} 
              src={tweet.media_url} 
              controls 
              playsinline 
              preload="metadata"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </Show>
        
        <div class={styles.tweetActions}>
          <button 
            class={styles.actionBtn}
            classList={{ [styles.active]: tweet.liked }}
            onClick={(e) => toggleLike(e, tweet.id)}
          >
            <span class={styles.icon}>{tweet.liked ? '♥' : '♡'}</span>
            <span class={styles.count}>{tweet.likes || 0}</span>
          </button>
          
          <button 
            class={styles.actionBtn}
            classList={{ [styles.active]: tweet.rechirped }}
            onClick={(e) => toggleRechirp(e, tweet.id)}
          >
            <span class={styles.icon}>↻</span>
            <span class={styles.count}>{tweet.rechirps || 0}</span>
          </button>
          
          <button class={styles.actionBtn} onClick={(e) => { e.stopPropagation(); openTweetDetail(tweet); }}>
            <span class={styles.icon}>💬</span>
            <span class={styles.count}>{tweet.replies || 0}</span>
          </button>
          
          <Show when={tweet.is_own}>
            <button class={styles.actionBtn} onClick={(e) => deleteTweet(e, tweet.id)}>
              <span class={styles.icon}>🗑</span>
            </button>
          </Show>
        </div>
      </article>
    );
  };

  // Render List View
  const ListView = () => (
    <div class={styles.listView}>
      <div class={styles.headerSection}>
        <div class={styles.tabs}>
          <button 
            class={styles.tabBtn}
            classList={{ [styles.active]: currentTab() === 'forYou' }}
            onClick={() => setCurrentTab('forYou')}
          >
            Para ti
          </button>
          <button 
            class={styles.tabBtn}
            classList={{ [styles.active]: currentTab() === 'following' }}
            onClick={() => setCurrentTab('following')}
          >
            Siguiendo
          </button>
          <button 
            class={styles.tabBtn}
            classList={{ [styles.active]: currentTab() === 'myActivity' }}
            onClick={() => setCurrentTab('myActivity')}
          >
            Mi Actividad
          </button>
        </div>
      </div>
      
      <div class={styles.feed}>
        <Show when={loading() && tweets().length === 0}>
          <div class={styles.loading}>Cargando...</div>
        </Show>
        
        <For each={tweets()}>
          {(tweet) => <TweetCard tweet={tweet} />}
        </For>
        
        <Show when={!loading() && tweets().length === 0}>
          <div class={styles.emptyState}>
            <p>No hay tweets para mostrar</p>
          </div>
        </Show>
      </div>

      {/* FAB */}
      <div class={styles.fabContainer}>
        <Show when={fabTooltipVisible()}>
          <div class={styles.fabTooltip}>Nuevo Chirp</div>
        </Show>
        <button 
          class={styles.fab}
          onClick={() => setShowComposer(true)}
          onPointerDown={showFabTooltip}
          onPointerUp={hideFabTooltip}
          onPointerLeave={hideFabTooltip}
        >
          ✎
        </button>
      </div>
    </div>
  );

  // Render Detail View
  const DetailView = () => {
    const tweet = selectedTweet();
    if (!tweet) return null;

    return (
      <div class={styles.detailView}>
        <div class={styles.detailHeader}>
          <button class={styles.backBtn} onClick={() => { setViewMode('list'); setSelectedTweet(null); }}>
            ← Volver
          </button>
          <span class={styles.detailTitle}>Chirp</span>
        </div>

        <div class={styles.detailContent}>
          <div class={styles.detailTweet}>
            <div class={styles.tweetHeader}>
              <div class={styles.avatar}>
                {tweet.avatar ? (
                  <img src={tweet.avatar} alt="" />
                ) : (
                  <span>{(tweet.display_name || 'U').charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div class={styles.tweetMeta}>
                <div class={styles.nameRow}>
                  <strong>{tweet.display_name || 'Usuario'}</strong>
                  {tweet.verified && <span class={styles.verified}>✓</span>}
                </div>
                <span class={styles.username}>@{tweet.username || 'user'}</span>
              </div>
            </div>
            
            <p class={styles.detailText}>{tweet.content}</p>
            
            <Show when={tweet.media_url}>
              {resolveMediaType(tweet.media_url) === 'image' ? (
                <img 
                  class={styles.detailMedia} 
                  src={tweet.media_url} 
                  alt="" 
                  onClick={() => setViewerUrl(tweet.media_url!)}
                />
              ) : (
                <video 
                  class={styles.detailMedia} 
                  src={tweet.media_url} 
                  controls 
                  playsinline 
                  preload="metadata"
                />
              )}
            </Show>
            
            <div class={styles.detailMeta}>
              <span>{tweet.created_at ? timeAgo(tweet.created_at) : 'ahora'}</span>
            </div>
            
            <div class={styles.detailActions}>
              <button 
                class={styles.actionBtn}
                classList={{ [styles.active]: tweet.liked }}
                onClick={(e) => toggleLike(e, tweet.id)}
              >
                <span class={styles.icon}>{tweet.liked ? '♥' : '♡'}</span>
                <span class={styles.count}>{tweet.likes || 0}</span>
              </button>
              
              <button 
                class={styles.actionBtn}
                classList={{ [styles.active]: tweet.rechirped }}
                onClick={(e) => toggleRechirp(e, tweet.id)}
              >
                <span class={styles.icon}>↻</span>
                <span class={styles.count}>{tweet.rechirps || 0}</span>
              </button>
              
              <button class={styles.actionBtn}>
                <span class={styles.icon}>💬</span>
                <span class={styles.count}>{tweet.replies || 0}</span>
              </button>
              
              <Show when={tweet.is_own}>
                <button class={styles.actionBtn} onClick={(e) => deleteTweet(e, tweet.id)}>
                  <span class={styles.icon}>🗑</span>
                </button>
              </Show>
            </div>
          </div>

          {/* Comments Section */}
          <div class={styles.commentsSection}>
            <h4 class={styles.commentsTitle}>Comentarios</h4>
            
            <div class={styles.commentsList}>
              <For each={comments()}>
                {(comment) => (
                  <div class={styles.commentItem}>
                    <div class={styles.commentHeader}>
                      <strong>{comment.display_name || 'Usuario'}</strong>
                      <span class={styles.commentTime}>{comment.created_at ? timeAgo(comment.created_at) : 'ahora'}</span>
                    </div>
                    <p class={styles.commentText}>{comment.content}</p>
                  </div>
                )}
              </For>
              
              <Show when={comments().length === 0}>
                <div class={styles.emptyComments}>
                  <p>Sin comentarios aun</p>
                </div>
              </Show>
            </div>

            {/* Add Comment */}
            <div class={styles.commentComposer}>
              <textarea
                class={styles.commentInput}
                placeholder="Escribe un comentario..."
                value={commentText()}
                onInput={(e) => setCommentText(e.currentTarget.value)}
                rows={3}
              />
              <button 
                class={styles.sendBtn}
                onClick={addComment}
                disabled={!commentText().trim()}
              >
                Comentar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <AppScaffold title="Chirp" subtitle="Que esta pasando?" onBack={() => router.goBack()} bodyClass={styles.body}>
      <Show when={viewMode() === 'list'} fallback={<DetailView />}>
        <Show when={statusMessage()}>
          <div style={{ padding: '8px 12px', margin: '8px', 'background-color': 'rgba(255, 159, 10, 0.14)', color: '#7a4a00', 'font-size': '12px', 'border-radius': '10px' }}>
            {statusMessage()}
          </div>
        </Show>
        <ListView />
      </Show>

      {/* Composer Modal */}
      <Modal 
        open={showComposer()} 
        title="Nuevo Chirp" 
        onClose={() => setShowComposer(false)}
        size="md"
      >
        <div class={styles.composerContent}>
          <textarea
            class={styles.composerTextarea}
            placeholder="Que esta pasando?"
            value={composerText()}
            onInput={(e) => setComposerText(e.currentTarget.value)}
            maxlength={280}
            rows={4}
          />
          
          <div class={styles.charCounter}>
            <span classList={{ [styles.limitReached]: charCount() >= 280 }}>
              {charCount()}/280
            </span>
          </div>
          
          <Show when={composerMedia()}>
            {resolveMediaType(composerMedia()) === 'image' ? (
              <img class={styles.mediaPreview} src={composerMedia()} alt="" />
            ) : (
              <video class={styles.mediaPreview} src={composerMedia()} controls playsinline />
            )}
          </Show>
          
          <div class={styles.composerActions}>
            <div class={styles.mediaButtons}>
              <button class={styles.mediaBtn} onClick={openCamera}>📷</button>
              <button class={styles.mediaBtn} onClick={attachFromGallery}>🖼</button>
              <button class={styles.mediaBtn} onClick={attachByUrl}>🔗</button>
              <Show when={composerMedia()}>
                <button class={styles.mediaBtn} onClick={() => setComposerMedia('')}>✕</button>
              </Show>
            </div>
          </div>
        </div>
        
        <ModalActions>
          <ModalButton label="Cancelar" onClick={() => setShowComposer(false)} />
          <ModalButton 
            label={loading() ? 'Publicando...' : 'Chirpear'} 
            onClick={() => void publishTweet()}
            tone="primary"
            disabled={!composerText().trim() || charCount() > 280 || loading()}
          />
        </ModalActions>
      </Modal>

      <Modal
        open={showAttachUrlModal()}
        title="Adjuntar URL"
        onClose={() => setShowAttachUrlModal(false)}
        size="sm"
      >
        <FormField label="URL de imagen/video" value={attachUrlInput()} onChange={setAttachUrlInput} placeholder="https://..." />
        <ModalActions>
          <ModalButton label="Cancelar" onClick={() => setShowAttachUrlModal(false)} />
          <ModalButton label="Adjuntar" tone="primary" onClick={confirmAttachUrl} />
        </ModalActions>
      </Modal>

      <Modal
        open={deleteTweetId() !== null}
        title="Eliminar chirp"
        onClose={() => setDeleteTweetId(null)}
        size="sm"
      >
        <p>Esta accion no se puede deshacer.</p>
        <ModalActions>
          <ModalButton label="Cancelar" onClick={() => setDeleteTweetId(null)} />
          <ModalButton label="Eliminar" tone="danger" onClick={() => void confirmDeleteTweet()} />
        </ModalActions>
      </Modal>

      <Modal
        open={deleteCommentId() !== null}
        title="Eliminar comentario"
        onClose={() => setDeleteCommentId(null)}
        size="sm"
      >
        <p>Esta accion no se puede deshacer.</p>
        <ModalActions>
          <ModalButton label="Cancelar" onClick={() => setDeleteCommentId(null)} />
          <ModalButton label="Eliminar" tone="danger" onClick={() => void confirmDeleteComment()} />
        </ModalActions>
      </Modal>

      <MediaLightbox url={viewerUrl()} onClose={() => setViewerUrl(null)} />
    </AppScaffold>
  );
}
