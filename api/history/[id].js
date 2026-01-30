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
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Guest-ID');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const actor = getActor(req);
    const { id } = req.query;
    
    console.log('[history/[id]] Method:', req.method, 'ID:', id, 'Actor:', actor);

    if (req.method === 'DELETE') {
      // 删除历史记录
      const { data: item } = await supabase
        .from('chat_history')
        .select('owner_type, owner_id')
        .eq('id', id)
        .single();

      if (!item) {
        return res.status(404).json({ error: 'Item not found' });
      }

      if (item.owner_type !== actor.type || item.owner_id !== actor.id) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const { error } = await supabase
        .from('chat_history')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('[history/[id]] Delete error:', error);
        return res.status(500).json({ error: 'Failed to delete', details: error.message });
      }

      console.log('[history/[id]] Deleted:', id);
      return res.status(200).json({ success: true, id });
    }

    if (req.method === 'PATCH') {
      // 更新历史记录（如标题、isPublic等）
      const body = await parseBody(req);
      
      // 验证所有权
      const { data: item } = await supabase
        .from('chat_history')
        .select('owner_type, owner_id')
        .eq('id', id)
        .single();

      if (!item) {
        return res.status(404).json({ error: 'Item not found' });
      }

      if (item.owner_type !== actor.type || item.owner_id !== actor.id) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      // 更新
      const updates = {};
      if (body.title !== undefined) updates.title = body.title;
      if (body.isPublic !== undefined) updates.is_public = body.isPublic;
      if (body.tags !== undefined) updates.tags = body.tags;

      const { data, error } = await supabase
        .from('chat_history')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('[history/[id]] Update error:', error);
        return res.status(500).json({ error: 'Failed to update', details: error.message });
      }

      console.log('[history/[id]] Updated:', id);

      return res.status(200).json({
        id: data.id,
        title: data.title,
        messageCount: data.message_count,
        lastMessage: data.last_message,
        timestamp: data.timestamp,
        previewImages: data.content_json?.previewImages || [],
        isPublic: data.is_public,
        tags: data.tags || []
      });
    }

    if (req.method === 'GET') {
      // 获取单个历史记录详情
      const { data, error } = await supabase
        .from('chat_history')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        return res.status(404).json({ error: 'Item not found' });
      }

      // 如果是私有的，验证所有权
      if (!data.is_public && (data.owner_type !== actor.type || data.owner_id !== actor.id)) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      return res.status(200).json({
        id: data.id,
        title: data.title,
        messageCount: data.message_count,
        lastMessage: data.last_message,
        timestamp: data.timestamp,
        previewImages: data.content_json?.previewImages || [],
        isPublic: data.is_public,
        tags: data.tags || [],
        contentJson: data.content_json
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('[history/[id]] Error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
