# 思维导图功能实现

## ✅ 功能描述
点击 Chat 页面下方的 **Mindmap** 按钮后，思维导图会直接在对话框中生成并展示，就像 AI 回复一样。

## 🎯 实现细节

### 1. 数据流
```
用户点击 Mindmap 按钮
  ↓
handleArtifact('mindmap')
  ↓
POST /api/chat?action=artifact { kind: 'mindmap', messages }
  ↓
后端调用 Gemini 生成 structuredMindmap
  ↓
返回: { message, structuredMindmap: [{ id, label, children }] }
  ↓
前端创建 artifactMessage (包含 mindmap 数据)
  ↓
setMessages([...prev, artifactMessage])
  ↓
渲染: 检测到 message.artifact.type === 'mindmap'
  ↓
显示 MindmapNode 组件（递归渲染树形结构）
```

### 2. 代码改动

#### A. Message 类型扩展
```typescript
interface MindmapNode {
  id: string;
  label: string;
  children?: MindmapNode[];
}

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  artifact?: {
    type: 'mindmap' | 'image' | 'save';
    data?: any;  // mindmap 时为 MindmapNode[]
  };
}
```

#### B. MindmapNode 组件
```tsx
const MindmapNode = ({ node, level = 0 }: { node: MindmapNode; level?: number }) => {
  const colors = [
    'bg-blue-100 border-blue-400',
    'bg-green-100 border-green-400',
    'bg-yellow-100 border-yellow-400',
    'bg-pink-100 border-pink-400'
  ];
  
  return (
    <div className={`ml-${level * 8}`}>
      <div className={`px-4 py-2 rounded-lg border-2 ${colors[level % 4]}`}>
        {node.label}
      </div>
      {node.children?.map((child, idx) => (
        <MindmapNode key={child.id || idx} node={child} level={level + 1} />
      ))}
    </div>
  );
};
```

#### C. handleArtifact 保存完整数据
```typescript
const artifactMessage: Message = {
  id: `msg-${Date.now()}-artifact`,
  text: response.message.text,
  sender: 'bot',
  timestamp: new Date(response.message.timestamp),
  artifact: {
    type: kind as 'mindmap' | 'image' | 'save',
    data: kind === 'mindmap' ? response.structuredMindmap : undefined
  }
};
```

#### D. 消息列表中渲染 Mindmap
```tsx
{messages.map((message) => (
  <div key={message.id}>
    <p>{message.text}</p>
    
    {/* 渲染思维导图 */}
    {message.artifact?.type === 'mindmap' && message.artifact.data && (
      <div className="mt-4 p-4 bg-white rounded-lg border-2">
        <h3>🧠 Mindmap</h3>
        {Array.isArray(message.artifact.data) ? (
          message.artifact.data.map((node, idx) => (
            <MindmapNode key={node.id || idx} node={node} level={0} />
          ))
        ) : (
          <MindmapNode node={message.artifact.data} level={0} />
        )}
      </div>
    )}
  </div>
))}
```

### 3. 后端数据格式

后端 `/api/chat?action=artifact` 返回：
```json
{
  "message": {
    "id": "msg-123",
    "text": "✅ Saved mindmap: Design Thinking Process",
    "sender": "bot",
    "timestamp": "2026-01-30T10:00:00Z"
  },
  "structuredMindmap": [
    {
      "id": "root",
      "label": "Design Thinking",
      "children": [
        {
          "id": "empathize",
          "label": "Empathize",
          "children": [
            { "id": "research", "label": "User Research" },
            { "id": "interview", "label": "Interviews" }
          ]
        },
        {
          "id": "define",
          "label": "Define",
          "children": [
            { "id": "problem", "label": "Problem Statement" }
          ]
        }
      ]
    }
  ]
}
```

### 4. 视觉效果

```
┌─────────────────────────────────────┐
│ ✅ Saved mindmap: Design Thinking   │
│                                     │
│ 🧠 Mindmap                          │
│ ┌─────────────────┐                │
│ │ Design Thinking │ (蓝色)          │
│ └─────────────────┘                │
│   ┌──────────┐                     │
│   │ Empathize│ (绿色)               │
│   └──────────┘                     │
│     ┌──────────────┐               │
│     │ User Research│ (黄色)         │
│     └──────────────┘               │
│     ┌──────────┐                   │
│     │Interviews│ (黄色)             │
│     └──────────┘                   │
│   ┌────────┐                       │
│   │ Define │ (绿色)                 │
│   └────────┘                       │
│     ┌─────────────────┐            │
│     │Problem Statement│ (黄色)      │
│     └─────────────────┘            │
│                                     │
│ 10:23 AM                            │
└─────────────────────────────────────┘
```

### 5. localStorage 兼容性
- ✅ artifact 数据会随 messages 一起保存到 localStorage
- ✅ 刷新页面或切换标签后，思维导图仍然显示
- ✅ mapMessage 函数保留 artifact 字段

## 🧪 测试步骤

1. **进入 Chat 页面**，发送几条消息，例如：
   - "我想学习设计思维"
   - "设计思维有哪些步骤？"
   - "如何进行用户研究？"

2. **点击 Mindmap 按钮**

3. **验证**：
   - ✅ 显示 toast："Saved mindmap to your archive."
   - ✅ 聊天界面中出现一条消息："✅ Saved mindmap: ..."
   - ✅ 消息下方显示思维导图（树形结构，彩色节点）
   - ✅ 思维导图包含多级节点（根节点 → 分支 → 叶子节点）

4. **切换到 Archive 页面**，验证：
   - ✅ Archive 中新增 1 张 Mindmap 卡片

5. **切换回 Chat 页面**，验证：
   - ✅ 思维导图仍然显示在聊天记录中

6. **刷新页面（F5）**，验证：
   - ✅ 思维导图仍然存在（localStorage 持久化）

## 🎨 样式说明

- **根节点**（level 0）：蓝色背景 + 蓝色边框
- **一级分支**（level 1）：绿色背景 + 绿色边框
- **二级分支**（level 2）：黄色背景 + 黄色边框
- **三级分支**（level 3）：粉色背景 + 粉色边框
- **更深层级**：循环使用上述 4 种颜色

每个节点都有：
- `px-4 py-2`：内边距
- `rounded-lg`：圆角
- `border-2`：2px 边框
- `hand-drawn-border`：手绘风格边框（via CSS filter）

## 📝 未来改进

1. **交互式思维导图**：
   - 节点可折叠/展开
   - 点击节点高亮
   - 拖拽调整位置

2. **导出功能**：
   - 导出为图片（PNG/SVG）
   - 导出为 PDF
   - 分享链接

3. **更丰富的样式**：
   - 自定义颜色主题
   - 不同的布局方式（横向/纵向/放射状）
   - 节点图标/emoji

4. **编辑功能**：
   - 手动添加/删除节点
   - 修改节点文本
   - 调整层级关系
