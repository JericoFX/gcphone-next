import { createEffect, createMemo, createSignal, For, Show, onCleanup } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchNui } from '../../../utils/fetchNui';
import { resolveMediaType, sanitizeMediaUrl, sanitizeText } from '../../../utils/sanitize';
import styles from './ClipsApp.module.scss';

interface ClipPost {
  id: number;
  username?: string;
  display_name?: string;
  media_url: string;
  caption?: string;
  likes?: number;
}

export function ClipsApp() {
  const router = useRouter();
  const [feed, setFeed] = createSignal<ClipPost[]>([]);
  const [mediaUrl, setMediaUrl] = createSignal('');
  const [caption, setCaption] = createSignal('');
  const [showComposer, setShowComposer] = createSignal(false);
  const [username, setUsername] = createSignal('');
  const [sortMode, setSortMode] = createSignal<'hot' | 'new'>('hot');

  const loadFeed = async () => {
    const list = await fetchNui<ClipPost[]>('clipsGetFeed', { limit: 40, offset: 0 }, []);
    setFeed((list || []).filter((x) => resolveMediaType(x.media_url) === 'video'));
  };

  createEffect(() => {
    void fetchNui<{ username?: string }>('snapGetAccount', {}).then((acc) => setUsername(sanitizeText(acc?.username || '', 40)));
    void loadFeed();
  });

  createEffect(() => {
    const onKey = (e: CustomEvent<string>) => {
      if (e.detail === 'Backspace') router.goBack();
    };
    window.addEventListener('phone:keyUp', onKey as EventListener);
    onCleanup(() => window.removeEventListener('phone:keyUp', onKey as EventListener));
  });

  const attachFromGallery = async () => {
    const gallery = await fetchNui<any[]>('getGallery', undefined, []);
    const picked = (gallery || []).find((g) => resolveMediaType(g.url) === 'video');
    const nextUrl = sanitizeMediaUrl(picked?.url);
    if (nextUrl && resolveMediaType(nextUrl) === 'video') setMediaUrl(nextUrl);
  };

  const attachByUrl = () => {
    const input = window.prompt('Pega URL de video (mp4/webm/mov/m3u8)');
    const next = sanitizeMediaUrl(input);
    if (!next || resolveMediaType(next) !== 'video') {
      window.alert('Solo videos permitidos');
      return;
    }
    setMediaUrl(next);
    void fetchNui('storeMediaUrl', { url: next });
  };

  const publish = async () => {
    const video = sanitizeMediaUrl(mediaUrl());
    if (!video || resolveMediaType(video) !== 'video') return;
    const result = await fetchNui<{ success?: boolean }>('clipsPublish', {
      mediaUrl: video,
      caption: sanitizeText(caption(), 500),
    }, { success: false });
    if (result?.success) {
      setMediaUrl('');
      setCaption('');
      setShowComposer(false);
      await loadFeed();
    }
  };

  const likePost = async (postId: number) => {
    await fetchNui('clipsToggleLike', { postId });
    await loadFeed();
  };

  const deletePost = async (postId: number) => {
    const ok = await fetchNui<{ success?: boolean }>('clipsDeletePost', { postId }, { success: false });
    if (ok?.success) await loadFeed();
  };

  const visibleFeed = createMemo(() => {
    if (sortMode() === 'new') return feed();
    return [...feed()].sort((a, b) => Number(b.likes || 0) - Number(a.likes || 0));
  });

  return (
    <div class={styles.app}>
      <div class={styles.header}>
        <button class={styles.backBtn} onClick={() => router.goBack()}>‹</button>
        <h1>Clips Flow</h1>
        <button class={styles.uploadBtn} onClick={() => setShowComposer((v) => !v)}>Upload</button>
      </div>

      <div class={styles.sortRow}>
        <button class={styles.sortBtn} classList={{ [styles.sortActive]: sortMode() === 'hot' }} onClick={() => setSortMode('hot')}>Trending</button>
        <button class={styles.sortBtn} classList={{ [styles.sortActive]: sortMode() === 'new' }} onClick={() => setSortMode('new')}>Recientes</button>
      </div>

      <Show when={showComposer()}>
        <div class={styles.composer}>
          <input type="text" placeholder="URL de video" value={mediaUrl()} onInput={(e) => setMediaUrl(e.currentTarget.value)} />
          <input type="text" placeholder="Descripcion" value={caption()} onInput={(e) => setCaption(e.currentTarget.value)} />
          <div class={styles.composerActions}>
            <button class={styles.softBtn} onClick={() => void attachFromGallery()}>Galeria</button>
            <button class={styles.softBtn} onClick={() => router.navigate('camera', { target: 'clips' })}>Camara</button>
            <button class={styles.softBtn} onClick={attachByUrl}>Pegar URL</button>
            <button class={styles.postBtn} onClick={() => void publish()}>Publicar video</button>
          </div>
          <div class={styles.hint}>Para videos grabados, configura upload de video en tu backend (ej. FiveManage).</div>
        </div>
      </Show>

      <div class={styles.feed}>
        <For each={visibleFeed()}>
          {(post) => (
            <article class={styles.card}>
              <div class={styles.meta}>{post.display_name || post.username || 'Usuario'}</div>
              <video src={post.media_url} controls playsinline preload="metadata" />
              <p>{post.caption || 'Sin descripcion'}</p>
              <div class={styles.actions}>
                <button class={styles.likeBtn} onClick={() => void likePost(post.id)}>♥ {post.likes || 0}</button>
                <Show when={sanitizeText(post.username || '', 40) === username()}>
                  <button class={styles.deleteBtn} onClick={() => void deletePost(post.id)}>Eliminar</button>
                </Show>
              </div>
            </article>
          )}
        </For>
      </div>

      <button class={styles.fab} onClick={() => setShowComposer((v) => !v)}>+</button>
    </div>
  );
}
