import { createStore, type SetStoreFunction } from 'solid-js/store';

/**
 * Creates a typed app-local store with actions.
 * Thin wrapper over SolidJS createStore with type inference.
 *
 * @example
 * const [state, actions] = createAppStore(
 *   { tab: 'all' as const, search: '' },
 *   (state, setState) => ({
 *     setTab: (tab: string) => setState('tab', tab),
 *     setSearch: (q: string) => setState('search', q),
 *   })
 * );
 */
export function createAppStore<
  S extends object,
  A extends Record<string, (...args: any[]) => any>
>(
  initialState: S,
  actionsFactory: (state: S, setState: SetStoreFunction<S>) => A
): [S, A] {
  const [state, setState] = createStore<S>(initialState);
  const actions = actionsFactory(state, setState);
  return [state, actions];
}
