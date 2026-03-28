import { createSignal, onCleanup } from 'solid-js';

interface DragAndDropOptions {
  items: () => string[];
  gridRef: () => HTMLElement | undefined;
  onReorder: (itemId: string, targetIndex: number) => void;
  onFolderMerge: (draggedId: string, targetId: string) => void;
  onPageEdge: (direction: 'left' | 'right') => void;
}

export function useDragAndDrop(options: DragAndDropOptions) {
  const [editing, setEditing] = createSignal(false);
  const [dragId, setDragId] = createSignal<string | null>(null);
  const [dragPos, setDragPos] = createSignal<{ x: number; y: number } | null>(null);
  const [hoverIndex, setHoverIndex] = createSignal<number>(-1);
  const [mergeTarget, setMergeTarget] = createSignal<string | null>(null);

  let dragOffset = { x: 0, y: 0 };
  let mergeTimer: number | undefined;
  let edgeTimer: number | undefined;
  let startPos = { x: 0, y: 0 };
  let isDragging = false;
  const DRAG_THRESHOLD = 8;
  const FOLDER_MERGE_DELAY = 500;
  const EDGE_SCROLL_DELAY = 300;
  const EDGE_ZONE = 20;

  const clearMergeTimer = () => {
    if (mergeTimer !== undefined) {
      clearTimeout(mergeTimer);
      mergeTimer = undefined;
    }
    setMergeTarget(null);
  };

  const clearEdgeTimer = () => {
    if (edgeTimer !== undefined) {
      clearTimeout(edgeTimer);
      edgeTimer = undefined;
    }
  };

  const getGridSlotAtPoint = (x: number, y: number): { index: number; itemId: string | null } => {
    const grid = options.gridRef();
    if (!grid) return { index: -1, itemId: null };

    const slots = grid.querySelectorAll('[data-grid-item]');
    for (let i = 0; i < slots.length; i++) {
      const rect = (slots[i] as HTMLElement).getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        const itemId = (slots[i] as HTMLElement).dataset.gridItem || null;
        return { index: i, itemId };
      }
    }
    return { index: -1, itemId: null };
  };

  const handlePointerDown = (itemId: string, e: PointerEvent) => {
    if (!editing()) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);

    startPos = { x: e.clientX, y: e.clientY };
    isDragging = false;

    const el = (e.currentTarget as HTMLElement);
    const rect = el.getBoundingClientRect();
    dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };

    setDragId(itemId);
    setDragPos(null);
  };

  const handlePointerMove = (e: PointerEvent) => {
    const id = dragId();
    if (!id) return;

    if (!isDragging) {
      const dx = e.clientX - startPos.x;
      const dy = e.clientY - startPos.y;
      if (dx * dx + dy * dy < DRAG_THRESHOLD * DRAG_THRESHOLD) return;
      isDragging = true;
    }

    setDragPos({ x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y });

    const { index, itemId } = getGridSlotAtPoint(e.clientX, e.clientY);
    setHoverIndex(index);

    // Folder merge detection
    if (itemId && itemId !== id && !itemId.startsWith('folder:')) {
      if (mergeTarget() !== itemId) {
        clearMergeTimer();
        setMergeTarget(itemId);
        mergeTimer = window.setTimeout(() => {
          options.onFolderMerge(id, itemId);
          setDragId(null);
          setDragPos(null);
          isDragging = false;
          clearMergeTimer();
        }, FOLDER_MERGE_DELAY);
      }
    } else {
      clearMergeTimer();
    }

    // Edge scroll detection
    const grid = options.gridRef();
    if (grid) {
      const rect = grid.getBoundingClientRect();
      const atLeft = e.clientX - rect.left < EDGE_ZONE;
      const atRight = rect.right - e.clientX < EDGE_ZONE;

      if (atLeft || atRight) {
        if (edgeTimer === undefined) {
          edgeTimer = window.setTimeout(() => {
            options.onPageEdge(atLeft ? 'left' : 'right');
            clearEdgeTimer();
          }, EDGE_SCROLL_DELAY);
        }
      } else {
        clearEdgeTimer();
      }
    }
  };

  const handlePointerUp = () => {
    const id = dragId();
    const idx = hoverIndex();

    if (id && isDragging && idx >= 0) {
      options.onReorder(id, idx);
    }

    setDragId(null);
    setDragPos(null);
    setHoverIndex(-1);
    isDragging = false;
    clearMergeTimer();
    clearEdgeTimer();
  };

  onCleanup(() => {
    clearMergeTimer();
    clearEdgeTimer();
  });

  return {
    editing,
    setEditing,
    dragId,
    dragPos,
    hoverIndex,
    mergeTarget,
    isDragging: () => isDragging,
    handlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
    },
  };
}
