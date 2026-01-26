import { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { toast, Toaster } from 'sonner@2.0.3';

interface HeatmapDay {
  date: Date;
  count: number; // 0-4 intensity
  isPadding?: boolean;
}

interface TopicBubble {
  id: string;
  label: string;
  value: number; // determines size
  color: string;
}

interface ProfilePageProps {
  userName: string;
  userHandle: string;
  onUpdateUserName: (name: string) => void;
  onUpdateUserHandle: (handle: string) => void;
}

export function ProfilePage({ userName, userHandle, onUpdateUserName, onUpdateUserHandle }: ProfilePageProps) {
  const [avatar, setAvatar] = useState<string>("https://images.unsplash.com/photo-1534528741775-53994a69daeb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwZW9wbGUlMjBwb3J0cmFpdHxlbnwxfHx8fDE3NjkzMTcxMDZ8MA&ixlib=rb-4.1.0&q=80&w=400");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Editing states
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempUserName, setTempUserName] = useState(userName);
  const [tempUserHandle, setTempUserHandle] = useState(userHandle);
  const nameInputRef = useRef<HTMLInputElement>(null);
  
  // Focus input when editing starts
  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [isEditingName]);
  
  const handleSaveName = () => {
    if (tempUserName.trim()) {
      onUpdateUserName(tempUserName);
      // Auto-update handle if it matches the old format
      const newHandle = '@' + tempUserName.toLowerCase().replace(/\s+/g, '');
      setTempUserHandle(newHandle);
      onUpdateUserHandle(newHandle);
      setIsEditingName(false);
      toast.success("Profile updated!", { className: "handwritten font-bold" });
    }
  };
  
  const handleCancelEdit = () => {
    setTempUserName(userName);
    setTempUserHandle(userHandle);
    setIsEditingName(false);
  };

  const stats = [
    { label: 'Chats', value: '127' },
    { label: 'Likes', value: '342' },
    { label: 'Bookmarks', value: '58' },
  ];

  // Generate Heatmap Data (Calendar View for current month window)
  const heatmapData: HeatmapDay[] = (() => {
    const days: HeatmapDay[] = [];
    const today = new Date();
    // Show roughly last 4 weeks (28 days) plus padding to align with weeks
    // Let's just show the last 30 days, properly aligned
    
    const endDate = today;
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 29); // 30 days range

    // Find the day of the week for the start date (0 = Sunday, 1 = Monday, etc.)
    // We want Monday to be first
    let startDayOfWeek = startDate.getDay(); 
    // Convert to Monday=0, Sunday=6
    startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

    // Add padding days
    for (let i = 0; i < startDayOfWeek; i++) {
        days.push({ date: new Date(), count: 0, isPadding: true });
    }

    // Add actual days
    for (let i = 0; i < 30; i++) {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + i);
        days.push({
            date: d,
            count: Math.floor(Math.random() * 5),
            isPadding: false
        });
    }
    
    return days;
  })();

  const weekDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  // Bubble Data
  const bubbles: TopicBubble[] = [
    { id: '1', label: 'Design', value: 90, color: '#e6dfd1' }, 
    { id: '2', label: 'Python', value: 70, color: '#d4cdb8' },
    { id: '3', label: 'Writing', value: 60, color: '#f0ece1' },
    { id: '4', label: 'AI', value: 100, color: '#1a1a1a' },
    { id: '5', label: 'Productivity', value: 50, color: '#e8e4d9' },
    { id: '6', label: 'React', value: 55, color: '#dcd6c8' },
    { id: '7', label: 'Art', value: 45, color: '#e0dacb' },
  ];

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatar(reader.result as string);
        toast.success("Profile picture updated!", { className: "handwritten font-bold" });
      };
      reader.readAsDataURL(file);
    }
  };

  const getHeatmapColor = (count: number) => {
    if (count === 0) return 'bg-[#e8e4d9]'; // Empty/Low
    if (count === 1) return 'bg-[#d4cdb8]';
    if (count === 2) return 'bg-[#b0a890]';
    if (count === 3) return 'bg-[#8c8470]';
    return 'bg-[#1a1a1a]'; // Max intensity
  };

  return (
    <div className="h-screen overflow-y-auto bg-[#f5f1e8]">
      <div className="max-w-4xl mx-auto px-8 py-8">
        <Toaster position="top-center" toastOptions={{
            style: {
                background: '#faf8f3',
                border: '2px solid #1a1a1a',
                color: '#1a1a1a',
                fontFamily: 'inherit',
            },
            className: 'hand-drawn-border'
        }} />

        {/* Profile Header */}
        <div className="flex flex-col items-center mb-10">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="image/*" 
            className="hidden" 
          />
          
          <div className="relative group cursor-pointer" onClick={handleAvatarClick}>
             {/* Hand-drawn circle border effect */}
             <div className="absolute -inset-2 border-[2px] border-[#1a1a1a] rounded-full animate-pulse opacity-50" style={{ filter: 'url(#hand-drawn)' }}></div>
             
             <div className="w-28 h-28 rounded-full overflow-hidden border-[3px] border-[#1a1a1a] relative z-10 bg-[#e8e4d9]">
                <img src={avatar} alt="Profile" className="w-full h-full object-cover" />
                
                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#faf8f3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="17 8 12 3 7 8"></polyline>
                        <line x1="12" y1="3" x2="12" y2="15"></line>
                    </svg>
                </div>
             </div>
          </div>

          <div className="text-center mt-4">
             {!isEditingName ? (
               <>
                 <div className="flex items-center justify-center gap-2 group">
                   <h1 className="text-3xl font-bold handwritten mb-1">{userName}</h1>
                   <button
                     onClick={() => setIsEditingName(true)}
                     className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-[#e8e4d9] rounded hand-drawn-border"
                     aria-label="Edit name"
                   >
                     {/* Hand-drawn edit icon */}
                     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'url(#hand-drawn)' }}>
                       <path d="M12 20h9" />
                       <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                     </svg>
                   </button>
                 </div>
                 <p className="text-[#6d6d6d] font-medium handwritten text-lg">{userHandle}</p>
               </>
             ) : (
               <div className="flex flex-col items-center gap-3">
                 <input
                   ref={nameInputRef}
                   type="text"
                   value={tempUserName}
                   onChange={(e) => setTempUserName(e.target.value)}
                   onKeyDown={(e) => {
                     if (e.key === 'Enter') handleSaveName();
                     if (e.key === 'Escape') handleCancelEdit();
                   }}
                   className="text-3xl font-bold handwritten text-center bg-[#faf8f3] border-[2.5px] border-[#1a1a1a] px-4 py-2 hand-drawn-border focus:outline-none focus:bg-[#f0ece1]"
                   placeholder="Enter name"
                 />
                 <div className="flex gap-2">
                   {/* Save button - hand-drawn check */}
                   <button
                     onClick={handleSaveName}
                     className="p-2 bg-[#1a1a1a] hover:bg-[#2a2a2a] transition-colors hand-drawn-border group"
                     aria-label="Save"
                   >
                     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#faf8f3" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'url(#hand-drawn)' }}>
                       <path d="M20 6L9 17l-5-5" />
                     </svg>
                   </button>
                   {/* Cancel button - hand-drawn X */}
                   <button
                     onClick={handleCancelEdit}
                     className="p-2 bg-[#faf8f3] border-[2.5px] border-[#1a1a1a] hover:bg-[#e8e4d9] transition-colors hand-drawn-border"
                     aria-label="Cancel"
                   >
                     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'url(#hand-drawn)' }}>
                       <path d="M18 6L6 18M6 6l12 12" />
                     </svg>
                   </button>
                 </div>
               </div>
             )}
          </div>
        </div>

        {/* Visualization Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            {/* Heatmap */}
            <div className="bg-[#faf8f3] border-[2.5px] border-[#1a1a1a] p-6 hand-drawn-border wireframe-shadow flex flex-col">
                <h3 className="text-xl font-bold handwritten mb-6 flex items-center gap-2">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    Activity (Last 30 Days)
                </h3>
                
                <div className="flex-1 flex flex-col justify-center items-center">
                    {/* Calendar Grid */}
                    <div className="grid grid-cols-7 gap-2">
                        {/* Weekday Headers */}
                        {weekDays.map((day, i) => (
                            <div key={`header-${i}`} className="w-8 h-6 flex items-center justify-center text-xs font-bold text-[#6d6d6d] handwritten">
                                {day}
                            </div>
                        ))}
                        
                        {/* Days */}
                        {heatmapData.map((day, i) => (
                            <div 
                                key={i}
                                className={`w-8 h-8 rounded-sm border border-[#1a1a1a]/10 flex items-center justify-center text-[10px] 
                                    ${day.isPadding ? 'invisible' : `${getHeatmapColor(day.count)} cursor-help hover:border-[#1a1a1a] transition-colors group relative`}`}
                            >
                                {!day.isPadding && (
                                    <>
                                        {/* Tooltip */}
                                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[#1a1a1a] text-[#faf8f3] text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap handwritten pointer-events-none z-10">
                                            {day.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Bubble Chart */}
            <div className="bg-[#faf8f3] border-[2.5px] border-[#1a1a1a] p-6 hand-drawn-border wireframe-shadow flex flex-col">
                <h3 className="text-xl font-bold handwritten mb-4 flex items-center gap-2">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                    Top Interests
                </h3>
                
                <div className="flex-1 flex flex-wrap justify-center items-center content-center gap-4 min-h-[250px] p-4">
                    {bubbles.map((bubble, i) => (
                        <motion.div
                            key={bubble.id}
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ 
                                scale: 1,
                                opacity: 1,
                                y: [0, -5, 0],
                            }}
                            transition={{ 
                                scale: { duration: 0.5 },
                                opacity: { duration: 0.5 },
                                y: { 
                                    duration: 3 + Math.random() * 2, // Random duration between 3-5s
                                    repeat: Infinity, 
                                    ease: "easeInOut",
                                    delay: Math.random() * 2 // Random start delay
                                }
                            }}
                            className="rounded-full flex items-center justify-center border-2 border-[#1a1a1a] shadow-sm hover:shadow-md hover:scale-105 transition-all cursor-default overflow-hidden"
                            style={{
                                width: bubble.value * 1.2,
                                height: bubble.value * 1.2,
                                backgroundColor: bubble.color,
                                color: bubble.color === '#1a1a1a' ? '#faf8f3' : '#1a1a1a',
                            }}
                        >
                            <span className="font-bold handwritten text-[12px] select-none text-center break-words px-1 leading-tight w-full max-w-[85%]">{bubble.label}</span>
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="bg-[#faf8f3] border-[2.5px] border-[#1a1a1a] p-6 text-center hand-drawn-border wireframe-shadow group hover:-translate-y-1 transition-transform"
            >
              <div className="w-12 h-12 border-[2.5px] border-[#1a1a1a] mx-auto mb-3 flex items-center justify-center hand-drawn-border group-hover:bg-[#1a1a1a] group-hover:text-[#faf8f3] transition-colors">
                 {stat.label === 'Chats' && <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>}
                 {stat.label === 'Likes' && <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>}
                 {stat.label === 'Bookmarks' && <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2-2z"></path></svg>}
              </div>
              <p className="text-3xl mb-1 handwritten font-bold">{stat.value}</p>
              <p className="text-sm text-[#6d6d6d] uppercase tracking-wider font-bold">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Preferences (Kept as requested) */}
        <div className="bg-[#faf8f3] border-[2.5px] border-[#1a1a1a] p-6 hand-drawn-border wireframe-shadow">
          <h2 className="text-xl mb-4 handwritten sketchy-line font-bold flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            Preferences
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-[#d4cdb8]">
              <div>
                <p className="font-bold handwritten">Email notifications</p>
                <p className="text-sm text-[#6d6d6d]">Get notified about community activity</p>
              </div>
              <label className="relative inline-block w-12 h-6 cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-full h-full border-[2.5px] border-[#1a1a1a] bg-[#faf8f3] peer-checked:bg-[#1a1a1a] transition-colors hand-drawn-border"></div>
                <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-[#1a1a1a] peer-checked:bg-[#faf8f3] transition-all peer-checked:translate-x-6 border-[1.5px] border-[#1a1a1a]"></div>
              </label>
            </div>

            <div className="flex items-center justify-between py-3 border-b border-[#d4cdb8]">
              <div>
                <p className="font-bold handwritten">Save chat history</p>
                <p className="text-sm text-[#6d6d6d]">Automatically save all conversations</p>
              </div>
              <label className="relative inline-block w-12 h-6 cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-full h-full border-[2.5px] border-[#1a1a1a] bg-[#faf8f3] peer-checked:bg-[#1a1a1a] transition-colors hand-drawn-border"></div>
                <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-[#1a1a1a] peer-checked:bg-[#faf8f3] transition-all peer-checked:translate-x-6 border-[1.5px] border-[#1a1a1a]"></div>
              </label>
            </div>

            <div className="flex items-center justify-between py-3">
              <div>
                <p className="font-bold handwritten">Public profile</p>
                <p className="text-sm text-[#6d6d6d]">Show your profile in community</p>
              </div>
              <label className="relative inline-block w-12 h-6 cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-full h-full border-[2.5px] border-[#1a1a1a] bg-[#faf8f3] peer-checked:bg-[#1a1a1a] transition-colors hand-drawn-border"></div>
                <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-[#1a1a1a] peer-checked:bg-[#faf8f3] transition-all peer-checked:translate-x-6 border-[1.5px] border-[#1a1a1a]"></div>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}