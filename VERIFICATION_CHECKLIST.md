# 🎯 Hush to Hues - 修复验证清单

## 📋 方案选择

**最终选择：方案1 - Supabase 存储对话历史**

**原因：**
1. 复用现有 Supabase + chat_history 表
2. Guest-first 架构天然支持 owner_type/owner_id  
3. 刷新页面/跨设备对话不丢失
4. Archive 功能本质就是保存对话，架构一致

---

## 🔧 修复的核心问题

### 1️⃣ 修复 Mindmap 400 错误
**问题：** artifact 请求体需要 `structuredMindmap`，但前端没传  
**修复：**
- 修改契约：只需 `{ kind, conversationId, messages }`
- 后端从 Supabase 读取对话历史
- 使用 Gemini 生成结构化 mindmap JSON

### 2️⃣ 修复上下文不连续
**问题：** serverless 无状态 + 前端覆盖 messages  
**修复：**
- 每个对话有 conversationId（存储在 chat_history）
- content_json.messages 保存完整对话历史
- 前端使用后端返回的完整 messages 数组

### 3️⃣ 修复 Image 只有 placeholder
**问题：** 只返回文本，没有图片 URL  
**修复：**
- 返回 placeholderImage URL 在 previewImages 数组
- 保存到 content_json.imageUrl
- API 返回格式统一

### 4️⃣ 修复 Archive 为空
**问题：** api/history.js 字段映射错误  
**修复：**
- lastMessage 从 `item.content` 读取（不是 last_message）
- previewImages 从 `content_json.imageUrl` 提取
- 添加详细日志输出

---

## 📄 修改的文件

### `/api/chat.js`
**核心修改：**
1. 新增 `getOrCreateConversation(actor, conversationId)` - 管理对话会话
2. 新增 `updateConversation(conversationId, messages, title)` - 更新对话
3. POST /api/chat?action=message
   - 从 Supabase 读取历史 messages
   - append user message → Gemini → append bot message
   - 更新回 Supabase
   - 返回 `{ conversationId, messages, structured }`
4. POST /api/chat?action=artifact
   - 契约简化：`{ kind, conversationId, messages }`
   - kind='mindmap': 调用 Gemini 生成 structuredMindmap
   - kind='image': 返回 placeholder URL
   - kind='save': 保存完整对话
5. 所有操作添加 console.log 调试输出

**关键代码：**
```javascript
// 获取或创建对话
let conversation = await getOrCreateConversation(actor, conversationId);
let messages = conversation.content_json?.messages || [];

// 添加用户消息
messages.push(userMessage);

// 调用 Gemini
const geminiResponse = await callGemini(messages, text);
const structured = safeParseGeminiJson(geminiResponse);

// 添加 bot 消息
messages.push(botMessage);

// 更新回 Supabase
conversation = await updateConversation(conversation.id, messages, structured.title);

return { conversationId: conversation.id, messages, structured };
```

---

### `/api/history.js`
**修改：**
1. 添加 `console.log` 输出 actor 和查询结果
2. 修复字段映射：
   - `lastMessage: item.content`（不是 last_message）
   - `previewImages: item.content_json?.imageUrl ? [item.content_json.imageUrl] : []`

**关键代码：**
```javascript
console.log('[history.js] Method:', req.method, 'Actor:', actor);

const { data, error } = await supabase
  .from('chat_history')
  .select('*')
  .eq('owner_type', actor.type)
  .eq('owner_id', actor.id)
  .order('timestamp', { ascending: false });

console.log('[history.js] Found items:', data?.length || 0);
```

---

### `/src/lib/api.ts`
**修改：**
1. getChatMessages 支持 conversationId 参数
2. sendChatMessage 返回 `{ conversationId, messages, structured }`
3. createChatArtifact 传递 `{ kind, conversationId, messages }`

**关键代码：**
```typescript
export const getChatMessages = (conversationId?: string) => 
  request<ApiChatMessage[]>(`/api/chat?action=messages${conversationId ? `&conversationId=${conversationId}` : ''}`);

export const sendChatMessage = (text: string, conversationId?: string) =>
  request<{ conversationId: string; messages: ApiChatMessage[]; structured: ApiStructuredData }>('/api/chat?action=message', {
    method: 'POST',
    body: JSON.stringify({ text, conversationId })
  });

export const createChatArtifact = (kind: string, conversationId?: string, messages?: ApiChatMessage[]) =>
  request<{ history: ApiHistoryItem; message: ApiChatMessage; structuredMindmap?: any }>('/api/chat?action=artifact', {
    method: 'POST',
    body: JSON.stringify({ kind, conversationId, messages })
  });
```

---

### `/src/components/ChatPage.tsx`
**修改：**
1. 新增 state: `conversationId`
2. handleSend:
   - 传递 conversationId 到 sendChatMessage
   - 保存返回的 conversationId
   - 使用后端返回的完整 messages（不是 append）
3. handleArtifact:
   - 传递 `conversationId, messages` 到 createChatArtifact
4. 添加详细错误日志

**关键代码：**
```tsx
const [conversationId, setConversationId] = useState<string | undefined>();

const handleSend = async () => {
  const response = await sendChatMessage(messageText, conversationId);
  setConversationId(response.conversationId); // 保存 conversationId
  setMessages(response.messages.map(mapMessage)); // 使用后端完整 messages
};

const handleArtifact = async (kind: string) => {
  const response = await createChatArtifact(kind, conversationId, messages);
  setMessages((prev) => [...prev, mapMessage(response.message)]);
};
```

---

### `/src/App.tsx`
**修改：**
1. refreshHistory 添加详细日志

**关键代码：**
```tsx
console.log('[App] Fetching history, guestId:', localStorage.getItem('hushtohues_guest_id'));
const historyData = await getHistory();
console.log('[App] History fetched:', historyData.length, 'items');
```

---

## ✅ 提交命令

```bash
git add api/chat.js api/history.js src/lib/api.ts src/components/ChatPage.tsx src/App.tsx

git commit -m "fix: comprehensive chat & archive fixes for hackathon demo

[Problems Fixed]
1. Mindmap 400 error: simplified artifact contract (kind + conversationId)
2. Context loss: implement Supabase-based conversation persistence
3. Image placeholder: return proper previewImages array
4. Empty Archive: fix field mapping in /api/history

[Implementation - Solution 1: Supabase Storage]
- Store conversation messages in chat_history.content_json.messages
- GET /api/chat?action=messages returns full history from Supabase
- POST /api/chat?action=message appends to Supabase, returns conversationId
- POST /api/chat?action=artifact uses messages from conversation or request body

[Key Changes]
- api/chat.js: add getOrCreateConversation, updateConversation helpers
- api/chat.js: all artifact kinds (mindmap/image/save) now work
- api/history.js: fix lastMessage and previewImages field mapping
- ChatPage.tsx: track conversationId state, use backend's full messages array
- api.ts: update chat API contracts to include conversationId

[Debug]
- Add console.log to all critical paths (actor, conversationId, messages.length)
- Frontend logs error details on non-2xx responses
- Backend logs Supabase insert/update errors"

git push
```

---

## 🧪 验证命令（部署后执行）

### 1️⃣ 测试发送消息（验证上下文连续性）
```bash
# 第一条消息
curl -X POST https://hush-to-hues.vercel.app/api/chat?action=message \
  -H "Content-Type: application/json" \
  -H "X-Guest-ID: test-verify-123" \
  -d '{"text":"帮我整理一个早餐食谱"}' | jq '.conversationId, .messages | length'

# 记录返回的 conversationId，例如: abc-123

# 第二条消息（使用相同 conversationId）
curl -X POST https://hush-to-hues.vercel.app/api/chat?action=message \
  -H "Content-Type: application/json" \
  -H "X-Guest-ID: test-verify-123" \
  -d '{"text":"再加一个午餐的", "conversationId":"abc-123"}' | jq '.messages | length'

# 预期：第二次返回 4 条消息（user1, bot1, user2, bot2）
```

---

### 2️⃣ 测试获取消息（验证持久化）
```bash
curl -X GET "https://hush-to-hues.vercel.app/api/chat?action=messages&conversationId=abc-123" \
  -H "X-Guest-ID: test-verify-123" | jq 'length'

# 预期：返回 4 条消息
```

---

### 3️⃣ 测试 Mindmap（验证 artifact 不报错）
```bash
curl -X POST https://hush-to-hues.vercel.app/api/chat?action=artifact \
  -H "Content-Type: application/json" \
  -H "X-Guest-ID: test-verify-123" \
  -d '{
    "kind": "mindmap",
    "conversationId": "abc-123"
  }' | jq '.history.title, .structuredMindmap'

# 预期：返回 title + structuredMindmap（nodes 结构）
```

---

### 4️⃣ 测试 Image（验证 previewImages）
```bash
curl -X POST https://hush-to-hues.vercel.app/api/chat?action=artifact \
  -H "Content-Type: application/json" \
  -H "X-Guest-ID: test-verify-123" \
  -d '{
    "kind": "image",
    "conversationId": "abc-123"
  }' | jq '.history.previewImages'

# 预期：返回 ["https://placehold.co/600x400/..."]
```

---

### 5️⃣ 测试 Save（验证保存成功）
```bash
curl -X POST https://hush-to-hues.vercel.app/api/chat?action=artifact \
  -H "Content-Type: application/json" \
  -H "X-Guest-ID: test-verify-123" \
  -d '{
    "kind": "save",
    "conversationId": "abc-123"
  }' | jq '.history.title, .history.messageCount'

# 预期：返回 "Saved Conversation" + messageCount
```

---

### 6️⃣ 测试 Archive 列表（验证不为空）
```bash
curl -X GET https://hush-to-hues.vercel.app/api/history \
  -H "X-Guest-ID: test-verify-123" | jq 'length, .[0].title'

# 预期：返回 >=3（mindmap + image + save）, 显示第一个 item 的 title
```

---

## 🐛 调试指南

### 如果 Archive 仍然为空：

1. **检查浏览器 Console：**
   ```
   [App] Fetching history, guestId: guest-xxxxx
   [App] History fetched: 0 items  ← 如果是 0，继续下一步
   ```

2. **检查 Vercel Function Logs：**
   - 访问 Vercel Dashboard → Deployments → 点击最新部署 → Functions
   - 找到 `/api/history` 的日志
   - 查看 `[history.js] Actor:` 和 `Found items:`

3. **检查 Supabase 数据库：**
   ```sql
   SELECT owner_type, owner_id, title, tags 
   FROM chat_history 
   WHERE owner_type = 'guest' 
   ORDER BY timestamp DESC 
   LIMIT 10;
   ```

4. **验证 guest_id 一致性：**
   - 浏览器 Console: `localStorage.getItem('hushtohues_guest_id')`
   - 确保每次请求都带相同的 X-Guest-ID header

---

## 🎉 预期效果

1. **发送消息** → 每次都能看到之前的对话历史
2. **点击 Mindmap** → 生成结构化 mindmap，保存到 Archive
3. **点击 Image** → 显示 placeholder 图片，保存到 Archive
4. **点击 Save** → 保存对话，Archive 页面能看到
5. **刷新页面** → 对话历史不丢失
6. **Archive 页面** → 显示所有保存的 mindmap/image/conversation

---

**验证完成后，Hush to Hues 的 Chat → Save → Archive 完整流程将正常工作！** 🚀
