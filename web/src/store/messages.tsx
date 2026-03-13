import { createContext, useContext, ParentComponent, batch, createMemo, onMount } from 'solid-js';
import { createStore } from 'solid-js/store';
import { fetchNui } from '../utils/fetchNui';
import { useNuiCustomEvent } from '../utils/useNui';
import { sanitizeMediaUrl, sanitizePhone, sanitizeText } from '../utils/sanitize';
import type { Message } from '../types';

interface MessagesState {
  messages: Message[];
  loading: boolean;
  unreadCount: number;
}

interface MessagesActions {
  fetch: () => Promise<void>;
  getConversation: (phoneNumber: string) => Message[];
  send: (phoneNumber: string, message: string, mediaUrl?: string) => Promise<boolean>;
  delete: (messageId: number) => Promise<boolean>;
  deleteConversation: (phoneNumber: string) => Promise<boolean>;
  markAsRead: (phoneNumber: string) => Promise<boolean>;
  getUnreadCount: () => number;
}

type MessagesStore = [MessagesState, MessagesActions];

const MessagesContext = createContext<MessagesStore>();

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
      map.set(phoneNumber, messages.slice().sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()));
    }

    return map;
  });
  
  const actions: MessagesActions = {
    fetch: async () => {
      setState('loading', true);
      const messages = await fetchNui<Message[]>('getMessages', undefined, []);
      const list = messages || [];
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
    
    send: async (phoneNumber: string, message: string, mediaUrl?: string) => {
      const nextPhone = sanitizePhone(phoneNumber);
      const nextMessage = sanitizeText(message, 800);
      const nextMediaUrl = sanitizeMediaUrl(mediaUrl);
      if (!nextPhone || (!nextMessage && !nextMediaUrl)) return false;

      const result = await fetchNui<{ success: boolean }>(
        'sendMessage',
        { phoneNumber: nextPhone, message: nextMessage, mediaUrl: nextMediaUrl || undefined }
      );
      
      return result?.success ?? false;
    },
    
    delete: async (messageId: number) => {
      const result = await fetchNui<{ success: boolean }>('deleteMessage', { id: messageId });
      
      if (result?.success) {
        setState('messages', messages => messages.filter(msg => msg.id !== messageId));
        setState('unreadCount', countUnread(state.messages));
        return true;
      }
      return false;
    },
    
    deleteConversation: async (phoneNumber: string) => {
      const result = await fetchNui<{ success: boolean }>('deleteConversation', { phoneNumber });
      
      if (result?.success) {
        batch(() => {
          setState('messages', m => m.filter(msg => msg.transmitter !== phoneNumber && msg.receiver !== phoneNumber));
          setState('unreadCount', countUnread(state.messages));
        });
        return true;
      }
      return false;
    },
    
    markAsRead: async (phoneNumber: string) => {
      const result = await fetchNui<{ success: boolean }>('markAsRead', { phoneNumber });
      
      if (result?.success) {
        batch(() => {
          setState('messages', messages => messages.map(msg => (
            msg.transmitter === phoneNumber && msg.owner === 0
              ? { ...msg, isRead: true }
              : msg
          )));
          setState('unreadCount', countUnread(state.messages));
        });
        return true;
      }
      return false;
    },
    
    getUnreadCount: () => state.unreadCount
  };
  
  useNuiCustomEvent<Message>('messageSent', (message) => {
    setState('messages', messages => [...messages, message]);
  });
  
  useNuiCustomEvent<Message>('messageReceived', (message) => {
    batch(() => {
      setState('messages', messages => [...messages, message]);
      setState('unreadCount', prev => prev + 1);
    });
  });
  
  useNuiCustomEvent<Message[]>('messagesUpdated', (messages) => {
    batch(() => {
      setState('messages', messages);
      setState('unreadCount', countUnread(messages));
    });
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
