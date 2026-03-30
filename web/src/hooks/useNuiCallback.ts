import { useNuiCustomEvent } from '@/utils/useNui';

/**
 * Subscribes to a NUI custom event with typed payload.
 * Automatically cleans up on component unmount.
 *
 * @example
 * useNuiCallback<{ id: number }>('contactUpdated', (data) => {
 *   console.log(data.id);
 * });
 */
export function useNuiCallback<T = unknown>(
  eventName: string,
  handler: (data: T) => void
): void {
  useNuiCustomEvent<T>(eventName, handler);
}
