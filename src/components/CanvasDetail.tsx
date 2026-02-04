import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Resizable } from 're-resizable';
import { toast, Toaster } from 'sonner';
import mermaid from 'mermaid';
import { updateHistoryItem } from '../lib/api';

export interface CanvasItem {
  id: string;
  title: string;
  images: string[];
  mindmaps?: Array<{ mermaidCode: string; summary?: string }>;
  imageArtifacts?: Array<{ imageUrl: string; summary?: string }>;  // ✅ 只保留summary
  content: string;
  tags?: string[];
  isPublic?: boolean;
  author?: { name: string };
  stats?: {
    likes: number;
    comments: number;
  };
  contentJson?: {
    title?: string;
    items?: DraggableItem[];
    timestamp?: string;
  };
}

export interface DraggableItem {
  id: string;
  type: 'text' | 'image' | 'mindmap';
  content: string;
  x: number;
  y: number;
  width: number | string;
  height: number | string;
  zIndex: number;
  meta?: { title?: string; summary?: string };
}

interface CanvasDetailProps {
  item: CanvasItem;
  onClose: () => void;
  readOnly?: boolean;
}

interface Comment {
  id: string;
  author: string;
  text: string;
  timestamp: Date;
}

const ShareCircleButton = ({ icon, label, onClick, isActive = false }: { icon: React.ReactNode, label: string, onClick: () => void, isActive?: boolean }) => (
  <motion.button
    whileHover={{ scale: 1.1 }}
    whileTap={{ scale: 0.95 }}
    onClick={(e) => {
        e.stopPropagation();
        onClick();
    }}
    className={`relative group/circle w-14 h-14 flex items-center justify-center focus:outline-none ${isActive ? 'text-[#faf8f3]' : 'text-[#4a4a4a] hover:text-[#1a1a1a]'}`}
  >
    {/* Doodle SVG Circle - Messy Hand-drawn style */}
    <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" viewBox="0 0 60 60">
        <path 
            d="M30 5 C 15 4 5 15 6 30 C 7 45 18 55 33 54 C 48 53 56 42 54 27 C 52 12 42 6 30 5 Z M 29 5 C 32 5 35 6 38 7"
            fill={isActive ? "#1a1a1a" : "none"} 
            stroke={isActive ? "none" : "#1a1a1a"}
            strokeWidth="2" 
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ filter: 'url(#hand-drawn-border)' }}
        />
        {/* Fill for active state needs to be separate if we want the stroke to look sketched */}
        {isActive && (
            <path 
                d="M30 6 C 16 5 6 16 7 30 C 8 44 19 54 33 53 C 47 52 55 41 53 27 C 51 13 41 7 30 6 Z"
                fill="#1a1a1a"
                stroke="none"
                style={{ filter: 'url(#hand-drawn-border)' }}
            />
        )}
    </svg>
    
    <div className="relative z-10 scale-90">{icon}</div>
    
    {/* Label Tooltip */}
    <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-[#1a1a1a] text-[#faf8f3] text-xs px-2 py-1 rounded opacity-0 group-hover/circle:opacity-100 transition-opacity whitespace-nowrap handwritten pointer-events-none z-50">
       {label}
    </div>
  </motion.button>
);

const AutoResizingTextarea = ({ item, onChange, readOnly }: { item: DraggableItem, onChange: (val: string) => void, readOnly?: boolean }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  useLayoutEffect(() => {
    if (textareaRef.current) {
      // 保存当前光标位置
      const selectionStart = textareaRef.current.selectionStart;
      const selectionEnd = textareaRef.current.selectionEnd;
      
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
      
      // 恢复光标位置
      if (document.activeElement === textareaRef.current) {
        textareaRef.current.setSelectionRange(selectionStart, selectionEnd);
      }
    }
  }, [item.content, item.width]);

  return (
    <textarea
      ref={textareaRef}
      value={item.content}
      readOnly={readOnly}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-transparent outline-none resize-none handwritten text-2xl overflow-hidden leading-[3rem]"
      style={{ 
        backgroundImage: 'repeating-linear-gradient(transparent, transparent 2.9rem, #1a1a1a20 2.95rem, transparent 3rem)',
        backgroundAttachment: 'local',
        paddingTop: '0.2rem', // Fine-tune text alignment with lines
        minHeight: '3rem'
      }}
      onPointerDown={(e) => e.stopPropagation()}
      autoFocus={!readOnly && item.content === 'Type something...'}
    />
  );
};

const MermaidMindmap = ({ mermaidCode, id }: { mermaidCode: string; id: string }) => {
  const mermaidRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mermaidRef.current && mermaidCode) {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'default',
        securityLevel: 'loose',
        mindmap: {
          padding: 20,
          useMaxWidth: true
        }
      });

      const renderMindmap = async () => {
        try {
          const { svg } = await mermaid.render(`archive-mermaid-${id}`, mermaidCode);
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

export const CanvasDetail = ({ item, onClose, readOnly = false }: CanvasDetailProps) => {
  const [title, setTitle] = useState(item.title);
  // Default isPreview to readOnly (true in community view, false in archive edit)
  const [isPreview, setIsPreview] = useState(readOnly);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [isShareMenuOpen, setIsShareMenuOpen] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const savedStateRef = useRef<string>(''); // 用于比较是否有修改
  
  // Social State
  const [likes, setLikes] = useState(item.stats?.likes || 0);
  const [isLiked, setIsLiked] = useState(false);
  const [comments, setComments] = useState<Comment[]>([
    { id: '1', author: 'DesignBot', text: 'Love the layout on this one!', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2) },
    { id: '2', author: 'Sketcher99', text: 'Is this drawn with the pencil tool?', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5) },
  ]);
  const [newComment, setNewComment] = useState('');

  // Initialize items
  const [items, setItems] = useState<DraggableItem[]>(() => {
    console.log('[CanvasDetail] Initializing items, readOnly:', readOnly, 'item.id:', item.id);
    console.log('[CanvasDetail] item.contentJson:', item.contentJson);
    
    // Priority 1: Check if contentJson has saved items (from database, used in community/readOnly)
    if (item.contentJson?.items && Array.isArray(item.contentJson.items) && item.contentJson.items.length > 0) {
      console.log('[CanvasDetail] ✅ Loading from contentJson.items:', item.contentJson.items.length);
      return item.contentJson.items;
    }
    
    // Priority 2: Try to load saved state from localStorage (for archive mode)
    const savedState = localStorage.getItem(`canvas-${item.id}`);
    if (savedState && !readOnly) {
      try {
        const parsed = JSON.parse(savedState);
        if (parsed.items && Array.isArray(parsed.items) && parsed.items.length > 0) {
          console.log('[CanvasDetail] ✅ Loading from localStorage:', parsed.items.length);
          return parsed.items;
        }
      } catch (e) {
        console.error('Failed to parse saved state:', e);
      }
    }
    
    console.log('[CanvasDetail] ⚠️ Using default layout generation');
    const generatedItems: DraggableItem[] = [];
    const hasImages = item.images && item.images.length > 0;
    const imagesToLoad = hasImages ? item.images : [];
    const imageArtifactsData = item.imageArtifacts || [];  // ✅ 获取完整的image信息
    const mindmapsToLoad = item.mindmaps || [];
    
    let currentY = 160;  // 起始Y坐标
    
    // Stack images vertically on the left, with text boxes on the right
    imagesToLoad.forEach((imgUrl, index) => {
      // ✅ 查找对应的summary
      const artifactData = imageArtifactsData.find(a => a.imageUrl === imgUrl);
      
      // 左侧：图片
      generatedItems.push({
        id: `img-${index}`,
        type: 'image',
        content: imgUrl,
        x: 60 + (index % 2 * 10),
        y: currentY,
        width: 400,
        height: 'auto',
        zIndex: index * 2 + 1
      });
      
      // 右侧：对应的文本框（summary）
      if (artifactData?.summary) {
        generatedItems.push({
          id: `txt-img-${index}`,
          type: 'text',
          content: artifactData.summary,
          x: 520,
          y: currentY,
          width: 400,
          height: 'auto',
          zIndex: index * 2 + 2
        });
      }
      
      currentY += 420;  // 增加垂直间距
    });

    mindmapsToLoad.forEach((mindmap, index) => {
      // 左侧：mindmap
      generatedItems.push({
        id: `mindmap-${index}`,
        type: 'mindmap',
        content: mindmap.mermaidCode,
        x: 60 + (index % 2 * 10),
        y: currentY,
        width: 420,
        height: 280,
        zIndex: (imagesToLoad.length + index) * 2 + 1
      });
      
      // 右侧：对应的文本框（summary）
      if (mindmap.summary) {
        generatedItems.push({
          id: `txt-mindmap-${index}`,
          type: 'text',
          content: mindmap.summary,
          x: 520,
          y: currentY,
          width: 400,
          height: 'auto',
          zIndex: (imagesToLoad.length + index) * 2 + 2
        });
      }
      
      currentY += 420;  // 增加垂直间距
    });

    return generatedItems;
  });

  // Load saved title and initialize saved state reference
  useEffect(() => {
    // Initialize savedStateRef with current state after items are loaded
    const currentState = JSON.stringify({ title, items });
    savedStateRef.current = currentState;
    
    // Try to load saved title from localStorage (only in archive mode)
    if (!readOnly) {
      const savedState = localStorage.getItem(`canvas-${item.id}`);
      if (savedState) {
        try {
          const parsed = JSON.parse(savedState);
          if (parsed.title && parsed.title !== title) {
            setTitle(parsed.title);
          }
        } catch (e) {
          console.error('Failed to load saved title:', e);
        }
      }
    }
  }, []);

  // Track changes
  useEffect(() => {
    const currentState = JSON.stringify({ title, items });
    setHasUnsavedChanges(currentState !== savedStateRef.current);
  }, [title, items]);

  // 计算需要的最小画布高度（基于所有artifacts数量）
  const imageCount = item.images?.length || 0;
  const mindmapCount = item.mindmaps?.length || 0;
  const totalArtifacts = imageCount + mindmapCount;
  const calculatedMinHeight = totalArtifacts > 0 
    ? 160 + (totalArtifacts * 420) + 200  // 起始位置 + (总artifacts数 * 间距) + 底部留白
    : 2000;  // 默认高度

  const bringToFront = (id: string) => {
    if (readOnly && isPreview) return;
    setItems(prev => {
      const maxZ = Math.max(...prev.map(i => i.zIndex), 0);
      return prev.map(item => item.id === id ? { ...item, zIndex: maxZ + 1 } : item);
    });
  };

  const handleResizeStop = (id: string, ref: HTMLElement, d: any) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      return {
        ...item,
        width: ref.style.width,
        height: item.type === 'text' ? 'auto' : ref.style.height, // Text height is auto
      };
    }));
  };

  const handleLike = () => {
    setIsLiked(!isLiked);
    setLikes(prev => isLiked ? prev - 1 : prev + 1);
    toast(isLiked ? "Unliked post" : "Liked post!", {
       icon: isLiked ? '💔' : '❤️',
       className: "handwritten font-bold"
    });
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    const comment: Comment = {
      id: Date.now().toString(),
      author: 'You',
      text: newComment,
      timestamp: new Date()
    };

    setComments(prev => [comment, ...prev]);
    setNewComment('');
  };

  const handleSave = async () => {
    const dataToSave = {
      title,
      items,
      timestamp: new Date().toISOString()
    };
    
    // Save to localStorage
    localStorage.setItem(`canvas-${item.id}`, JSON.stringify(dataToSave));
    savedStateRef.current = JSON.stringify({ title, items });
    setHasUnsavedChanges(false);
    
    // Also update the database if not in readOnly mode
    if (!readOnly) {
      try {
        await updateHistoryItem(item.id, {
          title,
          contentJson: dataToSave
        });
        toast.success('Canvas saved!', { className: 'handwritten font-bold' });
      } catch (error) {
        console.error('Failed to save to database:', error);
        toast.warning('Saved locally, but failed to sync to server', { className: 'handwritten font-bold' });
      }
    } else {
      toast.success('Canvas saved locally!', { className: 'handwritten font-bold' });
    }
  };

  const handleClose = () => {
    if (hasUnsavedChanges && !readOnly) {
      setShowExitConfirm(true);
    } else {
      onClose();
    }
  };

  const handleExitWithoutSaving = () => {
    setShowExitConfirm(false);
    onClose();
  };

  const handleSaveAndExit = () => {
    handleSave();
    setShowExitConfirm(false);
    onClose();
  };

  const handleCanvasDoubleClick = (e: React.MouseEvent) => {
    if (readOnly || isPreview) return;
    
    // Only trigger if clicking directly on the canvas background (not on draggable items)
    const target = e.target as HTMLElement;
    // Check if clicked on canvas area or its direct child container
    const isCanvasArea = target.id === 'canvas-area' || target.id === 'canvas-inner-area' || 
                        target === e.currentTarget || target.parentElement?.id === 'canvas-area';
    if (!isCanvasArea) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left + (containerRef.current?.scrollLeft || 0);
    const y = e.clientY - rect.top + (containerRef.current?.scrollTop || 0);

    const newItem: DraggableItem = {
      id: `txt_${Date.now()}`,
      type: 'text',
      content: 'Type something...',
      x,
      y,
      width: 300,
      height: 'auto',
      zIndex: Math.max(...items.map(i => i.zIndex), 0) + 1
    };

    setItems(prev => [...prev, newItem]);
  };
  
  return (
    <div 
      className="fixed inset-0 bg-[#f0ece1] z-50 overflow-hidden flex flex-col font-sans"
      style={{
         // Global paper texture
         backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.1'/%3E%3C/svg%3E")`
      }}
    >
      <Toaster position="top-center" toastOptions={{
        style: {
            background: '#faf8f3',
            border: '2px solid #1a1a1a',
            color: '#1a1a1a',
            fontFamily: 'inherit',
        },
        className: 'hand-drawn-border'
      }} />
      
      {/* SVG Filters Definition */}
      <svg className="absolute w-0 h-0 pointer-events-none">
        <defs>
            <filter id="hand-drawn-border">
                <feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves="3" stitchTiles="stitch" result="noise" />
                <feDisplacementMap in="SourceGraphic" in2="noise" scale="2" />
            </filter>
        </defs>
      </svg>

      {/* Print Styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&display=swap');
        
        /* Enforce Quicksand only inside canvas-area elements */
        #canvas-area textarea, #canvas-area input, #canvas-area .quicksand-text {
            font-family: 'Quicksand', sans-serif !important;
        }

        @media print {
          @page {
            margin: 0;
            size: landscape;
          }
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* Hide UI elements */
          aside, 
          .no-print,
          [role="status"] {
            display: none !important;
          }
          /* Ensure full canvas visibility */
          #canvas-area {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            z-index: 9999;
            background-color: #f0ece1;
            /* Force background image to show */
            background-image: inherit !important;
          }
          /* Ensure title input shows value */
          input {
            border: none;
            background: transparent;
          }
        }
      `}</style>

      {/* Header Bar */}
      <div className="absolute top-0 left-0 w-full p-6 z-[100] flex justify-between items-start pointer-events-none no-print">
        <div className="relative pointer-events-auto">
          <button 
            onClick={() => {
              if (hasUnsavedChanges) {
                setShowExitConfirm(true);
              } else {
                onClose();
              }
            }}
            className="flex items-center gap-2 text-[#6d6d6d] hover:text-[#1a1a1a] transition-colors handwritten group"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:-translate-x-1 transition-transform">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Back
          </button>
        </div>
        
        <div className="flex items-center gap-4 pointer-events-auto">
          {/* Archive Mode Controls - Save, Preview & Share (Only shown in non-readOnly mode) */}
          {!readOnly && (
            <div className="flex items-center gap-3 mr-4">
              <ShareCircleButton 
                icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>}
                label={hasUnsavedChanges ? "Save *" : "Save"}
                isActive={hasUnsavedChanges}
                onClick={handleSave}
              />
              
              <ShareCircleButton 
                icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>}
                label="Preview"
                isActive={isPreview}
                onClick={() => setIsPreview(!isPreview)}
              />
              
              <ShareCircleButton 
                icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>}
                label="Share"
                isActive={isShareMenuOpen}
                onClick={() => setIsShareMenuOpen(!isShareMenuOpen)}
              />
            </div>
          )}

          {/* Socials - Only if readOnly (Preview Mode) or has stats */}
          {(readOnly || item.stats) && (
             <div className="flex items-center gap-4 mr-4">
                 <button
                    onClick={handleLike}
                    className="flex items-center gap-2 group transition-transform hover:scale-105"
                 >
                     <div className={`w-10 h-10 rounded-full flex items-center justify-center border-[2px] border-[#1a1a1a] hand-drawn-border transition-colors ${isLiked ? 'bg-red-50 text-red-500' : 'bg-[#faf8f3] text-[#1a1a1a]'}`}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill={isLiked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                        </svg>
                     </div>
                     <span className="font-bold handwritten text-lg">{likes}</span>
                 </button>

                 <ShareCircleButton 
                    icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>}
                    label="Comments"
                    isActive={isCommentsOpen}
                    onClick={() => setIsCommentsOpen(!isCommentsOpen)}
                 />
             </div>
          )}
        </div>
      </div>
      
      {/* Comments Drawer - Right Side */}
      <AnimatePresence>
         {isCommentsOpen && (
             <motion.div
                initial={{ x: "100%", opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: "100%", opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="absolute top-[80px] right-6 bottom-6 w-96 bg-[#faf8f3] border-[2.5px] border-[#1a1a1a] z-[80] shadow-2xl flex flex-col pointer-events-auto"
                style={{
                    borderRadius: '2px',
                    filter: 'url(#hand-drawn-border)'
                }}
             >
                 {/* Tape for sticky note feel */}
                 <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-24 h-8 bg-[#fdfbf7] opacity-80 shadow-sm border border-[#1a1a1a]/10 -rotate-2"
                      style={{
                         clipPath: 'polygon(5% 0%, 95% 0%, 100% 5%, 100% 95%, 95% 100%, 5% 100%, 0% 95%, 0% 5%)',
                         maskImage: 'linear-gradient(45deg, transparent 2px, black 2px)'
                      }}
                 />

                 <div className="p-6 border-b border-[#1a1a1a]/10 flex items-center justify-between bg-[#f5f1e8]">
                     <h3 className="text-xl font-bold handwritten">Comments ({comments.length})</h3>
                     <button onClick={() => setIsCommentsOpen(false)} className="text-[#1a1a1a]/50 hover:text-[#1a1a1a]">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                     </button>
                 </div>

                 <div className="flex-1 overflow-y-auto p-6 space-y-6">
                     {comments.map(comment => (
                         <div key={comment.id} className="group">
                             <div className="flex justify-between items-baseline mb-1">
                                 <span className="font-bold handwritten text-sm">{comment.author}</span>
                                 <span className="text-xs text-[#6d6d6d] handwritten">{new Date(comment.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                             </div>
                             <p className="text-sm font-sans leading-relaxed text-[#4a4a4a] bg-white/50 p-2 rounded-sm border border-transparent group-hover:border-[#1a1a1a]/10 transition-colors">
                                 {comment.text}
                             </p>
                         </div>
                     ))}
                     {comments.length === 0 && (
                         <div className="text-center text-[#1a1a1a]/30 handwritten py-10">
                             No comments yet. Be the first!
                         </div>
                     )}
                 </div>

                 <div className="p-4 bg-[#f5f1e8] border-t border-[#1a1a1a]/10">
                     <form onSubmit={handleAddComment} className="flex gap-2">
                         <input
                             type="text"
                             value={newComment}
                             onChange={(e) => setNewComment(e.target.value)}
                             placeholder="Write a note..."
                             className="flex-1 bg-white border border-[#1a1a1a] p-2 text-sm handwritten outline-none focus:ring-2 ring-[#1a1a1a]/10 rounded-sm"
                         />
                         <button 
                             type="submit"
                             disabled={!newComment.trim()}
                             className="bg-[#1a1a1a] text-[#faf8f3] px-3 py-2 rounded-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#333] transition-colors"
                         >
                             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                         </button>
                     </form>
                 </div>
             </motion.div>
         )}
      </AnimatePresence>

      {/* Share Menu - Below Share Button (Only in Archive Mode) */}
      <AnimatePresence>
         {isShareMenuOpen && !readOnly && (
             <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className="absolute top-20 right-6 z-[90] pointer-events-auto no-print"
             >
                <div className="relative p-8">
                   {/* Menu Background Doodle */}
                   <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" preserveAspectRatio="none">
                       <path 
                           d="M2 2 L100% 0 L100% 100% L0 100% Z" 
                           fill="#faf8f3" 
                           stroke="#1a1a1a" 
                           strokeWidth="2" 
                           style={{ filter: 'url(#hand-drawn-border)' }}
                           vectorEffect="non-scaling-stroke"
                       />
                       {/* Add a second path for sketchiness */}
                       <path 
                           d="M4 4 L calc(100% - 4px) 2 L calc(100% - 2px) calc(100% - 4px) L 2 calc(100% - 2px) Z" 
                           fill="none" 
                           stroke="#1a1a1a" 
                           strokeWidth="1" 
                           opacity="0.5"
                           style={{ filter: 'url(#hand-drawn-border)' }}
                           vectorEffect="non-scaling-stroke"
                       />
                   </svg>

                   <div className="relative z-10 flex flex-col gap-4">
                      {/* Export as PDF */}
                      <button
                         onClick={() => {
                            window.print();
                            toast.success('Print dialog opened', { className: 'handwritten font-bold' });
                         }}
                         className="relative group/option flex items-center gap-3 p-3 transition-all hover:scale-105"
                      >
                         {/* Hand-drawn ellipse border */}
                         <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" viewBox="0 0 200 60" preserveAspectRatio="none">
                            <path 
                                d="M 8 30 C 8 12 50 3 100 5 C 150 7 192 12 192 30 C 192 48 150 57 100 55 C 50 53 8 48 8 30 Z"
                                fill="none" 
                                stroke="#1a1a1a" 
                                strokeWidth="2" 
                                strokeLinecap="round"
                                style={{ filter: 'url(#hand-drawn-border)' }}
                            />
                            {/* Second messy stroke for sketch effect */}
                            <path 
                                d="M 190 30 C 190 45 150 55 100 53 C 60 51 15 45 12 30"
                                fill="none" 
                                stroke="#1a1a1a" 
                                strokeWidth="1.5" 
                                opacity="0.5"
                                style={{ filter: 'url(#hand-drawn-border)' }}
                            />
                         </svg>
                         
                         <div className="relative z-10 flex items-center gap-3 w-full px-4">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                            <span className="handwritten font-bold text-sm">Export as PDF</span>
                         </div>
                      </button>

                      {/* Share Link */}
                      <button
                         onClick={() => {
                            // Feature temporarily disabled
                         }}
                         className="relative group/option flex items-center gap-3 p-3 transition-all hover:scale-105 cursor-default"
                      >
                         <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" viewBox="0 0 200 60" preserveAspectRatio="none">
                            <path 
                                d="M 192 30 C 190 12 150 5 100 3 C 50 1 8 10 8 30 C 8 50 50 58 100 56 C 150 54 194 48 192 30 Z"
                                fill="none" 
                                stroke="#1a1a1a" 
                                strokeWidth="2" 
                                strokeLinecap="round"
                                style={{ filter: 'url(#hand-drawn-border)' }}
                            />
                             {/* Extra scratchy line */}
                             <path 
                                d="M 10 30 C 12 15 50 6 100 6"
                                fill="none" 
                                stroke="#1a1a1a" 
                                strokeWidth="1.5" 
                                opacity="0.5"
                                style={{ filter: 'url(#hand-drawn-border)' }}
                            />
                         </svg>
                         
                         <div className="relative z-10 flex items-center gap-3 w-full px-4">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                            <span className="handwritten font-bold text-sm">Share Link</span>
                         </div>
                      </button>
                   </div>
                </div>
             </motion.div>
         )}
      </AnimatePresence>

      {/* Main Canvas Area - With Scroll */}
      <div 
        ref={containerRef}
        id="canvas-area"
        className={`flex-1 relative overflow-y-auto overflow-x-hidden ${isPreview || readOnly ? 'cursor-default' : 'cursor-crosshair'}`}
        style={{ height: 'calc(100vh - 80px)' }}
        onDoubleClick={(!isPreview && !readOnly) ? handleCanvasDoubleClick : undefined}
      >
        {/* 内层容器：提供足够高度触发滚动 */}
        <div id="canvas-inner-area" className="relative w-full" style={{ minHeight: `${calculatedMinHeight}px` }}>
        {/* Centered Title - Draggable */}
        <motion.div
           drag={!isPreview && !readOnly}
           dragMomentum={false}
           className={`absolute left-[10%] top-12 z-[90] w-[80%] ${isPreview || readOnly ? '' : 'cursor-move'}`}
           style={{ x: 0, y: 0 }}
        >
             <input 
               type="text" 
               readOnly={isPreview || readOnly}
               value={title}
               onChange={(e) => setTitle(e.target.value)}
               className="w-full text-center text-5xl font-bold bg-transparent outline-none handwritten text-[#1a1a1a] placeholder-[#1a1a1a]/30 quicksand-text"
               style={{ 
                   textShadow: '2px 2px 0px rgba(0,0,0,0.05)',
                   fontFamily: "'Quicksand', sans-serif" 
               }}
               onMouseDown={(e) => e.stopPropagation()}
             />
             <div className="h-1 w-[160%] mt-2 relative overflow-visible">
                 <svg className="w-full h-4 overflow-visible absolute top-0 left-0 text-[#1a1a1a]" preserveAspectRatio="none">
                     <path d="M0,2 Q100,5 200,2 T400,2 T600,2 T800,2 T1000,2 V4 H0 Z" fill="currentColor" opacity="0.1" />
                     <path d="M0,2 Q100,0 200,2 T400,2 T600,2 T800,2 T1000,2" fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" style={{ filter: 'url(#hand-drawn)' }}/>
                 </svg>
             </div>
        </motion.div>

        {items.map((item) => (
          <motion.div
            key={item.id}
            drag={!isPreview && !readOnly}
            dragMomentum={false}
            dragElastic={0}
            onDragStart={() => !isPreview && !readOnly && bringToFront(item.id)}
            onDragEnd={(e, info) => {
              if (isPreview || readOnly) return;
              setItems(prev => prev.map(i => 
                i.id === item.id 
                  ? { ...i, x: i.x + info.offset.x, y: i.y + info.offset.y }
                  : i
              ));
            }}
            style={{ 
                position: 'absolute', 
                zIndex: item.zIndex,
                x: item.x,
                y: item.y
            }}
            className="group"
          >
            <Resizable
               size={{ 
                   width: item.width, 
                   height: item.type === 'text' ? 'auto' : item.height // Text height is auto-controlled by content
               }}
               onResizeStop={(e, direction, ref, d) => handleResizeStop(item.id, ref, d)}
               enable={
                 (!isPreview && !readOnly) ? (
                   item.type === 'text' 
                     ? { right: true, left: true } // Text only resizes width
                     : { top: true, right: true, bottom: true, left: true, topRight: true, bottomRight: true, bottomLeft: true, topLeft: true }
                 ) : false
               }
               handleStyles={{
                  right: { cursor: 'ew-resize' },
                  bottomRight: { cursor: 'nwse-resize' }
               }}
               handleClasses={{
                  right: `opacity-0 ${!isPreview && !readOnly ? 'group-hover:opacity-100' : ''} bg-[#1a1a1a]/20 w-2 h-full absolute right-0 top-0 transition-opacity rounded-full`,
                  bottomRight: `opacity-0 ${!isPreview && !readOnly ? 'group-hover:opacity-100' : ''} bg-[#1a1a1a] w-4 h-4 rounded-full absolute -right-2 -bottom-2 z-10 transition-opacity border-2 border-[#f0ece1]`
               }}
            >
                {item.type === 'image' ? (
                  <div className={`relative p-1 bg-white shadow-lg rotate-1 ${!isPreview && !readOnly ? 'group-hover:shadow-xl' : ''} transition-shadow select-none`}>
                    {/* Sketchy Border Container */}
                    <div 
                        className="absolute inset-0 border-[3px] border-[#1a1a1a] pointer-events-none"
                        style={{
                            borderRadius: '255px 15px 225px 15px / 15px 225px 15px 255px',
                            filter: 'url(#hand-drawn-border)'
                        }}
                    ></div>
                    
                    {/* Image Content */}
                    <div className="w-full h-full p-2 overflow-hidden" style={{ borderRadius: '2px' }}>
                        <img 
                            src={item.content} 
                            alt="Content" 
                            className="w-full h-full object-cover pointer-events-none grayscale-[0.2] contrast-[1.1]" 
                            draggable={false}
                        />
                    </div>

                    {/* Tape effect */}
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-32 h-10 bg-[#fdfbf7] opacity-90 rotate-2 shadow-sm border border-[#1a1a1a]/10"
                         style={{
                            clipPath: 'polygon(5% 0%, 95% 0%, 100% 5%, 100% 95%, 95% 100%, 5% 100%, 0% 95%, 0% 5%)',
                            maskImage: 'linear-gradient(45deg, transparent 5px, black 5px)'
                         }}
                    ></div>
                  </div>
                ) : item.type === 'mindmap' ? (
                  <div className={`relative p-4 bg-white shadow-lg ${!isPreview && !readOnly ? 'group-hover:shadow-xl' : ''} transition-shadow select-none`}>
                    <div 
                      className="absolute inset-0 border-[3px] border-[#1a1a1a] pointer-events-none"
                      style={{
                        borderRadius: '255px 15px 225px 15px / 15px 225px 15px 255px',
                        filter: 'url(#hand-drawn-border)'
                      }}
                    ></div>
                    <div className="relative z-10">
                      <div className="bg-white rounded-lg p-3 min-h-[200px] overflow-x-auto">
                        <MermaidMindmap
                          mermaidCode={item.content || 'mindmap\n  root((Empty))'}
                          id={item.id}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="relative group/text pt-2 pb-2">
                     {/* Drag Handle for Text (visible on hover) */}
                     {!isPreview && !readOnly && (
                       <div className="absolute -top-6 left-0 px-2 py-1 bg-[#1a1a1a] text-[#f0ece1] text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-move pointer-events-none handwritten font-bold tracking-widest uppercase">
                          Drag
                       </div>
                     )}
                     
                     {/* AutoResizingTextarea passed readOnly prop */}
                     <AutoResizingTextarea 
                       item={item} 
                       readOnly={isPreview || readOnly}
                       onChange={(val) => {
                         const newItems = [...items];
                         const idx = newItems.findIndex(i => i.id === item.id);
                         newItems[idx].content = val;
                         setItems(newItems);
                       }} 
                     />
                  </div>
                )}
            </Resizable>
          </motion.div>
        ))}
        
        {!isPreview && !readOnly && (
            <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 text-[#1a1a1a]/30 text-lg pointer-events-none handwritten tracking-wide transition-opacity z-[80]`}>
                ( Double click empty space to add text )
            </div>
        )}
        </div>
      </div>
      {/* Exit Confirmation Menu - Below Back Button */}
      <AnimatePresence>
        {showExitConfirm && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="absolute top-20 left-6 z-[90] pointer-events-auto no-print max-w-[4rem]"
          >
            <div className="relative p-4">
              {/* Menu Background */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" preserveAspectRatio="none">
                <path 
                  d="M2 2 L100% 0 L100% 100% L0 100% Z" 
                  fill="#faf8f3" 
                  stroke="#1a1a1a" 
                  strokeWidth="2" 
                  style={{ filter: 'url(#hand-drawn-border)' }}
                  vectorEffect="non-scaling-stroke"
                />
                <path 
                  d="M4 4 L calc(100% - 4px) 2 L calc(100% - 2px) calc(100% - 4px) L 2 calc(100% - 2px) Z" 
                  fill="none" 
                  stroke="#1a1a1a" 
                  strokeWidth="1" 
                  opacity="0.5"
                  style={{ filter: 'url(#hand-drawn-border)' }}
                  vectorEffect="non-scaling-stroke"
                />
              </svg>

              <div className="relative z-10 flex flex-col gap-2">
                <p className="text-sm text-[#4a4a4a] mb-2 handwritten">
                  You have unsaved changes. Do you want to save them before leaving?
                </p>

                {/* Save and Exit */}
                <button
                  onClick={handleSaveAndExit}
                  className="relative group/option flex items-center gap-2 p-2 transition-all hover:scale-105"
                >
                  <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" viewBox="0 0 70 45" preserveAspectRatio="none">
                    <path 
                      d="M 2.5 25 C 2.5 10 12.5 3 35 5 C 57.5 7 67.5 10 67.5 25 C 67.5 40 57.5 47 35 45 C 12.5 43 2.5 40 2.5 25 Z"
                      fill="#1a1a1a" 
                      stroke="#1a1a1a" 
                      strokeWidth="2" 
                      strokeLinecap="round"
                      style={{ filter: 'url(#hand-drawn-border)' }}
                    />
                  </svg>
                  <span className="relative z-10 handwritten font-bold text-sm text-[#faf8f3] w-full text-center">Save and Exit</span>
                </button>

                {/* Exit Without Saving */}
                <button
                  onClick={handleExitWithoutSaving}
                  className="relative group/option flex items-center gap-2 p-2 transition-all hover:scale-105"
                >
                  <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" viewBox="0 0 70 45" preserveAspectRatio="none">
                    <path 
                      d="M 67.5 25 C 66.5 10 57.5 5 35 3 C 12.5 1 2.5 8 2.5 25 C 2.5 42 12.5 48 35 46 C 57.5 44 68.5 40 67.5 25 Z"
                      fill="none" 
                      stroke="#1a1a1a" 
                      strokeWidth="2" 
                      strokeLinecap="round"
                      style={{ filter: 'url(#hand-drawn-border)' }}
                    />
                  </svg>
                  <span className="relative z-10 handwritten font-bold text-sm text-[#1a1a1a] w-full text-center">Exit Without Saving</span>
                </button>

                {/* Cancel */}
                <button
                  onClick={() => setShowExitConfirm(false)}
                  className="text-[#6d6d6d] hover:text-[#1a1a1a] handwritten text-sm text-center py-2 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>    </div>
  );
};
