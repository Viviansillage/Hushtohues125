# ❓ 常见问题解答 (FAQ)

## 💰 费用和限制

### Q1: 会一直占用我的 Supabase 和 Vercel 额度吗？
**A:** 是的，但不用担心：

**Supabase 免费版**
- ✅ 500MB 数据库（够用！一个 hackathon demo 可能只用几 MB）
- ✅ 1GB 文件存储（约 3400 张 AI 生成图片）
- ✅ 每月 2GB 带宽（够用！）
- ✅ **无时间限制**，永久免费
- ⚠️ 7天不活动会暂停（但重新访问自动恢复，数据不丢失）

**Vercel 免费版**
- ✅ 每月 100GB 带宽（够用！）
- ✅ 每天 100 次部署（够用！）
- ✅ **公网链接永久有效**
- ✅ **无时间限制**
- 💡 超过额度会暂停，但下个月自动恢复

**Hackathon 期间估算**
- 评委访问：10 人 × 5 次 = 50 次访问
- 每次加载：约 2MB
- 总流量：约 100MB（远低于 100GB 限制）

**结论**：**完全够用**，不会超额，不用付费！

### Q2: 公网链接会过期吗？
**A:** **不会！** 

- Vercel 的链接是永久的（除非你手动删除项目）
- 类似 `https://hush-to-hues.vercel.app`
- Hackathon 结束后还能继续访问
- 可以放在简历里展示作品

### Q3: 项目会被自动删除吗？
**A:** **不会！**

- Supabase 免费项目不会自动删除
- Vercel 免费项目不会自动删除
- 只要你不手动删除，项目会一直存在
- 即使超过免费额度，也只是暂停访问，不会删除数据

---

## 🔄 代码修改和部署

### Q4: 部署后还能修改代码吗？
**A:** **当然可以！** 这是常规开发流程：

**本地修改**
```bash
# 1. 修改代码
vim src/App.tsx

# 2. 本地测试
npm run dev:all

# 3. 提交到 Git
git add .
git commit -m "feat: 新功能"
git push
```

**自动部署**
- GitHub push 后，Vercel **自动检测**并重新部署
- 大约 1-2 分钟完成
- 公网链接不变，内容自动更新
- 可以在 https://vercel.com/dashboard 查看部署状态

**数据库不受影响**
- 代码更新不会影响数据库
- 已保存的数据会保留
- 除非你主动运行新的 SQL 脚本

### Q5: 如果部署失败了怎么办？
**A:** 
1. 查看 Vercel Dashboard 的错误日志
2. 常见原因：
   - 环境变量没配置
   - 代码有语法错误
   - 依赖包版本冲突
3. 修复后重新 push，Vercel 会自动重试
4. 或者在 Vercel Dashboard 点击 "Redeploy"

### Q6: 能回滚到之前的版本吗？
**A:** 可以！
1. 访问 Vercel Dashboard
2. 点击 "Deployments"
3. 找到之前成功的部署
4. 点击 "Promote to Production"

---

## 👥 团队协作

### Q7: 对组员有什么影响？
**A:** **基本没有**，但需要简单配置：

**组员需要做的**（5分钟）
1. 拉取最新代码：`git pull`
2. 安装依赖：`npm install`
3. 创建 `.env.local` 文件（你发给他们配置内容）
4. 启动开发：`npm run dev:all`

**好处**
- ✅ 大家共用一个数据库，数据同步
- ✅ 都能在本地开发和测试
- ✅ 不需要每个人都部署一遍

**注意**
- ⚠️ `.env.local` 文件不要提交到 Git
- ⚠️ Supabase 密钥要私聊发送，不要公开
- 💡 建议：只有你一个人负责 Vercel 部署，组员只做本地开发

### Q8: 多人同时修改代码会冲突吗？
**A:** 可能会，但可以避免：

**避免冲突的方法**
1. **提前沟通**：谁改哪个文件
2. **使用分支**：
   ```bash
   git checkout -b feature/my-feature
   # 开发完成后提交 Pull Request
   ```
3. **频繁 pull**：开发前先 `git pull`
4. **小步提交**：不要积累太多改动

**如果冲突了**
```bash
git pull                    # 拉取最新代码
# VS Code 会显示冲突，手动选择保留哪个版本
git add .
git commit -m "merge: 解决冲突"
git push
```

### Q9: 组员需要注册 Supabase 和 Vercel 吗？
**A:** **不需要！**

- 只有负责部署的人（你）需要注册
- 其他组员只需要：
  1. 配置 `.env.local`（使用你的密钥）
  2. 本地开发就行
- 所有人共用你的 Supabase 项目

---

## 🔒 安全性

### Q10: 密钥会不会泄露？
**A:** 只要遵守这些规则就安全：

**✅ 安全做法**
- `.env.local` 已在 `.gitignore` 中，不会提交到 Git
- 私聊发送密钥给组员（微信/QQ）
- 前端只使用 `ANON_KEY`（权限有限）
- 后端使用 `SERVICE_KEY`（权限较高，但只在服务器运行）

**❌ 危险做法**
- 不要把密钥提交到 GitHub
- 不要公开分享到网上
- 不要截图包含密钥的地方

**万一泄露了**
1. 访问 Supabase Dashboard
2. Project Settings → API
3. 点击 "Reset" 重新生成密钥
4. 更新 `.env.local` 和 Vercel 环境变量

### Q11: Supabase 数据会被别人访问吗？
**A:** 不会，已设置了 RLS（Row Level Security）

- 虽然现在允许公开访问（方便 hackathon demo）
- 但可以随时改为只允许认证用户访问
- 生产环境建议启用用户认证

---

## 🛠️ 技术问题

### Q12: 本地开发必须连接 Supabase 吗？
**A:** 是的，因为数据库在云端

- 本地开发需要联网
- API 会连接到 Supabase
- 如果想离线开发，可以：
  1. 使用 Supabase 本地模拟（需要 Docker）
  2. 或者暂时改回 `server/index.js`（使用 db.json）

### Q13: 如何查看数据库里的数据？
**A:** 
1. 访问 https://supabase.com
2. 进入你的项目
3. 点击左侧 "Table Editor"
4. 可以查看、编辑、删除数据

### Q14: 如何上传图片到 Supabase？
**A:** 使用 `server/storage.js` 中的函数：

```javascript
import { uploadImage, uploadBase64Image } from './storage.js';

// 上传文件
const url = await uploadImage(file, 'my-image.png');

// 上传 Base64
const url = await uploadBase64Image(base64Data, 'ai-generated.png');
```

---

## 📊 监控和调试

### Q15: 如何查看访问量？
**A:** 
1. Vercel Dashboard → Analytics
2. 可以看到：
   - 访问次数
   - 响应时间
   - 错误率
   - 地理分布

### Q16: 如何查看错误日志？
**A:** 
1. **前端错误**：浏览器控制台（F12）
2. **后端错误**：Vercel Dashboard → Logs
3. **数据库错误**：Supabase Dashboard → Logs

### Q17: API 返回 500 错误怎么办？
**A:** 
1. 查看 Vercel Logs 找到具体错误
2. 常见原因：
   - 环境变量未配置
   - Supabase 连接失败
   - SQL 查询错误
3. 修复代码后重新部署

---

## 🎯 Hackathon 特别问题

### Q18: 评委访问时会有问题吗？
**A:** 不会，但建议提前测试：

**提交前检查清单**
- [ ] 公网链接能正常打开
- [ ] 核心功能都能正常使用
- [ ] 没有明显的 bug
- [ ] 页面加载速度快（< 3秒）
- [ ] 在不同浏览器测试过（Chrome, Safari, Edge）
- [ ] 在手机上也能访问

**万一出问题**
- Vercel 有 99.99% 可用性，基本不会宕机
- 如果真的挂了，可以紧急回滚到上一个版本
- 或者快速修复后重新部署（1-2分钟）

### Q19: 需要准备演示数据吗？
**A:** 建议准备一些：

1. 运行数据迁移脚本：`node supabase/migrate-data.js`
2. 或者在 Supabase 中手动添加示例数据
3. 包括：
   - 几条聊天历史
   - 几个社区帖子
   - 一些点赞和收藏

### Q20: Hackathon 结束后怎么办？
**A:** 看你的选择：

**继续保留**
- 免费版一直有效
- 可以继续优化功能
- 放在简历里展示

**删除项目**
1. Supabase: Project Settings → General → Delete Project
2. Vercel: Project Settings → Advanced → Delete Project

**升级优化**
- 集成真实的 AI 功能
- 添加用户认证
- 优化性能和体验
- 升级到付费版获得更多资源

---

## 💡 最佳实践

### 部署前
- [ ] 本地测试通过
- [ ] 环境变量已配置
- [ ] 敏感信息未提交到 Git
- [ ] 团队成员都知道如何拉取最新代码

### 部署中
- [ ] 监控 Vercel 部署状态
- [ ] 检查 Supabase 连接是否正常
- [ ] 测试 API 端点是否响应

### 部署后
- [ ] 访问公网链接验证功能
- [ ] 分享链接给组员测试
- [ ] 记录下公网链接准备提交

---

**还有其他问题？** 查看 [QUICKSTART.md](QUICKSTART.md)、[DEPLOYMENT.md](DEPLOYMENT.md) 或 [TEAM_GUIDE.md](TEAM_GUIDE.md)
