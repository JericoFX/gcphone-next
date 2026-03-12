import { For, Show, createEffect, createMemo, createSignal, onMount } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchNui } from '../../../utils/fetchNui';
import { uiAlert } from '../../../utils/uiAlert';
import { AppFAB, AppScaffold } from '../../shared/layout';
import { useAppCache } from '../../../hooks';
import { usePhoneKeyHandler } from '../../../hooks/usePhoneKeyHandler';
import { MediaLightbox } from '../../shared/ui/MediaLightbox';
import { VirtualList } from '../../shared/ui/VirtualList';
import { EmptyState } from '../../shared/ui/EmptyState';
import { SearchInput } from '../../shared/ui/SearchInput';
import { SegmentedTabs } from '../../shared/ui/SegmentedTabs';
import { SheetIntro } from '../../shared/ui/SheetIntro';
import { FormCheckbox, FormField, FormSection, Modal, ModalActions, ModalButton } from '../../shared/ui/Modal';
import { getStoredLanguage, t } from '../../../i18n';
import styles from './DarkRoomsApp.module.scss';

interface Room {
  id: number;
  slug: string;
  name: string;
  description?: string;
  icon?: string;
  members?: number;
  posts?: number;
  has_password?: number | boolean;
  is_member?: number | boolean;
}

interface Post {
  id: number;
  room_id: number;
  author_name: string;
  title: string;
  content: string;
  media_url?: string;
  score: number;
  comments_count: number;
  created_at: string;
  my_vote?: number;
}

interface Comment {
  id: number;
  post_id: number;
  author_name: string;
  content: string;
  media_url?: string;
  created_at: string;
}

type ViewMode = 'rooms' | 'room' | 'post';
type SortMode = 'alphabetical' | 'activity';

const roomTag = (room: Pick<Room, 'slug' | 'name'>) => {
  const base = (room.slug || room.name || 'sala').replace(/^#/, '').trim();
  return `#${base}`;
};

const isVideo = (url?: string) => !!url && /\.(mp4|webm|mov|m3u8)(\?|$)/i.test(url);
const isAudio = (url?: string) => !!url && /\.(mp3|ogg|wav|m4a|aac)(\?|$)/i.test(url);

const ROOM_ICON_PRESETS = ['🌙', '💀', '👁️', '🕯️', '🧿', '🩸', '🕸️', '🔮', '☠️', '🔥', '⚡', '🦇'];

function MediaBlock(props: { url?: string; compact?: boolean; onOpen?: (url: string) => void }) {
  if (!props.url) return null;
  if (isVideo(props.url)) {
    return <video class={props.compact ? styles.compactMedia : styles.media} src={props.url} controls playsinline preload="metadata" />;
  }
  if (isAudio(props.url)) {
    return <audio class={styles.audio} src={props.url} controls preload="metadata" />;
  }
  return <img class={props.compact ? styles.compactMedia : styles.media} src={props.url} alt="adjunto" loading="lazy" onClick={() => props.onOpen?.(props.url!)} />;
}

export function DarkRoomsApp() {
  const router = useRouter();
  const language = () => getStoredLanguage();
  const cache = useAppCache('darkrooms');

  // View state
  const [currentView, setCurrentView] = createSignal<ViewMode>('rooms');
  
  // Data
  const [rooms, setRooms] = createSignal<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = createSignal<Room | null>(null);
  const [posts, setPosts] = createSignal<Post[]>([]);
  const [selectedPost, setSelectedPost] = createSignal<Post | null>(null);
  const [comments, setComments] = createSignal<Comment[]>([]);

  // UI State
  const [searchQuery, setSearchQuery] = createSignal('');
  const [sortMode, setSortMode] = createSignal<SortMode>('alphabetical');
  const [loading, setLoading] = createSignal(false);
  const [fabTooltipVisible, setFabTooltipVisible] = createSignal(false);

  // Create Room
  const [showCreateRoom, setShowCreateRoom] = createSignal(false);
  const [roomName, setRoomName] = createSignal('');
  const [roomSlug, setRoomSlug] = createSignal('');
  const [roomDescription, setRoomDescription] = createSignal('');
  const [roomIcon, setRoomIcon] = createSignal('🌙');
  const [roomPassword, setRoomPassword] = createSignal('');
  const [isPrivateRoom, setIsPrivateRoom] = createSignal(false);

  // Join Protected Room
  const [joinPasswordMode, setJoinPasswordMode] = createSignal<Room | null>(null);
  const [joinPassword, setJoinPassword] = createSignal('');

  // Create Post
  const [showCreatePost, setShowCreatePost] = createSignal(false);
  const [postTitle, setPostTitle] = createSignal('');
  const [postContent, setPostContent] = createSignal('');
  const [postMediaUrl, setPostMediaUrl] = createSignal('');
  const [postAnonymous, setPostAnonymous] = createSignal(true);

  // Create Comment
  const [commentText, setCommentText] = createSignal('');
  const [commentMediaUrl, setCommentMediaUrl] = createSignal('');
  const [commentAnonymous, setCommentAnonymous] = createSignal(true);

  // Viewer
  const [viewerUrl, setViewerUrl] = createSignal<string | null>(null);
  const sortOptions = [
    { id: 'alphabetical', label: 'A-Z' },
    { id: 'activity', label: 'Actividad' },
  ];

  // FAB Tooltip timeout
  let fabTimeout: number;

  const showFabTooltip = () => {
    setFabTooltipVisible(true);
    fabTimeout = window.setTimeout(() => {
      setFabTooltipVisible(false);
    }, 2000);
  };

  const hideFabTooltip = () => {
    setFabTooltipVisible(false);
    if (fabTimeout) clearTimeout(fabTimeout);
  };

  // Sort rooms
  const sortRooms = (roomList: Room[]) => {
    const mode = sortMode();
    const sorted = [...roomList];
    
    if (mode === 'alphabetical') {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      // Activity: sort by posts count (most active first)
      sorted.sort((a, b) => (b.posts || 0) - (a.posts || 0));
    }
    
    return sorted;
  };

  const filteredRooms = createMemo(() => {
    const query = searchQuery().toLowerCase().trim();
    const allRooms = rooms();

    if (!query) {
      return sortRooms(allRooms);
    }

    const filtered = allRooms.filter((room) =>
      room.name.toLowerCase().includes(query)
      || room.slug.toLowerCase().includes(query)
      || (room.description && room.description.toLowerCase().includes(query)),
    );

    return sortRooms(filtered);
  });

  // Auto-generate slug from name
  createEffect(() => {
    const name = roomName();
    if (name && !roomSlug()) {
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      setRoomSlug(slug);
    }
  });

  const loadRooms = async () => {
    const cached = cache.get<Room[]>('rooms');
    const next = cached ?? await fetchNui<Room[]>('darkroomsGetRooms', {}, []);
    const normalized = Array.isArray(next) ? next : [];
    if (!cached) cache.set('rooms', normalized, 15000);
    setRooms(normalized);
  };

  const requestJoinRoom = async (room: Room, password = '') => {
    const payload = await fetchNui<{ success?: boolean; error?: string }>('darkroomsJoinRoom', { roomId: room.id, password }, { success: false });
    return payload || { success: false, error: 'JOIN_FAILED' };
  };

  const enterRoom = async (room: Room) => {
    const hasPassword = room.has_password === true || Number(room.has_password || 0) === 1;
    const alreadyMember = room.is_member === true || Number(room.is_member || 0) === 1;

    if (hasPassword && !alreadyMember) {
      setJoinPasswordMode(room);
      setJoinPassword('');
      return;
    }

    setSelectedRoom(room);
    setCurrentView('room');
    
    const cacheKey = `room:${room.id}:posts`;
    const cached = cache.get<Post[]>(cacheKey);
    const roomPosts = cached ?? await fetchNui<Post[]>('darkroomsGetPosts', { roomId: room.id, sort: 'new', limit: 50, offset: 0 }, []);
    const normalizedPosts = Array.isArray(roomPosts) ? roomPosts : [];
    if (!cached) cache.set(cacheKey, normalizedPosts, 12000);
    setPosts(normalizedPosts);
  };

  const confirmJoinProtectedRoom = async () => {
    const room = joinPasswordMode();
    if (!room) return;

    const payload = await requestJoinRoom(room, joinPassword().trim());
    if (!payload.success) {
      uiAlert(payload.error === 'INVALID_PASSWORD' ? 'Clave incorrecta.' : 'No se pudo entrar a la sala.');
      return;
    }

    setJoinPasswordMode(null);
    setJoinPassword('');
    await loadRooms();

    const roomAfter = rooms().find((item) => item.id === room.id) || room;
    await enterRoom({ ...roomAfter, is_member: 1 });
  };

  const openPost = async (post: Post) => {
    setSelectedPost(post);
    setCurrentView('post');
    
    const cacheKey = `post:${post.id}:comments`;
    const cached = cache.get<Comment[]>(cacheKey);
    const next = cached ?? await fetchNui<Comment[]>('darkroomsGetComments', { postId: post.id }, []);
    const normalizedComments = Array.isArray(next) ? next : [];
    if (!cached) cache.set(cacheKey, normalizedComments, 10000);
    setComments(normalizedComments);
  };

  const backToRooms = () => {
    setCurrentView('rooms');
    setSelectedRoom(null);
    setPosts([]);
  };

  const backToRoom = () => {
    setCurrentView('room');
    setSelectedPost(null);
    setComments([]);
  };

  const createRoom = async () => {
    if (!roomName().trim()) {
      uiAlert('El nombre de la sala es obligatorio');
      return;
    }

    const icon = ROOM_ICON_PRESETS.includes(roomIcon()) ? roomIcon() : ROOM_ICON_PRESETS[0];

    const payload = await fetchNui<{ success?: boolean; error?: string }>('darkroomsCreateRoom', {
      name: roomName().trim(),
      slug: roomSlug().trim() || roomName().toLowerCase().replace(/\s+/g, '-'),
      description: roomDescription().trim(),
      icon,
      password: isPrivateRoom() ? roomPassword().trim() : '',
    }, { success: false });

    if (!payload?.success) {
      uiAlert(`Crear sala fallo: ${payload?.error || 'ERROR'}`);
      return;
    }

    setShowCreateRoom(false);
    setRoomName('');
    setRoomSlug('');
    setRoomDescription('');
    setRoomIcon('🌙');
    setRoomPassword('');
    setIsPrivateRoom(false);
    
    cache.invalidate();
    await loadRooms();
  };

  const createPost = async () => {
    const room = selectedRoom();
    if (!room || !postTitle().trim()) {
      uiAlert('El titulo es obligatorio');
      return;
    }

    setLoading(true);
    const payload = await fetchNui<{ success?: boolean; error?: string }>('darkroomsCreatePost', {
      roomId: room.id,
      title: postTitle().trim(),
      content: postContent().trim(),
      mediaUrl: postMediaUrl().trim(),
      anonymous: postAnonymous(),
    }, { success: false });
    setLoading(false);

    if (!payload?.success) {
      uiAlert(`${t('news.post', language())} fallo: ${payload?.error || 'ERROR'}`);
      return;
    }

    setShowCreatePost(false);
    setPostTitle('');
    setPostContent('');
    setPostMediaUrl('');
    cache.invalidate(`room:${room.id}:posts`);
    await enterRoom(room);
  };

  const votePost = async (postId: number, vote: 1 | -1) => {
    const result = await fetchNui<{ success?: boolean; score?: number; myVote?: number }>('darkroomsVotePost', { postId, vote }, { success: false });
    if (!result?.success) return;

    setPosts((prev) => prev.map((post) => (post.id === postId ? { ...post, score: result.score ?? post.score, my_vote: result.myVote ?? 0 } : post)));
    setSelectedPost((prev) => (prev && prev.id === postId ? { ...prev, score: result.score ?? prev.score, my_vote: result.myVote ?? 0 } : prev));
  };

  const createComment = async () => {
    const post = selectedPost();
    if (!post || !commentText().trim()) {
      uiAlert(t('darkrooms.comment_empty', language()));
      return;
    }

    const payload = await fetchNui<{ success?: boolean; error?: string }>('darkroomsCreateComment', {
      postId: post.id,
      content: commentText().trim(),
      mediaUrl: commentMediaUrl().trim(),
      anonymous: commentAnonymous(),
    }, { success: false });

    if (!payload?.success) {
      uiAlert(`${t('chirp.comment', language())} fallo: ${payload?.error || 'ERROR'}`);
      return;
    }

    setCommentText('');
    setCommentMediaUrl('');
    cache.invalidate(`post:${post.id}:comments`);
    const room = selectedRoom();
    if (room) cache.invalidate(`room:${room.id}:posts`);
    await openPost(post);
  };

  usePhoneKeyHandler({
    Backspace: () => {
      if (currentView() === 'post') {
        backToRoom();
        return;
      }
      if (currentView() === 'room') {
        backToRooms();
        return;
      }
      router.goBack();
    },
  });

  onMount(() => {
    void loadRooms();
  });

  // Render Room List View
  const RoomsListView = () => (
    <div class={styles.roomsView}>
      <div class={styles.roomsHeader}>
        <div class={styles.searchBar}>
          <SearchInput
            value={searchQuery()}
            onInput={setSearchQuery}
            placeholder={t('darkrooms.search', language())}
            class={styles.searchInputRoot}
            inputClass={styles.searchInput}
          />
        </div>
        <div class={styles.sortToggle}>
          <SegmentedTabs items={sortOptions} active={sortMode()} onChange={(id) => setSortMode(id as SortMode)} />
        </div>
      </div>

      <div class={styles.roomsList}>
        <For each={filteredRooms()}>
          {(room) => (
            <button 
              class={styles.roomCard}
              onClick={() => void enterRoom(room)}
            >
              <div class={styles.roomIconWrapper}>
                <span class={styles.roomIcon}>{room.icon || '🌙'}</span>
              </div>
              <div class={styles.roomInfo}>
                <div class={styles.roomNameRow}>
                  <strong class={styles.roomName}>{roomTag(room)}</strong>
                  <Show when={Number(room.has_password || 0) === 1}>
                    <span class={styles.roomLock}>🔒</span>
                  </Show>
                </div>
                <p class={styles.roomDescription}>{room.description || t('yellowpages.no_description', language())}</p>
                <div class={styles.roomStats}>
                  <span>{Number(room.posts || 0)} posts</span>
                  <span class={styles.statDot}>·</span>
                  <span>{Number(room.members || 0)} miembros</span>
                </div>
              </div>
            </button>
          )}
        </For>
        <Show when={filteredRooms().length === 0}>
          <EmptyState class={styles.emptyState} title={t('darkrooms.rooms_not_found', language())} description={t('darkrooms.rooms_not_found_desc', language())} />
        </Show>
      </div>

      {/* FAB */}
      <AppFAB
        class={styles.fab}
        icon="+"
        onClick={() => setShowCreateRoom(true)}
          tooltip={t('darkrooms.create_room', language())}
        tooltipVisible={fabTooltipVisible()}
        onPointerDown={showFabTooltip}
        onPointerUp={hideFabTooltip}
        onPointerLeave={hideFabTooltip}
      />
    </div>
  );

  // Render Room Interior View
  const RoomInteriorView = () => {
    const room = selectedRoom();
    if (!room) return null;

    return (
      <div class={styles.roomInteriorView}>
        <div class={styles.roomInteriorHeader}>
          <button class={styles.backButton} onClick={backToRooms}>
            ← {t('chirp.back', language())}
          </button>
          <div class={styles.roomTitleSection}>
            <span class={styles.roomIconSmall}>{room.icon || '🌙'}</span>
            <span class={styles.roomInteriorTitle}>{roomTag(room)}</span>
          </div>
          <div class={styles.roomInteriorActions}>
            <span class={styles.roomStat}>{posts().length} posts</span>
          </div>
        </div>

        <div class={styles.postsList}>
          <Show when={posts().length === 0}>
            <EmptyState class={styles.emptyState} title={t('darkrooms.no_posts', language())} description={t('darkrooms.no_posts_desc', language())} />
          </Show>
          
          <VirtualList items={posts} itemHeight={180} overscan={3}>
            {(post) => (
              <article class={styles.postCard} onClick={() => openPost(post)}>
                <div class={styles.postVotes}>
                  <button 
                    class={styles.voteButton}
                    classList={{ [styles.votedUp]: post.my_vote === 1 }}
                    onClick={(e) => { e.stopPropagation(); void votePost(post.id, 1); }}
                  >
                    ▲
                  </button>
                  <span class={styles.voteCount}>{post.score}</span>
                  <button 
                    class={styles.voteButton}
                    classList={{ [styles.votedDown]: post.my_vote === -1 }}
                    onClick={(e) => { e.stopPropagation(); void votePost(post.id, -1); }}
                  >
                    ▼
                  </button>
                </div>
                <div class={styles.postContent}>
                  <h3 class={styles.postTitle}>{post.title}</h3>
                  <p class={styles.postExcerpt}>{post.content?.slice(0, 120)}{post.content && post.content.length > 120 ? '...' : ''}</p>
                  <div class={styles.postMeta}>
                    <span>{t('darkrooms.by_author', language(), { name: post.author_name })}</span>
                    <span class={styles.metaDot}>·</span>
                    <span>{post.comments_count} comentarios</span>
                  </div>
                </div>
              </article>
            )}
          </VirtualList>
        </div>

        {/* FAB for creating post */}
        <AppFAB
          class={styles.fab}
          icon="✎"
          onClick={() => setShowCreatePost(true)}
          tooltip={t('darkrooms.post_title', language())}
          tooltipVisible={fabTooltipVisible()}
          onPointerDown={showFabTooltip}
          onPointerUp={hideFabTooltip}
          onPointerLeave={hideFabTooltip}
        />
      </div>
    );
  };

  // Render Post Detail View
  const PostDetailView = () => {
    const post = selectedPost();
    if (!post) return null;

    return (
      <div class={styles.postDetailView}>
        <div class={styles.postDetailHeader}>
          <button class={styles.backButton} onClick={backToRoom}>
            ← {t('chirp.back', language())}
          </button>
          <span class={styles.postDetailTitle}>Post</span>
        </div>

        <div class={styles.postThreadScroll}>
          <div class={styles.postDetailContent}>
            <div class={styles.postDetailVotes}>
              <button 
                class={styles.voteButton}
                classList={{ [styles.votedUp]: post.my_vote === 1 }}
                onClick={() => void votePost(post.id, 1)}
              >
                ▲
              </button>
              <span class={styles.voteCountLarge}>{post.score}</span>
              <button 
                class={styles.voteButton}
                classList={{ [styles.votedDown]: post.my_vote === -1 }}
                onClick={() => void votePost(post.id, -1)}
              >
                ▼
              </button>
            </div>

            <div class={styles.postDetailBody}>
              <h2 class={styles.postDetailHeading}>{post.title}</h2>
              <div class={styles.postDetailMeta}>
                  <span>{t('darkrooms.published_by', language(), { name: post.author_name })}</span>
              </div>
              <p class={styles.postDetailText}>{post.content}</p>
              <MediaBlock url={post.media_url} onOpen={setViewerUrl} />
            </div>
          </div>

          <div class={styles.commentsSection}>
            <div class={styles.commentsSeparator} />
            <h4 class={styles.commentsTitle}>{comments().length} comentarios</h4>

            <div class={styles.commentsList}>
              <For each={comments()}>
                {(comment) => (
                  <div class={styles.commentItem}>
                    <div class={styles.commentHeader}>
                      <strong>{comment.author_name}</strong>
                    </div>
                    <p class={styles.commentText}>{comment.content}</p>
                    <MediaBlock url={comment.media_url} compact onOpen={setViewerUrl} />
                  </div>
                )}
              </For>
            </div>
          </div>
        </div>

        <div class={styles.commentComposer}>
          <textarea
            class={styles.commentInput}
            placeholder={t('chirp.comment_placeholder', language())}
            value={commentText()}
            onInput={(e) => setCommentText(e.currentTarget.value)}
            rows={3}
          />
          <div class={styles.commentActions}>
            <label class={styles.anonymousToggle}>
              <input 
                type="checkbox" 
                checked={commentAnonymous()}
                onChange={(e) => setCommentAnonymous(e.currentTarget.checked)}
              />
              <span>{t('darkrooms.anonymous', language())}</span>
            </label>
            <button 
              class={styles.sendButton}
              onClick={() => void createComment()}
              disabled={!commentText().trim()}
            >
              {t('chirp.comment', language())}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <AppScaffold 
      title="Dark Rooms" 
      subtitle="Comunidades anonimas" 
      onBack={() => router.goBack()} 
      bodyClass={styles.body}
    >
      {/* Main View Router */}
      <Show when={currentView() === 'rooms'} fallback={
        <Show when={currentView() === 'room'} fallback={
          <PostDetailView />
        }>
          <RoomInteriorView />
        </Show>
      }>
        <RoomsListView />
      </Show>

      {/* Create Room Modal */}
      <Modal 
        open={showCreateRoom()} 
        title={t('darkrooms.create_room', language())} 
        onClose={() => setShowCreateRoom(false)}
        size="md"
      >
        <SheetIntro title="Crear sala" description="Define un nombre, un icono y si quieres una clave para acceso privado." />
        <FormField 
          label="Nombre" 
          value={roomName()} 
          onChange={setRoomName} 
          placeholder="Ej: Mercado de pulgas"
        />
        <FormField 
          label="Slug" 
          value={roomSlug()} 
          onChange={setRoomSlug} 
          placeholder="mercado"
        />
        <FormSection class={styles.formField} label="Icono" labelClass={styles.formLabel}>
          <div class={styles.emojiPresetGrid}>
            <For each={ROOM_ICON_PRESETS}>
              {(emoji) => (
                <button
                  class={styles.emojiPreset}
                  classList={{ [styles.emojiPresetActive]: roomIcon() === emoji }}
                  onClick={() => setRoomIcon(emoji)}
                  type="button"
                >
                  {emoji}
                </button>
              )}
            </For>
          </div>
        </FormSection>
        <FormSection class={styles.formField} label="Descripcion" labelClass={styles.formLabel}>
          <textarea
            class={styles.formTextarea}
            value={roomDescription()}
            onInput={(e) => setRoomDescription(e.currentTarget.value)}
            placeholder="De que trata esta sala?"
            rows={3}
          />
        </FormSection>
        
        <FormSection class={styles.checkboxField}>
          <FormCheckbox
            checked={isPrivateRoom()}
            onChange={setIsPrivateRoom}
            label="🔒 Sala privada (requiere clave)"
            labelClass={styles.checkboxLabel}
          />
        </FormSection>
        
        <Show when={isPrivateRoom()}>
          <FormField 
            label="Clave de acceso" 
            value={roomPassword()} 
            onChange={setRoomPassword} 
            placeholder="Minimo 4 caracteres"
            type="text"
          />
        </Show>
        
        <ModalActions>
          <ModalButton label={t('action.cancel', language())} onClick={() => setShowCreateRoom(false)} />
          <ModalButton label="Crear" onClick={() => void createRoom()} tone="primary" />
        </ModalActions>
      </Modal>

      {/* Join Password Modal */}
      <Modal 
        open={!!joinPasswordMode()} 
        title={`Entrar a ${joinPasswordMode()?.name || ''}`} 
        onClose={() => setJoinPasswordMode(null)}
        size="sm"
      >
        <p class={styles.modalDescription}>Esta sala requiere una clave de acceso.</p>
        <FormField 
          label="Clave" 
          value={joinPassword()} 
          onChange={setJoinPassword} 
          placeholder="Ingresa la clave"
          type="text"
        />
        <ModalActions>
          <ModalButton label={t('action.cancel', language())} onClick={() => setJoinPasswordMode(null)} />
          <ModalButton label="Entrar" onClick={() => void confirmJoinProtectedRoom()} tone="primary" />
        </ModalActions>
      </Modal>

      {/* Create Post Modal */}
      <Modal 
        open={showCreatePost()} 
        title={`${t('news.post', language())} ${roomTag(selectedRoom() || { slug: '', name: '' })}`}
        onClose={() => setShowCreatePost(false)}
        size="lg"
      >
        <SheetIntro title="Nuevo post" description="Comparte contexto, evidencia o una pregunta clara para la comunidad." />
        <FormField 
          label="Titulo" 
          value={postTitle()} 
          onChange={setPostTitle} 
          placeholder="Titulo descriptivo"
        />
        <FormSection class={styles.formField} label="Contenido" labelClass={styles.formLabel}>
          <textarea
            class={styles.formTextarea}
            value={postContent()}
            onInput={(e) => setPostContent(e.currentTarget.value)}
            placeholder="Cuenta contexto, evidencia o propuesta"
            rows={4}
          />
        </FormSection>
        <FormField 
          label="URL de imagen/video (opcional)" 
          value={postMediaUrl()} 
          onChange={setPostMediaUrl} 
          placeholder="https://..."
          type="url"
        />
        
        <FormSection class={styles.checkboxField}>
          <FormCheckbox
            checked={postAnonymous()}
            onChange={setPostAnonymous}
            label={t('darkrooms.publish_anonymously', language())}
            labelClass={styles.checkboxLabel}
          />
        </FormSection>
        
        <ModalActions>
          <ModalButton label={t('action.cancel', language())} onClick={() => setShowCreatePost(false)} />
          <ModalButton 
            label={loading() ? t('chirp.publishing', language()) : t('news.post', language())} 
            onClick={() => void createPost()} 
            tone="primary" 
            disabled={loading() || !postTitle().trim()}
          />
        </ModalActions>
      </Modal>

      <MediaLightbox url={viewerUrl()} onClose={() => setViewerUrl(null)} />
    </AppScaffold>
  );
}
