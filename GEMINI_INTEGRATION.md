# Gemini API 集成文档

## 1. 完整代码实现

### A) `/api/chat.js` - 已更新

**关键功能：**
- ✅ POST `/api/chat?action=message` - 接入 Gemini API
- ✅ POST `/api/chat?action=artifact` - 生成 mindmap/image/save
- ✅ 强制 JSON 输出（`responseMimeType: 'application/json'`）
- ✅ 容错解析 + Fallback 结构

**核心函数：**
```javascript
// 1. callGemini(messages, userText) 
//    - 调用 Gemini REST API
//    - 使用 systemInstruction + responseMimeType: 'application/json'

// 2. safeParseGeminiJson(text)
//    - 去除 ```json ``` 包裹
//    - 验证必需字段 (reply/title/summary/tags/mindmap)
//    - 失败时返回 fallback 结构

// 3. convertToMermaidMindmap(mindmapData)
//    - 将 JSON mindmap 转换为 Mermaid 语法
```

---

## 2. System Prompt 策略

**产品定位：**
```
You are Hush to Hues AI assistant. 
Help users transform chaotic ideas into clear, organized expressions.
Output formats: mindmaps, summaries, creative prompts, or social posts.
```

**强制 JSON 输出：**
```json
{
  "reply": "<conversational response>",
  "title": "<concise title, max 10 words>",
  "summary": "<2-3 sentence summary>",
  "tags": ["tag1", "tag2", "tag3"],
  "mindmap": {
    "root": "<main topic>",
    "branches": [
      {
        "label": "<branch name>",
        "children": ["<subtopic 1>", "<subtopic 2>"]
      }
    ]
  }
}
```

**示例对话：**
```
User: "I want to build a mindfulness app but not sure where to start"

Response:
{
  "reply": "Great idea! Let me help organize your thoughts...",
  "title": "Mindfulness App Concept",
  "summary": "A mobile application focused on meditation and mental wellness...",
  "tags": ["mindfulness", "wellness", "app-idea"],
  "mindmap": {
    "root": "Mindfulness App",
    "branches": [
      {
        "label": "Core Features",
        "children": ["Guided Meditations", "Breathing Exercises", "Sleep Stories"]
      },
      {
        "label": "User Experience",
        "children": ["Progress Tracking", "Daily Reminders", "Customizable Goals"]
      }
    ]
  }
}
```

---

## 3. Gemini 请求体

**API Endpoint:**
```
https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key={GEMINI_API_KEY}
```

**Request Body:**
```json
{
  "contents": [
    {
      "role": "user",
      "parts": [{ "text": "User's previous message" }]
    },
    {
      "role": "model",
      "parts": [{ "text": "Assistant's previous response" }]
    },
    {
      "role": "user",
      "parts": [{ "text": "Current user input" }]
    }
  ],
  "systemInstruction": {
    "parts": [{ "text": "<SYSTEM_PROMPT>" }]
  },
  "generationConfig": {
    "temperature": 0.8,
    "topP": 0.95,
    "topK": 40,
    "maxOutputTokens": 2048,
    "responseMimeType": "application/json"  // ← 强制 JSON 输出
  }
}
```

**关键参数：**
- `responseMimeType: "application/json"` - 确保输出是纯 JSON（不含 markdown）
- `temperature: 0.8` - 平衡创造性和结构化
- `systemInstruction` - 定义产品定位 + JSON schema

---

## 4. 验证命令

### 测试 1: 发送消息（接 Gemini）

```bash
curl -X POST https://hush-to-hues.vercel.app/api/chat?action=message \
  -H "Content-Type: application/json" \
  -H "X-Guest-ID: test-guest-123" \
  -d '{
    "text": "I want to create a mindfulness app"
  }' | jq
```

**预期返回：**
```json
{
  "messages": [
    {
      "id": "msg-1738xxx-u",
      "text": "I want to create a mindfulness app",
      "sender": "user",
      "timestamp": "2026-01-29T..."
    },
    {
      "id": "msg-1738xxx",
      "text": "Great idea! Let me help organize your thoughts...",
      "sender": "bot",
      "timestamp": "2026-01-29T..."
    }
  ],
  "structured": {
    "title": "Mindfulness App Concept",
    "summary": "A mobile application focused on meditation...",
    "tags": ["mindfulness", "wellness", "app-idea"],
    "mindmap": {
      "root": "Mindfulness App",
      "branches": [
        {
          "label": "Core Features",
          "children": ["Guided Meditations", "Breathing Exercises"]
        }
      ]
    }
  }
}
```

---

### 测试 2: 生成 Mindmap Artifact

```bash
curl -X POST https://hush-to-hues.vercel.app/api/chat?action=artifact \
  -H "Content-Type: application/json" \
  -H "X-Guest-ID: test-guest-123" \
  -d '{
    "kind": "mindmap",
    "structured": {
      "title": "Mindfulness App Concept",
      "summary": "A mobile app for meditation and wellness",
      "tags": ["mindfulness", "wellness"],
      "mindmap": {
        "root": "Mindfulness App",
        "branches": [
          {
            "label": "Core Features",
            "children": ["Guided Meditations", "Sleep Stories"]
          },
          {
            "label": "User Experience",
            "children": ["Progress Tracking", "Daily Reminders"]
          }
        ]
      }
    }
  }' | jq
```

**预期返回：**
```json
{
  "history": {
    "id": "uuid-...",
    "title": "Mindmap - Mindfulness App Concept",
    "messageCount": 0,
    "timestamp": "2026-01-29T...",
    "tags": ["mindmap", "mindfulness", "wellness"]
  },
  "mermaid": "mindmap\n  root((Mindfulness App))\n    Core Features\n      Guided Meditations\n      Sleep Stories\n    User Experience\n      Progress Tracking\n      Daily Reminders\n",
  "message": {
    "id": "msg-...",
    "text": "✅ Mindmap saved to your archive!",
    "sender": "bot",
    "timestamp": "2026-01-29T..."
  }
}
```

---

### 测试 3: 完整流程（Message → Artifact）

```bash
# Step 1: 发送消息获取 structured data
RESPONSE=$(curl -s -X POST https://hush-to-hues.vercel.app/api/chat?action=message \
  -H "Content-Type: application/json" \
  -H "X-Guest-ID: test-demo-456" \
  -d '{"text": "Help me plan a sustainable garden"}')

echo "$RESPONSE" | jq '.structured'

# Step 2: 使用 structured data 生成 mindmap
echo "$RESPONSE" | jq '.structured' | curl -s -X POST https://hush-to-hues.vercel.app/api/chat?action=artifact \
  -H "Content-Type: application/json" \
  -H "X-Guest-ID: test-demo-456" \
  -d @- \
  --data-urlencode "kind=mindmap" | jq '.mermaid'
```

**预期：**
1. 第一个请求返回 Gemini 生成的 structured data
2. 第二个请求将 structured.mindmap 转换为 Mermaid 代码
3. 数据保存到 Supabase `chat_history` 表（owner_type='guest', owner_id='test-demo-456'）

---

## 5. 前端集成（src/lib/api.ts）

**已更新的类型定义：**
```typescript
export type ApiStructuredData = {
  title: string;
  summary: string;
  tags: string[];
  mindmap: {
    root: string;
    branches: Array<{
      label: string;
      children: string[];
    }>;
  };
};
```

**更新的 API 方法：**
```typescript
// 发送消息（带对话历史）
export const sendChatMessage = (
  text: string, 
  messages?: Array<{role: 'user'|'assistant', content: string}>
) =>
  request<{ messages: ApiChatMessage[]; structured: ApiStructuredData }>(
    '/api/chat?action=message',
    { method: 'POST', body: JSON.stringify({ text, messages }) }
  );

// 创建 artifact（传入 structured data）
export const createChatArtifact = (
  kind: string, 
  structured?: ApiStructuredData, 
  messages?: any[]
) =>
  request<{ history: ApiHistoryItem; message: ApiChatMessage; mermaid?: string }>(
    '/api/chat?action=artifact',
    { method: 'POST', body: JSON.stringify({ kind, structured, messages }) }
  );
```

**使用示例（ChatPage.tsx）：**
```typescript
// 1. 发送消息
const response = await sendChatMessage(userInput, conversationHistory);
setMessages(prev => [...prev, ...response.messages]);
setStructuredData(response.structured);  // 保存 structured data

// 2. 点击 Mindmap 按钮
const artifact = await createChatArtifact('mindmap', structuredData, messages);
console.log('Mermaid code:', artifact.mermaid);
// 可以用 mermaid.js 渲染 artifact.mermaid
```

---

## 6. 环境变量配置

**Vercel Dashboard > Settings > Environment Variables:**
```
GEMINI_API_KEY=AIzaSy...  (Production + Preview)
```

**本地开发 (.env.local):**
```
GEMINI_API_KEY=AIzaSy...
```

---

## 7. 错误处理

**后端错误日志：**
```javascript
console.error('Gemini API error:', error);
return res.status(500).json({
  error: 'Failed to process message',
  details: error.message
});
```

**前端捕获：**
```typescript
try {
  const response = await sendChatMessage(text);
} catch (error) {
  toast.error('Could not process your message. Please try again.');
  console.error(error);
}
```

---

## 8. 数据流图

```
┌─────────────┐
│   User      │
│  Frontend   │
└──────┬──────┘
       │ POST /api/chat?action=message
       │ { text: "...", messages: [...] }
       │
       ▼
┌─────────────────────────────────┐
│   /api/chat.js                  │
│                                 │
│  1. getActor(req) → guest_id   │
│  2. callGemini(messages, text) │
│     ├─ systemInstruction       │
│     └─ responseMimeType: JSON  │
│  3. safeParseGeminiJson()      │
│  4. return { messages, structured } │
└──────┬──────────────────────────┘
       │
       ▼
┌─────────────────────┐
│  Gemini API         │
│  (gemini-2.0-flash) │
└──────┬──────────────┘
       │ JSON response
       ▼
┌─────────────────────┐
│  Frontend receives: │
│  - messages         │
│  - structured       │
│    ├─ title         │
│    ├─ summary       │
│    ├─ tags          │
│    └─ mindmap       │
└──────┬──────────────┘
       │ User clicks "Mindmap"
       │
       ▼
┌─────────────────────────────────┐
│  POST /api/chat?action=artifact │
│  { kind: 'mindmap', structured } │
│                                 │
│  1. convertToMermaidMindmap()  │
│  2. Save to Supabase            │
│  3. Return { mermaid, history } │
└─────────────────────────────────┘
```

---

## 9. 部署检查清单

- [x] `/api/chat.js` 实现 Gemini 集成
- [x] System prompt 定义产品定位 + JSON schema
- [x] `responseMimeType: 'application/json'` 强制输出
- [x] `safeParseGeminiJson()` 容错解析
- [x] `convertToMermaidMindmap()` 生成 Mermaid 代码
- [x] 前端类型定义 `ApiStructuredData`
- [x] 前端 API 方法更新（sendChatMessage, createChatArtifact）
- [ ] 配置 `GEMINI_API_KEY` 环境变量
- [ ] 测试完整流程：message → artifact → save

---

## 10. 下一步优化

**短期（Demo 必需）：**
1. ✅ 实现 Gemini 对话
2. ✅ 生成 Mindmap（Mermaid 格式）
3. 🔄 前端渲染 Mermaid mindmap
4. 🔄 发布到 Community（使用 structured.title/summary）

**中期（完善体验）：**
1. 实现 Image 生成（接 Gemini Image API 或 Dall-E）
2. 优化 System Prompt（更多示例）
3. 对话历史持久化（保存到 Supabase）
4. 多轮对话优化（context window 管理）

**长期（扩展功能）：**
1. 支持上传图片/文件（multimodal Gemini）
2. 实时流式输出（SSE）
3. 自定义 prompt templates
4. 社区分享优秀 mindmap

---

**🚀 准备部署！记得配置 GEMINI_API_KEY 环境变量。**
