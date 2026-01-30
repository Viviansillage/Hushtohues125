import { createClient } from '@supabase/supabase-js';

// Vercel 会自动注入环境变量，本地开发时从 .env.local 读取
// 支持本地开发环境
if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
  try {
    const dotenv = await import('dotenv');
    dotenv.config({ path: '.env.local' });
  } catch (e) {
    // dotenv 可能不存在，忽略
  }
}

// Supabase 客户端配置
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables. Please check .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// 默认的 profile ID (用于 hackathon demo)
// 生产环境应该使用真实的用户认证
let defaultProfileId = null;

/**
 * 获取或创建默认用户配置
 */
export async function getOrCreateDefaultProfile() {
  if (defaultProfileId) return defaultProfileId;

  try {
    // 尝试获取第一个用户
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);

    if (profiles && profiles.length > 0) {
      defaultProfileId = profiles[0].id;
      return defaultProfileId;
    }

    // 如果没有用户，创建默认用户
    const { data: newProfile } = await supabase
      .from('profiles')
      .insert({
        user_name: 'Demo User',
        user_handle: '@demouser',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=demo',
        preferences: {}
      })
      .select('id')
      .single();

    defaultProfileId = newProfile.id;
    return defaultProfileId;
  } catch (error) {
    console.error('Failed to get or create default profile:', error);
    throw error;
  }
}

/**
 * 获取用户配置
 */
export async function getProfile() {
  const profileId = await getOrCreateDefaultProfile();
  
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', profileId)
    .single();

  if (error) throw error;
  
  return {
    userName: data.user_name,
    userHandle: data.user_handle,
    avatar: data.avatar,
    preferences: data.preferences || {}
  };
}

/**
 * 更新用户配置
 */
export async function updateProfile(updates) {
  const profileId = await getOrCreateDefaultProfile();
  
  const dbUpdates = {};
  if (updates.userName) dbUpdates.user_name = updates.userName;
  if (updates.userHandle) dbUpdates.user_handle = updates.userHandle;
  if (updates.avatar) dbUpdates.avatar = updates.avatar;
  if (updates.preferences) dbUpdates.preferences = updates.preferences;
  
  dbUpdates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('profiles')
    .update(dbUpdates)
    .eq('id', profileId)
    .select()
    .single();

  if (error) throw error;
  
  return {
    userName: data.user_name,
    userHandle: data.user_handle,
    avatar: data.avatar,
    preferences: data.preferences || {}
  };
}

/**
 * 获取聊天历史
 */
export async function getHistory() {
  const profileId = await getOrCreateDefaultProfile();
  
  const { data, error } = await supabase
    .from('chat_history')
    .select('*')
    .eq('profile_id', profileId)
    .order('timestamp', { ascending: false });

  if (error) throw error;
  
  return data.map(item => ({
    id: item.id,
    title: item.title,
    messageCount: item.message_count,
    lastMessage: item.last_message,
    previewImages: item.preview_images || [],
    isPublic: item.is_public,
    tags: item.tags || [],
    timestamp: item.timestamp
  }));
}

/**
 * 创建聊天历史
 */
export async function createHistory(historyData) {
  const profileId = await getOrCreateDefaultProfile();
  
  const { data, error } = await supabase
    .from('chat_history')
    .insert({
      profile_id: profileId,
      title: historyData.title,
      message_count: historyData.messageCount || 0,
      last_message: historyData.lastMessage || '',
      preview_images: historyData.previewImages || [],
      is_public: historyData.isPublic || false,
      tags: historyData.tags || [],
      timestamp: historyData.timestamp || new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw error;
  
  return {
    id: data.id,
    title: data.title,
    messageCount: data.message_count,
    lastMessage: data.last_message,
    previewImages: data.preview_images || [],
    isPublic: data.is_public,
    tags: data.tags || [],
    timestamp: data.timestamp
  };
}

/**
 * 更新聊天历史
 */
export async function updateHistory(id, updates) {
  const dbUpdates = {};
  if (updates.title !== undefined) dbUpdates.title = updates.title;
  if (updates.messageCount !== undefined) dbUpdates.message_count = updates.messageCount;
  if (updates.lastMessage !== undefined) dbUpdates.last_message = updates.lastMessage;
  if (updates.previewImages !== undefined) dbUpdates.preview_images = updates.previewImages;
  if (updates.isPublic !== undefined) dbUpdates.is_public = updates.isPublic;
  if (updates.tags !== undefined) dbUpdates.tags = updates.tags;
  if (updates.timestamp !== undefined) dbUpdates.timestamp = updates.timestamp;
  
  dbUpdates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('chat_history')
    .update(dbUpdates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  
  return {
    id: data.id,
    title: data.title,
    messageCount: data.message_count,
    lastMessage: data.last_message,
    previewImages: data.preview_images || [],
    isPublic: data.is_public,
    tags: data.tags || [],
    timestamp: data.timestamp
  };
}

/**
 * 删除聊天历史
 */
export async function deleteHistory(id) {
  const { error } = await supabase
    .from('chat_history')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

/**
 * 获取社区帖子
 */
export async function getCommunityPosts() {
  const { data, error } = await supabase
    .from('community_posts')
    .select('*')
    .order('timestamp', { ascending: false });

  if (error) throw error;
  
  return data.map(post => ({
    id: post.id,
    title: post.title,
    author: { name: post.author_name },
    imageUrl: post.image_url,
    content: post.content,
    likes: post.likes,
    comments: post.comments,
    tags: post.tags || [],
    timestamp: post.timestamp
  }));
}

/**
 * 创建社区帖子
 */
export async function createCommunityPost(postData) {
  const { data, error } = await supabase
    .from('community_posts')
    .insert({
      title: postData.title,
      author_name: postData.authorName,
      image_url: postData.imageUrl,
      content: postData.content,
      likes: 0,
      comments: 0,
      tags: postData.tags || [],
      timestamp: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw error;
  
  return {
    id: data.id,
    title: data.title,
    author: { name: data.author_name },
    imageUrl: data.image_url,
    content: data.content,
    likes: data.likes,
    comments: data.comments,
    tags: data.tags || [],
    timestamp: data.timestamp
  };
}

/**
 * 更新社区帖子点赞数
 */
export async function updatePostLikes(postId, likes) {
  const { error } = await supabase
    .from('community_posts')
    .update({ likes })
    .eq('id', postId);

  if (error) throw error;
}

/**
 * 获取社区标签
 */
export async function getCommunityTags() {
  const [tagsResult, postsResult] = await Promise.all([
    supabase.from('community_tags').select('*').order('member_count', { ascending: false }),
    supabase.from('community_posts').select('id, tags')
  ]);

  if (tagsResult.error) throw tagsResult.error;
  
  const allPosts = postsResult.data || [];
  
  return tagsResult.data.map(tag => {
    // 统计包含此标签的帖子数量
    const tagPosts = allPosts.filter(post => post.tags && post.tags.includes(tag.name));
    const totalPosts = tagPosts.length;
    
    return {
      name: tag.name,
      icon: tag.icon,
      color: tag.color,
      memberCount: tag.member_count,
      stats: {
        totalPosts: totalPosts,
        members: tag.member_count || 0,
        online: Math.floor((tag.member_count || 0) * 0.1),
        postsToday: Math.floor(totalPosts * 0.1)
      },
      trending: []
    };
  });
}

/**
 * 获取用户关注的社区
 */
export async function getFollowedCommunities() {
  const profileId = await getOrCreateDefaultProfile();
  
  const [followedResult, postsResult] = await Promise.all([
    supabase.from('user_followed_communities').select('community_tags(*)').eq('profile_id', profileId),
    supabase.from('community_posts').select('id, tags')
  ]);

  if (followedResult.error) throw followedResult.error;
  
  const allPosts = postsResult.data || [];
  
  return followedResult.data.map(item => {
    const tag = item.community_tags;
    // 统计包含此标签的帖子数量
    const tagPosts = allPosts.filter(post => post.tags && post.tags.includes(tag.name));
    const totalPosts = tagPosts.length;
    
    return {
      name: tag.name,
      icon: tag.icon,
      color: tag.color,
      memberCount: tag.member_count,
      stats: {
        totalPosts: totalPosts,
        members: tag.member_count || 0,
        online: Math.floor((tag.member_count || 0) * 0.1),
        postsToday: Math.floor(totalPosts * 0.1)
      },
      trending: []
    };
  });
}

/**
 * 关注社区
 */
export async function followCommunity(tagName) {
  const profileId = await getOrCreateDefaultProfile();
  
  // 获取社区标签ID
  const { data: tag } = await supabase
    .from('community_tags')
    .select('id')
    .eq('name', tagName)
    .single();

  if (!tag) throw new Error('Community tag not found');

  const { error } = await supabase
    .from('user_followed_communities')
    .insert({
      profile_id: profileId,
      community_tag_id: tag.id
    });

  if (error && error.code !== '23505') throw error; // 忽略重复插入错误
}

/**
 * 取消关注社区
 */
export async function unfollowCommunity(tagName) {
  const profileId = await getOrCreateDefaultProfile();
  
  // 获取社区标签ID
  const { data: tag } = await supabase
    .from('community_tags')
    .select('id')
    .eq('name', tagName)
    .single();

  if (!tag) throw new Error('Community tag not found');

  const { error } = await supabase
    .from('user_followed_communities')
    .delete()
    .eq('profile_id', profileId)
    .eq('community_tag_id', tag.id);

  if (error) throw error;
}

/**
 * 获取用户点赞列表
 */
export async function getUserLikes() {
  const profileId = await getOrCreateDefaultProfile();
  
  const { data, error } = await supabase
    .from('user_likes')
    .select('target_type, target_id')
    .eq('profile_id', profileId);

  if (error) throw error;
  
  return data.map(like => `${like.target_type}:${like.target_id}`);
}

/**
 * 切换点赞状态
 */
export async function toggleLike(targetType, targetId) {
  const profileId = await getOrCreateDefaultProfile();
  
  // 检查是否已点赞
  const { data: existing } = await supabase
    .from('user_likes')
    .select('id')
    .eq('profile_id', profileId)
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .single();

  if (existing) {
    // 取消点赞
    await supabase
      .from('user_likes')
      .delete()
      .eq('id', existing.id);
    return false;
  } else {
    // 添加点赞
    await supabase
      .from('user_likes')
      .insert({
        profile_id: profileId,
        target_type: targetType,
        target_id: targetId
      });
    return true;
  }
}

/**
 * 获取用户收藏列表
 */
export async function getUserBookmarks() {
  const profileId = await getOrCreateDefaultProfile();
  
  const { data, error } = await supabase
    .from('user_bookmarks')
    .select('post_id')
    .eq('profile_id', profileId);

  if (error) throw error;
  
  return data.map(bookmark => bookmark.post_id);
}

/**
 * 切换收藏状态
 */
export async function toggleBookmark(postId) {
  const profileId = await getOrCreateDefaultProfile();
  
  // 检查是否已收藏
  const { data: existing } = await supabase
    .from('user_bookmarks')
    .select('id')
    .eq('profile_id', profileId)
    .eq('post_id', postId)
    .single();

  if (existing) {
    // 取消收藏
    await supabase
      .from('user_bookmarks')
      .delete()
      .eq('id', existing.id);
    return false;
  } else {
    // 添加收藏
    await supabase
      .from('user_bookmarks')
      .insert({
        profile_id: profileId,
        post_id: postId
      });
    return true;
  }
}
