export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      // Vercel 的动态路由会把社区名传入 query
      const { name } = req.query;
      
      if (!name) {
        return res.status(400).json({ error: 'Community name required' });
      }

      // 返回模拟的社区详情数据
      return res.status(200).json({
        name: name,
        detail: {
          members: Math.floor(Math.random() * 5000) + 1000,
          online: Math.floor(Math.random() * 100) + 20,
          posts: [] // 社区详情页的帖子列表，暂时为空
        },
        joined: false // 默认未加入
      });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Community detail API error:', error);
    res.status(500).json({ error: error.message });
  }
}
