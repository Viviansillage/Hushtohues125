import { getHistory, getActor, supabase, extractCanvasText, filterSystemTags, generateSemanticTags, classifyCommunityCategory } from './supabase.js';

/** Extract cover image from chat_history: prefer preview_images, else derive from content_json.items */
function deriveCoverImage(item) {
  const previews = Array.isArray(item?.preview_images) ? item.preview_images : [];
  if (previews.length > 0) return previews[0];
  const items = item?.content_json?.items || [];
  const firstImage = items.find((i) => i?.type === 'image' && i?.content);
  return firstImage?.content || null;
}

/** Extract first text from canvas (card preview): first text in items only, empty if none */
function deriveFirstTextPreview(item) {
  const items = item?.content_json?.items || [];
  const firstTextItem = items.find((i) => i?.type === 'text' && i?.content);
  if (firstTextItem?.content) {
    return String(firstTextItem.content).trim().substring(0, 120);
  }
  return '';
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
    const id = url.searchParams.get('id');
    
    // If id param, handle detail/update/delete
    if (id) {
      return handleHistoryById(req, res, id);
    }
    
    // ========== GET /api/history - List endpoint ==========
    const actor = getActor(req);
    console.log(`[${requestId}] [history.js] Method:`, req.method, 'Actor:', actor);
    
    if (req.method === 'GET') {
      try {
        console.log(`[${requestId}] [history.js] GET - Query conditions:`, {
          owner_type: actor.type,
          owner_id: actor.id
        });
        
        // Query archive for current actor (content_json determines display)
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
          // Only show canvas with items or artifacts; avoid old records (content/messages only) shown as canvas
          return hasItems || hasArtifacts;
        };

        const derivePreviewImages = (item) => {
          const first = deriveCoverImage(item);
          return first ? [first] : [];
        };

        // Robustly parse each record, skip bad data
        const history = (data || [])
          .filter(hasArchiveContent)
          .map(item => {
            try {
              // Card preview: first text or artifact summary only, empty if none (no last_message fallback)
              const firstText = deriveFirstTextPreview(item);
              return {
                id: item.id,
                sessionId: item.session_id,
                title: item.title || 'Untitled',
                messageCount: item.message_count || 0,
                lastMessage: (firstText || '').trim(),
                previewImages: derivePreviewImages(item),
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
      // Save archive (guest allowed)
      const body = await parseBody(req);
      const { title, content, messages, previewImages } = body;
      
      if (!title) {
        return res.status(400).json({ error: 'Title is required' });
      }
      
      // Compute expiry: guest demo expires in 7 days
      const expiresAt = actor.type === 'guest' 
        ? new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()
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
      // Delete history
      const { data: item } = await supabase
        .from('chat_history')
        .select('owner_type, owner_id, session_id')
        .eq('id', id)
        .single();

      if (!item) {
        return res.status(404).json({ error: 'Item not found' });
      }

      if (item.owner_type !== actor.type || item.owner_id !== actor.id) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/9bfc82ef-eb42-4bc3-94ab-8e22f121a087', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'api/history.js:213',
          message: 'History DELETE start',
          data: {
            id,
            sessionId: item.session_id || null,
            actorType: actor.type,
            actorId: actor.id
          },
          runId: 'pre-fix',
          hypothesisId: 'H1',
          timestamp: Date.now()
        })
      }).catch(() => {});
      // #endregion

      // First, delete the history record itself
      const { error } = await supabase
        .from('chat_history')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('[history/[id]] Delete error:', error);
        return res.status(500).json({ error: 'Failed to delete', details: error.message });
      }

      // Then, unpublish any related community_posts so they disappear from Discover
      let relatedPosts = null;
      let unpublishError = null;
      if (item.session_id) {
        const { data: posts, error: postsError } = await supabase
          .from('community_posts')
          .select('id, is_public')
          .eq('session_id', item.session_id);
        if (!postsError) {
          relatedPosts = posts || [];
        }

        if (relatedPosts && relatedPosts.length > 0) {
          const { error: updateError } = await supabase
            .from('community_posts')
            .update({ is_public: false, updated_at: new Date().toISOString() })
            .eq('session_id', item.session_id);
          if (updateError) {
            unpublishError = updateError;
            console.error('[history/[id]] Failed to unpublish related community_posts:', updateError);
          }
        }
      }

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/9bfc82ef-eb42-4bc3-94ab-8e22f121a087', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'api/history.js:247',
          message: 'History DELETE done, community_posts state after unpublish',
          data: {
            id,
            sessionId: item.session_id || null,
            relatedPostCount: Array.isArray(relatedPosts) ? relatedPosts.length : null,
            relatedPostIds: Array.isArray(relatedPosts) ? relatedPosts.map(p => p.id).slice(0, 5) : null,
            relatedPostIsPublic: Array.isArray(relatedPosts) ? relatedPosts.map(p => p.is_public) : null,
            unpublishError: unpublishError ? unpublishError.message : null
          },
          runId: 'pre-fix',
          hypothesisId: 'H1',
          timestamp: Date.now()
        })
      }).catch(() => {});
      // #endregion

      console.log('[history/[id]] Deleted:', id);
      return res.status(200).json({ success: true, id });
    }

    if (req.method === 'PATCH') {
      // Update history (title, isPublic etc)
      const body = await parseBody(req);
      
      // Verify ownership
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

      // Update chat_history
      const updates = {};
      let publishTags = null;
      let communityCategoryName = null;
      if (body.title !== undefined) updates.title = body.title;
      if (body.isPublic !== undefined) updates.is_public = body.isPublic;
      if (body.contentJson !== undefined) updates.content_json = body.contentJson;
      if (body.previewImages !== undefined) updates.preview_images = body.previewImages;

      if (body.isPublic === true) {
        const contentForTags = body.contentJson ?? item.content_json ?? {};
        const items = contentForTags?.items || [];
        if (!items.length) {
          return res.status(400).json({
            error: 'Cannot publish',
            message: 'Cannot publish: the canvas is empty. Please add some content before publishing.'
          });
        }
        const titleForTags = body.title ?? item.title ?? 'Untitled';
        const canvasText = extractCanvasText(contentForTags, titleForTags, false);
        if (!canvasText || !String(canvasText).trim()) {
          return res.status(400).json({
            error: 'Cannot publish',
            message: 'Cannot publish: the canvas has no text or image/mindmap titles to generate tags and category. Please add some content before publishing.'
          });
        }
        publishTags = await generateSemanticTags(canvasText);
        updates.tags = publishTags;
        communityCategoryName = await classifyCommunityCategory(canvasText);
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

      // ========== Reference-Only Logic: sync to community_posts ==========
      if (body.isPublic !== undefined && item.session_id) {
        if (body.isPublic === true) {
          // Require guest ID when publishing
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
          
          // Public = true: upsert ref in community_posts (no content copy)
          // cover_image_url: same as Archive, prefer preview_images, derive from content_json.items if empty
          const coverImage = deriveCoverImage(data);
          
          // Get author_name (prefer authorDisplayName from frontend for guest first publish)
          let authorName = publishActor.name || `Guest-${publishActor.id.slice(-6)}`;
          if (body.authorDisplayName && typeof body.authorDisplayName === 'string' && body.authorDisplayName.trim()) {
            authorName = body.authorDisplayName.trim();
          } else if (publishActor.type === 'user') {
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

          // Ensure created_at has value
          const createdAt = item.created_at || item.timestamp || new Date().toISOString();
          
          const tagsForPublish = Array.isArray(publishTags)
            ? publishTags
            : filterSystemTags(data.tags || []);

          let communityTagId = null;
          if (communityCategoryName) {
            const { data: tagRow } = await supabase
              .from('community_tags')
              .select('id')
              .eq('name', communityCategoryName)
              .maybeSingle();
            if (tagRow?.id) communityTagId = tagRow.id;
          }

          console.log('[history/[id]] Upserting to community_posts:', {
            session_id: item.session_id,
            author_type: publishActor.type || 'guest',
            author_id: publishActor.id,
            author_name: authorName,
            title: data.title || 'Untitled',
            created_at: createdAt,
            communityCategoryName: communityCategoryName || undefined,
            communityTagId: communityTagId || undefined
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
              community_tag_id: communityTagId,
              created_at: createdAt,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'session_id',
              ignoreDuplicates: false  // Update existing records
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
          // Public = false: mark not public (keep record for audit)
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
        sessionId: data.session_id,
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
      // Get single history detail
      const { data, error } = await supabase
        .from('chat_history')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        return res.status(404).json({ error: 'Item not found' });
      }

      // If private, verify ownership
      if (!data.is_public && (data.owner_type !== actor.type || data.owner_id !== actor.id)) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      return res.status(200).json({
        id: data.id,
        sessionId: data.session_id,
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
