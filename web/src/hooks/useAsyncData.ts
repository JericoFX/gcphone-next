import { createSignal, createEffect, onCleanup } from 'solid-js';

export interface UseAsyncDataOptions<T> {
  initialData?: T;
  autoFetch?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

export function useAsyncData<T>(
  fetchFn: () => Promise<T>,
  options: UseAsyncDataOptions<T> = {}
) {
  const { initialData, autoFetch = true, onSuccess, onError } = options;

  const [data, setData] = createSignal<T | undefined>(initialData);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<Error | null>(null);

  let abortController: AbortController | null = null;

  const execute = async (): Promise<T | undefined> => {
    abortController?.abort();
    abortController = new AbortController();

    setLoading(true);
    setError(null);

    try {
      const result = await fetchFn();
      if (!abortController.signal.aborted) {
        setData(() => result);
        setLoading(false);
        onSuccess?.(result);
        return result;
      }
    } catch (err) {
      if (!abortController.signal.aborted) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        setLoading(false);
        onError?.(error);
      }
    }

    return undefined;
  };

  const reset = () => {
    abortController?.abort();
    setData(() => initialData);
    setLoading(false);
    setError(null);
  };

  if (autoFetch) {
    createEffect(() => {
      execute();
    });
  }

  onCleanup(() => {
    abortController?.abort();
  });

  return {
    data,
    loading,
    error,
    execute,
    reset,
    setData,
  };
}

export function useDelayedLoading(delay = 120) {
  const [loading, setLoading] = createSignal(true);

  createEffect(() => {
    const handle = setTimeout(() => setLoading(false), delay);
    onCleanup(() => clearTimeout(handle));
  });

  return { loading, setLoading };
}
