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
  /** Author display name for publish (used when guest has no posts yet) */
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
  /** Community category name (one of 7 fixed), for validation and filtering */
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
  /** Community creation time in DB (ISO string) for "Created MMM YYYY" display */
  createdAt?: string | null;
};

export type ApiUserState = {
  likes: string[];
  bookmarks: string[];
  followedCommunities: string[];
  joinedCommunities: string[];
};

const request = async <T>(url: string, options?: RequestInit): Promise<T> => {
  // Get guest ID and add to all requests
  const guestId = getOrCreateGuestId();
  
  const response = await fetch(url, {
    ...options,
    headers: { 
      'Content-Type': 'application/json',
      'X-Guest-ID': guestId,  // All requests carry guest ID
      ...(options?.headers || {})  // Merge custom headers
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

// Legacy: uses new /api/community/like
export const toggleCommunityLike = async (id: string) => {
  const result = await likePost(id);
  return { 
    liked: !result.alreadyLiked, 
    likes: result.likes !== null ? result.likes : undefined  // Preserve original value, do not coerce to 0
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
      readOnly: boolean;  // Read-only flag
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

// Legacy: community detail page like, uses new endpoint
export const toggleCommunityDetailLike = async (name: string, id: string) => {
  const result = await likePost(id);
  return { 
    liked: !result.alreadyLiked, 
    likes: result.likes !== null ? result.likes : undefined
  };
};

// Deprecated: frontend maintains messages, no longer reads from backend
export const getChatMessages = (conversationId?: string) => 
  Promise.resolve([]);  // Return empty array

/**
 * Load session messages from DB (new architecture)
 * @param sessionId - Session ID
 * @returns Message array
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
 * Save message to DB (new architecture)
 * @param sessionId - Session ID
 * @param message - Single message
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
    // Do not throw, fail silently
  }
};

export const sendChatMessage = (text: string, sessionId: string) => {
  // New arch: no longer send messages array, backend reads from DB
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
 * Get all chat sessions list
 * @returns Session array
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
  // New arch: only send kind and sessionId, backend gets messages from DB
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

// ============ Guest-first Demo APIs ============

/**
 * Save to Archive (Guest can also save)
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
 * Publish to Community (Guest can also publish)
 * Uses unified route /api/community?action=publish
 */
export const publishToCommunity = (payload: {
  sessionId?: string;  // Required: use sessionId to reference archive
  historyId?: string;  // Compat field
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
    '/api/community?action=publish',  // Unified route
    {
      method: 'POST',
      body: JSON.stringify(payload)
    }
  );

/**
 * Like post (Guest can also like, idempotent)
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
 * Unlike post
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
 * Get Discover Feed (optionally filter by community)
 * @param community - When set (e.g. Entertainment), returns only that community's posts
 */
export const getDiscoverFeed = async (community?: string): Promise<ApiCommunityPost[]> => {
  try {
    const url = community?.trim()
      ? `/api/community?discover=true&community=${encodeURIComponent(community.trim())}`
      : '/api/community?discover=true';
    const result = await request<ApiCommunityPost[] | { posts: ApiCommunityPost[], error?: string }>(url);
    
    // Handle backend error format {posts: [], error: ...}
    if (result && typeof result === 'object' && 'posts' in result) {
      if (result.error) {
        console.error('[getDiscoverFeed] Backend error:', result.error);
      }
      return result.posts || [];
    }
    
    // Return array normally
    return Array.isArray(result) ? result : [];
  } catch (error) {
    console.error('[getDiscoverFeed] Request failed:', error);
    // Do not throw, return empty array
    return [];
  }
};

