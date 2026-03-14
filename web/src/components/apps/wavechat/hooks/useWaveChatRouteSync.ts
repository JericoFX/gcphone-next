import { createEffect } from 'solid-js';
import { sanitizeMediaUrl, sanitizePhone, sanitizeText } from '../../../../utils/sanitize';

export function useWaveChatRouteSync(params: {
  routeParams: () => Record<string, unknown>;
  setSelectedConversation: (value: string | null) => void;
  setRouteConversationName: (value: string) => void;
  setActiveTab: (value: 'chats' | 'status' | 'calls' | 'groups') => void;
  setAttachmentUrl: (value: string | null) => void;
  markAsRead: (number: string) => void;
}) {
  createEffect(() => {
    const routeParams = params.routeParams();
    const number = sanitizePhone(typeof routeParams.phoneNumber === 'string' ? routeParams.phoneNumber : typeof routeParams.number === 'string' ? routeParams.number : '');
    const display = sanitizeText(
      typeof routeParams.display === 'string' ? routeParams.display : typeof routeParams.displayName === 'string' ? routeParams.displayName : '',
      80,
    );
    const mediaUrl = sanitizeMediaUrl(typeof routeParams.attachmentUrl === 'string' ? routeParams.attachmentUrl : '');

    if (!number) return;

    params.setSelectedConversation(number);
    params.setRouteConversationName(display || '');
    params.setActiveTab('chats');

    if (mediaUrl) {
      params.setAttachmentUrl(mediaUrl);
    }

    params.markAsRead(number);
  });
}
