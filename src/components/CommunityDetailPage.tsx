import { useEffect, useState } from 'react';
import { getCommunityDetail, followCommunity, unfollowCommunity } from '../lib/api';
import { CanvasDetail, CanvasItem } from './CanvasDetail';

interface CommunityDetailProps {
  postId: string;  // ✅ community_posts.id (uuid)
  onBack: () => void;
}

export function CommunityDetailPage({ postId, onBack }: CommunityDetailProps) {
  const [isJoined, setIsJoined] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canvasData, setCanvasData] = useState<CanvasItem | null>(null);
  const [communityName, setCommunityName] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        console.log('[CommunityDetailPage] Loading post, postId (community_posts.id):', postId);
        
        const response = await getCommunityDetail(postId);
        if (!isMounted) return;
        
        console.log('[CommunityDetailPage] ✅ Loaded:', { 
          title: response.detail.title,
          joined: response.joined,
          readOnly: response.detail.readOnly
        });

        const item: CanvasItem = {
          id: response.detail.sessionId,
          title: response.detail.title,
          images: response.detail.images || [],
          mindmaps: response.detail.mindmaps || [],
          content: response.detail.content || '',
          tags: response.detail.tags || [],
          isPublic: response.detail.isPublic,
          author: response.detail.author,
          stats: response.detail.stats
        };

        setCanvasData(item);
        setIsJoined(response.joined);
        setCommunityName(response.detail.communityName || item.tags?.[0] || 'General');
        
      } catch (error) {
        console.error('[CommunityDetailPage] ❌ Failed to load, postId:', postId, 'error:', error);
        if (isMounted) {
          const errorMsg = error instanceof Error ? error.message : 'Failed to load community details';
          setError(`Post not found or not public. ${errorMsg}`);
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
  }, [postId]);

  const handleFollowToggle = async () => {
    if (isJoining || !canvasData || !communityName) return;
    
    const previousState = isJoined;
    setIsJoining(true);
    
    try {
      setIsJoined(!isJoined);
      
      if (isJoined) {
        await unfollowCommunity(communityName);
        console.log('[CommunityDetail] Unfollowed:', communityName);
      } else {
        await followCommunity(communityName);
        console.log('[CommunityDetail] Followed:', communityName);
      }
      
    } catch (error) {
      console.error('[CommunityDetail] Failed to toggle follow:', error);
      setIsJoined(previousState);
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to update follow status';
      alert(`Error: ${errorMessage}. Please try again.`);
    } finally {
      setIsJoining(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#faf8f3]">
        <div className="handwritten text-2xl">Loading community post...</div>
      </div>
    );
  }

  if (error || !canvasData) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#faf8f3] p-8">
        <div className="text-red-600 font-bold handwritten text-xl mb-4">Failed to load</div>
        <div className="text-[#6d6d6d] handwritten mb-6">{error || 'Content not found'}</div>
        <button
          onClick={onBack}
          className="px-6 py-2 bg-[#1a1a1a] text-[#faf8f3] font-bold handwritten border-[2px] border-[#1a1a1a] hand-drawn-border hover:opacity-80"
        >
          ← Back to Community
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute top-4 right-4 z-50 flex items-center gap-4">
        <button
          onClick={handleFollowToggle}
          disabled={isJoining}
          className={`px-6 py-2 font-bold handwritten border-[2px] border-[#1a1a1a] hand-drawn-border transition-all ${
            isJoined
              ? 'bg-[#e8e4d9] text-[#1a1a1a]'
              : 'bg-[#1a1a1a] text-[#faf8f3] hover:-translate-y-1'
          } ${isJoining ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isJoining ? 'Loading...' : isJoined ? 'Unfollow' : 'Follow'}
        </button>
      </div>

      <CanvasDetail 
        item={canvasData} 
        onClose={onBack}
        readOnly={true}
      />
    </div>
  );
}
