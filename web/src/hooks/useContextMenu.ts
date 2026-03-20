import { createSignal } from 'solid-js';

export function useContextMenu<T>() {
  const [item, setItem] = createSignal<T | null>(null);
  const open = (value: T) => setItem(() => value);
  const close = () => setItem(null);
  const isOpen = () => item() !== null;
  const onContextMenu = (value: T) => (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    open(value);
  };
  return { item, isOpen, open, close, onContextMenu } as const;
}
