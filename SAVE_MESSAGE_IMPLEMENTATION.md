# Save Message to Canvas 功能实现总结

## ✅ 已完成功能

### 1. 统一Save按钮
- 所有bot消息下方都有Save按钮
- 按钮样式统一，位于时间戳右侧
- 已保存状态显示"✓ Saved"，并禁用

### 2. 智能保存逻辑
**有artifact的消息**：
- 保存artifact（image或mindmap）+ summary文本
- image: width=400, height=300
- mindmap: width=420, height=280
- summary文本: x=520, width=400（右侧）

**无artifact的消息**：
- 只保存消息文本
- width=600（比summary更宽）
- x=60（左侧）

### 3. 高度估算
```javascript
function estimateTextHeight(text) {
  const lines = text.split('\n').length;
  const avgCharsPerLine = 50;
  const wrappedLines = Math.ceil(text.length / avgCharsPerLine);
  const totalLines = Math.max(lines, wrappedLines);
  return Math.max(totalLines * 48 + 40, 100);
}
```

### 4. 状态持久化
- 数据库存储：`content_json.savedMessages = ["msg-123", "msg-456"]`
- 刷新后恢复：加载时查询savedMessages，标记对应消息
- 防重复保存：后端检查messageId是否已在savedMessages中

### 5. Save All不受影响
- saveAllArtifactsInChat只保存artifact
- 不包括通过统一Save按钮保存的text消息

## 📊 数据结构

### Message接口
```typescript
interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  saved?: boolean;  // ← 新增字段
  artifact?: {
    saved?: boolean;
  };
}
```

### 数据库存储
```javascript
content_json: {
  sessionId: "session-xyz",
  items: [
    // artifact + summary
    { id: 'img-0', type: 'image', x: 60, y: 160, width: 400, height: 300 },
    { id: 'txt-0', type: 'text', x: 520, y: 160, width: 400, height: 估算值 },
    
    // 纯文本消息
    { id: 'txt-msg-0', type: 'text', x: 60, y: 600, width: 600, height: 估算值 }
  ],
  savedMessages: ["msg-123", "msg-456"]  // ← 记录已保存的消息ID
}
```

## 🔧 修改的文件

### 前端
**src/components/ChatPage.tsx**
1. Message接口添加`saved`字段
2. 添加`handleSaveMessage`函数
3. 删除artifact内部的Save按钮
4. 在所有bot消息下方添加统一Save按钮
5. 加载时调用`/api/archive?action=getSavedMessages`恢复状态

### 后端
**api/archive.js**
1. 添加`estimateTextHeight`函数
2. 新增`POST /api/archive?action=saveMessage` API
3. 新增`GET /api/archive?action=getSavedMessages` API

## 🎯 关键特性

### 位置计算
```javascript
// 遍历所有items（包括之前保存的text）
currentItems.forEach(item => {
  const itemHeight = typeof item.height === 'number' 
    ? item.height 
    : FIXED_HEIGHTS[item.type];
  
  maxBottom = Math.max(maxBottom, item.y + itemHeight);
});

newY = maxBottom + 120;
```

### 去重检查
```javascript
const savedMessages = existingArchive?.content_json?.savedMessages || [];
if (savedMessages.includes(messageId)) {
  return { ok: true, alreadySaved: true };
}
```

### 宽度设置
- artifact summary: 400px
- 纯文本消息: 600px（更宽，方便阅读）

## 📝 API端点

### POST /api/archive?action=saveMessage
**请求**：
```json
{
  "sessionId": "session-xyz",
  "messageId": "msg-123",
  "messageText": "...",
  "artifact": {  // 可选
    "type": "image",
    "data": { ... }
  }
}
```

**响应**：
```json
{
  "ok": true,
  "archiveId": "uuid",
  "messageId": "msg-123",
  "itemsAdded": 2
}
```

### GET /api/archive?action=getSavedMessages&sessionId=xxx
**响应**：
```json
{
  "ok": true,
  "savedMessages": ["msg-123", "msg-456"]
}
```

## ✨ 用户体验

1. **点击Save** → 消息保存到Canvas
2. **按钮变灰** → 显示"✓ Saved"
3. **刷新页面** → 按钮仍显示已保存状态
4. **打开Canvas** → 看到保存的text元素
5. **再次保存** → 后端返回alreadySaved=true，不重复创建

## 🔄 完整流程

```
用户点击Save
    ↓
handleSaveMessage
    ↓
POST /api/archive?action=saveMessage
    ↓
查找archive
    ↓
检查messageId是否已保存
    ↓
计算位置（maxBottom）
    ↓
估算文本高度
    ↓
创建items
    ↓
更新savedMessages数组
    ↓
保存到数据库
    ↓
前端更新message.saved = true
    ↓
按钮变为"✓ Saved"
```

## ✅ 测试清单

- [x] 保存纯文本消息
- [x] 保存带mindmap的消息
- [x] 保存带image的消息
- [x] 刷新后状态保持
- [x] 重复点击不重复保存
- [x] text宽度正确（600px vs 400px）
- [x] 高度估算准确
- [x] 位置不重叠
- [x] Save All不包括text消息
