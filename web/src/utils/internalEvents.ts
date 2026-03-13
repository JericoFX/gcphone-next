import { onCleanup, onMount } from 'solid-js';

const INTERNAL_EVENT_NAME = 'gcphone:internal';
const INTERNAL_EVENT_TOKEN = (() => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `gcphone-${Math.random().toString(36).slice(2)}-${Date.now()}`;
})();

interface InternalEventEnvelope<T = unknown> {
  token: string;
  type: string;
  payload: T;
}

function isEnvelope(value: unknown): value is InternalEventEnvelope {
  return !!value && typeof value === 'object'
    && typeof (value as InternalEventEnvelope).token === 'string'
    && typeof (value as InternalEventEnvelope).type === 'string';
}

export function emitInternalEvent<T = unknown>(type: string, payload?: T) {
  window.dispatchEvent(new CustomEvent<InternalEventEnvelope<T>>(INTERNAL_EVENT_NAME, {
    detail: {
      token: INTERNAL_EVENT_TOKEN,
      type,
      payload: payload as T,
    },
  }));
}

export function useInternalEvent<T = unknown>(type: string, handler: (payload: T) => void) {
  onMount(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<InternalEventEnvelope<T>>).detail;
      if (!isEnvelope(detail)) return;
      if (detail.token !== INTERNAL_EVENT_TOKEN) return;
      if (detail.type !== type) return;
      handler(detail.payload);
    };

    window.addEventListener(INTERNAL_EVENT_NAME, listener as EventListener);

    onCleanup(() => {
      window.removeEventListener(INTERNAL_EVENT_NAME, listener as EventListener);
    });
  });
}
