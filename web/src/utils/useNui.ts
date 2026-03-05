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
  const messageListener = (event: MessageEvent<NuiMessageData<T>>) => {
    const { action: eventAction, data } = event.data;
    
    if (eventAction === action) {
      handler(data);
    }
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
  const customEventListener = (event: CustomEvent<T>) => {
    handler(event.detail);
  };
  
  window.addEventListener(eventName, customEventListener as EventListener);
  
  onCleanup(() => {
    window.removeEventListener(eventName, customEventListener as EventListener);
  });
}
