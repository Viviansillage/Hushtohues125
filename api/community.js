import { getCommunityMeta, getCommunityPosts, getActor, supabase } from './supabase.js';

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Guest-ID');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;
    
    // ========== 路由 1: /api/community/like ==========
    if (pathname.includes('/like')) {
      return handleLike(req, res);
    }
    
    // ========== 路由 2: /api/community/publish ==========
    if (pathname.includes('/publish')) {
      return handlePublish(req, res);
    }
    
    // ========== 路由 3: /api/community/[name] ==========
    const nameMatch = pathname.match(/\/api\/community\/([^\/]+)$/);
    if (nameMatch && nameMatch[1] && !['like', 'publish'].includes(nameMatch[1])) {
      return handleCommunityDetail(req, res, nameMatch[1]);
    }
    
    // ========== 路由 4: /api/community (主路由) ==========
    const discover = url.searchParams.get('discover');
    const posts = url.searchParams.get('posts');
    const action = url.searchParams.get('action');
    const postId = url.searchParams.get('postId');
    const communityName = url.searchParams.get('community');
    
    if (req.method === 'POST') {
      const body = await parseBody(req);
      
      // /api/community?action=follow
      if (action === 'follow') {
        const { name } = body;
        // Mock: 返回更新后的元数据
        const meta = await getCommunityMeta();
        return res.status(200).json(meta);
      }
      
      // /api/community?action=unfollow
      if (action === 'unfollow') {
        const { name } = body;
        // Mock: 返回更新后的元数据
        const meta = await getCommunityMeta();
        return res.status(200).json(meta);
      }
      
      // /api/community?action=bookmark&postId=xxx
      if (action === 'bookmark' && postId) {
        // Mock: 返回收藏状态
        return res.status(200).json({ bookmarked: true });
      }
      
      // /api/community?action=join&community=xxx
      if (action === 'join' && communityName) {
        // Mock: 返回加入状态
        return res.status(200).json({ joined: true });
      }
    }
    
    if (req.method === 'GET') {
      // /api/community?posts=true - 获取所有社区帖子
      if (posts === 'true' || req.url?.includes('posts')) {
        const allPosts = await getCommunityPosts();
        return res.status(200).json(allPosts);
      }
      
      // Discover Feed: seed 优先 + 最新 guest 帖子（包含 demo）
      if (discover === 'true' || req.url?.includes('discover')) {
        const { data: seedPosts, error: seedError } = await supabase
          .from('community_posts')
          .select('*, community_tags(name)')
          .eq('author_type', 'seed')
          .order('timestamp', { ascending: false })
          .limit(20);
        
        if (seedError) throw seedError;
        
        // Guest 帖子：包含 is_demo=true（guest 发布的），但过滤已过期的
        const { data: guestPosts, error: guestError } = await supabase
          .from('community_posts')
          .select('*, community_tags(name)')
          .neq('author_type', 'seed')
          .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
          .order('timestamp', { ascending: false })
          .limit(10);
        
        if (guestError) throw guestError;
        
        // 合并并按时间重新排序（最新在前）
        const allPosts = [...(seedPosts || []), ...(guestPosts || [])]
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        const formatted = allPosts.map(post => ({
          id: post.id,
          title: post.title,
          author: { 
            name: post.author_name || 'Anonymous',
            id: post.author_id,
            type: post.author_type
          },
          imageUrl: post.image_url || post.asset_urls?.[0],
          content: post.content || post.summary,
          summary: post.summary,
          likes: post.likes || 0,
          comments: post.comments || 0,
          timestamp: post.timestamp,
          tags: post.tags || [],
          communityName: post.community_tags?.name || null
        }));
        
        return res.status(200).json(formatted);
      }
      
      // 默认返回社区元数据
      const meta = await getCommunityMeta();
      return res.status(200).json(meta);
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Community API error:', error);
    res.status(500).json({ error: error.message });
  }
}

// ========== Handler: /api/community/like ==========
async function handleLike(req, res) {
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const actor = getActor(req);
    const body = await parseBody(req);
    
    const { postId, targetType = 'post', targetId } = body;
    const finalTargetId = targetId || postId;
    
    if (!finalTargetId) {
      return res.status(400).json({ error: 'postId or targetId is required' });
    }
    
    if (req.method === 'POST') {
      // 点赞（幂等）
      const { data: existing, error: checkError } = await supabase
        .from('user_likes')
        .select('id')
        .eq('actor_type', actor.type)
        .eq('actor_id', actor.id)
        .eq('target_type', targetType)
        .eq('target_id', finalTargetId)
        .maybeSingle();
      
      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }
      
      if (existing) {
        let currentLikes = null;
        if (targetType === 'post') {
          const { data: post } = await supabase
            .from('community_posts')
            .select('likes')
            .eq('id', finalTargetId)
            .maybeSingle();
          currentLikes = post?.likes ?? null;
        }
        
        return res.status(200).json({ 
          message: 'Already liked',
          alreadyLiked: true,
          likes: currentLikes
        });
      }
      
      const { error: insertError } = await supabase
        .from('user_likes')
        .insert({
          actor_type: actor.type,
          actor_id: actor.id,
          target_type: targetType,
          target_id: finalTargetId,
          created_at: new Date().toISOString()
        });
      
      if (insertError) {
        if (insertError.code === '23505') {
          return res.status(200).json({ 
            message: 'Already liked',
            alreadyLiked: true 
          });
        }
        throw insertError;
      }
      
      let newLikes = null;
      if (targetType === 'post') {
        const { data: post } = await supabase
          .from('community_posts')
          .select('likes')
          .eq('id', finalTargetId)
          .maybeSingle();
        
        if (post) {
          const updatedLikes = (post.likes || 0) + 1;
          await supabase
            .from('community_posts')
            .update({ likes: updatedLikes })
            .eq('id', finalTargetId);
          newLikes = updatedLikes;
        }
      }
      
      return res.status(201).json({ 
        message: 'Liked successfully',
        alreadyLiked: false,
        likes: newLikes
      });
    }
    
    if (req.method === 'DELETE') {
      const { error: deleteError } = await supabase
        .from('user_likes')
        .delete()
        .eq('actor_type', actor.type)
        .eq('actor_id', actor.id)
        .eq('target_type', targetType)
        .eq('target_id', finalTargetId);
      
      if (deleteError) throw deleteError;
      
      let newLikes = null;
      if (targetType === 'post') {
        const { data: post } = await supabase
          .from('community_posts')
          .select('likes')
          .eq('id', finalTargetId)
          .maybeSingle();
        
        if (post && post.likes > 0) {
          const updatedLikes = post.likes - 1;
          await supabase
            .from('community_posts')
            .update({ likes: updatedLikes })
            .eq('id', finalTargetId);
          newLikes = updatedLikes;
        }
      }
      
      return res.status(200).json({ 
        message: 'Unliked successfully',
        likes: newLikes
      });
    }
  } catch (error) {
    console.error('Like API error:', error);
    res.status(500).json({ error: error.message });
  }
}

// ========== Handler: /api/community/publish ==========
async function handlePublish(req, res) {
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
    
    let tagId = communityTagId;
    if (!tagId && communityName) {
      const { data: existingTag, error: tagError } = await supabase
        .from('community_tags')
        .select('id')
        .eq('name', communityName)
        .maybeSingle();
      
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
    
    let authorName = `Guest-${actor.id.slice(-6)}`;
    if (actor.type === 'user') {
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_name, display_name')
        .eq('id', actor.id)
        .single();
      authorName = profile?.display_name || profile?.user_name || 'User';
    }
    
    const expiresAt = actor.type === 'guest' 
      ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      : null;
    
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

// ========== Handler: /api/community/[name] ==========
async function handleCommunityDetail(req, res, name) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!name) {
      return res.status(400).json({ error: 'Community name required' });
    }

    return res.status(200).json({
      name: name,
      detail: {
        members: Math.floor(Math.random() * 5000) + 1000,
        online: Math.floor(Math.random() * 100) + 20,
        posts: []
      },
      joined: false
    });
  } catch (error) {
    console.error('Community detail API error:', error);
    res.status(500).json({ error: error.message });
  }
}
