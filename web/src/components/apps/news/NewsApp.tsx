import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchNui } from '../../../utils/fetchNui';
import { timeAgo } from '../../../utils/misc';
import { resolveMediaType, sanitizeMediaUrl, sanitizeText } from '../../../utils/sanitize';
import { uiPrompt } from '../../../utils/uiDialog';
import { uiAlert } from '../../../utils/uiAlert';
import { startMockLiveFeed } from '../../../utils/liveMock';
import { usePhoneKeyHandler } from '../../../hooks/usePhoneKeyHandler';
import { LiveFlashlightControl } from '../../shared/ui/LiveFlashlightControl';
import { MediaLightbox } from '../../shared/ui/MediaLightbox';
import { MediaActionButtons } from '../../shared/ui/MediaActionButtons';
import { MediaAttachmentPreview } from '../../shared/ui/MediaAttachmentPreview';
import { SocialOnboardingModal, type SocialOnboardingPayload } from '../../shared/ui/SocialOnboardingModal';
import { AppFAB, AppScaffold } from '../../shared/layout';
import { useLiveFlashlight } from '../../../hooks/useLiveFlashlight';
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

interface SharedSnapAccount {
  username?: string;
  display_name?: string;
  avatar?: string;
  bio?: string;
  is_private?: boolean | number;
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
  const [viewerUrl, setViewerUrl] = createSignal<string | null>(null);
  const [myAccount, setMyAccount] = createSignal<SharedSnapAccount | null>(null);
  const [showOnboarding, setShowOnboarding] = createSignal(false);
  const [query, setQuery] = createSignal('');
  const [mockLiveEnabled, setMockLiveEnabled] = createSignal(false);
  const [mockLiveMessages, setMockLiveMessages] = createSignal<MockLiveMessage[]>([]);
  const [scalePreset, setScalePreset] = createSignal<NewsScaleform['preset']>('breaking');
  const [scaleHeadline, setScaleHeadline] = createSignal('ULTIMO MOMENTO');
  const [scaleSubtitle, setScaleSubtitle] = createSignal('Cobertura en vivo');
  const [scaleTicker, setScaleTicker] = createSignal('Desarrollo en curso...');
  const liveFlashlight = useLiveFlashlight();

  let stopNewsMock: (() => void) | undefined;

  const load = async () => {
    const data = await fetchNui<NewsArticle[]>('newsGetArticles', { category: selectedCategory(), limit: 50, offset: 0 }, []);
    setArticles(data || []);
    const cats = await fetchNui<string[]>('newsGetCategories', {}, ['general']);
    setCategories(cats || ['general']);
  };

  const loadAccount = async () => {
    const account = await fetchNui<SharedSnapAccount | null>('snapGetAccount', {}, null);
    setMyAccount(account);
    setShowOnboarding(!account?.username);
  };

  createEffect(() => {
    void load();
  });

  onMount(() => {
    void loadAccount();
  });

  usePhoneKeyHandler({
    Backspace: () => {
      if (!showCompose()) {
        router.goBack();
      }
    },
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
      if (result?.success) {
        await fetchNui('phoneSetVisualMode', { mode: 'text' }, true);
        liveFlashlight.setPanelOpen(false);
        await liveFlashlight.turnOff();
        setLiveArticleId(null);
      }
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
      await fetchNui('phoneSetVisualMode', { mode: 'live' }, true);
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
      void fetchNui('phoneSetVisualMode', { mode: 'text' }, true);
      liveFlashlight.setPanelOpen(false);
      void liveFlashlight.turnOff();
      setMockLiveMessages([]);
      return;
    }

    void fetchNui('phoneSetVisualMode', { mode: 'live' }, true);
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
    const account = myAccount() || await fetchNui<SharedSnapAccount | null>('snapGetAccount', {}, null);
    if (!account?.username) {
      setShowOnboarding(true);
      return;
    }
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
      await loadAccount();
    }
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
    await loadAccount();
    return { ok: true };
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
            <LiveFlashlightControl
              visible={liveFlashlight.supported() && (liveArticleId() !== null || mockLiveEnabled())}
              enabled={liveFlashlight.enabled()}
              panelOpen={liveFlashlight.panelOpen()}
              kelvin={liveFlashlight.kelvin()}
              lumens={liveFlashlight.lumens()}
              kelvinRange={liveFlashlight.kelvinRange()}
              lumensRange={liveFlashlight.lumensRange()}
              buttonLabel={<span>Linterna</span>}
              theme="light"
              variant="pill"
              onPointerDown={liveFlashlight.beginPress}
              onPointerUp={liveFlashlight.endPress}
              onPointerLeave={liveFlashlight.cancelPress}
              onPointerCancel={liveFlashlight.cancelPress}
              onKelvinInput={(value) => {
                liveFlashlight.setKelvin(value);
                void liveFlashlight.saveSettings({ kelvin: value });
              }}
              onLumensInput={(value) => {
                liveFlashlight.setLumens(value);
                void liveFlashlight.saveSettings({ lumens: value });
              }}
              onPreset={(kelvin, lumens) => {
                void liveFlashlight.applyPreset(kelvin, lumens);
              }}
            />
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
                <MediaActionButtons
                  actions={[
                    { icon: '🖼', label: 'Galeria', onClick: attachFromGallery },
                    { icon: '📷', label: 'Camara', onClick: attachFromCamera },
                    { icon: '🔗', label: 'URL', onClick: () => void attachByUrl() },
                    ...(mediaUrl() ? [{ icon: '✕', label: 'Quitar', onClick: () => setMediaUrl(''), tone: 'danger' as const }] : []),
                  ]}
                  variant="compact"
                  class={styles.composeMediaButtons}
                />
                <input type="text" placeholder="URL media (opcional)" value={mediaUrl()} onInput={(e) => setMediaUrl(sanitizeMediaUrl(e.currentTarget.value))} />
              </div>
              <MediaAttachmentPreview url={mediaUrl()} mediaClass={styles.articleMedia} onOpen={() => setViewerUrl(mediaUrl())} />
              <input type="text" placeholder="Categoria" value={category()} onInput={(e) => setCategory(sanitizeText(e.currentTarget.value, 30))} />
              <div class={styles.actions}>
                <button onClick={() => setShowCompose(false)}>Cancelar</button>
                <button class={styles.primary} onClick={publish}>Publicar</button>
              </div>
            </div>
          </div>
        </Show>

        <AppFAB class={styles.fab} icon="+" onClick={() => setShowCompose(true)} />
        <MediaLightbox url={viewerUrl()} onClose={() => setViewerUrl(null)} />
        <SocialOnboardingModal
          open={showOnboarding()}
          appName="Snap/Noticias"
          usernameHint={myAccount()?.username || ''}
          displayNameHint={myAccount()?.display_name || ''}
          avatarHint={myAccount()?.avatar || ''}
          bioHint={myAccount()?.bio || ''}
          isPrivateHint={myAccount()?.is_private === 1 || myAccount()?.is_private === true}
          onCreate={createSnapAccount}
          onClose={() => setShowOnboarding(false)}
        />
      </div>
    </AppScaffold>
  );
}
