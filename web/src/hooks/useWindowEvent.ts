import { onCleanup, onMount } from 'solid-js';

export function useWindowEvent<T extends Event = Event>(
  type: string,
  listener: (event: T) => void,
  options?: boolean | AddEventListenerOptions,
) {
  onMount(() => {
    window.addEventListener(type, listener as EventListener, options);

    onCleanup(() => {
      window.removeEventListener(type, listener as EventListener, options);
    });
  });
}
