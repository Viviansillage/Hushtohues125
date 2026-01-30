import { getCommunityMeta, getCommunityPosts, supabase } from './supabase.js';

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Guest-ID');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
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
