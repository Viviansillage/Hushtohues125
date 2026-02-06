import { getActor, supabase } from '../supabase.js';
import { filterSystemTags } from '../tagging.js';

/**
 * GET /api/history/[id] - 获取单个 archive 详情
 * PATCH /api/history/[id] - 更新 archive
 * DELETE /api/history/[id] - 删除 archive
 */
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Guest-ID');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 从 URL 中提取 id
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathParts = url.pathname.split('/');
  const id = pathParts[pathParts.length - 1];

  if (!id || id === '[id]') {
    return res.status(400).json({ 
      ok: false, 
      error: 'Invalid ID' 
    });
  }

  const actor = getActor(req);
  console.log('[history/[id]] Request:', {
    method: req.method,
    id,
    actor: `${actor.type}:${actor.id}`
  });

  try {
    // ========== GET: 获取详情 ==========
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('chat_history')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        console.error('[history/[id]] GET error:', error?.message || 'Not found');
        return res.status(404).json({ 
          ok: false, 
          error: 'Item not found' 
        });
      }

      // 如果是私有的，验证所有权
      if (!data.is_public && (data.owner_type !== actor.type || data.owner_id !== actor.id)) {
        console.error('[history/[id]] GET forbidden:', {
          expected: `${data.owner_type}:${data.owner_id}`,
          actual: `${actor.type}:${actor.id}`
        });
        return res.status(403).json({ 
          ok: false, 
          error: 'Forbidden' 
        });
      }

      console.log('[history/[id]] GET success:', {
        id: data.id,
        title: data.title,
        artifactCount: data.content_json?.artifacts?.length || 0
      });

      return res.status(200).json({
        ok: true,
        item: {
          id: data.id,
          title: data.title,
          messageCount: data.message_count,
          lastMessage: data.last_message,
          timestamp: data.timestamp,
          previewImages: data.preview_images || [],
          isPublic: data.is_public,
          tags: filterSystemTags(data.tags || []),
          contentJson: data.content_json,
          artifacts: data.content_json?.artifacts || []
        }
      });
    }

    // ========== PATCH: 更新 ==========
    if (req.method === 'PATCH') {
      const body = await parseBody(req);

      // 先查询验证所有权
      const { data: item } = await supabase
        .from('chat_history')
        .select('owner_type, owner_id')
        .eq('id', id)
        .single();

      if (!item) {
        return res.status(404).json({ 
          ok: false, 
          error: 'Item not found' 
        });
      }

      if (item.owner_type !== actor.type || item.owner_id !== actor.id) {
        return res.status(403).json({ 
          ok: false, 
          error: 'Forbidden' 
        });
      }

      // 更新
      const updates = {};
      if (body.title !== undefined) updates.title = body.title;
      if (body.isPublic !== undefined) updates.is_public = body.isPublic;
      if (body.tags !== undefined) updates.tags = filterSystemTags(body.tags);

      const { data, error } = await supabase
        .from('chat_history')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('[history/[id]] PATCH error:', error);
        return res.status(500).json({ 
          ok: false, 
          error: 'Failed to update', 
          details: error.message 
        });
      }

      console.log('[history/[id]] PATCH success:', id);

      return res.status(200).json({
        ok: true,
        item: {
          id: data.id,
          title: data.title,
          messageCount: data.message_count,
          lastMessage: data.last_message,
          timestamp: data.timestamp,
          previewImages: data.preview_images || [],
          isPublic: data.is_public,
          tags: filterSystemTags(data.tags || [])
        }
      });
    }

    // ========== DELETE: 删除 ==========
    if (req.method === 'DELETE') {
      // 先查询验证所有权
      const { data: item } = await supabase
        .from('chat_history')
        .select('owner_type, owner_id')
        .eq('id', id)
        .single();

      if (!item) {
        return res.status(404).json({ 
          ok: false, 
          error: 'Item not found' 
        });
      }

      if (item.owner_type !== actor.type || item.owner_id !== actor.id) {
        return res.status(403).json({ 
          ok: false, 
          error: 'Forbidden' 
        });
      }

      const { error } = await supabase
        .from('chat_history')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('[history/[id]] DELETE error:', error);
        return res.status(500).json({ 
          ok: false, 
          error: 'Failed to delete', 
          details: error.message 
        });
      }

      console.log('[history/[id]] DELETE success:', id);

      return res.status(200).json({ 
        ok: true, 
        id 
      });
    }

    return res.status(405).json({ 
      ok: false, 
      error: 'Method not allowed' 
    });

  } catch (error) {
    console.error('[history/[id]] Unexpected error:', error);
    return res.status(500).json({ 
      ok: false, 
      error: 'Internal server error', 
      details: error.message 
    });
  }
}

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
