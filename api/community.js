import { getCommunityTags, getFollowedCommunities, getUserLikes, getUserBookmarks } from './supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const [allTags, followed, likes, bookmarks] = await Promise.all([
        getCommunityTags(),
        getFollowedCommunities(),
        getUserLikes(),
        getUserBookmarks()
      ]);
      
      const followedNames = followed.map(t => t.name);
      const recommended = allTags.filter(t => !followedNames.includes(t.name));
      
      return res.status(200).json({
        followed,
        recommended,
        user: {
          likes,
          bookmarks
        }
      });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Community API error:', error);
    res.status(500).json({ error: error.message });
  }
}
