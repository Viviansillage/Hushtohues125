import { supabase, getActor, uploadImageToStorage } from './supabase.js';

/**
 * If imageUrl is data URL, upload to Supabase and return http URL; otherwise return as-is
 * @param {object} artifact - { type, data: { imageUrl, ... } }
 * @param {object} actor - { type, id }
 * @param {string} sessionId
 * @returns {Promise<object>} artifact (imageUrl replaced with http URL)
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

/** Fixed image width, height by aspect ratio */
const FIXED_IMAGE_WIDTH = 400;

/** Extract first sentence (to period/question/exclamation/newline or first 50 chars) */
function getFirstSentence(text) {
  if (!text || typeof text !== 'string') return '';
  const s = String(text).trim();
  const match = s.match(/^[^。.!?\n]+[。.!?\n]?/) || [s];
  return (match[0] || s).trim().substring(0, 50);
}

/** Compute image item height from imageWidth/imageHeight, default if missing */
function getImageItemHeight(artifactData) {
  const w = artifactData?.imageWidth;
  const h = artifactData?.imageHeight;
  if (typeof w === 'number' && typeof h === 'number' && w > 0 && h > 0) {
    const computed = Math.round(FIXED_IMAGE_WIDTH * (h / w));
    return Math.max(100, Math.min(800, computed)); // Clamp 100~800
  }
  return 300; // default
}

/**
 * Clean nested parentheses in Mermaid code
 */
function cleanMermaidCode(code) {
  if (!code || typeof code !== 'string') return code;

  return code.replace(/\(\(([\s\S]*?)\)\)/g, (_, inner) => {
    // Replace inner parentheses with fullwidth to avoid Mermaid parse conflict
    const safe = inner
      .replace(/\(/g, '（')
      .replace(/\)/g, '）');
    return `((${safe}))`;
  });
}

/**
 * Estimate text height
 * @param {string} text - Text content
 * @returns {number} Estimated height (px)
 */
function estimateTextHeight(text) {
  if (!text) return 120;
  
  const lines = text.split('\n').length;
  const avgCharsPerLine = 40;  // Conservative
  const wrappedLines = Math.ceil(text.length / avgCharsPerLine);
  const totalLines = Math.max(lines, wrappedLines);
  
  // 56px per line, 80px padding, 1.1 safety factor
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
 * One archive per session, append on multiple saves
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

  // POST /api/archive/save - Save artifact to archive (append mode)
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
      // [DEBUG] Log incoming artifact.imageUrl
      const rawImageUrl = artifact?.data?.imageUrl || artifact?.data?.url;
      const imageUrlType = !rawImageUrl ? 'null/undefined' : rawImageUrl.startsWith('data:') ? 'data-url' : rawImageUrl.startsWith('http') ? 'http-url' : 'other';
      console.log('[Archive DEBUG] Incoming artifact:', {
        sessionId,
        artifactType: artifact?.type,
        imageUrlType,
        imageUrlPreview: rawImageUrl ? `${rawImageUrl.substring(0, 80)}...` : null,
        hasData: !!artifact?.data
      });

      // Step 0: If imageUrl is data URL, upload to Supabase and replace with http URL
      const artifactWithPublicUrl = await ensureImageUrlIsPublic(artifact, actor, sessionId);
      const effectiveArtifact = artifactWithPublicUrl || artifact;
      const effectiveImageUrl = effectiveArtifact?.data?.imageUrl || effectiveArtifact?.data?.url;
      console.log('[Archive DEBUG] After ensureImageUrlIsPublic:', {
        imageUrlType: !effectiveImageUrl ? 'null' : effectiveImageUrl.startsWith('http') ? 'http' : 'other',
        preview: effectiveImageUrl ? effectiveImageUrl.substring(0, 100) : null
      });

      // Step 1: Find archive for same session
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

      // Step 2: Get session messages for title
      const { data: sessionMessages } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      // message_count: prefer chat_messages, fallback to chat_sessions.message_count
      let messageCount = sessionMessages?.length || 0;
      if (messageCount === 0) {
        const { data: sessionRow } = await supabase
          .from('chat_sessions')
          .select('message_count')
          .eq('session_id', sessionId)
          .maybeSingle();
        messageCount = sessionRow?.message_count ?? 0;
      }
      
      // Use artifact summary as lastMessage fallback
      const artifactSummary = artifact.data?.summary || '';
      const lastMessage = sessionMessages?.[sessionMessages.length - 1]?.text 
        || artifactSummary 
        || `Saved ${artifact.type}`;

      // Step 3: Prepare artifact data (append)
      const newArtifactEntry = {
        type: effectiveArtifact.type,
        data: effectiveArtifact.data,
        savedAt: new Date().toISOString()
      };

      if (existingArchive) {
        // Exists: append to artifacts array
        console.log('[Archive Save] Appending to existing archive:', existingArchive.id);
        
        const currentArtifacts = existingArchive.content_json?.artifacts || [];
        const updatedArtifacts = [...currentArtifacts, newArtifactEntry];
        
        // Update preview_images: extract image URLs (ensureImageUrlIsPublic converts to http)
        const currentPreviews = existingArchive.preview_images || [];
        let newImageUrl = effectiveArtifact.type === 'image' ? effectiveArtifact.data?.imageUrl || effectiveArtifact.data?.url : null;
        const updatedPreviews = newImageUrl && !currentPreviews.includes(newImageUrl)
          ? [...currentPreviews, newImageUrl]
          : currentPreviews;
        console.log('[Archive DEBUG] Update branch - preview_images:', { newImageUrl: !!newImageUrl, count: updatedPreviews.length });

        // Auto-generate position for new elements
        const currentItems = existingArchive.content_json?.items || [];
        
        // Fixed height config (fallback)
        const FIXED_HEIGHTS = {
          image: 300,
          mindmap: 280
        };
        
        // Compute max bottom position
        let maxBottom = 160;  // Default start
        currentItems.forEach(item => {
          let itemHeight;
          
          if (typeof item.height === 'number') {
            // Has real height
            itemHeight = item.height;
          } else if (item.height === 'auto' && item.type === 'text' && item.content) {
            // Re-estimate text with height auto
            itemHeight = estimateTextHeight(item.content);
          } else {
            // Use fixed height otherwise
            itemHeight = FIXED_HEIGHTS[item.type] || 300;
          }
          
          const itemBottom = item.y + itemHeight;
          if (itemBottom > maxBottom) {
            maxBottom = itemBottom;
          }
        });
        
        // New element at bottom + 60px gap
        const newY = maxBottom + 60;
        
        // Determine new element ID
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
        
        // Create artifact item (left: image or mindmap)
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
        if (effectiveArtifact.type === 'image' && effectiveArtifact.data?.title) {
          newItem.meta = { title: effectiveArtifact.data.title };
        }
        
        newItems.push(newItem);
        
        // Create text item (right: summary/lastMessage)
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
            x: 520,  // Right position
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

        // Keep original last_message, do not overwrite with new artifact
        const preservedLastMessage = existingArchive.last_message || lastMessage.substring(0, 200);

        const { data: updated, error: updateError } = await supabase
          .from('chat_history')
          .update({
            message_count: messageCount,
            last_message: preservedLastMessage,
            content_json: {
              ...existingArchive.content_json,  // Keep all fields (savedMessages etc)
              artifacts: updatedArtifacts,
              items: updatedItems,
              sessionId
            },
            preview_images: updatedPreviews,
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
        // Not exists: create new archive
        console.log('[Archive Save] Creating new archive for session:', sessionId);

        // Generate title: artifact.title first, then artifact.summary, else first sentence
        const artifactTitle = (effectiveArtifact.data?.title || '').trim();
        const artifactSummary = (effectiveArtifact.data?.summary || '').trim();
        const userMessages = sessionMessages?.filter(m => m.sender === 'user') || [];
        const firstUserMsg = (userMessages[0]?.text || '').trim();
        const title = (
          artifactTitle.substring(0, 50) ||
          artifactSummary.substring(0, 50) ||
          getFirstSentence(firstUserMsg)
        ).trim() || `Saved ${effectiveArtifact.type} - ${new Date().toLocaleString()}`;
        
        // Extract image preview (ensureImageUrlIsPublic converts to http)
        let previewImages = (effectiveArtifact.type === 'image' && (effectiveArtifact.data?.imageUrl || effectiveArtifact.data?.url))
          ? [effectiveArtifact.data.imageUrl || effectiveArtifact.data.url]
          : [];

        // Generate initial position for first element
        const FIXED_HEIGHTS = {
          image: 300,
          mindmap: 280,
          text: 150
        };
        
        const initialItems = [];
        let currentY = 160;  // First element start
        
        // Create artifact item (left: image or mindmap)
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
        if (effectiveArtifact.type === 'image' && effectiveArtifact.data?.title) {
          firstItem.meta = { title: effectiveArtifact.data.title };
        }
        
        initialItems.push(firstItem);
        
        // If previewImages empty, extract from image item content
        if (previewImages.length === 0 && firstItem.type === 'image' && firstItem.content) {
          previewImages = [firstItem.content];
        }
        console.log('[Archive DEBUG] Create branch - preview_images:', { count: previewImages.length, first: previewImages[0]?.substring(0, 80) });
        
        // Create text item (right: summary/lastMessage)
        const textContent = effectiveArtifact.data?.summary || lastMessage || '';
        if (textContent.trim()) {
          const textHeight = (typeof measuredHeight === 'number' && measuredHeight > 0)
            ? measuredHeight
            : estimateTextHeight(textContent);
          initialItems.push({
            id: 'txt-0',
            type: 'text',
            content: textContent,
            x: 520,  // Right position
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
            preview_images: previewImages,
            is_public: false
          })
          .select()
          .single();

        if (createError) {
          console.error('[Archive Save] Create error:', createError);
          
          // If unique constraint conflict, retry as update
          if (createError.code === '23505') {
            console.log('[Archive Save] Unique constraint conflict, retrying as update...');
            // Recursive retry (enters update branch)
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

  // POST /api/archive?action=saveMessage - Save message (unified entry)
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

      // If imageUrl is data URL, upload to Supabase first
      const effectiveArtifact = artifact ? await ensureImageUrlIsPublic(artifact, actor, sessionId) : null;

      // Get message_count (same as save flow)
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

      // Find archive for session
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
      
      // Check if already saved
      if (savedMessages.includes(messageId)) {
        console.log('[Archive SaveMessage] Message already saved:', messageId);
        return res.json({
          ok: true,
          archiveId: existingArchive.id,
          alreadySaved: true
        });
      }

      // Fixed height config
      const FIXED_HEIGHTS = {
        image: 300,
        mindmap: 280
      };

      // Compute max bottom position
      let maxBottom = 160;
      currentItems.forEach(item => {
        let itemHeight;
        
        if (typeof item.height === 'number') {
          // Has real height
          itemHeight = item.height;
        } else if (item.height === 'auto' && item.type === 'text' && item.content) {
          // Re-estimate text height when height is 'auto'
          itemHeight = estimateTextHeight(item.content);
        } else {
          // Use fixed height otherwise
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
        // Has artifact: save artifact + summary text
        if (effectiveArtifact.type === 'image') {
          const imageUrl = effectiveArtifact.data?.imageUrl || effectiveArtifact.data?.url;
          const imageCount = currentItems.filter(i => i.type === 'image').length;
          const imageItem = {
            id: `img-${imageCount}`,
            type: 'image',
            content: imageUrl,
            x: 60,
            y: newY,
            width: FIXED_IMAGE_WIDTH,
            height: getImageItemHeight(effectiveArtifact.data),
            zIndex: currentItems.length + newItems.length + 1,
            messageId
          };
          if (effectiveArtifact.data?.title) {
            imageItem.meta = { title: effectiveArtifact.data.title };
          }
          newItems.push(imageItem);
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
            messageId,
            meta: {
              title: effectiveArtifact.data?.title,
              summary: effectiveArtifact.data?.summary
            }
          });
        }

        // Add summary text (right)
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
            zIndex: currentItems.length + newItems.length + 1,
            messageId
          });
        }
      } else {
        // No artifact: save message text only (wider)
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
          width: 600,  // Wider
          height: textHeight,
          zIndex: currentItems.length + 1,
          messageId
        });
      }

      const updatedItems = [...currentItems, ...newItems];
      const updatedSavedMessages = [...savedMessages, messageId];

      // Extract cover image URL and artifacts (for HistoryPage)
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
        // Update existing archive
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
        // Create new archive: prefer artifact.title, then artifact.summary, else first sentence of text
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

  // GET /api/archive?action=getSavedMessages - Get list of saved message IDs
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
