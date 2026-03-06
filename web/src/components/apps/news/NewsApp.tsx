import { createEffect, createMemo, createSignal, For, onCleanup, Show } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchNui } from '../../../utils/fetchNui';
import { timeAgo } from '../../../utils/misc';
import { resolveMediaType, sanitizeMediaUrl, sanitizeText } from '../../../utils/sanitize';
import { uiPrompt } from '../../../utils/uiDialog';
import { uiAlert } from '../../../utils/uiAlert';
import { startMockLiveFeed } from '../../../utils/liveMock';
import { ActionSheet } from '../../shared/ui/ActionSheet';
import { MediaLightbox } from '../../shared/ui/MediaLightbox';
import { AppScaffold } from '../../shared/layout';
import styles from './NewsApp.module.scss';

interface NewsArticle {
  id: number;
  title: string;
  content: string;
  author_name?: string;
  created_at?: string;
  category?: string;
}

interface NewsScaleform {
  preset: 'breaking' | 'ticker' | 'flash';
  headline: string;
  subtitle: string;
  ticker: string;
}

interface MockLiveMessage {
  id: number;
  user: string;
  text: string;
  at: string;
}

const NEWS_MOCK_USERS = ['Cronista', 'Mika', 'Luna', 'Santi', 'Mery'];
const NEWS_MOCK_LINES = [
  'Cobertura impecable 👏',
  'Gracias por informar en vivo',
  'Se escucha claro ✅',
  'Actualicen sobre trafico por favor',
  'Muy buen trabajo equipo',
];

export function NewsApp() {
  const router = useRouter();
  const [articles, setArticles] = createSignal<NewsArticle[]>([]);
  const [categories, setCategories] = createSignal<string[]>(['general']);
  const [selectedCategory, setSelectedCategory] = createSignal('all');
  const [showCompose, setShowCompose] = createSignal(false);
  const [title, setTitle] = createSignal('');
  const [content, setContent] = createSignal('');
  const [mediaUrl, setMediaUrl] = createSignal('');
  const [category, setCategory] = createSignal('general');
  const [liveArticleId, setLiveArticleId] = createSignal<number | null>(null);
  const [showAttachSheet, setShowAttachSheet] = createSignal(false);
  const [viewerUrl, setViewerUrl] = createSignal<string | null>(null);
  const [query, setQuery] = createSignal('');
  const [mockLiveEnabled, setMockLiveEnabled] = createSignal(false);
  const [mockLiveMessages, setMockLiveMessages] = createSignal<MockLiveMessage[]>([]);
  const [scalePreset, setScalePreset] = createSignal<NewsScaleform['preset']>('breaking');
  const [scaleHeadline, setScaleHeadline] = createSignal('ULTIMO MOMENTO');
  const [scaleSubtitle, setScaleSubtitle] = createSignal('Cobertura en vivo');
  const [scaleTicker, setScaleTicker] = createSignal('Desarrollo en curso...');

  let stopNewsMock: (() => void) | undefined;

  const load = async () => {
    const data = await fetchNui<NewsArticle[]>('newsGetArticles', { category: selectedCategory(), limit: 50, offset: 0 }, []);
    setArticles(data || []);
    const cats = await fetchNui<string[]>('newsGetCategories', {}, ['general']);
    setCategories(cats || ['general']);
  };

  createEffect(() => {
    void load();
  });

  createEffect(() => {
    const onKey = (e: CustomEvent<string>) => {
      if (e.detail === 'Backspace' && !showCompose()) router.goBack();
    };
    window.addEventListener('phone:keyUp', onKey as EventListener);
    onCleanup(() => window.removeEventListener('phone:keyUp', onKey as EventListener));
  });

  createEffect(() => {
    const id = liveArticleId();
    if (!id) return;
    (async () => {
      const sf = await fetchNui<NewsScaleform | null>('newsGetScaleform', { articleId: id }, null);
      if (!sf) return;
      setScalePreset((sf.preset || 'breaking') as NewsScaleform['preset']);
      setScaleHeadline(sanitizeText(sf.headline || '', 80) || 'ULTIMO MOMENTO');
      setScaleSubtitle(sanitizeText(sf.subtitle || '', 120) || 'Cobertura en vivo');
      setScaleTicker(sanitizeText(sf.ticker || '', 180) || 'Desarrollo en curso...');
    })();
  });

  createEffect(() => {
    if (!mockLiveEnabled()) {
      stopNewsMock?.();
      stopNewsMock = undefined;
      return;
    }

    stopNewsMock = startMockLiveFeed({
      users: NEWS_MOCK_USERS,
      lines: NEWS_MOCK_LINES,
      onMessage: (entry) => {
        const when = new Date(entry.createdAt);
        const at = `${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}`;
        const next: MockLiveMessage = {
          id: Number(entry.id.replace(/\D/g, '').slice(0, 9)) || Date.now(),
          user: entry.user,
          text: entry.text,
          at,
        };
        setMockLiveMessages((prev) => [...prev.slice(-19), next]);
      },
    });

    onCleanup(() => {
      stopNewsMock?.();
      stopNewsMock = undefined;
    });
  });

  const publish = async () => {
    const nextTitle = sanitizeText(title(), 200);
    const nextContent = sanitizeText(content(), 3000);
    const nextCategory = sanitizeText(category(), 30) || 'general';
    const nextMedia = sanitizeMediaUrl(mediaUrl());
    if (!nextTitle || !nextContent) return;
    const result = await fetchNui<{ success?: boolean }>('newsPublishArticle', {
      title: nextTitle,
      content: nextContent,
      category: nextCategory,
      mediaType: resolveMediaType(nextMedia) === 'video' ? 'video' : 'image',
      mediaUrl: nextMedia || undefined
    });

    if (result?.success) {
      setShowCompose(false);
      setTitle('');
      setContent('');
      setMediaUrl('');
      setCategory('general');
      await load();
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
    const shot = await fetchNui<{ url?: string }>('takePhoto', {} as any, { url: '' } as any);
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

  const attachByUrl = async () => {
    const input = await uiPrompt('Pega URL de imagen o video', { title: 'Adjuntar en noticias' });
    const nextUrl = sanitizeMediaUrl(input);
    if (nextUrl) {
      setMediaUrl(nextUrl);
      return;
    }
    if (input && input.trim()) uiAlert('URL invalida o formato no permitido');
  };

  const viewArticle = async (articleId: number) => {
    await fetchNui('newsViewArticle', { articleId });
  };

  const deleteArticle = async (articleId: number) => {
    const result = await fetchNui<{ success?: boolean }>('newsDeleteArticle', { articleId });
    if (result?.success) await load();
  };

  const toggleLive = async () => {
    if (liveArticleId()) {
      const result = await fetchNui<{ success?: boolean }>('newsEndLive', { articleId: liveArticleId() });
      if (result?.success) setLiveArticleId(null);
      return;
    }

    const result = await fetchNui<{ success?: boolean; articleId?: number }>('newsStartLive', {
      title: title().trim() || 'Transmision en vivo',
      content: content().trim() || 'Cobertura en vivo',
      category: sanitizeText(category(), 30) || 'general',
      scaleform: {
        preset: scalePreset(),
        headline: sanitizeText(scaleHeadline(), 80),
        subtitle: sanitizeText(scaleSubtitle(), 120),
        ticker: sanitizeText(scaleTicker(), 180),
      },
    });

    if (result?.success && result.articleId) {
      setLiveArticleId(result.articleId);
      await load();
    }
  };

  const applyScaleform = async () => {
    if (!liveArticleId()) return;
    const result = await fetchNui<{ success?: boolean }>('newsSetScaleform', {
      articleId: liveArticleId(),
      scaleform: {
        preset: scalePreset(),
        headline: sanitizeText(scaleHeadline(), 80),
        subtitle: sanitizeText(scaleSubtitle(), 120),
        ticker: sanitizeText(scaleTicker(), 180),
      },
    });
    if (result?.success) {
      uiAlert('Scaleform actualizado');
    }
  };

  const toggleMockLive = () => {
    const next = !mockLiveEnabled();
    setMockLiveEnabled(next);
    if (!next) {
      setMockLiveMessages([]);
      return;
    }
    setMockLiveMessages([
      {
        id: Date.now(),
        user: 'Cronista',
        text: 'Arrancamos mock live de noticias',
        at: 'ahora',
      },
    ]);
  };

  const editProfile = async () => {
    const account = await fetchNui<any>('snapGetAccount', {});
    if (!account) return;
    const nextNameInput = await uiPrompt('Nombre visible para Snap/Clips/Noticias', {
      title: 'Perfil',
      defaultValue: account.display_name || '',
      placeholder: 'Tu nombre',
    });
    if (nextNameInput === null) return;
    const nextName = sanitizeText(nextNameInput, 50);
    if (!nextName) return;

    const ok = await fetchNui<{ success?: boolean }>('snapUpdateAccount', {
      displayName: nextName,
      avatar: account.avatar || undefined,
      bio: account.bio || undefined,
      isPrivate: !!account.is_private,
    });
    if (ok?.success) {
      uiAlert('Perfil actualizado');
    }
  };

  const categoryOptions = createMemo(() => ['all', ...categories().filter((entry) => entry !== 'all')]);

  const visibleArticles = createMemo(() => {
    const q = sanitizeText(query(), 80).toLowerCase();
    return articles().filter((article) => {
      if (!q) return true;
      return (
        sanitizeText(article.title || '', 200).toLowerCase().includes(q) ||
        sanitizeText(article.content || '', 3000).toLowerCase().includes(q) ||
        sanitizeText(article.author_name || '', 80).toLowerCase().includes(q)
      );
    });
  });

  return (
    <AppScaffold title="Noticias" subtitle="Noticias de la ciudad" onBack={() => router.goBack()}>
      <div class={styles.newsApp}>
        <div class={styles.tools}>
          <select class={styles.categorySelect} value={selectedCategory()} onChange={(e) => { setSelectedCategory(e.currentTarget.value); void load(); }}>
            <option value="all">Todas</option>
            <For each={categories()}>{(c) => <option value={c}>{c}</option>}</For>
          </select>
          <div class={styles.liveActions}>
            <button class={styles.liveBtn} onClick={toggleLive}>{liveArticleId() ? 'Terminar live' : 'Iniciar live'}</button>
            <button class={styles.mockBtn} onClick={toggleMockLive}>{mockLiveEnabled() ? 'Mock off' : 'Mock live'}</button>
            <button class={styles.profileBtn} onClick={() => void editProfile()}>Perfil</button>
          </div>
        </div>

        <Show when={mockLiveEnabled()}>
          <div class={styles.mockLivePanel}>
            <div class={styles.mockLiveHeader}>Mock chat live (max 20)</div>
            <div class={styles.mockLiveStage}>
              <div class={styles.mockLiveBadge}>LIVE</div>
              <div class={styles.mockLiveStageText}>
                <strong>{sanitizeText(scaleHeadline(), 80) || 'Vista previa de video'}</strong>
                <span>{sanitizeText(scaleSubtitle(), 120) || 'Area reservada para stream en vivo'}</span>
              </div>
              <div class={styles.mockLiveViewerCount}>12 viendo</div>
              <div class={styles.mockLiveTicker}>{sanitizeText(scaleTicker(), 180)}</div>
            </div>

            <div class={styles.scaleformControls}>
              <select value={scalePreset()} onChange={(e) => setScalePreset(e.currentTarget.value as NewsScaleform['preset'])}>
                <option value="breaking">Breaking</option>
                <option value="ticker">Ticker</option>
                <option value="flash">Flash</option>
              </select>
              <input value={scaleHeadline()} onInput={(e) => setScaleHeadline(sanitizeText(e.currentTarget.value, 80))} placeholder="Headline" />
              <input value={scaleSubtitle()} onInput={(e) => setScaleSubtitle(sanitizeText(e.currentTarget.value, 120))} placeholder="Subtitle" />
              <input value={scaleTicker()} onInput={(e) => setScaleTicker(sanitizeText(e.currentTarget.value, 180))} placeholder="Ticker" />
              <button onClick={() => void applyScaleform()} disabled={!liveArticleId()}>Aplicar al live</button>
            </div>

            <div class={styles.mockLiveList}>
              <For each={mockLiveMessages()}>
                {(entry) => (
                  <div class={styles.mockLiveItem}>
                    <strong>{entry.user}</strong>
                    <span>{entry.text}</span>
                    <small>{entry.at}</small>
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>

        <div class={styles.feed}>
          <For each={articles()}>
            {(article) => (
              <article class={styles.card} onClick={() => viewArticle(article.id)}>
                <div class={styles.meta}>
                  <span>{article.author_name || 'Redaccion'}</span>
                  <span>{article.created_at ? timeAgo(article.created_at) : 'ahora'}</span>
                </div>
                <strong>{article.title}</strong>
                <Show when={(article as any).media_url || (article as any).mediaUrl}>
                  <Show when={resolveMediaType((article as any).media_url || (article as any).mediaUrl) === 'image'}>
                    <img class={styles.articleMedia} src={(article as any).media_url || (article as any).mediaUrl} alt="media" onClick={(e) => { e.stopPropagation(); setViewerUrl((article as any).media_url || (article as any).mediaUrl); }} />
                  </Show>
                  <Show when={resolveMediaType((article as any).media_url || (article as any).mediaUrl) === 'video'}>
                    <video class={styles.articleMedia} src={(article as any).media_url || (article as any).mediaUrl} controls playsinline preload="metadata" />
                  </Show>
                </Show>
                <p>{article.content}</p>
                <small>{article.category || 'general'}</small>
                <button class={styles.deleteBtn} onClick={(e) => { e.stopPropagation(); void deleteArticle(article.id); }}>Eliminar</button>
              </article>
            )}
          </For>
        </div>

        <Show when={showCompose()}>
          <div class={styles.modal}>
            <div class={styles.modalContent}>
              <h2>Publicar noticia</h2>
              <input type="text" placeholder="Titulo" value={title()} onInput={(e) => setTitle(e.currentTarget.value)} />
              <textarea placeholder="Contenido" value={content()} onInput={(e) => setContent(e.currentTarget.value)} />
              <div class={styles.composeAttachments}>
                <button onClick={() => setShowAttachSheet(true)}>Adjuntar</button>
                <input type="text" placeholder="URL media (opcional)" value={mediaUrl()} onInput={(e) => setMediaUrl(sanitizeMediaUrl(e.currentTarget.value))} />
              </div>
              <Show when={mediaUrl()}>
                <Show when={resolveMediaType(mediaUrl()) === 'image'}>
                  <img class={styles.articleMedia} src={mediaUrl()} alt="preview" onClick={() => setViewerUrl(mediaUrl())} />
                </Show>
                <Show when={resolveMediaType(mediaUrl()) === 'video'}>
                  <video class={styles.articleMedia} src={mediaUrl()} controls playsinline preload="metadata" />
                </Show>
              </Show>
              <input type="text" placeholder="Categoria" value={category()} onInput={(e) => setCategory(sanitizeText(e.currentTarget.value, 30))} />
              <div class={styles.actions}>
                <button onClick={() => setShowCompose(false)}>Cancelar</button>
                <button class={styles.primary} onClick={publish}>Publicar</button>
              </div>
            </div>
          </div>
        </Show>

        <ActionSheet
          open={showAttachSheet()}
          title="Adjuntar en noticias"
          onClose={() => setShowAttachSheet(false)}
          actions={[
            { label: 'Elegir desde galeria', tone: 'primary', onClick: attachFromGallery },
            { label: 'Tomar foto con camara', onClick: attachFromCamera },
            { label: 'Pegar URL multimedia', onClick: attachByUrl },
            { label: 'Quitar adjunto', tone: 'danger', onClick: () => { setMediaUrl(''); } },
          ]}
        />

        <button class={styles.fab} onClick={() => setShowCompose(true)}>+</button>
        <MediaLightbox url={viewerUrl()} onClose={() => setViewerUrl(null)} />
      </div>
    </AppScaffold>
  );
}
