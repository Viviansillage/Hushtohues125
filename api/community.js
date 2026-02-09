import { getCommunityMeta, getCommunityPosts, getActor, supabase, extractCanvasText, filterSystemTags, generateSemanticTags } from './supabase.js';

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
  console.log('[community.js] Handler called:', req.method, req.url);
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Guest-ID');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;
    
    // ========== Route 1: /api/community/like ==========
    if (pathname.includes('/like')) {
      return handleLike(req, res);
    }
    
    // ========== Route 2: /api/community (main route, use query params) ==========
    const discover = url.searchParams.get('discover');
    const posts = url.searchParams.get('posts');
    const action = url.searchParams.get('action');
    const postId = url.searchParams.get('postId');
    const communityName = url.searchParams.get('community');
    const sessionId = url.searchParams.get('sessionId');
    
    // ========== GET: action=detail (community detail - Reference-Only) ==========
    if (req.method === 'GET' && action === 'detail') {
      const postId = url.searchParams.get('postId');
      const sessionId = url.searchParams.get('sessionId');
      
      // Compatible with both params
      if (postId) {
        return handleCommunityDetailByPostId(req, res, postId);
      } else if (sessionId) {
        return handleCommunityDetail(req, res, sessionId);
      } else {
        return res.status(400).json({ error: 'postId or sessionId is required' });
      }
    }
    
    if (req.method === 'POST') {
      const body = await parseBody(req);
      
      // /api/community?action=publish
      if (action === 'publish') {
        return handlePublish(req, res, body);
      }
      
      // /api/community?action=follow
      if (action === 'follow') {
        const { name } = body;
        const actor = getActor(req);
        
        if (!name) {
          return res.status(400).json({ error: 'Community name is required' });
        }
        
        try {
          // 1. Find or create community_tag
          let { data: tag, error: tagError } = await supabase
            .from('community_tags')
            .select('id, member_count')
            .eq('name', name)
            .maybeSingle();
          
          if (tagError && tagError.code !== 'PGRST116') {
            throw tagError;
          }
          
          if (!tag) {
            const { data: newTag, error: createError } = await supabase
              .from('community_tags')
              .insert({ name: name, member_count: 1 })
              .select('id, member_count')
              .single();
            
            if (createError) throw createError;
            tag = newTag;
          }
          
          // 2. Upsert follow record (idempotent)
          const { error: upsertError } = await supabase
            .from('user_followed_communities')
            .upsert(
              {
                actor_type: actor.type,
                actor_id: actor.id,
                community_tag_id: tag.id,
                profile_id: actor.type === 'user' ? actor.id : null,
                created_at: new Date().toISOString()
              },
              {
                onConflict: 'actor_type,actor_id,community_tag_id',
                ignoreDuplicates: true
              }
            );
          
          if (upsertError) throw upsertError;
          
          // 3. Update member_count (if new follow)
          await supabase
            .from('community_tags')
            .update({ member_count: (tag.member_count || 0) + 1 })
            .eq('id', tag.id);
          
          // 4. Return latest data
          const meta = await getCommunityMeta(req);
          return res.status(200).json(meta);
        } catch (error) {
          console.error('Follow community error:', error);
          return res.status(500).json({ 
            error: 'Failed to follow community',
            details: error.message // Dev env detailed error
          });
        }
      }
      
      // /api/community?action=unfollow
      if (action === 'unfollow') {
        const { name } = body;
        const actor = getActor(req);
        
        if (!name) {
          return res.status(400).json({ error: 'Community name is required' });
        }
        
        try {
          // 1. Find community_tag
          const { data: tag, error: tagError } = await supabase
            .from('community_tags')
            .select('id, member_count')
            .eq('name', name)
            .maybeSingle();
          
          if (tagError && tagError.code !== 'PGRST116') {
            throw tagError;
          }
          
          if (!tag) {
            // Tag not found, already unfollowed
            const meta = await getCommunityMeta(req);
            return res.status(200).json(meta);
          }
          
          // 2. Delete follow record
          const { error: deleteError } = await supabase
            .from('user_followed_communities')
            .delete()
            .eq('actor_type', actor.type)
            .eq('actor_id', actor.id)
            .eq('community_tag_id', tag.id);
          
          if (deleteError) throw deleteError;
          
          // 3. Update member_count
          if (tag.member_count > 0) {
            await supabase
              .from('community_tags')
              .update({ member_count: tag.member_count - 1 })
              .eq('id', tag.id);
          }
          
          // 4. Return latest data
          const meta = await getCommunityMeta(req);
          return res.status(200).json(meta);
        } catch (error) {
          console.error('Unfollow community error:', error);
          return res.status(500).json({ 
            error: 'Failed to unfollow community',
            details: error.message
          });
        }
      }
      
      // /api/community?action=bookmark&postId=xxx
      if (action === 'bookmark' && postId) {
        // Mock: return bookmark state
        return res.status(200).json({ bookmarked: true });
      }
      
      // /api/community?action=join&community=xxx
      if (action === 'join' && communityName) {
        const actor = getActor(req);
        
        try {
          // 1. Find or create community_tag
          let { data: tag, error: tagError } = await supabase
            .from('community_tags')
            .select('id, member_count')
            .eq('name', communityName)
            .maybeSingle();
          
          if (tagError && tagError.code !== 'PGRST116') {
            throw tagError;
          }
          
          if (!tag) {
            const { data: newTag, error: createError } = await supabase
              .from('community_tags')
              .insert({ name: communityName, member_count: 1 })
              .select('id, member_count')
              .single();
            
            if (createError) throw createError;
            tag = newTag;
          }
          
          // 2. Check if already joined
          const { data: existing, error: checkError } = await supabase
            .from('user_followed_communities')
            .select('id')
            .eq('actor_type', actor.type)
            .eq('actor_id', actor.id)
            .eq('community_tag_id', tag.id)
            .maybeSingle();
          
          if (checkError && checkError.code !== 'PGRST116') {
            throw checkError;
          }
          
          if (existing) {
            return res.status(200).json({ joined: true, alreadyJoined: true });
          }
          
          // 3. Upsert join record (idempotent)
          const { error: upsertError } = await supabase
            .from('user_followed_communities')
            .upsert(
              {
                actor_type: actor.type,
                actor_id: actor.id,
                community_tag_id: tag.id,
                profile_id: actor.type === 'user' ? actor.id : null,
                created_at: new Date().toISOString()
              },
              {
                onConflict: 'actor_type,actor_id,community_tag_id',
                ignoreDuplicates: true
              }
            );
          
          if (upsertError) throw upsertError;
          
          // 4. Update member_count
          await supabase
            .from('community_tags')
            .update({ member_count: (tag.member_count || 0) + 1 })
            .eq('id', tag.id);
          
          return res.status(200).json({ joined: true, alreadyJoined: false });
        } catch (error) {
          console.error('Join community error:', error);
          return res.status(500).json({ 
            error: 'Failed to join community',
            details: error.message
          });
        }
      }
    }
    
    if (req.method === 'GET') {
      // /api/community?posts=true - Get all community posts
      if (posts === 'true' || req.url?.includes('posts')) {
        const allPosts = await getCommunityPosts();
        return res.status(200).json(allPosts);
      }
      
      // ========== Discover Feed: Pure community_posts view ==========
      if (discover === 'true' || req.url?.includes('discover')) {
        const communityParam = url.searchParams.get('community');
        console.log('[Discover List] 🔍 Querying community_posts...', communityParam ? { community: communityParam } : '');
        
        let query = supabase
          .from('community_posts')
          .select('id, session_id, author_name, author_type, author_id, title, cover_image_url, tags, created_at, likes, comments, community_tag_id')
          .eq('is_public', true)
          .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(50);
        if (communityParam && communityParam.trim()) {
          const { data: tagRow } = await supabase
            .from('community_tags')
            .select('id')
            .eq('name', communityParam.trim())
            .maybeSingle();
          if (tagRow?.id) query = query.eq('community_tag_id', tagRow.id);
        }
        const { data: publicPosts, error: postsError } = await query;
        
        if (postsError) {
          console.error('[Discover List] ❌ DB error:', postsError);
          return res.status(200).json([]);
        }
        
        if (!publicPosts || publicPosts.length === 0) {
          console.log('[Discover List] No public posts found');
          return res.status(200).json([]);
        }

        console.log('[Discover List] ✅ Found', publicPosts.length, 'public posts from community_posts (raw)');
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/9bfc82ef-eb42-4bc3-94ab-8e22f121a087', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: 'api/community.js:319',
            message: 'Discover feed loaded from community_posts (raw)',
            data: {
              totalPosts: publicPosts.length,
              samplePostIds: publicPosts.slice(0, 5).map(p => p.id)
            },
            runId: 'pre-fix',
            hypothesisId: 'H1',
            timestamp: Date.now()
          })
        }).catch(() => {});
        // #endregion

        // Extra safety: filter out orphan posts whose archive has been deleted
        // Hypothesis H2: there may be community_posts.is_public=true but no corresponding chat_history
        let filteredPosts = publicPosts;
        try {
          const sessionIds = Array.from(
            new Set(
              (publicPosts || [])
                .map(p => p.session_id)
                .filter(Boolean)
            )
          );

          if (sessionIds.length > 0) {
            const { data: histories, error: historyError } = await supabase
              .from('chat_history')
              .select('session_id')
              .in('session_id', sessionIds);

            if (historyError) {
              console.warn('[Discover List] ⚠️ Failed to load chat_history for orphan filter:', historyError.message);
            } else {
              const validSessionSet = new Set((histories || []).map(h => h.session_id));
              const orphanSessionIds = sessionIds.filter(id => !validSessionSet.has(id));

              // 1) Filter orphan posts from frontend result
              filteredPosts = publicPosts.filter(p => validSessionSet.has(p.session_id));

              // 2) Mark orphan posts as is_public=false in DB so they are not returned again
              if (orphanSessionIds.length > 0) {
                const { error: orphanUpdateError } = await supabase
                  .from('community_posts')
                  .update({ is_public: false, updated_at: new Date().toISOString() })
                  .in('session_id', orphanSessionIds);

                if (orphanUpdateError) {
                  console.warn('[Discover List] ⚠️ Failed to unpublish orphan posts:', orphanUpdateError.message);
                } else {
                  console.log('[Discover List] 🧹 Orphan posts unpublished:', {
                    orphanSessionCount: orphanSessionIds.length
                  });
                }
              }

              console.log('[Discover List] 🧹 Orphan filter applied:', {
                before: publicPosts.length,
                after: filteredPosts.length
              });

              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/9bfc82ef-eb42-4bc3-94ab-8e22f121a087', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  location: 'api/community.js:341',
                  message: 'Discover orphan filter result (with persistent unpublish)',
                  data: {
                    totalBefore: publicPosts.length,
                    totalAfter: filteredPosts.length,
                    orphanSessionCount: orphanSessionIds.length
                  },
                  runId: 'pre-fix',
                  hypothesisId: 'H2',
                  timestamp: Date.now()
                })
              }).catch(() => {});
              // #endregion
            }
          }
        } catch (orphanError) {
          console.warn('[Discover List] ⚠️ Orphan filter crashed, returning raw posts:', orphanError);
          filteredPosts = publicPosts;
        }
        
        // ✅ Log each record for debugging (after orphan filter)
        filteredPosts.forEach((p, idx) => {
          console.log(`[Discover List] [${idx}] postId=${p.id?.slice(0,8)}, session_id=${p.session_id}, author=${p.author_name || p.author_id?.slice(0,8)}`);
        });

        // ✅ Format response - use created_at consistently
        const formatted = filteredPosts.map(post => ({
          id: post.id,  // ✅ community_posts.id (uuid) - ONLY valid postId
          title: post.title || 'Untitled',
          author: { 
            name: post.author_name || `Guest-${post.author_id?.slice(0, 8) || 'Unknown'}`,
            id: post.author_id,
            type: post.author_type
          },
          imageUrl: post.cover_image_url || null,
          likes: post.likes || 0,
          comments: post.comments || 0,
          timestamp: post.created_at,  // ✅ Use created_at consistently
          tags: filterSystemTags(post.tags || []),
          communityName: null  // optional: resolve from community_tag_id if needed
        }));
        
        console.log('[Discover List] ✅ Returning', formatted.length, 'posts');
        return res.status(200).json(formatted);
      }
      
      // Default return community meta
      const meta = await getCommunityMeta(req);
      return res.status(200).json(meta);
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Community API error:', error);
    res.status(500).json({ error: error.message });
  }
}

// ========== Handler: /api/community/like ==========
async function handleLike(req, res) {
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const actor = getActor(req);
    const body = await parseBody(req);
    
    const { postId, targetType = 'post', targetId } = body;
    const finalTargetId = targetId || postId;
    
    if (!finalTargetId) {
      return res.status(400).json({ error: 'postId or targetId is required' });
    }
    
    if (req.method === 'POST') {
      // Like (idempotent)
      const { data: existing, error: checkError } = await supabase
        .from('user_likes')
        .select('id')
        .eq('actor_type', actor.type)
        .eq('actor_id', actor.id)
        .eq('target_type', targetType)
        .eq('target_id', finalTargetId)
        .maybeSingle();
      
      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }
      
      if (existing) {
        let currentLikes = null;
        if (targetType === 'post') {
          const { data: post } = await supabase
            .from('community_posts')
            .select('likes')
            .eq('id', finalTargetId)
            .maybeSingle();
          currentLikes = post?.likes ?? null;
        }
        
        return res.status(200).json({ 
          message: 'Already liked',
          alreadyLiked: true,
          likes: currentLikes
        });
      }
      
      const { error: insertError } = await supabase
        .from('user_likes')
        .insert({
          actor_type: actor.type,
          actor_id: actor.id,
          target_type: targetType,
          target_id: finalTargetId,
          created_at: new Date().toISOString()
        });
      
      if (insertError) {
        if (insertError.code === '23505') {
          return res.status(200).json({ 
            message: 'Already liked',
            alreadyLiked: true 
          });
        }
        throw insertError;
      }
      
      let newLikes = null;
      if (targetType === 'post') {
        const { data: post } = await supabase
          .from('community_posts')
          .select('likes')
          .eq('id', finalTargetId)
          .maybeSingle();
        
        if (post) {
          const updatedLikes = (post.likes || 0) + 1;
          await supabase
            .from('community_posts')
            .update({ likes: updatedLikes })
            .eq('id', finalTargetId);
          newLikes = updatedLikes;
        }
      }
      
      return res.status(201).json({ 
        message: 'Liked successfully',
        alreadyLiked: false,
        likes: newLikes
      });
    }
    
    if (req.method === 'DELETE') {
      const { error: deleteError } = await supabase
        .from('user_likes')
        .delete()
        .eq('actor_type', actor.type)
        .eq('actor_id', actor.id)
        .eq('target_type', targetType)
        .eq('target_id', finalTargetId);
      
      if (deleteError) throw deleteError;
      
      let newLikes = null;
      if (targetType === 'post') {
        const { data: post } = await supabase
          .from('community_posts')
          .select('likes')
          .eq('id', finalTargetId)
          .maybeSingle();
        
        if (post && post.likes > 0) {
          const updatedLikes = post.likes - 1;
          await supabase
            .from('community_posts')
            .update({ likes: updatedLikes })
            .eq('id', finalTargetId);
          newLikes = updatedLikes;
        }
      }
      
      return res.status(200).json({ 
        message: 'Unliked successfully',
        likes: newLikes
      });
    }
  } catch (error) {
    console.error('Like API error:', error);
    res.status(500).json({ error: error.message });
  }
}

// ========== Handler: Publish (unified route action=publish) ==========
async function handlePublish(req, res, body) {
  try {
    const actor = getActor(req, { requireGuestId: true });  // Require guest_id
    
    // ✅ CRITICAL: Enforce X-Guest-ID for all publish operations
    if (actor.error === 'MISSING_GUEST_ID' || !actor.id) {
      console.error('[handlePublish] ❌ Missing X-Guest-ID header');
      return res.status(400).json({ 
        error: 'Missing X-Guest-ID header',
        details: 'Publishing requires a stable guest identity. Please ensure your browser allows localStorage and refresh the page.'
      });
    }
    
    console.log('[handlePublish] 📤 Request:', { 
      body: { sessionId: body.sessionId || body.historyId, title: body.title },
      actor: { type: actor.type, id: actor.id?.slice(0, 8) } 
    });
    
    // Reference-Only: accept sessionId/historyId
    const { sessionId, historyId } = body;
    let finalSessionId = sessionId || historyId;
    
    if (!finalSessionId) {
      return res.status(400).json({ error: 'sessionId or historyId is required' });
    }
    
    // Key fix: if UUID (history.id), resolve to session_id first
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(finalSessionId);
    
    if (isUUID) {
      console.log('[handlePublish] Detected UUID, resolving to session_id...');
      // Passed chat_history.id (UUID), query for session_id
      const { data: historyById, error: resolveError } = await supabase
        .from('chat_history')
        .select('session_id, title, is_public, content_json')
        .eq('id', finalSessionId)
        .maybeSingle();
      
      if (resolveError || !historyById) {
        console.error('[handlePublish] Failed to resolve UUID to session_id:', resolveError);
        return res.status(404).json({ 
          error: 'Archive not found by ID',
          details: 'Cannot find chat_history record with this UUID'
        });
      }
      
      finalSessionId = historyById.session_id;
      console.log('[handlePublish] Resolved UUID to session_id:', finalSessionId);
    }
    
    // 1. Verify session exists
    const { data: history, error: historyError } = await supabase
      .from('chat_history')
      .select('session_id, title, is_public, content_json')
      .eq('session_id', finalSessionId)
      .maybeSingle();
    
    if (historyError || !history) {
      console.error('[handlePublish] Archive session not found:', { finalSessionId, historyError });
      return res.status(404).json({ error: 'Archive session not found' });
    }
    
    // Set chat_history.is_public = true when publishing
    if (!history.is_public) {
      console.log('[handlePublish] Setting history.is_public to true');
      const { error: updateHistoryError } = await supabase
        .from('chat_history')
        .update({ is_public: true })
        .eq('session_id', finalSessionId);
      
      if (updateHistoryError) {
        console.error('[handlePublish] Failed to update history.is_public:', updateHistoryError);
        return res.status(500).json({ error: 'Failed to update archive visibility' });
      }
    }

    const items = history.content_json?.items || [];
    if (!items.length) {
      return res.status(400).json({
        error: 'Cannot publish',
        message: 'Cannot publish: the canvas is empty. Please add some content before publishing.'
      });
    }
    const titleForTags = body.title || history.title || 'Untitled';
    const canvasText = extractCanvasText(history.content_json, titleForTags, false);
    if (!canvasText || !String(canvasText).trim()) {
      return res.status(400).json({
        error: 'Cannot publish',
        message: 'Cannot publish: the canvas has no text or image/mindmap titles to generate tags and category. Please add some content before publishing.'
      });
    }
    const semanticTags = await generateSemanticTags(canvasText);

    const { error: updateTagsError } = await supabase
      .from('chat_history')
      .update({ tags: semanticTags })
      .eq('session_id', finalSessionId);

    if (updateTagsError) {
      console.warn('[handlePublish] Failed to update history tags:', updateTagsError);
    }
    
    // 2. Get author name
    let authorName = actor.name || `Guest-${actor.id.slice(-6)}`;
    if (actor.type === 'user') {
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_name, display_name')
        .eq('id', actor.id)
        .maybeSingle();
      authorName = profile?.display_name || profile?.user_name || 'User';
    }
    
    // 3. ✅ Upsert community_posts (onConflict: session_id)
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('community_posts')
      .upsert(
        {
          session_id: finalSessionId,  // ✅ Unique key
          author_type: actor.type || 'guest',
          author_id: actor.id,
          author_name: authorName,
          is_public: true,
          title: body.title || history.title || 'Untitled',
          cover_image_url: body.coverImageUrl || body.cover_image_url || null,
          tags: semanticTags,
          created_at: now  // ✅ Use created_at (will be ignored on update if column has default)
        },
        {
          onConflict: 'session_id',  // ✅ Upsert by session_id
          ignoreDuplicates: false     // Update existing record
        }
      )
      .select('id, session_id, created_at')
      .single();

    if (error) {
      console.error('[Publish] DB error:', error);
      return res.status(500).json({ error: 'Failed to publish', details: error.message });
    }
    
    console.log('[Publish] ✅ Success:', { 
      postId: data.id,
      sessionId: data.session_id,
      guestId: actor.id?.slice(0, 8),
      historyId: finalSessionId,
      title: data.title
    });
    
    return res.status(201).json({
      ok: true,
      postId: data.id,      // postId for frontend (community_posts.id)
      id: data.id,          // compat field
      sessionId: data.session_id,  // referenced historyId
      timestamp: data.created_at  // ✅ Use created_at
    });
  } catch (error) {
    console.error('Publish API error:', error);
    res.status(500).json({ error: error.message });
  }
}

// ========== Handler: Community Detail by PostId (Reference-Only) ==========
async function handleCommunityDetailByPostId(req, res, postId) {
  try {
    const actor = getActor(req);
    console.log('[Community Detail] 📥 Request postId:', postId, 'actor:', actor.type);
    
    // ✅ ONLY accept community_posts.id (uuid) - no fallback to session_id/history_id
    // Query: SELECT * FROM community_posts WHERE id=postId AND is_public=true
    const { data: communityPost, error: postError } = await supabase
      .from('community_posts')
      .select('id, session_id, author_name, author_type, author_id, created_at, title, tags, likes, comments, community_tag_id')
      .eq('id', postId)
      .eq('is_public', true)
      .maybeSingle();
    
    if (postError) {
      console.error('[Community Detail] ❌ DB error:', postError);
      return res.status(500).json({ error: 'Database error', details: postError.message });
    }
    
    if (!communityPost) {
      // ✅ Explicit 404 with clear message
      console.error('[Community Detail] ❌ detail miss: postId=', postId, 'table=community_posts, filter: is_public=true');
      return res.status(404).json({ 
        error: 'Community post not found or not public',
        details: `No public post found with id=${postId} in community_posts table. Ensure you are using community_posts.id (not session_id).`,
        postId: postId
      });
    }
    
    console.log('[Community Detail] ✅ Found post:', {
      id: communityPost.id,
      session_id: communityPost.session_id,
      author: communityPost.author_name || communityPost.author_id?.slice(0, 8)
    });

    // 2. Query history by session_id (historyId)
    const historyId = communityPost.session_id;
    console.log('[CommunityDetail] Querying history with session_id:', historyId);
    
    const { data: history, error: historyError } = await supabase
      .from('chat_history')
      .select('*')
      .eq('session_id', historyId)
      .maybeSingle();
    
    if (historyError || !history) {
      console.error('[CommunityDetail] History not found:', { historyId, error: historyError });
      return res.status(404).json({ error: 'Archive data not found' });
    }
    
    console.log('[CommunityDetail] Found history:', {
      session_id: history.session_id,
      title: history.title,
      is_public: history.is_public
    });
    
    // ✅ Note: We don't check history.is_public here
    // If community_posts.is_public=true, the content is public regardless of history status
    // (history might be unpublished but community post remains)

    // 3. Read saved artifacts from chat_history.content_json.artifacts
    // Fix: only show user Save content, match Archive detail
    const savedArtifacts = history.content_json?.artifacts || [];
    
    console.log('[CommunityDetail] Found saved artifacts:', {
      count: savedArtifacts.length,
      types: savedArtifacts.map(a => a.type)
    });

    // 4. Query messages
    const { data: messages, error: messagesError } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', communityPost.session_id)
      .order('timestamp', { ascending: true });
    
    if (messagesError) {
      console.error('[CommunityDetail] Messages query error:', messagesError);
    }

    // 5. Partition name (for display and follow check) and joined
    let communityName = null;
    if (communityPost.community_tag_id) {
      const { data: tagRow } = await supabase
        .from('community_tags')
        .select('name')
        .eq('id', communityPost.community_tag_id)
        .maybeSingle();
      if (tagRow?.name) communityName = tagRow.name;
    }
    let joined = false;
    if (communityPost.community_tag_id) {
      const { data: existing } = await supabase
        .from('user_followed_communities')
        .select('id')
        .eq('actor_type', actor.type)
        .eq('actor_id', actor.id)
        .eq('community_tag_id', communityPost.community_tag_id)
        .maybeSingle();
      joined = !!existing;
    }

    // 6. Build canvas data from chat_history.content_json.artifacts
    // Only include user Save images and mindmap
    const images = savedArtifacts
      .filter(a => a.type === 'image')
      .map(a => a.data?.imageUrl)
      .filter(Boolean);
    
    const mindmaps = savedArtifacts
      .filter(a => a.type === 'mindmap')
      .map(a => ({
        mermaidCode: a.data?.mermaidCode || a.data?.code || '',
        title: a.data?.title,
        summary: a.data?.summary
      }));

    const canvasData = {
      postId: communityPost.id,
      historyId: history.session_id,
      sessionId: history.session_id,  // compat
      title: history.title || communityPost.title || 'Untitled',
      author: {
        name: communityPost.author_name || `Guest-${communityPost.author_id?.slice(0, 8) || 'Unknown'}`,
        type: communityPost.author_type || 'guest',
        id: communityPost.author_id
      },
      images,
      mindmaps,
      messages: messages || [],
      content: history.content_json?.content || '',
      contentJson: history.content_json || null,  // ✅ Pass complete contentJson with layout
      tags: filterSystemTags(history.tags || communityPost.tags || []),
      communityName: communityName || null,
      isPublic: true,
      readOnly: true,
      stats: {
        likes: communityPost.likes || 0,
        comments: communityPost.comments || 0,
        views: 0
      },
      timestamp: communityPost.created_at || history.updated_at  // ✅ Use created_at
    };

    console.log('[CommunityDetail] Success - returning canvas:', {
      postId: communityPost.id,
      historyId: history.session_id,
      title: canvasData.title,
      images: images.length,
      mindmaps: mindmaps.length,
      messages: messages?.length || 0,
      author: canvasData.author.name
    });

    console.log('[CommunityDetail] ✅ Returning detail:', {
      canonicalPostId: communityPost.id,
      sessionId: history.session_id
    });
    
    return res.status(200).json({
      post: {
        id: communityPost.id,
        historyId: history.session_id,
        authorId: communityPost.author_id,
        createdAt: communityPost.created_at
      },
      canonicalPostId: communityPost.id,  // \u2705 Frontend should use this for routing
      detail: canvasData,
      joined
    });

  } catch (error) {
    console.error('[CommunityDetail] Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

// ========== Handler: Community Detail (Reference-Only) - legacy compat ==========
async function handleCommunityDetail(req, res, sessionId) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const actor = getActor(req);
    console.log('[handleCommunityDetail] Request:', { 
      sessionId, 
      actor: { type: actor.type, id: actor.id.slice(0, 8) + '...' }
    });
    
    // 1. Verify session is published as public (incl. community_tag_id for partition)
    const { data: publicRef, error: refError } = await supabase
      .from('community_posts')
      .select('session_id, author_name, author_type, author_id, likes, comments, views, created_at, community_tag_id')
      .eq('session_id', sessionId)
      .eq('is_public', true)
      .maybeSingle();
    
    if (refError && refError.code !== 'PGRST116') {
      console.error('[handleCommunityDetail] Reference query error:', refError);
      return res.status(500).json({ error: refError.message });
    }
    
    if (!publicRef) {
      return res.status(404).json({ error: 'Community post not found or not public' });
    }

    // 2. Query archive (chat_history)
    const { data: archive, error: archiveError } = await supabase
      .from('chat_history')
      .select('*')
      .eq('session_id', sessionId)
      .maybeSingle();
    
    if (archiveError || !archive) {
      console.error('[handleCommunityDetail] Archive not found:', archiveError);
      return res.status(404).json({ error: 'Archive data not found' });
    }

    // 3. Read saved artifacts from chat_history.content_json.artifacts
    // Fix: only show user Save content, match Archive detail
    const savedArtifacts = archive.content_json?.artifacts || [];
    
    console.log('[handleCommunityDetail] Found saved artifacts:', {
      count: savedArtifacts.length,
      types: savedArtifacts.map(a => a.type)
    });

    // 4. Query all messages for session
    const { data: messages, error: messagesError } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: true });
    
    if (messagesError) {
      console.error('[handleCommunityDetail] Messages query error:', messagesError);
    }

    // 5. Partition name and joined
    let communityName = null;
    if (publicRef.community_tag_id) {
      const { data: tagRow } = await supabase
        .from('community_tags')
        .select('name')
        .eq('id', publicRef.community_tag_id)
        .maybeSingle();
      if (tagRow?.name) communityName = tagRow.name;
    }
    let joined = false;
    if (publicRef.community_tag_id) {
      const { data: existing } = await supabase
        .from('user_followed_communities')
        .select('id')
        .eq('actor_type', actor.type)
        .eq('actor_id', actor.id)
        .eq('community_tag_id', publicRef.community_tag_id)
        .maybeSingle();
      joined = !!existing;
    }

    // 6. Build canvas data from chat_history.content_json.artifacts
    // Only include user Save images and mindmap
    const images = savedArtifacts
      .filter(a => a.type === 'image')
      .map(a => a.data?.imageUrl)
      .filter(Boolean);
    
    const mindmaps = savedArtifacts
      .filter(a => a.type === 'mindmap')
      .map(a => ({
        mermaidCode: a.data?.mermaidCode || a.data?.code || '',
        title: a.data?.title,
        summary: a.data?.summary
      }));

    // 7. Build full canvas data (match ArchiveDetail)
    const canvasData = {
      sessionId: archive.session_id,
      title: archive.title || 'Untitled',
      author: {
        name: publicRef.author_name,
        type: publicRef.author_type,
        id: publicRef.author_id
      },
      images,
      mindmaps,
      messages: messages || [],
      content: archive.content_json?.content || '',
      tags: filterSystemTags(archive.tags || []),
      communityName: communityName || null,
      isPublic: true,
      readOnly: true,
      stats: {
        likes: publicRef.likes || 0,
        comments: publicRef.comments || 0,
        views: publicRef.views || 0
      },
      timestamp: publicRef.created_at  // ✅ Use created_at
    };

    // 8. Return data
    console.log('[handleCommunityDetail] Success:', {
      sessionId,
      title: canvasData.title,
      images: images.length,
      mindmaps: mindmaps.length,
      messages: messages?.length || 0
    });

    return res.status(200).json({
      detail: canvasData,
      joined
    });

  } catch (error) {
    console.error('[handleCommunityDetail] Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
