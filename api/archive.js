import { supabase, getActor } from './supabase.js';

/**
 * Archive Save API
 * 实现同一session只有一个archive记录，多次保存append到同一记录
 */
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Guest-ID');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
  const action = searchParams.get('action');

  // POST /api/archive/save - 保存artifact到archive（append模式）
  if (req.method === 'POST' && (action === 'save' || req.url.includes('/save'))) {
    try {
      const body = await parseBody(req);
      const { sessionId, artifact } = body;

      if (!sessionId || !artifact) {
        return res.status(400).json({
          ok: false,
          error: 'Missing required fields',
          details: 'sessionId and artifact are required'
        });
      }

      const actor = getActor(req);
      console.log('[Archive Save] Request:', {
        sessionId,
        artifactType: artifact.type,
        actor
      });

      // ✅ Step 1: 查找同一session的archive记录
      const { data: existingArchive, error: findError } = await supabase
        .from('chat_history')
        .select('*')
        .eq('owner_type', actor.type)
        .eq('owner_id', actor.id)
        .eq('session_id', sessionId)
        .maybeSingle();

      if (findError) {
        console.error('[Archive Save] Query error:', findError);
        return res.status(500).json({
          ok: false,
          error: 'Database query failed',
          details: findError.message
        });
      }

      // Step 2: 获取session的messages生成title
      const { data: sessionMessages } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      const messageCount = sessionMessages?.length || 0;
      
      // ✅ 使用artifact的summary或title作为lastMessage的fallback
      const artifactSummary = artifact.data?.summary || artifact.data?.title || '';
      const lastMessage = sessionMessages?.[sessionMessages.length - 1]?.content 
        || artifactSummary 
        || `Saved ${artifact.type}`;

      // Step 3: 准备artifact数据（追加）
      const newArtifactEntry = {
        type: artifact.type,
        data: artifact.data,
        savedAt: new Date().toISOString()
      };

      if (existingArchive) {
        // ✅ 已存在：append到artifacts数组
        console.log('[Archive Save] Appending to existing archive:', existingArchive.id);
        
        const currentArtifacts = existingArchive.content_json?.artifacts || [];
        const updatedArtifacts = [...currentArtifacts, newArtifactEntry];
        
        // 更新 tags：合并已有标签和新的 artifact 类型
        const currentTags = existingArchive.tags || [];
        const uniqueTags = Array.from(new Set([...currentTags, 'save', artifact.type]));
        
        // 更新 preview_images：提取图片 URL
        const currentPreviews = existingArchive.preview_images || [];
        const newImageUrl = artifact.type === 'image' ? artifact.data?.imageUrl : null;
        const updatedPreviews = newImageUrl && !currentPreviews.includes(newImageUrl)
          ? [...currentPreviews, newImageUrl]
          : currentPreviews;

        const { data: updated, error: updateError } = await supabase
          .from('chat_history')
          .update({
            message_count: messageCount,
            last_message: lastMessage.substring(0, 200),
            content_json: {
              ...existingArchive.content_json,
              artifacts: updatedArtifacts,
              sessionId
            },
            tags: uniqueTags,
            preview_images: updatedPreviews,  // ✅ 更新图片预览
            updated_at: new Date().toISOString()
          })
          .eq('id', existingArchive.id)
          .select()
          .single();

        if (updateError) {
          console.error('[Archive Save] Update error:', updateError);
          return res.status(500).json({
            ok: false,
            error: 'Failed to update archive',
            details: updateError.message
          });
        }

        console.log('[Archive Save] ✅ Updated archive:', {
          archiveId: updated.id,
          sessionId: updated.session_id,
          totalArtifacts: updatedArtifacts.length,
          owner: `${actor.type}:${actor.id}`,
          latestArtifactType: newArtifactEntry.type
        });

        return res.json({
          ok: true,
          archiveId: updated.id,
          artifactIndex: updatedArtifacts.length - 1,
          totalArtifacts: updatedArtifacts.length,
          actor: { type: actor.type, id: actor.id },
          sessionId: updated.session_id
        });

      } else {
        // ✅ 不存在：创建新archive
        console.log('[Archive Save] Creating new archive for session:', sessionId);

        // ✅ 生成title：优先使用artifact的title，其次使用第一条用户消息
        const artifactTitle = artifact.data?.title || '';
        const userMessages = sessionMessages?.filter(m => m.sender === 'user') || [];
        const firstUserMsg = userMessages[0]?.content || '';
        const title = artifactTitle.substring(0, 50) 
          || firstUserMsg.substring(0, 50) 
          || `Saved ${artifact.type} - ${new Date().toLocaleString()}`;
        
        // 提取图片预览
        const previewImages = artifact.type === 'image' && artifact.data?.imageUrl 
          ? [artifact.data.imageUrl] 
          : [];

        const { data: created, error: createError } = await supabase
          .from('chat_history')
          .insert({
            owner_type: actor.type,
            owner_id: actor.id,
            session_id: sessionId,
            title,
            message_count: messageCount,
            last_message: lastMessage.substring(0, 200),
            content_json: {
              artifacts: [newArtifactEntry],
              sessionId
            },
            tags: ['save', artifact.type],
            preview_images: previewImages,  // ✅ 添加预览图
            is_public: false
          })
          .select()
          .single();

        if (createError) {
          console.error('[Archive Save] Create error:', createError);
          
          // 如果是唯一约束冲突（并发），重试一次update
          if (createError.code === '23505') {
            console.log('[Archive Save] Unique constraint conflict, retrying as update...');
            // 递归重试（会进入update分支）
            return handler(req, res);
          }

          return res.status(500).json({
            ok: false,
            error: 'Failed to create archive',
            details: createError.message
          });
        }

        console.log('[Archive Save] ✅ Created archive:', {
          archiveId: created.id,
          sessionId: created.session_id,
          owner: `${actor.type}:${actor.id}`,
          title: created.title,
          artifactType: newArtifactEntry.type
        });

        return res.json({
          ok: true,
          archiveId: created.id,
          artifactIndex: 0,
          totalArtifacts: 1,
          actor: { type: actor.type, id: actor.id },
          sessionId: created.session_id
        });
      }

    } catch (error) {
      console.error('[Archive Save] Error:', error);
      return res.status(500).json({
        ok: false,
        error: 'Internal server error',
        details: error.message
      });
    }
  }

  return res.status(400).json({ 
    ok: false,
    error: 'Invalid action or method' 
  });
}

async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}
