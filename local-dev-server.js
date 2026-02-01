/**
 * 本地开发服务器 - 模拟 Vercel Serverless Functions
 * 用于在本地测试 API 端点而无需部署到 Vercel
 * 
 * 使用方法：
 * 1. 确保 .env 文件包含 SUPABASE_URL, SUPABASE_ANON_KEY, GEMINI_API_KEY
 * 2. 运行: node local-dev-server.js
 * 3. 访问: http://localhost:3001/api/chat?action=message
 */

import http from 'http';
import url from 'url';
import chatHandler from './api/chat.js';
import historyHandler from './api/history.js';
import 'dotenv/config';

const PORT = 3001;

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  console.log(`[Server] ${req.method} ${req.url}`);
  console.log(`[Server] Headers:`, JSON.stringify(req.headers, null, 2));

  // CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Guest-ID');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  try {
    // Route to appropriate handler
    if (pathname === '/api/chat') {
      await chatHandler(req, res);
    } else if (pathname === '/api/history') {
      await historyHandler(req, res);
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found', path: pathname }));
    }
  } catch (error) {
    console.error('[Server] Unhandled error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      error: 'Internal Server Error', 
      message: error.message,
      stack: error.stack 
    }));
  }
});

server.listen(PORT, () => {
  console.log(`✅ Local dev server running at http://localhost:${PORT}`);
  console.log(`📍 API endpoints:`);
  console.log(`   - POST http://localhost:${PORT}/api/chat?action=message`);
  console.log(`   - GET  http://localhost:${PORT}/api/chat?action=load&sessionId=xxx`);
  console.log(`   - POST http://localhost:${PORT}/api/chat?action=mindmap`);
  console.log(`   - POST http://localhost:${PORT}/api/chat?action=image`);
  console.log(`   - POST http://localhost:${PORT}/api/history?action=save`);
  console.log(`   - GET  http://localhost:${PORT}/api/history?action=list`);
  console.log(``);
  console.log(`🔑 Environment variables loaded:`);
  console.log(`   - SUPABASE_URL: ${process.env.SUPABASE_URL ? '✅' : '❌'}`);
  console.log(`   - SUPABASE_ANON_KEY: ${process.env.SUPABASE_ANON_KEY ? '✅' : '❌'}`);
  console.log(`   - GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? '✅' : '❌'}`);
  console.log(``);
  console.log(`💡 Test with: node test-api.js (after updating host to localhost:${PORT})`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use. Kill the process or use a different port.`);
  } else {
    console.error('❌ Server error:', err);
  }
  process.exit(1);
});
