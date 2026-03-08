import { For, Show, createEffect, createMemo, createSignal, onMount } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchNui } from '../../../utils/fetchNui';
import { timeAgo } from '../../../utils/misc';
import { resolveMediaType, sanitizeMediaUrl, sanitizeText } from '../../../utils/sanitize';
import { AppScaffold } from '../../shared/layout';
import { useAppCache } from '../../../hooks';
import { usePhoneKeyHandler } from '../../../hooks/usePhoneKeyHandler';
import { MediaLightbox } from '../../shared/ui/MediaLightbox';
import { FormField, FormTextarea, Modal, ModalActions, ModalButton } from '../../shared/ui/Modal';
import { EmojiPickerButton } from '../../shared/ui/EmojiPicker';
import styles from './ChirpApp.module.scss';

interface ChirpTweet {
  id: number;
  display_name?: string;
  username?: string;
  avatar?: string;
  content: string;
  media_url?: string;
  likes?: number;
  likes_count?: number;
  liked?: boolean;
  rechirps?: number;
  rechirps_count?: number;
  rechirped?: boolean;
  replies?: number;
  comments_count?: number;
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

interface ChirpFollowRequest {
  id: number;
  account_id: number;
  from_identifier?: string;
  to_identifier?: string;
  username?: string;
  display_name?: string;
  avatar?: string;
  verified?: boolean;
  created_at?: string;
}

interface ChirpAccount {
  username?: string;
  display_name?: string;
  avatar?: string;
  bio?: string;
  is_private?: boolean | number;
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
  const [myAccount, setMyAccount] = createSignal<ChirpAccount | null>(null);
  const [pendingRequests, setPendingRequests] = createSignal<ChirpFollowRequest[]>([]);
  const [sentRequests, setSentRequests] = createSignal<ChirpFollowRequest[]>([]);

  // UI State
  const [loading, setLoading] = createSignal(false);
  const [fabTooltipVisible, setFabTooltipVisible] = createSignal(false);

  // Composer
  const [showComposer, setShowComposer] = createSignal(false);
  const [composerText, setComposerText] = createSignal('');
  const [composerMedia, setComposerMedia] = createSignal('');
  const charCount = createMemo(() => composerText().length);

  // Comments
  const [showComments, setShowComments] = createSignal(false);
  const [commentText, setCommentText] = createSignal('');
  const [statusMessage, setStatusMessage] = createSignal('');
  const [deleteTweetId, setDeleteTweetId] = createSignal<number | null>(null);
  const [deleteCommentId, setDeleteCommentId] = createSignal<number | null>(null);
  const [showAttachUrlModal, setShowAttachUrlModal] = createSignal(false);
  const [attachUrlInput, setAttachUrlInput] = createSignal('');
  const [showProfileModal, setShowProfileModal] = createSignal(false);
  const [showRequestsModal, setShowRequestsModal] = createSignal(false);
  const [requestsLoading, setRequestsLoading] = createSignal(false);

  const [profileDisplayName, setProfileDisplayName] = createSignal('');
  const [profileAvatar, setProfileAvatar] = createSignal('');
  const [profileBio, setProfileBio] = createSignal('');
  const [profilePrivate, setProfilePrivate] = createSignal(false);

  // Viewer
  const [viewerUrl, setViewerUrl] = createSignal<string | null>(null);
  const [query, setQuery] = createSignal('');

  const pendingCount = createMemo(() => pendingRequests().length);
  const sentCount = createMemo(() => sentRequests().length);

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

  const toBool = (value: unknown) => value === true || value === 1 || value === '1';

  const toCount = (value: unknown) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.floor(parsed));
  };

  const normalizeTweet = (tweet: ChirpTweet): ChirpTweet => {
    const likes = toCount(tweet.likes ?? tweet.likes_count);
    const rechirps = toCount(tweet.rechirps ?? tweet.rechirps_count);
    const replies = toCount(tweet.replies ?? tweet.comments_count);
    return {
      ...tweet,
      likes,
      liked: toBool(tweet.liked),
      rechirps,
      rechirped: toBool(tweet.rechirped),
      replies,
    };
  };

  const normalizeTweets = (list: ChirpTweet[]) =>
    list.map((tweet) => normalizeTweet(tweet));

  const applyTweetUpdate = (tweetId: number, updater: (tweet: ChirpTweet) => ChirpTweet) => {
    setTweets((prev) => prev.map((tweet) => (tweet.id === tweetId ? updater(tweet) : tweet)));
    setSelectedTweet((prev) => (prev && prev.id === tweetId ? updater(prev) : prev));
  };

  const loadTweets = async () => {
    setLoading(true);
    const cacheKey = `tweets:${currentTab()}`;
    const cached = cache.get<ChirpTweet[]>(cacheKey);
    
    const list = cached ?? await fetchNui<ChirpTweet[]>('chirpGetTweets', { 
      tab: currentTab(), 
      limit: 50, 
      offset: 0 
    }, []);

    const normalized = normalizeTweets(list || []);
    if (!cached) cache.set(cacheKey, normalized, 30000);
    setTweets(normalized);
    setLoading(false);
  };

  const refreshFollowRequests = async () => {
    setRequestsLoading(true);
    const incoming = await fetchNui<ChirpFollowRequest[]>('chirpGetPendingFollowRequests', {}, []);
    const outgoing = await fetchNui<ChirpFollowRequest[]>('chirpGetSentFollowRequests', {}, []);
    setPendingRequests(incoming || []);
    setSentRequests(outgoing || []);
    setRequestsLoading(false);
  };

  const loadSocialState = async () => {
    const account = await fetchNui<ChirpAccount | null>('chirpGetAccount', {}, null);
    setMyAccount(account);
    setProfileDisplayName(account?.display_name || '');
    setProfileAvatar(account?.avatar || '');
    setProfileBio(account?.bio || '');
    setProfilePrivate(account?.is_private === 1 || account?.is_private === true);

    await refreshFollowRequests();
  };

  createEffect(() => {
    void loadTweets();
  });

  onMount(() => {
    void loadSocialState();
  });

  let lastSharedMedia = '';
  createEffect(() => {
    const params = router.params();
    const sharedMedia = sanitizeMediaUrl(typeof params.composeMedia === 'string' ? params.composeMedia : '');
    if (!sharedMedia || sharedMedia === lastSharedMedia) return;
    lastSharedMedia = sharedMedia;
    setComposerMedia(sharedMedia);
    setShowComposer(true);
  });

  usePhoneKeyHandler({
    Backspace: () => {
      if (showAttachUrlModal()) {
        setShowAttachUrlModal(false);
        return;
      }
      if (deleteTweetId() !== null) {
        setDeleteTweetId(null);
        return;
      }
      if (deleteCommentId() !== null) {
        setDeleteCommentId(null);
        return;
      }
      if (showRequestsModal()) {
        setShowRequestsModal(false);
        return;
      }
      if (showProfileModal()) {
        setShowProfileModal(false);
        return;
      }
      if (showComposer()) {
        setShowComposer(false);
        return;
      }
      if (viewMode() === 'detail') {
        setViewMode('list');
        setSelectedTweet(null);
        setComments([]);
        return;
      }
      router.goBack();
    },
  });

  const openTweetDetail = async (tweet: ChirpTweet) => {
    setSelectedTweet(normalizeTweet(tweet));
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
      applyTweetUpdate(tweetId, (tweet) => {
        const nextLiked = result.liked === true;
        const prevLiked = tweet.liked === true;
        const delta = prevLiked === nextLiked ? 0 : nextLiked ? 1 : -1;
        return {
          ...tweet,
          liked: nextLiked,
          likes: Math.max(0, (tweet.likes || 0) + delta),
        };
      });
    }
  };

  const toggleRechirp = async (e: Event, tweetId: number) => {
    e.stopPropagation();
    const result = await fetchNui<{ rechirped?: boolean }>('chirpToggleRechirp', { tweetId });
    if (result?.rechirped !== undefined) {
      applyTweetUpdate(tweetId, (tweet) => {
        const nextRechirped = result.rechirped === true;
        const prevRechirped = tweet.rechirped === true;
        const delta = prevRechirped === nextRechirped ? 0 : nextRechirped ? 1 : -1;
        return {
          ...tweet,
          rechirped: nextRechirped,
          rechirps: Math.max(0, (tweet.rechirps || 0) + delta),
        };
      });
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

  const openProfileEditor = () => {
    const account = myAccount();
    setProfileDisplayName(account?.display_name || '');
    setProfileAvatar(account?.avatar || '');
    setProfileBio(account?.bio || '');
    setProfilePrivate(account?.is_private === 1 || account?.is_private === true);
    setShowProfileModal(true);
  };

  const saveProfile = async () => {
    const payload = {
      displayName: sanitizeText(profileDisplayName(), 32),
      avatar: sanitizeMediaUrl(profileAvatar()),
      bio: sanitizeText(profileBio(), 180),
      isPrivate: profilePrivate(),
    };

    const ok = await fetchNui<boolean>('chirpUpdateAccount', payload, false);
    if (!ok) {
      setStatusMessage('No se pudo guardar el perfil');
      return;
    }

    setShowProfileModal(false);
    setStatusMessage('Perfil actualizado');
    cache.invalidate(`tweets:${currentTab()}`);
    await Promise.all([loadSocialState(), loadTweets()]);
  };

  const respondFollowRequest = async (requestId: number, accept: boolean) => {
    const ok = await fetchNui<boolean>('chirpRespondFollowRequest', { requestId, accept }, false);
    if (!ok) {
      setStatusMessage('No se pudo responder la solicitud');
      return;
    }

    setStatusMessage(accept ? 'Solicitud aceptada' : 'Solicitud rechazada');
    cache.invalidate(`tweets:${currentTab()}`);
    await Promise.all([refreshFollowRequests(), loadTweets()]);
  };

  const cancelSentRequest = async (targetAccountId: number) => {
    const ok = await fetchNui<boolean>('chirpCancelFollowRequest', { targetAccountId }, false);
    if (!ok) {
      setStatusMessage('No se pudo cancelar la solicitud');
      return;
    }

    setStatusMessage('Solicitud cancelada');
    cache.invalidate(`tweets:${currentTab()}`);
    await Promise.all([refreshFollowRequests(), loadTweets()]);
  };

  const TweetActions = (props: {
    tweet: ChirpTweet;
    onComment: (e: Event) => void;
    onDelete?: (e: Event, tweetId: number) => void;
  }) => {
    const tweet = props.tweet;
    return (
      <div class={styles.tweetActions}>
        <button
          class={styles.actionBtn}
          classList={{ [styles.active]: tweet.liked }}
          onClick={(e) => void toggleLike(e, tweet.id)}
        >
          <span class={styles.icon}>{tweet.liked ? '♥' : '♡'}</span>
          <span class={styles.count}>{tweet.likes || 0}</span>
        </button>

        <button
          class={styles.actionBtn}
          classList={{ [styles.active]: tweet.rechirped }}
          onClick={(e) => void toggleRechirp(e, tweet.id)}
        >
          <span class={styles.icon}>↻</span>
          <span class={styles.count}>{tweet.rechirps || 0}</span>
        </button>

        <button class={styles.actionBtn} onClick={props.onComment}>
          <span class={styles.icon}>💬</span>
          <span class={styles.count}>{tweet.replies || 0}</span>
        </button>

        <Show when={tweet.is_own && props.onDelete}>
          <button class={styles.actionBtn} onClick={(e) => props.onDelete?.(e, tweet.id)}>
            <span class={styles.icon}>🗑</span>
          </button>
        </Show>
      </div>
    );
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
        
        <TweetActions
          tweet={tweet}
          onComment={(e) => {
            e.stopPropagation();
            void openTweetDetail(tweet);
          }}
          onDelete={deleteTweet}
        />
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

        <div class={styles.socialStrip}>
          <button class={styles.socialBtn} onClick={() => { setShowRequestsModal(true); void refreshFollowRequests(); }}>
            <span>Solicitudes</span>
            <span class={styles.socialCounts}>R{pendingCount()} / E{sentCount()}</span>
          </button>
          <button class={styles.socialBtn} onClick={openProfileEditor}>
            <span>Perfil</span>
            <span class={styles.socialMeta}>{profilePrivate() ? 'Privado' : 'Publico'}</span>
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
              <TweetActions
                tweet={tweet}
                onComment={(e) => e.stopPropagation()}
                onDelete={deleteTweet}
              />
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
          <EmojiPickerButton value={composerText()} onChange={setComposerText} maxLength={280} />
      <textarea class={styles.composerTextarea}
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
        open={showRequestsModal()}
        title="Solicitudes"
        onClose={() => setShowRequestsModal(false)}
        size="md"
      >
        <div class={styles.requestsWrap}>
          <div class={styles.requestsSection}>
            <h4>Recibidas</h4>
            <Show when={!requestsLoading()} fallback={<p>Cargando...</p>}>
              <For each={pendingRequests()}>
                {(request) => (
                  <div class={styles.requestRow}>
                    <div class={styles.requestIdentity}>
                      <strong>{request.display_name || request.username || 'Usuario'}</strong>
                      <span>@{request.username || 'user'}</span>
                    </div>
                    <div class={styles.requestActions}>
                      <button class={styles.ghostBtn} onClick={() => void respondFollowRequest(request.id, false)}>Rechazar</button>
                      <button class={styles.primaryBtn} onClick={() => void respondFollowRequest(request.id, true)}>Aceptar</button>
                    </div>
                  </div>
                )}
              </For>
              <Show when={pendingRequests().length === 0}>
                <p>No tienes solicitudes pendientes.</p>
              </Show>
            </Show>
          </div>

          <div class={styles.requestsSection}>
            <h4>Enviadas</h4>
            <Show when={!requestsLoading()} fallback={<p>Cargando...</p>}>
              <For each={sentRequests()}>
                {(request) => (
                  <div class={styles.requestRow}>
                    <div class={styles.requestIdentity}>
                      <strong>{request.display_name || request.username || 'Usuario'}</strong>
                      <span>@{request.username || 'user'}</span>
                    </div>
                    <div class={styles.requestActions}>
                      <button class={styles.ghostBtn} onClick={() => void cancelSentRequest(request.account_id)}>Cancelar</button>
                    </div>
                  </div>
                )}
              </For>
              <Show when={sentRequests().length === 0}>
                <p>No tienes solicitudes enviadas.</p>
              </Show>
            </Show>
          </div>
        </div>

        <ModalActions>
          <ModalButton label="Cerrar" onClick={() => setShowRequestsModal(false)} />
        </ModalActions>
      </Modal>

      <Modal
        open={showProfileModal()}
        title="Editar perfil"
        onClose={() => setShowProfileModal(false)}
        size="md"
      >
        <FormField label="Nombre visible" value={profileDisplayName()} onChange={setProfileDisplayName} placeholder="Tu nombre" />
        <FormField label="Avatar (URL opcional)" type="url" value={profileAvatar()} onChange={setProfileAvatar} placeholder="https://..." />
        <FormTextarea label="Bio" value={profileBio()} onChange={setProfileBio} rows={3} placeholder="Cuenta algo sobre vos" />
        <label class={styles.privateToggle}>
          <input
            type="checkbox"
            checked={profilePrivate()}
            onChange={(e) => setProfilePrivate(e.currentTarget.checked)}
          />
          <span>Cuenta privada</span>
        </label>
        <ModalActions>
          <ModalButton label="Cancelar" onClick={() => setShowProfileModal(false)} />
          <ModalButton label="Guardar" tone="primary" onClick={() => void saveProfile()} />
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
