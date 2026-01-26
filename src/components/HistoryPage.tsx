import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { toast, Toaster } from 'sonner@2.0.3';
import { CanvasDetail, CanvasItem } from './CanvasDetail';

export interface ChatHistory {
  id: string;
  title: string;
  messageCount: number;
  lastMessage: string;
  timestamp: Date;
  previewImages: string[];
  isPublic: boolean;
  tags: string[];
}

interface HistoryPageProps {
  onNavigateToCommunity?: (name: string) => void;
  history: ChatHistory[];
  onUpdateHistory: (newHistory: ChatHistory[]) => void;
}

const SketchToggle = ({ isPublic, onToggle, label, size = 'md' }: { isPublic: boolean; onToggle: () => void; label?: boolean; size?: 'sm' | 'md' }) => {
  const width = size === 'sm' ? 36 : 48;
  const height = size === 'sm' ? 20 : 28;
  const radius = size === 'sm' ? 6 : 8;
  const padding = 4;
  const travel = width - radius * 2 - padding * 2;
  const startX = padding + radius;
  
  return (
    <div className="flex items-center gap-2 cursor-pointer group" onClick={(e) => { e.stopPropagation(); onToggle(); }}>
      {label && (
        <span className={`text-xs handwritten transition-colors select-none ${isPublic ? 'text-[#1a1a1a] font-bold' : 'text-[#6d6d6d]'}`}>
          {isPublic ? 'Public' : 'Private'}
        </span>
      )}
      <div style={{ width, height }} className="relative">
        <svg 
          viewBox={`0 0 ${width} ${height}`} 
          className="w-full h-full overflow-visible text-[#1a1a1a]"
          style={{ filter: 'url(#hand-drawn)' }}
        >
          {/* Rough Track */}
          <path
            d={`M${height/2} ${padding} L${width - height/2} ${padding} Q${width - padding} ${padding} ${width - padding} ${height/2} Q${width - padding} ${height - padding} ${width - height/2} ${height - padding} L${height/2} ${height - padding} Q${padding} ${height - padding} ${padding} ${height/2} Q${padding} ${padding} ${height/2} ${padding} Z`}
            fill={isPublic ? "#1a1a1a" : "#faf8f3"}
            fillOpacity={isPublic ? "0.1" : "1"}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          
          {/* Knob */}
          <motion.g
            initial={false}
            animate={{ x: isPublic ? travel : 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
          >
            {/* Main circle */}
            <circle cx={startX} cy={height/2} r={radius} fill={isPublic ? "#1a1a1a" : "#faf8f3"} stroke="currentColor" strokeWidth="2" />
            
            {/* Inner details for texture */}
            {!isPublic && (
               // Simple scratch for private
               <path d={`M${startX - 3} ${height/2 - 3} L${startX + 3} ${height/2 + 3} M${startX + 3} ${height/2 - 3} L${startX - 3} ${height/2 + 3}`} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            )}
            {isPublic && (
               // Simple check for public
               <path d={`M${startX - 3} ${height/2} L${startX - 1} ${height/2 + 3} L${startX + 4} ${height/2 - 3}`} stroke="#faf8f3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            )}
          </motion.g>
        </svg>
      </div>
    </div>
  );
};

export function HistoryPage({ onNavigateToCommunity, history, onUpdateHistory }: HistoryPageProps) {
  const [viewMode, setViewMode] = useState<'cards' | 'folders'>('cards');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    return date.toLocaleDateString();
  };

  const handleTitleChange = (id: string, newTitle: string) => {
    onUpdateHistory(history.map(item => 
      item.id === id ? { ...item, title: newTitle } : item
    ));
  };

  const togglePublic = (id: string) => {
    onUpdateHistory(history.map(item => 
      item.id === id ? { ...item, isPublic: !item.isPublic } : item
    ));
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') {
      setEditingId(null);
    }
  };

  // If a chat is selected, show the detail view
  if (selectedChatId) {
    const selectedChat = history.find(c => c.id === selectedChatId);
    if (selectedChat) {
      return (
        <CanvasDetail 
          item={{
            id: selectedChat.id,
            title: selectedChat.title,
            images: selectedChat.previewImages,
            content: selectedChat.lastMessage,
            tags: selectedChat.tags,
            isPublic: selectedChat.isPublic
          }}
          onClose={() => setSelectedChatId(null)} 
        />
      );
    }
  }

  return (
    <div className="h-screen overflow-y-auto" onClick={() => setEditingId(null)}>
      <div className="max-w-6xl mx-auto px-8 py-8">
        <div className="flex justify-end items-end mb-8">
          <div className="flex gap-3 bg-[#faf8f3] p-1 border-[2px] border-[#1a1a1a] hand-drawn-border">
            <button
              onClick={() => setViewMode('cards')}
              className={`p-2 transition-colors ${
                viewMode === 'cards' ? 'bg-[#e8e4d9]' : 'hover:bg-[#f0ece1]'
              }`}
              title="Card View"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <line x1="9" y1="21" x2="9" y2="9" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('folders')}
              className={`p-2 transition-colors ${
                viewMode === 'folders' ? 'bg-[#e8e4d9]' : 'hover:bg-[#f0ece1]'
              }`}
              title="Folder View"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
            </button>
          </div>
        </div>

        {viewMode === 'cards' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {history.map((chat) => (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                key={chat.id}
                className="bg-[#faf8f3] border-[2.5px] border-[#1a1a1a] p-6 hover:translate-y-[-2px] transition-transform hand-drawn-border wireframe-shadow group relative pb-12 cursor-pointer"
                onClick={() => setSelectedChatId(chat.id)}
              >
                {/* Folder icon representation */}
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 relative flex-shrink-0">
                    {/* Stack of preview images */}
                    {chat.previewImages.slice(0, 3).reverse().map((img, index) => {
                       const reverseIndex = chat.previewImages.slice(0, 3).length - 1 - index;
                       const rotation = reverseIndex === 0 ? -6 : reverseIndex === 1 ? -3 : 2;
                       const translateX = reverseIndex === 0 ? 0 : reverseIndex === 1 ? 2 : 0;
                       const translateY = reverseIndex === 0 ? 0 : reverseIndex === 1 ? 0 : -2;

                       return (
                         <div 
                           key={index}
                           className="absolute inset-0 bg-white border border-[#1a1a1a] shadow-sm overflow-hidden"
                           style={{
                             transform: `rotate(${rotation}deg) translate(${translateX}px, ${translateY}px)`,
                             zIndex: reverseIndex
                           }}
                         >
                           <img src={img} alt="" className="w-full h-full object-cover opacity-90" />
                         </div>
                       );
                    })}
                    {/* Fallback if no images */}
                    {chat.previewImages.length === 0 && (
                       <div className="w-full h-full border-[2.5px] border-[#1a1a1a] flex items-center justify-center hand-drawn-border">
                         <span className="text-xs font-bold">[ ]</span>
                       </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="mb-1 relative">
                       {editingId === chat.id ? (
                         <input
                           autoFocus
                           type="text"
                           value={chat.title}
                           onChange={(e) => handleTitleChange(chat.id, e.target.value)}
                           onKeyDown={(e) => handleKeyDown(e, chat.id)}
                           onBlur={() => setEditingId(null)}
                           onClick={(e) => e.stopPropagation()}
                           className="w-full bg-transparent border-b-2 border-[#1a1a1a] outline-none font-medium handwritten p-0"
                         />
                       ) : (
                         <h3 
                           onClick={(e) => {
                             e.stopPropagation();
                             setEditingId(chat.id);
                           }}
                           className="font-medium truncate handwritten cursor-text hover:text-[#1a1a1a]/70 transition-colors"
                           title="Click to edit"
                         >
                           {chat.title}
                         </h3>
                       )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-[#6d6d6d]">
                      <span className="w-3 h-3 border-[1.5px] border-current"></span>
                      <span>{chat.messageCount} msgs</span>
                    </div>
                  </div>
                </div>
                
                <p className="text-sm text-[#6d6d6d] mb-4 line-clamp-2">
                  {chat.lastMessage}
                </p>
                
                <div className="pt-3 border-t border-[#d4cdb8]">
                  <div className="text-xs text-[#6d6d6d] mb-3">
                    {formatDate(chat.timestamp)}
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mb-2 pr-12">
                    {chat.tags && chat.tags.slice(0, 5).map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 border-[1.5px] border-[#1a1a1a] text-xs font-medium hand-drawn-border bg-[#faf8f3] hover:bg-[#e8e4d9] cursor-pointer transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onNavigateToCommunity) onNavigateToCommunity(tag);
                        }}
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Public Toggle Slider */}
                <div className="absolute bottom-3 right-3">
                  <SketchToggle 
                    isPublic={chat.isPublic} 
                    onToggle={() => togglePublic(chat.id)} 
                    label={true}
                  />
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
            {history.map((chat) => (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                key={chat.id}
                className="flex flex-col items-center group relative pb-8 cursor-pointer"
                onClick={() => setSelectedChatId(chat.id)}
              >
                <div className="w-full aspect-[1.4/1] relative mb-4 transition-transform group-hover:scale-105 group-hover:-rotate-1">
                  <svg 
                    viewBox="0 0 200 160" 
                    className="w-full h-full text-[#faf8f3]" 
                    style={{ filter: 'url(#hand-drawn)' }}
                    preserveAspectRatio="xMidYMid meet"
                  >
                    {/* Back folder part with tab */}
                    <path 
                      d="M10 20 L80 20 L100 45 L190 45 L190 150 L10 150 Z" 
                      fill="#e8e4d9" 
                      stroke="#1a1a1a" 
                      strokeWidth="3" 
                      strokeLinejoin="round" 
                    />
                    {/* Front folder part */}
                    <path 
                      d="M10 65 L190 65 L190 150 L10 150 Z" 
                      fill="currentColor" 
                      stroke="#1a1a1a" 
                      strokeWidth="3" 
                      strokeLinejoin="round" 
                    />
                    {/* Detail lines on front */}
                    <path
                      d="M30 100 L170 100"
                      fill="none"
                      stroke="#1a1a1a"
                      strokeWidth="2"
                      strokeOpacity="0.1"
                      strokeLinecap="round"
                    />
                    <path
                      d="M30 120 L130 120"
                      fill="none"
                      stroke="#1a1a1a"
                      strokeWidth="2"
                      strokeOpacity="0.1"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                
                <div className="w-full px-4">
                    {editingId === chat.id ? (
                        <input
                            autoFocus
                            type="text"
                            value={chat.title}
                            onChange={(e) => handleTitleChange(chat.id, e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, chat.id)}
                            onBlur={() => setEditingId(null)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full text-center text-xl font-bold bg-transparent border-b-2 border-[#1a1a1a] outline-none handwritten p-0"
                        />
                    ) : (
                        <h3 
                            onClick={(e) => {
                                e.stopPropagation();
                                setEditingId(chat.id);
                            }}
                            className="text-xl font-bold text-center handwritten w-full truncate cursor-text hover:text-[#1a1a1a]/70 group-hover:underline decoration-wavy decoration-[#1a1a1a]/30"
                        >
                            {chat.title}
                        </h3>
                    )}
                </div>
                <div className="flex items-center gap-2 mt-2">
                   <span className="text-sm font-medium text-[#6d6d6d] handwritten">{formatDate(chat.timestamp)}</span>
                   {chat.isPublic && (
                     <span className="text-[10px] bg-[#1a1a1a] text-[#faf8f3] px-1.5 py-0.5 rounded-sm handwritten sketchy-line transform -rotate-1">Public</span>
                   )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}