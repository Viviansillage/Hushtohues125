import { getProfile, updateProfile, getActor, supabase } from './supabase.js';

/**
 * Validate nickname format
 * - 3-20 chars
 * - Letters, digits, underscore only
 */
function validateGuestName(name) {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Name is required' };
  }
  
  const trimmed = name.trim();
  
  if (trimmed.length < 3) {
    return { valid: false, error: 'Name must be at least 3 characters' };
  }
  
  if (trimmed.length > 20) {
    return { valid: false, error: 'Name must be at most 20 characters' };
  }
  
  // Letters, digits, underscore only
  const validPattern = /^[a-zA-Z0-9_]+$/;
  if (!validPattern.test(trimmed)) {
    return { valid: false, error: 'Name can only contain letters, numbers, and underscores' };
  }
  
  return { valid: true, name: trimmed };
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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Guest-ID');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const actor = getActor(req);
    
    if (req.method === 'GET') {
      // Guest: read custom nickname from DB (if any)
      if (actor.type === 'guest' && actor.id) {
        // Query if guest has custom nickname (latest author_name from community_posts)
        const { data: posts } = await supabase
          .from('community_posts')
          .select('author_name')
          .eq('author_id', actor.id)
          .order('updated_at', { ascending: false })
          .limit(1);
        
        const customName = posts && posts.length > 0 ? posts[0].author_name : null;
        const displayName = customName || `Guest-${actor.id.slice(-6)}`;
        
        const guestProfile = {
          userName: displayName,
          userHandle: `@guest_${actor.id.slice(-6)}`,
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${actor.id}`,
          preferences: {},
          isGuest: true
        };
        return res.status(200).json(guestProfile);
      }
      
      // User: query DB
      const profile = await getProfile();
      return res.status(200).json({ ...profile, isGuest: false });
    }
    
    if (req.method === 'PUT') {
      const body = await parseBody(req);
      
      // Guest can update nickname (save to DB)
      if (actor.type === 'guest') {
        if (!actor.id) {
          return res.status(401).json({ error: 'Missing guest ID' });
        }
        
        // Only allow userName update
        if (!body.userName) {
          return res.status(400).json({ error: 'userName is required' });
        }
        
        // Validate nickname format
        const validation = validateGuestName(body.userName);
        if (!validation.valid) {
          return res.status(400).json({ error: validation.error });
        }
        
        const newName = validation.name;
        
        // Update nickname for all posts by this guest
        const { error: updateError } = await supabase
          .from('community_posts')
          .update({ 
            author_name: newName,
            updated_at: new Date().toISOString()
          })
          .eq('author_id', actor.id);
        
        if (updateError) {
          console.error('[profile.js] Failed to update guest name:', updateError);
          return res.status(500).json({ error: 'Failed to update name' });
        }
        
        // Also update chat_history records (if relevant fields exist)
        
        console.log(`[✅ profile.js] Updated guest name: ${actor.id.slice(-8)} -> ${newName}`);
        
        // Return updated profile
        const updatedProfile = {
          userName: newName,
          userHandle: `@guest_${actor.id.slice(-6)}`,
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${actor.id}`,
          preferences: body.preferences || {},
          isGuest: true
        };
        
        return res.status(200).json(updatedProfile);
      }
      
      // User update profile
      const updated = await updateProfile(body);
      return res.status(200).json({ ...updated, isGuest: false });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Profile API error:', error);
    res.status(500).json({ error: error.message });
  }
}
