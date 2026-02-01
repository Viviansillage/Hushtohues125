/**
 * 全局聊天状态管理 - 确保切换页面时对话不丢失
 * localStorage 只存轻量信息（conversationId），messages 存内存
 */
import { createContext, useContext, useState, ReactNode, useEffect } from 'react';

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
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

const STORAGE_KEY = 'hth_current_conversation_id';

function generateConversationId(): string {
  return `conv-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function ChatProvider({ children }: { children: ReactNode }) {
  // 初始化 conversationId：优先从 localStorage 读取（轻量）
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

  // messages 只存内存（切页不丢，刷新会丢 - 符合要求）
  const [messages, setMessagesState] = useState<Message[]>([]);

  // 同步 conversationId 到 localStorage（轻量，安全）
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, conversationId);
  }, [conversationId]);

  const appendMessage = (message: Message) => {
    setMessagesState(prev => [...prev, message]);
  };

  const setMessages = (newMessages: Message[]) => {
    setMessagesState(newMessages);
  };

  const resetChat = () => {
    const newId = generateConversationId();
    console.log('🔄 Reset chat, new conversationId:', newId);
    setConversationId(newId);
    setMessagesState([]);
    localStorage.setItem(STORAGE_KEY, newId);
  };

  return (
    <ChatContext.Provider value={{ conversationId, messages, appendMessage, setMessages, resetChat }}>
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
