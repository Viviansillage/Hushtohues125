import { useState } from 'react';
import { ChatPage } from './components/ChatPage';
import { HistoryPage, ChatHistory } from './components/HistoryPage';
import { CommunityPage, Post } from './components/CommunityPage';
import { CommunityDetailPage } from './components/CommunityDetailPage';
import { ProfilePage } from './components/ProfilePage';
import { motion, AnimatePresence } from 'motion/react';
import { LandingPage } from './components/LandingPage';

const initialHistory: ChatHistory[] = [
  {
    id: '1',
    title: 'Creative Writing Ideas',
    messageCount: 24,
    lastMessage: 'Can you help me brainstorm story concepts?',
    timestamp: new Date('2026-01-24T10:30:00'),
    previewImages: [
      'https://images.unsplash.com/photo-1760561993754-8dcdb1a39487?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxub3RlYm9vayUyMHdyaXRpbmclMjBza2V0Y2h8ZW58MXx8fHwxNzY5MzA1NzMyfDA&ixlib=rb-4.1.0&q=80&w=1080',
      'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
      'https://images.unsplash.com/photo-1455390582262-044cdead277a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400'
    ],
    isPublic: true,
    tags: ['writing', 'creativity', 'storytelling']
  },
  {
    id: '2',
    title: 'Project Planning',
    messageCount: 18,
    lastMessage: 'What are the key milestones for a product launch?',
    timestamp: new Date('2026-01-23T15:45:00'),
    previewImages: [
      'https://images.unsplash.com/photo-1571456610111-72c649ad3521?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwbGFubmluZyUyMHdoaXRlYm9hcmQlMjBza2V0Y2h8ZW58MXx8fHwxNzY5MzA1NzMyfDA&ixlib=rb-4.1.0&q=80&w=1080',
      'https://images.unsplash.com/photo-1531403009284-440f080d1e12?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400'
    ],
    isPublic: false,
    tags: ['planning', 'product', 'strategy', 'launch']
  },
  {
    id: '3',
    title: 'Recipe Suggestions',
    messageCount: 12,
    lastMessage: 'I need healthy breakfast ideas',
    timestamp: new Date('2026-01-22T09:20:00'),
    previewImages: [
      'https://images.unsplash.com/photo-1550497507-634bd6d81ecd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoZWFsdGh5JTIwZm9vZCUyMHNrZXRjaHxlbnwxfHx8fDE3NjkzMDU3MzJ8MA&ixlib=rb-4.1.0&q=80&w=1080',
      'https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400'
    ],
    isPublic: false,
    tags: ['food', 'health', 'cooking']
  },
  {
    id: '4',
    title: 'Learning Python',
    messageCount: 31,
    lastMessage: 'Explain list comprehensions',
    timestamp: new Date('2026-01-21T14:10:00'),
    previewImages: [
      'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb21wdXRlciUyMGNvZGUlMjBzY3JlZW58ZW58MXx8fHwxNzY5MjUxNDg2fDA&ixlib=rb-4.1.0&q=80&w=1080',
      'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400'
    ],
    isPublic: true,
    tags: ['python', 'coding', 'learning', 'basics']
  },
  {
    id: '5',
    title: 'Travel Recommendations',
    messageCount: 15,
    lastMessage: 'Best places to visit in Japan?',
    timestamp: new Date('2026-01-20T11:00:00'),
    previewImages: [
      'https://images.unsplash.com/photo-1645609736206-787ead0e0545?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxqYXBhbiUyMGt5b3RvJTIwc3RyZWV0fGVufDF8fHx8MTc2OTMwNTczMnww&ixlib=rb-4.1.0&q=80&w=1080'
    ],
    isPublic: false,
    tags: ['travel', 'japan', 'guide']
  },
  {
    id: '6',
    title: 'Design Feedback',
    messageCount: 8,
    lastMessage: 'Thoughts on this UI mockup?',
    timestamp: new Date('2026-01-19T16:30:00'),
    previewImages: [
      'https://images.unsplash.com/photo-1547027072-332f09bd6bb3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx1aSUyMGRlc2lnbiUyMG1vY2t1cCUyMHNrZXRjaHxlbnwxfHx8fDE3NjkzMDU3MzJ8MA&ixlib=rb-4.1.0&q=80&w=1080'
    ],
    isPublic: true,
    tags: ['design', 'ui', 'feedback']
  },
];

const initialCommunityPosts: Post[] = [
  {
    id: 'c3',
    title: 'Machine Learning Roadmap',
    author: {
      name: 'Emma Rodriguez',
    },
    imageUrl: 'https://images.unsplash.com/photo-1724264601953-d1018680f321?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoYW5kJTIwZHJhd24lMjBtaW5kJTIwbWFwJTIwc2tldGNoJTIwZGlhZ3JhbXxlbnwxfHx8fDE3NjkzMTcxMDZ8MA&ixlib=rb-4.1.0&q=80&w=1080',
    content: 'Mapped out the key concepts I need to study for my ML journey. The connections are finally making sense!',
    likes: 89,
    comments: 15,
    timestamp: new Date('2026-01-23T11:20:00'),
    tags: ['learning', 'education', 'ML'],
  },
  {
    id: 'c5',
    title: 'Product Brainstorming',
    author: {
      name: 'Lisa Park',
    },
    imageUrl: 'https://images.unsplash.com/photo-1760561993754-8dcdb1a39487?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjcmVhdGl2ZSUyMHNrZXRjaGJvb2slMjBub3RlcyUyMHdyaXRpbmd8ZW58MXx8fHwxNzY5MzE3MTA2fDA&ixlib=rb-4.1.0&q=80&w=1080',
    content: 'Using AI to generate prompts for our team brainstorming session. This layout helped organize our chaotic ideas.',
    likes: 73,
    comments: 11,
    timestamp: new Date('2026-01-22T10:00:00'),
    tags: ['brainstorming', 'work', 'creativity'],
  },
  {
    id: 'c6',
    title: 'Archive Sketches',
    author: {
      name: 'David Wilson',
    },
    imageUrl: 'https://images.unsplash.com/photo-1614558097757-bf9aa8fb830e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsYW5kc2NhcGUlMjBza2V0Y2glMjBwZW5jaWwlMjBkcmF3aW5nfGVufDF8fHx8MTc2OTMxNzEwNnww&ixlib=rb-4.1.0&q=80&w=1080',
    content: 'Found these old landscape studies in my archive thanks to the new auto-tagging feature.',
    likes: 124,
    comments: 23,
    timestamp: new Date('2026-01-25T08:00:00'),
    tags: ['features', 'organization', 'landscape'],
  },
  {
    id: 'c7',
    title: 'Novel Mood Board',
    author: {
      name: 'Sophie Turner',
    },
    imageUrl: 'https://images.unsplash.com/photo-1739476479431-d9ead70f3923?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMG1vb2Rib2FyZCUyMGFydGlzdGljJTIwY29sbGFnZXxlbnwxfHx8fDE3NjkzMTcxMDZ8MA&ixlib=rb-4.1.0&q=80&w=1080',
    content: 'Visualizing the atmosphere for chapter 4. The color palette is really coming together.',
    likes: 45,
    comments: 6,
    timestamp: new Date('2026-01-24T14:20:00'),
    tags: ['art', 'writing', 'inspiration'],
  }
];

export default function App() {
  const [currentPage, setCurrentPage] = useState<'chat' | 'history' | 'community' | 'profile' | 'community-detail'>('chat');
  const [viewingCommunity, setViewingCommunity] = useState<string | null>(null);
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [showLanding, setShowLanding] = useState(true);
  
  // Lifted state
  const [history, setHistory] = useState<ChatHistory[]>(initialHistory);
  const [communityPosts, setCommunityPosts] = useState<Post[]>(initialCommunityPosts);
  
  // User profile state
  const [userName, setUserName] = useState('Alex Morgan');
  const [userHandle, setUserHandle] = useState('@alexmorgan');

  const handleNavigateToCommunity = (communityName: string) => {
    setViewingCommunity(communityName);
    setCurrentPage('community-detail');
  };

  // Derive discover posts from history (public only) and community posts
  const publicHistoryPosts: Post[] = history
    .filter(item => item.isPublic)
    .map(item => ({
      id: item.id,
      title: item.title,
      author: { name: 'You' }, // In a real app this would be the current user
      imageUrl: item.previewImages[0] || 'https://via.placeholder.com/800x450',
      content: item.lastMessage,
      likes: 0,
      comments: 0,
      timestamp: item.timestamp,
      tags: item.tags
    }));

  const allDiscoverPosts = [...communityPosts, ...publicHistoryPosts].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return (
    <>
      <AnimatePresence>
        {showLanding && (
          <LandingPage onEnter={() => setShowLanding(false)} />
        )}
      </AnimatePresence>

      {/* SVG Filters for hand-drawn effect */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
          <filter id="hand-drawn">
            <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="3" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="2" />
          </filter>
        </defs>
      </svg>

      <div className="min-h-screen bg-[#f5f1e8] flex relative" style={{ zIndex: 2 }}>
        {/* Sidebar Trigger Area */}
        <div 
          className="fixed left-0 top-0 w-12 h-full z-40"
          onMouseEnter={() => setIsSidebarVisible(true)}
        />

        {/* Sidebar Navigation */}
        <aside 
          className={`fixed left-0 top-0 h-full w-64 bg-[#faf8f3] border-r-3 border-[#1a1a1a] p-6 flex flex-col hand-drawn-border transition-transform duration-300 ease-in-out z-50 ${
            isSidebarVisible ? 'translate-x-0' : '-translate-x-full'
          }`}
          onMouseLeave={() => setIsSidebarVisible(false)}
        >
          <div className="mb-8 pt-4 relative group cursor-default">
            <h1 
              className="flex items-baseline justify-center gap-[1px] select-none text-[#1a1a1a]/60 flex-wrap relative z-10"
              style={{ filter: 'url(#hand-drawn)' }}
            >
              {/* Hush */}
              <span className="text-3xl font-black handwritten -rotate-2 translate-y-0.5">H</span>
              <span className="text-3xl font-black handwritten rotate-1 -translate-y-0.5">u</span>
              <span className="text-3xl font-black handwritten -rotate-1 translate-y-1">s</span>
              <span className="text-3xl font-black handwritten rotate-2">h</span>
              
              <span className="w-2"></span>

              {/* to */}
              <span className="text-xl font-black handwritten -rotate-3 translate-y-0.5">t</span>
              <span className="text-xl font-black handwritten rotate-3 -translate-y-1">o</span>

              <span className="w-2"></span>

              {/* Hues */}
              <span className="text-3xl font-black handwritten rotate-1 translate-y-1">H</span>
              <span className="text-3xl font-black handwritten -rotate-2 -translate-y-0.5">u</span>
              <span className="text-3xl font-black handwritten rotate-1 translate-y-0.5">e</span>
              <span className="text-3xl font-black handwritten -rotate-1">s</span>
            </h1>
            
            {/* Dynamic Smile Effect */}
            <svg 
              className="absolute left-1/2 -translate-x-1/2 -bottom-6 w-32 h-8 pointer-events-none text-[#1a1a1a]/40"
              viewBox="0 0 100 20"
              style={{ filter: 'url(#hand-drawn)' }}
            >
              <motion.path
                d="M 10 5 Q 50 25 90 5"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 1.5, ease: "easeInOut", repeat: Infinity, repeatType: "reverse", repeatDelay: 1 }}
              />
            </svg>
          </div>
          
          <nav className="flex-1 space-y-3">
            <button
              onClick={() => setCurrentPage('chat')}
              className={`w-full flex items-center gap-3 px-4 py-3 transition-all sketch-btn hand-drawn-border group ${
                currentPage === 'chat' 
                  ? 'bg-[#e8e4d9]' 
                  : 'bg-transparent hover:bg-[#f0ece1]'
              }`}
            >
              <div className="w-5 h-5 flex items-center justify-center">
                 <svg viewBox="0 0 24 24" className="w-full h-full text-[#1a1a1a]" style={{ filter: 'url(#hand-drawn)' }}>
                    <path 
                      d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    />
                 </svg>
              </div>
              <span className="font-bold handwritten text-[#1a1a1a]">Chat</span>
            </button>
            
            <button
              onClick={() => setCurrentPage('history')}
              className={`w-full flex items-center gap-3 px-4 py-3 transition-all sketch-btn hand-drawn-border group ${
                currentPage === 'history' 
                  ? 'bg-[#e8e4d9]' 
                  : 'bg-transparent hover:bg-[#f0ece1]'
              }`}
            >
              <div className="w-5 h-5 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-full h-full text-[#1a1a1a]" style={{ filter: 'url(#hand-drawn)' }}>
                  <path 
                    d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  />
                  <path 
                    d="M14 2v6h6" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  />
                  <path 
                    d="M16 13H8" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  />
                  <path 
                    d="M16 17H8" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  />
                  <path 
                    d="M10 9H8" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <span className="font-bold handwritten text-[#1a1a1a]">Archive</span>
            </button>
            
            <button
              onClick={() => setCurrentPage('community')}
              className={`w-full flex items-center gap-3 px-4 py-3 transition-all sketch-btn hand-drawn-border group ${
                currentPage === 'community' 
                  ? 'bg-[#e8e4d9]' 
                  : 'bg-transparent hover:bg-[#f0ece1]'
              }`}
            >
              <div className="w-5 h-5 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-full h-full text-[#1a1a1a]" style={{ filter: 'url(#hand-drawn)' }}>
                  {/* Person 1 (Center) */}
                  <circle cx="12" cy="7" r="2.5" fill="none" stroke="currentColor" strokeWidth="2" />
                  <path d="M7 21v-2a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4v2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  {/* Person 2 (Left) */}
                  <circle cx="5" cy="10" r="2" fill="none" stroke="currentColor" strokeWidth="2" />
                  <path d="M1 21v-1a3 3 0 0 1 3-3h1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  {/* Person 3 (Right) */}
                  <circle cx="19" cy="10" r="2" fill="none" stroke="currentColor" strokeWidth="2" />
                  <path d="M19 17h1a3 3 0 0 1 3 3v1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <span className="font-bold handwritten text-[#1a1a1a]">Community</span>
            </button>
            
            <button
              onClick={() => setCurrentPage('profile')}
              className={`w-full flex items-center gap-3 px-4 py-3 transition-all sketch-btn hand-drawn-border group ${
                currentPage === 'profile' 
                  ? 'bg-[#e8e4d9]' 
                  : 'bg-transparent hover:bg-[#f0ece1]'
              }`}
            >
              <div className="w-5 h-5 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-full h-full text-[#1a1a1a]" style={{ filter: 'url(#hand-drawn)' }}>
                   <circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
                   <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <span className="font-bold handwritten text-[#1a1a1a]">Profile</span>
            </button>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto relative">
          {currentPage === 'chat' && <ChatPage />}
          {currentPage === 'history' && (
            <HistoryPage 
              onNavigateToCommunity={handleNavigateToCommunity} 
              history={history}
              onUpdateHistory={setHistory}
            />
          )}
          {currentPage === 'community' && (
            <CommunityPage 
              onNavigateToCommunity={handleNavigateToCommunity} 
              posts={allDiscoverPosts}
            />
          )}
          {currentPage === 'community-detail' && viewingCommunity && (
            <CommunityDetailPage 
              communityName={viewingCommunity} 
              onBack={() => setCurrentPage('community')} 
            />
          )}
          {currentPage === 'profile' && <ProfilePage userName={userName} userHandle={userHandle} onUpdateUserName={setUserName} onUpdateUserHandle={setUserHandle} />}
        </main>
      </div>
    </>
  );
}