# Supabase 数据库操作指南

## 📋 目录结构

```
supabase/
├── README.md                                    # 本文件（操作指南）
├── SCHEMA_VALIDATION.md                         # Schema 验证文档
├── reset-database.sql                           # ✅ 完整重建脚本（删除+创建所有表）
├── seed.sql                                     # ✅ 初始数据脚本
├── guest-migration.sql                          # ✅ 增量迁移：添加 Guest 支持
├── fix-community-following.sql                  # ✅ 增量迁移：修复 Following 功能
├── migrate-community-reference-only-safe.sql    # ✅ 增量迁移：Community 改为 reference-only
└── migrate-data.js                              # Node.js 数据迁移脚本（备用）
```

## 🎯 执行顺序说明

### 场景 1：**从零开始搭建数据库**（推荐新项目）

**执行顺序**：
1. ✅ `reset-database.sql` - 创建所有表
2. ✅ `seed.sql` - 导入初始数据
3. ✅ 手动创建 Storage Bucket `artifacts`（见下方步骤）

**何时使用**：
- 第一次部署到新的 Supabase 项目
- 想要完全清空数据库重新开始
- 开发阶段快速迭代（不在乎数据丢失）

---

### 场景 2：**已有数据库，需要应用新功能**（生产环境）

**执行顺序**：
1. ✅ `guest-migration.sql` - 添加 Guest 用户支持（如果还没执行过）
2. ✅ `fix-community-following.sql` - 修复 Following 功能（如果遇到相关问题）
3. ✅ `migrate-community-reference-only-safe.sql` - 将 Community 改为引用模式（可选，新架构）

**何时使用**：
- 生产环境有真实用户数据，不能清空
- 需要保留历史数据
- 只想添加新功能或修复 Bug

**⚠️ 注意**：
- 这些迁移脚本是**幂等的**（可重复执行），已执行过的不会重复修改
- 执行前请先在测试环境验证
- `migrate-community-reference-only-safe.sql` 会重建 `community_posts` 表，请先备份

---

## 🚀 快速开始：场景 1 - 从零开始搭建数据库

### 通过 Supabase Dashboard（推荐）

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

## 🔄 场景 2：应用增量迁移（生产环境）

### 迁移 1：添加 Guest 用户支持

**文件**：`guest-migration.sql`

**功能**：
- 扩展 `profiles` 表支持种子用户
- 扩展 `chat_history` 表支持 Guest 所有者
- 扩展 `community_posts` 表支持 Guest 作者

**执行步骤**：
1. 打开 Supabase Dashboard > SQL Editor
2. 复制 `guest-migration.sql` 全部内容
3. 粘贴并执行
4. ✅ 看到 "Success" 即完成

**安全性**：
- ✅ 只添加新字段，不删除现有数据
- ✅ 幂等设计，可重复执行
- ✅ 为已有数据自动填充默认值

---

### 迁移 2：修复 Following 功能

**文件**：`fix-community-following.sql`

**功能**：
- 修复 `user_followed_communities` 表缺少 Guest 支持的问题
- 添加 `actor_type`/`actor_id` 字段
- 优化查询索引

**执行步骤**：
1. 打开 Supabase Dashboard > SQL Editor
2. 复制 `fix-community-following.sql` 全部内容
3. 粘贴并执行
4. ✅ 看到 "Success" 即完成

**安全性**：
- ✅ 只添加字段和索引
- ✅ 幂等设计
- ✅ 自动迁移已有记录

---

### 迁移 3：Community 改为 Reference-Only（新架构）

**文件**：`migrate-community-reference-only-safe.sql`

**功能**：
- 将 Community 从"快照模式"改为"引用模式"
- `community_posts` 表不再存储 canvas 内容副本，只存储 `session_id` 引用
- Detail 页面始终查询 Archive 的真实数据

**⚠️ 警告**：
- 此脚本会**重建** `community_posts` 表
- 执行前会自动创建 `community_posts_backup` 备份表
- 建议先在测试环境验证

**执行步骤**：
1. 打开 Supabase Dashboard > SQL Editor
2. 复制 `migrate-community-reference-only-safe.sql` 全部内容
3. **仔细阅读脚本注释**
4. 粘贴并执行
5. ✅ 检查输出中的 "Migration Summary"

**回滚方法**（如果出错）：
```sql
-- 恢复数据
DROP TABLE IF EXISTS community_posts CASCADE;
ALTER TABLE community_posts_backup RENAME TO community_posts;
-- 重建索引和约束（参考脚本底部的 ROLLBACK 部分）
```

---

## 🛠️ 方法 2：通过命令行（高级用户）

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
