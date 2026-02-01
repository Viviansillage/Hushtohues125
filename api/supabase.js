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

/**
 * 上传图片到 Supabase Storage
 * @param {string} base64Data - Base64 编码的图片数据（不含 data:image/... 前缀）
 * @param {string} mimeType - 图片 MIME 类型（如 image/png）
 * @param {object} metadata - 元数据 {prompt, sessionId, actor}
 * @returns {Promise<{publicUrl: string, storagePath: string}>}
 */
export async function uploadImageToStorage(base64Data, mimeType = 'image/png', metadata = {}) {
  try {
    // 1. 将 base64 转为 Buffer
    const buffer = Buffer.from(base64Data, 'base64');
    
    // 2. 生成唯一文件名
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    const ext = mimeType.split('/')[1] || 'png';
    const fileName = `${timestamp}-${random}.${ext}`;
    
    // 3. 构建存储路径（按日期分组）
    const date = new Date();
    const dateFolder = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}`;
    const storagePath = `artifacts/${dateFolder}/${fileName}`;
    
    console.log('[Storage] Uploading image:', {
      storagePath,
      size: buffer.length,
      mimeType,
      metadata: Object.keys(metadata)
    });
    
    // 4. 上传到 Supabase Storage
    const { data, error } = await supabase.storage
      .from('artifacts')  // bucket 名称
      .upload(storagePath, buffer, {
        contentType: mimeType,
        cacheControl: '3600',
        upsert: false,  // 不覆盖已存在文件
        metadata: {
          prompt: metadata.prompt?.substring(0, 500) || '',
          sessionId: metadata.sessionId || '',
          actorType: metadata.actor?.type || 'guest',
          actorId: metadata.actor?.id || '',
          createdAt: new Date().toISOString()
        }
      });
    
    if (error) {
      console.error('[Storage] Upload failed:', error);
      throw new Error(`Storage upload failed: ${error.message}`);
    }
    
    // 5. 获取公开访问 URL
    const { data: { publicUrl } } = supabase.storage
      .from('artifacts')
      .getPublicUrl(storagePath);
    
    console.log('[Storage] ✅ Upload success:', {
      publicUrl,
      storagePath,
      size: buffer.length
    });
    
    return { publicUrl, storagePath };
    
  } catch (error) {
    console.error('[Storage] Upload error:', error);
    throw error;
  }
}

let defaultProfileId = null;

/**
 * 从请求中解析 actor（用户或访客）
 * @param {Request} req - HTTP 请求对象
 * @returns {{ type: 'user' | 'guest', id: string }} actor 对象
 */
export function getActor(req) {
  // 优先检查是否有已登录用户（未来扩展 Supabase Auth）
  // const userId = req.headers['x-user-id'];
  // if (userId) {
  //   return { type: 'user', id: userId };
  // }
  
  // 从 header 读取 guest_id（统一使用小写）
  // Vercel 可能将 header 转为数组，需要处理
  let guestId = req.headers['x-guest-id'];
  if (Array.isArray(guestId)) {
    guestId = guestId[0];
  }
  
  if (guestId) {
    return { type: 'guest', id: guestId };
  }
  
  // 降级：生成临时 guest ID（不推荐，应由前端生成）
  const tempGuestId = `guest-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  console.warn('No guest_id in request, using temporary:', tempGuestId);
  return { type: 'guest', id: tempGuestId };
}

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

/**
 * 保存消息到数据库
 * @param {string} sessionId - 会话ID
 * @param {object} message - 消息对象 { id, text, sender, timestamp }
 * @param {object} actor - 用户对象 { type, id }
 */
export async function saveMessage(sessionId, message, actor) {
  try {
    // 1. 确保chat_session存在
    const { data: session, error: sessionError } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .maybeSingle();
    
    if (sessionError) throw sessionError;
    
    if (!session) {
      // 创建新session
      const { error: createError } = await supabase
        .from('chat_sessions')
        .insert({
          session_id: sessionId,
          owner_type: actor.type,
          owner_id: actor.id,
          title: 'New Chat',
          message_count: 0,
          created_at: new Date().toISOString()
        });
      
      if (createError) throw createError;
    }
    
    // 2. 插入消息
    const { error: msgError } = await supabase
      .from('chat_messages')
      .insert({
        session_id: sessionId,
        message_id: message.id,
        sender: message.sender,
        text: message.text,
        timestamp: message.timestamp || new Date().toISOString()
      });
    
    if (msgError && !msgError.message?.includes('duplicate')) {
      throw msgError;
    }
    
    // 3. 更新session的message_count和last_message_at
    // 先获取当前消息数量
    const { data: currentSession } = await supabase
      .from('chat_sessions')
      .select('message_count')
      .eq('session_id', sessionId)
      .single();
    
    const newCount = (currentSession?.message_count || 0) + 1;
    
    const { error: updateError } = await supabase
      .from('chat_sessions')
      .update({
        message_count: newCount,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('session_id', sessionId);
    
    if (updateError) console.warn('[saveMessage] Update count failed:', updateError);
    
    console.log('[saveMessage] ✅ Saved:', { sessionId, messageId: message.id, sender: message.sender });
    return { success: true };
    
  } catch (error) {
    console.error('[saveMessage] Error:', error);
    throw error;
  }
}

/**
 * 批量保存消息（用于初始化或同步）
 * @param {string} sessionId - 会话ID
 * @param {Array} messages - 消息数组
 * @param {object} actor - 用户对象
 */
export async function saveMessages(sessionId, messages, actor) {
  try {
    // 1. 确保session存在
    const { data: session, error: sessionError } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .maybeSingle();
    
    if (sessionError) throw sessionError;
    
    if (!session) {
      const { error: createError } = await supabase
        .from('chat_sessions')
        .insert({
          session_id: sessionId,
          owner_type: actor.type,
          owner_id: actor.id,
          title: 'New Chat',
          message_count: 0
        });
      
      if (createError) throw createError;
    }
    
    // 2. 批量插入消息（忽略重复）
    const messagesToInsert = messages.map(msg => ({
      session_id: sessionId,
      message_id: msg.id,
      sender: msg.sender,
      text: msg.text,
      timestamp: msg.timestamp || new Date().toISOString()
    }));
    
    const { error: insertError } = await supabase
      .from('chat_messages')
      .upsert(messagesToInsert, { 
        onConflict: 'session_id,message_id',
        ignoreDuplicates: true 
      });
    
    if (insertError) throw insertError;
    
    // 3. 更新session
    const { error: updateError } = await supabase
      .from('chat_sessions')
      .update({
        message_count: messages.length,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('session_id', sessionId);
    
    if (updateError) console.warn('[saveMessages] Update failed:', updateError);
    
    console.log('[saveMessages] ✅ Saved:', { sessionId, count: messages.length });
    return { success: true, count: messages.length };
    
  } catch (error) {
    console.error('[saveMessages] Error:', error);
    throw error;
  }
}

/**
 * 从数据库获取会话的所有消息
 * @param {string} sessionId - 会话ID
 * @returns {Promise<Array>} 消息数组
 */
export async function getMessages(sessionId) {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: true });
    
    if (error) throw error;
    
    const messages = (data || []).map(msg => ({
      id: msg.message_id,
      text: msg.text,
      sender: msg.sender,
      timestamp: msg.timestamp
    }));
    
    console.log('[getMessages] ✅ Fetched:', { sessionId, count: messages.length });
    return messages;
    
  } catch (error) {
    console.error('[getMessages] Error:', error);
    return [];
  }
}

/**
 * 保存artifact到数据库
 * @param {string} sessionId - 会话ID
 * @param {object} artifact - { type, prompt, storagePath, publicUrl, provider, model, metadata }
 */
export async function saveArtifact(sessionId, artifact) {
  try {
    const { data, error } = await supabase
      .from('artifacts')
      .insert({
        session_id: sessionId,
        artifact_type: artifact.type,
        prompt: artifact.prompt?.substring(0, 1000),
        storage_path: artifact.storagePath,
        public_url: artifact.publicUrl,
        provider: artifact.provider,
        model: artifact.model,
        metadata: artifact.metadata || {},
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) throw error;
    
    console.log('[saveArtifact] ✅ Saved:', { 
      sessionId, 
      type: artifact.type, 
      id: data.id 
    });
    
    return data;
    
  } catch (error) {
    console.error('[saveArtifact] Error:', error);
    throw error;
  }
}

/**
 * 获取会话的所有artifacts
 * @param {string} sessionId - 会话ID
 * @returns {Promise<Array>} artifacts数组
 */
export async function getArtifacts(sessionId) {
  try {
    const { data, error } = await supabase
      .from('artifacts')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    console.log('[getArtifacts] ✅ Fetched:', { sessionId, count: data?.length || 0 });
    return data || [];
    
  } catch (error) {
    console.error('[getArtifacts] Error:', error);
    return [];
  }
}

