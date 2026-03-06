import { createSignal, createEffect, onCleanup, batch } from 'solid-js';

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
  
  // Listen for live events from server
  createEffect(() => {
    if (!isLive || !clipId) return;
    
    const handleLiveMessage = (event: Event) => {
      const customEvent = event as CustomEvent<Message>;
      const message = customEvent.detail;
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
    
    const handleLiveReaction = (event: Event) => {
      const customEvent = event as CustomEvent<Reaction>;
      const reaction = customEvent.detail;
      if (!reaction) return;
      
      setReactions(prev => [...prev, reaction]);
    };
    
    const handleMessageDeleted = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      const messageId = customEvent.detail;
      if (!messageId) return;
      
      batch(() => {
        setGlobalMessages(prev => prev.filter(m => m.id !== messageId));
        setFloatingMessages(prev => prev.filter(m => m.id !== messageId));
      });
    };
    
    // Add event listeners
    window.addEventListener('gcphone:live:message', handleLiveMessage);
    window.addEventListener('gcphone:live:reaction', handleLiveReaction);
    window.addEventListener('gcphone:live:messageDeleted', handleMessageDeleted);
    
    onCleanup(() => {
      window.removeEventListener('gcphone:live:message', handleLiveMessage);
      window.removeEventListener('gcphone:live:reaction', handleLiveReaction);
      window.removeEventListener('gcphone:live:messageDeleted', handleMessageDeleted);
    });
  });
  
  const sendMessage = (content: string) => {
    if (!isLive) return;
    
    // Dispatch event to server
    const event = new CustomEvent('gcphone:live:sendMessage', {
      detail: { clipId, content }
    });
    window.dispatchEvent(event);
  };
  
  const sendReaction = (reaction: string) => {
    if (!isLive) return;
    
    const event = new CustomEvent('gcphone:live:sendReaction', {
      detail: { clipId, reaction }
    });
    window.dispatchEvent(event);
  };
  
  const deleteMessage = (messageId: string) => {
    if (!isOwner()) return;
    
    const event = new CustomEvent('gcphone:live:deleteMessage', {
      detail: { clipId, messageId }
    });
    window.dispatchEvent(event);
  };
  
  const muteUser = (username: string) => {
    if (!isOwner()) return;
    
    const event = new CustomEvent('gcphone:live:muteUser', {
      detail: { clipId, username }
    });
    window.dispatchEvent(event);
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
