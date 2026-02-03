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
    
    // ========== 路由 3: /api/community (主路由，统一使用 query 参数) ==========
    const discover = url.searchParams.get('discover');
    const posts = url.searchParams.get('posts');
    const action = url.searchParams.get('action');
    const postId = url.searchParams.get('postId');
    const communityName = url.searchParams.get('community');
    
    // ========== GET: action=detail (社区详情) ==========
    if (req.method === 'GET' && action === 'detail' && communityName) {
      return handleCommunityDetail(req, res, communityName);
    }
    
    if (req.method === 'POST') {
      const body = await parseBody(req);
      
      // /api/community?action=follow
      if (action === 'follow') {
        const { name } = body;
        const actor = getActor(req);
        
        if (!name) {
          return res.status(400).json({ error: 'Community name is required' });
        }
        
        try {
          // 1. 查找或创建 community_tag
          let { data: tag, error: tagError } = await supabase
            .from('community_tags')
            .select('id, member_count')
            .eq('name', name)
            .maybeSingle();
          
          if (tagError && tagError.code !== 'PGRST116') {
            throw tagError;
          }
          
          if (!tag) {
            const { data: newTag, error: createError } = await supabase
              .from('community_tags')
              .insert({ name: name, member_count: 1 })
              .select('id, member_count')
              .single();
            
            if (createError) throw createError;
            tag = newTag;
          }
          
          // 2. Upsert 关注记录（幂等）
          const { error: upsertError } = await supabase
            .from('user_followed_communities')
            .upsert(
              {
                actor_type: actor.type,
                actor_id: actor.id,
                community_tag_id: tag.id,
                profile_id: actor.type === 'user' ? actor.id : null,
                created_at: new Date().toISOString()
              },
              {
                onConflict: 'actor_type,actor_id,community_tag_id',
                ignoreDuplicates: true
              }
            );
          
          if (upsertError) throw upsertError;
          
          // 3. 更新 member_count（如果是新关注）
          await supabase
            .from('community_tags')
            .update({ member_count: (tag.member_count || 0) + 1 })
            .eq('id', tag.id);
          
          // 4. 返回最新数据
          const meta = await getCommunityMeta(req);
          return res.status(200).json(meta);
        } catch (error) {
          console.error('Follow community error:', error);
          return res.status(500).json({ 
            error: 'Failed to follow community',
            details: error.message // 开发环境详细错误
          });
        }
      }
      
      // /api/community?action=unfollow
      if (action === 'unfollow') {
        const { name } = body;
        const actor = getActor(req);
        
        if (!name) {
          return res.status(400).json({ error: 'Community name is required' });
        }
        
        try {
          // 1. 查找 community_tag
          const { data: tag, error: tagError } = await supabase
            .from('community_tags')
            .select('id, member_count')
            .eq('name', name)
            .maybeSingle();
          
          if (tagError && tagError.code !== 'PGRST116') {
            throw tagError;
          }
          
          if (!tag) {
            // Tag 不存在，已经是未关注状态
            const meta = await getCommunityMeta(req);
            return res.status(200).json(meta);
          }
          
          // 2. 删除关注记录
          const { error: deleteError } = await supabase
            .from('user_followed_communities')
            .delete()
            .eq('actor_type', actor.type)
            .eq('actor_id', actor.id)
            .eq('community_tag_id', tag.id);
          
          if (deleteError) throw deleteError;
          
          // 3. 更新 member_count
          if (tag.member_count > 0) {
            await supabase
              .from('community_tags')
              .update({ member_count: tag.member_count - 1 })
              .eq('id', tag.id);
          }
          
          // 4. 返回最新数据
          const meta = await getCommunityMeta(req);
          return res.status(200).json(meta);
        } catch (error) {
          console.error('Unfollow community error:', error);
          return res.status(500).json({ 
            error: 'Failed to unfollow community',
            details: error.message
          });
        }
      }
      
      // /api/community?action=bookmark&postId=xxx
      if (action === 'bookmark' && postId) {
        // Mock: 返回收藏状态
        return res.status(200).json({ bookmarked: true });
      }
      
      // /api/community?action=join&community=xxx
      if (action === 'join' && communityName) {
        const actor = getActor(req);
        
        try {
          // 1. 查找或创建 community_tag
          let { data: tag, error: tagError } = await supabase
            .from('community_tags')
            .select('id, member_count')
            .eq('name', communityName)
            .maybeSingle();
          
          if (tagError && tagError.code !== 'PGRST116') {
            throw tagError;
          }
          
          if (!tag) {
            const { data: newTag, error: createError } = await supabase
              .from('community_tags')
              .insert({ name: communityName, member_count: 1 })
              .select('id, member_count')
              .single();
            
            if (createError) throw createError;
            tag = newTag;
          }
          
          // 2. 检查是否已 joined
          const { data: existing, error: checkError } = await supabase
            .from('user_followed_communities')
            .select('id')
            .eq('actor_type', actor.type)
            .eq('actor_id', actor.id)
            .eq('community_tag_id', tag.id)
            .maybeSingle();
          
          if (checkError && checkError.code !== 'PGRST116') {
            throw checkError;
          }
          
          if (existing) {
            return res.status(200).json({ joined: true, alreadyJoined: true });
          }
          
          // 3. Upsert join 记录（幂等）
          const { error: upsertError } = await supabase
            .from('user_followed_communities')
            .upsert(
              {
                actor_type: actor.type,
                actor_id: actor.id,
                community_tag_id: tag.id,
                profile_id: actor.type === 'user' ? actor.id : null,
                created_at: new Date().toISOString()
              },
              {
                onConflict: 'actor_type,actor_id,community_tag_id',
                ignoreDuplicates: true
              }
            );
          
          if (upsertError) throw upsertError;
          
          // 4. 更新 member_count
          await supabase
            .from('community_tags')
            .update({ member_count: (tag.member_count || 0) + 1 })
            .eq('id', tag.id);
          
          return res.status(200).json({ joined: true, alreadyJoined: false });
        } catch (error) {
          console.error('Join community error:', error);
          return res.status(500).json({ 
            error: 'Failed to join community',
            details: error.message
          });
        }
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
      const meta = await getCommunityMeta(req);
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

    const actor = getActor(req);
    console.log('[handleCommunityDetail] Request:', { 
      name, 
      actor: { type: actor.type, id: actor.id.slice(0, 8) + '...' }
    });
    
    // 查询该 community 是否被当前用户关注
    const { data: tag, error: tagError } = await supabase
      .from('community_tags')
      .select('id, name, member_count')
      .eq('name', name)
      .maybeSingle();
    
    if (tagError && tagError.code !== 'PGRST116') {
      console.error('[handleCommunityDetail] Tag query error:', tagError);
      throw tagError;
    }
    
    let joined = false;
    if (tag) {
      const { data: existing, error: memberError } = await supabase
        .from('user_followed_communities')
        .select('id')
        .eq('actor_type', actor.type)
        .eq('actor_id', actor.id)
        .eq('community_tag_id', tag.id)
        .maybeSingle();
      
      if (memberError && memberError.code !== 'PGRST116') {
        console.error('[handleCommunityDetail] Membership query error:', memberError);
        throw memberError;
      }
      
      joined = !!existing;
      console.log('[handleCommunityDetail] Status:', {
        tagId: tag.id,
        tagName: tag.name,
        memberCount: tag.member_count,
        joined,
        existingRecord: !!existing
      });
    } else {
      console.log('[handleCommunityDetail] Community tag not found:', name);
    }

    return res.status(200).json({
      name: name,
      detail: {
        members: tag?.member_count || 0,
        online: Math.floor(Math.random() * 100) + 20,
        posts: []
      },
      joined
    });
  } catch (error) {
    console.error('[handleCommunityDetail] Error:', error);
    return res.status(500).json({ 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
