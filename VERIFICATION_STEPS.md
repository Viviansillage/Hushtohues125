# 验收步骤

## 目标
确保：
1. 连续聊天对话**不会**写入 Archive
2. 只有点击 Mindmap/Image/Save 按钮时才写入 Archive
3. Archive 列表只显示 artifact（有 kind 标记的记录）

## 本地验证（部署前）

### 1. 检查代码逻辑
```bash
# 确认 action=message 不写 DB
grep -n "action === 'message'" api/chat.js
# 应该看到：不调用 getOrCreateConversation/updateConversation

# 确认 action=artifact 写入 kind 标记
grep -n "kind: 'mindmap'" api/chat.js
grep -n "kind: 'image'" api/chat.js
grep -n "kind: 'save'" api/chat.js

# 确认 history 只返回 artifact
grep -n "tags.cs" api/history.js
```

## Vercel 部署后验证

### 2. 测试连续对话（不进入 Archive）
```bash
# 发送第一条消息
curl -X POST https://hush-to-hues.vercel.app/api/chat?action=message \
  -H "Content-Type: application/json" \
  -H "X-Guest-ID: test-verify-123" \
  -d '{"text":"Hello, what can you help me with?"}'

# 发送第二条消息（带上之前的 messages）
curl -X POST https://hush-to-hues.vercel.app/api/chat?action=message \
  -H "Content-Type: application/json" \
  -H "X-Guest-ID: test-verify-123" \
  -d '{
    "text":"Tell me more about design thinking",
    "messages":[
      {"id":"msg-1","text":"Hello","sender":"user","timestamp":"2026-01-30T10:00:00Z"},
      {"id":"msg-2","text":"Hi! How can I help?","sender":"bot","timestamp":"2026-01-30T10:00:01Z"}
    ]
  }'

# 检查 Archive（应该为空，因为没有点击保存按钮）
curl https://hush-to-hues.vercel.app/api/history \
  -H "X-Guest-ID: test-verify-123"
# 预期：返回 [] 或只有之前的 artifact（不包括刚才的聊天）
```

### 3. 测试创建 Mindmap（进入 Archive）
```bash
curl -X POST https://hush-to-hues.vercel.app/api/chat?action=artifact \
  -H "Content-Type: application/json" \
  -H "X-Guest-ID: test-verify-456" \
  -d '{
    "kind":"mindmap",
    "messages":[
      {"id":"msg-1","text":"I want to organize my project ideas","sender":"user","timestamp":"2026-01-30T10:00:00Z"},
      {"id":"msg-2","text":"Great! Let me help you structure that.","sender":"bot","timestamp":"2026-01-30T10:00:01Z"}
    ]
  }'

# 检查 Archive（应该有 1 条 mindmap 记录）
curl https://hush-to-hues.vercel.app/api/history \
  -H "X-Guest-ID: test-verify-456"
# 预期：返回 1 条记录，tags 包含 "mindmap"
```

### 4. 测试创建 Image（进入 Archive）
```bash
curl -X POST https://hush-to-hues.vercel.app/api/chat?action=artifact \
  -H "Content-Type: application/json" \
  -H "X-Guest-ID: test-verify-789" \
  -d '{
    "kind":"image",
    "messages":[
      {"id":"msg-1","text":"Generate an image of a futuristic city","sender":"user","timestamp":"2026-01-30T10:00:00Z"}
    ]
  }'

# 检查 Archive
curl https://hush-to-hues.vercel.app/api/history \
  -H "X-Guest-ID: test-verify-789"
# 预期：返回 1 条记录，tags 包含 "image"，previewImages 有 placeholder URL
```

### 5. 测试保存对话（进入 Archive）
```bash
curl -X POST https://hush-to-hues.vercel.app/api/chat?action=artifact \
  -H "Content-Type: application/json" \
  -H "X-Guest-ID: test-verify-abc" \
  -d '{
    "kind":"save",
    "messages":[
      {"id":"msg-1","text":"This is important","sender":"user","timestamp":"2026-01-30T10:00:00Z"},
      {"id":"msg-2","text":"I will save this for you","sender":"bot","timestamp":"2026-01-30T10:00:01Z"}
    ]
  }'

# 检查 Archive
curl https://hush-to-hues.vercel.app/api/history \
  -H "X-Guest-ID: test-verify-abc"
# 预期：返回 1 条记录，tags 包含 "save"
```

## UI 验证（最终验收）

1. **打开 Chat 页面**，连续发送 10 条消息
   - ✅ 消息正常显示
   - ✅ 有上下文连续性（AI 记得之前说的话）
   - ✅ 转到 Archive 页面，**没有新增任何卡片**

2. **点击 "Image" 按钮**
   - ✅ 显示 toast："Saved image to your archive."
   - ✅ 转到 Archive 页面，**新增 1 张 Image 卡片**

3. **继续在 Chat 聊天**，再发 5 条消息
   - ✅ 转到 Archive，**仍然只有 1 张 Image 卡片**（没有新增）

4. **点击 "Mindmap" 按钮**
   - ✅ 显示 toast："Saved mindmap to your archive."
   - ✅ 转到 Archive，**新增 1 张 Mindmap 卡片**（总共 2 张）

5. **Archive 列表检查**
   - ✅ 只出现用户点击按钮保存的内容
   - ✅ 不会出现 "Chat Session / 0 msgs / #chat" 这种自动记录
   - ✅ 每张卡片都有明确的 kind 标记（mindmap/image/save）

## 常见问题排查

### Archive 还是有聊天记录？
- 检查 `api/history.js` 的过滤条件：`.or('tags.cs.{mindmap},tags.cs.{image},tags.cs.{save}')`
- 检查数据库：之前的测试可能留下了 `tags: ['chat']` 的记录，需要手动清理

### 连续对话丢失上下文？
- 检查前端是否正确传递 `messages` 参数
- 检查 `api/chat.js` 的 `action=message` 是否使用了 `body.messages`

### Mindmap 返回 400 错误？
- 检查 `content_json.structuredMindmap` 格式是否正确
- 检查 Gemini 返回是否包含 `nodes` 或 `mindmap` 字段
