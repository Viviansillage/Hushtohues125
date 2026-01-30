# 改动摘要：聊天对话不进入 Archive

## 问题背景
- **Bug**：每次聊天对话都会被保存成 Archive 卡片（每问一句就多一条）
- **产品逻辑**：Chat 用于连续对话整理想法；只有用户显式点击 Mindmap/Image/Save 按钮时，才生成 artifact 并保存到 Archive

## 解决方案
实现 **"聊天对话不进入 Archive；只有用户显式保存的 artifact 才进入 Archive"**

- **数据模型**：
  - Chat messages（对话过程）：纯内存对话，前端 state 维护，不写 DB
  - Archive items（作品/保存记录）：只在点击按钮时创建，写入 chat_history，必须有 `kind` 标记

---

## 改动文件列表

### 1. `api/chat.js` (2 处关键修改)

#### A. `POST /api/chat?action=message` - 不再写入 DB
**原逻辑**：
- 调用 `getOrCreateConversation()` 从 DB 读取/创建对话
- 调用 `updateConversation()` 写入 DB
- 返回 `conversationId` + `messages`

**新逻辑**：
- 从请求体读取 `body.messages`（前端传来的上下文）
- 纯内存处理：追加 user message → 调用 Gemini → 追加 bot message
- 返回 `messages`（**不写 DB**）
- 删除 `conversationId` 相关逻辑

```javascript
// 修改前
let conversation = await getOrCreateConversation(actor, conversationId);
let messages = conversation.content_json?.messages || [];
// ... 添加消息 ...
conversation = await updateConversation(conversation.id, messages, structured.title);
return res.status(200).json({ conversationId: conversation.id, messages, ... });

// 修改后
let messages = Array.isArray(contextMessages) ? [...contextMessages] : [];
// ... 添加消息 ...
return res.status(200).json({ messages, structured: { ... } });  // 不写 DB
```

#### B. `GET /api/chat?action=messages` - 已废弃
**原逻辑**：从 DB 读取对话历史
**新逻辑**：返回空数组（前端自行维护 messages）

```javascript
// 修改后
if (req.method === 'GET' && action === 'messages') {
  console.log('[GET messages] Deprecated: returning empty array');
  return res.status(200).json([]);
}
```

---

### 2. `api/history.js` (1 处修改)

#### `GET /api/history` - 只返回 artifact
**原逻辑**：返回所有 chat_history 记录（包括聊天对话）
**新逻辑**：只返回 tags 包含 `mindmap`/`image`/`save` 的记录

```javascript
// 修改前
const { data, error } = await supabase
  .from('chat_history')
  .select('*')
  .eq('owner_type', actor.type)
  .eq('owner_id', actor.id)
  .order('timestamp', { ascending: false });

// 修改后
const { data, error } = await supabase
  .from('chat_history')
  .select('*')
  .eq('owner_type', actor.type)
  .eq('owner_id', actor.id)
  .or('tags.cs.{mindmap},tags.cs.{image},tags.cs.{save}')  // 只返回 artifact
  .order('timestamp', { ascending: false });
```

**注意**：`.or('tags.cs.{mindmap},tags.cs.{image},tags.cs.{save}')` 使用 Supabase 的 `contains` 操作符，过滤 JSONB 数组。

---

### 3. `src/lib/api.ts` (3 处修改)

#### A. `getChatMessages()` - 废弃
```typescript
// 修改前
export const getChatMessages = (conversationId?: string) => 
  request<ApiChatMessage[]>(`/api/chat?action=messages${conversationId ? `&conversationId=${conversationId}` : ''}`);

// 修改后
export const getChatMessages = (conversationId?: string) => 
  Promise.resolve([]);  // 返回空数组
```

#### B. `sendChatMessage()` - 传递 messages
```typescript
// 修改前
export const sendChatMessage = (text: string, conversationId?: string) =>
  request<{ conversationId: string; messages: ApiChatMessage[]; structured: ApiStructuredData }>('/api/chat?action=message', {
    method: 'POST',
    body: JSON.stringify({ text, conversationId })
  });

// 修改后
export const sendChatMessage = (text: string, messages?: ApiChatMessage[]) =>
  request<{ messages: ApiChatMessage[]; structured: ApiStructuredData }>('/api/chat?action=message', {
    method: 'POST',
    body: JSON.stringify({ text, messages })  // 传递当前 messages 作为上下文
  });
```

#### C. `createChatArtifact()` - 只传 kind + messages
```typescript
// 修改前
export const createChatArtifact = (kind: string, conversationId?: string, messages?: ApiChatMessage[]) =>
  request<{ history: ApiHistoryItem; message: ApiChatMessage; structuredMindmap?: any }>('/api/chat?action=artifact', {
    method: 'POST',
    body: JSON.stringify({ kind, conversationId, messages })
  });

// 修改后
export const createChatArtifact = (kind: string, messages: ApiChatMessage[]) =>
  request<{ history: ApiHistoryItem; message: ApiChatMessage; structuredMindmap?: any }>('/api/chat?action=artifact', {
    method: 'POST',
    body: JSON.stringify({ kind, messages })  // 只传 kind 和 messages
  });
```

---

### 4. `src/components/ChatPage.tsx` (4 处修改)

#### A. 删除 `conversationId` state
```typescript
// 修改前
const [conversationId, setConversationId] = useState<string | undefined>();

// 修改后
// （已删除）
```

#### B. 删除 `loadMessages` useEffect
```typescript
// 修改前
useEffect(() => {
  let isMounted = true;
  const loadMessages = async () => {
    const data = await getChatMessages(conversationId);
    if (!isMounted) return;
    setMessages(data.map(mapMessage));
  };
  loadMessages();
  return () => { isMounted = false; };
}, []);

// 修改后
// （已删除，messages 从空数组开始）
```

#### C. `handleSend()` - 传递 messages
```typescript
// 修改前
const response = await sendChatMessage(messageText, conversationId);
setConversationId(response.conversationId);
setMessages(response.messages.map(mapMessage));
onHistorySync?.();

// 修改后
const response = await sendChatMessage(messageText, messages);
setMessages(response.messages.map(mapMessage));
// 不再调用 onHistorySync（因为没有写入 Archive）
```

#### D. `handleArtifact()` - 传递 messages
```typescript
// 修改前
const response = await createChatArtifact(kind, conversationId, messages);

// 修改后
const response = await createChatArtifact(kind, messages);
```

#### E. `saveOptions` - 修正 kind 映射
```typescript
// 修改前
const saveOptions = [
  { id: 'image', label: 'Image', ... },
  { id: 'mindmap', label: 'Mindmap', ... },
  { id: 'text', label: 'Text', ... },    // ❌ 后端不支持 'text'
  { id: 'all', label: 'All', ... }       // ❌ 后端不支持 'all'
];

// 修改后
const saveOptions = [
  { id: 'image', label: 'Image', ... },
  { id: 'mindmap', label: 'Mindmap', ... },
  { id: 'save', label: 'Text', ... },    // ✅ 映射到 'save'
  { id: 'save', label: 'All', ... }      // ✅ 映射到 'save'
];
```

---

## 验收标准（必须满足）

✅ 在 Chat 连续问 10 句，Archive **不新增任何卡片**  
✅ 点击 "Image"，Archive **新增 1 张 Image 作品卡片**  
✅ 继续聊天，Archive **不新增**  
✅ 点击 "Mindmap"，Archive **新增 1 张 Mindmap 作品卡片**  
✅ Archive 列表只出现用户点过按钮生成/保存的内容，**不会出现** "Chat Session / 0 msgs / #chat" 这种自动记录

---

## 数据流对比

### 修改前（错误）
```
用户发消息 → POST /api/chat?action=message
             → getOrCreateConversation() 写入 chat_history ❌
             → updateConversation() 更新 chat_history ❌
             → 返回 conversationId + messages

GET /api/history → 返回所有 chat_history（包括聊天对话）❌
                  → Archive 显示所有聊天记录 ❌
```

### 修改后（正确）
```
用户发消息 → POST /api/chat?action=message
             → 使用前端传来的 messages
             → 纯内存处理（不写 DB）✅
             → 返回 messages

用户点击按钮 → POST /api/chat?action=artifact
               → 写入 chat_history（带 kind 标记）✅
               → 返回 history item

GET /api/history → 只返回 tags 包含 mindmap/image/save 的记录 ✅
                  → Archive 只显示 artifact ✅
```

---

## 关键技术点

1. **前端维护对话上下文**：
   - `useState<Message[]>([])` 初始化为空数组
   - 每次发送消息时，将当前 `messages` 传给后端
   - 后端返回完整 `messages`（包括新消息），前端直接替换 state

2. **Serverless 无状态特性**：
   - Vercel Serverless Function 不保证内存持久化
   - 不能依赖全局变量 `let chatMessages = []`（会丢失）
   - 必须由前端或数据库维护状态

3. **Supabase 过滤语法**：
   - `.or('tags.cs.{mindmap},tags.cs.{image},tags.cs.{save}')`
   - `cs` = `contains`（JSONB 数组包含）
   - `{mindmap}` = 匹配 `tags` 数组中包含 `"mindmap"` 的记录

4. **kind 标记设计**：
   - 每个 artifact 在 `content_json.kind` 和 `tags` 中都存储 kind
   - `content_json.kind`：用于前端逻辑判断
   - `tags`：用于后端过滤查询

---

## 本地验证步骤

```bash
# 1. 确认修改（所有检查应该通过）
grep -n "action === 'message'" api/chat.js  # 应该不调用 updateConversation
grep -n "tags.cs" api/history.js            # 应该有 artifact 过滤
grep -n "sendChatMessage.*messages" src/lib/api.ts  # 应该传递 messages

# 2. 提交并推送
git add api/chat.js api/history.js src/lib/api.ts src/components/ChatPage.tsx
git commit -m "fix: 聊天对话不进入 Archive，只有显式保存的 artifact 才进入"
git push

# 3. 等待 Vercel 部署（1-2 分钟）

# 4. 按照 VERIFICATION_STEPS.md 验证
```

---

## 注意事项

⚠️ **数据库清理**：
- 之前的测试可能留下了 `tags: ['chat']` 的记录
- 这些记录不会被新的过滤条件返回（Archive 不显示）
- 如果需要清理，可以在 Supabase Dashboard 手动删除

⚠️ **Gemini 模型**：
- 代码中锁定使用 `gemini-2.5-flash`
- 不要修改 `api/chat.js` 第 96 行的 Gemini URL

⚠️ **Vercel Function Limit**：
- 当前使用 10 个 serverless functions
- Hobby 计划限制 12 个
- 不要再拆分 `/api/chat.js`（已经合并过）

---

## 回滚方案

如果部署后出现问题，可以通过 Git 回滚：

```bash
git revert HEAD
git push
```

或在 Vercel Dashboard 回滚到上一个部署版本。
