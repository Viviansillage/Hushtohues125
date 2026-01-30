import express from 'express';
import cors from 'cors';

// 支持本地开发环境
if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
  try {
    const dotenv = await import('dotenv');
    dotenv.default.config({ path: '.env.local' });
  } catch (e) {
    // dotenv 可能不存在，忽略
  }
}

import {
  getProfile,
  updateProfile,
  getHistory,
  createHistory,
  updateHistory,
  deleteHistory,
  getCommunityPosts,
  updatePostLikes,
  getCommunityTags,
  getFollowedCommunities,
  followCommunity,
  unfollowCommunity,
  getUserLikes,
  toggleLike,
  getUserBookmarks,
  toggleBookmark,
  getOrCreateDefaultProfile
} from './supabase.js';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '5mb' }));

const sendNotFound = (res, message) => {
  res.status(404).json({ error: message });
};

// ========== 健康检查 ==========
app.get('/api/health', (_req, res) => {
  const hasSupabaseUrl = !!(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
  const hasSupabaseKey = !!(process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY);
  
  res.json({ 
    status: 'ok',
    env: {
      hasSupabaseUrl,
      hasSupabaseKey,
      nodeEnv: process.env.NODE_ENV || 'development'
    }
  });
});

// ========== 用户配置 ==========
app.get('/api/profile', async (_req, res) => {
  try {
    const profile = await getProfile();
    res.json(profile);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/profile', async (req, res) => {
  try {
    const updated = await updateProfile(req.body);
    res.json(updated);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== 聊天历史 ==========
app.get('/api/history', async (_req, res) => {
  try {
    const history = await getHistory();
    res.json(history);
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/history', async (req, res) => {
  try {
    const newItem = await createHistory(req.body);
    res.status(201).json(newItem);
  } catch (error) {
    console.error('Create history error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/history/:id', async (req, res) => {
  try {
    const updated = await updateHistory(req.params.id, req.body);
    res.json(updated);
  } catch (error) {
    console.error('Update history error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/history/:id', async (req, res) => {
  try {
    await deleteHistory(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error('Delete history error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== 社区帖子 ==========
app.get('/api/community/posts', async (_req, res) => {
  try {
    const posts = await getCommunityPosts();
    res.json(posts);
  } catch (error) {
    console.error('Get community posts error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/community/posts/:id/like', async (req, res) => {
  try {
    const liked = await toggleLike('post', req.params.id);
    
    // 更新帖子点赞数
    const posts = await getCommunityPosts();
    const post = posts.find(p => p.id === req.params.id);
    if (post) {
      const newLikes = liked ? post.likes + 1 : Math.max(0, post.likes - 1);
      await updatePostLikes(req.params.id, newLikes);
      res.json({ liked, likes: newLikes });
    } else {
      sendNotFound(res, 'Post not found');
    }
  } catch (error) {
    console.error('Toggle like error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/community/posts/:id/bookmark', async (req, res) => {
  try {
    const bookmarked = await toggleBookmark(req.params.id);
    res.json({ bookmarked });
  } catch (error) {
    console.error('Toggle bookmark error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== 社区管理 ==========
app.get('/api/community', async (_req, res) => {
  try {
    const [allTags, followed, likes, bookmarks] = await Promise.all([
      getCommunityTags(),
      getFollowedCommunities(),
      getUserLikes(),
      getUserBookmarks()
    ]);
    
    const followedNames = followed.map(t => t.name);
    const recommended = allTags.filter(t => !followedNames.includes(t.name));
    
    res.json({
      followed,
      recommended,
      user: {
        likes,
        bookmarks
      }
    });
  } catch (error) {
    console.error('Get community error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/community/follow/:name', async (req, res) => {
  try {
    await followCommunity(req.params.name);
    
    const [allTags, followed, likes, bookmarks] = await Promise.all([
      getCommunityTags(),
      getFollowedCommunities(),
      getUserLikes(),
      getUserBookmarks()
    ]);
    
    const followedNames = followed.map(t => t.name);
    const recommended = allTags.filter(t => !followedNames.includes(t.name));
    
    res.json({
      followed,
      recommended,
      user: {
        likes,
        bookmarks
      }
    });
  } catch (error) {
    console.error('Follow community error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/community/unfollow/:name', async (req, res) => {
  try {
    await unfollowCommunity(req.params.name);
    
    const [allTags, followed, likes, bookmarks] = await Promise.all([
      getCommunityTags(),
      getFollowedCommunities(),
      getUserLikes(),
      getUserBookmarks()
    ]);
    
    const followedNames = followed.map(t => t.name);
    const recommended = allTags.filter(t => !followedNames.includes(t.name));
    
    res.json({
      followed,
      recommended,
      user: {
        likes,
        bookmarks
      }
    });
  } catch (error) {
    console.error('Unfollow community error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== 社区详情（简化版）==========
app.get('/api/community/:name', async (req, res) => {
  try {
    const followed = await getFollowedCommunities();
    const joined = followed.some(t => t.name === req.params.name);
    
    res.json({
      name: req.params.name,
      detail: {
        members: 1500,
        online: 72,
        posts: []
      },
      joined
    });
  } catch (error) {
    console.error('Get community detail error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/community/:name/join', async (req, res) => {
  try {
    const followed = await getFollowedCommunities();
    const isFollowed = followed.some(t => t.name === req.params.name);
    
    if (isFollowed) {
      await unfollowCommunity(req.params.name);
      res.json({ joined: false });
    } else {
      await followCommunity(req.params.name);
      res.json({ joined: true });
    }
  } catch (error) {
    console.error('Toggle join error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== 聊天功能 ==========
let chatMessages = []; // 临时存储在内存中，重启会丢失
let activeHistoryId = null;

app.get('/api/chat/messages', (_req, res) => {
  res.json(chatMessages);
});

app.post('/api/chat/message', async (req, res) => {
  try {
    const text = String(req.body.text || '').trim();
    if (!text) return res.status(400).json({ error: 'Message text required' });

    const now = new Date().toISOString();
    const userMessage = {
      id: `${Date.now()}-u`,
      text,
      sender: 'user',
      timestamp: now
    };
    chatMessages.push(userMessage);

    // TODO: 集成 Gemini API 生成真实回复
    const botMessage = {
      id: `${Date.now()}-b`,
      text: 'Got it! [v2026-01-29-20:00] I can turn that into a sketch, a prompt, or a clean summary. Want a mindmap or an image?',
      sender: 'bot',
      timestamp: new Date().toISOString()
    };
    chatMessages.push(botMessage);

    // 保存到历史
    const profile = await getProfile();
    if (profile.preferences?.saveHistory) {
      if (!activeHistoryId) {
        const titleBase = text.split(' ').slice(0, 4).join(' ');
        const title = titleBase.charAt(0).toUpperCase() + titleBase.slice(1);
        const newHistory = await createHistory({
          title,
          messageCount: 1,
          lastMessage: text,
          previewImages: [],
          isPublic: false,
          tags: [],
          timestamp: now
        });
        activeHistoryId = newHistory.id;
      } else {
        await updateHistory(activeHistoryId, {
          messageCount: chatMessages.filter(m => m.sender === 'user').length,
          lastMessage: text,
          timestamp: now
        });
      }
    }

    res.json({ messages: chatMessages });
  } catch (error) {
    console.error('Chat message error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/chat/artifact', async (req, res) => {
  try {
    const kind = String(req.body.kind || 'text').toLowerCase();
    const latestUser = [...chatMessages].reverse().find(msg => msg.sender === 'user');
    const seedText = latestUser ? latestUser.text : '';
    
    const titleBase = seedText ? seedText.split(' ').slice(0, 4).join(' ') : `${kind} capture`;
    const title = titleBase.charAt(0).toUpperCase() + titleBase.slice(1);
    
    const previewImages = [];
    if (kind === 'image') {
      previewImages.push('https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80');
    } else if (kind === 'mindmap') {
      previewImages.push('https://images.unsplash.com/photo-1506784983877-45594efa4cbe?auto=format&fit=crop&w=1200&q=80');
    }
    
    const newHistory = await createHistory({
      title,
      messageCount: 1,
      lastMessage: seedText || `Saved a ${kind} artifact.`,
      previewImages,
      isPublic: false,
      tags: kind === 'chat' ? [] : [kind],
      timestamp: new Date().toISOString()
    });

    const botMessage = {
      id: `${Date.now()}-a`,
      text: `Saved a ${kind} artifact to your archive.`,
      sender: 'bot',
      timestamp: new Date().toISOString()
    };
    chatMessages.push(botMessage);

    res.json({ history: newHistory, message: botMessage });
  } catch (error) {
    console.error('Chat artifact error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== 调试：捕获所有未匹配的路由 ==========
app.use((req, res) => {
  console.log('404 - Unmatched route:', req.method, req.url, req.path);
  res.status(404).json({ 
    error: 'Not Found',
    debug: {
      method: req.method,
      url: req.url,
      path: req.path,
      originalUrl: req.originalUrl
    }
  });
});

// ========== 初始化默认数据 ==========
async function initializeDefaultData() {
  try {
    await getOrCreateDefaultProfile();
    console.log('Default profile initialized');
  } catch (error) {
    console.error('Failed to initialize default data:', error);
  }
}

// ========== 导出 app 供 Vercel 使用 ==========
export default app;

// ========== 本地开发时启动服务器 ==========
// 仅在直接运行此文件时启动服务器（不是被导入时）
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('index-supabase.js')) {
  app.listen(port, async () => {
    console.log(`API server listening on port ${port}`);
    await initializeDefaultData();
  });
}
