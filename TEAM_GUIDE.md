# 👥 团队协作指南

## 🎯 推荐配置（共享 Supabase）

### 负责部署的同学（你）

1. **完成初始部署**
   - 按照 QUICKSTART.md 完成 Supabase + Vercel 部署
   - 获得公网链接

2. **共享配置给组员**
   - 创建一个 `team-env.txt` 文件（**不要提交到 Git**）
   - 内容如下：
   ```
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   
   SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
   - 通过微信/QQ等私聊发给组员（**不要公开分享**）

3. **告诉组员公网链接**
   ```
   生产环境: https://hush-to-hues.vercel.app
   ```

### 其他组员

1. **拉取最新代码**
   ```bash
   git pull
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **配置环境变量**
   - 在项目根目录创建 `.env.local` 文件
   - 复制负责部署同学发的配置内容
   - 粘贴到 `.env.local` 并保存

4. **启动本地开发**
   ```bash
   npm run dev:all
   ```
   
5. **访问本地版本**
   - 前端: http://localhost:3000
   - 后端: http://localhost:3001

## 📝 日常开发流程

### 修改前端代码
```bash
# 1. 拉取最新代码
git pull

# 2. 修改代码（比如 src/App.tsx）

# 3. 本地测试
npm run dev

# 4. 提交代码
git add .
git commit -m "feat: 添加新功能"
git push
```

### 修改后端代码
```bash
# 1. 拉取最新代码
git pull

# 2. 修改代码（比如 server/index-supabase.js）

# 3. 本地测试
npm run dev:all

# 4. 提交代码
git add .
git commit -m "feat: 添加新API"
git push
```

### 修改数据库结构（谨慎！）
```bash
# 1. 修改 supabase/schema.sql

# 2. 在 Supabase Dashboard 的 SQL Editor 中执行新的 SQL

# 3. 通知所有组员数据库已更新
```

## ⚠️ 注意事项

### .env.local 文件管理
- ✅ **已经在 .gitignore 中**，不会提交到 Git
- ✅ 每个人本地保留一份
- ❌ **不要**提交到 GitHub
- ❌ **不要**公开分享到网上

### Git 提交规范
```bash
# 好的提交信息示例
git commit -m "feat: 添加图片上传功能"
git commit -m "fix: 修复聊天页面刷新bug"
git commit -m "style: 调整社区卡片样式"
git commit -m "docs: 更新部署文档"

# 避免的提交信息
git commit -m "修改"
git commit -m "update"
git commit -m "bug"
```

### 代码冲突解决
```bash
# 如果 push 时提示冲突
git pull                    # 拉取最新代码
# 手动解决冲突
git add .
git commit -m "merge: 解决冲突"
git push
```

## 🚀 部署更新

### 自动部署（推荐）
- **触发条件**：`git push` 到 main/master 分支
- **部署时间**：1-2 分钟
- **如何查看**：
  1. 访问 https://vercel.com/dashboard
  2. 查看 Deployments 列表
  3. 看到 ✓ Ready 表示部署成功

### 手动部署
```bash
# 负责部署的同学可以手动触发
vercel --prod
```

### 回滚部署
```bash
# 如果新版本有问题，可以回滚
# 在 Vercel Dashboard 中点击上一个成功的部署
# 点击右上角 "Promote to Production"
```

## 👨‍💻 角色分工建议

### 前端开发
- 主要修改 `src/` 目录下的文件
- 运行 `npm run dev` 就够了
- 不需要启动后端（API 会代理到线上）

### 后端开发
- 主要修改 `server/` 目录下的文件
- 必须运行 `npm run dev:all` 测试
- 需要配置 `.env.local`

### 数据库管理
- 修改 `supabase/schema.sql`
- 在 Supabase Dashboard 中执行 SQL
- 通知组员数据库已更新

### UI/UX 设计
- 修改 `src/index.css` 和组件样式
- 只需要运行 `npm run dev`
- 保存后自动刷新页面

## 🔍 常见问题

### Q: 组员拉取代码后运行报错？
**A:** 检查是否配置了 `.env.local` 文件

### Q: 数据库连接失败？
**A:** 检查 `.env.local` 中的密钥是否正确

### Q: 多人同时修改同一个文件怎么办？
**A:** 
1. 提前沟通，避免同时修改
2. 使用 Git 分支开发
   ```bash
   git checkout -b feature/my-feature
   # 开发完成后
   git push origin feature/my-feature
   # 在 GitHub 上创建 Pull Request
   ```

### Q: 如何查看线上的错误日志？
**A:** 
1. 访问 https://vercel.com/dashboard
2. 点击你的项目
3. 点击 "Logs" 查看实时日志

### Q: Supabase 数据库被别人误删了怎么办？
**A:** 
1. Supabase 有自动备份
2. 在 Database → Backups 中恢复
3. 建议不要共享 SERVICE_KEY（权限太高）

## 💡 最佳实践

### 开发前
```bash
git pull              # 拉取最新代码
npm install          # 更新依赖（如果 package.json 变了）
```

### 开发中
```bash
npm run dev:all      # 启动开发服务器
# 保存代码后自动刷新
```

### 开发后
```bash
git status           # 查看修改了哪些文件
git add .
git commit -m "描述性的提交信息"
git pull             # 再次拉取，避免冲突
git push
```

### 提交前检查
- ✅ 代码能正常运行
- ✅ 没有 console.error 或 warning
- ✅ 没有提交 `.env.local` 文件
- ✅ 提交信息清晰明了

## 📞 遇到问题？

1. **先查文档**：QUICKSTART.md, DEPLOYMENT.md
2. **查看日志**：Vercel Dashboard, 浏览器控制台
3. **组内沟通**：微信群/QQ群讨论
4. **搜索答案**：Google/Stack Overflow
5. **问 AI**：Claude/ChatGPT

---

**记住**：团队协作的关键是**沟通**！有问题及时在群里说，避免重复劳动。
