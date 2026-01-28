# Vercel 部署配置指南

## ✅ 已修复的问题

1. **API 路由适配** - 现在 `api/index.js` 正确导出 Express app 供 Vercel Serverless Functions 使用
2. **本地开发兼容** - `npm run dev:server` 仍可正常工作
3. **路由优化** - 改进了静态资源和 SPA 路由处理

## 🚀 部署步骤

### 1. 在 Vercel 控制台配置环境变量

访问你的 Vercel 项目设置页面，添加以下环境变量：

```
SUPABASE_URL = https://dxeyrtuvqaufviohmgek.supabase.co
SUPABASE_SERVICE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4ZXlydHV2cWF1ZnZpb2htZ2VrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQ5MjAxOCwiZXhwIjoyMDg1MDY4MDE4fQ.VxdXfE1PCFbShAienCfzjkBRYHKqX584Txhm-TGUOl0

VITE_SUPABASE_URL = https://dxeyrtuvqaufviohmgek.supabase.co
VITE_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4ZXlydHV2cWF1ZnZpb2htZ2VrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0OTIwMTgsImV4cCI6MjA4NTA2ODAxOH0.57FgnRUK23gGYq4e5esGMTHC9N5BMnwDAZRU3IaQqnw
```

**重要**: 
- `SUPABASE_SERVICE_KEY` 用于服务端 API
- `VITE_SUPABASE_ANON_KEY` 用于前端构建时

### 2. 推送代码到 GitHub

```bash
git add .
git commit -m "fix: adapt API routes for Vercel Serverless Functions"
git push
```

### 3. Vercel 自动部署

Vercel 会自动检测推送并开始部署。部署完成后，你的应用将在以下地址可用：
- **生产环境**: `https://your-project.vercel.app`

### 4. 验证部署

部署完成后，测试以下端点：

```bash
# 健康检查
curl https://your-project.vercel.app/api/health

# 获取用户配置
curl https://your-project.vercel.app/api/profile

# 获取历史记录
curl https://your-project.vercel.app/api/history
```

## 🔧 本地开发

本地开发仍然使用相同的命令：

```bash
# 同时启动前端和后端
npm run dev:all

# 或单独启动
npm run dev          # 仅前端
npm run dev:server   # 仅后端
```

## 📝 架构说明

### 生产环境（Vercel）
```
前端静态文件 (dist/) → Vercel CDN
API 请求 (/api/*) → Vercel Serverless Function (api/index.js)
                  → Express App (server/index-supabase.js)
                  → Supabase
```

### 本地开发
```
前端 (localhost:3000) → Vite Dev Server
                      ↓ (proxy /api/*)
后端 (localhost:3001) → Express Server
                      → Supabase
```

## ⚠️ 注意事项

1. **Serverless 函数限制**:
   - 每次请求都是独立的
   - 内存数据（如 `chatMessages`）会在函数执行完后丢失
   - 建议将所有状态存储到 Supabase

2. **冷启动**:
   - 首次请求可能需要 1-2 秒
   - 后续请求会更快

3. **环境变量**:
   - 以 `VITE_` 开头的变量会在构建时注入到前端代码
   - 不以 `VITE_` 开头的变量仅在服务端可用

## 🐛 故障排查

### API 返回 404
- 检查 `vercel.json` 配置是否正确
- 检查 `api/index.js` 是否存在
- 查看 Vercel 部署日志

### API 返回 500
- 检查 Vercel 环境变量是否正确配置
- 查看 Vercel 函数日志（Settings → Functions → Logs）
- 检查 Supabase 连接是否正常

### 前端显示空白页面
- 检查浏览器控制台是否有错误
- 确认 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY` 已配置
- 尝试清除浏览器缓存

## 🎯 下一步优化建议

1. **迁移内存数据到数据库**:
   - 将 `chatMessages` 存储到 Supabase
   - 将 `activeHistoryId` 存储到用户会话

2. **添加错误处理**:
   - 在前端添加全局错误边界
   - 改进 API 错误消息

3. **性能优化**:
   - 启用 Redis 缓存（Vercel KV）
   - 实现请求去重和防抖

4. **集成 Gemini API**:
   - 添加环境变量 `GEMINI_API_KEY`
   - 实现真实的 AI 对话功能
