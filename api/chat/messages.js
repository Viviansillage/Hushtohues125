// 临时存储聊天消息（serverless 环境会在每次调用后重置）
// 生产环境应该存储到 Supabase
let chatMessages = [];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      return res.status(200).json(chatMessages);
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Chat messages API error:', error);
    res.status(500).json({ error: error.message });
  }
}
