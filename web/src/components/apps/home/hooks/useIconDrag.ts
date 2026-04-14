import { createSignal, onCleanup } from 'solid-js';

export interface DragState {
  itemId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface IconDragOptions {
  editing: () => boolean;
  items: () => string[];
  gridRef: () => HTMLElement | undefined;
  frameRef: () => HTMLElement | undefined;
  isPinned: (itemId: string) => boolean;
  isFolder: (itemId: string) => boolean;
  onReorder: (itemId: string, targetIndex: number) => void;
  onMergeCreateFolder: (draggedAppId: string, targetAppId: string) => void;
  onAddAppToFolder: (draggedAppId: string, folderRef: string) => void;
  onPageEdge: (direction: 'left' | 'right') => void;
}

const HOLD_MS = 220;
const MOVE_THRESHOLD = 6;
const EDGE_PX = 28;
const EDGE_DWELL_MS = 380;

export function useIconDrag(options: IconDragOptions) {
  const [dragState, setDragState] = createSignal<DragState | null>(null);
  const [hoverIndex, setHoverIndex] = createSignal<number>(-1);
  const [mergeTarget, setMergeTarget] = createSignal<string | null>(null);

  let activePointerId: number | null = null;
  let activeItemId: string | null = null;
  let sourceEl: HTMLElement | null = null;
  let startX = 0;
  let startY = 0;
  let offsetX = 0;
  let offsetY = 0;
  let itemWidth = 0;
  let itemHeight = 0;
  let holdTimer: number | undefined;
  let edgeTimer: number | undefined;
  let lastEdge: 'left' | 'right' | null = null;
  let dragging = false;
  let holdSatisfied = false;

  function clearHoldTimer() {
    if (holdTimer !== undefined) { clearTimeout(holdTimer); holdTimer = undefined; }
  }
  function clearEdgeTimer() {
    if (edgeTimer !== undefined) { clearTimeout(edgeTimer); edgeTimer = undefined; }
  }

  function releaseCapture() {
    if (sourceEl && activePointerId !== null) {
      try { sourceEl.releasePointerCapture(activePointerId); } catch (_err) { /* ignore */ }
    }
  }

  function resetAll() {
    clearHoldTimer();
    clearEdgeTimer();
    releaseCapture();
    setDragState(null);
    setHoverIndex(-1);
    setMergeTarget(null);
    lastEdge = null;
    activePointerId = null;
    activeItemId = null;
    sourceEl = null;
    dragging = false;
    holdSatisfied = false;
  }

  function clampToFrame(x: number, y: number): { x: number; y: number } {
    const frame = options.frameRef();
    if (!frame) return { x, y };
    const r = frame.getBoundingClientRect();
    const maxX = r.right - itemWidth;
    const maxY = r.bottom - itemHeight;
    return {
      x: Math.max(r.left, Math.min(x, maxX)),
      y: Math.max(r.top, Math.min(y, maxY)),
    };
  }

  function hitTest(clientX: number, clientY: number): { index: number; itemId: string | null } {
    const grid = options.gridRef();
    if (!grid) return { index: -1, itemId: null };
    const slots = grid.querySelectorAll<HTMLElement>('[data-grid-item]');
    for (let i = 0; i < slots.length; i++) {
      const rect = slots[i].getBoundingClientRect();
      if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
        return { index: i, itemId: slots[i].dataset.gridItem ?? null };
      }
    }
    return { index: -1, itemId: null };
  }

  function commitMerge(srcId: string, targetId: string) {
    if (targetId.startsWith('folder:')) {
      if (!options.isFolder(srcId) && !options.isPinned(srcId)) {
        options.onAddAppToFolder(srcId, targetId);
      }
    } else {
      if (!options.isFolder(srcId) && !options.isFolder(targetId) && !options.isPinned(srcId) && !options.isPinned(targetId)) {
        options.onMergeCreateFolder(srcId, targetId);
      }
    }
  }

  function setMergeCandidate(target: string | null) {
    if (target === mergeTarget()) return;
    setMergeTarget(target);
  }

  function evaluateHover(clientX: number, clientY: number) {
    const { index, itemId } = hitTest(clientX, clientY);
    setHoverIndex(index);
    if (!itemId || !activeItemId || itemId === activeItemId) {
      setMergeCandidate(null);
      return;
    }
    const srcIsFolder = options.isFolder(activeItemId);
    const tgtIsPinned = options.isPinned(itemId);

    if (srcIsFolder || tgtIsPinned) {
      setMergeCandidate(null);
      return;
    }
    setMergeCandidate(itemId);
  }

  function evaluateEdges(clientX: number) {
    const grid = options.gridRef();
    if (!grid) return;
    const rect = grid.getBoundingClientRect();
    const atLeft = clientX - rect.left < EDGE_PX;
    const atRight = rect.right - clientX < EDGE_PX;
    const edge: 'left' | 'right' | null = atLeft ? 'left' : atRight ? 'right' : null;
    if (edge === lastEdge) return;
    clearEdgeTimer();
    lastEdge = edge;
    if (edge) {
      edgeTimer = window.setTimeout(() => {
        edgeTimer = undefined;
        lastEdge = null;
        options.onPageEdge(edge);
      }, EDGE_DWELL_MS);
    }
  }

  function finalize(commit: boolean) {
    const src = activeItemId;
    const merge = mergeTarget();
    const idx = hoverIndex();

    if (commit && src && dragging) {
      if (merge) {
        commitMerge(src, merge);
      } else if (idx >= 0) {
        options.onReorder(src, idx);
      }
    }
    resetAll();
  }

  function onPointerDown(itemId: string, e: PointerEvent) {
    if (activePointerId !== null) return;
    if (e.button !== undefined && e.button !== 0) return;
    if (options.isPinned(itemId)) return;

    const target = e.currentTarget as HTMLElement | null;
    if (!target) return;
    const rect = target.getBoundingClientRect();

    activePointerId = e.pointerId;
    activeItemId = itemId;
    sourceEl = target;
    startX = e.clientX;
    startY = e.clientY;
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    itemWidth = rect.width;
    itemHeight = rect.height;
    dragging = false;
    holdSatisfied = options.editing();

    try { target.setPointerCapture(e.pointerId); } catch (_err) { /* ignore */ }

    clearHoldTimer();
    if (!holdSatisfied) {
      holdTimer = window.setTimeout(() => {
        holdSatisfied = true;
        holdTimer = undefined;
        const pos = clampToFrame(startX - offsetX, startY - offsetY);
        dragging = true;
        setDragState({ itemId, x: pos.x, y: pos.y, width: itemWidth, height: itemHeight });
      }, HOLD_MS);
    }
  }

  function onPointerMove(e: PointerEvent) {
    if (activePointerId === null || e.pointerId !== activePointerId) return;
    if (!dragging) {
      if (!holdSatisfied) {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (dx * dx + dy * dy >= MOVE_THRESHOLD * MOVE_THRESHOLD) {
          clearHoldTimer();
          activePointerId = null;
          activeItemId = null;
          sourceEl = null;
        }
        return;
      }
      dragging = true;
    }
    const pos = clampToFrame(e.clientX - offsetX, e.clientY - offsetY);
    setDragState({ itemId: activeItemId!, x: pos.x, y: pos.y, width: itemWidth, height: itemHeight });
    evaluateHover(e.clientX, e.clientY);
    evaluateEdges(e.clientX);
  }

  function onPointerUp(e: PointerEvent) {
    if (activePointerId === null || e.pointerId !== activePointerId) return;
    finalize(true);
  }

  function onPointerCancel(e: PointerEvent) {
    if (activePointerId === null || e.pointerId !== activePointerId) return;
    finalize(false);
  }

  function onVisibilityChange() { if (document.hidden) finalize(false); }
  function onBlur() { finalize(false); }

  window.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('blur', onBlur);
  onCleanup(() => {
    window.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('blur', onBlur);
    resetAll();
  });

  return {
    dragState,
    hoverIndex,
    mergeTarget,
    isDragging: () => dragging,
    dragId: () => activeItemId,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
    },
  };
}
