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
  const requestId = `hist-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Guest-ID');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;
    const id = url.searchParams.get('id');  // ✅ 改用 query param
    
    // ✅ 如果有 id 参数，走详情/更新/删除逻辑
    if (id) {
      return handleHistoryById(req, res, id);
    }
    
    // ========== GET /api/history - 列表接口 ==========
    const actor = getActor(req);
    console.log(`[${requestId}] [history.js] Method:`, req.method, 'Actor:', actor);
    
    if (req.method === 'GET') {
      try {
        console.log(`[${requestId}] [history.js] GET - Query conditions:`, {
          owner_type: actor.type,
          owner_id: actor.id
        });
        
        // 查询当前 actor 的 archive（只返回 artifact：mindmap/image/save）
        const { data, error } = await supabase
          .from('chat_history')
          .select('*')
          .eq('owner_type', actor.type)
          .eq('owner_id', actor.id)
          .or('tags.cs.{mindmap},tags.cs.{image},tags.cs.{save}')  // 只返回有 artifact 标记的
          .order('timestamp', { ascending: false });

        if (error) {
          console.error(`[${requestId}] [history.js] Query error:`, error);
          throw error;
        }
        
        console.log(`[${requestId}] [history.js] Found ${data?.length || 0} raw items from DB`);
        if (data && data.length > 0) {
          console.log(`[${requestId}] [history.js] Sample item:`, {
            id: data[0].id,
            session_id: data[0].session_id,
            tags: data[0].tags,
            has_artifacts: !!data[0].content_json?.artifacts,
            artifact_count: data[0].content_json?.artifacts?.length || 0
          });
        }
        
        // 健壮地解析每条记录，跳过坏数据
        const history = (data || []).map(item => {
          try {
            return {
              id: item.id,
              title: item.title || 'Untitled',
              messageCount: item.message_count || 0,
              lastMessage: item.last_message || '',
              previewImages: Array.isArray(item.preview_images) ? item.preview_images : [],
              isPublic: item.is_public || false,
              tags: Array.isArray(item.tags) ? item.tags : [],
              timestamp: item.timestamp || new Date().toISOString(),
              isDemo: item.is_demo || false
            };
          } catch (parseError) {
            console.error(`[${requestId}] [history.js] Failed to parse item ${item.id}:`, parseError.message);
            return null;
          }
        }).filter(item => item !== null);
        
        console.log(`[${requestId}] [history.js] Successfully parsed ${history.length} items`);
        
        return res.status(200).json(history);
      } catch (queryError) {
        console.error(`[${requestId}] [history.js] GET failed:`, queryError);
        return res.status(500).json({ 
          error: 'Failed to fetch history',
          details: queryError.message,
          requestId
        });
      }
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
    console.error(`[${requestId}] [history.js] Error:`, error);
    res.status(500).json({ 
      error: error.message,
      requestId
    });
  }
}

// ========== Handler: /api/history/[id] ==========
async function handleHistoryById(req, res, id) {
  try {
    const actor = getActor(req);
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
        previewImages: data.preview_images || [],
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
        previewImages: data.preview_images || [],
        isPublic: data.is_public,
        tags: data.tags || [],
        contentJson: data.content_json,
        artifacts: data.content_json?.artifacts || []
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('[history/[id]] Error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
