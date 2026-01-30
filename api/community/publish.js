import { getActor, supabase } from '../supabase.js';

async function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Guest-ID');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const actor = getActor(req);
    const body = await parseBody(req);
    
    const { 
      title, 
      content, 
      contentJson, 
      summary, 
      tags, 
      communityName, 
      communityTagId,
      imageUrl,
      assetUrls 
    } = body;
    
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }
    
    // 查找或创建社区标签
    let tagId = communityTagId;
    if (!tagId && communityName) {
      const { data: existingTag, error: tagError } = await supabase
        .from('community_tags')
        .select('id')
        .eq('name', communityName)
        .maybeSingle();
      
      // 忽略"没有行"的错误
      if (tagError && tagError.code !== 'PGRST116') {
        throw tagError;
      }
      
      if (existingTag) {
        tagId = existingTag.id;
      } else {
        const { data: newTag, error: insertError } = await supabase
          .from('community_tags')
          .insert({ name: communityName })
          .select('id')
          .single();
        
        if (insertError) throw insertError;
        tagId = newTag?.id;
      }
    }
    // 如果 communityName 和 communityTagId 都为空，tagId 保持 undefined（允许 null）
    
    // 获取作者信息
    let authorName = `Guest-${actor.id.slice(-6)}`;
    if (actor.type === 'user') {
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_name, display_name')
        .eq('id', actor.id)
        .single();
      authorName = profile?.display_name || profile?.user_name || 'User';
    }
    
    // Guest demo 7 天后过期
    const expiresAt = actor.type === 'guest' 
      ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      : null;
    
    // 插入帖子
    const { data, error } = await supabase
      .from('community_posts')
      .insert({
        title,
        content,
        content_json: contentJson || { content },
        summary: summary || content.slice(0, 200),
        author_type: actor.type,
        author_id: actor.id,
        author_name: authorName,
        community_tag_id: tagId,
        tags: tags || [],
        image_url: imageUrl,
        asset_urls: assetUrls || (imageUrl ? [imageUrl] : []),
        is_demo: actor.type === 'guest',
        expires_at: expiresAt,
        likes: 0,
        comments: 0,
        timestamp: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    
    return res.status(201).json({
      id: data.id,
      title: data.title,
      timestamp: data.timestamp,
      isDemo: data.is_demo,
      communityTagId: data.community_tag_id
    });
  } catch (error) {
    console.error('Publish API error:', error);
    res.status(500).json({ error: error.message });
  }
}
