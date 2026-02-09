import { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, MessageSquare } from 'lucide-react';
import { motion } from 'motion/react';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: string;
}

interface ChatHistoryDetailPageProps {
  sessionId: string;
  onBack: () => void;
}

export function ChatHistoryDetailPage({ sessionId, onBack }: ChatHistoryDetailPageProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionTitle, setSessionTitle] = useState('Chat History');
  const [sessionDate, setSessionDate] = useState<Date | null>(null);

  useEffect(() => {
    const loadSession = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/chat?action=load&sessionId=${sessionId}`, {
          headers: {
            'X-Guest-ID': localStorage.getItem('hushtohues_guest_id') || ''
          }
        });
        
        if (!response.ok) throw new Error('Failed to load session');
        
        const data = await response.json();
        setMessages(data.messages || []);
        
        // Get title from first message
        if (data.messages && data.messages.length > 0) {
          const firstUserMsg = data.messages.find((m: Message) => m.sender === 'user');
          if (firstUserMsg) {
            const title = firstUserMsg.text.substring(0, 50);
            setSessionTitle(title.length < firstUserMsg.text.length ? title + '...' : title);
          }
          setSessionDate(new Date(data.messages[0].timestamp));
        }
      } catch (error) {
        console.error('Failed to load session:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSession();
  }, [sessionId]);

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays === 0) {
      return `Today ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays === 1) {
      return `Yesterday ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      return date.toLocaleString('en-US', { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  return (
    <div className="h-screen flex flex-col max-w-6xl mx-auto px-8 py-6">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 border-[2.5px] border-[#1a1a1a] bg-white text-[#1a1a1a] hover:bg-[#f0ece1] transition-colors hand-drawn-border mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="font-bold">Back to History</span>
        </button>

        <div className="flex items-start gap-4">
          <MessageSquare className="w-8 h-8 text-[#1a1a1a] flex-shrink-0 mt-1" />
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-[#1a1a1a] mb-2">{sessionTitle}</h1>
            {sessionDate && (
              <div className="flex items-center gap-2 text-sm text-[#6d6d6d]">
                <Calendar className="w-4 h-4" />
                <span>{formatDate(sessionDate)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages - Read Only View */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-3"></div>
              <p className="handwritten text-lg">Loading conversation...</p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <p className="handwritten text-lg">No messages in this conversation</p>
          </div>
        ) : (
          <div className="space-y-6 pb-6">
            {messages.map((message, index) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-2xl px-5 py-3 hand-drawn-border wireframe-shadow ${
                    message.sender === 'user' ? 'bg-[#e8e4d9]' : 'bg-[#faf8f3]'
                  }`}
                >
                  <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>
                  <p className="text-xs text-[#6d6d6d] mt-2">
                    {new Date(message.timestamp).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
