# Database Schema Validation Report

## ✅ Validation Status: PASSED

All API endpoints and frontend code have been checked; the database schema fully covers all features.

---

## 📊 Table Structure Integrity Check

### 1. **profiles** table ✅
| Column | Type | Purpose | Used in |
|--------|------|---------|---------|
| id | UUID | Primary key | supabase.js |
| user_name | TEXT | Username | supabase.js, profile.js |
| user_handle | TEXT | User handle | supabase.js |
| avatar | TEXT | Avatar URL | supabase.js |
| email_notifications | BOOLEAN | Email notification toggle | ProfilePage.tsx |
| save_history | BOOLEAN | Save history toggle | ProfilePage.tsx |
| public_profile | BOOLEAN | Public profile toggle | ProfilePage.tsx |
| preferences | JSONB | Extra preferences (legacy schema compatibility) | supabase.js |
| created_at | TIMESTAMPTZ | Created time | System |
| updated_at | TIMESTAMPTZ | Updated time | Trigger |

**Result**: ✅ All fields present

---

### 2. **chat_sessions** table ✅
| Column | Type | Purpose | Used in |
|--------|------|---------|---------|
| id | UUID | Primary key | System |
| session_id | TEXT UNIQUE | Frontend-generated sessionId | supabase.js |
| owner_type | TEXT | user/guest | supabase.js |
| owner_id | TEXT | Owner ID | supabase.js |
| title | TEXT | Session title | supabase.js |
| message_count | INTEGER | Message count | supabase.js |
| last_message_at | TIMESTAMPTZ | Last message time | supabase.js |
| is_public | BOOLEAN | Public flag | supabase.js |
| tags | TEXT[] | Tags | supabase.js |
| created_at | TIMESTAMPTZ | Created time | System |
| updated_at | TIMESTAMPTZ | Updated time | Trigger |

**Result**: ✅ All fields present

---

### 3. **chat_messages** table ✅
| Column | Type | Purpose | Used in |
|--------|------|---------|---------|
| id | UUID | Primary key | System |
| session_id | TEXT FK | Linked session | supabase.js |
| message_id | TEXT | Frontend message ID | supabase.js |
| sender | TEXT | user/bot | supabase.js |
| text | TEXT | Message content | supabase.js |
| timestamp | TIMESTAMPTZ | Message time | supabase.js |
| created_at | TIMESTAMPTZ | Created time | System |

**Result**: ✅ All fields present

---

### 4. **artifacts** table ✅
| Column | Type | Purpose | Used in |
|--------|------|---------|---------|
| id | UUID | Primary key | System |
| session_id | TEXT FK | Linked session | supabase.js |
| artifact_type | TEXT | image/mindmap/save | supabase.js |
| prompt | TEXT | Generation prompt | supabase.js |
| storage_path | TEXT | Storage path | supabase.js |
| public_url | TEXT | Public URL | supabase.js |
| provider | TEXT | AI provider | supabase.js |
| model | TEXT | Model used | supabase.js |
| metadata | JSONB | Extra metadata | supabase.js |
| created_at | TIMESTAMPTZ | Created time | System |

**Result**: ✅ All fields present

---

### 5. **chat_history** table ✅ (key table)
| Column | Type | Purpose | Used in |
|--------|------|---------|---------|
| id | UUID | Primary key | history.js, chat.js |
| profile_id | UUID FK | Legacy schema compatibility | supabase.js (legacy code) |
| session_id | TEXT FK | Linked session | chat.js |
| **owner_type** | TEXT | user/guest | **history.js, chat.js** ✅ |
| **owner_id** | TEXT | Owner ID | **history.js, chat.js** ✅ |
| title | TEXT | Title | history.js, HistoryPage.tsx |
| message_count | INTEGER | Message count | history.js, chat.js |
| last_message | TEXT | Last message | history.js |
| preview_images | TEXT[] | Preview images | history.js, HistoryPage.tsx |
| is_public | BOOLEAN | Public flag | history.js, HistoryPage.tsx |
| tags | TEXT[] | Tags | history.js, chat.js |
| content_json | JSONB | Full content | history.js, chat.js |
| **is_demo** | BOOLEAN | Demo flag | **history.js, chat.js** ✅ |
| **expires_at** | TIMESTAMPTZ | Expiration time | **history.js, chat.js** ✅ |
| timestamp | TIMESTAMPTZ | Timestamp | history.js |
| created_at | TIMESTAMPTZ | Created time | System |
| updated_at | TIMESTAMPTZ | Updated time | Trigger |

**Result**: ✅ All fields present (is_demo and expires_at recently added)

**Use cases**:
- GET /api/history - fetch all artifact history for an actor
- POST /api/history - create new archive
- PATCH /api/history/:id - update title/isPublic
- DELETE /api/history/:id - delete archive
- POST /api/chat?action=artifact - save mindmap/image to archive

---

### 6. **community_tags** table ✅
| Column | Type | Purpose | Used in |
|--------|------|---------|---------|
| id | UUID | Primary key | community_posts FK |
| name | TEXT UNIQUE | Tag name | community.js |
| icon | TEXT | Icon | community.js |
| color | TEXT | Color | community.js |
| member_count | INTEGER | Member count | community.js |
| total_posts | INTEGER | Posts count | community.js |
| created_at | TIMESTAMPTZ | Created time | System |

**Result**: ✅ All fields present

---

### 7. **community_posts** table ✅ (most fields)
| Column | Type | Purpose | Used in |
|--------|------|---------|---------|
| id | UUID | Primary key | like.js |
| post_id | TEXT | Post ID | seed.sql |
| session_id | TEXT FK | Linked session | publish.js |
| **author_type** | TEXT | user/guest/seed | **community.js, publish.js** ✅ |
| **author_id** | TEXT | Author ID | **community.js, publish.js** ✅ |
| **author_name** | TEXT | Author name | **community.js, publish.js** ✅ |
| author_handle | TEXT | Author handle | seed.sql |
| author_avatar | TEXT | Author avatar | seed.sql |
| title | TEXT | Title | community.js, publish.js |
| **content** | TEXT | Content | **community.js, publish.js** ✅ |
| **summary** | TEXT | Summary | **community.js, publish.js** ✅ |
| **content_json** | JSONB | Structured content | **publish.js** ✅ |
| preview_image | TEXT | Preview image | seed.sql |
| **image_url** | TEXT | Image URL | **community.js** ✅ |
| **asset_urls** | TEXT[] | Asset URL list | **community.js, publish.js** ✅ |
| **community_tag_id** | UUID FK | Community category | **community.js, publish.js** ✅ |
| likes | INTEGER | Likes (legacy field) | like.js |
| likes_count | INTEGER | Likes (new field) | seed.sql |
| comments | INTEGER | Comments (legacy field) | seed.sql |
| comments_count | INTEGER | Comments (new field) | seed.sql |
| tags | TEXT[] | Tags | community.js, publish.js |
| **is_demo** | BOOLEAN | Demo flag | **publish.js** ✅ |
| **expires_at** | TIMESTAMPTZ | Expiration time | **community.js, publish.js** ✅ |
| timestamp | TIMESTAMPTZ | Published time | community.js |
| created_at | TIMESTAMPTZ | Created time | System |
| updated_at | TIMESTAMPTZ | Updated time | Trigger |

**Result**: ✅ All fields present (supports both likes and likes_count)

**Use cases**:
- GET /api/community?discover=true - fetch all posts
- POST /api/community/publish - publish new post
- POST /api/community/like - like post
- SELECT *, community_tags(name) - JOIN to fetch community name

---

### 8. **user_likes** table ✅
| Column | Type | Purpose | Used in |
|--------|------|---------|---------|
| id | UUID | Primary key | System |
| profile_id | UUID FK | Legacy schema user ID | Legacy code |
| **actor_type** | TEXT | user/guest | **community/like.js** ✅ |
| **actor_id** | TEXT | Actor ID | **community/like.js** ✅ |
| target_type | TEXT | post/comment | like.js |
| target_id | TEXT | Target ID | like.js |
| created_at | TIMESTAMPTZ | Created time | System |

**UNIQUE constraint**: (actor_type, actor_id, target_type, target_id)

**Result**: ✅ Supports both profile_id and actor-based modes

**Use cases**:
- POST /api/community/like - like
- DELETE /api/community/like - unlike
- Check whether a user has liked a post

---

### 9. **user_bookmarks** table ✅
| Column | Type | Purpose | Used in |
|--------|------|---------|---------|
| id | UUID | Primary key | System |
| profile_id | UUID FK | Legacy schema user ID | supabase.js |
| actor_type | TEXT | user/guest | New code extension |
| actor_id | TEXT | Actor ID | New code extension |
| target_type | TEXT | Target type | New code extension |
| target_id | TEXT | Target ID | New code extension |
| post_id | UUID FK | Legacy schema post ID | supabase.js |
| created_at | TIMESTAMPTZ | Created time | System |

**Result**: ✅ Compatible with both legacy and new modes

---

### 10. **user_followed_communities** table ✅
| Column | Type | Purpose | Used in |
|--------|------|---------|---------|
| id | UUID | Primary key | System |
| profile_id | UUID FK | Legacy schema user ID | supabase.js |
| actor_type | TEXT | user/guest | New code extension |
| actor_id | TEXT | Actor ID | New code extension |
| community_tag_id | UUID FK | Followed community | supabase.js |
| followed_at | TIMESTAMPTZ | Follow time | supabase.js |
| created_at | TIMESTAMPTZ | Created time | System |

**Result**: ✅ Compatible with both legacy and new modes

---

## 🔍 API Endpoint Validation

### Chat API (api/chat.js)
| Endpoint | Method | Tables used | Field validation |
|----------|--------|-------------|------------------|
| POST /api/chat?action=message | POST | chat_history | ✅ owner_type, owner_id, content_json, is_demo, expires_at |
| POST /api/chat?action=artifact | POST | chat_history | ✅ owner_type, owner_id, tags, preview_images, content_json |

### History API (api/history.js)
| Endpoint | Method | Tables used | Field validation |
|----------|--------|-------------|------------------|
| GET /api/history | GET | chat_history | ✅ owner_type, owner_id, tags, preview_images |
| POST /api/history | POST | chat_history | ✅ owner_type, owner_id, content_json, is_demo, expires_at |

### History Detail API (api/history/[id].js)
| Endpoint | Method | Tables used | Field validation |
|----------|--------|-------------|------------------|
| GET /api/history/:id | GET | chat_history | ✅ owner_type, owner_id |
| PATCH /api/history/:id | PATCH | chat_history | ✅ title, is_public, tags |
| DELETE /api/history/:id | DELETE | chat_history | ✅ owner_type, owner_id (permission check) |

### Community API (api/community.js)
| Endpoint | Method | Tables used | Field validation |
|----------|--------|-------------|------------------|
| GET /api/community?discover=true | GET | community_posts, community_tags | ✅ author_type, author_name, image_url, content, expires_at |

### Community Publish API (api/community/publish.js)
| Endpoint | Method | Tables used | Field validation |
|----------|--------|-------------|------------------|
| POST /api/community/publish | POST | community_posts, community_tags | ✅ author_type, author_id, author_name, content, summary, content_json, image_url, asset_urls, community_tag_id, is_demo, expires_at |

### Community Like API (api/community/like.js)
| Endpoint | Method | Tables used | Field validation |
|----------|--------|-------------|------------------|
| POST /api/community/like | POST | user_likes, community_posts | ✅ actor_type, actor_id, target_type, target_id, likes |
| DELETE /api/community/like | DELETE | user_likes, community_posts | ✅ actor_type, actor_id |

---

## 🎯 History Chat Feature Support Validation

### Requirement: add history chat feature later

**Existing database support:**

1. ✅ **chat_sessions** table
   - session_id: unique identifier for each session
   - owner_type/owner_id: identifies the owner
   - title, message_count, last_message_at: session metadata
   - tags: classification tags

2. ✅ **chat_messages** table
   - session_id FK: links to the session
   - message_id, sender, text, timestamp: full message record
   - UNIQUE constraint: (session_id, message_id) prevents duplicates

3. ✅ **chat_history** table
   - session_id FK: links to the session
   - content_json: stores full conversation JSON
   - tags: supports filtering (e.g. 'chat', 'session')
   - can be used for Archive display

**Implementation path:**
```
Query history chat list:
  SELECT * FROM chat_sessions 
  WHERE owner_type = ? AND owner_id = ?
  ORDER BY last_message_at DESC

Load messages for a given chat:
  SELECT * FROM chat_messages
  WHERE session_id = ?
  ORDER BY timestamp ASC

Restore chat session:
  1. Read chat_messages
  2. Rebuild conversation UI
  3. Continue the conversation (append new messages to chat_messages)
```

**Conclusion**: ✅ **Database fully supports history chat feature, no extra schema changes required!**

---

## 📋 Summary

### ✅ Items validated successfully
1. All 10 table schemas are complete
2. All API endpoints match expected fields
3. Frontend and backend data structures are consistent
4. Backward compatibility between old and new schema (profile_id + actor_type/actor_id)
5. History chat feature is fully supported

### ⚠️ Important compatibility notes
- **user_likes/bookmarks/followed_communities**: support both profile_id and actor-based modes
- **community_posts**: support both likes and likes_count fields
- **chat_history**: supports both profile_id and owner_type/owner_id

### 🎯 Schema completeness: 100%

**It is safe to run reset-database.sql + seed.sql**
