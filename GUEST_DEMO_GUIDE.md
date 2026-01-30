# 🚀 Guest-first Demo 部署指南

## 📋 改造概览

已完成的改动：
- ✅ 数据库 Schema 扩展（支持 guest/seed）
- ✅ 后端 API 改造（/api 全部支持 guest）
- ✅ Seed 数据脚本（20+ 高质量帖子）
- ✅ 前端 Guest ID 管理
- ✅ 统一 API 请求带 guest header

---

## 🗄️ 步骤 1: 数据库迁移

### 1.1 执行 Schema 变更

```bash
# 在 Supabase Dashboard > SQL Editor 执行
# 文件：supabase/guest-migration.sql
```

将 `supabase/guest-migration.sql` 的内容复制粘贴到 Supabase SQL Editor 并执行。

### 1.2 插入 Seed 数据

```bash
# 确保 .env.local 配置了 SUPABASE_URL 和 SUPABASE_SERVICE_KEY
node supabase/migrate-data.js
```

这会：
- 插入 8 个 seed profiles
- 插入 5 个社区标签
- 插入 20+ 条高质量帖子

---

## 🔧 步骤 2: 验证后端 API

### 2.1 本地测试

```bash
# 启动开发服务器
npm run dev
```

### 2.2 测试关键接口

```bash
# 1. Health Check
curl http://localhost:5173/api/health

# 2. Guest Profile
curl -H "X-Guest-ID: test-guest-123" http://localhost:5173/api/profile

# 3. Discover Feed (应返回 seed 帖子)
curl http://localhost:5173/api/community?discover=true

# 4. 保存到 Archive
curl -X POST http://localhost:5173/api/history \
  -H "Content-Type: application/json" \
  -H "X-Guest-ID: test-guest-123" \
  -d '{"title":"Test Archive","content":"Test content"}'

# 5. 发布到社区
curl -X POST http://localhost:5173/api/community/publish \
  -H "Content-Type: application/json" \
  -H "X-Guest-ID: test-guest-123" \
  -d '{"title":"Test Post","content":"Test content","communityName":"Mindfulness"}'

# 6. 点赞（幂等测试：运行两次应返回 alreadyLiked: true）
curl -X POST http://localhost:5173/api/community/like \
  -H "Content-Type: application/json" \
  -H "X-Guest-ID: test-guest-123" \
  -d '{"postId":"<从 discover feed 获取的 post id>"}'
```

---

## 🎨 步骤 3: 前端集成（可选增强）

前端已自动集成 guest ID，但你可以添加以下 UI 增强：

### 3.1 在 ChatPage 添加 Save/Publish 按钮

```tsx
// src/components/ChatPage.tsx
import { saveToArchive, publishToCommunity } from '../lib/api';

// 在聊天完成后显示：
<div className="flex gap-2">
  <button onClick={async () => {
    await saveToArchive({
      title: chatTitle,
      content: chatContent,
      messages: chatMessages,
      tags: ['ai-generated']
    });
    toast.success('Saved to Archive!');
  }}>
    💾 Save to Archive
  </button>
  
  <button onClick={async () => {
    const result = await publishToCommunity({
      title: chatTitle,
      content: chatContent,
      summary: chatContent.slice(0, 200),
      communityName: 'Creativity',
      tags: ['ai-art']
    });
    // 跳转到 Community 并高亮刚发布的帖子
    navigate(`/community?highlight=${result.id}`);
  }}>
    🚀 Publish to Community
  </button>
</div>
```

### 3.2 在 CommunityPage 显示 Discover Feed

```tsx
// src/components/CommunityPage.tsx
import { getDiscoverFeed } from '../lib/api';

// Discover 标签页：
const [discoverPosts, setDiscoverPosts] = useState([]);

useEffect(() => {
  getDiscoverFeed().then(setDiscoverPosts);
}, []);

// 渲染时优先展示 seed 内容
{discoverPosts.map(post => (
  <PostCard key={post.id} {...post} />
))}
```

---

## 🚢 步骤 4: 部署到 Vercel

### 4.1 确保环境变量配置

在 Vercel Dashboard > Settings > Environment Variables 添加：

```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGci...  # Service Role Key (后端用)
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...  # Anon Key (前端用)
```

### 4.2 部署

```bash
# 提交代码
git add .
git commit -m "feat: implement guest-first demo mode"
git push

# Vercel 会自动部署
# 或手动触发：vercel --prod
```

### 4.3 验证线上环境

访问 `https://your-app.vercel.app` 并测试：

1. ✅ 打开网站无需登录
2. ✅ Chat 生成内容
3. ✅ Save to Archive 能看到保存的内容
4. ✅ Publish 到 Community 能在 Discover 看到
5. ✅ Community Discover 有丰富的 seed 内容
6. ✅ 点赞功能正常（幂等）

---

## 📊 最小可验证 Checklist

### 后端验证

- [ ] `GET /api/health` → 200 OK
- [ ] `GET /api/profile` (带 X-Guest-ID) → 返回 Guest-XXXXXX profile
- [ ] `GET /api/community?discover=true` → 返回 20+ seed 帖子
- [ ] `POST /api/history` (带 X-Guest-ID) → 创建 archive 成功
- [ ] `POST /api/community/publish` (带 X-Guest-ID) → 发布成功
- [ ] `POST /api/community/like` → 首次返回 alreadyLiked: false
- [ ] `POST /api/community/like` (重复) → 返回 alreadyLiked: true

### 前端验证

- [ ] localStorage 自动生成 `hushtohues_guest_id`
- [ ] 所有 API 请求自动带 `X-Guest-ID` header
- [ ] Chat 页面能生成内容
- [ ] Archive 页面能看到保存的历史
- [ ] Community Discover 有丰富内容（即使是新访客）

### 用户体验验证

- [ ] 评委打开链接无需注册
- [ ] 能完成 Chat → Save → Publish 完整流程
- [ ] Community 看起来"有人在用"（seed 内容丰富）
- [ ] Guest 发布的内容有标记（is_demo: true）
- [ ] 7 天后 demo 内容自动过期（可通过 SQL 函数清理）

---

## 🐛 故障排查

### 问题 1: API 404

```bash
# 检查 vercel.json 配置
# 确保 /api 路由不被 SPA rewrites 覆盖
```

### 问题 2: Guest ID 未生效

```bash
# 检查浏览器控制台
# 应该看到：✅ Using existing guest ID: guest-xxx
# 或：🆕 Created new guest ID: guest-xxx
```

### 问题 3: Seed 数据未显示

```bash
# 检查数据库
# 确保 community_posts 有 author_type='seed' 的记录
# 确保 is_demo=false（seed 不是 demo）
```

### 问题 4: 点赞不幂等

```bash
# 检查 user_likes 表的唯一索引
# 应该有：idx_user_likes_unique_actor
# 基于 (actor_type, actor_id, target_type, target_id)
```

---

## 📈 性能优化建议

1. **定期清理过期 demo 数据**
   ```sql
   -- 在 Supabase > Database > Functions 创建定时任务
   SELECT cleanup_expired_demos();
   ```

2. **缓存 Discover Feed**
   - seed 内容不常变，可以 CDN 缓存
   - 前端可用 React Query 缓存 5 分钟

3. **限流保护**
   - Guest 发布限制：每小时 10 条
   - 点赞限制：每分钟 30 次
   - 可在 Vercel Edge Config 配置

---

## 🎉 完成！

你的 Hushtohues 现在支持 Guest-first Demo 模式：
- ✅ 无需登录即可体验完整功能
- ✅ Community 有丰富的 seed 内容
- ✅ Guest 数据自动过期，不会刷爆数据库
- ✅ 评委可以立即看到产品价值

下一步：
- 考虑添加 Gemini API 真实对话（可选）
- 优化前端 UI（Save/Publish 按钮位置）
- 添加 Guest 数据导出功能（鼓励注册）
