import { createContext, useContext, ParentComponent, batch, onMount } from 'solid-js';
import { createStore, produce } from 'solid-js/store';
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

export const MessagesProvider: ParentComponent = (props) => {
  const [state, setState] = createStore<MessagesState>({
    messages: [],
    loading: false,
    unreadCount: 0
  });
  
  const actions: MessagesActions = {
    fetch: async () => {
      setState('loading', true);
      const messages = await fetchNui<Message[]>('getMessages', undefined, []);
      setState('messages', messages || []);
      setState('loading', false);
      
      const unread = (messages || []).filter(m => !m.isRead && m.owner === 0).length;
      setState('unreadCount', unread);
    },
    
    getConversation: (phoneNumber: string) => {
      return state.messages
        .filter(m => m.transmitter === phoneNumber || m.receiver === phoneNumber)
        .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
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
        setState('messages', produce(m => {
          const idx = m.findIndex(msg => msg.id === messageId);
          if (idx >= 0) m.splice(idx, 1);
        }));
        return true;
      }
      return false;
    },
    
    deleteConversation: async (phoneNumber: string) => {
      const result = await fetchNui<{ success: boolean }>('deleteConversation', { phoneNumber });
      
      if (result?.success) {
        setState('messages', m => m.filter(msg => msg.transmitter !== phoneNumber && msg.receiver !== phoneNumber));
        return true;
      }
      return false;
    },
    
    markAsRead: async (phoneNumber: string) => {
      const result = await fetchNui<{ success: boolean }>('markAsRead', { phoneNumber });
      
      if (result?.success) {
        setState('messages', produce(m => {
          for (const msg of m) {
            if (msg.transmitter === phoneNumber && msg.owner === 0) {
              msg.isRead = true;
            }
          }
        }));
        
        const unread = state.messages.filter(m => !m.isRead && m.owner === 0).length;
        setState('unreadCount', unread);
        return true;
      }
      return false;
    },
    
    getUnreadCount: () => state.unreadCount
  };
  
  useNuiCustomEvent<Message>('messageSent', (message) => {
    setState('messages', produce(m => {
      m.push(message);
    }));
  });
  
  useNuiCustomEvent<Message>('messageReceived', (message) => {
    batch(() => {
      setState('messages', produce(m => {
        m.push(message);
      }));
      setState('unreadCount', prev => prev + 1);
    });
  });
  
  useNuiCustomEvent<Message[]>('messagesUpdated', (messages) => {
    setState('messages', messages);
    const unread = messages.filter(m => !m.isRead && m.owner === 0).length;
    setState('unreadCount', unread);
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
