import { fetchNui } from './fetchNui';

let pendingResolve: ((base64: string) => void) | null = null;

export function setupMugshotListener() {
  window.addEventListener('message', (event) => {
    if (event.data?.action !== 'convertMugshot') return;
    const url = event.data.url as string;
    if (!url) {
      void fetchNui('mugshotResult', { base64: '' });
      return;
    }

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        void fetchNui('mugshotResult', { base64: '' });
        if (pendingResolve) { pendingResolve(''); pendingResolve = null; }
        return;
      }
      ctx.drawImage(img, 0, 0);
      const base64 = canvas.toDataURL('image/png');
      canvas.remove();
      void fetchNui('mugshotResult', { base64 });
      if (pendingResolve) { pendingResolve(base64); pendingResolve = null; }
    };
    img.onerror = () => {
      void fetchNui('mugshotResult', { base64: '' });
      if (pendingResolve) { pendingResolve(''); pendingResolve = null; }
    };
    img.src = url;
  });
}

export async function requestMugshot(): Promise<string> {
  return new Promise((resolve) => {
    pendingResolve = resolve;
    void fetchNui('captureMugshot', {});
  });
}
