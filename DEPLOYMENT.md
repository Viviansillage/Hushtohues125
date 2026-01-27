# Hush to Hues - 部署指南

## 🎯 部署到 Vercel + Supabase

### 前置准备

1. **创建 Supabase 项目**
   - 访问 [https://supabase.com](https://supabase.com)
   - 点击 "New Project" 创建新项目
   - 记录以下信息：
     - Project URL (例如: `https://xxxxx.supabase.co`)
     - Anon Key (公开密钥)
     - Service Role Key (服务端密钥，保密)

2. **设置 Supabase 数据库**
   - 进入 Supabase 项目控制台
   - 点击左侧菜单 "SQL Editor"
   - 复制 `supabase/schema.sql` 的内容
   - 粘贴并执行 SQL 脚本
   - 验证所有表已创建成功

3. **设置 Supabase Storage**
   - 点击左侧菜单 "Storage"
   - 创建新的 bucket，名称为 `images`
   - 设置为公开访问 (Public bucket)
   - 配置 CORS 允许跨域访问

4. **迁移现有数据（可选）**
   - 运行 `node supabase/migrate-data.js` 将 db.json 数据迁移到 Supabase
   - 或在 Supabase SQL Editor 中手动插入测试数据

### 本地开发

1. **配置环境变量**
   ```bash
   # 复制环境变量模板
   cp .env.example .env.local
   
   # 编辑 .env.local 填入真实的 Supabase 配置
   VITE_SUPABASE_URL=你的项目URL
   VITE_SUPABASE_ANON_KEY=你的匿名密钥
   SUPABASE_URL=你的项目URL
   SUPABASE_SERVICE_KEY=你的服务端密钥
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **启动开发服务器**
   ```bash
   # 同时启动前端和后端
   npm run dev:all
   
   # 或者分别启动
   # 终端1: 前端
   npm run dev
   
   # 终端2: 后端
   npm run dev:server
   ```

4. **访问应用**
   - 前端: http://localhost:3000
   - 后端 API: http://localhost:3001

### 部署到 Vercel

1. **安装 Vercel CLI（可选）**
   ```bash
   npm install -g vercel
   ```

2. **通过 Vercel 网站部署（推荐）**
   - 访问 [https://vercel.com](https://vercel.com)
   - 导入 GitHub 仓库
   - 配置环境变量：
     - `SUPABASE_URL`
     - `SUPABASE_SERVICE_KEY`
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_ANON_KEY`
     - `GEMINI_API_KEY`（可选，用于 AI 功能）
   - 点击 Deploy

3. **通过 CLI 部署**
   ```bash
   vercel
   # 按提示配置项目
   
   # 添加环境变量
   vercel env add SUPABASE_URL
   vercel env add SUPABASE_SERVICE_KEY
   vercel env add VITE_SUPABASE_URL
   vercel env add VITE_SUPABASE_ANON_KEY
   
   # 重新部署
   vercel --prod
   ```

### 验证部署

1. **检查前端**
   - 访问 Vercel 提供的公网URL
   - 测试页面加载是否正常

2. **检查 API**
   - 访问 `https://your-app.vercel.app/api/health`
   - 应该返回 `{"status": "ok"}`

3. **测试功能**
   - 测试聊天功能
   - 测试历史记录保存
   - 测试社区帖子浏览
   - 测试点赞、收藏功能

## 📝 配置说明

### Vercel 配置 (vercel.json)

```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": { "distDir": "build" }
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/api/index.js"
    },
    {
      "src": "/(.*)",
      "dest": "/$1"
    }
  ]
}
```

### 环境变量说明

- `VITE_SUPABASE_URL`: 前端使用的 Supabase URL
- `VITE_SUPABASE_ANON_KEY`: 前端使用的公开密钥
- `SUPABASE_URL`: 后端使用的 Supabase URL
- `SUPABASE_SERVICE_KEY`: 后端使用的服务端密钥（权限更高）
- `GEMINI_API_KEY`: Google Gemini AI API 密钥（可选）

## 🚀 性能优化建议

1. **图片优化**
   - 使用 Supabase 图片转换 API 压缩图片
   - 设置合理的缓存策略

2. **数据库优化**
   - 已创建索引，无需额外配置
   - 定期清理过期数据

3. **CDN 加速**
   - Vercel 自带全球 CDN
   - Supabase Storage 自动使用 CDN

## ⚠️ 注意事项

1. **安全性**
   - 不要将 Service Role Key 暴露到前端
   - 生产环境建议启用更严格的 RLS 策略
   - 定期轮换 API 密钥

2. **限制**
   - Supabase 免费版：500MB 数据库 + 1GB 存储
   - Vercel 免费版：100GB 带宽/月
   - 超出限制需升级付费计划

3. **监控**
   - 在 Vercel Dashboard 查看访问量和错误日志
   - 在 Supabase Dashboard 查看数据库性能

## 📞 故障排除

### 1. API 请求 404
- 检查 `vercel.json` 路由配置
- 确认 `api/index.js` 文件存在

### 2. 数据库连接失败
- 验证环境变量是否正确配置
- 检查 Supabase 项目是否暂停（免费版7天不活动会暂停）

### 3. 图片上传失败
- 确认 Storage bucket 已创建且为公开
- 检查文件大小限制（默认50MB）

### 4. CORS 错误
- 在 Supabase 项目设置中配置允许的域名
- 检查 API 路由是否正确配置 CORS

## 🔗 相关资源

- [Vercel 文档](https://vercel.com/docs)
- [Supabase 文档](https://supabase.com/docs)
- [Vite 部署指南](https://vitejs.dev/guide/static-deploy.html)
