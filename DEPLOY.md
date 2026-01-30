# 快速部署指南

## ✅ 所有修改已完成，代码无错误

## 改动文件
- `api/chat.js` - action=message 不写 DB，纯内存对话
- `api/history.js` - 只返回 artifact（kind: mindmap/image/save）
- `src/lib/api.ts` - 前端 API 传递 messages
- `src/components/ChatPage.tsx` - 前端维护 messages state

## 部署步骤

```powershell
# 1. 查看改动
git status

# 2. 提交所有修改
git add api/chat.js api/history.js src/lib/api.ts src/components/ChatPage.tsx VERIFICATION_STEPS.md CHANGELOG_ARCHIVE_FIX.md DEPLOY.md
git commit -m "fix: 聊天对话不进入 Archive，只有显式保存的 artifact 才进入

- action=message 改为纯内存对话（不写 DB）
- action=artifact 写入 chat_history（带 kind 标记）
- GET /api/history 只返回 artifact（过滤 tags）
- 前端 ChatPage 维护 messages state（不再依赖 conversationId）
"

# 3. 推送到 Vercel
git push

# 4. 等待部署（1-2 分钟）
# 在 Vercel Dashboard 查看：https://vercel.com/

# 5. 部署完成后，快速验证
curl https://hush-to-hues.vercel.app/api/history -H "X-Guest-ID: test-123"
# 应该只返回之前的 artifact（没有新增聊天记录）
```

## 验收测试（UI 操作）

### ✅ 测试 1：连续对话不进入 Archive
1. 打开 https://hush-to-hues.vercel.app
2. 进入 Chat 页面
3. 连续发送 5-10 条消息（例如："Hello", "Tell me about design", "What is UX?"）
4. 进入 Archive 页面
5. **验证**：Archive 不应该新增任何卡片

### ✅ 测试 2：点击 Image 进入 Archive
1. 返回 Chat 页面
2. 点击 "Image" 按钮
3. 看到 toast："Saved image to your archive."
4. 进入 Archive 页面
5. **验证**：新增 1 张 Image 卡片

### ✅ 测试 3：继续聊天仍然不进入 Archive
1. 返回 Chat 页面
2. 继续发送 3-5 条消息
3. 进入 Archive 页面
4. **验证**：仍然只有 1 张 Image 卡片（没有新增）

### ✅ 测试 4：点击 Mindmap 进入 Archive
1. 返回 Chat 页面
2. 点击 "Mindmap" 按钮
3. 看到 toast："Saved mindmap to your archive."
4. 进入 Archive 页面
5. **验证**：新增 1 张 Mindmap 卡片（总共 2 张）

### ✅ 测试 5：Archive 只显示 artifact
1. 检查 Archive 列表
2. **验证**：
   - 只有 Image 和 Mindmap 卡片
   - 没有 "Chat Session" 或 "#chat" 标签的卡片
   - 每张卡片都有明确的类型标识

## 常见问题

### Q: Archive 还是显示了聊天记录？
A: 这些是之前测试留下的数据。新的对话不会再进入 Archive。可以在 Supabase Dashboard 手动删除 `tags` 包含 `"chat"` 的记录。

### Q: 对话没有上下文了？
A: 检查浏览器控制台，看 POST /api/chat?action=message 的请求体是否包含 `messages` 字段。

### Q: Mindmap 返回 400？
A: 检查 Gemini API 返回是否正常。可能是 API key 配额用尽或网络问题。

## 成功标志

✅ 聊天 10 次，Archive 不新增  
✅ 点击按钮 1 次，Archive 新增 1 条  
✅ Archive 只显示用户显式保存的作品

---

**祝部署顺利！🚀**
