import { createSignal } from 'solid-js';
import { useInternalEvent } from '../utils/internalEvents';

export interface UseListNavigationOptions<T> {
  onSelect?: (item: T, index: number) => void;
  onActivate?: (item: T, index: number) => void;
  initialIndex?: number;
  loop?: boolean;
}

export function useListNavigation<T>(
  items: () => T[],
  options: UseListNavigationOptions<T> = {}
) {
  const { onSelect, onActivate, initialIndex = -1, loop = false } = options;

  const [selectedIndex, setSelectedIndex] = createSignal(initialIndex);
  const [isActive, setIsActive] = createSignal(false);

  const selectNext = () => {
    const count = items().length;
    if (count === 0) return;

    setSelectedIndex((prev) => {
      if (loop) {
        return (prev + 1) % count;
      }
      return Math.min(prev + 1, count - 1);
    });
  };

  const selectPrev = () => {
    const count = items().length;
    if (count === 0) return;

    setSelectedIndex((prev) => {
      if (loop) {
        return prev <= 0 ? count - 1 : prev - 1;
      }
      return Math.max(prev - 1, 0);
    });
  };

  const selectFirst = () => {
    if (items().length > 0) {
      setSelectedIndex(0);
    }
  };

  const selectLast = () => {
    const count = items().length;
    if (count > 0) {
      setSelectedIndex(count - 1);
    }
  };

  const confirmSelection = () => {
    const idx = selectedIndex();
    const item = items()[idx];
    if (item !== undefined && idx >= 0) {
      onSelect?.(item, idx);
    }
  };

  const reset = () => {
    setSelectedIndex(initialIndex);
    setIsActive(false);
  };

  const handleKeyUp = (key: string) => {
    switch (key) {
      case 'ArrowUp':
        selectPrev();
        setIsActive(true);
        break;
      case 'ArrowDown':
        selectNext();
        setIsActive(true);
        break;
      case 'Enter':
        confirmSelection();
        break;
      case 'Home':
        selectFirst();
        break;
      case 'End':
        selectLast();
        break;
    }
  };

  useInternalEvent('phone:keyUp', handleKeyUp);

  return {
    selectedIndex,
    setSelectedIndex,
    isActive,
    setIsActive,
    selectNext,
    selectPrev,
    selectFirst,
    selectLast,
    confirmSelection,
    reset,
    selectedItem: () => {
      const idx = selectedIndex();
      return idx >= 0 ? items()[idx] : undefined;
    },
  };
}
