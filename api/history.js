import { getHistory } from './supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const history = await getHistory();
      return res.status(200).json(history);
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('History API error:', error);
    res.status(500).json({ error: error.message });
  }
}
