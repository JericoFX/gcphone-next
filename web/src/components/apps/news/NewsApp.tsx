import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchNui } from '../../../utils/fetchNui';
import { timeAgo } from '../../../utils/misc';
import { resolveMediaType, sanitizeMediaUrl, sanitizeText } from '../../../utils/sanitize';
import { uiPrompt } from '../../../utils/uiDialog';
import { uiAlert } from '../../../utils/uiAlert';
import { startMockLiveFeed } from '../../../utils/liveMock';
import { usePhoneKeyHandler } from '../../../hooks/usePhoneKeyHandler';
import { useNuiCustomEvent } from '../../../utils/useNui';
import { LiveFlashlightControl } from '../../shared/ui/LiveFlashlightControl';
import { MediaLightbox } from '../../shared/ui/MediaLightbox';
import { MediaActionButtons } from '../../shared/ui/MediaActionButtons';
import { MediaAttachmentPreview } from '../../shared/ui/MediaAttachmentPreview';
import { EmptyState } from '../../shared/ui/EmptyState';
import { Modal, ModalActions, ModalButton } from '../../shared/ui/Modal';
import { SearchInput } from '../../shared/ui/SearchInput';
import { SheetIntro } from '../../shared/ui/SheetIntro';
import { SocialOnboardingModal, type SocialOnboardingPayload } from '../../shared/ui/SocialOnboardingModal';
import { AppFAB, AppScaffold } from '../../shared/layout';
import { useLiveFlashlight } from '../../../hooks/useLiveFlashlight';
import styles from './NewsApp.module.scss';

interface NewsArticle {
  id: number;
  title: string;
  content: string;
  author_name?: string;
  author_avatar?: string;
  author_verified?: boolean | number;
  created_at?: string;
  category?: string;
  media_url?: string;
  mediaUrl?: string;
  is_live?: boolean | number;
  live_viewers?: number;
}

interface NewsScaleform {
  preset: 'breaking' | 'ticker' | 'flash';
  headline: string;
  subtitle: string;
  ticker: string;
}

interface MockLiveMessage {
  id: number;
  rawId?: string;
  authorId?: string;
  user: string;
  text: string;
  at: string;
}

interface LiveJoinResponse {
  success?: boolean;
  viewers?: number;
  messages?: Array<{ id?: string; authorId?: string; username?: string; display?: string; content?: string; createdAt?: number }>;
}

interface NewsProfile {
  username?: string;
  display_name?: string;
  avatar?: string;
  bio?: string;
  is_private?: boolean | number;
}

interface LiveReaction {
  id: number;
  emoji: string;
}

const NEWS_MOCK_USERS = ['Cronista', 'Mika', 'Luna', 'Santi', 'Mery'];
const NEWS_MOCK_LINES = [
  'Cobertura impecable',
  'Gracias por informar en vivo',
  'Se escucha claro',
  'Actualicen sobre trafico por favor',
  'Muy buen trabajo equipo',
];
const LIVE_REACTIONS = ['🔥', '👏', '🛰', '🚨'];

function articleMediaUrl(article?: NewsArticle | null) {
  if (!article) return '';
  return sanitizeMediaUrl(article.media_url || article.mediaUrl || '') || '';
}

function isLiveArticle(article?: NewsArticle | null) {
  return article?.is_live === true || article?.is_live === 1;
}

function articleAuthor(article?: NewsArticle | null) {
  return sanitizeText(article?.author_name || '', 80) || 'Redaccion';
}

function buildClockTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export function NewsApp() {
  const router = useRouter();
  const [articles, setArticles] = createSignal<NewsArticle[]>([]);
  const [liveArticles, setLiveArticles] = createSignal<NewsArticle[]>([]);
  const [categories, setCategories] = createSignal<string[]>(['general']);
  const [selectedCategory, setSelectedCategory] = createSignal('all');
  const [showCompose, setShowCompose] = createSignal(false);
  const [title, setTitle] = createSignal('');
  const [content, setContent] = createSignal('');
  const [mediaUrl, setMediaUrl] = createSignal('');
  const [category, setCategory] = createSignal('general');
  const [liveArticleId, setLiveArticleId] = createSignal<number | null>(null);
  const [joinedLiveId, setJoinedLiveId] = createSignal<number | null>(null);
  const [activeLive, setActiveLive] = createSignal<NewsArticle | null>(null);
  const [liveChatOpen, setLiveChatOpen] = createSignal(false);
  const [liveChatInput, setLiveChatInput] = createSignal('');
  const [liveReactions, setLiveReactions] = createSignal<LiveReaction[]>([]);
  const [viewerMuted, setViewerMuted] = createSignal(false);
  const [viewerUrl, setViewerUrl] = createSignal<string | null>(null);
  const [myAccount, setMyAccount] = createSignal<NewsProfile | null>(null);
  const [showOnboarding, setShowOnboarding] = createSignal(false);
  const [query, setQuery] = createSignal('');
  const [mockLiveEnabled, setMockLiveEnabled] = createSignal(false);
  const [mockLiveMessages, setMockLiveMessages] = createSignal<MockLiveMessage[]>([]);
  const [showProfileModal, setShowProfileModal] = createSignal(false);
  const [profileDisplayName, setProfileDisplayName] = createSignal('');
  const [profileAvatar, setProfileAvatar] = createSignal('');
  const [profileBio, setProfileBio] = createSignal('');
  const [scalePreset, setScalePreset] = createSignal<NewsScaleform['preset']>('breaking');
  const [scaleHeadline, setScaleHeadline] = createSignal('ULTIMO MOMENTO');
  const [scaleSubtitle, setScaleSubtitle] = createSignal('Cobertura en vivo');
  const [scaleTicker, setScaleTicker] = createSignal('Desarrollo en curso...');
  const [statusMessage, setStatusMessage] = createSignal('');
  const liveFlashlight = useLiveFlashlight();

  let stopNewsMock: (() => void) | undefined;

  const refreshScaleform = async (articleId: number) => {
    const sf = await fetchNui<NewsScaleform | null>('newsGetScaleform', { articleId }, null);
    if (!sf) return;
    setScalePreset((sf.preset || 'breaking') as NewsScaleform['preset']);
    setScaleHeadline(sanitizeText(sf.headline || '', 80) || 'ULTIMO MOMENTO');
    setScaleSubtitle(sanitizeText(sf.subtitle || '', 120) || 'Cobertura en vivo');
    setScaleTicker(sanitizeText(sf.ticker || '', 180) || 'Desarrollo en curso...');
  };

  const syncActiveLive = (nextArticles: NewsArticle[], nextLiveArticles: NewsArticle[]) => {
    const current = activeLive();
    if (!current) return;
    const match = [...nextLiveArticles, ...nextArticles].find((entry) => Number(entry.id) === Number(current.id));
    if (match) {
      setActiveLive(match);
      return;
    }
    if (!mockLiveEnabled() && liveArticleId() !== current.id) {
      setActiveLive(null);
      setLiveChatOpen(false);
    }
  };

  const load = async () => {
    const [articleRows, categoryRows, liveRows] = await Promise.all([
      fetchNui<NewsArticle[]>('newsGetArticles', { category: selectedCategory(), limit: 50, offset: 0 }, []),
      fetchNui<string[]>('newsGetCategories', {}, ['general']),
      fetchNui<NewsArticle[]>('newsGetLiveNews', {}, []),
    ]);

    const nextArticles = articleRows || [];
    const nextCategories = categoryRows || ['general'];
    const nextLiveArticles = (liveRows || []).filter((entry) => isLiveArticle(entry));

    setArticles(nextArticles);
    setCategories(nextCategories);
    setLiveArticles(nextLiveArticles);
    syncActiveLive(nextArticles, nextLiveArticles);
  };

  const loadAccount = async () => {
    const account = await fetchNui<NewsProfile | null>('newsGetAccount', {}, null);
    setMyAccount(account);
    setShowOnboarding(!account?.username);
  };

  const pushMockMessage = (user: string, text: string) => {
    const next: MockLiveMessage = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      user,
      text,
      at: buildClockTime(),
    };
    setMockLiveMessages((prev) => [...prev.slice(-19), next]);
  };

  const syncLiveViewerCount = (articleId: number, viewers: number) => {
    const nextViewers = Math.max(0, Math.floor(viewers));
    setArticles((prev) => prev.map((article) => (article.id === articleId ? { ...article, live_viewers: nextViewers } : article)));
    setLiveArticles((prev) => prev.map((article) => (article.id === articleId ? { ...article, live_viewers: nextViewers } : article)));
    setActiveLive((prev) => (prev?.id === articleId ? { ...prev, live_viewers: nextViewers } : prev));
  };

  const leaveJoinedLive = async (articleId = joinedLiveId()) => {
    if (!articleId || articleId === liveArticleId()) {
      if (joinedLiveId() === articleId) setJoinedLiveId(null);
      return;
    }

    await fetchNui('newsLeaveLive', { articleId }, { success: true });
    if (joinedLiveId() === articleId) setJoinedLiveId(null);
  };

  const closeLiveViewer = () => {
    const current = activeLive();
    if (joinedLiveId() && current?.id === joinedLiveId()) {
      void leaveJoinedLive(joinedLiveId());
    }
    if (!current || current.id !== liveArticleId()) {
      void fetchNui('phoneSetVisualMode', { mode: 'text' }, true);
    }
    setActiveLive(null);
    setLiveChatOpen(false);
    setLiveChatInput('');
    setLiveReactions([]);
    setViewerMuted(false);
  };

  const openLiveViewer = async (article: NewsArticle) => {
    if (joinedLiveId() && joinedLiveId() !== article.id) {
      await leaveJoinedLive(joinedLiveId());
    }

    setActiveLive(article);
    setLiveChatOpen(false);
    setViewerMuted(false);
    if (isLiveArticle(article) && article.id > 0 && !mockLiveEnabled()) {
      await refreshScaleform(article.id);

      if (liveArticleId() !== article.id) {
        const joinResult = await fetchNui<LiveJoinResponse>('newsJoinLive', { articleId: article.id }, { success: false });
        if (joinResult?.success) {
          setJoinedLiveId(article.id);
          if (typeof joinResult.viewers === 'number') {
            syncLiveViewerCount(article.id, joinResult.viewers);
          }
          setMockLiveMessages((joinResult.messages || []).map((message) => ({
            id: Number(String(message.id || Date.now()).replace(/\D/g, '').slice(0, 9)) || Date.now(),
            rawId: String(message.id || ''),
            authorId: typeof message.authorId === 'string' ? message.authorId : '',
            user: sanitizeText(message.display || message.username || '', 80) || 'Invitado',
            text: sanitizeText(message.content || '', 180),
            at: message.createdAt ? buildClockTime() : 'ahora',
          })));
        }
      }
    }
  };

  const sendViewerMessage = async () => {
    const text = sanitizeText(liveChatInput(), 180);
    if (!text) return;

    if (mockLiveEnabled()) {
      pushMockMessage(myAccount()?.display_name || myAccount()?.username || 'Tu', text);
      setLiveChatInput('');
      return;
    }

    const articleId = Number(activeLive()?.id || 0);
    if (articleId < 1) return;

    const result = await fetchNui<{ success?: boolean; error?: string }>('newsSendLiveMessage', { articleId, content: text }, { success: false });
    if (result?.error === 'MUTED') {
      setViewerMuted(true);
      return;
    }
    if (!result?.success) return;
    setLiveChatInput('');
  };

  const burstReaction = async (emoji: string) => {
    if (!mockLiveEnabled()) {
      const articleId = Number(activeLive()?.id || 0);
      if (articleId > 0) {
        const result = await fetchNui<{ success?: boolean }>('newsSendLiveReaction', { articleId, reaction: emoji }, { success: false });
        if (!result?.success) return;
      }
    }

    const id = Date.now() + Math.floor(Math.random() * 1000);
    setLiveReactions((prev) => [...prev.slice(-5), { id, emoji }]);
    window.setTimeout(() => {
      setLiveReactions((prev) => prev.filter((entry) => entry.id !== id));
    }, 1600);
  };

  createEffect(() => {
    void load();
  });

  onMount(() => {
    void loadAccount();
  });

  onCleanup(() => {
    void leaveJoinedLive();
  });

  usePhoneKeyHandler({
    Backspace: () => {
      if (viewerUrl()) {
        setViewerUrl(null);
        return;
      }
      if (showCompose()) {
        setShowCompose(false);
        return;
      }
      if (liveChatOpen()) {
        setLiveChatOpen(false);
        return;
      }
      if (activeLive()) {
        closeLiveViewer();
        return;
      }
      router.goBack();
    },
  });

  useNuiCustomEvent('gcphone:news:newArticle', () => {
    void load();
  });

  useNuiCustomEvent<NewsArticle>('gcphone:news:liveStarted', (article) => {
    if (article?.id && liveArticleId() === article.id) {
      setActiveLive(article);
    }
    void load();
  });

  useNuiCustomEvent<number>('gcphone:news:liveEnded', (articleId) => {
    const nextId = Number(articleId || 0);
    if (nextId && liveArticleId() === nextId) setLiveArticleId(null);
    if (nextId && joinedLiveId() === nextId) setJoinedLiveId(null);
    if (nextId && activeLive()?.id === nextId) closeLiveViewer();
    void load();
  });

  useNuiCustomEvent<{ articleId?: number; scaleform?: NewsScaleform }>('gcphone:news:scaleformUpdated', (payload) => {
    const nextId = Number(payload?.articleId || activeLive()?.id || 0);
    if (nextId > 0 && payload?.scaleform) {
      setScalePreset((payload.scaleform.preset || 'breaking') as NewsScaleform['preset']);
      setScaleHeadline(sanitizeText(payload.scaleform.headline || '', 80) || 'ULTIMO MOMENTO');
      setScaleSubtitle(sanitizeText(payload.scaleform.subtitle || '', 120) || 'Cobertura en vivo');
      setScaleTicker(sanitizeText(payload.scaleform.ticker || '', 180) || 'Desarrollo en curso...');
      return;
    }
    if (nextId > 0) {
      void refreshScaleform(nextId);
    }
  });

  useNuiCustomEvent<{ articleId?: number; viewers?: number }>('gcphone:news:viewersUpdated', (payload) => {
    const articleId = Number(payload?.articleId || 0);
    const viewers = Number(payload?.viewers ?? -1);
    if (articleId > 0 && viewers >= 0) {
      syncLiveViewerCount(articleId, viewers);
    }
  });

  useNuiCustomEvent<{ articleId?: number; message?: { id?: string; authorId?: string; username?: string; display?: string; content?: string; createdAt?: number } }>('gcphone:news:liveMessage', (payload) => {
    const articleId = Number(payload?.articleId || 0);
    if (articleId < 1 || activeLive()?.id !== articleId || !payload?.message) return;

    const when = payload.message.createdAt ? new Date(payload.message.createdAt) : new Date();
    const at = `${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}`;
    setMockLiveMessages((prev) => [...prev.slice(-19), {
      id: Number(String(payload.message?.id || Date.now()).replace(/\D/g, '').slice(0, 9)) || Date.now(),
      rawId: String(payload.message?.id || ''),
      authorId: typeof payload.message?.authorId === 'string' ? payload.message.authorId : '',
      user: sanitizeText(payload.message.display || payload.message.username || '', 80) || 'Invitado',
      text: sanitizeText(payload.message.content || '', 180),
      at,
    }]);
  });

  useNuiCustomEvent<{ articleId?: number; reaction?: { reaction?: string } }>('gcphone:news:liveReaction', (payload) => {
    const articleId = Number(payload?.articleId || 0);
    const reaction = sanitizeText(payload?.reaction?.reaction || '', 8);
    if (articleId < 1 || activeLive()?.id !== articleId || !reaction) return;

    const id = Date.now() + Math.floor(Math.random() * 1000);
    setLiveReactions((prev) => [...prev.slice(-5), { id, emoji: reaction }]);
    window.setTimeout(() => {
      setLiveReactions((prev) => prev.filter((entry) => entry.id !== id));
    }, 1600);
  });

  useNuiCustomEvent<{ articleId?: number; messageId?: string }>('gcphone:news:liveMessageRemoved', (payload) => {
    const articleId = Number(payload?.articleId || 0);
    const messageId = String(payload?.messageId || '');
    if (articleId < 1 || activeLive()?.id !== articleId || !messageId) return;
    setMockLiveMessages((prev) => prev.filter((entry) => entry.rawId !== messageId));
  });

  useNuiCustomEvent<{ articleId?: number; username?: string }>('gcphone:news:liveUserMuted', (payload) => {
    const articleId = Number(payload?.articleId || 0);
    const username = sanitizeText(payload?.username || '', 40).toLowerCase();
    if (articleId < 1 || activeLive()?.id !== articleId || !username) return;
    if (sanitizeText(myAccount()?.username || '', 40).toLowerCase() === username) {
      setViewerMuted(true);
    }
  });

  const removeLiveMessage = async (messageId: string) => {
    const articleId = Number(activeLive()?.id || 0);
    if (articleId < 1 || !messageId) return;
    await fetchNui('newsRemoveLiveMessage', { articleId, messageId }, { success: false });
  };

  const muteLiveUser = async (entry: MockLiveMessage) => {
    const articleId = Number(activeLive()?.id || 0);
    if (articleId < 1 || !entry.authorId || !entry.user) return;
    await fetchNui('newsMuteLiveUser', { articleId, targetIdentifier: entry.authorId, username: entry.user }, { success: false });
  };

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
      mediaUrl: nextMedia || undefined,
    });

    if (!result?.success) return;

    setShowCompose(false);
    setTitle('');
    setContent('');
    setMediaUrl('');
    setCategory('general');
    setStatusMessage('Noticia publicada');
    await load();
  };

  const attachFromGallery = async () => {
    const gallery = await fetchNui<Array<{ url?: string }>>('getGallery', undefined, []);
    const nextUrl = sanitizeMediaUrl(gallery?.[0]?.url || '');
    if (nextUrl) setMediaUrl(nextUrl);
  };

  const attachFromCamera = async () => {
    const shot = await fetchNui<{ url?: string }>('takePhoto', {}, { url: '' });
    const nextUrl = sanitizeMediaUrl(shot?.url || '');
    if (nextUrl) {
      setMediaUrl(nextUrl);
      return;
    }
    await attachFromGallery();
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
      if (!result?.success) return;
      await fetchNui('phoneSetVisualMode', { mode: 'text' }, true);
      liveFlashlight.setPanelOpen(false);
      await liveFlashlight.turnOff();
      setLiveArticleId(null);
      setStatusMessage('Live finalizado');
      closeLiveViewer();
      await load();
      return;
    }

    const nextTitle = sanitizeText(title(), 200) || 'Transmision en vivo';
    const nextContent = sanitizeText(content(), 3000) || 'Cobertura en vivo';
    const nextCategory = sanitizeText(category(), 30) || 'general';

    const result = await fetchNui<{ success?: boolean; articleId?: number }>('newsStartLive', {
      title: nextTitle,
      content: nextContent,
      category: nextCategory,
      scaleform: {
        preset: scalePreset(),
        headline: sanitizeText(scaleHeadline(), 80),
        subtitle: sanitizeText(scaleSubtitle(), 120),
        ticker: sanitizeText(scaleTicker(), 180),
      },
    });

    if (!result?.success || !result.articleId) return;

    await fetchNui('phoneSetVisualMode', { mode: 'live' }, true);
    setLiveArticleId(result.articleId);
    setStatusMessage('Live iniciado');
    const nextLive: NewsArticle = {
      id: result.articleId,
      title: nextTitle,
      content: nextContent,
      category: nextCategory,
      author_name: myAccount()?.display_name || myAccount()?.username || 'Redaccion',
      author_avatar: myAccount()?.avatar,
      created_at: new Date().toISOString(),
      is_live: true,
      live_viewers: 0,
    };
    setActiveLive(nextLive);
    await refreshScaleform(result.articleId);
    await load();
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
      setStatusMessage('Grafica del live actualizada');
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
      if (activeLive()?.id === -1) closeLiveViewer();
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
    setActiveLive({
      id: -1,
      title: sanitizeText(title(), 200) || 'Mock live de noticias',
      content: sanitizeText(content(), 3000) || 'Vista previa local del directo',
      category: sanitizeText(category(), 30) || 'general',
      author_name: myAccount()?.display_name || myAccount()?.username || 'Redaccion',
      author_avatar: myAccount()?.avatar,
      created_at: new Date().toISOString(),
      is_live: true,
      live_viewers: 12,
    });
  };

  const editProfile = async () => {
    const account = myAccount() || await fetchNui<NewsProfile | null>('newsGetAccount', {}, null);
    if (!account?.username) {
      setShowOnboarding(true);
      return;
    }
    if (!account) return;

    setProfileDisplayName(account.display_name || '');
    setProfileAvatar(account.avatar || '');
    setProfileBio(account.bio || '');
    setShowProfileModal(true);
  };

  const saveProfile = async () => {
    const ok = await fetchNui<{ success?: boolean }>('newsUpdateAccount', {
      displayName: sanitizeText(profileDisplayName(), 50),
      avatar: sanitizeMediaUrl(profileAvatar()) || undefined,
      bio: sanitizeText(profileBio(), 180) || undefined,
      isPrivate: false,
    });
    if (ok?.success) {
      setShowProfileModal(false);
      setStatusMessage('Perfil actualizado');
      await loadAccount();
    }
  };

  const attachProfileFromGallery = async () => {
    const gallery = await fetchNui<Array<{ url?: string }>>('getGallery', undefined, []);
    const image = gallery?.find((item) => item?.url && resolveMediaType(item.url) === 'image');
    if (image?.url) {
      setProfileAvatar(sanitizeMediaUrl(image.url) || '');
      return;
    }
    uiAlert('No se encontraron imagenes en la galeria');
  };

  const attachProfileFromCamera = async () => {
    const shot = await fetchNui<{ url?: string }>('takePhoto', {}, { url: '' });
    const nextUrl = sanitizeMediaUrl(shot?.url || '');
    if (nextUrl) {
      setProfileAvatar(nextUrl);
      return;
    }
    await attachProfileFromGallery();
  };

  const createNewsAccount = async (payload: SocialOnboardingPayload) => {
    const avatar = sanitizeMediaUrl(payload.avatar) || '';
    const bio = sanitizeText(payload.bio, 180);

    const response = await fetchNui<{ success?: boolean; error?: string }>('newsCreateAccount', {
      username: payload.username,
      displayName: payload.displayName,
      avatar,
    }, { success: false });

    if (!response?.success) {
      return { ok: false, error: response?.error || 'No se pudo crear el perfil de Noticias.' };
    }

    const updated = await fetchNui<{ success?: boolean }>('newsUpdateAccount', {
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

  const featuredLives = createMemo(() => {
    const current = activeLive();
    const next = [...liveArticles()];
    if (current && isLiveArticle(current) && !next.some((entry) => Number(entry.id) === Number(current.id))) {
      next.unshift(current);
    }
    return next;
  });

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

  const canEditActiveLive = createMemo(() => {
    const current = activeLive();
    if (!current) return false;
    return mockLiveEnabled() || (liveArticleId() !== null && current.id === liveArticleId());
  });

  const activeLiveStatus = createMemo(() => {
    if (mockLiveEnabled()) return 'MOCK LIVE';
    if (activeLive() && activeLive()!.id === liveArticleId()) return 'TU SENAL';
    return 'EN VIVO';
  });

  const activeLiveViewerCount = createMemo(() => {
    if (mockLiveEnabled()) return Math.max(12, mockLiveMessages().length + 9);
    const current = activeLive();
    return Math.max(Number(current?.live_viewers || 0), canEditActiveLive() ? 1 : 0);
  });

  const floatingMessages = createMemo(() => mockLiveMessages().slice(-3));
  const activeLiveMedia = createMemo(() => articleMediaUrl(activeLive()));

  return (
    <AppScaffold title="Noticias" subtitle="Noticias de la ciudad" onBack={() => router.goBack()}>
      <div class={styles.newsApp}>
        <Show when={statusMessage()}>
          <div class={styles.statusBanner}>{statusMessage()}</div>
        </Show>

        <div class={styles.searchRow}>
          <SearchInput
            value={query()}
            onInput={setQuery}
            placeholder="Buscar titulares, autores o coberturas"
            class={styles.searchInputRoot}
            inputClass={styles.searchInput}
          />
        </div>

        <div class={styles.tools}>
          <select class={styles.categorySelect} value={selectedCategory()} onChange={(event) => setSelectedCategory(event.currentTarget.value)}>
            <option value="all">Todas</option>
            <For each={categories()}>{(entry) => <option value={entry}>{entry}</option>}</For>
          </select>
          <div class={styles.liveActions}>
            <button class={styles.liveBtn} onClick={() => void toggleLive()}>{liveArticleId() ? 'Terminar live' : 'Iniciar live'}</button>
            <button class={styles.mockBtn} onClick={toggleMockLive}>{mockLiveEnabled() ? 'Mock off' : 'Mock live'}</button>
            <button class={styles.profileBtn} onClick={() => void editProfile()}>Perfil</button>
          </div>
        </div>

        <Show when={featuredLives().length > 0}>
          <section class={styles.liveRail}>
            <div class={styles.liveRailHeader}>
              <strong>En vivo</strong>
              <span>Sigue coberturas activas, entra al directo y vuelve al feed cuando quieras.</span>
            </div>
            <div class={styles.liveRailList}>
              <For each={featuredLives()}>
                {(article) => (
                  <button class={styles.liveRailCard} onClick={() => void openLiveViewer(article)}>
                    <div class={styles.liveRailThumb}>
                      <Show when={articleMediaUrl(article)} fallback={<div class={styles.liveRailFallback}>LIVE</div>}>
                        <img src={articleMediaUrl(article)} alt={article.title} />
                      </Show>
                      <span class={styles.liveRailBadge}>{Number(article.live_viewers || 0) || (article.id === -1 ? 12 : 1)} viendo</span>
                    </div>
                    <div class={styles.liveRailBody}>
                      <strong>{sanitizeText(article.title || '', 90) || 'Cobertura en vivo'}</strong>
                      <span>{articleAuthor(article)}</span>
                    </div>
                  </button>
                )}
              </For>
            </div>
          </section>
        </Show>

        <div class={styles.feed}>
          <For each={visibleArticles()}>
            {(article) => (
              <article class={styles.card} onClick={() => void (isLiveArticle(article) ? openLiveViewer(article) : viewArticle(article.id))}>
                <div class={styles.meta}>
                  <span>{articleAuthor(article)}</span>
                  <span>{article.created_at ? timeAgo(article.created_at) : 'ahora'}</span>
                </div>
                <strong>{article.title}</strong>
                <Show when={isLiveArticle(article)}>
                  <div class={styles.cardLiveBadge}>LIVE · {Number(article.live_viewers || 0)} viendo</div>
                </Show>
                <Show when={articleMediaUrl(article)}>
                  <Show when={resolveMediaType(articleMediaUrl(article)) === 'image'}>
                    <img
                      class={styles.articleMedia}
                      src={articleMediaUrl(article)}
                      alt="media"
                      onClick={(event) => {
                        event.stopPropagation();
                        setViewerUrl(articleMediaUrl(article));
                      }}
                    />
                  </Show>
                  <Show when={resolveMediaType(articleMediaUrl(article)) === 'video'}>
                    <video class={styles.articleMedia} src={articleMediaUrl(article)} controls playsinline preload="metadata" />
                  </Show>
                </Show>
                <p>{article.content}</p>
                <small>{article.category || 'general'}</small>
                <button class={styles.deleteBtn} onClick={(event) => { event.stopPropagation(); void deleteArticle(article.id); }}>Eliminar</button>
              </article>
            )}
          </For>
          <Show when={visibleArticles().length === 0}>
            <EmptyState class={styles.emptyState} title="Sin noticias por ahora" description="Prueba otra categoria o publica una nueva cobertura." />
          </Show>
        </div>

        <Modal open={showCompose()} title="Publicar noticia" onClose={() => setShowCompose(false)} size="lg">
          <div class={styles.modalContent}>
            <SheetIntro title="Nueva cobertura" description="Publica un titular claro, agrega contexto y adjunta media si ayuda a contar la historia." />
            <input type="text" placeholder="Titulo" value={title()} onInput={(event) => setTitle(event.currentTarget.value)} />
            <textarea placeholder="Contenido" value={content()} onInput={(event) => setContent(event.currentTarget.value)} />
            <div class={styles.composeAttachments}>
              <MediaActionButtons
                actions={[
                  { icon: './img/icons_ios/gallery.svg', label: 'Galeria', onClick: attachFromGallery },
                  { icon: './img/icons_ios/camera.svg', label: 'Camara', onClick: attachFromCamera },
                  { icon: './img/icons_ios/ui-link.svg', label: 'URL', onClick: () => void attachByUrl() },
                  ...(mediaUrl() ? [{ icon: './img/icons_ios/ui-close.svg', label: 'Quitar', onClick: () => setMediaUrl(''), tone: 'danger' as const }] : []),
                ]}
                variant="compact"
                class={styles.composeMediaButtons}
              />
              <input type="text" placeholder="URL media (opcional)" value={mediaUrl()} onInput={(event) => setMediaUrl(sanitizeMediaUrl(event.currentTarget.value))} />
            </div>
            <MediaAttachmentPreview url={mediaUrl()} mediaClass={styles.composePreviewMedia} onOpen={() => setViewerUrl(mediaUrl())} />
            <input type="text" placeholder="Categoria" value={category()} onInput={(event) => setCategory(sanitizeText(event.currentTarget.value, 30))} />
            <ModalActions>
              <ModalButton label="Cancelar" onClick={() => setShowCompose(false)} />
              <ModalButton label="Publicar" tone="primary" onClick={() => void publish()} />
            </ModalActions>
          </div>
        </Modal>

        <Modal open={showProfileModal()} title="Perfil de Noticias" onClose={() => setShowProfileModal(false)} size="md">
          <div class={styles.modalContent}>
            <SheetIntro title="Perfil editorial" description="Actualiza tu firma visible y el avatar con el que apareceras en las coberturas." />
            <input
              type="text"
              placeholder="Nombre visible"
              value={profileDisplayName()}
              onInput={(event) => setProfileDisplayName(event.currentTarget.value)}
            />
            <textarea
              placeholder="Bio o firma editorial"
              value={profileBio()}
              onInput={(event) => setProfileBio(event.currentTarget.value)}
            />
            <div class={styles.composeAttachments}>
              <MediaActionButtons
                actions={[
                  { icon: './img/icons_ios/gallery.svg', label: 'Galeria', onClick: attachProfileFromGallery },
                  { icon: './img/icons_ios/camera.svg', label: 'Camara', onClick: attachProfileFromCamera },
                  ...(profileAvatar() ? [{ icon: './img/icons_ios/ui-close.svg', label: 'Quitar', onClick: () => setProfileAvatar(''), tone: 'danger' as const }] : []),
                ]}
                variant="compact"
                class={styles.composeMediaButtons}
              />
              <input type="text" placeholder="URL de avatar" value={profileAvatar()} onInput={(event) => setProfileAvatar(sanitizeMediaUrl(event.currentTarget.value) || '')} />
            </div>
            <MediaAttachmentPreview url={profileAvatar()} mediaClass={styles.composePreviewMedia} onOpen={() => setViewerUrl(profileAvatar())} />
            <ModalActions>
              <ModalButton label="Cancelar" onClick={() => setShowProfileModal(false)} />
              <ModalButton label="Guardar perfil" tone="primary" onClick={() => void saveProfile()} />
            </ModalActions>
          </div>
        </Modal>

        <Show when={activeLive()}>
          <div class={styles.liveViewer}>
            <div class={styles.liveTopBar}>
              <button class={styles.liveUtilityButton} onClick={closeLiveViewer}><img src="./img/icons_ios/ui-close.svg" alt="" draggable={false} /></button>
              <div class={styles.liveOwnerInfo}>
                <strong>{articleAuthor(activeLive())}</strong>
                <span>{activeLiveStatus()}</span>
              </div>
              <div class={styles.liveTopBarRight}>
                <span class={styles.liveViewerCount}>{activeLiveViewerCount()} viendo</span>
                <LiveFlashlightControl
                  visible={liveFlashlight.supported() && canEditActiveLive()}
                  enabled={liveFlashlight.enabled()}
                  panelOpen={liveFlashlight.panelOpen()}
                  kelvin={liveFlashlight.kelvin()}
                  lumens={liveFlashlight.lumens()}
                  kelvinRange={liveFlashlight.kelvinRange()}
                  lumensRange={liveFlashlight.lumensRange()}
                  theme="dark"
                  variant="circle"
                  buttonLabel={<img src="./img/icons_ios/ui-flashlight.svg" alt="" draggable={false} />}
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
                <button class={styles.liveUtilityButton} onClick={() => setLiveChatOpen((value) => !value)}><img src="./img/icons_ios/ui-chat.svg" alt="" draggable={false} /></button>
              </div>
            </div>

            <div class={styles.liveStage}>
              <Show when={activeLiveMedia()} fallback={<div class={styles.liveStageFallback}>Sin video conectado todavia</div>}>
                <Show when={resolveMediaType(activeLiveMedia()) === 'image'} fallback={<video class={styles.liveStageMedia} src={activeLiveMedia()} autoplay muted loop playsinline />}>
                  <img class={styles.liveStageMedia} src={activeLiveMedia()} alt={activeLive()?.title || 'Live'} />
                </Show>
              </Show>

              <div class={styles.liveStageOverlay}>
                <div class={styles.liveBadge}>{activeLiveStatus()}</div>
                <div class={styles.liveStageText}>
                  <strong>{sanitizeText(scaleHeadline(), 80) || sanitizeText(activeLive()?.title || '', 80) || 'ULTIMO MOMENTO'}</strong>
                  <span>{sanitizeText(scaleSubtitle(), 120) || sanitizeText(activeLive()?.content || '', 120) || 'Cobertura en vivo'}</span>
                  <p>{sanitizeText(activeLive()?.content || '', 180)}</p>
                </div>
                <div class={styles.liveTicker}>{sanitizeText(scaleTicker(), 180) || 'Desarrollo en curso...'}</div>
              </div>

              <div class={styles.liveFloatingLayer}>
                <For each={floatingMessages()}>
                  {(entry) => (
                    <div class={styles.liveFloatingMessage}>
                      <strong>{entry.user}</strong>
                      <p>{entry.text}</p>
                    </div>
                  )}
                </For>
                <For each={liveReactions()}>
                  {(entry) => <div class={styles.liveReactionBubble}>{entry.emoji}</div>}
                </For>
              </div>

              <div class={styles.liveReactionRow}>
                <For each={LIVE_REACTIONS}>
                  {(emoji) => <button onClick={() => burstReaction(emoji)}>{emoji}</button>}
                </For>
              </div>
            </div>

            <Show when={liveChatOpen()}>
              <aside class={styles.liveChatPanel}>
                <div class={styles.liveChatHeader}>
                  <strong>Chat y control</strong>
                  <span>{sanitizeText(activeLive()?.title || '', 80) || 'Cobertura en vivo'}</span>
                </div>

                <Show when={canEditActiveLive()}>
                  <div class={styles.liveScaleformPanel}>
                    <select value={scalePreset()} onChange={(event) => setScalePreset(event.currentTarget.value as NewsScaleform['preset'])}>
                      <option value="breaking">Breaking</option>
                      <option value="ticker">Ticker</option>
                      <option value="flash">Flash</option>
                    </select>
                    <input value={scaleHeadline()} onInput={(event) => setScaleHeadline(sanitizeText(event.currentTarget.value, 80))} placeholder="Headline" />
                    <input value={scaleSubtitle()} onInput={(event) => setScaleSubtitle(sanitizeText(event.currentTarget.value, 120))} placeholder="Subtitle" />
                    <input value={scaleTicker()} onInput={(event) => setScaleTicker(sanitizeText(event.currentTarget.value, 180))} placeholder="Ticker" />
                    <button onClick={() => void applyScaleform()} disabled={!liveArticleId()}>Aplicar al live</button>
                  </div>
                </Show>

                <div class={styles.liveChatList}>
                  <For each={mockLiveMessages()}>
                    {(entry) => (
                      <div class={styles.liveChatItem}>
                        <div class={styles.liveChatBody}>
                          <strong>{entry.user}</strong>
                          <p>{entry.text}</p>
                        </div>
                        <Show when={canEditActiveLive() && entry.authorId && sanitizeText(myAccount()?.username || '', 40) !== sanitizeText(entry.user || '', 40)}>
                          <div class={styles.liveModerationCol}>
                            <button onClick={() => void removeLiveMessage(entry.rawId || '')}><img src="./img/icons_ios/ui-trash.svg" alt="" draggable={false} /></button>
                            <button onClick={() => void muteLiveUser(entry)}><img src="./img/icons_ios/ui-block.svg" alt="" draggable={false} /></button>
                          </div>
                        </Show>
                        <small>{entry.at}</small>
                      </div>
                    )}
                  </For>
                </div>

                <Show when={viewerMuted()}>
                  <div class={styles.liveMutedBanner}>Estas silenciado en este live</div>
                </Show>

                <div class={styles.liveChatInputRow}>
                  <input
                    value={liveChatInput()}
                    onInput={(event) => setLiveChatInput(event.currentTarget.value)}
                    placeholder="Escribe un comentario para el directo"
                    disabled={viewerMuted()}
                  />
                  <button onClick={() => void sendViewerMessage()} disabled={viewerMuted() || !liveChatInput().trim()}>Enviar</button>
                </div>
              </aside>
            </Show>
          </div>
        </Show>

        <AppFAB class={styles.fab} icon="+" onClick={() => setShowCompose(true)} />
        <MediaLightbox url={viewerUrl()} onClose={() => setViewerUrl(null)} />
        <SocialOnboardingModal
          open={showOnboarding()}
          appName="Noticias"
          usernameHint={myAccount()?.username || ''}
          displayNameHint={myAccount()?.display_name || ''}
          avatarHint={myAccount()?.avatar || ''}
          bioHint={myAccount()?.bio || ''}
          isPrivateHint={myAccount()?.is_private === 1 || myAccount()?.is_private === true}
          onCreate={createNewsAccount}
          onClose={() => setShowOnboarding(false)}
        />
      </div>
    </AppScaffold>
  );
}
