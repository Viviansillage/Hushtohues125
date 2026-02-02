import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { MessageSquare, Calendar, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export interface ChatSession {
  id: string;
  sessionId: string;
  title: string;
  preview: string;
  messageCount: number;
  timestamp: Date;
}

interface ChatHistoryPageProps {
  sessions: ChatSession[];
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
}

export function ChatHistoryPage({ 
  sessions = [], 
  onSelectSession,
  onDeleteSession
}: ChatHistoryPageProps) {
  const [sortedSessions, setSortedSessions] = useState<ChatSession[]>([]);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  useEffect(() => {
    // Sort sessions by timestamp (newest first)
    const sorted = [...sessions].sort((a, b) => 
      b.timestamp.getTime() - a.timestamp.getTime()
    );
    setSortedSessions(sorted);
  }, [sessions]);

  const handleDelete = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this chat history?')) {
      return;
    }

    setIsDeleting(sessionId);
    try {
      await onDeleteSession(sessionId);
      toast.success('Chat history deleted');
    } catch (error) {
      console.error('Failed to delete chat history:', error);
      toast.error('Failed to delete chat history');
    } finally {
      setIsDeleting(null);
    }
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    // Show relative time for recent messages
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 0) return 'Today ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    if (days === 1) return 'Yesterday ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    
    // For older messages, show date and time
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    }) + ' ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div className="h-screen flex flex-col max-w-6xl mx-auto px-8 py-6">
      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto">
        {sortedSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[#6d6d6d]">
            <MessageSquare className="w-16 h-16 mb-4 opacity-30" />
            <p className="handwritten text-xl">No chat history yet</p>
            <p className="text-sm mt-2">Start chatting to see your conversation history here</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedSessions.map((session) => (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#faf8f3] border-[2.5px] border-[#1a1a1a] hand-drawn-border p-5 cursor-pointer hover:bg-[#e8e4d9] transition-colors group"
                onClick={() => onSelectSession(session.sessionId)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Title */}
                    <h3 className="font-bold text-[#1a1a1a] text-lg mb-2 truncate">
                      {session.title}
                    </h3>
                    
                    {/* Preview */}
                    <p className="text-[#6d6d6d] text-sm line-clamp-2 mb-3">
                      {session.preview}
                    </p>
                    
                    {/* Meta Info */}
                    <div className="flex items-center gap-4 text-xs text-[#6d6d6d]">
                      <div className="flex items-center gap-1">
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>{session.messageCount} messages</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{formatDate(session.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Delete Button */}
                  <button
                    onClick={(e) => handleDelete(session.sessionId, e)}
                    disabled={isDeleting === session.sessionId}
                    className="p-2 border-[2px] border-[#1a1a1a] bg-[#faf8f3] hover:bg-[#ff6b6b] hover:text-white transition-colors hand-drawn-border opacity-0 group-hover:opacity-100"
                    title="Delete chat history"
                  >
                    {isDeleting === session.sessionId ? (
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
