import { For, Show, createEffect, createMemo, createSignal } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchNui } from '../../../utils/fetchNui';
import { timeAgo } from '../../../utils/misc';
import { sanitizeMediaUrl, sanitizeText } from '../../../utils/sanitize';
import { AppScaffold } from '../../shared/layout';
import { useAppCache } from '../../../hooks';
import { usePhoneKeyHandler } from '../../../hooks/usePhoneKeyHandler';
import { MediaLightbox } from '../../shared/ui/MediaLightbox';
import { MediaAttachmentPreview } from '../../shared/ui/MediaAttachmentPreview';
import { MediaActionButtons } from '../../shared/ui/MediaActionButtons';
import { FormField, FormTextarea, Modal, ModalActions, ModalButton } from '../../shared/ui/Modal';
import { EmojiPickerButton } from '../../shared/ui/EmojiPicker';
import { SocialOnboardingModal, type SocialOnboardingPayload } from '../../shared/ui/SocialOnboardingModal';
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

export function ClipsApp() {
  const router = useRouter();
  const cache = useAppCache('clips');

  // Data
  const [clips, setClips] = createSignal<Clip[]>([]);
  const [currentClipIndex, setCurrentClipIndex] = createSignal(0);
  const [comments, setComments] = createSignal<Comment[]>([]);
  const [showComments, setShowComments] = createSignal(false);
  const [myAccount, setMyAccount] = createSignal<SharedSnapAccount | null>(null);

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
  const [showOnboarding, setShowOnboarding] = createSignal(false);
  const [showProfileModal, setShowProfileModal] = createSignal(false);
  const [profileDisplayName, setProfileDisplayName] = createSignal('');
  const [profileAvatar, setProfileAvatar] = createSignal('');
  const [profileBio, setProfileBio] = createSignal('');
  const [profilePrivate, setProfilePrivate] = createSignal(false);

  // Upload
  const [showUpload, setShowUpload] = createSignal(false);
  const [uploadMedia, setUploadMedia] = createSignal('');
  const [uploadCaption, setUploadCaption] = createSignal('');

  // Chat
  const [commentText, setCommentText] = createSignal('');

  const clipById = createMemo(() => {
    const map = new Map<number, Clip>();
    for (const clip of clips()) {
      map.set(clip.id, clip);
    }
    return map;
  });

  const currentClip = createMemo(() => {
    const index = currentClipIndex();
    const list = clips();
    return list[index] || null;
  });

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
    
    const account = await fetchNui<SharedSnapAccount | null>('snapGetAccount', {});
    setMyAccount(account);
    setShowOnboarding(!account?.username);
    
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
      if (showComments()) {
        setShowComments(false);
        return;
      }
      router.goBack();
    },
  });

  const toggleLike = async (clipId: number) => {
    const result = await fetchNui<{ liked?: boolean }>('clipsToggleLike', { postId: clipId });
    if (result?.liked !== undefined) {
      setClips((prev) => prev.map((c) => {
        if (c.id !== clipId) return c;
        if (c.liked === result.liked) return c;

        const likes = Math.max(0, (c.likes || 0) + (result.liked ? 1 : -1));
        return { ...c, liked: result.liked, likes };
      }));
    }
  };

  const handleDoubleTap = (clipId: number) => {
    setLikeAnimation(clipId);
    setTimeout(() => setLikeAnimation(null), 1000);
    
    const clip = clipById().get(clipId);
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

    const result = await fetchNui<{ success?: boolean; comment?: Comment }>('clipsAddComment', {
      clipId: clip.id,
      content,
    });

    if (result?.success && result.comment) {
      setCommentText('');
      setComments((prev) => [...prev, result.comment!]);
      setClips((prev) => prev.map((c) => (
        c.id === clip.id ? { ...c, comments_count: (c.comments_count || 0) + 1 } : c
      )));
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

  const openProfileEditor = async () => {
    const account = await fetchNui<SharedSnapAccount | null>('snapGetAccount', {});
    if (!account?.username) {
      setShowOnboarding(true);
      return;
    }
    if (!account) return;
    setProfileDisplayName(account.display_name || '');
    setProfileAvatar(account.avatar || '');
    setProfileBio(account.bio || '');
    setProfilePrivate(!!account.is_private);
    setShowProfileModal(true);
  };

  const saveProfile = async () => {
    const ok = await fetchNui<{ success?: boolean }>('snapUpdateAccount', {
      displayName: sanitizeText(profileDisplayName(), 50),
      avatar: sanitizeMediaUrl(profileAvatar()) || undefined,
      bio: sanitizeText(profileBio(), 180) || undefined,
      isPrivate: profilePrivate(),
    });

    if (ok?.success) {
      setStatusMessage('Perfil actualizado');
      setShowProfileModal(false);
      await loadClips();
    }
  };

  const attachAvatarFromGallery = async () => {
    const gallery = await fetchNui<any[]>('getGallery', undefined, []);
    const image = gallery?.find((item: any) => item?.url && !item.url.match(/\.(mp4|webm|mov)$/i));
    if (image?.url) {
      setProfileAvatar(sanitizeMediaUrl(image.url) || '');
      setStatusMessage('Avatar listo para guardar');
      setShowProfileModal(true);
    } else {
      setStatusMessage('No se encontraron imagenes en la galeria.');
    }
  };

  const openAvatarCamera = () => {
    router.navigate('camera', { target: 'clips-avatar' });
  };

  const createSnapAccount = async (payload: SocialOnboardingPayload) => {
    const avatar = sanitizeMediaUrl(payload.avatar) || '';
    const bio = sanitizeText(payload.bio, 180);

    const response = await fetchNui<{ success?: boolean; error?: string }>('snapCreateAccount', {
      username: payload.username,
      displayName: payload.displayName,
      avatar,
    }, { success: false });

    if (!response?.success) {
      return { ok: false, error: response?.error || 'No se pudo crear la cuenta de Snap.' };
    }

    const updated = await fetchNui<{ success?: boolean }>('snapUpdateAccount', {
      displayName: payload.displayName,
      avatar,
      bio,
      isPrivate: payload.isPrivate,
    }, { success: false });

    if (!updated?.success) {
      return { ok: false, error: 'Cuenta creada, pero no se pudieron guardar todos los datos del perfil.' };
    }

    setShowOnboarding(false);
    setStatusMessage('Cuenta creada');
    await loadClips();
    return { ok: true };
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
    const maxIndex = Math.max(0, clips().length - 1);
    const newIndex = Math.max(0, Math.min(maxIndex, Math.round(scrollTop / clipHeight)));
    setCurrentClipIndex(newIndex);
  };

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
          <button class={styles.profileBtn} onClick={() => void openProfileEditor()}>
            Perfil
          </button>
        </div>

        <SocialOnboardingModal
          open={showOnboarding()}
          appName="Snap/Clips"
          usernameHint={myAccount()?.username || ''}
          displayNameHint={myAccount()?.display_name || ''}
          avatarHint={myAccount()?.avatar || ''}
          bioHint={myAccount()?.bio || ''}
          isPrivateHint={myAccount()?.is_private === 1 || myAccount()?.is_private === true}
          onCreate={createSnapAccount}
          onClose={() => setShowOnboarding(false)}
        />

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
                      <div class={styles.sideActions}>
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
                  <p>¡Se el primero en comentar!</p>
                </div>
              </Show>
            </div>
            
            <div class={styles.commentInput}>
              <EmojiPickerButton value={commentText()} onChange={setCommentText} maxLength={500} />
              <input
                type="text"
                placeholder="Escribe un comentario..."
                value={commentText()}
                onInput={(e) => setCommentText(sanitizeText(e.currentTarget.value, 500))}
                onKeyDown={(e) => e.key === 'Enter' && addComment()}
              />
              <button onClick={addComment} disabled={!commentText().trim()}>
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
          open={showProfileModal()}
          title="Editar perfil"
          onClose={() => setShowProfileModal(false)}
          size="md"
        >
          <Show when={profileAvatar()}>
            <MediaAttachmentPreview url={profileAvatar()} removable onRemove={() => setProfileAvatar('')} />
          </Show>
          <MediaActionButtons
            actions={[
              { icon: '📷', label: 'Camara', onClick: openAvatarCamera },
              { icon: '🖼', label: 'Galeria', onClick: () => void attachAvatarFromGallery() },
              ...(profileAvatar() ? [{ icon: '✕', label: 'Quitar', onClick: () => setProfileAvatar(''), tone: 'danger' as const }] : []),
            ]}
            variant="compact"
          />
          <FormField label="Nombre visible" value={profileDisplayName()} onChange={setProfileDisplayName} placeholder="Tu nombre" />
          <FormField label="Avatar (URL opcional)" type="url" value={profileAvatar()} onChange={setProfileAvatar} placeholder="https://..." />
          <FormTextarea label="Bio" value={profileBio()} onChange={setProfileBio} rows={3} placeholder="Cuenta algo sobre vos" />
          <label class={styles.profileToggle}>
            <input type="checkbox" checked={profilePrivate()} onChange={(e) => setProfilePrivate(e.currentTarget.checked)} />
            <span>Cuenta privada</span>
          </label>
          <ModalActions>
            <ModalButton label="Cancelar" onClick={() => setShowProfileModal(false)} />
            <ModalButton label="Guardar" tone="primary" onClick={() => void saveProfile()} />
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
