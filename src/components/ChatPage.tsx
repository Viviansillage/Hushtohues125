import { useState, useRef, useEffect } from 'react';
import { Network, Image as ImageIcon, Save, Mic } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast, Toaster } from 'sonner@2.0.3';
import { createChatArtifact, getChatMessages, sendChatMessage } from '../lib/api';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
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

const mapMessage = (message: { id: string; text: string; sender: 'user' | 'bot'; timestamp: string }): Message => ({
  ...message,
  timestamp: new Date(message.timestamp)
});

export function ChatPage({ onHistorySync }: ChatPageProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [useMockVoice, setUseMockVoice] = useState(false); // Fallback state for demo environments
  const [isSending, setIsSending] = useState(false);
  // State to track if the Save button or its menu is being hovered
  const [isSaveHovered, setIsSaveHovered] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;
    const loadMessages = async () => {
      try {
        const data = await getChatMessages();
        if (!isMounted) return;
        setMessages(data.map(mapMessage));
      } catch (error) {
        console.error('Failed to load messages', error);
      }
    };
    loadMessages();
    return () => {
      isMounted = false;
    };
  }, []);

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

    try {
      const response = await sendChatMessage(messageText);
      setMessages(response.messages.map(mapMessage));
      onHistorySync?.();
    } catch (error) {
      console.error('Failed to send message', error);
      toast.error('Message failed to send.', { className: 'handwritten font-bold' });
    } finally {
      setIsSending(false);
    }
  };

  const handleArtifact = async (kind: string) => {
    try {
      const response = await createChatArtifact(kind);
      setMessages((prev) => [...prev, mapMessage(response.message)]);
      onHistorySync?.();
      toast.success(`Saved ${kind} to your archive.`, { className: 'handwritten font-bold' });
    } catch (error) {
      console.error('Failed to create artifact', error);
      toast.error('Could not save that yet.', { className: 'handwritten font-bold' });
    }
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
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
          setIsListening(true);
        };

        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setInputValue((prev) => prev + (prev ? ' ' : '') + transcript);
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

  // Options for the save menu
  const saveOptions = [
    { id: 'image', label: 'Image', path: 'M 5 25 C 5 10 20 5 50 8 C 80 5 95 15 95 30 C 95 45 80 55 50 52 C 20 55 5 45 5 25' },
    { id: 'mindmap', label: 'Mindmap', path: 'M 8 28 C 10 12 30 5 55 5 C 85 8 92 18 90 32 C 88 48 75 55 45 52 C 15 55 5 42 8 28' },
    { id: 'text', label: 'Text', path: 'M 6 30 C 8 15 25 8 50 10 C 80 8 95 20 92 35 C 90 50 70 55 45 52 C 20 52 2 40 6 30' },
    { id: 'all', label: 'All', path: 'M 10 28 C 10 12 30 8 52 8 C 85 10 95 22 92 35 C 85 50 65 55 40 52 C 15 50 5 40 10 28' }
  ];

  return (
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
        <div className="space-y-6">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-2xl px-5 py-3 hand-drawn-border wireframe-shadow ${
                  message.sender === 'user' ? 'bg-[#e8e4d9]' : 'bg-[#faf8f3]'
                }`}
              >
                <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>
                <span className="text-xs text-[#6d6d6d] mt-2 block">
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}

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

                {/* Save Button with Pop-out Menu */}
                <div
                  className="relative flex flex-col items-center gap-2"
                  onMouseEnter={() => setIsSaveHovered(true)}
                  onMouseLeave={() => setIsSaveHovered(false)}
                >
                  <button className="flex flex-col items-center gap-2 group transition-transform hover:-translate-y-1 relative z-20">
                    <div className="relative flex items-center justify-center w-12 h-12 sketch-btn">
                      <svg
                        viewBox="0 0 100 100"
                        className="absolute inset-0 w-full h-full text-[#1a1a1a] group-hover:text-[#4a4a4a] transition-colors"
                        style={{ filter: 'url(#hand-drawn)' }}
                      >
                        <path
                          d="M 60 95 C 30 92 10 70 12 40 C 15 15 40 5 65 8 C 90 12 95 40 90 70 C 85 90 70 95 55 92"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="5"
                          strokeLinecap="round"
                        />
                      </svg>
                      <Save className="w-5 h-5 text-[#1a1a1a] relative z-10" />
                    </div>
                    <span className="text-xs font-bold handwritten text-[#1a1a1a]">Save</span>
                  </button>

                  {/* Pop-out Menu */}
                  <AnimatePresence>
                    {isSaveHovered && (
                      <div className="absolute left-full top-1/2 -translate-y-1/2 ml-14 flex flex-col gap-3 z-30">
                        {saveOptions.map((option, index) => (
                          <motion.button
                            key={option.id}
                            onClick={() => handleArtifact(option.id)}
                            initial={{ opacity: 0, x: -15, scale: 0.8 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: -10, scale: 0.8 }}
                            transition={{
                              duration: 0.3,
                              delay: index * 0.05,
                              type: 'spring',
                              stiffness: 300,
                              damping: 20
                            }}
                            className="relative flex items-center justify-center group/opt"
                          >
                            {/* Sketchy Oval Background */}
                            <svg
                              viewBox="0 0 100 60"
                              className="absolute w-[120%] h-[140%] text-[#1a1a1a] opacity-80 group-hover/opt:text-[#4a4a4a] transition-colors"
                              style={{ filter: 'url(#hand-drawn)' }}
                            >
                              <path d={option.path} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                            </svg>
                            {/* Text */}
                            <span className="relative z-10 px-4 py-2 text-sm font-bold handwritten text-[#1a1a1a] whitespace-nowrap">
                              {option.label}
                            </span>
                          </motion.button>
                        ))}
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
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
    </div>
  );
}
