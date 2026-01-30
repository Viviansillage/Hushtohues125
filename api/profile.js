import { getProfile, updateProfile, getActor } from './supabase.js';

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
      // Guest 返回临时 profile
      if (actor.type === 'guest') {
        const guestProfile = {
          userName: `Guest-${actor.id.slice(-6)}`,
          userHandle: `@guest_${actor.id.slice(-6)}`,
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${actor.id}`,
          preferences: {},
          isGuest: true
        };
        return res.status(200).json(guestProfile);
      }
      
      // User 查询数据库
      const profile = await getProfile();
      return res.status(200).json({ ...profile, isGuest: false });
    }
    
    if (req.method === 'PUT') {
      // Guest 不允许修改 profile（或存到 localStorage）
      if (actor.type === 'guest') {
        return res.status(403).json({ error: 'Guest cannot update profile' });
      }
      
      const body = await parseBody(req);
      const updated = await updateProfile(body);
      return res.status(200).json({ ...updated, isGuest: false });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Profile API error:', error);
    res.status(500).json({ error: error.message });
  }
}
