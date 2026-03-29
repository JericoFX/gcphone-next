import { emitInternalEvent } from './internalEvents';
import { getStoredLanguage, t } from '../i18n';

export function uiAlert(message: string, title?: string) {
  const safeMessage = typeof message === 'string' ? message.trim() : '';
  if (!safeMessage) return;

  emitInternalEvent('phone:uiAlert', {
    title: title || t('common.notice', getStoredLanguage()),
    message: safeMessage,
  });
}
