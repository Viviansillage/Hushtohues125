import { useEffect, useState } from 'react';
import { getCommunityDetail, toggleCommunityDetailLike, followCommunity, unfollowCommunity } from '../lib/api';

interface Post {
  id: string;
  author: {
    name: string;
  };
  content: string;
  likes: number;
  comments: number;
  timestamp: Date;
  tags: string[];
}

interface CommunityDetailProps {
  communityName: string;
  onBack: () => void;
}

export function CommunityDetailPage({ communityName, onBack }: CommunityDetailProps) {
  const [isJoined, setIsJoined] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [onlineCount, setOnlineCount] = useState(0);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        console.log('[CommunityDetail] Loading detail for:', communityName);
        const response = await getCommunityDetail(communityName);
        if (!isMounted) return;
        console.log('[CommunityDetail] Loaded:', { 
          joined: response.joined, 
          members: response.detail.members 
        });
        setIsJoined(response.joined);
        setMemberCount(response.detail.members);
        setOnlineCount(response.detail.online);
        setPosts(
          response.detail.posts.map((post) => ({
            ...post,
            timestamp: new Date(post.timestamp)
          }))
        );
      } catch (error) {
        console.error('[CommunityDetail] Failed to load:', error);
        if (isMounted) {
          setError(error instanceof Error ? error.message : 'Failed to load community details');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, [communityName]);

  const likedSet = likedPosts;

  const handleJoinToggle = async () => {
    if (isJoining) return; // 防止重复点击
    
    const previousState = isJoined;
    setIsJoining(true);
    
    try {
      // Optimistic update
      setIsJoined(!isJoined);
      
      if (isJoined) {
        // 当前已关注，执行取消关注
        const result = await unfollowCommunity(communityName);
        console.log('[CommunityDetail] Unfollowed successfully:', { 
          community: communityName,
          followed: result.followed.length
        });
      } else {
        // 当前未关注，执行关注
        const result = await followCommunity(communityName);
        console.log('[CommunityDetail] Followed successfully:', { 
          community: communityName,
          followed: result.followed.length
        });
      }
      
      // 重新加载详情页以获取最新状态
      const response = await getCommunityDetail(communityName);
      setIsJoined(response.joined);
      setMemberCount(response.detail.members);
      
    } catch (error) {
      console.error('[CommunityDetail] Failed to toggle follow:', error);
      // Rollback on error
      setIsJoined(previousState);
      
      // 显示错误信息
      const errorMessage = error instanceof Error ? error.message : 'Failed to update follow status';
      alert(`Error: ${errorMessage}. Please try again.`);
    } finally {
      setIsJoining(false);
    }
  };

  const handleLike = async (postId: string) => {
    try {
      const result = await toggleCommunityDetailLike(communityName, postId);
      setPosts((prev) =>
        prev.map((post) => (post.id === postId ? { ...post, likes: result.likes } : post))
      );
      setLikedPosts((prev) => {
        const next = new Set(prev);
        if (result.liked) {
          next.add(postId);
        } else {
          next.delete(postId);
        }
        return next;
      });
    } catch (error) {
      console.error('Failed to toggle like', error);
    }
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

  return (
    <div className="h-screen overflow-y-auto bg-[#f5f1e8]">
      <div className="max-w-4xl mx-auto px-8 py-8">
        {/* Back Button */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 mb-6 text-[#6d6d6d] hover:text-[#1a1a1a] transition-colors handwritten font-bold group"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="group-hover:-translate-x-1 transition-transform"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to Communities
        </button>

        {/* Loading State */}
        {isLoading && (
          <div className="bg-[#faf8f3] border-[2.5px] border-[#1a1a1a] p-12 hand-drawn-border wireframe-shadow text-center">
            <div className="animate-pulse">
              <div className="text-xl font-bold handwritten text-[#6d6d6d]">Loading community...</div>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="bg-[#faf8f3] border-[2.5px] border-[#1a1a1a] p-8 mb-8 hand-drawn-border wireframe-shadow">
            <div className="text-red-600 font-bold handwritten text-lg mb-2">Failed to load community</div>
            <div className="text-[#6d6d6d] handwritten">{error}</div>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-6 py-2 bg-[#1a1a1a] text-[#faf8f3] font-bold handwritten border-[2px] border-[#1a1a1a] hand-drawn-border hover:opacity-80"
            >
              Retry
            </button>
          </div>
        )}

        {/* Content (only show when not loading and no error) */}
        {!isLoading && !error && (
          <>
        {/* Community Header */}
        <div className="bg-[#faf8f3] border-[2.5px] border-[#1a1a1a] p-8 mb-8 hand-drawn-border wireframe-shadow relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 border-[3px] border-[#1a1a1a] bg-[#e8e4d9] flex items-center justify-center hand-drawn-border rotate-[-2deg]">
                <span className="text-5xl font-black handwritten">#</span>
              </div>
              <div>
                <h1 className="text-4xl font-black handwritten capitalize mb-2">{communityName}</h1>
                <div className="flex items-center gap-4 text-[#6d6d6d] handwritten font-bold text-sm">
                  <span className="flex items-center gap-1">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    {memberCount.toLocaleString()} Members
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    {onlineCount.toLocaleString()} Online
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={handleJoinToggle}
              disabled={isJoining || isLoading}
              className={`px-8 py-3 font-bold handwritten text-lg border-[2px] border-[#1a1a1a] transition-all hand-drawn-border hover:shadow-lg ${
                isJoined
                  ? 'bg-[#e8e4d9] text-[#1a1a1a]'
                  : 'bg-[#1a1a1a] text-[#faf8f3] hover:-translate-y-1'
              } ${(isJoining || isLoading) ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isJoining ? 'Loading...' : isJoined ? 'Unfollow' : 'Follow'}
            </button>
          </div>

          {/* Decorative Background Elements */}
          <div className="absolute top-0 right-0 w-64 h-64 opacity-5 pointer-events-none">
            <svg viewBox="0 0 200 200" className="w-full h-full">
              <path d="M100 0 Q150 50 200 0 V200 H0 V0 Q50 50 100 0" fill="currentColor" />
            </svg>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Feed */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-bold handwritten">Latest Discussions</h2>
              <button className="text-sm underline handwritten">Filter by</button>
            </div>

            {posts.map((post) => (
              <article
                key={post.id}
                className="bg-[#faf8f3] border-[2px] border-[#1a1a1a] p-6 hand-drawn-border relative hover:border-[#1a1a1a] transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 border-[2px] border-[#1a1a1a] rounded-full flex items-center justify-center hand-drawn-border bg-[#e8e4d9] shrink-0">
                    <span className="font-bold handwritten">{post.author.name[0]}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold handwritten text-lg leading-none">{post.author.name}</p>
                        <span className="text-xs text-[#6d6d6d]">{formatTimestamp(post.timestamp)}</span>
                      </div>
                      <button className="text-[#1a1a1a]/40 hover:text-[#1a1a1a]">
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <circle cx="12" cy="12" r="1" />
                          <circle cx="19" cy="12" r="1" />
                          <circle cx="5" cy="12" r="1" />
                        </svg>
                      </button>
                    </div>

                    <p className="mt-3 text-[#1a1a1a] font-sans text-lg leading-relaxed">{post.content}</p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {post.tags.map((tag) => (
                        <span key={tag} className="text-xs px-2 py-1 bg-[#e8e4d9] rounded-sm handwritten border border-[#1a1a1a]/10">
                          #{tag}
                        </span>
                      ))}
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#1a1a1a]/10 flex items-center gap-6">
                      <button
                        onClick={() => handleLike(post.id)}
                        className={`flex items-center gap-2 text-sm font-bold handwritten transition-colors ${
                          likedSet.has(post.id) ? 'text-red-500' : 'hover:text-red-500'
                        }`}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill={likedSet.has(post.id) ? 'currentColor' : 'none'}
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                        </svg>
                        {post.likes}
                      </button>
                      <button className="flex items-center gap-2 text-sm font-bold handwritten hover:text-blue-500 transition-colors">
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                        </svg>
                        {post.comments}
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="bg-[#faf8f3] border-[2px] border-[#1a1a1a] p-5 hand-drawn-border">
              <h3 className="font-bold handwritten text-lg mb-3">About Community</h3>
              <p className="text-sm font-sans leading-relaxed text-[#4a4a4a]">
                A space for {communityName} enthusiasts to share ideas, ask questions, and collaborate on new projects. Be kind and creative!
              </p>
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold handwritten text-[#6d6d6d]">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  Created Jan 2025
                </div>
                <div className="flex items-center gap-2 text-xs font-bold handwritten text-[#6d6d6d]">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  English
                </div>
              </div>
            </div>

            <div className="bg-[#faf8f3] border-[2px] border-[#1a1a1a] p-5 hand-drawn-border">
              <h3 className="font-bold handwritten text-lg mb-3">Trending Topics</h3>
              <ul className="space-y-2">
                {['Beginner Guide', 'Showcase', 'Weekly Challenge'].map((topic, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm hover:underline cursor-pointer group">
                    <span className="text-[#1a1a1a]/30 font-bold handwritten">#</span>
                    <span className="font-medium group-hover:text-[#1a1a1a]">{topic}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        </>
        )}
      </div>
    </div>
  );
}
