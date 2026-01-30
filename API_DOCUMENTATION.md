# 🔌 Guest-first Demo API 文档

## 通用规范

### Headers
所有请求必须携带：
```
Content-Type: application/json
X-Guest-ID: <guest_id>  # 前端自动生成的 UUID
```

### Actor 类型
```typescript
type Actor = 
  | { type: 'guest', id: string }  // guest_id
  | { type: 'user', id: string }   // user_id (未来扩展)
```

---

## 1️⃣ Profile API

### `GET /api/profile`
获取用户或访客 profile

**Request Headers:**
```
X-Guest-ID: guest-abc123
```

**Response (Guest):**
```json
{
  "userName": "Guest-abc123",
  "userHandle": "@guest_abc123",
  "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=guest-abc123",
  "preferences": {},
  "isGuest": true
}
```

**Response (User):**
```json
{
  "userName": "John Doe",
  "userHandle": "@johndoe",
  "avatar": "https://...",
  "preferences": {
    "emailNotifications": true,
    "saveHistory": true,
    "publicProfile": false
  },
  "isGuest": false
}
```

---

## 2️⃣ History/Archive API

### `GET /api/history`
获取当前 actor 的 archive 列表

**Request Headers:**
```
X-Guest-ID: guest-abc123
```

**Response:**
```json
[
  {
    "id": "uuid-1",
    "title": "My First Chat",
    "messageCount": 10,
    "lastMessage": "This was a great conversation...",
    "previewImages": ["https://..."],
    "isPublic": false,
    "tags": ["meditation", "mindfulness"],
    "timestamp": "2026-01-29T10:30:00Z",
    "isDemo": true
  }
]
```

### `POST /api/history`
保存到 Archive（Guest 允许）

**Request:**
```json
{
  "title": "My Chat Session",
  "content": "Full chat content...",
  "messages": [
    { "role": "user", "content": "Hello" },
    { "role": "assistant", "content": "Hi there!" }
  ],
  "tags": ["ai-chat", "wellness"],
  "previewImages": ["https://image1.jpg"]
}
```

**Response:**
```json
{
  "id": "uuid-1",
  "title": "My Chat Session",
  "timestamp": "2026-01-29T10:30:00Z",
  "isDemo": true  // Guest 创建的标记为 demo
}
```

**规则：**
- Guest: `is_demo=true`, `expires_at` = 7 天后
- User: `is_demo=false`, `expires_at=null`

---

## 3️⃣ Community API

### `GET /api/community?discover=true`
获取 Discover Feed（Seed 优先）

**Response:**
```json
[
  {
    "id": "uuid-1",
    "title": "My Journey Through Mindful Morning Routines",
    "author": {
      "name": "Emma Chen",
      "id": "seed-profile-uuid",
      "type": "seed"
    },
    "imageUrl": "https://images.unsplash.com/photo-...",
    "content": "For the past 6 months...",
    "summary": "Discovered how 10 minutes of meditation...",
    "likes": 127,
    "comments": 23,
    "timestamp": "2026-01-15T08:00:00Z",
    "tags": ["meditation", "morning-routine"],
    "communityName": "Mindfulness"
  },
  {
    "author": {
      "type": "guest",
      "name": "Guest-abc123"
    }
    // ... guest 发布的帖子（is_demo=false 的才显示）
  }
]
```

**排序规则：**
1. Seed 帖子优先
2. 非 demo 的 guest/user 帖子
3. 按时间倒序

### `GET /api/community`
获取社区元数据（已有接口，保持不变）

**Response:**
```json
{
  "followed": [
    {
      "name": "Mindfulness",
      "stats": {
        "totalPosts": 456,
        "members": 4532,
        "online": 234,
        "postsToday": 12
      },
      "trending": ["#meditation", "#breathing"]
    }
  ],
  "recommended": [...],
  "user": {
    "likes": ["post-id-1", "post-id-2"],
    "bookmarks": []
  }
}
```

---

## 4️⃣ Publish API

### `POST /api/community/publish`
发布到社区（Guest 允许）

**Request:**
```json
{
  "title": "My Art Journey",
  "content": "Full content here...",
  "contentJson": {
    "blocks": [...]  // 富文本编辑器格式
  },
  "summary": "A brief summary (max 200 chars)",
  "tags": ["art", "creativity"],
  "communityName": "Creativity",  // 或使用 communityTagId
  "imageUrl": "https://...",
  "assetUrls": ["https://image1.jpg", "https://image2.jpg"]
}
```

**Response:**
```json
{
  "id": "uuid-1",
  "title": "My Art Journey",
  "timestamp": "2026-01-29T10:30:00Z",
  "isDemo": true,  // Guest 发布标记为 demo
  "communityTagId": "uuid-community"
}
```

**字段说明：**
- `title` (必填): 帖子标题
- `content` (必填): 帖子内容（纯文本或 markdown）
- `contentJson` (可选): 富文本结构化内容
- `summary` (可选): 摘要，未提供则截取 content 前 200 字符
- `communityName` 或 `communityTagId`: 发布到哪个社区
- `assetUrls`: 附件图片/视频 URL

**规则：**
- Guest: `is_demo=true`, `expires_at` = 7 天后
- User: `is_demo=false`, `expires_at=null`
- author_type: 'guest' | 'user' | 'seed'
- author_name: 自动从 profile 获取

---

## 5️⃣ Like API

### `POST /api/community/like`
点赞（Guest 允许，幂等）

**Request:**
```json
{
  "postId": "uuid-post-1",
  "targetType": "post"  // 或 "history"
}
```

**Response (首次点赞):**
```json
{
  "message": "Liked successfully",
  "alreadyLiked": false
}
```

**Response (已点赞):**
```json
{
  "message": "Already liked",
  "alreadyLiked": true
}
```

### `DELETE /api/community/like`
取消点赞

**Request:**
```json
{
  "postId": "uuid-post-1",
  "targetType": "post"
}
```

**Response:**
```json
{
  "message": "Unliked successfully"
}
```

**幂等保证：**
- 使用唯一索引：`(actor_type, actor_id, target_type, target_id)`
- 并发点赞会返回 `alreadyLiked: true`
- 不会重复计数

---

## 6️⃣ Chat API (已有，保持不变)

### `POST /api/chat/message`
发送聊天消息

**Request:**
```json
{
  "text": "Tell me about mindfulness"
}
```

**Response:**
```json
{
  "messages": [
    {
      "id": "msg-1",
      "text": "Tell me about mindfulness",
      "sender": "user",
      "timestamp": "2026-01-29T10:30:00Z"
    },
    {
      "id": "msg-2",
      "text": "Mindfulness is the practice of...",
      "sender": "bot",
      "timestamp": "2026-01-29T10:30:05Z"
    }
  ]
}
```

---

## 7️⃣ Health Check

### `GET /api/health`
服务健康检查

**Response:**
```json
{
  "status": "ok",
  "env": {
    "hasSupabaseUrl": true,
    "hasSupabaseKey": true,
    "nodeEnv": "production"
  }
}
```

---

## 🔒 安全考虑

### 1. Guest 限流
建议在 Vercel Edge Config 配置：
```json
{
  "rateLimit": {
    "guest": {
      "publish": { "max": 10, "window": "1h" },
      "like": { "max": 30, "window": "1m" },
      "archive": { "max": 20, "window": "1h" }
    }
  }
}
```

### 2. Demo 数据过期
```sql
-- 在 Supabase 设置定时任务（每天凌晨 2 点）
SELECT cron.schedule(
  'cleanup-demo-data',
  '0 2 * * *',
  $$ SELECT cleanup_expired_demos(); $$
);
```

### 3. 内容审核
建议集成：
- Gemini Safety API
- 敏感词过滤
- 用户举报机制

---

## 📊 数据流图

```
┌─────────────┐
│   Browser   │
│ (Guest ID)  │
└──────┬──────┘
       │ X-Guest-ID: guest-abc123
       ▼
┌─────────────────┐
│  /api/* (Vercel)│
│  getActor(req)  │◄──────┐
└────────┬────────┘       │
         │                │
         ▼                │
┌────────────────┐        │
│   Supabase DB  │        │
│  actor_type    │────────┘
│  actor_id      │
└────────────────┘
```

**核心逻辑：**
1. 前端每次请求带 `X-Guest-ID`
2. 后端 `getActor(req)` 解析出 actor
3. 所有数据表用 `(actor_type, actor_id)` 标识所有者
4. Guest 数据自动标记 `is_demo=true` + `expires_at`

---

## 🧪 测试示例

### Curl 测试脚本

```bash
#!/bin/bash
GUEST_ID="test-guest-$(date +%s)"
BASE_URL="http://localhost:5173"

echo "Testing with Guest ID: $GUEST_ID"

# 1. Get Profile
curl -s "$BASE_URL/api/profile" \
  -H "X-Guest-ID: $GUEST_ID" | jq

# 2. Save to Archive
curl -s -X POST "$BASE_URL/api/history" \
  -H "Content-Type: application/json" \
  -H "X-Guest-ID: $GUEST_ID" \
  -d '{"title":"Test Archive","content":"Test content"}' | jq

# 3. Publish to Community
PUBLISH_RESULT=$(curl -s -X POST "$BASE_URL/api/community/publish" \
  -H "Content-Type: application/json" \
  -H "X-Guest-ID: $GUEST_ID" \
  -d '{
    "title":"Test Post",
    "content":"This is a test post",
    "communityName":"Mindfulness",
    "tags":["test"]
  }')
echo "$PUBLISH_RESULT" | jq
POST_ID=$(echo "$PUBLISH_RESULT" | jq -r .id)

# 4. Like (幂等测试)
echo "First like:"
curl -s -X POST "$BASE_URL/api/community/like" \
  -H "Content-Type: application/json" \
  -H "X-Guest-ID: $GUEST_ID" \
  -d "{\"postId\":\"$POST_ID\"}" | jq

echo "Second like (should return alreadyLiked=true):"
curl -s -X POST "$BASE_URL/api/community/like" \
  -H "Content-Type: application/json" \
  -H "X-Guest-ID: $GUEST_ID" \
  -d "{\"postId\":\"$POST_ID\"}" | jq

# 5. Get Discover Feed
curl -s "$BASE_URL/api/community?discover=true" | jq '.[:3]'
```

---

## ✅ API Checklist

部署前验证：

- [ ] 所有接口支持 `X-Guest-ID` header
- [ ] Guest 和 User 数据正确隔离
- [ ] Discover Feed 返回 seed 优先
- [ ] 点赞接口幂等
- [ ] Demo 数据有过期时间
- [ ] 错误响应格式统一
- [ ] CORS 配置正确
- [ ] 所有 POST 接口有 body 校验
