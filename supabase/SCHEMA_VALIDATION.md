# 数据库Schema验证报告

## ✅ 验证状态：通过

已检查所有API端点和前端代码，确认数据库schema完整覆盖所有功能。

---

## 📊 表结构完整性检查

### 1. **profiles** 表 ✅
| 字段 | 类型 | 用途 | 使用位置 |
|------|------|------|----------|
| id | UUID | 主键 | supabase.js |
| user_name | TEXT | 用户名 | supabase.js, profile.js |
| user_handle | TEXT | 用户handle | supabase.js |
| avatar | TEXT | 头像URL | supabase.js |
| email_notifications | BOOLEAN | 邮件通知开关 | ProfilePage.tsx |
| save_history | BOOLEAN | 保存历史开关 | ProfilePage.tsx |
| public_profile | BOOLEAN | 公开资料开关 | ProfilePage.tsx |
| preferences | JSONB | 其他偏好（旧schema兼容） | supabase.js |
| created_at | TIMESTAMPTZ | 创建时间 | 系统 |
| updated_at | TIMESTAMPTZ | 更新时间 | 触发器 |

**验证结果**: ✅ 所有字段完整

---

### 2. **chat_sessions** 表 ✅
| 字段 | 类型 | 用途 | 使用位置 |
|------|------|------|----------|
| id | UUID | 主键 | 系统 |
| session_id | TEXT UNIQUE | 前端生成的sessionId | supabase.js |
| owner_type | TEXT | user/guest | supabase.js |
| owner_id | TEXT | 所有者ID | supabase.js |
| title | TEXT | 会话标题 | supabase.js |
| message_count | INTEGER | 消息数量 | supabase.js |
| last_message_at | TIMESTAMPTZ | 最后消息时间 | supabase.js |
| is_public | BOOLEAN | 是否公开 | supabase.js |
| tags | TEXT[] | 标签 | supabase.js |
| created_at | TIMESTAMPTZ | 创建时间 | 系统 |
| updated_at | TIMESTAMPTZ | 更新时间 | 触发器 |

**验证结果**: ✅ 所有字段完整

---

### 3. **chat_messages** 表 ✅
| 字段 | 类型 | 用途 | 使用位置 |
|------|------|------|----------|
| id | UUID | 主键 | 系统 |
| session_id | TEXT FK | 关联session | supabase.js |
| message_id | TEXT | 前端消息ID | supabase.js |
| sender | TEXT | user/bot | supabase.js |
| text | TEXT | 消息内容 | supabase.js |
| timestamp | TIMESTAMPTZ | 消息时间 | supabase.js |
| created_at | TIMESTAMPTZ | 创建时间 | 系统 |

**验证结果**: ✅ 所有字段完整

---

### 4. **artifacts** 表 ✅
| 字段 | 类型 | 用途 | 使用位置 |
|------|------|------|----------|
| id | UUID | 主键 | 系统 |
| session_id | TEXT FK | 关联session | supabase.js |
| artifact_type | TEXT | image/mindmap/save | supabase.js |
| prompt | TEXT | 生成提示词 | supabase.js |
| storage_path | TEXT | Storage路径 | supabase.js |
| public_url | TEXT | 公开URL | supabase.js |
| provider | TEXT | AI提供商 | supabase.js |
| model | TEXT | 使用的模型 | supabase.js |
| metadata | JSONB | 其他元数据 | supabase.js |
| created_at | TIMESTAMPTZ | 创建时间 | 系统 |

**验证结果**: ✅ 所有字段完整

---

### 5. **chat_history** 表 ✅ (关键表！)
| 字段 | 类型 | 用途 | 使用位置 |
|------|------|------|----------|
| id | UUID | 主键 | history.js, chat.js |
| profile_id | UUID FK | 旧schema兼容 | supabase.js (旧代码) |
| session_id | TEXT FK | 关联session | chat.js |
| **owner_type** | TEXT | user/guest | **history.js, chat.js** ✅ |
| **owner_id** | TEXT | 所有者ID | **history.js, chat.js** ✅ |
| title | TEXT | 标题 | history.js, HistoryPage.tsx |
| message_count | INTEGER | 消息数 | history.js, chat.js |
| last_message | TEXT | 最后消息 | history.js |
| preview_images | TEXT[] | 预览图 | history.js, HistoryPage.tsx |
| is_public | BOOLEAN | 是否公开 | history.js, HistoryPage.tsx |
| tags | TEXT[] | 标签 | history.js, chat.js |
| content_json | JSONB | 完整内容 | history.js, chat.js |
| **is_demo** | BOOLEAN | 是否demo | **history.js, chat.js** ✅ |
| **expires_at** | TIMESTAMPTZ | 过期时间 | **history.js, chat.js** ✅ |
| timestamp | TIMESTAMPTZ | 时间戳 | history.js |
| created_at | TIMESTAMPTZ | 创建时间 | 系统 |
| updated_at | TIMESTAMPTZ | 更新时间 | 触发器 |

**验证结果**: ✅ 所有字段完整（刚刚添加了is_demo和expires_at）

**使用场景**:
- GET /api/history - 查询actor的所有artifact历史
- POST /api/history - 创建新archive
- PATCH /api/history/:id - 更新title/isPublic
- DELETE /api/history/:id - 删除archive
- POST /api/chat?action=artifact - 保存mindmap/image到archive

---

### 6. **community_tags** 表 ✅
| 字段 | 类型 | 用途 | 使用位置 |
|------|------|------|----------|
| id | UUID | 主键 | community_posts FK |
| name | TEXT UNIQUE | 标签名 | community.js |
| icon | TEXT | 图标 | community.js |
| color | TEXT | 颜色 | community.js |
| member_count | INTEGER | 成员数 | community.js |
| total_posts | INTEGER | 帖子数 | community.js |
| created_at | TIMESTAMPTZ | 创建时间 | 系统 |

**验证结果**: ✅ 所有字段完整

---

### 7. **community_posts** 表 ✅ (字段最多！)
| 字段 | 类型 | 用途 | 使用位置 |
|------|------|------|----------|
| id | UUID | 主键 | like.js |
| post_id | TEXT | 帖子ID | seed.sql |
| session_id | TEXT FK | 关联session | publish.js |
| **author_type** | TEXT | user/guest/seed | **community.js, publish.js** ✅ |
| **author_id** | TEXT | 作者ID | **community.js, publish.js** ✅ |
| **author_name** | TEXT | 作者名 | **community.js, publish.js** ✅ |
| author_handle | TEXT | 作者handle | seed.sql |
| author_avatar | TEXT | 作者头像 | seed.sql |
| title | TEXT | 标题 | community.js, publish.js |
| **content** | TEXT | 内容 | **community.js, publish.js** ✅ |
| **summary** | TEXT | 摘要 | **community.js, publish.js** ✅ |
| **content_json** | JSONB | 结构化内容 | **publish.js** ✅ |
| preview_image | TEXT | 预览图 | seed.sql |
| **image_url** | TEXT | 图片URL | **community.js** ✅ |
| **asset_urls** | TEXT[] | 资源URL数组 | **community.js, publish.js** ✅ |
| **community_tag_id** | UUID FK | 社区分类 | **community.js, publish.js** ✅ |
| likes | INTEGER | 点赞数（旧字段） | like.js |
| likes_count | INTEGER | 点赞数（新字段） | seed.sql |
| comments | INTEGER | 评论数（旧字段） | seed.sql |
| comments_count | INTEGER | 评论数（新字段） | seed.sql |
| tags | TEXT[] | 标签 | community.js, publish.js |
| **is_demo** | BOOLEAN | 是否demo | **publish.js** ✅ |
| **expires_at** | TIMESTAMPTZ | 过期时间 | **community.js, publish.js** ✅ |
| timestamp | TIMESTAMPTZ | 发布时间 | community.js |
| created_at | TIMESTAMPTZ | 创建时间 | 系统 |
| updated_at | TIMESTAMPTZ | 更新时间 | 触发器 |

**验证结果**: ✅ 所有字段完整（同时支持likes和likes_count）

**使用场景**:
- GET /api/community?discover=true - 获取所有帖子
- POST /api/community/publish - 发布新帖子
- POST /api/community/like - 点赞帖子
- SELECT *, community_tags(name) - JOIN查询社区名

---

### 8. **user_likes** 表 ✅
| 字段 | 类型 | 用途 | 使用位置 |
|------|------|------|----------|
| id | UUID | 主键 | 系统 |
| profile_id | UUID FK | 旧schema用户ID | 旧代码 |
| **actor_type** | TEXT | user/guest | **community/like.js** ✅ |
| **actor_id** | TEXT | actor ID | **community/like.js** ✅ |
| target_type | TEXT | post/comment | like.js |
| target_id | TEXT | 目标ID | like.js |
| created_at | TIMESTAMPTZ | 创建时间 | 系统 |

**UNIQUE约束**: (actor_type, actor_id, target_type, target_id)

**验证结果**: ✅ 同时支持profile_id和actor模式

**使用场景**:
- POST /api/community/like - 点赞
- DELETE /api/community/like - 取消点赞
- 检查用户是否已点赞

---

### 9. **user_bookmarks** 表 ✅
| 字段 | 类型 | 用途 | 使用位置 |
|------|------|------|----------|
| id | UUID | 主键 | 系统 |
| profile_id | UUID FK | 旧schema用户ID | supabase.js |
| actor_type | TEXT | user/guest | 新代码扩展 |
| actor_id | TEXT | actor ID | 新代码扩展 |
| target_type | TEXT | 目标类型 | 新代码扩展 |
| target_id | TEXT | 目标ID | 新代码扩展 |
| post_id | UUID FK | 旧schema帖子ID | supabase.js |
| created_at | TIMESTAMPTZ | 创建时间 | 系统 |

**验证结果**: ✅ 兼容新旧两种模式

---

### 10. **user_followed_communities** 表 ✅
| 字段 | 类型 | 用途 | 使用位置 |
|------|------|------|----------|
| id | UUID | 主键 | 系统 |
| profile_id | UUID FK | 旧schema用户ID | supabase.js |
| actor_type | TEXT | user/guest | 新代码扩展 |
| actor_id | TEXT | actor ID | 新代码扩展 |
| community_tag_id | UUID FK | 关注的社区 | supabase.js |
| followed_at | TIMESTAMPTZ | 关注时间 | supabase.js |
| created_at | TIMESTAMPTZ | 创建时间 | 系统 |

**验证结果**: ✅ 兼容新旧两种模式

---

## 🔍 API端点验证

### Chat API (api/chat.js)
| 端点 | 方法 | 使用的表 | 字段验证 |
|------|------|---------|---------|
| POST /api/chat?action=message | POST | chat_history | ✅ owner_type, owner_id, content_json, is_demo, expires_at |
| POST /api/chat?action=artifact | POST | chat_history | ✅ owner_type, owner_id, tags, preview_images, content_json |

### History API (api/history.js)
| 端点 | 方法 | 使用的表 | 字段验证 |
|------|------|---------|---------|
| GET /api/history | GET | chat_history | ✅ owner_type, owner_id, tags, preview_images |
| POST /api/history | POST | chat_history | ✅ owner_type, owner_id, content_json, is_demo, expires_at |

### History Detail API (api/history/[id].js)
| 端点 | 方法 | 使用的表 | 字段验证 |
|------|------|---------|---------|
| GET /api/history/:id | GET | chat_history | ✅ owner_type, owner_id |
| PATCH /api/history/:id | PATCH | chat_history | ✅ title, is_public, tags |
| DELETE /api/history/:id | DELETE | chat_history | ✅ owner_type, owner_id (权限检查) |

### Community API (api/community.js)
| 端点 | 方法 | 使用的表 | 字段验证 |
|------|------|---------|---------|
| GET /api/community?discover=true | GET | community_posts, community_tags | ✅ author_type, author_name, image_url, content, expires_at |

### Community Publish API (api/community/publish.js)
| 端点 | 方法 | 使用的表 | 字段验证 |
|------|------|---------|---------|
| POST /api/community/publish | POST | community_posts, community_tags | ✅ author_type, author_id, author_name, content, summary, content_json, image_url, asset_urls, community_tag_id, is_demo, expires_at |

### Community Like API (api/community/like.js)
| 端点 | 方法 | 使用的表 | 字段验证 |
|------|------|---------|---------|
| POST /api/community/like | POST | user_likes, community_posts | ✅ actor_type, actor_id, target_type, target_id, likes |
| DELETE /api/community/like | DELETE | user_likes, community_posts | ✅ actor_type, actor_id |

---

## 🎯 历史Chat功能支持验证

### 需求：后续加入历史chat功能

**现有数据库支持：**

1. ✅ **chat_sessions** 表
   - session_id: 唯一标识每个会话
   - owner_type/owner_id: 标识所有者
   - title, message_count, last_message_at: 会话元数据
   - tags: 分类标签

2. ✅ **chat_messages** 表
   - session_id FK: 关联到会话
   - message_id, sender, text, timestamp: 完整消息记录
   - UNIQUE约束: (session_id, message_id) 防止重复

3. ✅ **chat_history** 表
   - session_id FK: 关联到会话
   - content_json: 存储完整对话JSON
   - tags: 支持筛选（如 'chat', 'session'）
   - 可用于Archive展示

**实现路径：**
```
查询历史chat列表:
  SELECT * FROM chat_sessions 
  WHERE owner_type = ? AND owner_id = ?
  ORDER BY last_message_at DESC

加载某个chat的消息:
  SELECT * FROM chat_messages
  WHERE session_id = ?
  ORDER BY timestamp ASC

恢复chat会话:
  1. 读取chat_messages
  2. 重建对话界面
  3. 继续对话（新消息append到chat_messages）
```

**结论**: ✅ **数据库完全支持历史chat功能，无需额外修改！**

---

## 📋 总结

### ✅ 验证通过项目
1. 所有10个表结构完整
2. 所有API端点字段匹配
3. 前后端数据结构一致
4. 新旧schema兼容（profile_id + actor_type/actor_id）
5. 历史chat功能完全支持

### ⚠️ 重要兼容性
- **user_likes/bookmarks/followed_communities**: 同时支持profile_id和actor模式
- **community_posts**: 同时支持likes和likes_count字段
- **chat_history**: 同时支持profile_id和owner_type/owner_id

### 🎯 Schema完整度：100%

**可以安全执行 reset-database.sql + seed.sql**
