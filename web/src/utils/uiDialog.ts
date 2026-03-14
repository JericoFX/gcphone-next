import { emitInternalEvent } from './internalEvents';

type DialogRequest = {
  type: 'prompt' | 'confirm';
  title?: string;
  message: string;
  placeholder?: string;
  defaultValue?: string;
  resolve: (value: unknown) => void;
};

export function uiPrompt(message: string, options?: { title?: string; placeholder?: string; defaultValue?: string }) {
  return new Promise<string | null>((resolve) => {
    const payload: DialogRequest = {
      type: 'prompt',
      title: options?.title || 'Entrada',
      message,
      placeholder: options?.placeholder,
      defaultValue: options?.defaultValue,
      resolve,
    };

    emitInternalEvent('phone:uiDialogRequest', payload);
  });
}

export function uiConfirm(message: string, options?: { title?: string }) {
  return new Promise<boolean>((resolve) => {
    const payload: DialogRequest = {
      type: 'confirm',
      title: options?.title || 'Confirmar',
      message,
      resolve: (value) => resolve(value === true),
    };

    emitInternalEvent('phone:uiDialogRequest', payload);
  });
}
