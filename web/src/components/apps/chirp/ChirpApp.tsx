import { For, Show, createEffect, createMemo, createSignal, onMount } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchNui } from '../../../utils/fetchNui';
import { timeAgo } from '../../../utils/misc';
import { resolveMediaType, sanitizeMediaUrl, sanitizeText } from '../../../utils/sanitize';
import { useNotifications } from '../../../store/notifications';
import { AppFAB, AppScaffold } from '../../shared/layout';
import { useAppCache } from '../../../hooks';
import { usePhoneKeyHandler } from '../../../hooks/usePhoneKeyHandler';
import { MediaLightbox } from '../../shared/ui/MediaLightbox';
import { MediaAttachmentPreview } from '../../shared/ui/MediaAttachmentPreview';
import { EmptyState } from '../../shared/ui/EmptyState';
import { FormField, FormTextarea, Modal, ModalActions, ModalButton } from '../../shared/ui/Modal';
import { EmojiPickerButton } from '../../shared/ui/EmojiPicker';
import { MediaActionButtons } from '../../shared/ui/MediaActionButtons';
import { SegmentedTabs } from '../../shared/ui/SegmentedTabs';
import { SheetIntro } from '../../shared/ui/SheetIntro';
import { SocialOnboardingModal, type SocialOnboardingPayload } from '../../shared/ui/SocialOnboardingModal';
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
  activity_type?: 'tweet' | 'like' | 'rechirp';
  activity_created_at?: string;
  activity_actor_display_name?: string;
  activity_actor_username?: string;
  original_tweet_id?: number;
  original_content?: string;
  original_media_url?: string;
  original_username?: string;
  original_display_name?: string;
  original_avatar?: string;
  original_verified?: boolean;
  rechirp_comment?: string;
  rechirp_media_url?: string;
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
  const [, notificationsActions] = useNotifications();

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
  const [showRechirpModal, setShowRechirpModal] = createSignal(false);
  const [rechirpTarget, setRechirpTarget] = createSignal<ChirpTweet | null>(null);
  const [rechirpComment, setRechirpComment] = createSignal('');
  const [rechirpMedia, setRechirpMedia] = createSignal('');
  const [attachUrlInput, setAttachUrlInput] = createSignal('');
  const [attachUrlTarget, setAttachUrlTarget] = createSignal<'composer' | 'rechirp'>('composer');
  const [showProfileModal, setShowProfileModal] = createSignal(false);
  const [showRequestsModal, setShowRequestsModal] = createSignal(false);
  const [showOnboarding, setShowOnboarding] = createSignal(false);
  const [requestsLoading, setRequestsLoading] = createSignal(false);

  const [profileDisplayName, setProfileDisplayName] = createSignal('');
  const [profileAvatar, setProfileAvatar] = createSignal('');
  const [profileBio, setProfileBio] = createSignal('');
  const [profilePrivate, setProfilePrivate] = createSignal(false);

  // Viewer
  const [viewerUrl, setViewerUrl] = createSignal<string | null>(null);
  const [query, setQuery] = createSignal('');
  const chirpTabs = [
    { id: 'forYou', label: 'Para ti' },
    { id: 'following', label: 'Siguiendo' },
    { id: 'myActivity', label: 'Actividad' },
  ];

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
    const likes = toCount(tweet.likes_count ?? tweet.likes);
    const rechirps = toCount(tweet.rechirps_count ?? tweet.rechirps);
    const replies = toCount(tweet.comments_count ?? tweet.replies);
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
    setShowOnboarding(!account?.username);
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

  let lastRechirpMedia = '';
  createEffect(() => {
    const params = router.params();
    const sharedMedia = sanitizeMediaUrl(typeof params.rechirpMedia === 'string' ? params.rechirpMedia : '');
    const openRechirp = params.openRechirp === '1';
    if (!openRechirp || !sharedMedia || sharedMedia === lastRechirpMedia) return;
    const targetId = Number(params.rechirpTweetId || 0);
    const targetTweet = tweets().find((tweet) => getActionTweetId(tweet) === targetId) || selectedTweet();
    lastRechirpMedia = sharedMedia;
    if (targetTweet) setRechirpTarget(targetTweet);
    setRechirpMedia(sharedMedia);
    setShowRechirpModal(true);
  });

  let lastAvatarMedia = '';
  createEffect(() => {
    const params = router.params();
    const sharedAvatar = sanitizeMediaUrl(typeof params.avatarMedia === 'string' ? params.avatarMedia : '');
    const openProfile = params.openProfile === '1';
    if (!openProfile || !sharedAvatar || sharedAvatar === lastAvatarMedia) return;
    lastAvatarMedia = sharedAvatar;
    setProfileAvatar(sharedAvatar);
    setShowProfileModal(true);
    setStatusMessage('Avatar listo para guardar');
  });

  usePhoneKeyHandler({
    Backspace: () => {
      if (showAttachUrlModal()) {
        setShowAttachUrlModal(false);
        return;
      }
      if (showRechirpModal()) {
        setShowRechirpModal(false);
        setRechirpTarget(null);
        setRechirpComment('');
        setRechirpMedia('');
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
      if (showOnboarding()) {
        setShowOnboarding(false);
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
    const targetTweetId = Number(tweet.original_tweet_id || tweet.id);
    
    const cacheKey = `comments:${targetTweetId}`;
    const cached = cache.get<ChirpComment[]>(cacheKey);
    const list = cached ?? await fetchNui<ChirpComment[]>('chirpGetComments', { tweetId: targetTweetId }, []);
    
    if (!cached) cache.set(cacheKey, list || [], 60000);
    setComments(list || []);
  };

  const getActionTweetId = (tweet: ChirpTweet) => Number(tweet.original_tweet_id || tweet.id);

  const toggleLike = async (e: Event, tweet: ChirpTweet) => {
    e.stopPropagation();
    const tweetId = getActionTweetId(tweet);
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

  const submitRechirp = async (tweet: ChirpTweet, content = '', mediaUrl = '') => {
    const tweetId = getActionTweetId(tweet);
    const result = await fetchNui<{ rechirped?: boolean }>('chirpToggleRechirp', {
      tweetId,
      content: sanitizeText(content, 280),
      mediaUrl: sanitizeMediaUrl(mediaUrl),
    });
    if (result?.rechirped !== undefined) {
      const nextRechirped = result.rechirped === true;
      applyTweetUpdate(tweetId, (entry) => {
        const prevRechirped = entry.rechirped === true;
        const delta = prevRechirped === nextRechirped ? 0 : nextRechirped ? 1 : -1;
        return {
          ...entry,
          rechirped: nextRechirped,
          rechirps: Math.max(0, (entry.rechirps || 0) + delta),
        };
      });

      setStatusMessage(nextRechirped ? 'ReChirp agregado a tu actividad' : 'ReChirp eliminado');
      notificationsActions.receive({
        appId: 'chirp',
        title: nextRechirped ? 'ReChirp agregado' : 'ReChirp eliminado',
        message: nextRechirped
          ? content.trim()
            ? 'Tu comentario fue publicado junto al ReChirp.'
            : 'Ahora aparece en Actividad.'
          : 'El chirp ya no aparece como rechirpeado.',
        icon: '↻',
        durationMs: 2200,
      });

      cache.invalidate('tweets:myActivity');
      cache.invalidate('tweets:forYou');
      cache.invalidate('tweets:following');
      if (showRechirpModal()) {
        setShowRechirpModal(false);
        setRechirpTarget(null);
        setRechirpComment('');
        setRechirpMedia('');
      }
      void loadTweets();
    }
  };

  const openRechirpComposer = (tweet: ChirpTweet) => {
    setRechirpTarget(tweet);
    setRechirpComment('');
    setRechirpMedia('');
    setShowRechirpModal(true);
  };

  const toggleRechirp = async (e: Event, tweet: ChirpTweet) => {
    e.stopPropagation();
    if (tweet.rechirped) {
      await submitRechirp(tweet);
      return;
    }

    openRechirpComposer(tweet);
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
      const targetTweetId = getActionTweetId(tweet);
      setTweets(prev => prev.map(t => 
        getActionTweetId(t) === targetTweetId ? { ...t, replies: (t.replies || 0) + 1 } : t
      ));
      setSelectedTweet(prev => prev ? { ...prev, replies: (prev.replies || 0) + 1 } : null);
      cache.invalidate(`comments:${targetTweetId}`);
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
      const targetTweetId = getActionTweetId(tweet);
      setTweets(prev => prev.map(t => 
        getActionTweetId(t) === targetTweetId ? { ...t, replies: Math.max(0, (t.replies || 0) - 1) } : t
      ));
      setSelectedTweet(prev => prev ? { 
        ...prev, 
        replies: Math.max(0, (prev.replies || 0) - 1) 
      } : null);
      cache.invalidate(`comments:${targetTweetId}`);
    }
    setDeleteCommentId(null);
  };

  const attachFromGallery = async () => {
    const gallery = await fetchNui<any[]>('getGallery', undefined, []);
    const picked = (gallery || []).find((item: any) => resolveMediaType(item?.url || '') === 'image') || gallery?.[0];
    if (picked?.url) {
      const clean = sanitizeMediaUrl(picked.url) || '';
      if (attachUrlTarget() === 'rechirp') {
        setRechirpMedia(clean);
      } else {
        setComposerMedia(clean);
      }
    }
  };

  const attachByUrl = (target: 'composer' | 'rechirp' = 'composer') => {
    setAttachUrlTarget(target);
    setAttachUrlInput(target === 'rechirp' ? rechirpMedia() : composerMedia());
    setShowAttachUrlModal(true);
  };

  const confirmAttachUrl = () => {
    const url = sanitizeMediaUrl(attachUrlInput());
    if (!url) {
      setStatusMessage('URL invalida o formato no permitido.');
      return;
    }

    if (attachUrlTarget() === 'rechirp') {
      setRechirpMedia(url);
    } else {
      setComposerMedia(url);
    }
    setStatusMessage('');
    setShowAttachUrlModal(false);
  };

  const openCamera = (target: 'chirp' | 'chirp-rechirp' = 'chirp', tweetId?: number) => {
    router.navigate('camera', target === 'chirp-rechirp' && tweetId ? { target, rechirpTweetId: String(tweetId) } : { target });
  };

  const attachAvatarFromGallery = async () => {
    const gallery = await fetchNui<any[]>('getGallery', undefined, []);
    const image = gallery?.find((item: any) => resolveMediaType(item?.url || '') === 'image');
    if (image?.url) {
      const clean = sanitizeMediaUrl(image.url) || '';
      setProfileAvatar(clean);
      setShowProfileModal(true);
      setStatusMessage('Avatar listo para guardar');
    } else {
      setStatusMessage('No se encontraron imagenes en la galeria');
    }
  };

  const openAvatarCamera = () => {
    router.navigate('camera', { target: 'chirp-avatar' });
  };

  const openProfileEditor = () => {
    const account = myAccount();
    if (!account?.username) {
      setShowOnboarding(true);
      return;
    }

    setProfileDisplayName(account?.display_name || '');
    setProfileAvatar(account?.avatar || '');
    setProfileBio(account?.bio || '');
    setProfilePrivate(account?.is_private === 1 || account?.is_private === true);
    setShowProfileModal(true);
  };

  const saveProfile = async () => {
    const payload = { isPrivate: profilePrivate() };

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

  const createChirpAccount = async (payload: SocialOnboardingPayload) => {
    const avatar = sanitizeMediaUrl(payload.avatar) || '';
    const bio = sanitizeText(payload.bio, 180);

    const response = await fetchNui<{ success?: boolean; error?: string; account?: ChirpAccount }>('chirpCreateAccount', {
      username: payload.username,
      displayName: payload.displayName,
      avatar,
      bio,
      isPrivate: payload.isPrivate,
    }, { success: false });

    if (!response?.success) {
      return { ok: false, error: response?.error || 'No se pudo crear la cuenta de Chirp.' };
    }

    const updated = await fetchNui<boolean>('chirpUpdateAccount', {
      displayName: payload.displayName,
      avatar,
      bio,
      isPrivate: payload.isPrivate,
    }, false);

    if (!updated) {
      return { ok: false, error: 'Cuenta creada, pero no se pudieron guardar todos los datos del perfil.' };
    }

    setShowOnboarding(false);
    cache.invalidate(`tweets:${currentTab()}`);
    await Promise.all([loadSocialState(), loadTweets()]);
    return { ok: true };
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
          onClick={(e) => void toggleLike(e, tweet)}
        >
          <span class={styles.icon}>{tweet.liked ? '♥' : '♡'}</span>
          <span class={styles.count}>{tweet.likes || 0}</span>
        </button>

        <button
          class={styles.actionBtn}
          classList={{ [styles.active]: tweet.rechirped }}
          onClick={(e) => void toggleRechirp(e, tweet)}
        >
          <span class={styles.icon}>↻</span>
          <span class={styles.count}>{tweet.rechirps || 0}</span>
        </button>

        <button class={styles.actionBtn} onClick={props.onComment}>
          <span class={styles.icon}><img src="./img/icons_ios/ui-chat.svg" alt="" draggable={false} /></span>
          <span class={styles.count}>{tweet.replies || 0}</span>
        </button>

        <Show when={tweet.is_own && props.onDelete}>
          <button class={styles.actionBtn} onClick={(e) => props.onDelete?.(e, tweet.id)}>
            <span class={styles.icon}><img src="./img/icons_ios/ui-trash.svg" alt="" draggable={false} /></span>
          </button>
        </Show>
      </div>
    );
  };

  // Render Tweet Card
  const TweetCard = (props: { tweet: ChirpTweet }) => {
    const tweet = props.tweet;
    const quotedMedia = () => tweet.original_media_url || tweet.media_url;
    const rechirpMedia = () => tweet.rechirp_media_url;
    const quotedContent = () => tweet.original_content || tweet.content;
    const activityLabel = () => {
      if (tweet.activity_type === 'rechirp') {
        return `${tweet.activity_actor_display_name || 'Tu cuenta'} hizo rechirp`;
      }
      if (tweet.activity_type === 'like') {
        return 'Te gusto este chirp';
      }
      return '';
    };

    return (
      <article class={styles.tweetCard} onClick={() => openTweetDetail(tweet)}>
        <Show when={activityLabel()}>
          <div class={styles.activityBanner}>{activityLabel()}</div>
        </Show>
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
              {tweet.verified && <span class={styles.verified}><img src="./img/icons_ios/ui-check.svg" alt="" draggable={false} /></span>}
              <span class={styles.username}>@{tweet.username || 'user'}</span>
            </div>
            <span class={styles.time}>{(tweet.activity_created_at || tweet.created_at) ? timeAgo(tweet.activity_created_at || tweet.created_at) : 'ahora'}</span>
          </div>
        </div>
        
        <Show when={tweet.activity_type === 'rechirp' && tweet.rechirp_comment}>
          <p class={styles.tweetContent}>{tweet.rechirp_comment}</p>
        </Show>
        <Show when={tweet.activity_type === 'rechirp' && rechirpMedia()}>
          {resolveMediaType(rechirpMedia()) === 'image' ? (
            <img class={styles.tweetMedia} src={rechirpMedia()!} alt="" onClick={(e) => { e.stopPropagation(); setViewerUrl(rechirpMedia()!); }} />
          ) : (
            <video class={styles.tweetMedia} src={rechirpMedia()!} controls playsinline preload="metadata" onClick={(e) => e.stopPropagation()} />
          )}
        </Show>
        <Show when={tweet.activity_type !== 'rechirp'}>
          <p class={styles.tweetContent}>{tweet.content}</p>
        </Show>
        
        <Show when={tweet.activity_type === 'rechirp'}>
          <div class={styles.quoteCard}>
            <div class={styles.quoteHeader}>
              <strong>{tweet.original_display_name || tweet.display_name || 'Usuario'}</strong>
              <span class={styles.username}>@{tweet.original_username || tweet.username || 'user'}</span>
            </div>
            <p class={styles.quoteContent}>{quotedContent()}</p>
            <Show when={quotedMedia()}>
              {resolveMediaType(quotedMedia()) === 'image' ? (
                <img class={styles.quoteMedia} src={quotedMedia()!} alt="" onClick={(e) => { e.stopPropagation(); setViewerUrl(quotedMedia()!); }} />
              ) : (
                <video class={styles.quoteMedia} src={quotedMedia()!} controls playsinline preload="metadata" onClick={(e) => e.stopPropagation()} />
              )}
            </Show>
          </div>
        </Show>

        <Show when={tweet.activity_type !== 'rechirp' && tweet.media_url}>
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
          <SegmentedTabs items={chirpTabs} active={currentTab()} onChange={(id) => setCurrentTab(id as TabMode)} />
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
          <EmptyState class={styles.emptyState} title="No hay chirps para mostrar" description="Cuando haya actividad nueva la veras aqui." />
        </Show>
      </div>

      {/* FAB */}
      <AppFAB
        class={styles.fab}
        icon="✎"
        onClick={() => setShowComposer(true)}
        tooltip="Nuevo Chirp"
        tooltipVisible={fabTooltipVisible()}
        onPointerDown={showFabTooltip}
        onPointerUp={hideFabTooltip}
        onPointerLeave={hideFabTooltip}
      />
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
                  {tweet.verified && <span class={styles.verified}><img src="./img/icons_ios/ui-check.svg" alt="" draggable={false} /></span>}
                </div>
                <span class={styles.username}>@{tweet.username || 'user'}</span>
              </div>
            </div>
            
            <Show when={tweet.activity_type === 'rechirp' && tweet.rechirp_comment}>
              <p class={styles.detailText}>{tweet.rechirp_comment}</p>
            </Show>
            <Show when={tweet.activity_type === 'rechirp' && tweet.rechirp_media_url}>
              {resolveMediaType(tweet.rechirp_media_url) === 'image' ? (
                <img
                  class={styles.detailMedia}
                  src={tweet.rechirp_media_url}
                  alt=""
                  onClick={() => setViewerUrl(tweet.rechirp_media_url || null)}
                />
              ) : (
                <video
                  class={styles.detailMedia}
                  src={tweet.rechirp_media_url}
                  controls
                  playsinline
                  preload="metadata"
                />
              )}
            </Show>
            <Show when={tweet.activity_type === 'rechirp'}>
              <div class={styles.quoteCard}>
                <div class={styles.quoteHeader}>
                  <strong>{tweet.original_display_name || tweet.display_name || 'Usuario'}</strong>
                  <span class={styles.username}>@{tweet.original_username || tweet.username || 'user'}</span>
                </div>
                <p class={styles.quoteContent}>{tweet.original_content || tweet.content}</p>
                <Show when={tweet.original_media_url || tweet.media_url}>
                  {resolveMediaType(tweet.original_media_url || tweet.media_url) === 'image' ? (
                    <img
                      class={styles.quoteMedia}
                      src={tweet.original_media_url || tweet.media_url}
                      alt=""
                      onClick={() => setViewerUrl(tweet.original_media_url || tweet.media_url || null)}
                    />
                  ) : (
                    <video
                      class={styles.quoteMedia}
                      src={tweet.original_media_url || tweet.media_url}
                      controls
                      playsinline
                      preload="metadata"
                    />
                  )}
                </Show>
              </div>
            </Show>
            <Show when={tweet.activity_type !== 'rechirp'}>
              <p class={styles.detailText}>{tweet.content}</p>
            </Show>

            <Show when={tweet.activity_type !== 'rechirp' && tweet.media_url}>
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
              <span>{(tweet.activity_created_at || tweet.created_at) ? timeAgo(tweet.activity_created_at || tweet.created_at) : 'ahora'}</span>
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
          <div class={styles.statusBanner}>
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
          <SheetIntro title="Nuevo Chirp" description="Comparte una idea breve y, si quieres, agrega una imagen o video para acompañarla." />
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
            <MediaAttachmentPreview url={composerMedia()} />
          </Show>
          
          <div class={styles.composerActions}>
            <MediaActionButtons
              actions={[
                { icon: './img/icons_ios/camera.svg', label: 'Camara', onClick: openCamera },
                { icon: './img/icons_ios/gallery.svg', label: 'Galeria', onClick: attachFromGallery },
                { icon: './img/icons_ios/ui-link.svg', label: 'URL', onClick: attachByUrl },
                ...(composerMedia() ? [{ icon: './img/icons_ios/ui-close.svg', label: 'Quitar', onClick: () => setComposerMedia(''), tone: 'danger' as const }] : []),
              ]}
              variant="compact"
            />
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
        open={showRechirpModal()}
        title="ReChirp"
        onClose={() => { setShowRechirpModal(false); setRechirpTarget(null); setRechirpComment(''); }}
        size="md"
      >
        <div class={styles.composerContent}>
          <SheetIntro title="ReChirpear" description="Puedes compartirlo tal cual o agregar una opinion corta como cita." />
          <FormTextarea label="Comentario opcional" value={rechirpComment()} onChange={(value) => setRechirpComment(sanitizeText(value, 280))} placeholder="Agrega un comentario a tu ReChirp..." rows={4} />
          <Show when={rechirpMedia()}>
            <MediaAttachmentPreview url={rechirpMedia()} />
          </Show>
          <div class={styles.composerActions}>
            <MediaActionButtons
              actions={[
                { icon: './img/icons_ios/camera.svg', label: 'Camara', onClick: () => rechirpTarget() && openCamera('chirp-rechirp', getActionTweetId(rechirpTarget()!)) },
                { icon: './img/icons_ios/gallery.svg', label: 'Galeria', onClick: async () => { setAttachUrlTarget('rechirp'); await attachFromGallery(); } },
                { icon: './img/icons_ios/ui-link.svg', label: 'URL', onClick: () => attachByUrl('rechirp') },
                ...(rechirpMedia() ? [{ icon: './img/icons_ios/ui-close.svg', label: 'Quitar', onClick: () => setRechirpMedia(''), tone: 'danger' as const }] : []),
              ]}
              variant="compact"
            />
          </div>
          <Show when={rechirpTarget()}>
            {(target) => (
              <div class={styles.quoteCard}>
                <div class={styles.quoteHeader}>
                  <strong>{target().display_name || 'Usuario'}</strong>
                  <span class={styles.username}>@{target().username || 'user'}</span>
                </div>
                <p class={styles.quoteContent}>{target().content}</p>
              </div>
            )}
          </Show>
        </div>
        <ModalActions>
          <ModalButton label="Cancelar" onClick={() => { setShowRechirpModal(false); setRechirpTarget(null); setRechirpComment(''); setRechirpMedia(''); }} />
          <ModalButton label="ReChirpear" tone="primary" onClick={() => rechirpTarget() && void submitRechirp(rechirpTarget()!, rechirpComment(), rechirpMedia())} />
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

      <SocialOnboardingModal
        open={showOnboarding()}
        appName="Chirp"
        usernameHint={myAccount()?.username || ''}
        displayNameHint={myAccount()?.display_name || ''}
        avatarHint={myAccount()?.avatar || ''}
        bioHint={myAccount()?.bio || ''}
        isPrivateHint={myAccount()?.is_private === 1 || myAccount()?.is_private === true}
        displayNameReadOnly
        onCreate={createChirpAccount}
        onClose={() => setShowOnboarding(false)}
      />

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
        <SheetIntro title="Perfil de Chirp" description="La identidad de Chirp queda ligada al inicio del telefono." />
        <FormField label="Nombre visible" value={profileDisplayName()} onChange={setProfileDisplayName} placeholder="Tu nombre" disabled />
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
