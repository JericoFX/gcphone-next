import { t } from '../../../i18n';

export interface RadioStation {
  id: number;
  hostName: string;
  stationName: string;
  description: string;
  category: string;
  livekitRoom: string;
  listenerCount: number;
  createdAt: number;
}

export interface CreateStationResult {
  success: boolean;
  station?: RadioStation;
  error?: string;
}

export interface JoinStationResult {
  success: boolean;
  station?: RadioStation;
  error?: string;
}

export interface MusicSearchResult {
  videoId: string;
  title: string;
  channel: string;
  thumbnail: string;
}

export interface MusicSearchResponse {
  success: boolean;
  results: MusicSearchResult[];
  error?: string;
}

export type RadioView = 'list' | 'create' | 'broadcasting' | 'listening';

export const CATEGORIES = ['music', 'news', 'talk', 'emergency', 'community', 'other'] as const;
export const MAX_QUEUE_SIZE = 10;

const CATEGORY_GRADIENTS: Record<string, string> = {
  music: 'linear-gradient(135deg, #ff2d55, #ff6482)',
  news: 'linear-gradient(135deg, #007aff, #5ac8fa)',
  talk: 'linear-gradient(135deg, #5856d6, #af52de)',
  emergency: 'linear-gradient(135deg, #ff3b30, #ff9500)',
  community: 'linear-gradient(135deg, #34c759, #30d158)',
  other: 'linear-gradient(135deg, #8e8e93, #aeaeb2)',
};

const CATEGORY_ICONS: Record<string, string> = {
  music: './img/icons_ios/music.svg',
  news: './img/icons_ios/news.svg',
  talk: './img/icons_ios/ui-chat.svg',
  emergency: './img/icons_ios/phone-solid.svg',
  community: './img/icons_ios/contacts.svg',
  other: './img/icons_ios/radio.svg',
};

export function getCategoryGradient(category: string): string {
  return CATEGORY_GRADIENTS[category] || CATEGORY_GRADIENTS.other;
}

export function getCategoryIcon(category: string): string {
  return CATEGORY_ICONS[category] || CATEGORY_ICONS.other;
}

export function getCategoryLabel(category: string, language: string): string {
  const v = t('radio.category.' + category, language);
  return v === 'radio.category.' + category ? category : v;
}
