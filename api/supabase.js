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
    author: post.author,
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
  
  const [tags, profile] = await Promise.all([
    supabase.from('community_tags').select('*'),
    supabase.from('profiles').select('followed_communities, liked_posts, bookmarked_posts').eq('id', profileId).single()
  ]);

  const allTags = tags.data || [];
  const userFollowed = profile.data?.followed_communities || [];
  
  return {
    followed: allTags.filter(t => userFollowed.includes(t.name)),
    recommended: allTags.filter(t => !userFollowed.includes(t.name)),
    user: {
      likes: profile.data?.liked_posts || [],
      bookmarks: profile.data?.bookmarked_posts || []
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
