import { createEffect, createSignal, For, onCleanup, Show } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchNui } from '../../../utils/fetchNui';
import { timeAgo } from '../../../utils/misc';
import { resolveMediaType, sanitizeMediaUrl, sanitizeText } from '../../../utils/sanitize';
import { ActionSheet } from '../../shared/ui/ActionSheet';
import styles from './NewsApp.module.scss';

interface NewsArticle {
  id: number;
  title: string;
  content: string;
  author_name?: string;
  created_at?: string;
  category?: string;
}

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

  const attachByUrl = () => {
    const input = window.prompt('Pega URL de imagen o video');
    const nextUrl = sanitizeMediaUrl(input);
    if (nextUrl) {
      setMediaUrl(nextUrl);
      return;
    }
    if (input && input.trim()) window.alert('URL invalida o formato no permitido');
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
    });

    if (result?.success && result.articleId) {
      setLiveArticleId(result.articleId);
      await load();
    }
  };

  return (
    <div class={styles.app}>
      <div class={styles.header}>
        <button class={styles.backBtn} onClick={() => router.goBack()}>‹</button>
        <h1>Noticias</h1>
        <button class={styles.addBtn} onClick={() => setShowCompose(true)}>✎</button>
      </div>

      <div class={styles.tools}>
        <select value={selectedCategory()} onChange={(e) => { setSelectedCategory(e.currentTarget.value); void load(); }}>
          <option value="all">Todas</option>
          <For each={categories()}>{(c) => <option value={c}>{c}</option>}</For>
        </select>
        <button class={styles.liveBtn} onClick={toggleLive}>{liveArticleId() ? 'Terminar live' : 'Iniciar live'}</button>
      </div>

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
                  <img class={styles.articleMedia} src={(article as any).media_url || (article as any).mediaUrl} alt="media" />
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
                <img class={styles.articleMedia} src={mediaUrl()} alt="preview" />
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
    </div>
  );
}
