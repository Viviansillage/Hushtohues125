# 🚀 快速开始 - Hush to Hues

## 代码已经改好了！现在需要你做这些：

### 第一步：创建 Supabase 项目（5分钟）

1. **访问 Supabase**
   - 打开 https://supabase.com
   - 用 GitHub 账号登录
   - 点击 "New Project"

2. **创建项目**
   - 项目名称：随便起一个，比如 `hush-to-hues`
   - 数据库密码：随便设一个，记住它
   - 地区：选择 `Northeast Asia (Tokyo)` 或 `Southeast Asia (Singapore)` 距离中国最近
   - 点击 "Create new project"，等待2-3分钟

3. **获取密钥**
   - 项目创建完成后，点击左侧菜单 "Project Settings" （齿轮图标）
   - 点击 "API"
   - 复制以下信息：
     ```
     Project URL: https://xxxxx.supabase.co
     anon public: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3M...
     service_role: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3M...
     ```

### 第二步：设置数据库（2分钟）

1. **打开 SQL 编辑器**
   - 点击左侧菜单 "SQL Editor"
   - 点击 "+ New query"

2. **运行数据库脚本**
   - 打开项目中的 `supabase/schema.sql` 文件
   - 全选复制（Ctrl+A, Ctrl+C）
   - 粘贴到 Supabase SQL 编辑器
   - 点击右下角 "Run" 按钮
   - 看到 "Success. No rows returned" 就成功了

3. **创建图片存储桶**
   - 点击左侧菜单 "Storage"
   - 点击 "Create a new bucket"
   - 名称填写：`images`
   - 勾选 "Public bucket"
   - 点击 "Create bucket"

### 第三步：配置本地环境（2分钟）

1. **创建环境变量文件**
   ```bash
   # 在项目根目录创建 .env.local 文件
   # 复制下面的内容，替换成你自己的密钥
   ```

2. **编辑 `.env.local`**（用记事本打开）
   ```
   VITE_SUPABASE_URL=https://你的项目ID.supabase.co
   VITE_SUPABASE_ANON_KEY=你的anon_public密钥

   SUPABASE_URL=https://你的项目ID.supabase.co
   SUPABASE_SERVICE_KEY=你的service_role密钥

   GEMINI_API_KEY=你的Gemini密钥（暂时可以不填）
   ```

### 第四步：迁移数据（可选，1分钟）

如果想保留原来 `db.json` 中的测试数据：

```bash
node supabase/migrate-data.js
```

看到 "🎉 数据迁移完成！" 就成功了。

### 第五步：本地测试（1分钟）

```bash
# 安装依赖（如果还没装）
npm install

# 启动开发服务器
npm run dev:all
```

打开浏览器访问 http://localhost:3000，测试一下功能是否正常。

### 第六步：部署到 Vercel（5分钟）

#### 方法1：通过 GitHub（推荐）

1. **推送代码到 GitHub**
   ```bash
   git add .
   git commit -m "feat: 集成 Supabase 数据库"
   git push
   ```

2. **在 Vercel 部署**
   - 访问 https://vercel.com
   - 用 GitHub 登录
   - 点击 "Import Project"
   - 选择你的仓库
   - 点击 "Import"

3. **配置环境变量**
   - 在 Vercel 部署页面，点击 "Environment Variables"
   - 添加以下变量：
     ```
     SUPABASE_URL = https://你的项目ID.supabase.co
     SUPABASE_SERVICE_KEY = 你的service_role密钥
     VITE_SUPABASE_URL = https://你的项目ID.supabase.co
     VITE_SUPABASE_ANON_KEY = 你的anon_public密钥
     ```
   - 点击 "Deploy"

4. **等待部署完成**
   - 大约1-2分钟
   - 看到 "✓ Deployment ready" 就成功了
   - 复制公网链接，比如：`https://hush-to-hues.vercel.app`

#### 方法2：通过 CLI

```bash
# 安装 Vercel CLI
npm install -g vercel

# 登录
vercel login

# 部署
vercel

# 添加环境变量
vercel env add SUPABASE_URL
vercel env add SUPABASE_SERVICE_KEY
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY

# 重新部署到生产环境
vercel --prod
```

## ✅ 完成！

现在你有了一个公网可访问的链接，可以提交给 hackathon 了！

## 🔍 验证部署

访问你的公网链接，测试以下功能：

- ✅ 页面能正常打开
- ✅ 能发送聊天消息
- ✅ 能查看历史记录
- ✅ 能浏览社区帖子
- ✅ 能点赞、收藏

## ❓ 遇到问题？

### API 404 错误
检查 `vercel.json` 和 `api/index.js` 是否存在

### 数据库连接失败
检查 `.env.local` 中的密钥是否正确

### 图片上传失败
确认在 Supabase Storage 中创建了 `images` bucket

### 其他问题
查看详细的 `DEPLOYMENT.md` 文档

## 📚 项目结构变化

```
新增文件：
├── supabase/
│   ├── schema.sql              # 数据库表结构
│   └── migrate-data.js         # 数据迁移脚本
├── server/
│   ├── supabase.js            # Supabase 数据操作
│   ├── storage.js             # 图片上传功能
│   └── index-supabase.js      # 新的后端入口（使用 Supabase）
├── api/
│   └── index.js               # Vercel Serverless Function 入口
├── .env.example               # 环境变量示例
├── .env.local                 # 你的本地配置（需要自己创建）
├── vercel.json                # Vercel 部署配置
└── DEPLOYMENT.md              # 详细部署文档

保留的旧文件（备份用）：
├── server/
│   ├── index.js               # 旧的后端（使用 db.json）
│   ├── data.js                # JSON 文件读写
│   └── db.json                # 旧的 JSON 数据库
```

## 🎯 下一步优化（hackathon 后再做）

- [ ] 集成 Gemini AI 生成真实回复
- [ ] 实现图片生成功能
- [ ] 添加用户认证（Supabase Auth）
- [ ] 优化图片压缩和缓存
- [ ] 添加实时聊天（Supabase Realtime）
