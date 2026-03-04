import { For, Show, createEffect, createSelector, createSignal, onCleanup, onMount } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchNui } from '../../../utils/fetchNui';
import { AppScaffold } from '../../shared/layout';
import { useAppCache } from '../../../hooks';
import { MediaLightbox } from '../../shared/ui/MediaLightbox';
import { VirtualList } from '../../shared/ui/VirtualList';
import { Modal, ModalActions, ModalButton, FormField } from '../../shared/ui/Modal';
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

const roomTag = (room: Pick<Room, 'slug' | 'name'>) => {
  const base = (room.slug || room.name || 'sala').replace(/^#/, '').trim();
  return `#${base}`;
};

const isVideo = (url?: string) => !!url && /\.(mp4|webm|mov|m3u8)(\?|$)/i.test(url);
const isAudio = (url?: string) => !!url && /\.(mp3|ogg|wav|m4a|aac)(\?|$)/i.test(url);

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

  const [rooms, setRooms] = createSignal<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = createSignal<Room | null>(null);
  const [posts, setPosts] = createSignal<Post[]>([]);
  const [selectedPost, setSelectedPost] = createSignal<Post | null>(null);
  const [comments, setComments] = createSignal<Comment[]>([]);

  const [loading, setLoading] = createSignal(false);

  const [title, setTitle] = createSignal('');
  const [content, setContent] = createSignal('');
  const [postMediaUrl, setPostMediaUrl] = createSignal('');
  const [postAnonymous, setPostAnonymous] = createSignal(true);

  const [commentText, setCommentText] = createSignal('');
  const [commentMediaUrl, setCommentMediaUrl] = createSignal('');
  const [commentAnonymous, setCommentAnonymous] = createSignal(true);

  const [showCreateRoom, setShowCreateRoom] = createSignal(false);
  const [roomName, setRoomName] = createSignal('');
  const [roomSlug, setRoomSlug] = createSignal('');
  const [roomDescription, setRoomDescription] = createSignal('');
  const [roomIcon, setRoomIcon] = createSignal('🌙');
  const [roomPassword, setRoomPassword] = createSignal('');

  const [joinPasswordMode, setJoinPasswordMode] = createSignal<Room | null>(null);
  const [joinPassword, setJoinPassword] = createSignal('');
  const [viewerUrl, setViewerUrl] = createSignal<string | null>(null);

  const [status, setStatus] = createSignal('Tablones anonimos estilo comunidad. No es chat en vivo.');
  const cache = useAppCache('darkrooms');
  const isSelectedRoomId = createSelector(() => selectedRoom()?.id ?? -1);

  const normalizeRoomPayload = (value: Room[]) => (Array.isArray(value) ? value : []);

  const loadRooms = async () => {
    const cached = cache.get<Room[]>('rooms');
    const next = cached ?? await fetchNui<Room[]>('darkroomsGetRooms', {}, []);
    const normalized = normalizeRoomPayload(next || []);
    if (!cached) cache.set('rooms', normalized, 15000);
    setRooms(normalized);

    if (!selectedRoom() && normalized.length > 0) {
      await openRoom(normalized[0]);
    }
  };

  const requestJoinRoom = async (room: Room, password = '') => {
    const payload = await fetchNui<{ success?: boolean; error?: string }>('darkroomsJoinRoom', { roomId: room.id, password }, { success: false });
    return payload || { success: false, error: 'JOIN_FAILED' };
  };

  const openRoom = async (room: Room) => {
    const hasPassword = room.has_password === true || Number(room.has_password || 0) === 1;
    const alreadyMember = room.is_member === true || Number(room.is_member || 0) === 1;

    if (hasPassword && !alreadyMember) {
      setJoinPasswordMode(room);
      setJoinPassword('');
      setStatus(`La sala ${room.name} requiere clave.`);
      return;
    }

    setSelectedRoom(room);
    setSelectedPost(null);
    setComments([]);

    const cacheKey = `room:${room.id}:posts`;
    const cached = cache.get<Post[]>(cacheKey);
    const roomPosts = cached ?? await fetchNui<Post[]>('darkroomsGetPosts', { roomId: room.id, sort: 'new', limit: 50, offset: 0 }, []);
    const normalizedPosts = Array.isArray(roomPosts) ? roomPosts : [];
    if (!cached) cache.set(cacheKey, normalizedPosts, 12000);
    setPosts(normalizedPosts);
    setStatus(`${roomTag(room)} · ${room.description || 'Sala activa'}`);
  };

  const confirmJoinProtectedRoom = async () => {
    const room = joinPasswordMode();
    if (!room) return;

    const payload = await requestJoinRoom(room, joinPassword().trim());
    if (!payload.success) {
      setStatus(payload.error === 'INVALID_PASSWORD' ? 'Clave incorrecta.' : 'No se pudo entrar a la sala.');
      return;
    }

    setJoinPasswordMode(null);
    setJoinPassword('');
    await loadRooms();

    const roomAfter = rooms().find((item) => item.id === room.id) || room;
    await openRoom({ ...roomAfter, is_member: 1 });
  };

  const openPost = async (post: Post) => {
    setSelectedPost(post);
    const cacheKey = `post:${post.id}:comments`;
    const cached = cache.get<Comment[]>(cacheKey);
    const next = cached ?? await fetchNui<Comment[]>('darkroomsGetComments', { postId: post.id }, []);
    const normalizedComments = Array.isArray(next) ? next : [];
    if (!cached) cache.set(cacheKey, normalizedComments, 10000);
    setComments(normalizedComments);
  };

  const createRoom = async () => {
    const payload = await fetchNui<{ success?: boolean; error?: string }>('darkroomsCreateRoom', {
      name: roomName().trim(),
      slug: roomSlug().trim(),
      description: roomDescription().trim(),
      icon: roomIcon().trim(),
      password: roomPassword().trim(),
    }, { success: false });

    if (!payload?.success) {
      setStatus(`Crear sala fallo: ${payload?.error || 'ERROR'}`);
      return;
    }

    setShowCreateRoom(false);
    setRoomName('');
    setRoomSlug('');
    setRoomDescription('');
    setRoomIcon('🌙');
    setRoomPassword('');
    setStatus('Sala creada con exito.');
    cache.invalidate();
    await loadRooms();
  };

  const pickPostAttachment = async () => {
    const gallery = await fetchNui<Array<{ url?: string }>>('getGallery', undefined, []);
    const media = gallery?.find((item) => typeof item.url === 'string' && item.url.startsWith('http'));
    if (media?.url) setPostMediaUrl(media.url);
  };

  const pickCommentAttachment = async () => {
    const gallery = await fetchNui<Array<{ url?: string }>>('getGallery', undefined, []);
    const media = gallery?.find((item) => typeof item.url === 'string' && item.url.startsWith('http'));
    if (media?.url) setCommentMediaUrl(media.url);
  };

  const createPost = async () => {
    const room = selectedRoom();
    if (!room || !title().trim() || (!content().trim() && !postMediaUrl().trim())) return;

    setLoading(true);
    const payload = await fetchNui<{ success?: boolean; error?: string }>('darkroomsCreatePost', {
      roomId: room.id,
      title: title().trim(),
      content: content().trim(),
      mediaUrl: postMediaUrl().trim(),
      anonymous: postAnonymous(),
    }, { success: false });
    setLoading(false);

    if (!payload?.success) {
      setStatus(`Publicar fallo: ${payload?.error || 'ERROR'}`);
      return;
    }

    setTitle('');
    setContent('');
    setPostMediaUrl('');
    cache.invalidate(`room:${room.id}:posts`);
    await openRoom(room);
  };

  const votePost = async (postId: number, vote: 1 | -1) => {
    const result = await fetchNui<{ success?: boolean; score?: number; myVote?: number }>('darkroomsVotePost', { postId, vote }, { success: false });
    if (!result?.success) return;

    setPosts((prev) => prev.map((post) => (post.id === postId ? { ...post, score: result.score ?? post.score, my_vote: result.myVote ?? 0 } : post)));
    setSelectedPost((prev) => (prev && prev.id === postId ? { ...prev, score: result.score ?? prev.score, my_vote: result.myVote ?? 0 } : prev));
  };

  const createComment = async () => {
    const post = selectedPost();
    if (!post || (!commentText().trim() && !commentMediaUrl().trim())) return;

    const payload = await fetchNui<{ success?: boolean; error?: string }>('darkroomsCreateComment', {
      postId: post.id,
      content: commentText().trim(),
      mediaUrl: commentMediaUrl().trim(),
      anonymous: commentAnonymous(),
    }, { success: false });

    if (!payload?.success) {
      setStatus(`Comentar fallo: ${payload?.error || 'ERROR'}`);
      return;
    }

    setCommentText('');
    setCommentMediaUrl('');
    cache.invalidate(`post:${post.id}:comments`);
    const room = selectedRoom();
    if (room) cache.invalidate(`room:${room.id}:posts`);
    await openPost(post);
    if (room) await openRoom(room);
  };

  createEffect(() => {
    const onKey = (e: CustomEvent<string>) => {
      if (e.detail !== 'Backspace') return;
      if (joinPasswordMode()) {
        setJoinPasswordMode(null);
        return;
      }
      if (selectedPost()) {
        setSelectedPost(null);
        return;
      }
      router.goBack();
    };

    window.addEventListener('phone:keyUp', onKey as EventListener);
    onCleanup(() => window.removeEventListener('phone:keyUp', onKey as EventListener));
  });

  onMount(() => {
    void loadRooms();
  });

  return (
    <AppScaffold title="Dark Rooms" subtitle="Comunidades con posts y votos" onBack={() => router.goBack()} bodyClass={styles.body}>
      <div class={styles.statusBar}>{status()}</div>

      <div class={styles.roomsList}>
        <For each={rooms()}>
          {(room) => (
            <button 
              class={styles.roomItem} 
              classList={{ [styles.roomItemActive]: isSelectedRoomId(room.id) }} 
              onClick={() => void openRoom(room)}
            >
              <div class={styles.roomIcon}>{room.icon || '🌙'}</div>
              <div class={styles.roomInfo}>
                <div class={styles.roomHeader}>
                  <strong class={styles.roomName}>{roomTag(room)}</strong>
                  <Show when={Number(room.has_password || 0) === 1}>
                    <span class={styles.roomLock}>🔒</span>
                  </Show>
                </div>
                <div class={styles.roomMeta}>
                  <span>{Number(room.posts || 0)} posts</span>
                  <span class={styles.roomMetaDot}>·</span>
                  <span>{Number(room.members || 0)} miembros</span>
                </div>
              </div>
            </button>
          )}
        </For>
        <button class={styles.newRoomBtn} onClick={() => setShowCreateRoom(true)}>
          <span class={styles.newRoomIcon}>+</span>
          <span>Crear sala</span>
        </button>
      </div>

      <Modal 
        open={showCreateRoom()} 
        title="Crear Sala" 
        onClose={() => setShowCreateRoom(false)}
        size="md"
      >
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
          placeholder="mercado (sin espacios)"
        />
        <FormField 
          label="Icono" 
          value={roomIcon()} 
          onChange={setRoomIcon} 
          placeholder="🌙"
        />
        <div class={styles.formField}>
          <label class={styles.formLabel}>Descripcion</label>
          <textarea
            class={styles.formTextarea}
            value={roomDescription()}
            onInput={(e) => setRoomDescription(e.currentTarget.value)}
            placeholder="De que trata esta sala?"
            rows={3}
          />
        </div>
        <FormField 
          label="Clave de acceso (opcional)" 
          value={roomPassword()} 
          onChange={setRoomPassword} 
          placeholder="Dejar vacio para sala publica"
          type="password"
        />
        <ModalActions>
          <ModalButton label="Cancelar" onClick={() => setShowCreateRoom(false)} />
          <ModalButton label="Crear" onClick={() => void createRoom()} tone="primary" />
        </ModalActions>
      </Modal>

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
          type="password"
        />
        <ModalActions>
          <ModalButton label="Cancelar" onClick={() => setJoinPasswordMode(null)} />
          <ModalButton label="Entrar" onClick={() => void confirmJoinProtectedRoom()} tone="primary" />
        </ModalActions>
      </Modal>

      <Show when={!selectedPost()} fallback={
        <div class={styles.commentsView}>
          <div class={styles.commentsTop}>
            <button onClick={() => setSelectedPost(null)}>‹ Volver</button>
            <strong>{selectedPost()?.title}</strong>
          </div>
          <div class={styles.commentsList}>
            <VirtualList items={comments} itemHeight={126} overscan={3}>
              {(comment) => (
                <article class={styles.commentCard}>
                  <strong>{comment.author_name}</strong>
                  <p>{comment.content}</p>
                  <MediaBlock url={comment.media_url} compact onOpen={setViewerUrl} />
                </article>
              )}
            </VirtualList>
          </div>
          <div class={styles.commentComposer}>
            <input type="text" value={commentText()} onInput={(e) => setCommentText(e.currentTarget.value)} placeholder="Responder al hilo" />
            <input type="text" value={commentMediaUrl()} onInput={(e) => setCommentMediaUrl(e.currentTarget.value)} placeholder="URL adjunto (opcional)" />
            <div class={styles.commentTools}>
              <button onClick={() => void pickCommentAttachment()}>Galeria</button>
              <button classList={{ [styles.toggleOn]: commentAnonymous() }} onClick={() => setCommentAnonymous((v) => !v)}>Anonimo</button>
              <button onClick={() => void createComment()}>Enviar</button>
            </div>
          </div>
        </div>
      }>
        <div class={styles.composer}>
          <input type="text" placeholder="Titulo descriptivo del hilo" value={title()} onInput={(e) => setTitle(e.currentTarget.value)} />
          <textarea placeholder="Cuenta contexto, evidencia o propuesta para la comunidad" value={content()} onInput={(e) => setContent(e.currentTarget.value)} />
          <input type="text" placeholder="URL adjunto (imagen/video/audio)" value={postMediaUrl()} onInput={(e) => setPostMediaUrl(e.currentTarget.value)} />
          <div class={styles.composerTools}>
            <button onClick={() => void pickPostAttachment()}>Galeria</button>
            <button classList={{ [styles.toggleOn]: postAnonymous() }} onClick={() => setPostAnonymous((v) => !v)}>Anonimo</button>
            <button disabled={loading()} onClick={() => void createPost()}>{loading() ? 'Publicando...' : 'Publicar'}</button>
          </div>
        </div>

        <div class={styles.feed}>
          <VirtualList items={posts} itemHeight={228} overscan={3}>
            {(post) => (
              <article class={styles.postCard}>
                <div class={styles.postHeader}>
                  <div class={styles.postTitleWrap}>
                    <small>{roomTag(selectedRoom() || { slug: 'general', name: 'General' })}</small>
                    <strong>{post.title}</strong>
                  </div>
                  <span>{post.author_name}</span>
                </div>
                <p>{post.content}</p>
                <MediaBlock url={post.media_url} onOpen={setViewerUrl} />
                <div class={styles.postActions}>
                  <button onClick={() => void votePost(post.id, 1)} classList={{ [styles.voted]: post.my_vote === 1 }}>▲</button>
                  <span>{post.score}</span>
                  <button onClick={() => void votePost(post.id, -1)} classList={{ [styles.voted]: post.my_vote === -1 }}>▼</button>
                  <button class={styles.commentsBtn} onClick={() => void openPost(post)}>{post.comments_count} comentarios</button>
                </div>
              </article>
            )}
          </VirtualList>
        </div>
      </Show>
      <MediaLightbox url={viewerUrl()} onClose={() => setViewerUrl(null)} />
    </AppScaffold>
  );
}
