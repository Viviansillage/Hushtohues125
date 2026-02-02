import { useEffect, useMemo, useState } from 'react';
import { ChatPage } from './components/ChatPage';
import { HistoryPage, ChatHistory } from './components/HistoryPage';
import { ChatHistoryPage, ChatSession } from './components/ChatHistoryPage';
import { CommunityPage, Post, CommunityTag } from './components/CommunityPage';
import { CommunityDetailPage } from './components/CommunityDetailPage';
import { ProfilePage } from './components/ProfilePage';
import { motion, AnimatePresence } from 'motion/react';
import { LandingPage } from './components/LandingPage';
import { useChatStore } from './lib/chatStore';
import {
  ApiCommunityPost,
  ApiHistoryItem,
  ApiProfile,
  followCommunity,
  getChatSessions,
  getCommunityMeta,
  getDiscoverFeed,
  getHistory,
  getProfile,
  toggleCommunityBookmark,
  toggleCommunityLike,
  unfollowCommunity,
  updateHistoryItem,
  updateProfile
} from './lib/api';

const mapHistory = (item: ApiHistoryItem): ChatHistory => ({
  ...item,
  timestamp: new Date(item.timestamp)
});

const mapPost = (post: ApiCommunityPost): Post => ({
  ...post,
  timestamp: new Date(post.timestamp)
});

export default function App() {
  const [currentPage, setCurrentPage] = useState<
    'chat' | 'archive' | 'chat-history' | 'community' | 'profile' | 'community-detail'
  >('chat');
  const [viewingCommunity, setViewingCommunity] = useState<string | null>(null);
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [showLanding, setShowLanding] = useState(true);

  const { loadSession } = useChatStore();

  const [history, setHistory] = useState<ChatHistory[]>([]);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [communityPosts, setCommunityPosts] = useState<Post[]>([]);
  const [profile, setProfile] = useState<ApiProfile | null>(null);
  const [followedCommunities, setFollowedCommunities] = useState<CommunityTag[]>([]);
  const [recommendedCommunities, setRecommendedCommunities] = useState<CommunityTag[]>([]);
  const [likedPosts, setLikedPosts] = useState<string[]>([]);
  const [bookmarkedPosts, setBookmarkedPosts] = useState<string[]>([]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const [profileData, historyData, postData, communityMeta, sessionsData] = await Promise.all([
          getProfile(),
          getHistory(),
          getDiscoverFeed(),
          getCommunityMeta(),
          getChatSessions()
        ]);

        if (!isMounted) return;

        setProfile(profileData);
        setHistory(historyData.map(mapHistory));
        setCommunityPosts(postData.map(mapPost));
        setFollowedCommunities(communityMeta.followed);
        setRecommendedCommunities(communityMeta.recommended);
        setLikedPosts(communityMeta.user.likes.filter((id) => !id.includes(':')));
        setBookmarkedPosts(communityMeta.user.bookmarks);
        
        // 加载聊天会话
        setChatSessions(sessionsData.map(s => ({
          ...s,
          timestamp: new Date(s.timestamp)
        })));
      } catch (error) {
        console.error('Failed to load app data', error);
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleNavigateToCommunity = (communityName: string) => {
    setViewingCommunity(communityName);
    setCurrentPage('community-detail');
  };

  const refreshHistory = async () => {
    try {
      console.log('[App] Fetching history, guestId:', localStorage.getItem('hushtohues_guest_id'));
      const historyData = await getHistory();
      console.log('[App] History fetched:', historyData.length, 'items');
      setHistory(historyData.map(mapHistory));
    } catch (error) {
      console.error('[App] Failed to refresh history', error);
      if (error instanceof Error) {
        console.error('[App] Error message:', error.message);
      }
    }
  };

  const refreshChatSessions = async () => {
    try {
      console.log('[App] Fetching chat sessions');
      const sessionsData = await getChatSessions();
      console.log('[App] Chat sessions fetched:', sessionsData.length, 'items');
      setChatSessions(sessionsData.map(s => ({
        ...s,
        timestamp: new Date(s.timestamp)
      })));
    } catch (error) {
      console.error('[App] Failed to refresh chat sessions', error);
    }
  };

  const handleUpdateHistory = async (id: string, updates: Partial<ChatHistory>) => {
    setHistory((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );

    try {
      await updateHistoryItem(id, {
        ...updates,
        timestamp: updates.timestamp ? updates.timestamp.toISOString() : undefined
      } as Partial<ApiHistoryItem>);
    } catch (error) {
      console.error('Failed to update history', error);
    }
  };

  const handleDeleteHistory = (id: string) => {
    setHistory((prev) => prev.filter((item) => item.id !== id));
  };

  const handleToggleLike = async (postId: string) => {
    try {
      const result = await toggleCommunityLike(postId);
      setLikedPosts((prev) =>
        result.liked
          ? prev.includes(postId)
            ? prev
            : [...prev, postId]
          : prev.filter((id) => id !== postId)
      );
      setCommunityPosts((prev) =>
        prev.map((post) => (post.id === postId ? { ...post, likes: result.likes } : post))
      );
    } catch (error) {
      console.error('Failed to toggle like', error);
    }
  };

  const handleToggleBookmark = async (postId: string) => {
    try {
      const result = await toggleCommunityBookmark(postId);
      setBookmarkedPosts((prev) =>
        result.bookmarked
          ? prev.includes(postId)
            ? prev
            : [...prev, postId]
          : prev.filter((id) => id !== postId)
      );
    } catch (error) {
      console.error('Failed to toggle bookmark', error);
    }
  };

  const handleFollowCommunity = async (community: CommunityTag) => {
    try {
      const result = await followCommunity(community.name);
      setFollowedCommunities(result.followed);
      setRecommendedCommunities(result.recommended);
    } catch (error) {
      console.error('Failed to follow community', error);
    }
  };

  const handleUnfollowCommunity = async (name: string) => {
    try {
      const result = await unfollowCommunity(name);
      setFollowedCommunities(result.followed);
      setRecommendedCommunities(result.recommended);
    } catch (error) {
      console.error('Failed to unfollow community', error);
    }
  };

  const handleProfileUpdate = async (payload: Partial<ApiProfile>) => {
    try {
      const updated = await updateProfile(payload);
      setProfile(updated);
    } catch (error) {
      console.error('Failed to update profile', error);
    }
  };

  const publicHistoryPosts: Post[] = useMemo(() => {
    return history
      .filter((item) => item.isPublic)
      .map((item) => ({
        id: item.id,
        title: item.title,
        author: { name: profile?.userName || 'You' },
        imageUrl: item.previewImages[0] || 'https://via.placeholder.com/800x450',
        content: item.lastMessage,
        likes: 0,
        comments: 0,
        timestamp: item.timestamp,
        tags: item.tags
      }));
  }, [history, profile?.userName]);

  const allDiscoverPosts = useMemo(() => {
    return [...communityPosts, ...publicHistoryPosts].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
  }, [communityPosts, publicHistoryPosts]);

  return (
    <>
      <AnimatePresence>
        {showLanding && <LandingPage onEnter={() => setShowLanding(false)} />}
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
                transition={{
                  duration: 1.5,
                  ease: 'easeInOut',
                  repeat: Infinity,
                  repeatType: 'reverse',
                  repeatDelay: 1
                }}
              />
            </svg>
          </div>

          <nav className="flex-1 space-y-3">
            <button
              onClick={() => setCurrentPage('chat')}
              className={`w-full flex items-center gap-3 px-4 py-3 transition-all sketch-btn hand-drawn-border group ${
                currentPage === 'chat' ? 'bg-[#e8e4d9]' : 'bg-transparent hover:bg-[#f0ece1]'
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
              onClick={() => setCurrentPage('archive')}
              className={`w-full flex items-center gap-3 px-4 py-3 transition-all sketch-btn hand-drawn-border group ${
                currentPage === 'archive' ? 'bg-[#e8e4d9]' : 'bg-transparent hover:bg-[#f0ece1]'
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
              onClick={() => setCurrentPage('chat-history')}
              className={`w-full flex items-center gap-3 px-4 py-3 transition-all sketch-btn hand-drawn-border group ${
                currentPage === 'chat-history' ? 'bg-[#e8e4d9]' : 'bg-transparent hover:bg-[#f0ece1]'
              }`}
            >
              <div className="w-5 h-5 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-full h-full text-[#1a1a1a]" style={{ filter: 'url(#hand-drawn)' }}>
                  <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
                  <path d="M12 6v6l4 2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <span className="font-bold handwritten text-[#1a1a1a]">History</span>
            </button>

            <button
              onClick={() => setCurrentPage('community')}
              className={`w-full flex items-center gap-3 px-4 py-3 transition-all sketch-btn hand-drawn-border group ${
                currentPage === 'community' ? 'bg-[#e8e4d9]' : 'bg-transparent hover:bg-[#f0ece1]'
              }`}
            >
              <div className="w-5 h-5 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-full h-full text-[#1a1a1a]" style={{ filter: 'url(#hand-drawn)' }}>
                  {/* Person 1 (Center) */}
                  <circle cx="12" cy="7" r="2.5" fill="none" stroke="currentColor" strokeWidth="2" />
                  <path
                    d="M7 21v-2a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4v2"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  {/* Person 2 (Left) */}
                  <circle cx="5" cy="10" r="2" fill="none" stroke="currentColor" strokeWidth="2" />
                  <path
                    d="M1 21v-1a3 3 0 0 1 3-3h1"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  {/* Person 3 (Right) */}
                  <circle cx="19" cy="10" r="2" fill="none" stroke="currentColor" strokeWidth="2" />
                  <path
                    d="M19 17h1a3 3 0 0 1 3 3v1"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <span className="font-bold handwritten text-[#1a1a1a]">Community</span>
            </button>

            <button
              onClick={() => setCurrentPage('profile')}
              className={`w-full flex items-center gap-3 px-4 py-3 transition-all sketch-btn hand-drawn-border group ${
                currentPage === 'profile' ? 'bg-[#e8e4d9]' : 'bg-transparent hover:bg-[#f0ece1]'
              }`}
            >
              <div className="w-5 h-5 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-full h-full text-[#1a1a1a]" style={{ filter: 'url(#hand-drawn)' }}>
                  <circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
                  <path
                    d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <span className="font-bold handwritten text-[#1a1a1a]">Profile</span>
            </button>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto relative">
          {currentPage === 'chat' && <ChatPage onHistorySync={() => {
            refreshHistory();
            refreshChatSessions();
          }} />}
          {currentPage === 'archive' && (
            <HistoryPage
              onNavigateToCommunity={handleNavigateToCommunity}
              history={history}
              onUpdateHistory={handleUpdateHistory}
              onDeleteHistory={handleDeleteHistory}
            />
          )}
          {currentPage === 'chat-history' && (
            <ChatHistoryPage
              sessions={chatSessions}
              onSelectSession={async (sessionId) => {
                try {
                  console.log('[App] Loading session:', sessionId);
                  
                  // Load messages from the selected session
                  const response = await fetch(`/api/chat?action=load&sessionId=${sessionId}`, {
                    headers: {
                      'X-Guest-ID': localStorage.getItem('hushtohues_guest_id') || ''
                    }
                  });
                  
                  if (!response.ok) throw new Error('Failed to load session');
                  
                  const data = await response.json();
                  const loadedMessages = (data.messages || []).map((msg: any) => ({
                    ...msg,
                    timestamp: new Date(msg.timestamp)
                  }));
                  
                  console.log('[App] Loaded', loadedMessages.length, 'messages, calling loadSession');
                  
                  // Directly load the session into chat store
                  loadSession(sessionId, loadedMessages);
                  
                  console.log('[App] Session loaded, switching to chat page');
                  
                  // Switch to chat page - messages should already be loaded
                  setCurrentPage('chat');
                } catch (error) {
                  console.error('Failed to load session:', error);
                  alert('Failed to load chat session');
                }
              }}
              onDeleteSession={async (sessionId) => {
                try {
                  // TODO: Call delete API when implemented
                  console.log('Delete session:', sessionId);
                  setChatSessions(prev => prev.filter(s => s.sessionId !== sessionId));
                } catch (error) {
                  console.error('Failed to delete session:', error);
                }
              }}
            />
          )}
          {currentPage === 'community' && (
            <CommunityPage
              onNavigateToCommunity={handleNavigateToCommunity}
              posts={allDiscoverPosts}
              likedPosts={likedPosts}
              bookmarkedPosts={bookmarkedPosts}
              followedCommunities={followedCommunities}
              recommendedCommunities={recommendedCommunities}
              onToggleLike={handleToggleLike}
              onToggleBookmark={handleToggleBookmark}
              onFollowCommunity={handleFollowCommunity}
              onUnfollowCommunity={handleUnfollowCommunity}
            />
          )}
          {currentPage === 'community-detail' && viewingCommunity && (
            <CommunityDetailPage communityName={viewingCommunity} onBack={() => setCurrentPage('community')} />
          )}
          {currentPage === 'profile' && profile && (
            <ProfilePage profile={profile} onUpdateProfile={handleProfileUpdate} />
          )}
        </main>
      </div>
    </>
  );
}
