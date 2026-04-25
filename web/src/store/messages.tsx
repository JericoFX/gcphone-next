import { createContext, useContext, ParentComponent, batch, createMemo, onMount } from 'solid-js';
import { createStore } from 'solid-js/store';
import { fetchKnownNui } from '../utils/fetchNui';
import { useNuiCustomEvent } from '../utils/useNui';
import { sanitizeMediaUrl, sanitizePhone, sanitizeText } from '../utils/sanitize';
import { emitInternalEvent } from '../utils/internalEvents';
import type { Message } from '../types';

export interface MessagesState {
  messages: Message[];
  loading: boolean;
  unreadCount: number;
}

export interface SendOptions {
  phoneNumber: string;
  message: string;
  mediaUrl?: string;
  replyToId?: number;
  messageType?: 'text' | 'audio';
  audioData?: string;
  audioDuration?: number;
}

export interface MessagesActions {
  fetch: () => Promise<void>;
  getConversation: (phoneNumber: string) => Message[];
  send: (options: SendOptions) => Promise<boolean>;
  delete: (messageId: number) => Promise<boolean>;
  deleteConversation: (phoneNumber: string) => Promise<boolean>;
  markAsRead: (phoneNumber: string) => Promise<boolean>;
  getUnreadCount: () => number;
  react: (messageId: number, emoji: string) => Promise<boolean>;
  removeReaction: (messageId: number) => Promise<boolean>;
}

type MessagesStore = [MessagesState, MessagesActions];

const MessagesContext = createContext<MessagesStore>();

const MAX_MESSAGES = 2000;

function countUnread(messages: Message[]) {
  let unread = 0;
  for (const msg of messages) {
    if (!msg.isRead && msg.owner === 0) unread++;
  }
  return unread;
}

export const MessagesProvider: ParentComponent = (props) => {
  const [state, setState] = createStore<MessagesState>({
    messages: [],
    loading: false,
    unreadCount: 0
  });

  const conversationMap = createMemo(() => {
    const map = new Map<string, Message[]>();

    for (const message of state.messages) {
      const phoneNumber = message.owner === 1 ? message.receiver : message.transmitter;
      const list = map.get(phoneNumber);

      if (list) {
        list.push(message);
      } else {
        map.set(phoneNumber, [message]);
      }
    }

    for (const [phoneNumber, messages] of map.entries()) {
      map.set(phoneNumber, messages.slice().sort((a, b) => (a.time > b.time ? 1 : a.time < b.time ? -1 : 0)));
    }

    return map;
  });
  
  const actions: MessagesActions = {
    fetch: async () => {
      setState('loading', true);
      const messages = await fetchKnownNui('getMessages', undefined, []);
      const list = Array.isArray(messages) ? messages : [];
      const unread = countUnread(list);
      batch(() => {
        setState('messages', list);
        setState('unreadCount', unread);
        setState('loading', false);
      });
    },
    
    getConversation: (phoneNumber: string) => {
      return conversationMap().get(phoneNumber) || [];
    },
    
    send: async (options: SendOptions) => {
      const nextPhone = sanitizePhone(options.phoneNumber);
      const nextMessage = options.messageType === 'audio' ? '[Audio]' : sanitizeText(options.message, 800);
      const nextMediaUrl = sanitizeMediaUrl(options.mediaUrl);
      if (!nextPhone || (!nextMessage && !nextMediaUrl && !options.audioData)) return false;

      const result = await fetchKnownNui(
        'sendMessage',
        {
          phoneNumber: nextPhone,
          message: nextMessage,
          mediaUrl: nextMediaUrl || undefined,
          replyToId: options.replyToId,
          messageType: options.messageType,
          audioData: options.audioData,
          audioDuration: options.audioDuration,
        }
      );

      return result?.success ?? false;
    },
    
    delete: async (messageId: number) => {
      const result = await fetchKnownNui('deleteMessage', { id: messageId });

      if (result?.success) {
        const filtered = state.messages.filter(msg => msg.id !== messageId);
        batch(() => {
          setState('messages', filtered);
          setState('unreadCount', countUnread(filtered));
        });
        return true;
      }
      return false;
    },

    deleteConversation: async (phoneNumber: string) => {
      const result = await fetchKnownNui('deleteConversation', { phoneNumber });

      if (result?.success) {
        const filtered = state.messages.filter(msg => msg.transmitter !== phoneNumber && msg.receiver !== phoneNumber);
        batch(() => {
          setState('messages', filtered);
          setState('unreadCount', countUnread(filtered));
        });
        return true;
      }
      return false;
    },

    markAsRead: async (phoneNumber: string) => {
      const result = await fetchKnownNui('markAsRead', { phoneNumber });

      if (result?.success) {
        const updated = state.messages.map(msg => (
          msg.transmitter === phoneNumber && msg.owner === 0
            ? { ...msg, isRead: true }
            : msg
        ));
        batch(() => {
          setState('messages', updated);
          setState('unreadCount', countUnread(updated));
        });
        return true;
      }
      return false;
    },
    
    getUnreadCount: () => state.unreadCount,

    react: async (messageId: number, emoji: string) => {
      const result = await fetchKnownNui('reactToMessage', { messageId, emoji });
      return result?.success ?? false;
    },

    removeReaction: async (messageId: number) => {
      const result = await fetchKnownNui('removeReaction', { messageId });
      return result?.success ?? false;
    },
  };
  
  useNuiCustomEvent<Message>('messageSent', (message) => {
    setState('messages', messages => [...messages, message].slice(-MAX_MESSAGES));
  });

  useNuiCustomEvent<Message>('messageReceived', (message) => {
    batch(() => {
      setState('messages', messages => [...messages, message].slice(-MAX_MESSAGES));
      setState('unreadCount', prev => prev + 1);
    });
  });

  useNuiCustomEvent<Message[]>('messagesUpdated', (messages) => {
    const list = Array.isArray(messages) ? messages.slice(-MAX_MESSAGES) : [];
    batch(() => {
      setState('messages', list);
      setState('unreadCount', countUnread(list));
    });
  });

  useNuiCustomEvent<{ phone: string; readAt: string }>('messageRead', (data) => {
    if (!data?.phone) return;
    setState('messages', messages =>
      messages.map(msg =>
        msg.owner === 1 && msg.receiver === data.phone && msg.status !== 'read'
          ? { ...msg, status: 'read' as const, read_at: data.readAt }
          : msg
      )
    );
  });

  useNuiCustomEvent<{ messageId: number; senderPhone: string; emoji: string | null }>('messageReaction', (data) => {
    if (!data?.messageId) return;
    setState('messages', messages =>
      messages.map(msg => {
        if (msg.id !== data.messageId) return msg;
        const reactions = (msg.reactions || []).filter(r => r.sender_phone !== data.senderPhone);
        if (data.emoji) {
          reactions.push({ message_id: data.messageId, sender_phone: data.senderPhone, emoji: data.emoji });
        }
        return { ...msg, reactions };
      })
    );
  });
  
  useNuiCustomEvent<{ from?: string }>('messageTyping', (data) => {
    if (!data?.from) return;
    emitInternalEvent('messages:remoteTyping', { from: data.from });
  });

  onMount(() => {
    actions.fetch();
  });
  
  return (
    <MessagesContext.Provider value={[state, actions]}>
      {props.children}
    </MessagesContext.Provider>
  );
};

export function useMessages() {
  const context = useContext(MessagesContext);
  if (!context) {
    throw new Error('useMessages must be used within MessagesProvider');
  }
  return context;
}

export function useMessagesState() {
  const [state] = useMessages();
  return state;
}

export function useMessagesActions() {
  const [, actions] = useMessages();
  return actions;
}
