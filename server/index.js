const express = require('express');
const cors = require('cors');
const { loadDb, saveDb } = require('./data');

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '5mb' }));

const sendNotFound = (res, message) => {
  res.status(404).json({ error: message });
};

const createHistoryFromChat = (db, text, kind = 'chat') => {
  const now = new Date().toISOString();
  const titleBase = text
    ? text.split(' ').slice(0, 4).join(' ')
    : `${kind} capture`;
  const title = titleBase.charAt(0).toUpperCase() + titleBase.slice(1);
  const newHistory = {
    id: Date.now().toString(),
    title,
    messageCount: 1,
    lastMessage: text || `Saved a ${kind} artifact.`,
    timestamp: now,
    previewImages: [],
    isPublic: false,
    tags: kind === 'chat' ? [] : [kind]
  };
  db.history.unshift(newHistory);
  return newHistory;
};

const buildMindmapStructured = (seedText) => {
  const title = seedText ? seedText.split(' ').slice(0, 4).join(' ') : 'Mindmap';
  const safeTitle = title || 'Mindmap';
  const mermaidCode = `mindmap\n  root((${safeTitle}))\n    Key point\n      Detail A\n      Detail B\n    Insight\n      Next step`;
  const mindmapJson = {
    nodes: [
      { id: 'mm-0', position: { x: 0, y: 0 }, data: { label: safeTitle } },
      { id: 'mm-1', position: { x: 240, y: 0 }, data: { label: 'Key point' } },
      { id: 'mm-2', position: { x: 480, y: 0 }, data: { label: 'Detail A' } },
      { id: 'mm-3', position: { x: 480, y: 120 }, data: { label: 'Detail B' } },
      { id: 'mm-4', position: { x: 240, y: 240 }, data: { label: 'Insight' } },
      { id: 'mm-5', position: { x: 480, y: 240 }, data: { label: 'Next step' } }
    ],
    edges: [
      { id: 'e-0-1', source: 'mm-0', target: 'mm-1' },
      { id: 'e-1-2', source: 'mm-1', target: 'mm-2' },
      { id: 'e-1-3', source: 'mm-1', target: 'mm-3' },
      { id: 'e-0-4', source: 'mm-0', target: 'mm-4' },
      { id: 'e-4-5', source: 'mm-4', target: 'mm-5' }
    ]
  };
  return {
    mermaidCode,
    title: safeTitle,
    summary: 'Local preview mindmap',
    mindmapJson
  };
};

const handleChatMessage = (db, text) => {
  const now = new Date().toISOString();
  const userMessage = {
    id: `${Date.now()}-u`,
    text,
    sender: 'user',
    timestamp: now
  };
  db.chat.messages.push(userMessage);

  const botMessage = {
    id: `${Date.now()}-b`,
    text:
      'Got it. I can turn that into a sketch, a prompt, or a clean summary. Want a mindmap or an image?',
    sender: 'bot',
    timestamp: new Date().toISOString()
  };
  db.chat.messages.push(botMessage);

  if (db.profile.preferences.saveHistory) {
    if (!db.chat.activeHistoryId) {
      const newHistory = createHistoryFromChat(db, text, 'chat');
      db.chat.activeHistoryId = newHistory.id;
    } else {
      const historyItem = db.history.find((item) => item.id === db.chat.activeHistoryId);
      if (historyItem) {
        historyItem.messageCount += 1;
        historyItem.lastMessage = text;
        historyItem.timestamp = now;
      }
    }
  }

  return { messages: db.chat.messages };
};

const handleChatArtifact = (db, kind) => {
  const latestUser = [...db.chat.messages].reverse().find((msg) => msg.sender === 'user');
  const seedText = latestUser ? latestUser.text : '';
  const newHistory = createHistoryFromChat(db, seedText, kind);

  if (kind === 'image') {
    newHistory.previewImages = [
      'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80'
    ];
  }
  if (kind === 'mindmap') {
    newHistory.previewImages = [
      'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?auto=format&fit=crop&w=1200&q=80'
    ];
  }

  const botMessage = {
    id: `${Date.now()}-a`,
    text: `Saved a ${kind} artifact to your archive.`,
    sender: 'bot',
    timestamp: new Date().toISOString()
  };
  db.chat.messages.push(botMessage);

  const response = { history: newHistory, message: botMessage };
  if (kind === 'mindmap') {
    response.structuredMindmap = buildMindmapStructured(seedText);
  }
  if (kind === 'image') {
    response.generatedImage = {
      imageUrl:
        'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
      title: seedText ? seedText.split(' ').slice(0, 4).join(' ') : 'Generated Image',
      summary: 'Local preview image'
    };
  }

  return response;
};

const ensureCommunityDetail = (db, name) => {
  if (!db.communityDetail[name]) {
    db.communityDetail[name] = {
      members: 1500,
      online: 72,
      posts: []
    };
  }
};

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/profile', (_req, res) => {
  const db = loadDb();
  res.json(db.profile);
});

app.put('/api/profile', (req, res) => {
  const db = loadDb();
  db.profile = {
    ...db.profile,
    ...req.body,
    preferences: {
      ...db.profile.preferences,
      ...(req.body.preferences || {})
    }
  };
  saveDb(db);
  res.json(db.profile);
});

app.get('/api/history', (_req, res) => {
  const db = loadDb();
  res.json(db.history);
});

app.get('/api/history/:id', (req, res) => {
  const db = loadDb();
  const target = db.history.find((item) => item.id === req.params.id);
  if (!target) return sendNotFound(res, 'History item not found');
  res.json({ ok: true, item: { ...target, artifacts: target.artifacts || [] } });
});

app.patch('/api/history/:id', (req, res) => {
  const db = loadDb();
  const target = db.history.find((item) => item.id === req.params.id);
  if (!target) return sendNotFound(res, 'History item not found');

  Object.assign(target, req.body);
  saveDb(db);
  res.json(target);
});

app.post('/api/history', (req, res) => {
  const db = loadDb();
  const now = new Date().toISOString();
  const newItem = {
    id: Date.now().toString(),
    title: req.body.title || 'Untitled',
    messageCount: req.body.messageCount || 0,
    lastMessage: req.body.lastMessage || '',
    timestamp: req.body.timestamp || now,
    previewImages: req.body.previewImages || [],
    isPublic: !!req.body.isPublic,
    tags: req.body.tags || []
  };
  db.history.unshift(newItem);
  saveDb(db);
  res.status(201).json(newItem);
});

app.get('/api/community/posts', (_req, res) => {
  const db = loadDb();
  res.json(db.communityPosts);
});

app.post('/api/community/posts/:id/like', (req, res) => {
  const db = loadDb();
  const post = db.communityPosts.find((item) => item.id === req.params.id);
  if (!post) return sendNotFound(res, 'Post not found');

  const liked = db.user.likes.includes(post.id);
  if (liked) {
    db.user.likes = db.user.likes.filter((id) => id !== post.id);
    post.likes = Math.max(0, post.likes - 1);
  } else {
    db.user.likes.push(post.id);
    post.likes += 1;
  }

  saveDb(db);
  res.json({ liked: !liked, likes: post.likes });
});

app.post('/api/community/posts/:id/bookmark', (req, res) => {
  const db = loadDb();
  const post = db.communityPosts.find((item) => item.id === req.params.id);
  if (!post) return sendNotFound(res, 'Post not found');

  const bookmarked = db.user.bookmarks.includes(post.id);
  if (bookmarked) {
    db.user.bookmarks = db.user.bookmarks.filter((id) => id !== post.id);
  } else {
    db.user.bookmarks.push(post.id);
  }

  saveDb(db);
  res.json({ bookmarked: !bookmarked });
});

app.get('/api/community', (_req, res) => {
  const db = loadDb();
  res.json({
    followed: db.community.followed,
    recommended: db.community.recommended,
    user: db.user
  });
});

app.post('/api/community/follow/:name', (req, res) => {
  const db = loadDb();
  const name = req.params.name;
  const recommended = db.community.recommended.find((item) => item.name === name);
  if (!recommended) return sendNotFound(res, 'Community not found');

  if (!db.user.followedCommunities.includes(name)) {
    db.user.followedCommunities.push(name);
    db.community.followed.unshift(recommended);
    db.community.recommended = db.community.recommended.filter((item) => item.name !== name);
  }
  saveDb(db);
  res.json({ followed: db.community.followed, recommended: db.community.recommended, user: db.user });
});

app.post('/api/community/unfollow/:name', (req, res) => {
  const db = loadDb();
  const name = req.params.name;
  const followed = db.community.followed.find((item) => item.name === name);
  if (!followed) return sendNotFound(res, 'Community not found');

  db.user.followedCommunities = db.user.followedCommunities.filter((id) => id !== name);
  db.community.followed = db.community.followed.filter((item) => item.name !== name);
  if (!db.community.recommended.some((item) => item.name === name)) {
    db.community.recommended.unshift(followed);
  }
  saveDb(db);
  res.json({ followed: db.community.followed, recommended: db.community.recommended, user: db.user });
});

app.get('/api/community/:name', (req, res) => {
  const db = loadDb();
  const name = req.params.name;
  ensureCommunityDetail(db, name);
  res.json({
    name,
    detail: db.communityDetail[name],
    joined: db.user.joinedCommunities.includes(name)
  });
});

app.post('/api/community/:name/join', (req, res) => {
  const db = loadDb();
  const name = req.params.name;
  ensureCommunityDetail(db, name);
  const joined = db.user.joinedCommunities.includes(name);
  if (joined) {
    db.user.joinedCommunities = db.user.joinedCommunities.filter((id) => id !== name);
  } else {
    db.user.joinedCommunities.push(name);
  }
  saveDb(db);
  res.json({ joined: !joined });
});

app.post('/api/community/:name/posts/:id/like', (req, res) => {
  const db = loadDb();
  const name = req.params.name;
  ensureCommunityDetail(db, name);
  const post = db.communityDetail[name].posts.find((item) => item.id === req.params.id);
  if (!post) return sendNotFound(res, 'Post not found');

  const key = `${name}:${post.id}`;
  const liked = db.user.likes.includes(key);
  if (liked) {
    db.user.likes = db.user.likes.filter((id) => id !== key);
    post.likes = Math.max(0, post.likes - 1);
  } else {
    db.user.likes.push(key);
    post.likes += 1;
  }
  saveDb(db);
  res.json({ liked: !liked, likes: post.likes });
});

app.get('/api/chat/messages', (_req, res) => {
  const db = loadDb();
  res.json(db.chat.messages);
});

app.post('/api/chat/message', (req, res) => {
  const db = loadDb();
  const text = String(req.body.text || '').trim();
  if (!text) return res.status(400).json({ error: 'Message text required' });

  const response = handleChatMessage(db, text);
  saveDb(db);
  res.json(response);
});

app.post('/api/chat/artifact', (req, res) => {
  const db = loadDb();
  const kind = String(req.body.kind || 'text').toLowerCase();
  const response = handleChatArtifact(db, kind);
  saveDb(db);
  res.json(response);
});

app.post('/api/chat', (req, res) => {
  const action = String(req.query.action || '');
  const db = loadDb();

  if (action === 'message') {
    const text = String(req.body.text || '').trim();
    if (!text) return res.status(400).json({ error: 'Message text required' });
    const response = handleChatMessage(db, text);
    saveDb(db);
    return res.json(response);
  }

  if (action === 'artifact') {
    const kind = String(req.body.kind || 'text').toLowerCase();
    const response = handleChatArtifact(db, kind);
    saveDb(db);
    return res.json(response);
  }

  return res.status(400).json({ error: 'Invalid action' });
});

app.listen(port, () => {
  console.log(`API server listening on port ${port}`);
});
