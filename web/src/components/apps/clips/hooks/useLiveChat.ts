import { createSignal, batch } from 'solid-js';
import { emitInternalEvent, useInternalEvent } from '../../../../utils/internalEvents';

interface Message {
  id: string;
  username: string;
  avatar?: string;
  content: string;
  isMention: boolean;
  timestamp: number;
}

interface Reaction {
  id: string;
  username: string;
  reaction: string;
  timestamp: number;
}

export function useLiveChat(clipId: string, isLive: boolean) {
  const [floatingMessages, setFloatingMessages] = createSignal<Message[]>([]);
  const [globalMessages, setGlobalMessages] = createSignal<Message[]>([]);
  const [reactions, setReactions] = createSignal<Reaction[]>([]);
  const [isConnected, setIsConnected] = createSignal(false);
  const [isOwner, setIsOwner] = createSignal(false);
  
  const handleLiveMessage = (message: Message | undefined) => {
      if (!message) return;
      
      batch(() => {
        // Add to floating (auto-expires in 5s)
        setFloatingMessages(prev => [...prev, message]);
        
        // Add to global (keep last 20)
        setGlobalMessages(prev => {
          const newMessages = [...prev, message];
          if (newMessages.length > 20) {
            return newMessages.slice(newMessages.length - 20);
          }
          return newMessages;
        });
      });
    };
    
    const handleLiveReaction = (reaction: Reaction | undefined) => {
      if (!reaction) return;
      
      setReactions(prev => [...prev, reaction]);
    };
    
    const handleMessageDeleted = (messageId: string | undefined) => {
      if (!messageId) return;
      
      batch(() => {
        setGlobalMessages(prev => prev.filter(m => m.id !== messageId));
        setFloatingMessages(prev => prev.filter(m => m.id !== messageId));
      });
    };

  useInternalEvent('gcphone:live:message', (payload: Message) => {
    if (!isLive || !clipId) return;
    handleLiveMessage(payload);
  });
  useInternalEvent('gcphone:live:reaction', (payload: Reaction) => {
    if (!isLive || !clipId) return;
    handleLiveReaction(payload);
  });
  useInternalEvent('gcphone:live:messageDeleted', (payload: string) => {
    if (!isLive || !clipId) return;
    handleMessageDeleted(payload);
  });
  
  const sendMessage = (content: string) => {
    if (!isLive) return;
    
    // Dispatch event to server
    emitInternalEvent('gcphone:live:sendMessage', { clipId, content });
  };
  
  const sendReaction = (reaction: string) => {
    if (!isLive) return;
    
    emitInternalEvent('gcphone:live:sendReaction', { clipId, reaction });
  };
  
  const deleteMessage = (messageId: string) => {
    if (!isOwner()) return;
    
    emitInternalEvent('gcphone:live:deleteMessage', { clipId, messageId });
  };
  
  const muteUser = (username: string) => {
    if (!isOwner()) return;
    
    emitInternalEvent('gcphone:live:muteUser', { clipId, username });
  };
  
  const removeFloatingMessage = (id: string) => {
    setFloatingMessages(prev => prev.filter(m => m.id !== id));
  };
  
  const removeReaction = (id: string) => {
    setReactions(prev => prev.filter(r => r.id !== id));
  };
  
  return {
    floatingMessages,
    globalMessages,
    reactions,
    isConnected,
    isOwner,
    sendMessage,
    sendReaction,
    deleteMessage,
    muteUser,
    removeFloatingMessage,
    removeReaction
  };
}
