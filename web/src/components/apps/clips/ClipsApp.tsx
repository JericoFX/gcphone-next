import { For, Show, createEffect, createMemo, createSignal, onCleanup } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchNui } from '../../../utils/fetchNui';
import { timeAgo } from '../../../utils/misc';
import { sanitizeMediaUrl, sanitizeText } from '../../../utils/sanitize';
import { useAppCache } from '../../../hooks';
import { usePhoneKeyHandler } from '../../../hooks/usePhoneKeyHandler';
import { usePhone } from '../../../store/phone';
import { isEnvBrowser } from '../../../utils/misc';
import { uiPrompt } from '../../../utils/uiDialog';
import { MediaLightbox } from '../../shared/ui/MediaLightbox';
import { FormField, Modal, ModalActions, ModalButton } from '../../shared/ui/Modal';
import { EmojiPickerButton } from '../../shared/ui/EmojiPicker';
import { SocialOnboardingModal, type SocialOnboardingPayload } from '../../shared/ui/SocialOnboardingModal';
import { t } from '../../../i18n';
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

interface SharedSnapAccount {
  username?: string;
  display_name?: string;
  avatar?: string;
  bio?: string;
  is_private?: boolean | number;
}

type ClipTab = 'feed' | 'following' | 'myVideos';

const MOCK_CLIPS: Clip[] = [
  {
    id: 901,
    username: 'carlos_m',
    display_name: 'Carlos Mendoza',
    media_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    caption: 'Persecucion en la autopista 🔥',
    likes: 142,
    liked: false,
    comments_count: 23,
    is_own: false,
  },
  {
    id: 902,
    username: 'ana_t',
    display_name: 'Ana Torres',
    media_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    caption: 'Nuevo tuneo del Dominator 💎',
    likes: 89,
    liked: true,
    comments_count: 7,
    is_own: false,
  },
  {
    id: 903,
    username: 'pedro_r',
    display_name: 'Pedro Ruiz',
    media_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    caption: 'Drift en el muelle',
    likes: 56,
    liked: false,
    comments_count: 3,
    is_own: true,
  },
];

export function ClipsApp() {
  const router = useRouter();
  const cache = useAppCache('clips');
  const [phoneState] = usePhone();
  const language = () => phoneState.settings.language || 'es';

  const [clips, setClips] = createSignal<Clip[]>([]);
  const [currentClipIndex, setCurrentClipIndex] = createSignal(0);
  const [comments, setComments] = createSignal<Comment[]>([]);
  const [showComments, setShowComments] = createSignal(false);
  const [myAccount, setMyAccount] = createSignal<SharedSnapAccount | null>(null);
  const [currentTab, setCurrentTab] = createSignal<ClipTab>('feed');
  const [loading, setLoading] = createSignal(false);
  const [likeAnimation, setLikeAnimation] = createSignal<number | null>(null);
  const [viewerUrl, setViewerUrl] = createSignal<string | null>(null);
  const [pausedClips, setPausedClips] = createSignal<Set<number>>(new Set());
  const [statusMessage, setStatusMessage] = createSignal('');
  const [deleteClipId, setDeleteClipId] = createSignal<number | null>(null);
  const [showOnboarding, setShowOnboarding] = createSignal(false);
  let onboardingChecked = false;
  let onboardingDismissed = false;
  const [showProfileModal, setShowProfileModal] = createSignal(false);
  const [profilePrivate, setProfilePrivate] = createSignal(false);
  const [profileAvatar, setProfileAvatar] = createSignal('');
  const [showAvatarPicker, setShowAvatarPicker] = createSignal(false);
  const [showUpload, setShowUpload] = createSignal(false);
  const [uploadMedia, setUploadMedia] = createSignal('');
  const [uploadCaption, setUploadCaption] = createSignal('');
  const [storageReady, setStorageReady] = createSignal(false);
  const [storageProvider, setStorageProvider] = createSignal('');
  const [commentText, setCommentText] = createSignal('');

  const clipById = createMemo(() => {
    const map = new Map<number, Clip>();
    for (const clip of clips()) map.set(clip.id, clip);
    return map;
  });

  const currentClip = createMemo(() => clips()[currentClipIndex()] || null);

  const loadClips = async () => {
    setLoading(true);

    const storage = await fetchNui<{
      provider?: string; uploadUrl?: string; customUploadUrl?: string; serverFolderPublicUrl?: string;
    }>('getStorageConfig', undefined, {});
    const provider = String(storage?.provider || 'custom');
    const hasStorage = provider === 'server_folder'
      ? Boolean(storage?.serverFolderPublicUrl)
      : Boolean(storage?.uploadUrl || storage?.customUploadUrl);
    setStorageReady(hasStorage);
    setStorageProvider(provider);

    const account = await fetchNui<SharedSnapAccount | null>('clipsGetAccount', {});
    setMyAccount(account);
    if (!onboardingChecked) {
      onboardingChecked = true;
      if (!account?.username && !onboardingDismissed) {
        setShowOnboarding(true);
      }
    }

    const tab = currentTab();
    let cacheKey: string;
    let endpoint: string;

    if (tab === 'myVideos') {
      cacheKey = 'clips:myvideos';
      endpoint = 'clipsGetMyClips';
    } else if (tab === 'following') {
      cacheKey = 'clips:following';
      endpoint = 'clipsGetFeed';
    } else {
      cacheKey = 'clips:feed';
      endpoint = 'clipsGetFeed';
    }

    const mockFallback = isEnvBrowser() ? MOCK_CLIPS : [];
    const cached = cache.get<Clip[]>(cacheKey);
    const list = cached ?? await fetchNui<Clip[]>(endpoint, { limit: 40, offset: 0 }, mockFallback);
    if (!cached && list.length > 0) cache.set(cacheKey, list, 60000);
    setClips(list.length > 0 ? list : mockFallback);
    setCurrentClipIndex(0);
    setLoading(false);
  };

  createEffect(() => {
    currentTab();
    void loadClips();
  });

  let lastAvatarMedia = '';
  createEffect(() => {
    const params = router.params();
    const sharedAvatar = sanitizeMediaUrl(typeof params.avatarMedia === 'string' ? params.avatarMedia : '');
    const openProfile = params.openProfile === '1';
    if (!openProfile || !sharedAvatar || sharedAvatar === lastAvatarMedia) return;
    lastAvatarMedia = sharedAvatar;
    setShowProfileModal(true);
  });

  usePhoneKeyHandler({
    Backspace: () => {
      if (showComments()) { setShowComments(false); return; }
      if (showUpload()) { setShowUpload(false); return; }
      if (showProfileModal()) { setShowProfileModal(false); return; }
      router.goBack();
    },
  });

  // ── Interactions ──

  const toggleLike = async (clipId: number) => {
    const result = await fetchNui<{ liked?: boolean }>('clipsToggleLike', { postId: clipId });
    if (result?.liked !== undefined) {
      setClips((prev) => prev.map((c) => {
        if (c.id !== clipId) return c;
        if (c.liked === result.liked) return c;
        return { ...c, liked: result.liked, likes: Math.max(0, (c.likes || 0) + (result.liked ? 1 : -1)) };
      }));
    }
  };

  const handleDoubleTap = (clipId: number) => {
    setLikeAnimation(clipId);
    setTimeout(() => setLikeAnimation(null), 1000);
    const clip = clipById().get(clipId);
    if (clip && !clip.liked) void toggleLike(clipId);
  };

  const togglePause = (clipId: number) => {
    const video = videoRefs.get(clipId);
    setPausedClips(prev => {
      const next = new Set(prev);
      if (next.has(clipId)) {
        next.delete(clipId);
        video?.play().catch(() => {});
      } else {
        next.add(clipId);
        video?.pause();
      }
      return next;
    });
  };

  // ── Comments ──

  const loadComments = async (clipId: number) => {
    const list = await fetchNui<Comment[]>('clipsGetComments', { clipId }, []);
    setComments(list || []);
  };

  const openComments = async (clipId: number) => {
    await loadComments(clipId);
    setShowComments(true);
  };

  const addComment = async () => {
    const clip = currentClip();
    const content = sanitizeText(commentText(), 500);
    if (!clip || !content) return;

    const result = await fetchNui<{ success?: boolean; comment?: Comment }>('clipsAddComment', { clipId: clip.id, content });
    if (result?.success && result.comment) {
      setCommentText('');
      setComments((prev) => [...prev, result.comment!]);
      setClips((prev) => prev.map((c) => (c.id === clip.id ? { ...c, comments_count: (c.comments_count || 0) + 1 } : c)));
    }
  };

  // ── CRUD ──

  const deleteClip = (clipId: number) => setDeleteClipId(clipId);

  const confirmDeleteClip = async () => {
    const clipId = deleteClipId();
    if (!clipId) return;
    await fetchNui('clipsDeletePost', clipId);
    setClips(prev => prev.filter(c => c.id !== clipId));
    cache.invalidate('clips:feed');
    cache.invalidate('clips:myvideos');
    cache.invalidate('clips:following');
    setDeleteClipId(null);
  };

  const publishClip = async () => {
    if (!storageReady()) { setStatusMessage(t('clips.storage_required', language())); return; }
    const media = sanitizeMediaUrl(uploadMedia());
    if (!media) { setStatusMessage(t('clips.select_video', language())); return; }
    setStatusMessage('');
    setLoading(true);
    const result = await fetchNui<{ success?: boolean }>('clipsPublish', { mediaUrl: media, caption: sanitizeText(uploadCaption(), 500) });
    if (result?.success) {
      setUploadMedia(''); setUploadCaption(''); setShowUpload(false);
      cache.invalidate('clips:feed');
      await loadClips();
    }
    setLoading(false);
  };

  const attachFromGallery = async () => {
    const gallery = await fetchNui<any[]>('getGallery', undefined, []);
    const video = gallery?.find((g: any) => g.url?.match(/\.(mp4|webm|mov)$/i));
    if (video?.url) setUploadMedia(sanitizeMediaUrl(video.url) || '');
    else setStatusMessage(t('clips.no_gallery_videos', language()));
  };

  const openCamera = () => {
    if (!storageReady()) { setStatusMessage(t('clips.storage_before_record', language())); return; }
    router.navigate('camera', { target: 'clips' });
  };

  const attachByUrl = async () => {
    const input = await uiPrompt('URL del video (mp4, webm, mov):', { title: 'Agregar video' });
    if (typeof input !== 'string') return;
    const url = sanitizeMediaUrl(input);
    if (url) setUploadMedia(url);
  };

  // ── Profile ──

  const openProfileEditor = async () => {
    const account = await fetchNui<SharedSnapAccount | null>('clipsGetAccount', {});
    setProfilePrivate(!!account.is_private);
    setProfileAvatar(account.avatar || '');
    setShowProfileModal(true);
  };

  const attachAvatarFromGallery = async () => {
    const gallery = await fetchNui<any[]>('getGallery', undefined, []);
    const image = gallery?.find((item: any) => item?.url && !item.url.match(/\.(mp4|webm|mov)$/i));
    if (image?.url) setProfileAvatar(sanitizeMediaUrl(image.url) || '');
  };

  const attachAvatarByUrl = async () => {
    const input = await uiPrompt('URL del avatar:', { title: 'Avatar' });
    if (typeof input !== 'string') return;
    const url = sanitizeMediaUrl(input);
    if (url) setProfileAvatar(url);
  };

  const saveProfile = async () => {
    const avatar = sanitizeMediaUrl(profileAvatar());
    const ok = await fetchNui<{ success?: boolean }>('clipsUpdateAccount', { isPrivate: profilePrivate(), avatar: avatar || undefined });
    if (ok?.success) {
      setStatusMessage(t('snap.profile_updated', language()));
      setShowProfileModal(false);
      await loadClips();
    }
  };

  const createClipsAccount = async (payload: SocialOnboardingPayload) => {
    const avatar = sanitizeMediaUrl(payload.avatar) || '';
    const bio = sanitizeText(payload.bio, 180);

    const response = await fetchNui<{ success?: boolean; error?: string }>('clipsCreateAccount', {
      username: payload.username, displayName: payload.displayName, avatar,
    }, { success: false });

    if (!response?.success) return { ok: false, error: response?.error || 'No se pudo crear la cuenta.' };

    await fetchNui<{ success?: boolean }>('clipsUpdateAccount', {
      displayName: payload.displayName, avatar, bio, isPrivate: payload.isPrivate,
    }, { success: false });

    setShowOnboarding(false);
    setStatusMessage(t('clips.account_created', language()));
    await loadClips();
    return { ok: true };
  };

  // ── Scroll & Playback ──
  let scrollContainer: HTMLDivElement | undefined;
  const videoRefs = new Map<number, HTMLVideoElement>();

  const handleScroll = () => {
    if (!scrollContainer) return;
    const idx = Math.round(scrollContainer.scrollTop / scrollContainer.clientHeight);
    setCurrentClipIndex(Math.max(0, Math.min(clips().length - 1, idx)));
  };

  // Sync video play/pause with currentClipIndex
  createEffect(() => {
    const activeIdx = currentClipIndex();
    const paused = pausedClips();
    videoRefs.forEach((video, clipId) => {
      const clip = clips().find((c) => c.id === clipId);
      if (!clip) return;
      const clipIdx = clips().indexOf(clip);
      if (clipIdx === activeIdx && !paused.has(clipId)) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    });
  });

  const registerVideo = (clipId: number, el: HTMLVideoElement) => {
    videoRefs.set(clipId, el);
  };

  const stopAllVideos = () => {
    videoRefs.forEach((v) => { v.pause(); v.currentTime = 0; });
  };

  onCleanup(stopAllVideos);

  return (
    <div class={styles.root}>
      {/* ── Top bar: tabs left, username right ── */}
      <div class={styles.topBar}>
        <div class={styles.tabRow}>
          <button class={styles.tabPill} classList={{ [styles.tabActive]: currentTab() === 'feed' }} onClick={() => setCurrentTab('feed')}>
            {t('clips.for_you', language())}
          </button>
          <button class={styles.tabPill} classList={{ [styles.tabActive]: currentTab() === 'following' }} onClick={() => setCurrentTab('following')}>
            {t('clips.following', language()) || 'Siguiendo'}
          </button>
          <button class={styles.tabPill} classList={{ [styles.tabActive]: currentTab() === 'myVideos' }} onClick={() => setCurrentTab('myVideos')}>
            {t('clips.library', language())}
          </button>
        </div>
        <button class={styles.userBadge} onClick={() => void openProfileEditor()}>
          <Show when={myAccount()?.avatar} fallback={
            <span class={styles.userInitial}>{(myAccount()?.display_name || myAccount()?.username || 'U').charAt(0).toUpperCase()}</span>
          }>
            <img src={myAccount()!.avatar!} alt="" class={styles.userAvatarImg} />
          </Show>
          <span class={styles.userName}>@{myAccount()?.username || '...'}</span>
        </button>
      </div>

      {/* ── Back button ── */}
      <button class={styles.backBtn} onClick={() => router.goBack()}>
        <img src="./img/icons_ios/ui-chevron-left.svg" alt="" />
      </button>

      {/* ── Status ── */}
      <Show when={statusMessage()}>
        <div class={styles.statusToast}>{statusMessage()}</div>
      </Show>

      {/* ── Feed ── */}
      <div class={styles.feed} ref={scrollContainer} onScroll={handleScroll}>
        <Show when={loading() && clips().length === 0}>
          <div class={styles.emptyCenter}>
            <div class={styles.loadingDot} />
          </div>
        </Show>

        <For each={clips()}>
          {(clip, index) => {
            const isPaused = () => pausedClips().has(clip.id);
            let tapTimer: number | undefined;

            const handleTap = (e: MouseEvent) => {
              e.stopPropagation();
              if (tapTimer) {
                clearTimeout(tapTimer);
                tapTimer = undefined;
                handleDoubleTap(clip.id);
                return;
              }
              tapTimer = window.setTimeout(() => {
                tapTimer = undefined;
                togglePause(clip.id);
              }, 250);
            };

            return (
              <div class={styles.clipScreen}>
                <video
                  class={styles.clipVideo}
                  src={clip.media_url}
                  controls={false}
                  playsinline
                  loop
                  muted
                  preload={Math.abs(index() - currentClipIndex()) <= 1 ? 'auto' : 'metadata'}
                  ref={(el) => registerVideo(clip.id, el)}
                  onClick={handleTap}
                />

                <Show when={isPaused()}>
                  <div class={styles.pauseIcon}>▶</div>
                </Show>

                <Show when={likeAnimation() === clip.id}>
                  <div class={styles.likeExplosion}>
                    <span class={styles.likeHeart}>♥</span>
                    <span class={styles.particle} style={{ '--angle': '0deg', '--dist': '60px' } as any} />
                    <span class={styles.particle} style={{ '--angle': '45deg', '--dist': '50px' } as any} />
                    <span class={styles.particle} style={{ '--angle': '90deg', '--dist': '55px' } as any} />
                    <span class={styles.particle} style={{ '--angle': '135deg', '--dist': '45px' } as any} />
                    <span class={styles.particle} style={{ '--angle': '180deg', '--dist': '60px' } as any} />
                    <span class={styles.particle} style={{ '--angle': '225deg', '--dist': '50px' } as any} />
                    <span class={styles.particle} style={{ '--angle': '270deg', '--dist': '55px' } as any} />
                    <span class={styles.particle} style={{ '--angle': '315deg', '--dist': '48px' } as any} />
                  </div>
                </Show>

                {/* Gradient overlay — bottom only */}
                <div class={styles.gradient} />

                {/* Side actions */}
                <div class={styles.sideActions}>
                  <button
                    class={styles.sideBtn}
                    classList={{ [styles.sideLiked]: clip.liked }}
                    onClick={(e) => { e.stopPropagation(); void toggleLike(clip.id); }}
                  >
                    <span class={styles.sideIcon}>{clip.liked ? '♥' : '♡'}</span>
                    <span class={styles.sideCount}>{clip.likes || 0}</span>
                  </button>

                  <button class={styles.sideBtn} onClick={(e) => { e.stopPropagation(); void openComments(clip.id); }}>
                    <span class={styles.sideIcon}><img src="./img/icons_ios/ui-chat.svg" alt="" /></span>
                    <span class={styles.sideCount}>{clip.comments_count || 0}</span>
                  </button>

                  <Show when={clip.is_own}>
                    <button class={styles.sideBtn} onClick={(e) => { e.stopPropagation(); deleteClip(clip.id); }}>
                      <span class={styles.sideIcon}><img src="./img/icons_ios/ui-trash.svg" alt="" /></span>
                    </button>
                  </Show>
                </div>

                {/* Bottom info */}
                <div class={styles.bottomInfo}>
                  <div class={styles.authorRow}>
                    <div class={styles.authorAvatar}>
                      {clip.avatar
                        ? <img src={clip.avatar} alt="" />
                        : <span>{(clip.display_name || clip.username || 'U').charAt(0).toUpperCase()}</span>
                      }
                    </div>
                    <strong class={styles.authorHandle}>@{clip.username || 'user'}</strong>
                  </div>
                  <Show when={clip.caption}>
                    <p class={styles.caption}>{clip.caption}</p>
                  </Show>
                  <div class={styles.soundRow}>
                    <img src="./img/icons_ios/music.svg" alt="" />
                    <span>{t('clips.original_sound', language(), { name: clip.display_name || clip.username || 'user' })}</span>
                  </div>
                </div>
              </div>
            );
          }}
        </For>

        <Show when={!loading() && clips().length === 0}>
          <div class={styles.emptyCenter}>
            <p>{t('clips.no_clips', language())}</p>
            <small>{t('clips.no_clips_desc', language())}</small>
          </div>
        </Show>
      </div>

      {/* ── FAB (absolute inside root, not fixed — FiveM CEF transform breaks fixed) ── */}
      <button class={styles.fab} onClick={() => setShowUpload(true)}>+</button>

      {/* ── Comments overlay ── */}
      <Show when={showComments()}>
        <div class={styles.commentsOverlay}>
          <div class={styles.commentsPanel} onClick={(e) => e.stopPropagation()}>
            <div class={styles.commentsHead}>
              <span>{comments().length} comentarios</span>
              <button class={styles.commentsClose} onClick={() => setShowComments(false)}>✕</button>
            </div>
            <div class={styles.commentsFeed}>
              <For each={comments()}>
                {(comment) => (
                  <div class={styles.commentBubble}>
                    <strong>@{comment.username || 'user'}</strong>
                    <span>{comment.content}</span>
                    <small>{comment.created_at ? timeAgo(comment.created_at) : 'ahora'}</small>
                  </div>
                )}
              </For>
              <Show when={comments().length === 0}>
                <div class={styles.commentsEmpty}>Sin comentarios</div>
              </Show>
            </div>
            <div class={styles.commentBar}>
              <EmojiPickerButton value={commentText()} onChange={setCommentText} maxLength={500} />
              <input
                type="text"
                placeholder="Comentar..."
                value={commentText()}
                onInput={(e) => setCommentText(sanitizeText(e.currentTarget.value, 500))}
                onKeyDown={(e) => e.key === 'Enter' && void addComment()}
              />
              <button onClick={() => void addComment()} disabled={!commentText().trim()}>↑</button>
            </div>
          </div>
          <div class={styles.commentsScrim} onClick={() => setShowComments(false)} />
        </div>
      </Show>

      {/* ── Upload Modal ── */}
      <Modal open={showUpload()} title="Subir Clip" onClose={() => { setShowUpload(false); setUploadMedia(''); setUploadCaption(''); }} size="md">
        <div class={styles.uploadBody}>
          <Show when={!uploadMedia()}>
            <div class={styles.uploadGrid}>
              <button class={styles.uploadCard} onClick={openCamera}>
                <img src="./img/icons_ios/camera.svg" alt="" />
                <span>Grabar</span>
              </button>
              <button class={styles.uploadCard} onClick={attachFromGallery}>
                <img src="./img/icons_ios/gallery.svg" alt="" />
                <span>Galeria</span>
              </button>
              <button class={styles.uploadCard} onClick={attachByUrl}>
                <img src="./img/icons_ios/ui-link.svg" alt="" />
                <span>URL</span>
              </button>
            </div>
          </Show>
          <Show when={uploadMedia()}>
            <div class={styles.previewWrap}>
              <video src={uploadMedia()} controls playsinline />
              <button class={styles.previewRemove} onClick={() => setUploadMedia('')}>✕</button>
            </div>
            <textarea class={styles.captionInput} placeholder="Describe tu video..." value={uploadCaption()} onInput={(e) => setUploadCaption(e.currentTarget.value)} rows={2} />
          </Show>
        </div>
        <ModalActions>
          <ModalButton label="Cancelar" onClick={() => { setShowUpload(false); setUploadMedia(''); setUploadCaption(''); }} />
          <ModalButton label={loading() ? 'Subiendo...' : 'Subir'} onClick={() => void publishClip()} tone="primary" disabled={!uploadMedia() || loading()} />
        </ModalActions>
      </Modal>

      {/* ── Profile bottom sheet ── */}
      <Show when={showProfileModal()}>
        <div class={styles.profileOverlay} onClick={() => setShowProfileModal(false)}>
          <div class={styles.profileSheet} onClick={(e) => e.stopPropagation()}>
            <div class={styles.profileSheetHandle} />

            {/* Avatar — click to change */}
            <div class={styles.profileAvatarWrap} onClick={() => setShowAvatarPicker(v => !v)}>
              <div class={styles.profileAvatarLg}>
                <Show when={profileAvatar()} fallback={
                  <span>{(myAccount()?.display_name || 'U').charAt(0).toUpperCase()}</span>
                }>
                  <img src={profileAvatar()} alt="" />
                </Show>
              </div>
              <div class={styles.profileAvatarEdit}>✎</div>
            </div>
            <strong class={styles.profileName}>{myAccount()?.display_name || 'Usuario'}</strong>
            <span class={styles.profileHandle}>@{myAccount()?.username || 'clips'}</span>

            {/* Avatar picker (iOS action sheet style) */}
            <Show when={showAvatarPicker()}>
              <div class={styles.avatarPicker}>
                <button onClick={() => { void attachAvatarFromGallery(); setShowAvatarPicker(false); }}>
                  <img src="./img/icons_ios/gallery.svg" alt="" /> Galeria
                </button>
                <button onClick={() => { router.navigate('camera', { target: 'clips-avatar' }); setShowAvatarPicker(false); }}>
                  <img src="./img/icons_ios/camera.svg" alt="" /> Camara
                </button>
                <button onClick={() => { attachAvatarByUrl(); setShowAvatarPicker(false); }}>
                  <img src="./img/icons_ios/ui-link.svg" alt="" /> URL
                </button>
              </div>
            </Show>

            {/* Private toggle */}
            <label class={styles.toggleRow}>
              <span>Cuenta privada</span>
              <div class={`${styles.iosSwitch} ${profilePrivate() ? styles.iosSwitchOn : ''}`} onClick={(e) => { e.preventDefault(); setProfilePrivate(!profilePrivate()); }}>
                <div class={styles.iosSwitchThumb} />
              </div>
            </label>

            <button class={styles.profileSaveBtn} onClick={() => void saveProfile()}>Guardar</button>
          </div>
        </div>
      </Show>

      {/* ── Delete confirm ── */}
      <Modal open={deleteClipId() !== null} title="Eliminar clip" onClose={() => setDeleteClipId(null)} size="sm">
        <p style={{ margin: '0', 'font-size': '13px', color: 'var(--text-2)' }}>Esta accion no se puede deshacer.</p>
        <ModalActions>
          <ModalButton label="Cancelar" onClick={() => setDeleteClipId(null)} />
          <ModalButton label="Eliminar" tone="danger" onClick={() => void confirmDeleteClip()} />
        </ModalActions>
      </Modal>

      {/* ── Onboarding ── */}
      <SocialOnboardingModal
        open={showOnboarding()}
        appName="Clips"
        usernameHint={myAccount()?.username || ''}
        displayNameHint={myAccount()?.display_name || ''}
        avatarHint={myAccount()?.avatar || ''}
        bioHint={myAccount()?.bio || ''}
        isPrivateHint={myAccount()?.is_private === 1 || myAccount()?.is_private === true}
        usernameReadOnly
        displayNameReadOnly
        onCreate={createClipsAccount}
        onClose={() => { onboardingDismissed = true; setShowOnboarding(false); }}
      />

      <MediaLightbox url={viewerUrl()} onClose={() => setViewerUrl(null)} />
    </div>
  );
}
