import { getOrCreateGuestId } from './guest';

export type ApiChatMessage = {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: string;
};

export type ApiStructuredData = {
  title: string;
  summary: string;
  tags: string[];
  mindmap: {
    root: string;
    branches: Array<{
      label: string;
      children: string[];
    }>;
  };
};

export type ApiProfile = {
  userName: string;
  userHandle: string;
  avatar: string;
  preferences: {
    emailNotifications: boolean;
    saveHistory: boolean;
    publicProfile: boolean;
  };
  isGuest?: boolean;
};

export type ApiHistoryItem = {
  id: string;
  title: string;
  messageCount: number;
  lastMessage: string;
  timestamp: string;
  previewImages: string[];
  isPublic: boolean;
  tags: string[];
};

export type ApiCommunityPost = {
  id: string;
  title: string;
  author: {
    name: string;
  };
  imageUrl: string;
  content: string;
  likes: number;
  comments: number;
  timestamp: string;
  tags: string[];
};

export type ApiCommunityTag = {
  name: string;
  stats: {
    totalPosts: number;
    members: number;
    online: number;
    postsToday: number;
  };
  trending: string[];
};

export type ApiUserState = {
  likes: string[];
  bookmarks: string[];
  followedCommunities: string[];
  joinedCommunities: string[];
};

const request = async <T>(url: string, options?: RequestInit): Promise<T> => {
  // 获取 guest ID 并添加到所有请求
  const guestId = getOrCreateGuestId();
  
  const response = await fetch(url, {
    ...options,
    headers: { 
      'Content-Type': 'application/json',
      'X-Guest-ID': guestId,  // 所有请求自动携带 guest ID
      ...(options?.headers || {})  // 合并用户自定义 headers
    }
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
};

export const getProfile = () => request<ApiProfile>('/api/profile');

export const updateProfile = (payload: Partial<ApiProfile>) =>
  request<ApiProfile>('/api/profile', {
    method: 'PUT',
    body: JSON.stringify(payload)
  });

export const getHistory = () => request<ApiHistoryItem[]>('/api/history');

export const deleteHistoryItem = (id: string) =>
  request<{ success: boolean; id: string }>(`/api/history/${id}`, {
    method: 'DELETE'
  });

export const updateHistoryItem = (id: string, payload: Partial<ApiHistoryItem>) =>
  request<ApiHistoryItem>(`/api/history/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });

export const getCommunityPosts = () => request<ApiCommunityPost[]>('/api/community?posts=true');

// 旧接口：指向旧的路由（如果存在），否则改用新的 /api/community/like
export const toggleCommunityLike = async (id: string) => {
  // 直接调用新的点赞接口
  const result = await likePost(id);
  return { 
    liked: !result.alreadyLiked, 
    likes: result.likes !== null ? result.likes : undefined  // 保持原始值，不转换为 0
  };
};

export const toggleCommunityBookmark = (id: string) =>
  request<{ bookmarked: boolean }>(`/api/community?action=bookmark&postId=${id}`, {
    method: 'POST'
  });

export const getCommunityMeta = () =>
  request<{
    followed: ApiCommunityTag[];
    recommended: ApiCommunityTag[];
    user: ApiUserState;
  }>('/api/community');

export const followCommunity = (name: string) =>
  request<{
    followed: ApiCommunityTag[];
    recommended: ApiCommunityTag[];
    user: ApiUserState;
  }>('/api/community?action=follow', { 
    method: 'POST',
    body: JSON.stringify({ name })
  });

export const unfollowCommunity = (name: string) =>
  request<{
    followed: ApiCommunityTag[];
    recommended: ApiCommunityTag[];
    user: ApiUserState;
  }>('/api/community?action=unfollow', { 
    method: 'POST',
    body: JSON.stringify({ name })
  });

export const getCommunityDetail = (name: string) =>
  request<{
    name: string;
    detail: {
      members: number;
      online: number;
      posts: Array<{
        id: string;
        author: { name: string };
        content: string;
        likes: number;
        comments: number;
        timestamp: string;
        tags: string[];
      }>;
    };
    joined: boolean;
  }>(`/api/community/${name}`);

export const toggleCommunityJoin = (name: string) =>
  request<{ joined: boolean }>(`/api/community?action=join&community=${name}`, { method: 'POST' });

// 旧接口：社区详情页的点赞，指向新接口
export const toggleCommunityDetailLike = async (name: string, id: string) => {
  const result = await likePost(id);
  return { 
    liked: !result.alreadyLiked, 
    likes: result.likes !== null ? result.likes : undefined
  };
};

// 已废弃：前端自行维护 messages，不再从后端读取
export const getChatMessages = (conversationId?: string) => 
  Promise.resolve([]);  // 返回空数组

export const sendChatMessage = (text: string, messages?: ApiChatMessage[]) =>
  request<{ messages: ApiChatMessage[]; structured: ApiStructuredData }>('/api/chat?action=message', {
    method: 'POST',
    body: JSON.stringify({ text, messages })  // 传递当前 messages 作为上下文
  });

export const createChatArtifact = (kind: string, messages: ApiChatMessage[]) =>
  request<{ 
    history: ApiHistoryItem; 
    message: ApiChatMessage; 
    structuredMindmap?: any;
    generatedImage?: {
      url: string;
      title: string;
      summary: string;
      prompt: string;
    };
  }>('/api/chat?action=artifact', {
    method: 'POST',
    body: JSON.stringify({ kind, messages })  // 只传 kind 和 messages
  });

// ============ Guest-first Demo 新增 API ============

/**
 * 保存到 Archive（Guest 也可以保存）
 */
export const saveToArchive = (payload: {
  title: string;
  content: string;
  messages?: any[];
  tags?: string[];
  previewImages?: string[];
}) =>
  request<{ id: string; title: string; timestamp: string; isDemo: boolean }>(
    '/api/history',
    {
      method: 'POST',
      body: JSON.stringify(payload)
    }
  );

/**
 * 发布到 Community（Guest 也可以发布）
 */
export const publishToCommunity = (payload: {
  title: string;
  content: string;
  contentJson?: any;
  summary?: string;
  tags?: string[];
  communityName?: string;
  communityTagId?: string;
  imageUrl?: string;
  assetUrls?: string[];
}) =>
  request<{ id: string; title: string; timestamp: string; isDemo: boolean }>(
    '/api/community/publish',
    {
      method: 'POST',
      body: JSON.stringify(payload)
    }
  );

/**
 * 点赞帖子（Guest 也可以点赞，幂等）
 */
export const likePost = (postId: string) =>
  request<{ message: string; alreadyLiked: boolean; likes: number | null }>(
    '/api/community/like',
    {
      method: 'POST',
      body: JSON.stringify({ postId, targetType: 'post' })
    }
  );

/**
 * 取消点赞
 */
export const unlikePost = (postId: string) =>
  request<{ message: string; likes: number | null }>(
    '/api/community/like',
    {
      method: 'DELETE',
      body: JSON.stringify({ postId, targetType: 'post' })
    }
  );

/**
 * 获取 Discover Feed（seed 优先）
 */
export const getDiscoverFeed = () =>
  request<ApiCommunityPost[]>('/api/community?discover=true');

