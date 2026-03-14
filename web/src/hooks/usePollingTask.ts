import { createEffect, onCleanup } from 'solid-js';

export function usePollingTask(task: () => void | Promise<void>, intervalMs: () => number, enabled: () => boolean) {
  createEffect(() => {
    if (!enabled()) return;

    void task();

    const timer = window.setInterval(() => {
      void task();
    }, intervalMs());

    onCleanup(() => {
      window.clearInterval(timer);
    });
  });
}
