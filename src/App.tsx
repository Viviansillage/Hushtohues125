import { useEffect, useMemo, useState, useCallback } from 'react';
import { ChatPage } from './components/ChatPage';
import { HistoryPage, ChatHistory } from './components/HistoryPage';
import { ChatHistoryPage, ChatSession } from './components/ChatHistoryPage';
import { ChatHistoryDetailPage } from './components/ChatHistoryDetailPage';
import { CommunityPage, Post, CommunityTag } from './components/CommunityPage';
import { CommunityDetailPage } from './components/CommunityDetailPage';
import { CommunityFeedPage } from './components/CommunityFeedPage';
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
import { getGuestDisplayName } from './lib/guest';
import { toast } from 'sonner';

const mapHistory = (item: ApiHistoryItem): ChatHistory => ({
  ...item,
  timestamp: new Date(item.timestamp)
});

const mapPost = (post: ApiCommunityPost): Post => ({
  id: post.id,  // ✅ ONLY use community_posts.id
  title: post.title,
  author: post.author,
  imageUrl: post.imageUrl || '',
  content: '',  // Discover list doesn't include content
  likes: post.likes,
  comments: post.comments,
  timestamp: new Date(post.timestamp),
  tags: post.tags,
  communityName: post.communityName ?? undefined
});

export default function App() {
  const [currentPage, setCurrentPage] = useState<
    'chat' | 'archive' | 'chat-history' | 'chat-history-detail' | 'community' | 'profile' | 'community-detail' | 'community-feed'
  >('chat');
  const [viewingCommunityPost, setViewingCommunityPost] = useState<string | null>(null);  // Uses postId
  const [viewingHistorySession, setViewingHistorySession] = useState<string | null>(null);
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [showLanding, setShowLanding] = useState(true);

  const [history, setHistory] = useState<ChatHistory[]>([]);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [communityPosts, setCommunityPosts] = useState<Post[]>([]);
  const [profile, setProfile] = useState<ApiProfile | null>(null);
  const [followedCommunities, setFollowedCommunities] = useState<CommunityTag[]>([]);
  const [recommendedCommunities, setRecommendedCommunities] = useState<CommunityTag[]>([]);
  const [likedPosts, setLikedPosts] = useState<string[]>([]);
  const [bookmarkedPosts, setBookmarkedPosts] = useState<string[]>([]);
  const [communityActiveTab, setCommunityActiveTab] = useState<'following' | 'discover'>('following');
  const [viewingCommunity, setViewingCommunity] = useState<CommunityTag | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [lastCanvasClosedSessionId, setLastCanvasClosedSessionId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        // Handle separately so community errors don't block other data
        const [profileData, historyData, sessionsData] = await Promise.all([
          getProfile(),
          getHistory(),
          getChatSessions()
        ]);

        if (!isMounted) return;

        // When guest has no posts, API returns default name; use localStorage fallback
        let mergedProfile = profileData;
        if (profileData.isGuest && /^Guest-[a-z0-9]+$/i.test(profileData.userName)) {
          const savedName = getGuestDisplayName();
          if (savedName) {
            mergedProfile = { ...profileData, userName: savedName };
          }
        }
        setProfile(mergedProfile);
        setHistory(historyData.map(mapHistory));
        
        // Load chat sessions
        setChatSessions(sessionsData.map(s => ({
          ...s,
          timestamp: new Date(s.timestamp)
        })));

        // Load Community data separately, does not block main flow
        try {
          const [postData, communityMeta] = await Promise.all([
            getDiscoverFeed(),
            getCommunityMeta()
          ]);

          if (!isMounted) return;

          setCommunityPosts(postData.map(mapPost));
          setFollowedCommunities(communityMeta.followed);
          setRecommendedCommunities(communityMeta.recommended);
          setLikedPosts(communityMeta.user.likes.filter((id) => !id.includes(':')));
          setBookmarkedPosts(communityMeta.user.bookmarks);
        } catch (communityError) {
          console.error('[App] Failed to load community data (non-blocking):', communityError);
          // Set defaults to avoid undefined
          setCommunityPosts([]);
          setFollowedCommunities([]);
          setRecommendedCommunities([]);
        }
      } catch (error) {
        console.error('Failed to load app data', error);
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleNavigateToCommunity = (postId: string) => {
    setViewingCommunityPost(postId);
    setCurrentPage('community-detail');
  };

  const handleEnterCommunity = (community: CommunityTag) => {
    setViewingCommunity(community);
    setCurrentPage('community-feed');
  };

  const refreshHistory = useCallback(async () => {
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
  }, []);

  const refreshDiscoverFeed = useCallback(async () => {
    try {
      console.log('[App] Fetching Discover feed');
      const postData = await getDiscoverFeed();
      console.log('[App] Discover feed fetched:', postData.length, 'posts');
      setCommunityPosts(postData.map(mapPost));
    } catch (error) {
      console.error('[App] Failed to refresh Discover feed', error);
    }
  }, []);

  const refreshChatSessions = useCallback(async () => {
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
  }, []);

  const refreshCommunityMeta = async () => {
    try {
      console.log('[App] Fetching community meta');
      const communityMeta = await getCommunityMeta();
      console.log('[App] Community meta fetched:', {
        followed: communityMeta.followed.length,
        recommended: communityMeta.recommended.length
      });
      setFollowedCommunities(communityMeta.followed);
      setRecommendedCommunities(communityMeta.recommended);
      setLikedPosts(communityMeta.user.likes.filter((id) => !id.includes(':')));
      setBookmarkedPosts(communityMeta.user.bookmarks);
    } catch (error) {
      console.error('[App] Failed to refresh community meta', error);
    }
  };

  const handleUpdateHistory = async (id: string, updates: Partial<ChatHistory>) => {
    setHistory((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );

    try {
      const apiPayload: Partial<ApiHistoryItem> = {
        ...updates,
        timestamp: updates.timestamp ? updates.timestamp.toISOString() : undefined
      } as Partial<ApiHistoryItem>;
      if (updates.isPublic === true) {
        const displayName = profile?.userName || getGuestDisplayName();
        if (displayName) apiPayload.authorDisplayName = displayName;
      }
      await updateHistoryItem(id, apiPayload);
      
      // ✅ If isPublic was changed, refresh Discover feed
      if (updates.isPublic !== undefined) {
        console.log('[App] Refreshing Discover feed after isPublic change');
        await refreshDiscoverFeed();
      }
    } catch (error) {
      console.error('Failed to update history', error);
      const msg = (error instanceof Error && error.message)
        ? (() => {
            try {
              const parsed = JSON.parse(error.message);
              return parsed.message || parsed.error || error.message;
            } catch {
              return error.message;
            }
          })()
        : 'Update failed';
      if (updates.isPublic !== undefined) {
        setPublishError(msg);
        setHistory((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, isPublic: !updates.isPublic } : item
          )
        );
      } else {
        toast.error(msg);
      }
    }
  };

  const handleDeleteHistory = async (id: string) => {
    setHistory((prev) => prev.filter((item) => item.id !== id));
    // After deleting a canvas, ensure Discover feed reflects removal
    await refreshDiscoverFeed();
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
      console.log('[App] Community followed successfully:', community.name);
    } catch (error) {
      console.error('Failed to follow community', error);
      // On failure, still try refresh to keep UI in sync with DB
      await refreshCommunityMeta();
    }
  };

  const handleUnfollowCommunity = async (name: string) => {
    try {
      const result = await unfollowCommunity(name);
      setFollowedCommunities(result.followed);
      setRecommendedCommunities(result.recommended);
      console.log('[App] Community unfollowed successfully:', name);
    } catch (error) {
      console.error('Failed to unfollow community', error);
      // On failure, still try refresh to keep UI in sync with DB
      await refreshCommunityMeta();
    }
  };

  const handleProfileUpdate = async (payload: Partial<ApiProfile>) => {
    try {
      const updated = await updateProfile(payload);
      setProfile(updated);
      console.log('[App] Profile updated successfully:', updated.userName);
      // Refresh Discover list so author name updates after rename
      try {
        await refreshDiscoverFeed();
      } catch (e) {
        console.error('[App] Failed to refresh Discover after profile update:', e);
      }
    } catch (error) {
      console.error('[App] Failed to update profile:', error);
      // Re-throw error so ProfilePage can show error message
      throw error;
    }
  };

  // ✅ Discover feed: ONLY show community_posts (no history-derived posts)
  // History is a separate concept - only published sessions appear in community_posts
  const allDiscoverPosts = useMemo(() => {
    return communityPosts.sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
  }, [communityPosts]);

  // ✅ Stable callback to prevent ChatPage useEffect from re-triggering
  const handleHistorySync = useCallback(() => {
    refreshHistory();
    refreshChatSessions();
  }, [refreshHistory, refreshChatSessions]);

  // Publish error modal: auto-close after 3s
  useEffect(() => {
    if (!publishError) return;
    const t = setTimeout(() => setPublishError(null), 3000);
    return () => clearTimeout(t);
  }, [publishError]);

  // Refresh archive list when switching to Archive tab
  useEffect(() => {
    if (currentPage === 'archive') refreshHistory();
  }, [currentPage, refreshHistory]);

  return (
    <>
      <AnimatePresence>
        {showLanding && <LandingPage onEnter={() => setShowLanding(false)} />}
      </AnimatePresence>

      {/* SVG Filters for hand-drawn effect; x/y/width/height limit output to avoid filter overflow gray bar */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
          <filter id="hand-drawn" x="0" y="0" width="100%" height="100%">
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
              onClick={() => {
                setCurrentPage('community');
                // Refresh data when switching to Community
                refreshCommunityMeta();
                refreshDiscoverFeed();
              }}
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
          {currentPage === 'chat' && (
            <ChatPage
              onHistorySync={handleHistorySync}
              refreshSavedForSessionId={lastCanvasClosedSessionId}
              onClearedRefreshSavedTrigger={() => setLastCanvasClosedSessionId(null)}
            />
          )}
          {currentPage === 'archive' && (
            <HistoryPage
              onNavigateToCommunity={handleNavigateToCommunity}
              history={history}
              onUpdateHistory={handleUpdateHistory}
              onDeleteHistory={handleDeleteHistory}
              onRefreshHistory={refreshHistory}
              onCanvasClosed={setLastCanvasClosedSessionId}
            />
          )}
          {currentPage === 'chat-history' && (
            <ChatHistoryPage
              sessions={chatSessions}
              onSelectSession={(sessionId) => {
                // Navigate to read-only history detail, don't overwrite current chat state
                setViewingHistorySession(sessionId);
                setCurrentPage('chat-history-detail');
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
              activeTab={communityActiveTab}
              onActiveTabChange={setCommunityActiveTab}
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
              onEnterCommunity={handleEnterCommunity}
            />
          )}
          {currentPage === 'chat-history-detail' && viewingHistorySession && (
            <ChatHistoryDetailPage 
              sessionId={viewingHistorySession} 
              onBack={() => setCurrentPage('chat-history')} 
            />
          )}
          {currentPage === 'community-detail' && viewingCommunityPost && (
            <CommunityDetailPage 
              postId={viewingCommunityPost} 
              onBack={() => {
                setCurrentPage('community');
                refreshCommunityMeta();
              }} 
            />
          )}
          {currentPage === 'community-feed' && viewingCommunity && (
            <CommunityFeedPage
              community={viewingCommunity}
              isJoined={followedCommunities.some((f) => f.name === viewingCommunity.name)}
              onBack={() => setCurrentPage('community')}
              onJoinCommunity={async () => {
                if (followedCommunities.some((f) => f.name === viewingCommunity.name)) {
                  await handleUnfollowCommunity(viewingCommunity.name);
                } else {
                  await handleFollowCommunity(viewingCommunity);
                }
                await refreshCommunityMeta();
              }}
              onSelectPost={(postId) => {
                setViewingCommunityPost(postId);
                setCurrentPage('community-detail');
              }}
              likedPosts={likedPosts}
              bookmarkedPosts={bookmarkedPosts}
              onToggleLike={handleToggleLike}
              onToggleBookmark={handleToggleBookmark}
            />
          )}
          {currentPage === 'profile' && profile && (
            <ProfilePage profile={profile} onUpdateProfile={handleProfileUpdate} />
          )}
        </main>
      </div>

      {/* Publish error modal: hand-drawn style, auto-closes after 3s */}
      {publishError && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" aria-modal="true" role="alertdialog">
          <div className="absolute inset-0 bg-[#1a1a1a]/30" onClick={() => setPublishError(null)} />
          <div className="relative max-w-md w-full bg-[#faf8f3] border-[2.5px] border-[#1a1a1a] p-6 hand-drawn-border wireframe-shadow text-center">
            <p className="font-bold handwritten text-[#1a1a1a] text-lg mb-1">Cannot publish</p>
            <p className="text-[#1a1a1a]/90 handwritten text-sm">{publishError}</p>
            <p className="mt-4 text-xs text-[#1a1a1a]/60 handwritten">This message will close in 3 seconds.</p>
          </div>
        </div>
      )}
    </>
  );
}
