import { onCleanup } from 'solid-js';

interface LongPressOptions {
  delay?: number;
  onLongPress: () => void;
  onPress?: () => void;
}

export function useLongPress(options: LongPressOptions) {
  const delay = options.delay ?? 500;
  let timer: number | undefined;
  let triggered = false;
  let startX = 0;
  let startY = 0;

  const clear = () => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  };

  const onPointerDown = (e: PointerEvent) => {
    triggered = false;
    startX = e.clientX;
    startY = e.clientY;
    clear();
    timer = window.setTimeout(() => {
      triggered = true;
      options.onLongPress();
    }, delay);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (timer === undefined) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (dx * dx + dy * dy > 100) {
      clear();
    }
  };

  const onPointerUp = () => {
    const wasLongPress = triggered;
    clear();
    triggered = false;
    if (!wasLongPress && options.onPress) {
      options.onPress();
    }
  };

  const onPointerCancel = () => {
    clear();
    triggered = false;
  };

  onCleanup(clear);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    wasLongPress: () => triggered,
  };
}
