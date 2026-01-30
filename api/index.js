// Vercel Serverless Function - 完全独立，不依赖外部 server 目录
import { 
  getProfile, 
  getHistory, 
  getCommunityPosts, 
  getCommunityTags,
  getFollowedCommunities,
  getUserLikes,
  getUserBookmarks,
  getOrCreateDefaultProfile 
} from './supabase.js';

// 解析 JSON body
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
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { url, method } = req;
  
  try {
    // 健康检查
    if (url === '/api/health' || url === '/health') {
      await getOrCreateDefaultProfile(); // 初始化
      return res.status(200).json({ 
        status: 'ok',
        env: {
          hasSupabaseUrl: !!(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
          hasSupabaseKey: !!(process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY),
          url: url,
          method: method
        }
      });
    }

    // 用户配置
    if (url === '/api/profile' || url === '/profile') {
      if (method === 'GET') {
        const profile = await getProfile();
        return res.status(200).json(profile);
      }
    }

    // 聊天历史
    if (url === '/api/history' || url === '/history') {
      if (method === 'GET') {
        const history = await getHistory();
        return res.status(200).json(history);
      }
    }

    // 社区帖子
    if ((url === '/api/community/posts' || url === '/community/posts') && method === 'GET') {
      const posts = await getCommunityPosts();
      return res.status(200).json(posts);
    }

    // 社区元数据
    if ((url === '/api/community' || url === '/community') && method === 'GET') {
      const [allTags, followed, likes, bookmarks] = await Promise.all([
        getCommunityTags(),
        getFollowedCommunities(),
        getUserLikes(),
        getUserBookmarks()
      ]);
      
      const followedNames = followed.map(t => t.name);
      const recommended = allTags.filter(t => !followedNames.includes(t.name));
      
      return res.status(200).json({
        followed,
        recommended,
        user: {
          likes,
          bookmarks
        }
      });
    }

    // 聊天消息（临时存储）
    if ((url === '/api/chat/messages' || url === '/chat/messages') && method === 'GET') {
      return res.status(200).json([]);
    }

    // 发送消息
    if ((url === '/api/chat/message' || url === '/chat/message') && method === 'POST') {
      const body = await parseBody(req);
      const { text } = body;
      const now = new Date().toISOString();
      
      const messages = [
        { id: `${Date.now()}-u`, text, sender: 'user', timestamp: now },
        { id: `${Date.now()}-b`, text: 'Got it. I can turn that into a sketch, a prompt, or a clean summary. Want a mindmap or an image?', sender: 'bot', timestamp: now }
      ];
      
      return res.status(200).json({ messages });
    }

    // 404
    res.status(404).json({ 
      error: 'Not Found',
      url: url,
      method: method,
      availableRoutes: ['/api/health', '/api/profile', '/api/history', '/api/community', '/api/chat/messages', '/api/chat/message']
    });

  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
}
