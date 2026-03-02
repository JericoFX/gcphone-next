import { onCleanup } from 'solid-js';
import { isEnvBrowser } from './misc';

interface NuiMessageData<T = unknown> {
  action: string;
  data: T;
}

export function useNuiEvent<T = unknown>(
  action: string,
  handler: (data: T) => void
): void {
  const eventListener = (event: MessageEvent<NuiMessageData<T>>) => {
    const { action: eventAction, data } = event.data;
    
    if (eventAction === action) {
      handler(data);
    }
  };
  
  window.addEventListener('message', eventListener);
  
  onCleanup(() => {
    window.removeEventListener('message', eventListener);
  });
}

export function useNuiCustomEvent<T = unknown>(
  eventName: string,
  handler: (data: T) => void
): void {
  const eventListener = (event: CustomEvent<T>) => {
    handler(event.detail);
  };
  
  window.addEventListener(eventName, eventListener as EventListener);
  
  onCleanup(() => {
    window.removeEventListener(eventName, eventListener as EventListener);
  });
}
