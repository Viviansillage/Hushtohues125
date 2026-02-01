# Supabase 数据库操作指南

## 📋 目录结构

```
supabase/
├── README.md           # 本文件（操作指南）
├── reset-database.sql  # 完整重建脚本（删除+创建表）
├── seed.sql           # 初始数据脚本
├── schema.sql         # 旧的schema文件（已废弃）
└── migration.sql      # 旧的迁移文件（已废弃）
```

## 🚀 快速开始：完全重建数据库

### 方法 1：通过 Supabase Dashboard（推荐）

#### 步骤 1：打开 SQL Editor
1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择你的项目：**Hush to Hues**
3. 点击左侧菜单 **SQL Editor**

#### 步骤 2：执行重建脚本
1. 点击 **New query** 创建新查询
2. 复制 `reset-database.sql` 的**全部内容**
3. 粘贴到 SQL Editor
4. 点击 **Run** 按钮（或按 Ctrl+Enter / Cmd+Enter）
5. 等待执行完成（约 5-10 秒）

✅ 看到 "Success. No rows returned" 表示成功！

#### 步骤 3：导入初始数据
1. 再次点击 **New query**
2. 复制 `seed.sql` 的**全部内容**
3. 粘贴到 SQL Editor
4. 点击 **Run**
5. 等待执行完成

✅ 看到类似下面的输出表示成功：
```
status                          | profiles_count | sessions_count | messages_count | history_count | posts_count
Database seeded successfully!   | 1              | 3              | 4              | 3             | 2
```

#### 步骤 4：创建 Storage Bucket（重要！）

1. 点击左侧菜单 **Storage**
2. 点击 **Create a new bucket**
3. 配置如下：
   - **Name**: `artifacts`
   - **Public bucket**: ✅ 勾选（允许公开访问）
   - **File size limit**: `50 MB`（可选）
   - **Allowed MIME types**: 留空（允许所有类型）
4. 点击 **Create bucket**

✅ Bucket 创建成功后，在列表中可以看到 `artifacts`

#### 步骤 5：验证数据库

1. 点击左侧菜单 **Table Editor**
2. 检查以下表是否存在：
   - ✅ `profiles`
   - ✅ `chat_sessions`
   - ✅ `chat_messages`
   - ✅ `artifacts`
   - ✅ `chat_history`
   - ✅ `community_posts`
3. 点击任意表，查看是否有初始数据

---

### 方法 2：通过命令行（高级用户）

```bash
# 1. 安装 Supabase CLI（如果尚未安装）
npm install -g supabase

# 2. 登录
supabase login

# 3. 链接到项目
supabase link --project-ref <你的项目ID>

# 4. 执行重建脚本
supabase db reset

# 5. 执行初始数据
psql $DATABASE_URL -f supabase/seed.sql
```

---

## 📊 数据库架构概览

### 核心表

| 表名 | 用途 | 关键字段 |
|------|------|----------|
| `profiles` | 用户配置 | user_name, user_handle, avatar, preferences |
| `chat_sessions` | 聊天会话元数据 | session_id (唯一), owner_type, owner_id, title |
| `chat_messages` | 所有聊天消息 | session_id (FK), message_id, sender, text |
| `artifacts` | 生成的图片/mindmap | session_id (FK), artifact_type, public_url, provider, model |
| `chat_history` | 历史记录视图 | session_id (FK), title, message_count, preview_images, tags |
| `community_posts` | 社区帖子 | post_id, session_id (FK), author, title, likes_count |

### 关系图

```
profiles (1) ──── (n) chat_sessions
                       │
                       ├── (n) chat_messages
                       ├── (n) artifacts
                       └── (1) chat_history

chat_sessions (1) ──── (n) community_posts
```

---

## 🔄 后续修改数据库的流程

### 方案 A：继续使用"完全重建"模式（推荐 Hackathon）

**适用场景**：
- 快速迭代开发
- 没有真实用户数据
- Schema 变动频繁

**步骤**：
1. 修改 `reset-database.sql`（添加/删除表、字段等）
2. 修改 `seed.sql`（更新初始数据）
3. 在 Supabase Dashboard 依次运行两个脚本
4. ✅ 完成

**优点**：
- 简单直接
- 无需维护迁移历史
- 每次都是干净状态

**缺点**：
- 会删除所有数据（开发阶段无所谓）

---

### 方案 B：使用增量迁移（生产环境）

**适用场景**：
- 有真实用户数据
- 需要保留历史数据
- Schema 已稳定

**步骤**：
1. 创建新的迁移文件：`migration_002_add_xxx.sql`
2. 只写增量变更（ADD COLUMN、CREATE INDEX 等）
3. 在 Supabase 执行新迁移
4. ✅ 数据保留

**示例**：
```sql
-- migration_002_add_user_bio.sql
ALTER TABLE profiles ADD COLUMN bio TEXT;
CREATE INDEX idx_profiles_bio ON profiles(bio);
```

---

## ⚠️ 常见问题

### Q1: 执行 reset-database.sql 报错 "permission denied"
**A**: 确保你有数据库的 Owner 权限。在 Supabase Dashboard 中执行通常没有权限问题。

### Q2: seed.sql 插入数据失败
**A**: 确保先执行了 `reset-database.sql`，表必须先存在。

### Q3: Storage bucket 创建后找不到
**A**: 刷新页面，或检查是否选对了项目。

### Q4: RLS 策略阻止了访问
**A**: 当前配置为 "Allow all"，如果修改了策略，确保前端可以访问。

### Q5: 想恢复到之前的数据
**A**: 完全重建模式下数据会丢失，建议开发时定期导出数据：
```sql
-- 在 SQL Editor 运行
COPY chat_sessions TO STDOUT WITH CSV HEADER;
COPY chat_messages TO STDOUT WITH CSV HEADER;
```

---

## 📚 参考资源

- [Supabase 官方文档](https://supabase.com/docs)
- [Supabase SQL Editor 指南](https://supabase.com/docs/guides/database/overview)
- [Supabase Storage 文档](https://supabase.com/docs/guides/storage)

---

## ✅ 检查清单

完成数据库重建后，确认以下事项：

- [ ] 6 个表都已创建（profiles, chat_sessions, chat_messages, artifacts, chat_history, community_posts）
- [ ] seed.sql 成功执行，有初始数据
- [ ] Storage bucket `artifacts` 已创建且为公开访问
- [ ] 在 Table Editor 中可以看到所有表和数据
- [ ] 前端应用可以正常访问数据库（测试一下）

🎉 恭喜！数据库重建完成！
