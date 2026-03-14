import { emitInternalEvent } from './internalEvents';

export function uiAlert(message: string, title = 'Aviso') {
  const safeMessage = typeof message === 'string' ? message.trim() : '';
  if (!safeMessage) return;

  emitInternalEvent('phone:uiAlert', {
    title,
    message: safeMessage,
  });
}
