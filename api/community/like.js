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
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Guest-ID');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

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
      // 先检查是否已点赞（使用 maybeSingle 避免 0 行时抛错）
      const { data: existing, error: checkError } = await supabase
        .from('user_likes')
        .select('id')
        .eq('actor_type', actor.type)
        .eq('actor_id', actor.id)
        .eq('target_type', targetType)
        .eq('target_id', finalTargetId)
        .maybeSingle();
      
      // 如果查询出错（非"没有行"的错误），抛出
      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }
      
      if (existing) {
        // 已经点赞，返回当前 likes 数（避免前端显示 0）
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
      
      // 插入点赞记录
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
        // 处理并发插入导致的唯一约束冲突
        if (insertError.code === '23505') {
          return res.status(200).json({ 
            message: 'Already liked',
            alreadyLiked: true 
          });
        }
        throw insertError;
      }
      
      // 更新帖子点赞数（直接 +1）并返回最新值
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
      // 取消点赞
      const { error: deleteError } = await supabase
        .from('user_likes')
        .delete()
        .eq('actor_type', actor.type)
        .eq('actor_id', actor.id)
        .eq('target_type', targetType)
        .eq('target_id', finalTargetId);
      
      if (deleteError) throw deleteError;
      
      // 更新帖子点赞数（直接 -1）并返回最新值
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
