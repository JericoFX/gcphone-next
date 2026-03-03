import { createEffect, onCleanup } from 'solid-js';
import { useRouter } from '@/components/Phone/PhoneFrame';

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

export function usePhoneKeyHandler(handlers: PhoneKeyHandlers) {
  const router = useRouter();

  createEffect(() => {
    const handleKeyUp = (e: CustomEvent<string>) => {
      const key = e.detail;
      const handler = handlers[key];
      
      if (handler) {
        handler();
        return;
      }

      if (key === 'Backspace' && !handlers.Backspace) {
        router.goBack();
      }
    };

    window.addEventListener('phone:keyUp', handleKeyUp as EventListener);
    onCleanup(() => window.removeEventListener('phone:keyUp', handleKeyUp as EventListener));
  });
}

export function useBackspaceKey(onBack?: () => void) {
  const router = useRouter();

  createEffect(() => {
    const handleKeyUp = (e: CustomEvent<string>) => {
      if (e.detail === 'Backspace') {
        if (onBack) {
          onBack();
        } else {
          router.goBack();
        }
      }
    };

    window.addEventListener('phone:keyUp', handleKeyUp as EventListener);
    onCleanup(() => window.removeEventListener('phone:keyUp', handleKeyUp as EventListener));
  });
}
