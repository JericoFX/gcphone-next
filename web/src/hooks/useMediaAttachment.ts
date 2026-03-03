import { createSignal } from 'solid-js';
import { fetchNui } from '@/utils/fetchNui';
import { sanitizeMediaUrl } from '@/utils/sanitize';

export interface UseMediaAttachmentOptions {
  onAttached?: (url: string) => void;
  onRemoved?: () => void;
  onError?: (message: string) => void;
}

export function useMediaAttachment(options: UseMediaAttachmentOptions = {}) {
  const [mediaUrl, setMediaUrl] = createSignal<string | null>(null);
  const [mediaType, setMediaType] = createSignal<'image' | 'video' | 'audio' | null>(null);

  const detectMediaType = (url: string): 'image' | 'video' | 'audio' | null => {
    if (/\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(url)) return 'image';
    if (/\.(mp4|webm|mov|m3u8)(\?.*)?$/i.test(url)) return 'video';
    if (/\.(mp3|ogg|wav|m4a|aac)(\?.*)?$/i.test(url)) return 'audio';
    return null;
  };

  const attachFromGallery = async () => {
    try {
      const gallery = await fetchNui<{ url: string }[]>('getGallery', undefined, []);
      if (gallery && gallery.length > 0) {
        const nextUrl = sanitizeMediaUrl(gallery[0].url);
        if (nextUrl) {
          setMediaUrl(nextUrl);
          setMediaType(detectMediaType(nextUrl));
          options.onAttached?.(nextUrl);
          return true;
        }
      }
      options.onError?.('No hay imagenes en la galeria');
      return false;
    } catch {
      options.onError?.('Error al acceder a la galeria');
      return false;
    }
  };

  const attachFromCamera = async () => {
    try {
      const shot = await fetchNui<{ url?: string }>('takePhoto', {} as any, { url: '' });
      if (shot?.url) {
        const nextUrl = sanitizeMediaUrl(shot.url);
        if (nextUrl) {
          setMediaUrl(nextUrl);
          setMediaType(detectMediaType(nextUrl));
          options.onAttached?.(nextUrl);
          return true;
        }
      }
      return await attachFromGallery();
    } catch {
      return await attachFromGallery();
    }
  };

  const attachByUrl = () => {
    const input = window.prompt('Pega URL de imagen, video o audio');
    if (!input?.trim()) return false;

    const nextUrl = sanitizeMediaUrl(input.trim());
    if (nextUrl) {
      setMediaUrl(nextUrl);
      setMediaType(detectMediaType(nextUrl));
      options.onAttached?.(nextUrl);
      return true;
    }

    window.alert('URL invalida o formato no permitido');
    options.onError?.('URL invalida');
    return false;
  };

  const clearAttachment = () => {
    setMediaUrl(null);
    setMediaType(null);
    options.onRemoved?.();
  };

  const setAttachment = (url: string | null) => {
    if (url) {
      const sanitized = sanitizeMediaUrl(url);
      if (sanitized) {
        setMediaUrl(sanitized);
        setMediaType(detectMediaType(sanitized));
        options.onAttached?.(sanitized);
      }
    } else {
      clearAttachment();
    }
  };

  return {
    mediaUrl,
    mediaType,
    attachFromGallery,
    attachFromCamera,
    attachByUrl,
    clearAttachment,
    setAttachment,
  };
}
