import { supabase, getActor } from './supabase.js';

/**
 * 清理 Mermaid 代码中的嵌套括号
 */
function cleanMermaidCode(code) {
  if (!code || typeof code !== 'string') return code;

  return code.replace(/\(\(([\s\S]*?)\)\)/g, (_, inner) => {
    // 把内部所有英文括号替换为全角，避免 Mermaid 解析冲突
    const safe = inner
      .replace(/\(/g, '（')
      .replace(/\)/g, '）');
    return `((${safe}))`;
  });
}

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
      
      // ✅ 使用artifact的summary作为lastMessage的fallback
      const artifactSummary = artifact.data?.summary || '';
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

        // ========== 自动生成新元素的位置信息 ==========
        const currentItems = existingArchive.content_json?.items || [];
        
        // 固定高度配置（作为 fallback）
        const FIXED_HEIGHTS = {
          image: 300,
          mindmap: 280,
          text: 150  // fallback值，前端应保存真实高度
        };
        
        // 遍历计算最大底部位置
        let maxBottom = 160;  // 默认起始位置
        currentItems.forEach(item => {
          // ✅ 优先使用真实高度（数字），其次使用类型默认值
          const itemHeight = typeof item.height === 'number' 
            ? item.height 
            : (FIXED_HEIGHTS[item.type] || 300);
          
          const itemBottom = item.y + itemHeight;
          if (itemBottom > maxBottom) {
            maxBottom = itemBottom;
          }
        });
        
        // 新元素放在最下面 + 120px
        const newY = maxBottom + 120;
        
        // 确定新元素的 ID
        let newId;
        if (artifact.type === 'image') {
          const imageCount = currentItems.filter(i => i.type === 'image').length;
          newId = `img-${imageCount}`;
        } else if (artifact.type === 'mindmap') {
          const mindmapCount = currentItems.filter(i => i.type === 'mindmap').length;
          newId = `mindmap-${mindmapCount}`;
        } else {
          newId = `item-${currentItems.length}`;
        }
        
        const newItems = [];
        
        // 创建 artifact item（左侧：图片或脑图）
        const newItem = {
          id: newId,
          type: artifact.type,
          content: artifact.type === 'image' 
            ? artifact.data?.imageUrl 
            : (artifact.type === 'mindmap' ? cleanMermaidCode(artifact.data?.mermaidCode) : ''),
          x: 60,
          y: newY,
          width: artifact.type === 'image' ? 400 : 420,
          height: FIXED_HEIGHTS[artifact.type] || 300,
          zIndex: currentItems.length + 1
        };
        
        if (artifact.type === 'mindmap' && artifact.data) {
          newItem.meta = {
            title: artifact.data.title,
            summary: artifact.data.summary
          };
        }
        
        newItems.push(newItem);
        
        // 创建对应的 text item（右侧：summary/lastMessage）
        const textContent = artifact.data?.summary || lastMessage || '';
        if (textContent.trim()) {
          const textCount = currentItems.filter(i => i.type === 'text').length;
          newItems.push({
            id: `txt-${textCount}`,
            type: 'text',
            content: textContent,
            x: 520,  // 右侧位置
            y: newY,
            width: 400,
            height: 'auto',
            zIndex: currentItems.length + 2
          });
        }
        
        const updatedItems = [...currentItems, ...newItems];
        
        console.log('[Archive Save] Auto-generated position:', {
          artifactId: newId,
          textId: textContent.trim() ? `txt-${currentItems.filter(i => i.type === 'text').length}` : 'none',
          y: newY,
          maxBottom,
          totalItems: updatedItems.length
        });

        // ✅ 保留原有的 last_message，不要用新artifact覆盖
        const preservedLastMessage = existingArchive.last_message || lastMessage.substring(0, 200);

        const { data: updated, error: updateError } = await supabase
          .from('chat_history')
          .update({
            message_count: messageCount,
            last_message: preservedLastMessage,
            content_json: {
              ...existingArchive.content_json,
              artifacts: updatedArtifacts,
              items: updatedItems,
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

        // ✅ 生成title：优先使用第一条用户消息，其次使用artifact的summary
        const userMessages = sessionMessages?.filter(m => m.sender === 'user') || [];
        const firstUserMsg = userMessages[0]?.content || '';
        const artifactSummary = artifact.data?.summary || '';
        const title = firstUserMsg.substring(0, 50) 
          || artifactSummary.substring(0, 50)
          || `Saved ${artifact.type} - ${new Date().toLocaleString()}`;
        
        // 提取图片预览
        const previewImages = artifact.type === 'image' && artifact.data?.imageUrl 
          ? [artifact.data.imageUrl] 
          : [];

        // ========== 为第一个元素生成初始位置 ==========
        const FIXED_HEIGHTS = {
          image: 300,
          mindmap: 280,
          text: 150
        };
        
        const initialItems = [];
        let currentY = 160;  // 第一个元素起始位置
        
        // 创建 artifact item（左侧：图片或脑图）
        const firstItem = {
          id: artifact.type === 'image' ? 'img-0' : (artifact.type === 'mindmap' ? 'mindmap-0' : 'item-0'),
          type: artifact.type,
          content: artifact.type === 'image' 
            ? artifact.data?.imageUrl 
            : (artifact.type === 'mindmap' ? cleanMermaidCode(artifact.data?.mermaidCode) : ''),
          x: 60,
          y: currentY,
          width: artifact.type === 'image' ? 400 : 420,
          height: FIXED_HEIGHTS[artifact.type] || 300,
          zIndex: 1
        };
        
        if (artifact.type === 'mindmap' && artifact.data) {
          firstItem.meta = {
            title: artifact.data.title,
            summary: artifact.data.summary
          };
        }
        
        initialItems.push(firstItem);
        
        // 创建对应的 text item（右侧：summary/lastMessage）
        const textContent = artifact.data?.summary || lastMessage || '';
        if (textContent.trim()) {
          initialItems.push({
            id: 'txt-0',
            type: 'text',
            content: textContent,
            x: 520,  // 右侧位置
            y: currentY,
            width: 400,
            height: 'auto',
            zIndex: 2
          });
        }
        
        console.log('[Archive Save] Creating initial items:', {
          artifactItem: firstItem.id,
          textItem: textContent.trim() ? 'txt-0' : 'none',
          position: { x: 60, y: currentY }
        });

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
              items: initialItems,
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
