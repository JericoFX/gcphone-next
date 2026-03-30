import { createSignal, onMount, onCleanup, batch, type Accessor } from 'solid-js';

export interface AppLoaderOptions<T> {
  initialData: T;
  autoFetch?: boolean;
}

export interface AppLoader<T> {
  data: Accessor<T>;
  loading: Accessor<boolean>;
  error: Accessor<string | null>;
  refetch: () => Promise<void>;
  mutate: (fn: (prev: T) => T) => void;
}

/**
 * Creates a reactive data loader for app data fetching.
 * Uses onMount internally — no createEffect needed.
 *
 * @example
 * const posts = createAppLoader(() => fetchNui<Post[]>('getPosts', {}, []), { initialData: [] });
 * // posts.data(), posts.loading(), posts.refetch(), posts.mutate(prev => [...prev, newItem])
 */
export function createAppLoader<T>(
  fetchFn: () => Promise<T>,
  options?: AppLoaderOptions<T>
): AppLoader<T> {
  const initialData = options?.initialData as T;
  const autoFetch = options?.autoFetch !== false;

  const [data, setData] = createSignal<T>(initialData);
  const [loading, setLoading] = createSignal(autoFetch);
  const [error, setError] = createSignal<string | null>(null);

  let disposed = false;
  onCleanup(() => { disposed = true; });

  const execute = async () => {
    if (disposed) return;
    batch(() => {
      setLoading(true);
      setError(null);
    });
    try {
      const result = await fetchFn();
      if (disposed) return;
      batch(() => {
        setData(() => result);
        setLoading(false);
      });
    } catch (e) {
      if (disposed) return;
      batch(() => {
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      });
    }
  };

  if (autoFetch) {
    onMount(() => void execute());
  }

  return {
    data,
    loading,
    error,
    refetch: execute,
    mutate: (fn) => setData(prev => fn(prev)),
  };
}
