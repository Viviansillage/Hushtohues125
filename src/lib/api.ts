export type ApiChatMessage = {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: string;
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
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
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

export const updateHistoryItem = (id: string, payload: Partial<ApiHistoryItem>) =>
  request<ApiHistoryItem>(`/api/history/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });

export const getCommunityPosts = () => request<ApiCommunityPost[]>('/api/community/posts');

export const toggleCommunityLike = (id: string) =>
  request<{ liked: boolean; likes: number }>(`/api/community/posts/${id}/like`, {
    method: 'POST'
  });

export const toggleCommunityBookmark = (id: string) =>
  request<{ bookmarked: boolean }>(`/api/community/posts/${id}/bookmark`, {
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
  }>(`/api/community/follow/${name}`, { method: 'POST' });

export const unfollowCommunity = (name: string) =>
  request<{
    followed: ApiCommunityTag[];
    recommended: ApiCommunityTag[];
    user: ApiUserState;
  }>(`/api/community/unfollow/${name}`, { method: 'POST' });

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
  request<{ joined: boolean }>(`/api/community/${name}/join`, { method: 'POST' });

export const toggleCommunityDetailLike = (name: string, id: string) =>
  request<{ liked: boolean; likes: number }>(`/api/community/${name}/posts/${id}/like`, {
    method: 'POST'
  });

export const getChatMessages = () => request<ApiChatMessage[]>('/api/chat/messages');

export const sendChatMessage = (text: string) =>
  request<{ messages: ApiChatMessage[] }>('/api/chat/message', {
    method: 'POST',
    body: JSON.stringify({ text })
  });

export const createChatArtifact = (kind: string) =>
  request<{ history: ApiHistoryItem; message: ApiChatMessage }>('/api/chat/artifact', {
    method: 'POST',
    body: JSON.stringify({ kind })
  });
