const HTTP_URL_REGEX = /^https?:\/\/[^\s]+$/i;
const RELATIVE_URL_REGEX = /^(?:\.\/|\/)[^\s]+$/;
const MEDIA_EXT_REGEX = /\.(png|jpe?g|webp|gif|mp4|webm|mov|m3u8|mp3|ogg|wav|m4a|aac)(\?.*)?$/i;

function stripControlChars(value: string): string {
  return value.replace(/[\u0000-\u001F\u007F]/g, '');
}

export function sanitizeText(input: unknown, maxLength = 500): string {
  if (typeof input !== 'string') return '';
  const trimmed = stripControlChars(input).trim();
  const noTags = trimmed.replace(/<[^>]*>/g, '');
  return noTags.slice(0, maxLength);
}

export function sanitizePhone(input: unknown): string {
  if (typeof input !== 'string') return '';
  return stripControlChars(input).replace(/[^0-9+\-()\s]/g, '').trim().slice(0, 20);
}

export function sanitizeUrl(input: unknown): string {
  if (typeof input !== 'string') return '';
  const value = stripControlChars(input).trim();
  if (!HTTP_URL_REGEX.test(value)) return '';
  return value.slice(0, 500);
}

export function sanitizeMediaUrl(input: unknown): string {
  if (typeof input !== 'string') return '';
  const value = stripControlChars(input).trim();
  if (!value) return '';
  if (!HTTP_URL_REGEX.test(value) && !RELATIVE_URL_REGEX.test(value)) return '';
  if (!MEDIA_EXT_REGEX.test(value)) return '';
  return value.slice(0, 500);
}

export function isImageUrl(url: string): boolean {
  return /\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(url);
}

export function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m3u8)(\?.*)?$/i.test(url);
}

export function isAudioUrl(url: string): boolean {
  return /\.(mp3|ogg|wav|m4a|aac|webm)(\?.*)?$/i.test(url);
}

export function resolveMediaType(url?: string): 'image' | 'video' | 'audio' | null {
  if (!url) return null;
  if (isImageUrl(url)) return 'image';
  if (isVideoUrl(url)) return 'video';
  if (isAudioUrl(url)) return 'audio';
  return null;
}
