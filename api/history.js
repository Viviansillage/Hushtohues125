import { getHistory, getActor, supabase } from './supabase.js';
import { extractCanvasText, filterSystemTags, generateSemanticTags, hasLegacySystemTags } from './tagging.js';

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
  console.log(`[history.js] Handler called: ${req.method} ${req.url}`);
  
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
        
        // 查询当前 actor 的 archive（由 content_json 决定是否展示）
        const { data, error } = await supabase
          .from('chat_history')
          .select('*')
          .eq('owner_type', actor.type)
          .eq('owner_id', actor.id)
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
        
        const hasArchiveContent = (item) => {
          const items = item?.content_json?.items;
          const artifacts = item?.content_json?.artifacts;
          const hasItems = Array.isArray(items) && items.length > 0;
          const hasArtifacts = Array.isArray(artifacts) && artifacts.length > 0;
          const tags = Array.isArray(item?.tags) ? item.tags : [];
          return hasItems || hasArtifacts || hasLegacySystemTags(tags);
        };

        // 健壮地解析每条记录，跳过坏数据
        const history = (data || [])
          .filter(hasArchiveContent)
          .map(item => {
          try {
            return {
              id: item.id,
              sessionId: item.session_id,  // ✅ 关键：返回 sessionId
              title: item.title || 'Untitled',
              messageCount: item.message_count || 0,
              lastMessage: item.last_message || '',
              previewImages: Array.isArray(item.preview_images) ? item.preview_images : [],
              isPublic: item.is_public || false,
              tags: filterSystemTags(Array.isArray(item.tags) ? item.tags : []),
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
      const { title, content, messages, previewImages } = body;
      
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
          tags: [],
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
        .select('*, session_id')
        .eq('id', id)
        .single();

      if (!item) {
        return res.status(404).json({ error: 'Item not found' });
      }

      if (item.owner_type !== actor.type || item.owner_id !== actor.id) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      // 更新 chat_history
      const updates = {};
      let publishTags = null;
      if (body.title !== undefined) updates.title = body.title;
      if (body.isPublic !== undefined) updates.is_public = body.isPublic;
      if (body.contentJson !== undefined) updates.content_json = body.contentJson;

      if (body.isPublic === true) {
        const contentForTags = body.contentJson ?? item.content_json ?? {};
        const titleForTags = body.title ?? item.title ?? 'Untitled';
        const canvasText = extractCanvasText(contentForTags, titleForTags);
        const semanticTags = await generateSemanticTags(canvasText);
        updates.tags = semanticTags;
        publishTags = semanticTags;
      } else if (body.tags !== undefined) {
        updates.tags = filterSystemTags(body.tags);
      }

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

      // ========== Reference-Only Logic: 同步到 community_posts ==========
      if (body.isPublic !== undefined && item.session_id) {
        if (body.isPublic === true) {
          // ✅ 发布时强制要求 guest ID
          const publishActor = getActor(req, { requireGuestId: true });
          
          if (publishActor.error === 'MISSING_GUEST_ID' || !publishActor.id) {
            console.error('[history/[id]] ❌ Cannot publish: missing X-Guest-ID header');
            return res.status(401).json({ 
              error: 'Authentication required',
              details: 'X-Guest-ID header is required for publishing. Please refresh the page.'
            });
          }
          
          console.log('[history/[id]] 📤 Publishing to community:', {
            session_id: item.session_id,
            guestId: publishActor.id?.slice(0, 8),
            title: data.title
          });
          
          // Public = true: 在 community_posts 中 upsert 引用记录（不复制内容）
          const coverImage = Array.isArray(data.preview_images) && data.preview_images.length > 0
            ? data.preview_images[0]
            : null;
          
          // ✅ 获取 author_name
          let authorName = publishActor.name || `Guest-${publishActor.id.slice(-6)}`;
          if (publishActor.type === 'user') {
            try {
              const { data: profile } = await supabase
                .from('profiles')
                .select('display_name, user_name')
                .eq('id', publishActor.id)
                .maybeSingle();
              authorName = profile?.display_name || profile?.user_name || 'User';
            } catch (profileError) {
              console.warn('[history/[id]] Failed to fetch profile, using default name:', profileError);
            }
          }

          // ✅ 确保 created_at 有值
          const createdAt = item.created_at || item.timestamp || new Date().toISOString();
          
          const tagsForPublish = Array.isArray(publishTags)
            ? publishTags
            : filterSystemTags(data.tags || []);

          console.log('[history/[id]] Upserting to community_posts:', {
            session_id: item.session_id,
            author_type: publishActor.type || 'guest',
            author_id: publishActor.id,
            author_name: authorName,
            title: data.title || 'Untitled',
            created_at: createdAt
          });

          const { data: publishedPost, error: upsertError } = await supabase
            .from('community_posts')
            .upsert({
              session_id: item.session_id,
              author_type: publishActor.type || 'guest',
              author_id: publishActor.id,
              author_name: authorName,
              is_public: true,
              cover_image_url: coverImage || null,
              title: data.title || 'Untitled',
              tags: tagsForPublish,
              created_at: createdAt,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'session_id',
              ignoreDuplicates: false  // 更新已存在的记录
            })
            .select('id, session_id')
            .single();

          if (upsertError) {
            console.error('[history/[id]] ❌ Failed to publish to community:', upsertError);
            return res.status(500).json({ 
              error: 'Failed to publish to community',
              details: upsertError.message
            });
          }
          
          console.log('[history/[id]] ✅ Published to community:', {
            communityPostId: publishedPost.id,
            session_id: publishedPost.session_id
          });
          
          // ✅ Important: Return communityPostId in response
          data.communityPostId = publishedPost.id;
        } else {
          // Public = false: 标记为不公开（保留记录用于审计）
          console.log('[history/[id]] 📥 Unpublishing from community:', item.session_id);
          
          const { error: unpublishError } = await supabase
            .from('community_posts')
            .update({ is_public: false, updated_at: new Date().toISOString() })
            .eq('session_id', item.session_id);

          if (unpublishError) {
            console.error('[history/[id]] ❌ Failed to unpublish from community:', unpublishError);
          } else {
            console.log('[history/[id]] ✅ Unpublished from community:', item.session_id);
          }
        }
      }
      // ========== End Reference-Only Logic ==========

      console.log('[history/[id]] Updated:', id);

      return res.status(200).json({
        id: data.id,
        sessionId: data.session_id,  // ✅ 返回 sessionId
        title: data.title,
        messageCount: data.message_count,
        lastMessage: data.last_message,
        timestamp: data.timestamp,
        previewImages: data.preview_images || [],
        isPublic: data.is_public,
        tags: filterSystemTags(data.tags || [])
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
        sessionId: data.session_id,  // ✅ 返回 sessionId
        title: data.title,
        messageCount: data.message_count,
        lastMessage: data.last_message,
        timestamp: data.timestamp,
        previewImages: data.preview_images || [],
        isPublic: data.is_public,
        tags: filterSystemTags(data.tags || []),
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
