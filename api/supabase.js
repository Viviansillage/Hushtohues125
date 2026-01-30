import { createClient } from '@supabase/supabase-js';

// Vercel 会自动注入环境变量
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials:', { 
    hasUrl: !!supabaseUrl, 
    hasKey: !!supabaseKey 
  });
}

export const supabase = createClient(supabaseUrl, supabaseKey);

let defaultProfileId = null;

export async function getOrCreateDefaultProfile() {
  if (defaultProfileId) return defaultProfileId;

  try {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);

    if (profiles && profiles.length > 0) {
      defaultProfileId = profiles[0].id;
      return defaultProfileId;
    }

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

export async function getCommunityPosts() {
  const { data, error } = await supabase
    .from('community_posts')
    .select('*')
    .order('timestamp', { ascending: false });

  if (error) throw error;
  
  return data.map(post => ({
    id: post.id,
    title: post.title,
    author: {
      name: post.author_name
    },
    imageUrl: post.image_url,
    content: post.content,
    likes: post.likes,
    comments: post.comments,
    timestamp: post.timestamp,
    tags: post.tags || []
  }));
}

export async function getCommunityMeta() {
  const profileId = await getOrCreateDefaultProfile();
  
  const [tags, followedRels, likes, bookmarks, posts] = await Promise.all([
    supabase.from('community_tags').select('*'),
    supabase.from('user_followed_communities').select('community_tag_id, community_tags(name)').eq('profile_id', profileId),
    supabase.from('user_likes').select('target_id').eq('profile_id', profileId).eq('target_type', 'post'),
    supabase.from('user_bookmarks').select('post_id').eq('profile_id', profileId),
    supabase.from('community_posts').select('id, tags')
  ]);

  const allTags = tags.data || [];
  const userFollowedNames = (followedRels.data || [])
    .filter(rel => rel.community_tags)
    .map(rel => rel.community_tags.name);
  const allPosts = posts.data || [];
  
  // 计算每个tag的统计数据
  const formatTag = (tag) => {
    // 统计包含此标签的帖子数量
    const tagPosts = allPosts.filter(post => post.tags && post.tags.includes(tag.name));
    const totalPosts = tagPosts.length;
    
    return {
      name: tag.name,
      stats: {
        totalPosts: totalPosts,
        members: tag.member_count || 0,
        online: Math.floor((tag.member_count || 0) * 0.1), // 假设10%在线
        postsToday: Math.floor(totalPosts * 0.1) // 假设10%是今天的
      },
      trending: [] // 可以后续添加热门话题
    };
  };
  
  return {
    followed: allTags.filter(t => userFollowedNames.includes(t.name)).map(formatTag),
    recommended: allTags.filter(t => !userFollowedNames.includes(t.name)).map(formatTag),
    user: {
      likes: (likes.data || []).map(l => l.target_id),
      bookmarks: (bookmarks.data || []).map(b => b.post_id)
    }
  };
}

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
