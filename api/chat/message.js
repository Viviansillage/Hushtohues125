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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'POST') {
      const body = await parseBody(req);
      const { text } = body;
      const now = new Date().toISOString();
      
      const messages = [
        { id: `${Date.now()}-u`, text, sender: 'user', timestamp: now },
        { id: `${Date.now()}-b`, text: 'Got it! [v2026-01-29-20:00] I can turn that into a sketch, a prompt, or a clean summary. Want a mindmap or an image?', sender: 'bot', timestamp: now }
      ];
      
      return res.status(200).json({ messages });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Chat message API error:', error);
    res.status(500).json({ error: error.message });
  }
}
