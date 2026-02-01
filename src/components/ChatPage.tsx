import { useState, useRef, useEffect } from 'react';
import { Network, Image as ImageIcon, Mic, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast, Toaster } from 'sonner';
import { createChatArtifact, getChatMessages, sendChatMessage, saveToArchive } from '../lib/api';
import { getOrCreateChatSessionId, getChatMessagesKey, getOrCreateGuestId, resetChatSession, sanitizeMessagesForLocalStorage } from '../lib/guest';
import mermaid from 'mermaid';
import { useChatStore } from '../lib/chatStore';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  artifact?: {
    type: 'mindmap' | 'image' | 'save';
    data?: any;
    artifactId?: string;  // 后端返回的artifactId
    saved?: boolean;      // 是否已保存到archive
  };
  provider?: string;  // AI provider name (e.g., 'Google Gemini')
  model?: string;     // Model name (e.g., 'gemini-2.5-flash')
}

interface ChatPageProps {
  onHistorySync?: () => void;
}

// Add type definition for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const mapMessage = (message: { id: string; text: string; sender: 'user' | 'bot'; timestamp: string; artifact?: any }): Message => ({
  ...message,
  timestamp: new Date(message.timestamp)
});

/**
 * 创建最小化上下文用于 artifact 生成
 * - 只发送最后 N 条消息
 * - 只包含纯文本，移除 artifacts
 * - 截断每条消息以防止超长
 * - 过滤掉任何包含 base64 的内容
 */
const buildMinimalContext = (messages: Message[], maxMessages = 8, maxLength = 1500): Array<{ role: 'user' | 'assistant'; content: string }> => {
  // 取最后 N 条消息（减少到 8 条以确保安全）
  const recentMessages = messages.slice(-maxMessages);
  
  return recentMessages
    .filter(msg => !msg.text.includes('base64') && !msg.text.includes('data:image')) // 过滤 base64
    .map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.text.substring(0, maxLength) // 截断到安全长度
      // 明确不包含 artifact 数据
  }));
};

// Mermaid 思维导图渲染组件
const MermaidMindmap = ({ mermaidCode, id }: { mermaidCode: string; id: string }) => {
  const mermaidRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mermaidRef.current && mermaidCode) {
      // 初始化 Mermaid
      mermaid.initialize({
        startOnLoad: false,
        theme: 'default',
        securityLevel: 'loose',
        mindmap: {
          padding: 20,
          useMaxWidth: true
        }
      });

      // 渲染思维导图
      const renderMindmap = async () => {
        try {
          const { svg } = await mermaid.render(`mermaid-${id}`, mermaidCode);
          if (mermaidRef.current) {
            mermaidRef.current.innerHTML = svg;
          }
        } catch (error) {
          console.error('Mermaid render error:', error);
          if (mermaidRef.current) {
            mermaidRef.current.innerHTML = '<p class="text-red-500">Failed to render mindmap</p>';
          }
        }
      };

      renderMindmap();
    }
  }, [mermaidCode, id]);

  return <div ref={mermaidRef} className="mermaid-container"></div>;
};

export function ChatPage({ onHistorySync }: ChatPageProps) {
  // ✅ 使用全局 store，确保切页不丢
  const { conversationId, messages, appendMessage, setMessages, resetChat, loadSession } = useChatStore();
  
  const [inputValue, setInputValue] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [useMockVoice, setUseMockVoice] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isGeneratingArtifact, setIsGeneratingArtifact] = useState(false);
  const [artifactType, setArtifactType] = useState<string>('');
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ✅ 检查是否有从history页面加载的session
  useEffect(() => {
    const loadSessionId = sessionStorage.getItem('loadSessionId');
    const loadSessionMessages = sessionStorage.getItem('loadSessionMessages');
    
    if (loadSessionId && loadSessionMessages) {
      try {
        const messages = JSON.parse(loadSessionMessages);
        console.log('[ChatPage] 📂 Loading session from history:', loadSessionId);
        loadSession(loadSessionId, messages);
        
        // 清除sessionStorage
        sessionStorage.removeItem('loadSessionId');
        sessionStorage.removeItem('loadSessionMessages');
      } catch (error) {
        console.error('[ChatPage] Failed to load session from history:', error);
      }
    }
  }, []);

  // ✅ 刷新时从数据库恢复历史消息
  useEffect(() => {
    const loadHistoryMessages = async () => {
      // 只在刷新后（messages 为空）加载
      if (messages.length > 0) {
        setIsLoadingHistory(false);
        return;
      }

      try {
        console.log('[ChatPage] 🔄 Loading history for sessionId:', conversationId);
        const response = await fetch(`/api/chat?action=load&sessionId=${conversationId}`, {
          headers: {
            'X-Guest-ID': localStorage.getItem('hushtohues_guest_id') || ''
          }
        });
        
        if (!response.ok) {
          throw new Error(`Failed to load history: ${response.status}`);
        }
        
        const data = await response.json();
        const loadedMessages = (data.messages || []).map(mapMessage);
        
        if (loadedMessages.length > 0) {
          console.log('[ChatPage] ✅ Restored', loadedMessages.length, 'messages from DB');
          setMessages(loadedMessages);
        } else {
          console.log('[ChatPage] ℹ️  No history found for this session');
        }
      } catch (error) {
        console.error('[ChatPage] ❌ Failed to load history:', error);
        // 静默失败，不影响用户继续使用
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadHistoryMessages();
  }, [conversationId]); // conversationId 变化时重新加载

  // 自动保存聊天历史（只保存文字，不保存图片）
  useEffect(() => {
    const autoSaveHistory = async () => {
      // 只在有消息且有 AI 回复时才保存
      if (messages.length < 2) return;
      
      // 过滤掉包含图片的消息，只保留文字对话
      const textOnlyMessages = messages
        .filter(msg => !msg.artifact || msg.artifact.type !== 'image')
        .map(msg => ({
          id: msg.id,
          text: msg.text,
          sender: msg.sender,
          timestamp: msg.timestamp.toISOString()
        }));
      
      if (textOnlyMessages.length === 0) return;
      
      // 生成标题（使用第一条用户消息或默认标题）
      const firstUserMessage = messages.find(m => m.sender === 'user');
      const title = firstUserMessage 
        ? firstUserMessage.text.substring(0, 50) + (firstUserMessage.text.length > 50 ? '...' : '')
        : 'Chat Session';
      
      // 获取最后一条消息作为摘要
      const lastMessage = messages[messages.length - 1];
      const content = lastMessage.text.substring(0, 200);
      
      try {
        await saveToArchive({
          title,
          content,
          messages: textOnlyMessages,
          tags: ['auto-saved'],
          previewImages: []  // 不保存图片
        });
        console.log('✅ Auto-saved chat history:', title);
        
        // 触发历史记录刷新
        if (onHistorySync) {
          onHistorySync();
        }
      } catch (error) {
        console.error('❌ Failed to auto-save history:', error);
      }
    };
    
    // 使用防抖，避免频繁保存
    const timer = setTimeout(autoSaveHistory, 2000);
    return () => clearTimeout(timer);
  }, [messages, onHistorySync]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim() || isSending) return;

    const messageText = inputValue;
    setInputValue('');
    setIsSending(true);

    // ✅ 立即显示用户消息 - 使用 appendMessage
    const userMessage: Message = {
      id: `msg-${Date.now()}-u`,
      text: messageText,
      sender: 'user',
      timestamp: new Date()
    };
    appendMessage(userMessage);

    try {
      // ✅ 使用 store 的 conversationId
      const response = await sendChatMessage(messageText, conversationId) as any;
      
      // 只添加 AI 回复（最后一条消息）
      const aiMessage = response.messages[response.messages.length - 1];
      if (aiMessage && aiMessage.sender === 'bot') {
        const mappedMessage = mapMessage(aiMessage);
        // ✅ 添加 provider 和 model 信息
        if (response.provider) mappedMessage.provider = response.provider;
        if (response.model) mappedMessage.model = response.model;
        appendMessage(mappedMessage);
      }
    } catch (error) {
      console.error('Failed to send message', error);
      const errorText = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error details:', errorText);
      toast.error('Message failed to send.', { className: 'handwritten font-bold' });
      // 发送失败，移除刚才添加的用户消息
      setMessages(messages.filter((m: Message) => m.id !== userMessage.id));
    } finally {
      setIsSending(false);
    }
  };

  const handleArtifact = async (kind: string) => {
    setIsGeneratingArtifact(true);
    setArtifactType(kind);
    
    try {
      // ✅ 使用 store 的 conversationId
      console.log('📤 Creating artifact:', {
        kind,
        conversationId,
        totalMessages: messages.length
      });
      
      // 调用 API（后端从数据库读取 messages）
      const response = await createChatArtifact(kind, conversationId);
      
      // ✅ 验证 image artifact 必须有 imageUrl
      if (kind === 'image') {
        // 优先读取 artifact.imageUrl，fallback 到 generatedImage.imageUrl
        const imageUrl = response.artifact?.imageUrl || response.generatedImage?.imageUrl;
        if (!imageUrl || !imageUrl.startsWith('http')) {
          console.error('❌ Image artifact missing valid URL:', response);
          toast.error('Image generation failed: no valid URL returned');
          return;
        }
        console.log('✅ Image URL validated:', imageUrl);
      }
      
      // 🔒 创建 artifact 消息：只存储 URL 和元数据，绝对不存 base64
      const artifactMessage: Message = {
        id: `msg-${Date.now()}-artifact`,
        text: response.message.text,
        sender: 'bot',
        timestamp: new Date(response.message.timestamp),
        artifact: {
          type: kind as 'mindmap' | 'image' | 'save',
          data: kind === 'mindmap' 
            ? {
                mermaidCode: response.structuredMindmap?.mermaidCode,
                title: response.structuredMindmap?.title,
                summary: response.structuredMindmap?.summary
              }
            : kind === 'image' 
              ? {
                  // 优先从 artifact 读取，fallback 到 generatedImage
                  imageUrl: response.artifact?.imageUrl || response.generatedImage?.imageUrl,
                  title: response.artifact?.title || response.generatedImage?.title,
                  summary: response.artifact?.summary || response.generatedImage?.summary,
                  provider: response.artifact?.provider || response.generatedImage?.provider,
                  model: response.artifact?.model || response.generatedImage?.model,
                  storagePath: response.artifact?.storagePath
                  // 明确不包含：imageBase64, inlineData, dataUrl, bytes
                }
              : undefined
        }
      };
      
      // ✅ 使用 store 的 appendMessage
      appendMessage(artifactMessage);
      
      // ✅ 所有artifact只是生成成功，不自动保存到archive
      const kindLabel = kind === 'mindmap' ? 'Mindmap' : kind === 'image' ? 'Image' : kind;
      toast.success(`✅ ${kindLabel} generated successfully`, { 
        className: 'handwritten font-bold',
        duration: 3000
      });
      
    } catch (error) {
      console.error('❌ Artifact creation failed:', error);
      
      // 🔥 改进错误处理：提取关键信息，避免巨大字符串
      let errorMessage = 'Could not create artifact';
      
      if (error instanceof Error) {
        try {
          const errorData = JSON.parse(error.message);
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          // 截断错误消息以防止 toast 过长
          errorMessage = error.message?.substring(0, 150) || errorMessage;
        }
      }
      
      toast.error(errorMessage, { 
        className: 'handwritten font-bold',
        duration: 5000
      });
    } finally {
      setIsGeneratingArtifact(false);
      setArtifactType('');
    }
  };

  // ✅ New Chat 按钮：调用 store 的 resetChat
  const handleNewChat = () => {
    console.log('handleNewChat clicked');
    setShowNewChatDialog(true);
  };

  const confirmNewChat = () => {
    // ✅ 使用全局 store 的 resetChat
    resetChat();
    setInputValue('');
    setShowNewChatDialog(false);
    
    toast.success('Started a new chat!', { className: 'handwritten font-bold' });
    console.log('🆕 Started new chat with conversationId:', conversationId);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const simulateVoiceInput = () => {
    setIsListening(true);
    // Simulate a delay for "listening"
    setTimeout(() => {
      const mockPhrases = [
        'Create a mindmap about sustainable design.',
        'Show me an image of a futuristic city.',
        'Save this conversation to my project notes.',
        'What are some good fonts for a tech blog?',
        'Summarize the key points of our discussion.'
      ];
      const randomPhrase = mockPhrases[Math.floor(Math.random() * mockPhrases.length)];

      setInputValue((prev) => prev + (prev ? ' ' : '') + randomPhrase);
      setIsListening(false);
    }, 1500);
  };

  const handleVoiceInput = () => {
    if (isListening) return;

    // If we already know permission is denied, use simulation immediately
    if (useMockVoice) {
      simulateVoiceInput();
      return;
    }

    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      try {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true; // Enable interim results for real-time feedback
        recognition.lang = 'en-US';

        recognition.onstart = () => {
          setIsListening(true);
        };

        recognition.onresult = (event: any) => {
          // Process all results to find the final one
          let finalTranscript = '';
          
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            
            // Only append if this is a final result
            if (result.isFinal) {
              finalTranscript += result[0].transcript;
            }
            // Interim results are ignored - they're just for display/feedback
          }
          
          // Only update input value with final results
          if (finalTranscript) {
            setInputValue((prev) => prev + (prev ? ' ' : '') + finalTranscript);
          }
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognition.onerror = (event: any) => {
          console.error('Speech recognition error', event.error);
          setIsListening(false);

          if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            // Permission denied (common in iframes/previews). Switch to mock mode.
            console.log('Switching to simulated voice input due to permission restrictions.');
            setUseMockVoice(true);
            simulateVoiceInput();
          } else if (event.error === 'no-speech') {
            // Just ignore no-speech
          } else {
            alert(`Voice input error: ${event.error}`);
          }
        };

        recognition.start();
      } catch (error) {
        console.error('Speech recognition setup failed:', error);
        setUseMockVoice(true);
        simulateVoiceInput();
      }
    } else {
      // Browser doesn't support API, fallback to mock
      setUseMockVoice(true);
      simulateVoiceInput();
    }
  };

  const lastMessage = messages[messages.length - 1];
  const shouldShowActionBar = messages.length > 1 && lastMessage?.sender === 'bot' && inputValue.trim() === '';

  return (
    <>
    <div className="h-screen flex flex-col max-w-6xl mx-auto">
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: '#faf8f3',
            border: '2px solid #1a1a1a',
            color: '#1a1a1a',
            fontFamily: 'inherit'
          },
          className: 'hand-drawn-border'
        }}
      />

      {/* Hand-drawn filter definition */}
      <svg className="hidden">
        <defs>
          <filter id="hand-drawn" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="3" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="3" />
          </filter>
        </defs>
      </svg>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-8 py-6 relative">
        {isLoadingHistory && messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-3"></div>
              <p className="handwritten text-lg">Loading chat history...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {messages.map((message) => (
            <div key={message.id} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-2xl px-5 py-3 hand-drawn-border wireframe-shadow ${
                  message.sender === 'user' ? 'bg-[#e8e4d9]' : 'bg-[#faf8f3]'
                }`}
              >
                <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>
                
                {/* 渲染思维导图 */}
                {message.artifact?.type === 'mindmap' && message.artifact.data && (
                  <div className="mt-4 p-6 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl border-2 border-[#1a1a1a] hand-drawn-border shadow-lg">
                    {/* 头部 */}
                    <div className="flex items-center gap-2 mb-4 pb-3 border-b-2 border-dashed border-gray-300">
                      <span className="text-2xl">🧠</span>
                      <h3 className="font-bold text-xl text-gray-800">
                        {message.artifact.data.title || 'Mindmap'}
                      </h3>
                    </div>
                    
                    {/* 主内容区 */}
                    <div className="bg-white rounded-lg p-4 overflow-x-auto">
                      <MermaidMindmap 
                        mermaidCode={message.artifact.data.mermaidCode || 'mindmap\n  root((Empty))'} 
                        id={message.id}
                      />
                    </div>
                    
                    {/* 描述文字区 */}
                    {message.artifact.data.summary && (
                      <p className="mt-3 text-sm text-gray-600 italic">{message.artifact.data.summary}</p>
                    )}
                    
                    {/* 底部操作栏：右对齐 */}
                    <div className="flex justify-end mt-4">
                      <button
                        onClick={async () => {
                          if (message.artifact?.saved) return;
                          try {
                            console.log('[Mindmap Save] Sending request:', {
                              sessionId: conversationId,
                              artifactType: 'mindmap',
                              guestId: localStorage.getItem('hushtohues_guest_id')
                            });
                            
                            const response = await fetch('/api/archive?action=save', {
                              method: 'POST',
                              headers: { 
                                'Content-Type': 'application/json',
                                'X-Guest-ID': localStorage.getItem('hushtohues_guest_id') || ''
                              },
                              body: JSON.stringify({
                                sessionId: conversationId,
                                artifact: {
                                  type: 'mindmap',
                                  data: message.artifact?.data
                                }
                              })
                            });
                            
                            const result = await response.json();
                            console.log('[Mindmap Save] Response:', {
                              status: response.status,
                              ok: result.ok,
                              archiveId: result.archiveId,
                              totalArtifacts: result.totalArtifacts,
                              actor: result.actor,
                              sessionId: result.sessionId
                            });
                            
                            // 严格校验：只有 ok=true 且有 archiveId 才算成功
                            if (response.ok && result.ok === true && result.archiveId) {
                              const updated = messages.map(m => 
                                m.id === message.id && m.artifact
                                  ? { ...m, artifact: { ...m.artifact, saved: true } }
                                  : m
                              );
                              setMessages(updated);
                              toast.success('✅ Mindmap saved to archive');
                              // 立即刷新 History
                              if (onHistorySync) {
                                console.log('[Mindmap Save] Triggering history refresh');
                                onHistorySync();
                              }
                            } else {
                              console.error('[Mindmap Save] Failed:', result.error || 'Invalid response');
                              throw new Error(result.error || 'Save validation failed');
                            }
                        } catch (err) {
                          console.error('[Mindmap Save] Error:', err);
                          toast.error('Failed to save mindmap');
                        }
                      }}
                      disabled={message.artifact?.saved}
                      className={`px-4 py-2 text-sm font-bold transition-all border-[2.5px] border-[#1a1a1a] hand-drawn-border ${
                        message.artifact?.saved
                          ? 'bg-[#e8e4d9] text-[#6d6d6d] cursor-not-allowed opacity-60'
                          : 'bg-[#faf8f3] text-[#1a1a1a] hover:bg-[#e8e4d9] hover:translate-y-[-1px]'
                      }`}
                      style={{ minWidth: '80px' }}
                    >
                      {message.artifact?.saved ? '✓ Saved' : 'Save'}
                    </button>
                    </div>
                  </div>
                )}

                {/* 渲染生成的图片 */}
                {message.artifact?.type === 'image' && message.artifact.data && (
                  <div className="mt-4 p-6 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border-2 border-[#1a1a1a] hand-drawn-border shadow-lg">
                    {/* 头部 */}
                    <div className="flex items-center gap-2 mb-4 pb-3 border-b-2 border-dashed border-gray-300">
                      <span className="text-2xl">🎨</span>
                      <h3 className="font-bold text-xl text-gray-800">
                        {message.artifact.data.title || 'Generated Image'}
                      </h3>
                    </div>
                    
                    {/* 主内容区 */}
                    <div className="bg-white rounded-lg p-4">
                      {message.artifact.data.imageUrl ? (
                        <img 
                          src={message.artifact.data.imageUrl} 
                          alt={message.artifact.data.title || 'AI Generated'}
                          className="w-full rounded-lg shadow-md"
                          onError={(e) => {
                            const failedUrl = e.currentTarget.src;
                            console.error('❌ Image load failed:', failedUrl);
                            console.error('   Expected Supabase Storage URL');
                            e.currentTarget.src = 'https://placehold.co/600x400/EEE/31343C?text=Image+Load+Failed';
                            e.currentTarget.alt = 'Failed to load: ' + failedUrl;
                          }}
                        />
                      ) : (
                        <div className="bg-gray-100 rounded-lg p-8 text-center text-gray-500">
                          <p>Image URL not available</p>
                        </div>
                      )}
                    </div>
                    
                    {/* 描述文字区 */}
                    {message.artifact.data.summary && (
                      <p className="mt-3 text-sm text-gray-600 italic">{message.artifact.data.summary}</p>
                    )}
                    {/* 🔍 调试信息：显示 provider/model */}
                    {(message.artifact.data.provider || message.artifact.data.model) && (
                      <div className="mt-2 text-xs text-gray-400 font-mono">
                        provider={message.artifact.data.provider || 'unknown'} | 
                        model={message.artifact.data.model || 'unknown'}
                      </div>
                    )}
                    {message.artifact.data.prompt && (
                      <details className="mt-2">
                        <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">View prompt</summary>
                        <p className="mt-1 text-xs text-gray-600 bg-gray-50 p-2 rounded">{message.artifact.data.prompt}</p>
                      </details>
                    )}
                    
                    {/* 底部操作栏：右对齐 */}
                    <div className="flex justify-end mt-4">
                      <button
                        onClick={async () => {
                          if (message.artifact?.saved) return;
                          try {
                            console.log('[Image Save] Sending request:', {
                              sessionId: conversationId,
                              artifactType: 'image',
                              guestId: localStorage.getItem('hushtohues_guest_id')
                            });
                            
                            const response = await fetch('/api/archive?action=save', {
                              method: 'POST',
                              headers: { 
                                'Content-Type': 'application/json',
                                'X-Guest-ID': localStorage.getItem('hushtohues_guest_id') || ''
                              },
                              body: JSON.stringify({
                                sessionId: conversationId,
                                artifact: {
                                  type: 'image',
                                  data: message.artifact?.data
                                }
                              })
                            });
                            
                              const result = await response.json();
                            console.log('[Image Save] Response:', {
                              status: response.status,
                              ok: result.ok,
                              archiveId: result.archiveId,
                              totalArtifacts: result.totalArtifacts,
                              actor: result.actor,
                              sessionId: result.sessionId
                            });
                            
                            // 严格校验：只有 ok=true 且有 archiveId 才算成功
                            if (response.ok && result.ok === true && result.archiveId) {
                              const updated = messages.map(m => 
                                m.id === message.id && m.artifact
                                  ? { ...m, artifact: { ...m.artifact, saved: true } }
                                  : m
                              );
                              setMessages(updated);
                              toast.success('✅ Image saved to archive');
                              // 立即刷新 History
                              if (onHistorySync) {
                                console.log('[Image Save] Triggering history refresh');
                                onHistorySync();
                              }
                            } else {
                              console.error('[Image Save] Failed:', result.error || 'Invalid response');
                              throw new Error(result.error || 'Save validation failed');
                            }
                          } catch (err) {
                            console.error('[Image Save] Error:', err);
                            toast.error('Failed to save image');
                          }
                        }}
                        disabled={message.artifact?.saved}
                        className={`px-4 py-2 text-sm font-bold transition-all border-[2.5px] border-[#1a1a1a] hand-drawn-border ${
                          message.artifact?.saved
                            ? 'bg-[#e8e4d9] text-[#6d6d6d] cursor-not-allowed opacity-60'
                            : 'bg-[#faf8f3] text-[#1a1a1a] hover:bg-[#e8e4d9] hover:translate-y-[-1px]'
                        }`}
                        style={{ minWidth: '80px' }}
                      >
                        {message.artifact?.saved ? '✓ Saved' : 'Save'}
                      </button>
                    </div>
                  </div>
                )}
                
                {/* ✅ 可观测性：显示 provider 和 model */}
                {message.sender === 'bot' && (message.provider || message.model) && (
                  <div className="mt-3 pt-2 border-t border-dashed border-gray-300 flex items-center gap-3 text-xs text-gray-500">
                    {message.provider && (
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                        {message.provider}
                      </span>
                    )}
                    {message.model && (
                      <span className="px-2 py-0.5 bg-gray-100 rounded font-mono">
                        {message.model}
                      </span>
                    )}
                  </div>
                )}
                
                <span className="text-xs text-[#6d6d6d] mt-2 block">
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {isSending && (
            <div className="flex justify-start">
              <div className="max-w-2xl px-5 py-3 hand-drawn-border wireframe-shadow bg-[#faf8f3]">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-[#6d6d6d] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-2 h-2 bg-[#6d6d6d] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-2 h-2 bg-[#6d6d6d] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                  <span className="text-sm text-[#6d6d6d]">AI is thinking...</span>
                </div>
              </div>
            </div>
          )}

          {/* Artifact generation indicator */}
          {isGeneratingArtifact && (
            <div className="flex justify-start">
              <div className="max-w-2xl px-5 py-3 hand-drawn-border wireframe-shadow bg-[#faf8f3]">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-[#6d6d6d] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-2 h-2 bg-[#6d6d6d] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-2 h-2 bg-[#6d6d6d] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                  <span className="text-sm text-[#6d6d6d]">
                    {artifactType === 'image' && '🎨 Generating image...'}
                    {artifactType === 'mindmap' && '🧠 Creating mindmap...'}
                    {artifactType === 'save' && '💾 Saving to archive...'}
                    {!artifactType && 'Processing...'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Action Bar */}
          {shouldShowActionBar && (
            <div className="flex justify-center pt-8 pb-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="flex gap-10 px-8 py-5 bg-[#faf8f3] hand-drawn-border wireframe-shadow items-center relative z-10">
                {/* Decorative tape effect */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-4 bg-[#e8e4d9] opacity-50 rotate-[-2deg] border border-[#1a1a1a]/20" />

                <button
                  onClick={() => handleArtifact('mindmap')}
                  className="flex flex-col items-center gap-2 group transition-transform hover:-translate-y-1"
                >
                  <div className="relative flex items-center justify-center w-12 h-12 sketch-btn">
                    <svg
                      viewBox="0 0 100 100"
                      className="absolute inset-0 w-full h-full text-[#1a1a1a] group-hover:text-[#4a4a4a] transition-colors"
                      style={{ filter: 'url(#hand-drawn)' }}
                    >
                      <path
                        d="M 50 5 C 20 5 5 25 5 50 C 5 80 25 95 50 95 C 80 95 95 75 95 50 C 95 25 75 10 55 12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="5"
                        strokeLinecap="round"
                      />
                    </svg>
                    <Network className="w-5 h-5 text-[#1a1a1a] relative z-10" />
                  </div>
                  <span className="text-xs font-bold handwritten text-[#1a1a1a]">Mindmap</span>
                </button>

                <button
                  onClick={() => handleArtifact('image')}
                  className="flex flex-col items-center gap-2 group transition-transform hover:-translate-y-1"
                >
                  <div className="relative flex items-center justify-center w-12 h-12 sketch-btn">
                    <svg
                      viewBox="0 0 100 100"
                      className="absolute inset-0 w-full h-full text-[#1a1a1a] group-hover:text-[#4a4a4a] transition-colors"
                      style={{ filter: 'url(#hand-drawn)' }}
                    >
                      <path
                        d="M 45 8 C 70 5 92 25 90 50 C 88 80 65 92 40 90 C 15 88 5 65 10 40 C 15 20 30 10 48 12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="5"
                        strokeLinecap="round"
                      />
                    </svg>
                    <ImageIcon className="w-5 h-5 text-[#1a1a1a] relative z-10" />
                  </div>
                  <span className="text-xs font-bold handwritten text-[#1a1a1a]">Image</span>
                </button>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t-3 border-[#1a1a1a] bg-[#faf8f3] px-8 py-6 hand-drawn-border z-20">
        <div className="flex gap-3">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            className="flex-1 px-5 py-3 border-[2.5px] border-[#1a1a1a] bg-[#faf8f3] focus:outline-none hand-drawn-border"
          />
          <button
            onClick={handleNewChat}
            className="px-4 flex items-center justify-center border-[2.5px] border-[#1a1a1a] bg-[#faf8f3] text-[#1a1a1a] hover:bg-[#e8e4d9] transition-colors sketch-btn hand-drawn-border"
            title="Start a new chat"
          >
            <Plus className="w-5 h-5" />
          </button>
          <button
            onClick={handleVoiceInput}
            className={`px-4 flex items-center justify-center border-[2.5px] border-[#1a1a1a] transition-colors sketch-btn hand-drawn-border ${
              isListening
                ? 'bg-[#ff6b6b] text-white animate-pulse'
                : 'bg-[#faf8f3] text-[#1a1a1a] hover:bg-[#e8e4d9]'
            }`}
            title="Voice Input"
          >
            <Mic className={`w-5 h-5 ${isListening ? 'animate-bounce' : ''}`} />
          </button>
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isSending}
            className="px-6 py-3 bg-[#1a1a1a] text-[#f5f1e8] border-[2.5px] border-[#1a1a1a] hover:bg-[#2d2d2d] disabled:opacity-40 disabled:cursor-not-allowed transition-all sketch-btn hand-drawn-border"
          >
            {isSending ? 'Sending...' : 'Send →'}
          </button>
        </div>
      </div>

      {/* New Chat Confirmation Dialog - Custom Modal */}
      {showNewChatDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          {/* Overlay */}
          <div 
            className="absolute inset-0 bg-black/50" 
            onClick={() => setShowNewChatDialog(false)}
          />
          
          {/* Dialog Content */}
          <div className="relative bg-[#faf8f3] border-[2.5px] border-[#1a1a1a] hand-drawn-border max-w-lg mx-4 p-6 z-10">
            <h2 className="handwritten text-xl text-[#1a1a1a] mb-3">Start a New Chat?</h2>
            <p className="text-[#1a1a1a] text-base mb-6">
              Please save any images from your current chat to archive first. Once you start a new chat, you won't be able to go back to this conversation.
            </p>
            
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowNewChatDialog(false)}
                className="px-4 py-2 border-[2.5px] border-[#1a1a1a] bg-[#faf8f3] hover:bg-[#e8e4d9] text-[#1a1a1a] hand-drawn-border transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmNewChat}
                className="px-4 py-2 border-[2.5px] border-[#1a1a1a] bg-[#1a1a1a] text-[#f5f1e8] hover:bg-[#2d2d2d] hand-drawn-border transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
