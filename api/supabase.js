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
  
  return (data || []).map(post => ({
    id: post.id,
    title: post.title,
    author: { name: post.author_name || 'Anonymous' }, // 修复：转换为对象
    imageUrl: post.image_url,
    content: post.content,
    likes: post.likes || 0,
    comments: post.comments || 0,
    timestamp: post.timestamp,
    tags: post.tags || []
  }));
}

export async function getCommunityMeta() {
  const profileId = await getOrCreateDefaultProfile();
  
  // 辅助函数：确保 tag 有完整结构
  const ensureTagStructure = (tag, name) => {
    if (!name) return null;
    return {
      name: name,
      stats: {
        totalPosts: tag?.total_posts || Math.floor(Math.random() * 1000) + 100,
        members: tag?.member_count || Math.floor(Math.random() * 5000) + 500,
        online: Math.floor(Math.random() * 100) + 10,
        postsToday: Math.floor(Math.random() * 50) + 5
      },
      trending: ['#creative', '#design', '#art']
    };
  };
  
  try {
    // 查询所有社区标签
    const { data: allTags, error: tagsError } = await supabase
      .from('community_tags')
      .select('*')
      .order('member_count', { ascending: false });
    
    if (tagsError) throw tagsError;
    
    // 查询用户关注的社区
    const { data: followedData, error: followedError } = await supabase
      .from('user_followed_communities')
      .select('community_tags(*)')
      .eq('profile_id', profileId);
    
    if (followedError) throw followedError;
    
    // 查询用户点赞和收藏
    const { data: likesData, error: likesError } = await supabase
      .from('user_likes')
      .select('target_id')
      .eq('profile_id', profileId);
    
    if (likesError) throw likesError;
    
    const { data: bookmarksData, error: bookmarksError } = await supabase
      .from('user_bookmarks')
      .select('post_id')
      .eq('profile_id', profileId);
    
    if (bookmarksError) throw bookmarksError;
    
    // 构造所有社区数据
    const formattedTags = (allTags || [])
      .map(tag => ensureTagStructure(tag, tag.name))
      .filter(Boolean);
    
    // 获取用户关注的社区
    const followed = (followedData || [])
      .map(item => ensureTagStructure(item.community_tags, item.community_tags?.name))
      .filter(Boolean);
    
    const followedNames = followed.map(t => t.name);
    const recommended = formattedTags.filter(t => !followedNames.includes(t.name));
    
    console.log('Community meta:', { 
      followedCount: followed.length, 
      recommendedCount: recommended.length,
      sampleRecommended: recommended[0]
    });
    
    return {
      followed,
      recommended,
      user: {
        likes: (likesData || []).map(l => l.target_id),
        bookmarks: (bookmarksData || []).map(b => b.post_id)
      }
    };
  } catch (error) {
    console.error('getCommunityMeta error:', error);
    // 返回空数据而不是抛出错误，避免前端崩溃
    return {
      followed: [],
      recommended: [],
      user: {
        likes: [],
        bookmarks: []
      }
    };
  }
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
