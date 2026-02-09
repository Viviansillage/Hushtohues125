// Vercel Serverless Function - standalone, no external server
import { getProfile, getHistory, getCommunityPosts, getCommunityMeta, getOrCreateDefaultProfile } from './supabase.js';

// Parse JSON body
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
    // Health check
    if (url === '/api/health' || url === '/health') {
      await getOrCreateDefaultProfile(); // Init
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

    // User config
    if (url === '/api/profile' || url === '/profile') {
      if (method === 'GET') {
        const profile = await getProfile();
        return res.status(200).json(profile);
      }
    }

    // Chat history
    if (url === '/api/history' || url === '/history') {
      if (method === 'GET') {
        const history = await getHistory();
        return res.status(200).json(history);
      }
    }

    // Community posts
    if ((url === '/api/community/posts' || url === '/community/posts') && method === 'GET') {
      const posts = await getCommunityPosts();
      return res.status(200).json(posts);
    }

    // Community meta
    if ((url === '/api/community' || url === '/community') && method === 'GET') {
      const meta = await getCommunityMeta();
      return res.status(200).json(meta);
    }

    // Chat messages (temp storage)
    if ((url === '/api/chat/messages' || url === '/chat/messages') && method === 'GET') {
      return res.status(200).json([]);
    }

    // Send message
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
