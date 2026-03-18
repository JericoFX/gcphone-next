export interface NewsArticle {
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

export interface NewsScaleform {
  preset: 'breaking' | 'ticker' | 'flash';
  headline: string;
  subtitle: string;
  ticker: string;
}

export interface MockLiveMessage {
  id: number;
  rawId?: string;
  authorId?: string;
  user: string;
  text: string;
  at: string;
}

export interface LiveJoinResponse {
  success?: boolean;
  viewers?: number;
  messages?: Array<{ id?: string; authorId?: string; username?: string; display?: string; content?: string; createdAt?: number }>;
}

export interface NewsProfile {
  username?: string;
  display_name?: string;
  avatar?: string;
  bio?: string;
  is_private?: boolean | number;
}

export interface LiveReaction {
  id: number;
  emoji: string;
}

export function articleMediaUrl(article?: NewsArticle | null): string {
  if (!article) return '';
  return article.media_url || article.mediaUrl || '';
}

export function isLiveArticle(article?: NewsArticle | null): boolean {
  if (!article) return false;
  return article.is_live === true || article.is_live === 1;
}

export function articleAuthor(article?: NewsArticle | null): string {
  return article?.author_name || 'Redaccion';
}

export function buildClockTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export const NEWS_MOCK_USERS = ['Cronista', 'Mika', 'Luna', 'Santi', 'Mery'];
export const NEWS_MOCK_LINES = [
  'Cobertura impecable',
  'Gracias por informar en vivo',
  'Se escucha claro',
  'Actualicen sobre trafico por favor',
  'Excelente dato',
  'Se ve la zona desde la camara',
  'Transmision estable',
  'Increible cobertura',
];

export const LIVE_REACTIONS = ['❤️', '🔥', '👏', '😮', '😂'];
