import { createEffect, createMemo, createSignal, For, onCleanup, Show } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchNui } from '../../../utils/fetchNui';
import { resolveMediaType, sanitizeMediaUrl, sanitizeText } from '../../../utils/sanitize';
import { ActionSheet } from '../../shared/ui/ActionSheet';
import { MediaLightbox } from '../../shared/ui/MediaLightbox';
import styles from './SnapApp.module.scss';

interface SnapPost {
  id: number;
  username?: string;
  display_name?: string;
  media_url?: string;
  caption?: string;
  likes?: number;
}

export function SnapApp() {
  const router = useRouter();
  const [feed, setFeed] = createSignal<SnapPost[]>([]);
  const [stories, setStories] = createSignal<any[]>([]);
  const [liveStreams, setLiveStreams] = createSignal<any[]>([]);
  const [activeStoryIndex, setActiveStoryIndex] = createSignal<number | null>(null);
  const [storyNow, setStoryNow] = createSignal(Date.now());
  const [mediaUrl, setMediaUrl] = createSignal('');
  const [caption, setCaption] = createSignal('');
  const [livePostId, setLivePostId] = createSignal<number | null>(null);
  const [showAttachSheet, setShowAttachSheet] = createSignal(false);
  const [showComposer, setShowComposer] = createSignal(false);
  const [viewerUrl, setViewerUrl] = createSignal<string | null>(null);
  const [accountUsername, setAccountUsername] = createSignal('');
  const [activeTab, setActiveTab] = createSignal<'stories' | 'feed'>('stories');

  const loadFeed = async () => {
    const result = await fetchNui<SnapPost[]>('snapGetFeed', { limit: 30, offset: 0 }, []);
    setFeed(result || []);
    const storiesResult = await fetchNui<any[]>('snapGetStories', {}, []);
    setStories(storiesResult || []);
    const liveResult = await fetchNui<any[]>('snapGetLiveStreams', {}, []);
    setLiveStreams(liveResult || []);
  };

  createEffect(() => {
    void fetchNui<{ username?: string }>('snapGetAccount', {}).then((acc) => {
      setAccountUsername(sanitizeText(acc?.username || '', 40));
    });
    void loadFeed();
  });

  createEffect(() => {
    const timer = window.setInterval(() => setStoryNow(Date.now()), 1000);
    onCleanup(() => clearInterval(timer));
  });

  const formatStoryRemaining = (expiresAt?: string) => {
    if (!expiresAt) return '';
    const remaining = Math.max(0, Math.floor((new Date(expiresAt).getTime() - storyNow()) / 1000));
    const hours = Math.floor(remaining / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const openStory = (index: number) => {
    if (index < 0 || index >= stories().length) return;
    setActiveStoryIndex(index);
  };

  const shiftStory = (offset: number) => {
    const current = activeStoryIndex();
    if (current === null) return;
    const nextIndex = Math.max(0, Math.min(stories().length - 1, current + offset));
    setActiveStoryIndex(nextIndex);
  };

  const activeStory = () => {
    const index = activeStoryIndex();
    if (index === null) return null;
    return stories()[index] || null;
  };

  createEffect(() => {
    const onKey = (e: CustomEvent<string>) => {
      if (e.detail === 'Backspace') router.goBack();
    };
    window.addEventListener('phone:keyUp', onKey as EventListener);
    onCleanup(() => window.removeEventListener('phone:keyUp', onKey as EventListener));
  });

  const publish = async () => {
    const media = sanitizeMediaUrl(mediaUrl());
    if (!media) return;
    const result = await fetchNui<{ success?: boolean }>('snapPublishPost', {
      mediaUrl: media,
      mediaType: resolveMediaType(media) === 'video' ? 'video' : 'image',
      caption: sanitizeText(caption(), 500)
    });

    if (result?.success) {
      setMediaUrl('');
      setCaption('');
      await loadFeed();
    }
  };

  const likePost = async (postId: number) => {
    await fetchNui('snapToggleLike', { postId });
    await loadFeed();
  };

  const publishStory = async () => {
    const media = sanitizeMediaUrl(mediaUrl());
    if (!media) return;
    const result = await fetchNui<{ success?: boolean }>('snapPublishStory', {
      mediaUrl: media,
      mediaType: resolveMediaType(media) === 'video' ? 'video' : 'image'
    });
    if (result?.success) {
      setMediaUrl('');
      await loadFeed();
    }
  };

  const captureStoryFromCamera = async () => {
    const shot = await fetchNui<{ url?: string }>('takePhoto', { effect: 'normal' } as any, { url: '' } as any);
    const nextUrl = sanitizeMediaUrl(shot?.url);
    if (!nextUrl) return;

    const result = await fetchNui<{ success?: boolean }>('snapPublishStory', {
      mediaUrl: nextUrl,
      mediaType: resolveMediaType(nextUrl) === 'video' ? 'video' : 'image',
    });

    if (result?.success) {
      await loadFeed();
    }
  };

  const attachFromGallery = async () => {
    const gallery = await fetchNui<any[]>('getGallery', undefined, []);
    if (gallery && gallery.length > 0) {
      const nextUrl = sanitizeMediaUrl(gallery[0].url);
      if (nextUrl) setMediaUrl(nextUrl);
    }
  };

  const openCameraFor = (target: 'snap-post' | 'snap-story') => {
    setShowAttachSheet(false);
    router.navigate('camera', { target });
  };

  const attachByUrl = () => {
    const input = window.prompt('Pega URL de imagen o video');
    const nextUrl = sanitizeMediaUrl(input);
    if (nextUrl) {
      setMediaUrl(nextUrl);
      return;
    }
    if (input && input.trim()) window.alert('URL invalida o formato no permitido');
  };

  const startLive = async () => {
    const result = await fetchNui<{ success?: boolean; postId?: number }>('snapStartLive', {});
    if (result?.success && result.postId) {
      setLivePostId(result.postId);
      await loadFeed();
    }
  };

  const endLive = async () => {
    if (!livePostId()) return;
    const result = await fetchNui<{ success?: boolean }>('snapEndLive', { postId: livePostId() });
    if (result?.success) {
      setLivePostId(null);
      await loadFeed();
    }
  };

  const deletePost = async (postId: number) => {
    const ok = await fetchNui<{ success?: boolean }>('snapDeletePost', { postId });
    if (ok?.success) await loadFeed();
  };

  const deleteStory = async (storyId: number) => {
    const ok = await fetchNui<{ success?: boolean }>('snapDeleteStory', { storyId });
    if (ok?.success) await loadFeed();
  };

  const visibleFeed = createMemo(() => {
    if (activeTab() === 'stories') return feed().slice(0, 8);
    return feed();
  });

  return (
    <div class={styles.app}>
      <div class={styles.header}>
        <button class={styles.backBtn} onClick={() => router.goBack()}>‹</button>
        <h1>Snap Neon</h1>
        <button class={styles.cameraBtn} onClick={() => openCameraFor('snap-post')}>Cam</button>
      </div>

      <div class={styles.tabRow}>
        <button class={styles.tabBtn} classList={{ [styles.tabActive]: activeTab() === 'stories' }} onClick={() => setActiveTab('stories')}>Stories</button>
        <button class={styles.tabBtn} classList={{ [styles.tabActive]: activeTab() === 'feed' }} onClick={() => setActiveTab('feed')}>Feed</button>
      </div>

      <Show when={showComposer()}>
        <div class={styles.publisher}>
          <input
            type="text"
            placeholder="URL de foto o video"
            value={mediaUrl()}
            onInput={(e) => setMediaUrl(sanitizeMediaUrl(e.currentTarget.value))}
          />
          <input
            type="text"
            placeholder="Descripcion"
            value={caption()}
            onInput={(e) => setCaption(e.currentTarget.value)}
          />
          <button class={styles.postBtn} onClick={() => { void publish(); setShowComposer(false); }}>Subir</button>
        </div>
      </Show>

      <div class={styles.storyRow}>
        <For each={stories()}>
          {(story, index) => (
            <div class={styles.storyChipWrap}>
              <button class={styles.storyChip} onClick={() => openStory(index())}>
                {(story.username || 'story')} · {formatStoryRemaining(story.expires_at)}
              </button>
              <Show when={sanitizeText(story.username || '', 40) === accountUsername()}>
                <button class={styles.storyDeleteBtn} onClick={() => void deleteStory(story.id)}>×</button>
              </Show>
            </div>
          )}
        </For>
      </div>

      <div class={styles.liveRow}>
        <For each={liveStreams()}>
          {(stream) => <div class={styles.liveChip}>LIVE {stream.username || 'user'} ({stream.live_viewers || 0})</div>}
        </For>
      </div>

      <div class={styles.feed}>
        <For each={visibleFeed()}>
          {(post) => (
            <article class={styles.card}>
              <div class={styles.meta}>{post.display_name || post.username || 'Usuario'}</div>
              <Show when={resolveMediaType(post.media_url) === 'video'} fallback={<img src={post.media_url || './img/background/back001.jpg'} alt="post" onClick={() => setViewerUrl(post.media_url || null)} />}>
                <video src={post.media_url} controls playsinline preload="metadata" onClick={() => setViewerUrl(post.media_url || null)} />
              </Show>
              <p>{post.caption || 'Sin descripcion'}</p>
              <div class={styles.postActions}>
                <button class={styles.likeBtn} onClick={() => likePost(post.id)}>♥ {post.likes || 0}</button>
                <Show when={sanitizeText(post.username || '', 40) === accountUsername()}>
                  <button class={styles.deleteBtn} onClick={() => void deletePost(post.id)}>Eliminar</button>
                </Show>
              </div>
            </article>
          )}
        </For>
      </div>

      <ActionSheet
        open={showAttachSheet()}
        title="Que quieres hacer?"
        onClose={() => setShowAttachSheet(false)}
        actions={[
          { label: 'Camara para post', tone: 'primary', onClick: () => openCameraFor('snap-post') },
          { label: 'Camara para story', tone: 'primary', onClick: () => openCameraFor('snap-story') },
          { label: 'Composer manual', onClick: () => { setShowComposer(true); } },
          { label: 'Subir story del adjunto', onClick: publishStory },
          { label: 'Story rapida camara', onClick: captureStoryFromCamera },
          { label: livePostId() ? 'Cortar live' : 'Iniciar live', onClick: livePostId() ? endLive : startLive },
          { label: 'Elegir desde galeria', tone: 'primary', onClick: attachFromGallery },
          { label: 'Pegar URL multimedia', onClick: attachByUrl },
          { label: 'Quitar adjunto', tone: 'danger', onClick: () => { setMediaUrl(''); } },
        ]}
      />

      <button class={styles.fab} onClick={() => setShowAttachSheet(true)}>+</button>

      <Show when={activeStory()}>
        <div class={styles.storyViewer}>
          <button class={styles.storyClose} onClick={() => setActiveStoryIndex(null)}>✕</button>
          <button class={styles.storyNav} classList={{ [styles.storyDisabled]: (activeStoryIndex() || 0) <= 0 }} onClick={() => shiftStory(-1)}>‹</button>
          <button class={styles.storyNav} classList={{ [styles.storyNext]: true, [styles.storyDisabled]: (activeStoryIndex() || 0) >= stories().length - 1 }} onClick={() => shiftStory(1)}>›</button>
          <div class={styles.storyMeta}>
            <strong>{activeStory()?.username || 'story'}</strong>
            <span>expira en {formatStoryRemaining(activeStory()?.expires_at)}</span>
          </div>
          <Show when={resolveMediaType(activeStory()?.media_url) === 'video'} fallback={<img src={activeStory()?.media_url || './img/background/back001.jpg'} alt="story" />}>
            <video src={activeStory()?.media_url} controls playsinline preload="metadata" />
          </Show>
        </div>
      </Show>

      <MediaLightbox url={viewerUrl()} onClose={() => setViewerUrl(null)} />
    </div>
  );
}
