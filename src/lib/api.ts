import { getOrCreateGuestId, sanitizeForApiRequest } from './guest';

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
  sessionId: string;  // ✅ chat_history.session_id
  title: string;
  messageCount: number;
  lastMessage: string;
  timestamp: string;
  previewImages: string[];
  isPublic: boolean;
  tags: string[];
  contentJson?: any;
  /** 发布时传入的作者昵称，供无帖子的 guest 首次发布使用 */
  authorDisplayName?: string;
};

export type ApiCommunityPost = {
  id: string;  // ✅ community_posts.id (uuid) - ONLY valid identifier
  title: string;
  author: {
    name: string;
    type?: string;
    id?: string;
  };
  imageUrl: string | null;
  likes: number;
  comments: number;
  timestamp: string;
  tags: string[];
  /** 分区名称（7 个固定分区之一），用于验证与筛选 */
  communityName?: string | null;
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
  /** 分区在数据库中的创建时间 (ISO string)，用于展示 "Created MMM YYYY" */
  createdAt?: string | null;
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
  request<{ success: boolean; id: string }>(`/api/history?id=${id}`, {
    method: 'DELETE'
  });

export const updateHistoryItem = (id: string, payload: Partial<ApiHistoryItem>) =>
  request<ApiHistoryItem>(`/api/history?id=${id}`, {
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

export const getCommunityDetail = (postId: string) =>
  request<{
    post?: {
      id: string;
      historyId: string;
      authorId: string;
      createdAt: string;
    };
    detail: {
      postId: string;
      historyId?: string;
      sessionId: string;
      title: string;
      author: { name: string; type: string; id: string };
      images: string[];
      mindmaps?: Array<{ mermaidCode: string; title?: string; summary?: string }>;
      messages?: Array<{ sender: string; text: string; timestamp: string }>;
      content: string;
      contentJson?: any;  // ✅ Add contentJson with layout info
      tags: string[];
      isPublic: boolean;
      readOnly: boolean;  // ✅ 只读标记
      stats: {
        likes: number;
        comments: number;
        views: number;
      };
      timestamp: string;
      communityName: string | null;
    };
    joined: boolean;
  }>(`/api/community?action=detail&postId=${encodeURIComponent(postId)}`);

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

/**
 * 从数据库加载会话消息（新架构）
 * @param sessionId - 会话ID
 * @returns 消息数组
 */
export const loadMessagesFromDB = async (sessionId: string): Promise<ApiChatMessage[]> => {
  try {
    const response = await request<{ messages: ApiChatMessage[] }>(`/api/chat?action=load&sessionId=${sessionId}`);
    console.log('[loadMessagesFromDB] ✅ Loaded:', { sessionId, count: response.messages?.length || 0 });
    return response.messages || [];
  } catch (error) {
    console.error('[loadMessagesFromDB] Error:', error);
    return [];
  }
};

/**
 * 保存消息到数据库（新架构）
 * @param sessionId - 会话ID
 * @param message - 单条消息
 */
export const saveMessageToDB = async (sessionId: string, message: ApiChatMessage): Promise<void> => {
  try {
    await request('/api/chat?action=save', {
      method: 'POST',
      body: JSON.stringify({ sessionId, message })
    });
    console.log('[saveMessageToDB] ✅ Saved:', { sessionId, messageId: message.id });
  } catch (error) {
    console.error('[saveMessageToDB] Error:', error);
    // 不抛出错误，静默失败
  }
};

export const sendChatMessage = (text: string, sessionId: string) => {
  // 新架构：不再发送messages数组，后端从DB获取
  const payload = { text, sessionId };
  const payloadStr = JSON.stringify(payload);
  const sizeKB = new Blob([payloadStr]).size / 1024;
  
  console.log('📤 Sending message:', {
    sessionId,
    payloadSize: sizeKB.toFixed(1) + 'KB'
  });
  
  return request<{ 
    messages: ApiChatMessage[]; 
    structured: ApiStructuredData;
    provider?: string;  // AI provider (e.g., 'Google Gemini')
    model?: string;     // Model name (e.g., 'gemini-2.5-flash')
  }>('/api/chat?action=message', {
    method: 'POST',
    body: payloadStr
  });
};

/**
 * 获取所有聊天会话列表
 * @returns 会话数组
 */
export const getChatSessions = () => request<{ 
  sessions: Array<{
    id: string;
    sessionId: string;
    title: string;
    preview: string;
    messageCount: number;
    timestamp: string;
  }>
}>('/api/chat?action=sessions')
  .then(res => res.sessions || [])
  .catch(error => {
    console.error('[getChatSessions] Error:', error);
    return [];
  });

export const createChatArtifact = (
  kind: string,
  sessionId: string
) => {
  // 新架构：只发送kind和sessionId，后端从DB获取messages
  const payload = { kind, sessionId };
  const payloadStr = JSON.stringify(payload);
  const sizeKB = new Blob([payloadStr]).size / 1024;
  
  console.log('📤 Creating artifact:', {
    kind,
    sessionId,
    payloadSize: sizeKB.toFixed(1) + 'KB'
  });
  
  return request<{ 
    history: ApiHistoryItem; 
    message: ApiChatMessage; 
    structuredMindmap?: any;
    artifact?: {
      type: 'image' | 'mindmap' | 'save';
      imageUrl?: string;
      storagePath?: string;
      title?: string;
      summary?: string;
      prompt?: string;
      provider?: string;
      model?: string;
      mermaidCode?: string;
    };
    generatedImage?: {
      imageUrl: string;
      title?: string;
      summary?: string;
      prompt?: string;
      provider?: string;
      model?: string;
    };
  }>('/api/chat?action=artifact', {
    method: 'POST',
    body: payloadStr
  });
};

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
 * ✅ 使用统一路由 /api/community?action=publish
 */
export const publishToCommunity = (payload: {
  sessionId?: string;  // ✅ 必须：使用 sessionId 引用 archive
  historyId?: string;  // 兼容字段
  title?: string;
  content?: string;
  contentJson?: any;
  summary?: string;
  tags?: string[];
  communityName?: string;
  communityTagId?: string;
  imageUrl?: string;
  assetUrls?: string[];
}) =>
  request<{ ok: boolean; postId: string; id: string; sessionId: string; timestamp: string }>(
    '/api/community?action=publish',  // ✅ 统一路由
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
 * 获取 Discover Feed（可选按分区筛选）
 * @param community - 分区名称（如 Entertainment）时只返回该分区的帖子
 */
export const getDiscoverFeed = async (community?: string): Promise<ApiCommunityPost[]> => {
  try {
    const url = community?.trim()
      ? `/api/community?discover=true&community=${encodeURIComponent(community.trim())}`
      : '/api/community?discover=true';
    const result = await request<ApiCommunityPost[] | { posts: ApiCommunityPost[], error?: string }>(url);
    
    // ✅ 处理后端返回的错误格式 {posts: [], error: ...}
    if (result && typeof result === 'object' && 'posts' in result) {
      if (result.error) {
        console.error('[getDiscoverFeed] Backend error:', result.error);
      }
      return result.posts || [];
    }
    
    // 正常返回数组
    return Array.isArray(result) ? result : [];
  } catch (error) {
    console.error('[getDiscoverFeed] Request failed:', error);
    // ✅ 不 throw，返回空数组
    return [];
  }
};

