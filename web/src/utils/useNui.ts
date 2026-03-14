import { onCleanup } from 'solid-js';
import { useInternalEvent } from './internalEvents';

interface NuiMessageData<T = unknown> {
  action: string;
  data: T;
}

export function useNuiEvent<T = unknown>(
  action: string,
  handler: (data: T) => void
): void {
  const messageListener = (event: MessageEvent<NuiMessageData<T>>) => {
    const payload = event.data;
    if (!payload || typeof payload !== 'object') return;

    const { action: eventAction, data } = payload;

    if (eventAction === action) {
      handler(data);
    }
  };
  
  window.addEventListener('message', messageListener);
  
  onCleanup(() => {
    window.removeEventListener('message', messageListener);
  });
}

export function useNuiActions<T extends Record<string, unknown>>(
  handlers: Partial<{ [K in keyof T & string]: (data: T[K]) => void }>
): void {
  const messageListener = (event: MessageEvent<{ action?: string; data?: unknown }>) => {
    const payload = event.data;
    if (!payload || typeof payload !== 'object') return;

    const action = typeof payload.action === 'string' ? payload.action : '';
    if (!action) return;

    const handler = handlers[action as keyof T & string];
    if (!handler) return;

    handler(payload.data as T[keyof T & string]);
  };

  window.addEventListener('message', messageListener);

  onCleanup(() => {
    window.removeEventListener('message', messageListener);
  });
}

export function useNuiCustomEvent<T = unknown>(
  eventName: string,
  handler: (data: T) => void
): void {
  useInternalEvent(eventName, handler);
}
