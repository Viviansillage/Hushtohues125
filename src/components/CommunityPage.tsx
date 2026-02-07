import { useMemo, useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CanvasDetail } from './CanvasDetail';

// --- Types ---

export interface Post {
  id: string;  // ✅ MUST be community_posts.id (uuid)
  title: string;
  author: {
    name: string;
    type?: string;
    id?: string;
  };
  imageUrl: string;
  content: string;
  likes: number;
  comments: number;
  timestamp: Date;
  tags: string[];
  communityName?: string | null;
}

export interface CommunityTag {
  name: string;
  stats: {
    totalPosts: number;
    members: number;
    online: number;
    postsToday: number;
  };
  trending: string[];
}

interface CommunityPageProps {
  activeTab?: 'following' | 'discover';
  onActiveTabChange?: (tab: 'following' | 'discover') => void;
  onNavigateToCommunity?: (postId: string) => void;  // ✅ postId is community_posts.id
  posts: Post[];
  likedPosts: string[];
  bookmarkedPosts: string[];
  followedCommunities: CommunityTag[];
  recommendedCommunities: CommunityTag[];
  onToggleLike: (id: string) => void;
  onToggleBookmark: (id: string) => void;
  onFollowCommunity: (community: CommunityTag) => void;
  onUnfollowCommunity: (name: string) => void;
}

// --- Components ---

export function CommunityPage({
  activeTab: controlledTab,
  onActiveTabChange,
  onNavigateToCommunity,
  posts,
  likedPosts,
  bookmarkedPosts,
  followedCommunities,
  recommendedCommunities,
  onToggleLike,
  onToggleBookmark,
  onFollowCommunity,
  onUnfollowCommunity
}: CommunityPageProps) {
  const [internalTab, setInternalTab] = useState<'following' | 'discover'>('following');
  const activeTab = controlledTab ?? internalTab;
  const setActiveTab = onActiveTabChange ?? setInternalTab;
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const likedSet = useMemo(() => new Set(likedPosts), [likedPosts]);
  const bookmarkedSet = useMemo(() => new Set(bookmarkedPosts), [bookmarkedPosts]);
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Close search when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleFollow = (community: CommunityTag) => {
    onFollowCommunity(community);
  };

  const handleUnfollow = (name: string) => {
    onUnfollowCommunity(name);
  };

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return 'Yesterday';
    return `${diffInDays}d ago`;
  };

  // Filter recommendations based on search
  const filteredRecommendations = recommendedCommunities.filter(c =>
    !followedCommunities.some(fc => fc.name === c.name) &&
    (searchQuery === '' || c.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // If a post is selected, show the detail view
  if (selectedPostId) {
    const selectedPost = posts.find(p => p.id === selectedPostId);
    if (selectedPost) {
      return (
        <CanvasDetail 
          item={{
            id: selectedPost.id,
            title: selectedPost.title,
            images: [selectedPost.imageUrl],
            content: selectedPost.content,
            tags: selectedPost.tags,
            isPublic: true,
            stats: {
              likes: selectedPost.likes,
              comments: selectedPost.comments
            },
            author: selectedPost.author
          }}
          readOnly={true}
          onClose={() => setSelectedPostId(null)} 
        />
      );
    }
  }

  return (
    <div className="h-screen overflow-y-auto bg-[#f5f1e8]">
      <div className="max-w-[1400px] mx-auto px-8 py-8">
        {/* Header with Toggle Bar */}
        <div className="mb-8 flex flex-col items-center gap-6">
          {/* Toggle Bar */}
          <div className="flex bg-[#faf8f3] border-[2.5px] border-[#1a1a1a] p-1 hand-drawn-border min-w-[320px]">
            <button
              className={`flex-1 py-2 px-4 font-bold handwritten transition-all relative overflow-hidden group ${
                activeTab === 'following' ? 'text-[#1a1a1a]' : 'text-[#6d6d6d] hover:text-[#1a1a1a]'
              }`}
              onClick={() => setActiveTab('following')}
            >
              {activeTab === 'following' && (
                <motion.div 
                  layoutId="tab-bg"
                  className="absolute inset-0 bg-[#e8e4d9] border-[1.5px] border-[#1a1a1a] m-0.5 rounded-sm"
                  style={{ borderRadius: '255px 15px 225px 15px / 15px 225px 15px 255px' }}
                />
              )}
              <span className="relative z-10 flex items-center justify-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                </svg>
                Following
              </span>
            </button>
            <button
              className={`flex-1 py-2 px-4 font-bold handwritten transition-all relative overflow-hidden group ${
                activeTab === 'discover' ? 'text-[#1a1a1a]' : 'text-[#6d6d6d] hover:text-[#1a1a1a]'
              }`}
              onClick={() => setActiveTab('discover')}
            >
              {activeTab === 'discover' && (
                <motion.div 
                  layoutId="tab-bg"
                  className="absolute inset-0 bg-[#e8e4d9] border-[1.5px] border-[#1a1a1a] m-0.5 rounded-sm"
                  style={{ borderRadius: '255px 15px 225px 15px / 15px 225px 15px 255px' }}
                />
              )}
              <span className="relative z-10 flex items-center justify-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>
                </svg>
                Discover
              </span>
            </button>
          </div>

          {/* Search Bar for Following Tab */}
          <AnimatePresence>
            {activeTab === 'following' && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="w-full max-w-md relative z-30"
                ref={searchRef}
              >
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setIsSearchOpen(true)}
                    placeholder="Search or find new communities..."
                    className="w-full bg-[#faf8f3] border-[2px] border-[#1a1a1a] py-3 pl-12 pr-4 rounded-lg hand-drawn-border outline-none handwritten text-lg placeholder-[#1a1a1a]/40 focus:bg-white transition-colors"
                  />
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#1a1a1a]/50 pointer-events-none">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"></circle>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                  </div>
                </div>

                {/* Dropdown Suggestions */}
                {isSearchOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute top-full left-0 w-full mt-2 bg-[#faf8f3] border-[2px] border-[#1a1a1a] rounded-lg shadow-lg overflow-hidden hand-drawn-border"
                  >
                    <div className="p-3 bg-[#e8e4d9] border-b border-[#1a1a1a] flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#1a1a1a]/60">
                        {searchQuery ? 'Search Results' : 'AI Recommendations'}
                      </span>
                      {!searchQuery && (
                         <span className="text-[10px] bg-[#1a1a1a] text-[#faf8f3] px-2 py-0.5 rounded-full handwritten">
                           Based on your activity
                         </span>
                      )}
                    </div>
                    
                    <div className="max-h-60 overflow-y-auto">
                      {filteredRecommendations.length > 0 ? (
                        filteredRecommendations.map((community) => (
                          <div 
                            key={community.name}
                            className="p-3 hover:bg-[#e8e4d9]/50 flex items-center justify-between group transition-colors cursor-pointer border-b border-[#1a1a1a]/5 last:border-0"
                            onClick={() => {
                                // TODO: 改为筛选 Discover 列表，而不是跳转详情页
                                // if (onNavigateToCommunity) onNavigateToCommunity(community.name);
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 border-[1.5px] border-[#1a1a1a] bg-white flex items-center justify-center rounded-sm rotate-1">
                                <span className="font-bold handwritten">#</span>
                              </div>
                              <div>
                                <div className="font-bold handwritten capitalize">{community.name}</div>
                                <div className="text-xs text-[#6d6d6d]">{community.stats.members.toLocaleString()} members</div>
                              </div>
                            </div>
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleFollow(community);
                                }}
                                className="text-xs bg-[#1a1a1a] text-[#faf8f3] px-3 py-1 rounded hover:opacity-80 transition-opacity handwritten"
                            >
                              Follow
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="p-4 text-center text-[#6d6d6d] handwritten">
                          No communities found matching "{searchQuery}"
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Content Area */}
        <div className="space-y-6">
          <AnimatePresence mode="wait">
            {activeTab === 'following' ? (
              <motion.div
                key="following"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              >
                {followedCommunities.map((community) => (
                  <div 
                    key={community.name}
                    className="bg-[#faf8f3] border-[2.5px] border-[#1a1a1a] p-6 hand-drawn-border wireframe-shadow group relative hover:-translate-y-1 transition-transform"
                    // TODO: 改为筛选 Discover 列表
                    // onClick={() => onNavigateToCommunity && onNavigateToCommunity(community.name)}
                  >
                    {/* Community Header */}
                    <div className="flex items-start justify-between mb-6">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 border-[2.5px] border-[#1a1a1a] bg-[#e8e4d9] flex items-center justify-center hand-drawn-border rotate-2">
                          <span className="text-3xl font-black handwritten">#</span>
                        </div>
                        <div>
                          <h2 className="text-2xl font-bold handwritten capitalize">
                            {community.name}
                          </h2>
                          <div className="flex items-center gap-2 mt-1">
                             <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                             <span className="text-sm text-[#6d6d6d] handwritten font-bold">{community.stats.online} online</span>
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            handleUnfollow(community.name);
                        }}
                        className="text-xs border-[1.5px] border-[#1a1a1a] px-2 py-1 hand-drawn-border hover:bg-[#1a1a1a] hover:text-[#faf8f3] transition-colors handwritten font-bold"
                      >
                        Unfollow
                      </button>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-4 mb-6 border-b border-[#1a1a1a]/10 pb-4">
                      <div className="text-center">
                        <div className="text-xl font-black handwritten">{community.stats.totalPosts.toLocaleString()}</div>
                        <div className="text-xs text-[#6d6d6d] uppercase tracking-wider font-sans font-bold">Posts</div>
                      </div>
                      <div className="text-center border-l border-[#1a1a1a]/10">
                        <div className="text-xl font-black handwritten">{community.stats.members.toLocaleString()}</div>
                        <div className="text-xs text-[#6d6d6d] uppercase tracking-wider font-sans font-bold">Members</div>
                      </div>
                      <div className="text-center border-l border-[#1a1a1a]/10">
                        <div className="text-xl font-black handwritten">+{community.stats.postsToday}</div>
                        <div className="text-xs text-[#6d6d6d] uppercase tracking-wider font-sans font-bold">Today</div>
                      </div>
                    </div>

                    {/* Trending Section */}
                    <div>
                       <div className="flex items-center gap-2 mb-3 text-[#1a1a1a]/70">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
                            <polyline points="17 6 23 6 23 12"></polyline>
                          </svg>
                          <span className="text-xs font-bold uppercase tracking-widest font-sans">Trending Now</span>
                       </div>
                       <ul className="space-y-2">
                          {community.trending.map((trend, i) => (
                             <li key={i} className="flex items-start gap-2 group/item cursor-pointer">
                                <span className="text-[#1a1a1a]/40 handwritten font-bold">{i + 1}.</span>
                                <span className="text-sm handwritten font-medium group-hover/item:underline decoration-wavy decoration-[#1a1a1a]/30">{trend}</span>
                             </li>
                          ))}
                       </ul>
                    </div>

                    {/* Action Footer */}
                    <div className="mt-6 pt-4 border-t border-dashed border-[#1a1a1a]/20 flex justify-center">
                       <button className="text-sm font-bold handwritten hover:scale-110 transition-transform flex items-center gap-2">
                          <span>Enter Community</span>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                             <path d="M5 12h14M12 5l7 7-7 7"/>
                          </svg>
                       </button>
                    </div>
                  </div>
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="discover"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
              >
                {posts.map((post) => {
                  // ✅ MUST use post.id (community_posts.id) - no fallback
                  if (!post.id) {
                    console.error('[Discover Card] Missing post.id:', post);
                    return null;
                  }
                  
                  return (
                  <article
                    key={post.id}
                    className="bg-[#faf8f3] border-[2.5px] border-[#1a1a1a] hand-drawn-border wireframe-shadow overflow-hidden group flex flex-col cursor-pointer"
                    onClick={() => onNavigateToCommunity && onNavigateToCommunity(post.id)}
                  >
                    {/* Image Area - Prominent */}
                    <div className="relative w-full aspect-[16/9] border-b-[2.5px] border-[#1a1a1a] bg-[#e8e4d9] overflow-hidden">
                       <img 
                          src={post.imageUrl} 
                          alt={post.title}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 grayscale-[0.2]"
                       />
                       {/* Overlay Gradient for contrast if needed, or specific hand-drawn scrim */}
                       <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a]/10 to-transparent pointer-events-none"></div>
                    </div>

                    <div className="p-6">
                        {/* Title & Author Row */}
                        <div className="flex flex-col gap-4 mb-4">
                           {/* Author & Meta - Moved below image as requested */}
                           <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 border-[2px] border-[#1a1a1a] rounded-full flex items-center justify-center bg-[#e8e4d9]">
                                  <span className="font-bold handwritten text-sm">{post.author.name[0]}</span>
                                </div>
                                <div className="flex flex-col leading-none">
                                   <span className="font-bold handwritten text-sm">{post.author.name}</span>
                                   <span className="text-xs text-[#6d6d6d] font-sans">{formatTimestamp(post.timestamp)}</span>
                                </div>
                              </div>
                              
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onToggleBookmark(post.id);
                                }}
                                className={`transition-all p-2 rounded-full hover:bg-[#1a1a1a]/5 ${
                                  bookmarkedSet.has(post.id) ? 'text-[#1a1a1a]' : 'text-[#1a1a1a]/40'
                                }`}
                              >
                                 <svg width="20" height="20" viewBox="0 0 24 24" fill={bookmarkedSet.has(post.id) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                                 </svg>
                              </button>
                           </div>

                           <h2 className="text-2xl font-black handwritten leading-tight group-hover:underline decoration-wavy decoration-[#1a1a1a]/30">
                              {post.title}
                           </h2>
                        </div>
                        
                        {/* Tags */}
                        <div className="flex flex-wrap gap-2 mb-4">
                          {post.tags.map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-1 border-[1.5px] border-[#1a1a1a] text-xs font-bold hand-drawn-border bg-white hover:bg-[#e8e4d9] transition-colors uppercase tracking-wide"
                              onClick={(e) => {
                                e.stopPropagation();
                                // TODO: 改为筛选 Discover 列表
                                // if (onNavigateToCommunity) onNavigateToCommunity(tag);
                              }}
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>

                        {/* Actions Row */}
                        <div className="flex items-center gap-6 pt-4 border-t border-[#1a1a1a]/10">
                           <button
                             onClick={(e) => {
                               e.stopPropagation();
                               onToggleLike(post.id);
                             }}
                             className={`flex items-center gap-2 group/like ${likedSet.has(post.id) ? 'text-red-500' : 'text-[#1a1a1a]/60 hover:text-[#1a1a1a]'}`}
                           >
                              <svg width="20" height="20" viewBox="0 0 24 24" fill={likedSet.has(post.id) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-active/like:scale-125 transition-transform">
                                 <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                              </svg>
                              <span className="font-bold handwritten text-sm">{post.likes} Likes</span>
                           </button>

                           <button className="flex items-center gap-2 text-[#1a1a1a]/60 hover:text-[#1a1a1a]">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                 <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                              </svg>
                              <span className="font-bold handwritten text-sm">{post.comments} Comments</span>
                           </button>
                        </div>
                    </div>
                  </article>
                  );
                }).filter(Boolean)}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
