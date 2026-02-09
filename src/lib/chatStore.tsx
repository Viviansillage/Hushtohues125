/**
 * Global chat state - ensures conversation persists when switching pages
 * localStorage stores light data (conversationId), messages in memory
 */
import { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  artifact?: {
    type: 'mindmap' | 'image' | 'save';
    data?: any;
    artifactId?: string;
    saved?: boolean;
  };
  provider?: string;
  model?: string;
}

interface ChatContextType {
  conversationId: string;
  messages: Message[];
  appendMessage: (message: Message) => void;
  setMessages: (messages: Message[]) => void;
  resetChat: () => void;
  loadSession: (sessionId: string, messages: Message[]) => void;
  saveCurrentSession: () => void;
  restoreCurrentSession: () => boolean;
  hasCurrentSession: () => boolean;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

const STORAGE_KEY = 'hth_current_conversation_id';
const TEMP_SESSION_KEY = 'hth_temp_session';

interface TempSession {
  conversationId: string;
  messages: Message[];
  timestamp: number;
}

function generateConversationId(): string {
  return `conv-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function ChatProvider({ children }: { children: ReactNode }) {
  // Init conversationId: prefer localStorage (light)
  const [conversationId, setConversationId] = useState<string>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      console.log('📌 Restored conversationId from localStorage:', stored);
      return stored;
    }
    const newId = generateConversationId();
    console.log('🆕 Created new conversationId:', newId);
    localStorage.setItem(STORAGE_KEY, newId);
    return newId;
  });

  // messages in memory only (persist on tab switch, lost on refresh)
  const [messages, setMessagesState] = useState<Message[]>([]);

  // Sync conversationId to localStorage (light, safe)
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, conversationId);
  }, [conversationId]);

  // Auto-save current session to sessionStorage (incl. image/diagram) for restore on refresh
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (messages.length === 0) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      const tempSession: TempSession = {
        conversationId,
        messages,
        timestamp: Date.now()
      };
      try {
        sessionStorage.setItem(TEMP_SESSION_KEY, JSON.stringify(tempSession));
      } catch {
        // sessionStorage full or unavailable
      }
      saveTimeoutRef.current = null;
    }, 500);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [conversationId, messages]);

  const appendMessage = (message: Message) => {
    setMessagesState(prev => [...prev, message]);
  };

  const setMessages = (newMessages: Message[]) => {
    setMessagesState(newMessages);
  };

  const resetChat = () => {
    sessionStorage.removeItem(TEMP_SESSION_KEY); // Clear on new chat; next load from history will fetch from DB (no image/diagram)
    const newId = generateConversationId();
    console.log('🔄 Reset chat, new conversationId:', newId);
    setConversationId(newId);
    setMessagesState([]);
    localStorage.setItem(STORAGE_KEY, newId);
  };

  const loadSession = (sessionId: string, messages: Message[]) => {
    console.log('📂 Loading session:', sessionId, 'with', messages.length, 'messages');
    setConversationId(sessionId);
    setMessagesState(messages);
    localStorage.setItem(STORAGE_KEY, sessionId);
  };

  const saveCurrentSession = () => {
    const tempSession: TempSession = {
      conversationId,
      messages,
      timestamp: Date.now()
    };
    sessionStorage.setItem(TEMP_SESSION_KEY, JSON.stringify(tempSession));
    console.log('💾 Saved current session:', conversationId, 'messages:', messages.length);
  };

  const restoreCurrentSession = (): boolean => {
    const stored = sessionStorage.getItem(TEMP_SESSION_KEY);
    if (!stored) return false;

    try {
      const tempSession: TempSession = JSON.parse(stored);
      console.log('♻️ Restoring current session:', tempSession.conversationId, 'messages:', tempSession.messages.length);
      setConversationId(tempSession.conversationId);
      setMessagesState(tempSession.messages);
      localStorage.setItem(STORAGE_KEY, tempSession.conversationId);
      sessionStorage.removeItem(TEMP_SESSION_KEY);
      return true;
    } catch (error) {
      console.error('Failed to restore session:', error);
      sessionStorage.removeItem(TEMP_SESSION_KEY);
      return false;
    }
  };

  const hasCurrentSession = (): boolean => {
    const stored = sessionStorage.getItem(TEMP_SESSION_KEY);
    if (!stored) return false;

    try {
      JSON.parse(stored);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <ChatContext.Provider value={{ 
      conversationId, 
      messages, 
      appendMessage, 
      setMessages, 
      resetChat, 
      loadSession,
      saveCurrentSession,
      restoreCurrentSession,
      hasCurrentSession
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChatStore() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatStore must be used within ChatProvider');
  }
  return context;
}
