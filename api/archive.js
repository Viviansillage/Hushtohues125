import { supabase, getActor, uploadImageToStorage } from './supabase.js';

/**
 * 若 imageUrl 为 data URL，上传到 Supabase 并返回 http 公链；否则原样返回
 * @param {object} artifact - { type, data: { imageUrl, ... } }
 * @param {object} actor - { type, id }
 * @param {string} sessionId
 * @returns {Promise<object>} artifact（imageUrl 已替换为 http URL）
 */
async function ensureImageUrlIsPublic(artifact, actor, sessionId) {
  if (artifact?.type !== 'image' || !artifact?.data) return artifact;
  const imageUrl = artifact.data.imageUrl || artifact.data.url;
  if (!imageUrl || !imageUrl.startsWith('data:')) {
    if (!imageUrl) console.log('[Archive DEBUG] ensureImageUrlIsPublic: imageUrl is null/empty, nothing to upload');
    return artifact;
  }

  try {
    const base64Match = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!base64Match) {
      console.warn('[Archive] Invalid data URL format, skipping upload');
      return artifact;
    }
    const mimeType = base64Match[1];
    const base64Data = base64Match[2];
    const uploadResult = await uploadImageToStorage(base64Data, mimeType, {
      sessionId,
      actor,
      prompt: artifact.data?.imagePrompt || ''
    });
    if (uploadResult?.publicUrl?.startsWith('http')) {
      const updated = { ...artifact, data: { ...artifact.data, imageUrl: uploadResult.publicUrl, url: uploadResult.publicUrl } };
      console.log('[Archive] ✅ Uploaded data URL to Supabase:', { publicUrl: uploadResult.publicUrl });
      return updated;
    }
  } catch (err) {
    console.error('[Archive] Failed to upload data URL:', err.message);
  }
  return artifact;
}

/** 图片固定宽度，高度按宽高比计算 */
const FIXED_IMAGE_WIDTH = 400;

/** 提取文本第一句（到句号/问号/叹号/换行或前 50 字） */
function getFirstSentence(text) {
  if (!text || typeof text !== 'string') return '';
  const s = String(text).trim();
  const match = s.match(/^[^。.!?\n]+[。.!?\n]?/) || [s];
  return (match[0] || s).trim().substring(0, 50);
}

/** 根据 imageWidth/imageHeight 计算图片 item 高度，无则用默认 */
function getImageItemHeight(artifactData) {
  const w = artifactData?.imageWidth;
  const h = artifactData?.imageHeight;
  if (typeof w === 'number' && typeof h === 'number' && w > 0 && h > 0) {
    const computed = Math.round(FIXED_IMAGE_WIDTH * (h / w));
    return Math.max(100, Math.min(800, computed)); // 限制 100~800
  }
  return 300; // 默认
}

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
 * 估算文本高度
 * @param {string} text - 文本内容
 * @returns {number} 估算的高度（像素）
 */
function estimateTextHeight(text) {
  if (!text) return 120;
  
  const lines = text.split('\n').length;
  const avgCharsPerLine = 40;  // ✅ 减少到40（更保守）
  const wrappedLines = Math.ceil(text.length / avgCharsPerLine);
  const totalLines = Math.max(lines, wrappedLines);
  
  // ✅ 每行56px（增加），padding 80px（增加），再乘以1.1安全系数
  const baseHeight = totalLines * 56 + 80;
  const estimatedHeight = Math.max(Math.ceil(baseHeight * 1.1), 120);
  
  console.log('[Height Estimation]', {
    textLength: text.length,
    actualLines: lines,
    wrappedLines,
    totalLines,
    baseHeight,
    estimatedHeight
  });
  
  return estimatedHeight;
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
      const { sessionId, artifact, measuredHeight } = body;

      if (!sessionId || !artifact) {
        return res.status(400).json({
          ok: false,
          error: 'Missing required fields',
          details: 'sessionId and artifact are required'
        });
      }

      const actor = getActor(req);
      // [DEBUG] 记录收到的 artifact.imageUrl 情况
      const rawImageUrl = artifact?.data?.imageUrl || artifact?.data?.url;
      const imageUrlType = !rawImageUrl ? 'null/undefined' : rawImageUrl.startsWith('data:') ? 'data-url' : rawImageUrl.startsWith('http') ? 'http-url' : 'other';
      console.log('[Archive DEBUG] Incoming artifact:', {
        sessionId,
        artifactType: artifact?.type,
        imageUrlType,
        imageUrlPreview: rawImageUrl ? `${rawImageUrl.substring(0, 80)}...` : null,
        hasData: !!artifact?.data
      });

      // ✅ Step 0: 若 imageUrl 为 data URL，上传到 Supabase 并替换为 http 公链（根因修复）
      const artifactWithPublicUrl = await ensureImageUrlIsPublic(artifact, actor, sessionId);
      const effectiveArtifact = artifactWithPublicUrl || artifact;
      const effectiveImageUrl = effectiveArtifact?.data?.imageUrl || effectiveArtifact?.data?.url;
      console.log('[Archive DEBUG] After ensureImageUrlIsPublic:', {
        imageUrlType: !effectiveImageUrl ? 'null' : effectiveImageUrl.startsWith('http') ? 'http' : 'other',
        preview: effectiveImageUrl ? effectiveImageUrl.substring(0, 100) : null
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

      // message_count: 优先用 chat_messages，空时 fallback 到 chat_sessions.message_count
      let messageCount = sessionMessages?.length || 0;
      if (messageCount === 0) {
        const { data: sessionRow } = await supabase
          .from('chat_sessions')
          .select('message_count')
          .eq('session_id', sessionId)
          .maybeSingle();
        messageCount = sessionRow?.message_count ?? 0;
      }
      
      // ✅ 使用artifact的summary作为lastMessage的fallback
      const artifactSummary = artifact.data?.summary || '';
      const lastMessage = sessionMessages?.[sessionMessages.length - 1]?.text 
        || artifactSummary 
        || `Saved ${artifact.type}`;

      // Step 3: 准备artifact数据（追加）
      const newArtifactEntry = {
        type: effectiveArtifact.type,
        data: effectiveArtifact.data,
        savedAt: new Date().toISOString()
      };

      if (existingArchive) {
        // ✅ 已存在：append到artifacts数组
        console.log('[Archive Save] Appending to existing archive:', existingArchive.id);
        
        const currentArtifacts = existingArchive.content_json?.artifacts || [];
        const updatedArtifacts = [...currentArtifacts, newArtifactEntry];
        
        // 更新 preview_images：提取图片 URL（已通过 ensureImageUrlIsPublic 转为 http）
        const currentPreviews = existingArchive.preview_images || [];
        let newImageUrl = effectiveArtifact.type === 'image' ? effectiveArtifact.data?.imageUrl || effectiveArtifact.data?.url : null;
        const updatedPreviews = newImageUrl && !currentPreviews.includes(newImageUrl)
          ? [...currentPreviews, newImageUrl]
          : currentPreviews;
        console.log('[Archive DEBUG] Update branch - preview_images:', { newImageUrl: !!newImageUrl, count: updatedPreviews.length });

        // ========== 自动生成新元素的位置信息 ==========
        const currentItems = existingArchive.content_json?.items || [];
        
        // 固定高度配置（作为 fallback）
        const FIXED_HEIGHTS = {
          image: 300,
          mindmap: 280
        };
        
        // 遍历计算最大底部位置
        let maxBottom = 160;  // 默认起始位置
        currentItems.forEach(item => {
          let itemHeight;
          
          if (typeof item.height === 'number') {
            // 已有真实高度
            itemHeight = item.height;
          } else if (item.height === 'auto' && item.type === 'text' && item.content) {
            // height为'auto'的text，重新估算
            itemHeight = estimateTextHeight(item.content);
          } else {
            // 其他情况使用固定高度
            itemHeight = FIXED_HEIGHTS[item.type] || 300;
          }
          
          const itemBottom = item.y + itemHeight;
          if (itemBottom > maxBottom) {
            maxBottom = itemBottom;
          }
        });
        
        // 新元素放在最下面 + 60px 间距（不重叠前提下尽量紧凑）
        const newY = maxBottom + 60;
        
        // 确定新元素的 ID
        let newId;
        if (effectiveArtifact.type === 'image') {
          const imageCount = currentItems.filter(i => i.type === 'image').length;
          newId = `img-${imageCount}`;
        } else if (effectiveArtifact.type === 'mindmap') {
          const mindmapCount = currentItems.filter(i => i.type === 'mindmap').length;
          newId = `mindmap-${mindmapCount}`;
        } else {
          newId = `item-${currentItems.length}`;
        }
        
        const newItems = [];
        
        // 创建 artifact item（左侧：图片或脑图）
        const newItem = {
          id: newId,
          type: effectiveArtifact.type,
          content: effectiveArtifact.type === 'image' 
            ? (effectiveArtifact.data?.imageUrl || effectiveArtifact.data?.url)
            : (effectiveArtifact.type === 'mindmap' ? cleanMermaidCode(effectiveArtifact.data?.mermaidCode) : ''),
          x: 60,
          y: newY,
          width: effectiveArtifact.type === 'image' ? FIXED_IMAGE_WIDTH : 420,
          height: effectiveArtifact.type === 'image' ? getImageItemHeight(effectiveArtifact.data) : (FIXED_HEIGHTS[effectiveArtifact.type] || 300),
          zIndex: currentItems.length + 1
        };
        
        if (effectiveArtifact.type === 'mindmap' && effectiveArtifact.data) {
          newItem.meta = {
            title: effectiveArtifact.data.title,
            summary: effectiveArtifact.data.summary
          };
        }
        
        newItems.push(newItem);
        
        // 创建对应的 text item（右侧：summary/lastMessage）
        const textContent = effectiveArtifact.data?.summary || lastMessage || '';
        if (textContent.trim()) {
          const textCount = currentItems.filter(i => i.type === 'text').length;
          const textHeight = (typeof measuredHeight === 'number' && measuredHeight > 0)
            ? measuredHeight
            : estimateTextHeight(textContent);
          newItems.push({
            id: `txt-${textCount}`,
            type: 'text',
            content: textContent,
            x: 520,  // 右侧位置
            y: newY,
            width: 400,
            height: textHeight,
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
              ...existingArchive.content_json,  // ✅ 保留所有字段（savedMessages等）
              artifacts: updatedArtifacts,
              items: updatedItems,
              sessionId
            },
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

        // ✅ 生成title：artifact.title 优先，其次 artifact.summary，若首个存储是文本则用文本第一句
        const artifactTitle = (effectiveArtifact.data?.title || '').trim();
        const artifactSummary = (effectiveArtifact.data?.summary || '').trim();
        const userMessages = sessionMessages?.filter(m => m.sender === 'user') || [];
        const firstUserMsg = (userMessages[0]?.text || '').trim();
        const title = (
          artifactTitle.substring(0, 50) ||
          artifactSummary.substring(0, 50) ||
          getFirstSentence(firstUserMsg)
        ).trim() || `Saved ${effectiveArtifact.type} - ${new Date().toLocaleString()}`;
        
        // 提取图片预览：已通过 ensureImageUrlIsPublic 转为 http
        let previewImages = (effectiveArtifact.type === 'image' && (effectiveArtifact.data?.imageUrl || effectiveArtifact.data?.url))
          ? [effectiveArtifact.data.imageUrl || effectiveArtifact.data.url]
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
          id: effectiveArtifact.type === 'image' ? 'img-0' : (effectiveArtifact.type === 'mindmap' ? 'mindmap-0' : 'item-0'),
          type: effectiveArtifact.type,
          content: effectiveArtifact.type === 'image' 
            ? (effectiveArtifact.data?.imageUrl || effectiveArtifact.data?.url)
            : (effectiveArtifact.type === 'mindmap' ? cleanMermaidCode(effectiveArtifact.data?.mermaidCode) : ''),
          x: 60,
          y: currentY,
          width: effectiveArtifact.type === 'image' ? FIXED_IMAGE_WIDTH : 420,
          height: effectiveArtifact.type === 'image' ? getImageItemHeight(effectiveArtifact.data) : (FIXED_HEIGHTS[effectiveArtifact.type] || 300),
          zIndex: 1
        };
        
        if (effectiveArtifact.type === 'mindmap' && effectiveArtifact.data) {
          firstItem.meta = {
            title: effectiveArtifact.data.title,
            summary: effectiveArtifact.data.summary
          };
        }
        
        initialItems.push(firstItem);
        
        // 若 previewImages 仍为空，从 image item 的 content 提取
        if (previewImages.length === 0 && firstItem.type === 'image' && firstItem.content) {
          previewImages = [firstItem.content];
        }
        console.log('[Archive DEBUG] Create branch - preview_images:', { count: previewImages.length, first: previewImages[0]?.substring(0, 80) });
        
        // 创建对应的 text item（右侧：summary/lastMessage）
        const textContent = effectiveArtifact.data?.summary || lastMessage || '';
        if (textContent.trim()) {
          const textHeight = (typeof measuredHeight === 'number' && measuredHeight > 0)
            ? measuredHeight
            : estimateTextHeight(textContent);
          initialItems.push({
            id: 'txt-0',
            type: 'text',
            content: textContent,
            x: 520,  // 右侧位置
            y: currentY,
            width: 400,
            height: textHeight,
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
            tags: [],
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

  // POST /api/archive?action=saveMessage - 保存消息（统一入口）
  if (req.method === 'POST' && action === 'saveMessage') {
    try {
      const body = await parseBody(req);
      const { sessionId, messageId, messageText, artifact, measuredHeight } = body;

      if (!sessionId || !messageId || !messageText) {
        return res.status(400).json({
          ok: false,
          error: 'Missing required fields',
          details: 'sessionId, messageId, and messageText are required'
        });
      }

      const actor = getActor(req);
      console.log('[Archive SaveMessage] Request:', {
        sessionId,
        messageId,
        hasArtifact: !!artifact,
        artifactType: artifact?.type,
        textLength: messageText.length
      });

      // ✅ 若 imageUrl 为 data URL，先上传到 Supabase 转为 http
      const effectiveArtifact = artifact ? await ensureImageUrlIsPublic(artifact, actor, sessionId) : null;

      // ✅ 获取 message_count（与 save 流程一致）
      const { data: sessionMessages } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });
      let messageCount = sessionMessages?.length || 0;
      if (messageCount === 0) {
        const { data: sessionRow } = await supabase
          .from('chat_sessions')
          .select('message_count')
          .eq('session_id', sessionId)
          .maybeSingle();
        messageCount = sessionRow?.message_count ?? 0;
      }

      // 查找该session的archive
      const { data: existingArchive, error: findError } = await supabase
        .from('chat_history')
        .select('*')
        .eq('owner_type', actor.type)
        .eq('owner_id', actor.id)
        .eq('session_id', sessionId)
        .maybeSingle();

      if (findError) {
        console.error('[Archive SaveMessage] Query error:', findError);
        return res.status(500).json({
          ok: false,
          error: 'Database query failed',
          details: findError.message
        });
      }

      const currentItems = existingArchive?.content_json?.items || [];
      const savedMessages = existingArchive?.content_json?.savedMessages || [];
      
      // 检查是否已保存过
      if (savedMessages.includes(messageId)) {
        console.log('[Archive SaveMessage] Message already saved:', messageId);
        return res.json({
          ok: true,
          archiveId: existingArchive.id,
          alreadySaved: true
        });
      }

      // 固定高度配置
      const FIXED_HEIGHTS = {
        image: 300,
        mindmap: 280
      };

      // 计算最大底部位置
      let maxBottom = 160;
      currentItems.forEach(item => {
        let itemHeight;
        
        if (typeof item.height === 'number') {
          // 已有真实高度
          itemHeight = item.height;
        } else if (item.height === 'auto' && item.type === 'text' && item.content) {
          // height为'auto'的text，重新估算
          itemHeight = estimateTextHeight(item.content);
        } else {
          // 其他情况使用固定高度
          itemHeight = FIXED_HEIGHTS[item.type] || 300;
        }
        
        const itemBottom = item.y + itemHeight;
        if (itemBottom > maxBottom) {
          maxBottom = itemBottom;
        }
      });

      const newY = maxBottom + 60;
      const newItems = [];

      if (effectiveArtifact) {
        // 有artifact：保存artifact + summary文本
        if (effectiveArtifact.type === 'image') {
          const imageUrl = effectiveArtifact.data?.imageUrl || effectiveArtifact.data?.url;
          const imageCount = currentItems.filter(i => i.type === 'image').length;
          newItems.push({
            id: `img-${imageCount}`,
            type: 'image',
            content: imageUrl,
            x: 60,
            y: newY,
            width: FIXED_IMAGE_WIDTH,
            height: getImageItemHeight(effectiveArtifact.data),
            zIndex: currentItems.length + newItems.length + 1
          });
        } else if (effectiveArtifact.type === 'mindmap') {
          const mindmapCount = currentItems.filter(i => i.type === 'mindmap').length;
          newItems.push({
            id: `mindmap-${mindmapCount}`,
            type: 'mindmap',
            content: cleanMermaidCode(effectiveArtifact.data?.mermaidCode),
            x: 60,
            y: newY,
            width: 420,
            height: 280,
            zIndex: currentItems.length + newItems.length + 1,
            meta: {
              title: effectiveArtifact.data?.title,
              summary: effectiveArtifact.data?.summary
            }
          });
        }

        // 添加summary文本（右侧）
        const summaryText = effectiveArtifact.data?.summary || messageText;
        if (summaryText.trim()) {
          const textCount = currentItems.filter(i => i.type === 'text').length;
          const textHeight = (typeof measuredHeight === 'number' && measuredHeight > 0)
            ? measuredHeight
            : estimateTextHeight(summaryText);
          newItems.push({
            id: `txt-${textCount}`,
            type: 'text',
            content: summaryText,
            x: 520,
            y: newY,
            width: 400,
            height: textHeight,
            zIndex: currentItems.length + newItems.length + 1
          });
        }
      } else {
        // 无artifact：只保存消息文本（更宽）
        const textCount = currentItems.filter(i => i.type === 'text').length;
        const textHeight = (typeof measuredHeight === 'number' && measuredHeight > 0)
          ? measuredHeight
          : estimateTextHeight(messageText);
        newItems.push({
          id: `txt-msg-${textCount}`,
          type: 'text',
          content: messageText,
          x: 60,
          y: newY,
          width: 600,  // ← 更宽
          height: textHeight,
          zIndex: currentItems.length + 1
        });
      }

      const updatedItems = [...currentItems, ...newItems];
      const updatedSavedMessages = [...savedMessages, messageId];

      // ✅ 提取首图 URL 与 artifacts 条目（供 HistoryPage 首图与详情使用）
      const currentPreviews = existingArchive?.preview_images || [];
      let newPreviewImages = currentPreviews;
      const currentArtifacts = existingArchive?.content_json?.artifacts || [];
      let newArtifacts = currentArtifacts;

      if (effectiveArtifact?.type === 'image') {
        const imgUrl = effectiveArtifact.data?.imageUrl || effectiveArtifact.data?.url;
        if (imgUrl && !currentPreviews.includes(imgUrl)) {
          newPreviewImages = [...currentPreviews, imgUrl];
        }
        newArtifacts = [...currentArtifacts, {
          type: 'image',
          data: effectiveArtifact.data,
          savedAt: new Date().toISOString()
        }];
      } else if (effectiveArtifact?.type === 'mindmap') {
        newArtifacts = [...currentArtifacts, {
          type: 'mindmap',
          data: effectiveArtifact.data,
          savedAt: new Date().toISOString()
        }];
      }

      console.log('[Archive SaveMessage] Adding items:', {
        newItemsCount: newItems.length,
        totalItems: updatedItems.length,
        savedMessagesCount: updatedSavedMessages.length
      });

      if (existingArchive) {
        // 更新现有archive
        const { data: updated, error: updateError } = await supabase
          .from('chat_history')
          .update({
            content_json: {
              ...existingArchive.content_json,
              items: updatedItems,
              savedMessages: updatedSavedMessages,
              artifacts: newArtifacts,
              sessionId
            },
            preview_images: newPreviewImages,
            message_count: messageCount,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingArchive.id)
          .select()
          .single();

        if (updateError) {
          console.error('[Archive SaveMessage] Update error:', updateError);
          return res.status(500).json({
            ok: false,
            error: 'Failed to update archive',
            details: updateError.message
          });
        }

        console.log('[Archive SaveMessage] ✅ Updated archive:', updated.id);
        return res.json({
          ok: true,
          archiveId: updated.id,
          messageId,
          itemsAdded: newItems.length
        });
      } else {
        // 创建新archive：artifact.title 优先，其次 artifact.summary，若首个存储是文本则用文本第一句
        const artifactTitle = (effectiveArtifact?.data?.title || '').trim();
        const artifactSummary = (effectiveArtifact?.data?.summary || '').trim();
        const genericPattern = /^(image|mindmap|save) created successfully$/i;
        const messageOk = messageText && !genericPattern.test(String(messageText).trim());
        const textFirstSentence = messageOk ? getFirstSentence(messageText) : '';
        const userMessages = sessionMessages?.filter(m => m.sender === 'user') || [];
        const firstUserMsg = (userMessages[0]?.text || '').trim();
        const title = (
          artifactTitle.substring(0, 50) ||
          artifactSummary.substring(0, 50) ||
          textFirstSentence ||
          getFirstSentence(firstUserMsg)
        ).trim() || 'Saved Messages';
        const { data: created, error: createError } = await supabase
          .from('chat_history')
          .insert({
            owner_type: actor.type,
            owner_id: actor.id,
            session_id: sessionId,
            title,
            message_count: messageCount,
            last_message: messageText.substring(0, 200),
            content_json: {
              items: updatedItems,
              savedMessages: updatedSavedMessages,
              artifacts: newArtifacts,
              sessionId
            },
            preview_images: newPreviewImages,
            tags: [],
            is_public: false
          })
          .select()
          .single();

        if (createError) {
          console.error('[Archive SaveMessage] Create error:', createError);
          return res.status(500).json({
            ok: false,
            error: 'Failed to create archive',
            details: createError.message
          });
        }

        console.log('[Archive SaveMessage] ✅ Created archive:', created.id);
        return res.json({
          ok: true,
          archiveId: created.id,
          messageId,
          itemsAdded: newItems.length
        });
      }
    } catch (error) {
      console.error('[Archive SaveMessage] Error:', error);
      return res.status(500).json({
        ok: false,
        error: 'Internal server error',
        details: error.message
      });
    }
  }

  // GET /api/archive?action=getSavedMessages - 获取已保存的消息ID列表
  if (req.method === 'GET' && action === 'getSavedMessages') {
    const sessionId = searchParams.get('sessionId');
    if (!sessionId) {
      return res.status(400).json({
        ok: false,
        error: 'Missing sessionId parameter'
      });
    }

    try {
      const actor = getActor(req);
      
      console.log('[Archive GetSavedMessages] Querying for:', {
        owner_type: actor.type,
        owner_id: actor.id,
        session_id: sessionId
      });
      
      const { data: archive } = await supabase
        .from('chat_history')
        .select('content_json')
        .eq('owner_type', actor.type)
        .eq('owner_id', actor.id)
        .eq('session_id', sessionId)
        .maybeSingle();

      console.log('[Archive GetSavedMessages] Result:', {
        found: !!archive,
        hasSavedMessages: !!archive?.content_json?.savedMessages,
        savedMessagesCount: archive?.content_json?.savedMessages?.length || 0,
        savedMessages: archive?.content_json?.savedMessages
      });

      const savedMessages = archive?.content_json?.savedMessages || [];
      
      return res.json({
        ok: true,
        savedMessages
      });
    } catch (error) {
      console.error('[Archive GetSavedMessages] Error:', error);
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
