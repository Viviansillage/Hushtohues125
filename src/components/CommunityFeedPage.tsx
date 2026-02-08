import { useEffect, useState, useMemo } from 'react';
import { getDiscoverFeed } from '../lib/api';
import type { Post } from './CommunityPage';
import type { CommunityTag } from './CommunityPage';

const filterSemanticTags = (tags: string[] = []) =>
  tags.filter((t) => t && !['save', 'image', 'mindmap', 'auto-saved'].includes(t.toLowerCase()));

function formatTimestamp(date: Date) {
  const now = new Date();
  const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
  if (diffInHours < 1) return 'Just now';
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) return 'Yesterday';
  return `${diffInDays}d ago`;
}

const getAboutText = (communityName: string) =>
  `A space for ${communityName} enthusiasts to share ideas, ask questions, and collaborate on new projects. Be kind and creative!`;

interface CommunityFeedPageProps {
  community: CommunityTag;
  isJoined: boolean;
  onBack: () => void;
  onJoinCommunity: () => void;
  onSelectPost: (postId: string) => void;
  likedPosts: string[];
  bookmarkedPosts: string[];
  onToggleLike: (id: string) => void;
  onToggleBookmark: (id: string) => void;
}

export function CommunityFeedPage({
  community,
  isJoined,
  onBack,
  onJoinCommunity,
  onSelectPost,
  likedPosts,
  bookmarkedPosts,
  onToggleLike,
  onToggleBookmark
}: CommunityFeedPageProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const likedSet = useMemo(() => new Set(likedPosts), [likedPosts]);
  const bookmarkedSet = useMemo(() => new Set(bookmarkedPosts), [bookmarkedPosts]);

  useEffect(() => {
    let isMounted = true;
    getDiscoverFeed(community.name)
      .then((data) => {
        if (!isMounted) return;
        setPosts(
          data
            .map((p) => ({
              id: p.id,
              title: p.title,
              author: p.author,
              imageUrl: p.imageUrl || '',
              content: '',
              likes: p.likes,
              comments: p.comments,
              timestamp: new Date(p.timestamp),
              tags: p.tags || [],
              communityName: p.communityName ?? undefined
            }))
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        );
      })
      .catch((e) => {
        if (isMounted) setPosts([]);
        console.error('[CommunityFeedPage] Failed to load:', e);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [community.name]);

  const trendingTopics = useMemo(() => {
    const count: Record<string, number> = {};
    posts.forEach((p) => {
      filterSemanticTags(p.tags).forEach((t) => {
        count[t] = (count[t] || 0) + 1;
      });
    });
    return Object.entries(count)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag]) => tag);
  }, [posts]);

  const handleJoinToggle = async () => {
    if (joining) return;
    setJoining(true);
    try {
      await onJoinCommunity();
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="h-screen overflow-y-auto bg-[#f5f1e8]">
      <div className="max-w-4xl mx-auto px-8 py-8">
        {/* Back Button - 旧版 UI */}
        <button
          type="button"
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

        {/* Loading State - 旧版 UI */}
        {loading && (
          <div className="bg-[#faf8f3] border-[2.5px] border-[#1a1a1a] p-12 hand-drawn-border wireframe-shadow text-center">
            <div className="animate-pulse">
              <div className="text-xl font-bold handwritten text-[#6d6d6d]">Loading community...</div>
            </div>
          </div>
        )}

        {/* Content - 仅非 loading 时展示，沿用旧版布局与样式 */}
        {!loading && (
          <>
            <div className="bg-[#faf8f3] border-[2.5px] border-[#1a1a1a] p-8 mb-8 hand-drawn-border relative overflow-visible">
              <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="flex items-center gap-6">
                  <div className="w-24 h-24 border-[3px] border-[#1a1a1a] bg-[#e8e4d9] flex items-center justify-center hand-drawn-border rotate-[-2deg]">
                    <span className="text-5xl font-black handwritten">#</span>
                  </div>
                  <div>
                    <h1 className="text-4xl font-black handwritten capitalize mb-2">{community.name}</h1>
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
                        {(community.stats?.members ?? 0).toLocaleString()} Members
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleJoinToggle}
                  disabled={joining}
                  className={`px-8 py-3 font-bold handwritten text-lg border-[2px] border-[#1a1a1a] transition-all hand-drawn-border hover:shadow-lg ${
                    isJoined
                      ? 'bg-[#e8e4d9] text-[#1a1a1a]'
                      : 'bg-[#1a1a1a] text-[#faf8f3] hover:-translate-y-1'
                  } ${joining ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {joining ? 'Loading...' : isJoined ? 'Unfollow' : 'Follow'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <h2 className="text-xl font-bold handwritten mb-2">Latest Discussions</h2>

                {posts.length === 0 ? (
                  <div className="bg-[#faf8f3] border-[2px] border-[#1a1a1a] p-12 hand-drawn-border text-center rounded-sm">
                    <p className="text-[#6d6d6d] font-sans">No posts in this community yet.</p>
                  </div>
                ) : (
                  posts.map((post) => (
                    <article
                      key={post.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => onSelectPost(post.id)}
                      onKeyDown={(e) => e.key === 'Enter' && onSelectPost(post.id)}
                      className="bg-[#faf8f3] border-[2px] border-[#1a1a1a] p-6 hand-drawn-border relative hover:border-[#1a1a1a] transition-colors cursor-pointer"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 border-[2px] border-[#1a1a1a] rounded-full flex items-center justify-center hand-drawn-border bg-[#e8e4d9] shrink-0">
                          <span className="font-bold handwritten">{post.author.name[0]}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-bold handwritten text-lg leading-none">{post.author.name}</p>
                              <span className="text-xs text-[#6d6d6d]">{formatTimestamp(post.timestamp)}</span>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleBookmark(post.id);
                              }}
                              className={`p-1 rounded ${bookmarkedSet.has(post.id) ? 'text-[#1a1a1a]' : 'text-[#1a1a1a]/40 hover:text-[#1a1a1a]'}`}
                              aria-label="Bookmark"
                            >
                              <svg width="20" height="20" viewBox="0 0 24 24" fill={bookmarkedSet.has(post.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                              </svg>
                            </button>
                          </div>

                          <p className="mt-3 text-[#1a1a1a] font-sans text-lg leading-relaxed">{post.title}</p>

                          <div className="mt-4 flex flex-wrap gap-2">
                            {filterSemanticTags(post.tags).map((tag) => (
                              <span key={tag} className="text-xs px-2 py-1 bg-[#e8e4d9] rounded-sm handwritten border border-[#1a1a1a]/10">
                                #{tag}
                              </span>
                            ))}
                          </div>

                          <div className="mt-4 pt-3 border-t border-[#1a1a1a]/10 flex items-center gap-6">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleLike(post.id);
                              }}
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
                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                              </svg>
                              {post.likes}
                            </button>
                            <span className="flex items-center gap-2 text-sm font-bold handwritten text-[#1a1a1a]/70">
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
                                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                              </svg>
                              {post.comments}
                            </span>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))
                )}
              </div>

              <div className="space-y-6">
                <div className="bg-[#faf8f3] border-[2px] border-[#1a1a1a] p-5 hand-drawn-border">
                  <h3 className="font-bold handwritten text-lg mb-3">About Community</h3>
                  <p className="text-sm font-sans leading-relaxed text-[#4a4a4a]">
                    {getAboutText(community.name)}
                  </p>
                  {community.createdAt && (
                  <div className="mt-4 flex items-center gap-2 text-xs font-bold handwritten text-[#6d6d6d]">
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
                    Created {new Date(community.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </div>
                  )}
                </div>

                <div className="bg-[#faf8f3] border-[2px] border-[#1a1a1a] p-5 hand-drawn-border">
                  <h3 className="font-bold handwritten text-lg mb-3">Trending Topics</h3>
                  <ul className="space-y-2">
                    {(trendingTopics.length ? trendingTopics : ['Beginner Guide', 'Showcase', 'Weekly Challenge']).map((topic, i) => (
                      <li key={topic + i} className="flex items-center gap-2 text-sm hover:underline cursor-pointer group">
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
