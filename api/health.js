import { getOrCreateDefaultProfile } from './supabase.js';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    await getOrCreateDefaultProfile();

    return res.status(200).json({
      status: 'ok',
      env: {
        hasSupabaseUrl: !!(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
        hasSupabaseKey: !!(process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY),
        nodeEnv: process.env.NODE_ENV || 'production'
      }
    });
  } catch (error) {
    console.error('Health check error:', error);
    return res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
}
