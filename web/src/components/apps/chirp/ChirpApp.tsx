import { Show, createEffect, createMemo, createSignal, For, onCleanup } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchNui } from '../../../utils/fetchNui';
import { timeAgo } from '../../../utils/misc';
import { resolveMediaType, sanitizeMediaUrl, sanitizeText } from '../../../utils/sanitize';
import { ActionSheet } from '../../shared/ui/ActionSheet';
import { MediaLightbox } from '../../shared/ui/MediaLightbox';
import styles from './ChirpApp.module.scss';

interface ChirpTweet {
  id: number;
  display_name?: string;
  username?: string;
  content: string;
  likes?: number;
  liked?: boolean;
  created_at?: string;
}

export function ChirpApp() {
  const router = useRouter();
  const [tweets, setTweets] = createSignal<ChirpTweet[]>([]);
  const [composer, setComposer] = createSignal('');
  const [mediaUrl, setMediaUrl] = createSignal('');
  const [tab, setTab] = createSignal<'forYou' | 'following'>('forYou');
  const [showAttachSheet, setShowAttachSheet] = createSignal(false);
  const [showComposer, setShowComposer] = createSignal(false);
  const [viewerUrl, setViewerUrl] = createSignal<string | null>(null);
  const [query, setQuery] = createSignal('');

  const loadTweets = async () => {
    const list = await fetchNui<ChirpTweet[]>('chirpGetTweets', { tab: tab(), limit: 50, offset: 0 }, []);
    setTweets(list || []);
  };

  createEffect(() => {
    void fetchNui('chirpGetAccount', {});
    void loadTweets();
  });

  createEffect(() => {
    const onKey = (e: CustomEvent<string>) => {
      if (e.detail === 'Backspace') router.goBack();
    };
    window.addEventListener('phone:keyUp', onKey as EventListener);
    onCleanup(() => window.removeEventListener('phone:keyUp', onKey as EventListener));
  });

  const publish = async () => {
    const content = sanitizeText(composer(), 280);
    const media = sanitizeMediaUrl(mediaUrl());
    if (!content) return;
    const result = await fetchNui<{ success?: boolean }>('chirpPublishTweet', { content, mediaUrl: media || undefined });
    if (result?.success) {
      setComposer('');
      setMediaUrl('');
      await loadTweets();
    }
  };

  const attachFromGallery = async () => {
    const gallery = await fetchNui<any[]>('getGallery', undefined, []);
    if (gallery && gallery.length > 0) {
      const nextUrl = sanitizeMediaUrl(gallery[0].url);
      if (nextUrl) setMediaUrl(nextUrl);
    }
  };

  const attachFromCamera = async () => {
    const shot = await fetchNui<{ url?: string }>('takePhoto', { effect: 'normal' } as any, { url: '' } as any);
    if (shot?.url) {
      const nextUrl = sanitizeMediaUrl(shot.url);
      if (nextUrl) {
        setMediaUrl(nextUrl);
        return;
      }
    }
    const gallery = await fetchNui<any[]>('getGallery', undefined, []);
    if (gallery && gallery.length > 0) {
      const nextUrl = sanitizeMediaUrl(gallery[0].url);
      if (nextUrl) setMediaUrl(nextUrl);
    }
  };

  const quickPostFromCamera = async () => {
    const shot = await fetchNui<{ url?: string }>('takePhoto', { effect: 'normal' } as any, { url: '' } as any);
    const media = sanitizeMediaUrl(shot?.url);
    if (!media) return;

    const content = sanitizeText(composer(), 280) || '📸 Nueva captura';
    const result = await fetchNui<{ success?: boolean }>('chirpPublishTweet', { content, mediaUrl: media });
    if (result?.success) {
      setComposer('');
      setMediaUrl('');
      await loadTweets();
    }
  };

  const openCameraComposer = () => {
    router.navigate('camera', { target: 'chirp' });
  };

  const attachByUrl = () => {
    const input = window.prompt('Pega URL de imagen, video o GIF');
    const nextUrl = sanitizeMediaUrl(input);
    if (nextUrl) {
      setMediaUrl(nextUrl);
      return;
    }
    if (input && input.trim()) window.alert('URL invalida o formato no permitido');
  };

  const toggleLike = async (tweetId: number) => {
    await fetchNui('chirpToggleLike', { tweetId });
    await loadTweets();
  };

  const deleteTweet = async (tweetId: number) => {
    const result = await fetchNui<{ success?: boolean }>('chirpDeleteTweet', { tweetId });
    if (result?.success) await loadTweets();
  };

  const trending = createMemo(() => {
    const tags = new Map<string, number>();
    for (const tweet of tweets()) {
      const matches = (tweet.content || '').match(/#[a-zA-Z0-9_]+/g) || [];
      for (const tag of matches) {
        const normalized = tag.toLowerCase();
        tags.set(normalized, (tags.get(normalized) || 0) + 1);
      }
    }

    return Array.from(tags.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([tag, count]) => ({ tag, count }));
  });

  const visibleTweets = createMemo(() => {
    const normalized = sanitizeText(query(), 60).toLowerCase();
    if (!normalized) return tweets();
    return tweets().filter((tweet) => {
      const author = `${tweet.display_name || ''} ${tweet.username || ''}`.toLowerCase();
      return tweet.content.toLowerCase().includes(normalized) || author.includes(normalized);
    });
  });

  return (
    <div class={styles.app}>
      <div class={styles.header}>
        <button class={styles.backBtn} onClick={() => router.goBack()}>‹</button>
        <h1>Chirp Pulse</h1>
        <button class={styles.composeBtn} onClick={() => setShowComposer(true)}>Post</button>
      </div>

      <div class={styles.searchRow}>
        <input
          class={styles.searchInput}
          placeholder="Buscar en Chirp"
          value={query()}
          onInput={(event) => setQuery(event.currentTarget.value)}
        />
      </div>

      <Show when={trending().length > 0}>
        <div class={styles.trendingRow}>
          <For each={trending()}>
            {(item) => (
              <button class={styles.trendChip} onClick={() => setQuery(item.tag)}>
                <strong>{item.tag}</strong>
                <span>{item.count}</span>
              </button>
            )}
          </For>
        </div>
      </Show>

      <div class={styles.tabs}>
        <button class={styles.tabBtn} classList={{ [styles.active]: tab() === 'forYou' }} onClick={() => { setTab('forYou'); void loadTweets(); }}>
          Para ti
        </button>
        <button class={styles.tabBtn} classList={{ [styles.active]: tab() === 'following' }} onClick={() => { setTab('following'); void loadTweets(); }}>
          Siguiendo
        </button>
      </div>

      <div class={styles.feed}>
        <For each={visibleTweets()}>
          {(tweet) => (
            <article class={styles.tweetCard}>
              <div class={styles.meta}>
                <strong>{tweet.display_name || 'Usuario'}</strong>
                <span>@{tweet.username || 'user'}</span>
                <span>{tweet.created_at ? timeAgo(tweet.created_at) : 'ahora'}</span>
              </div>
              <p>{tweet.content}</p>
              <Show when={(tweet as any).media_url || (tweet as any).mediaUrl}>
                <Show when={resolveMediaType((tweet as any).media_url || (tweet as any).mediaUrl) === 'image'}>
                  <img class={styles.tweetMedia} src={(tweet as any).media_url || (tweet as any).mediaUrl} alt="media" onClick={() => setViewerUrl((tweet as any).media_url || (tweet as any).mediaUrl)} />
                </Show>
                <Show when={resolveMediaType((tweet as any).media_url || (tweet as any).mediaUrl) === 'video'}>
                  <video class={styles.tweetMedia} src={(tweet as any).media_url || (tweet as any).mediaUrl} controls playsinline preload="metadata" onClick={() => setViewerUrl((tweet as any).media_url || (tweet as any).mediaUrl)} />
                </Show>
              </Show>
              <button class={styles.likeBtn} onClick={() => toggleLike(tweet.id)}>
                {tweet.liked ? '♥' : '♡'} {tweet.likes || 0}
              </button>
              <button class={styles.deleteBtn} onClick={() => deleteTweet(tweet.id)}>Eliminar</button>
            </article>
          )}
        </For>
      </div>

      <ActionSheet
        open={showAttachSheet()}
        title="Adjuntar a Chirp"
        onClose={() => setShowAttachSheet(false)}
        actions={[
          { label: 'Abrir camara dedicada', tone: 'primary', onClick: openCameraComposer },
          { label: 'Elegir desde galeria', tone: 'primary', onClick: attachFromGallery },
          { label: 'Tomar foto con camara', onClick: attachFromCamera },
          { label: 'Publicar foto rapida', onClick: quickPostFromCamera },
          { label: 'Pegar URL multimedia', onClick: attachByUrl },
          { label: 'Quitar adjunto', tone: 'danger', onClick: () => { setMediaUrl(''); } },
        ]}
      />

      <Show when={showComposer()}>
        <div class={styles.composeModal}>
          <div class={styles.composer}>
            <textarea
              maxlength={280}
              placeholder="Que esta pasando?"
              value={composer()}
              onInput={(e) => setComposer(e.currentTarget.value)}
            />
            <div class={styles.attachRow}>
              <button class={styles.attachBtn} onClick={() => setShowAttachSheet(true)}>Adjuntar</button>
              <input
                type="text"
                placeholder="URL media (opcional)"
                value={mediaUrl()}
                onInput={(e) => setMediaUrl(sanitizeMediaUrl(e.currentTarget.value))}
              />
            </div>
            <Show when={mediaUrl()}>
              <Show when={resolveMediaType(mediaUrl()) === 'image'}>
                <img class={styles.mediaPreview} src={mediaUrl()} alt="adjunto" />
              </Show>
              <Show when={resolveMediaType(mediaUrl()) === 'video'}>
                <video class={styles.mediaPreview} src={mediaUrl()} controls playsinline preload="metadata" />
              </Show>
            </Show>
            <div class={styles.modalActions}>
              <button class={styles.deleteBtn} onClick={() => setShowComposer(false)}>Cancelar</button>
              <button class={styles.publishBtn} onClick={() => { void publish(); setShowComposer(false); }}>Publicar</button>
            </div>
          </div>
        </div>
      </Show>

      <button class={styles.fab} onClick={() => setShowComposer(true)}>+</button>
      <MediaLightbox url={viewerUrl()} onClose={() => setViewerUrl(null)} />
    </div>
  );
}
