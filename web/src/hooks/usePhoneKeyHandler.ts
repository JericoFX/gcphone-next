import { useRouter } from '@/components/Phone/PhoneFrame';
import { useInternalEvent } from '@/utils/internalEvents';

export interface PhoneKeyHandlers {
  Backspace?: () => void;
  ArrowUp?: () => void;
  ArrowDown?: () => void;
  ArrowLeft?: () => void;
  ArrowRight?: () => void;
  Enter?: () => void;
  Escape?: () => void;
  [key: string]: (() => void) | undefined;
}

export interface PhoneKeyHandlerOptions {
  routeId?: string | (() => string | undefined);
}

export function usePhoneKeyHandler(handlers: PhoneKeyHandlers, options?: PhoneKeyHandlerOptions) {
  const router = useRouter();

  const handleKeyEvent = (key: string) => {
    const routeId = typeof options?.routeId === 'function' ? options.routeId() : options?.routeId;
    if (routeId && router.currentRoute() !== routeId) return;

    const handler = handlers[key];

    if (handler) {
      handler();
      return;
    }

    if (key === 'Backspace' && !handlers.Backspace) {
      router.goBack();
    }
  };

  useInternalEvent('phone:keyUp', handleKeyEvent);
}

export function useBackspaceKey(onBack?: () => void, options?: PhoneKeyHandlerOptions) {
  const router = useRouter();

  const handleBackspaceKey = (key: string) => {
    const routeId = typeof options?.routeId === 'function' ? options.routeId() : options?.routeId;
    if (routeId && router.currentRoute() !== routeId) return;

    if (key === 'Backspace') {
      if (onBack) {
        onBack();
      } else {
        router.goBack();
      }
    }
  };

  useInternalEvent('phone:keyUp', handleBackspaceKey);
}
