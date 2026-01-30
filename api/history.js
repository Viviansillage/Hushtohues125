import { getHistory, getActor, supabase } from './supabase.js';

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
    const actor = getActor(req);
    console.log('[history.js] Method:', req.method, 'Actor:', actor);
    
    if (req.method === 'GET') {
      // 查询当前 actor 的 archive（只返回 artifact：mindmap/image/save）
      const { data, error } = await supabase
        .from('chat_history')
        .select('*')
        .eq('owner_type', actor.type)
        .eq('owner_id', actor.id)
        .or('tags.cs.{mindmap},tags.cs.{image},tags.cs.{save}')  // 只返回有 artifact 标记的
        .order('timestamp', { ascending: false });

      if (error) {
        console.error('[history.js] Query error:', error);
        throw error;
      }
      
      console.log('[history.js] Found artifact items:', data?.length || 0);
      
      const history = (data || []).map(item => ({
        id: item.id,
        title: item.title,
        messageCount: item.message_count,
        lastMessage: item.last_message || '',
        previewImages: item.content_json?.imageUrl ? [item.content_json.imageUrl] : [],
        isPublic: item.is_public,
        tags: item.tags || [],
        timestamp: item.timestamp,
        isDemo: item.is_demo
      }));
      
      return res.status(200).json(history);
    }
    
    if (req.method === 'POST') {
      // 保存 archive（guest 也允许）
      const body = await parseBody(req);
      const { title, content, messages, tags, previewImages } = body;
      
      if (!title) {
        return res.status(400).json({ error: 'Title is required' });
      }
      
      // 计算过期时间：guest demo 7 天后过期
      const expiresAt = actor.type === 'guest' 
        ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        : null;
      
      const { data, error } = await supabase
        .from('chat_history')
        .insert({
          owner_type: actor.type,
          owner_id: actor.id,
          title,
          message_count: messages?.length || 0,
          last_message: messages?.[messages.length - 1]?.content || content || '',
          preview_images: previewImages || [],
          tags: tags || [],
          content_json: { messages, content },
          is_demo: actor.type === 'guest',
          expires_at: expiresAt,
          timestamp: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      
      return res.status(201).json({
        id: data.id,
        title: data.title,
        timestamp: data.timestamp,
        isDemo: data.is_demo
      });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('History API error:', error);
    res.status(500).json({ error: error.message });
  }
}
