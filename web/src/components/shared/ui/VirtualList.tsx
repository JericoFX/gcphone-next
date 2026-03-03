import { For, JSX, createMemo, createSignal, onCleanup, onMount } from 'solid-js';

interface VirtualListProps<T> {
  items: () => T[];
  itemHeight: number;
  overscan?: number;
  class?: string;
  contentClass?: string;
  children: (item: T, index: () => number) => JSX.Element;
}

export function VirtualList<T>(props: VirtualListProps<T>) {
  let viewportRef: HTMLDivElement | undefined;
  const [scrollTop, setScrollTop] = createSignal(0);
  const [viewportHeight, setViewportHeight] = createSignal(0);

  const overscan = () => Math.max(1, props.overscan ?? 4);
  const totalHeight = createMemo(() => props.items().length * props.itemHeight);

  const range = createMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop() / props.itemHeight) - overscan());
    const visibleCount = Math.ceil((viewportHeight() || 0) / props.itemHeight) + overscan() * 2;
    const end = Math.min(props.items().length, start + visibleCount);
    return { start, end };
  });

  const visibleItems = createMemo(() => {
    const { start, end } = range();
    return props.items().slice(start, end).map((item, offset) => ({ item, index: start + offset }));
  });

  onMount(() => {
    if (!viewportRef) return;

    const updateHeight = () => {
      if (!viewportRef) return;
      setViewportHeight(viewportRef.clientHeight || 0);
    };

    updateHeight();

    const onScroll = () => {
      if (!viewportRef) return;
      setScrollTop(viewportRef.scrollTop || 0);
    };

    viewportRef.addEventListener('scroll', onScroll, { passive: true });

    const observer = new ResizeObserver(() => updateHeight());
    observer.observe(viewportRef);

    onCleanup(() => {
      viewportRef?.removeEventListener('scroll', onScroll);
      observer.disconnect();
    });
  });

  return (
    <div ref={viewportRef} class={props.class} style={{ height: '100%', overflow: 'auto' }}>
      <div style={{ position: 'relative', height: `${totalHeight()}px` }}>
        <div
          class={props.contentClass}
          style={{
            position: 'absolute',
            top: `${range().start * props.itemHeight}px`,
            left: '0',
            right: '0',
          }}
        >
          <For each={visibleItems()}>
            {(entry) => props.children(entry.item, () => entry.index)}
          </For>
        </div>
      </div>
    </div>
  );
}
