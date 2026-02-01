-- ========================================
-- Hush to Hues - 完整数据库重建脚本
-- ========================================
-- 用法：在Supabase SQL Editor中直接运行此文件
-- 注意：此操作会删除所有现有数据！
-- ========================================

-- 第一步：删除所有旧表（如果存在）
DROP TABLE IF EXISTS user_likes CASCADE;
DROP TABLE IF EXISTS user_bookmarks CASCADE;
DROP TABLE IF EXISTS user_followed_communities CASCADE;
DROP TABLE IF EXISTS artifacts CASCADE;
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS chat_sessions CASCADE;
DROP TABLE IF EXISTS chat_history CASCADE;
DROP TABLE IF EXISTS community_posts CASCADE;
DROP TABLE IF EXISTS community_tags CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- 第二步：创建新表

-- 1. 用户配置表
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_name TEXT NOT NULL,
  user_handle TEXT NOT NULL UNIQUE,
  avatar TEXT,
  email_notifications BOOLEAN DEFAULT true,
  save_history BOOLEAN DEFAULT true,
  public_profile BOOLEAN DEFAULT false,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 聊天会话表
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL UNIQUE,
  owner_type TEXT NOT NULL DEFAULT 'guest' CHECK (owner_type IN ('user', 'guest')),
  owner_id TEXT,
  title TEXT,
  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  is_public BOOLEAN DEFAULT false,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 聊天消息表
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL REFERENCES chat_sessions(session_id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,
  sender TEXT NOT NULL CHECK (sender IN ('user', 'bot')),
  text TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, message_id)
);

-- 4. Artifacts表（存储生成的图片、mindmap等）
CREATE TABLE artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL REFERENCES chat_sessions(session_id) ON DELETE CASCADE,
  artifact_type TEXT NOT NULL CHECK (artifact_type IN ('image', 'mindmap', 'save')),
  prompt TEXT,
  storage_path TEXT,
  public_url TEXT NOT NULL,
  provider TEXT,
  model TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 历史记录表（兼容旧代码和新代码）
CREATE TABLE chat_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  session_id TEXT REFERENCES chat_sessions(session_id) ON DELETE CASCADE,
  owner_type TEXT NOT NULL CHECK (owner_type IN ('user', 'guest')),
  owner_id TEXT NOT NULL,
  title TEXT NOT NULL,
  message_count INTEGER DEFAULT 0,
  last_message TEXT,
  preview_images TEXT[] DEFAULT '{}',
  is_public BOOLEAN DEFAULT false,
  tags TEXT[] DEFAULT '{}',
  content_json JSONB DEFAULT '{}',
  is_demo BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- ✅ 确保同一session只有一个archive记录
  UNIQUE(owner_type, owner_id, session_id)
);

-- 6. 社区标签/分类表（必须在community_posts之前创建，因为有外键）
CREATE TABLE community_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  icon TEXT,
  color TEXT,
  member_count INTEGER DEFAULT 0,
  total_posts INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. 社区帖子表（完整字段）
CREATE TABLE community_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id TEXT UNIQUE,
  session_id TEXT REFERENCES chat_sessions(session_id) ON DELETE SET NULL,
  author_type TEXT NOT NULL DEFAULT 'guest' CHECK (author_type IN ('user', 'guest', 'seed')),
  author_id TEXT,
  author_name TEXT NOT NULL,
  author_handle TEXT,
  author_avatar TEXT,
  title TEXT NOT NULL,
  content TEXT,
  summary TEXT,
  content_json JSONB DEFAULT '{}',
  preview_image TEXT,
  image_url TEXT,
  asset_urls TEXT[] DEFAULT '{}',
  community_tag_id UUID REFERENCES community_tags(id) ON DELETE SET NULL,
  likes INTEGER DEFAULT 0,
  likes_count INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  is_demo BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. 用户点赞表（同时支持profile_id和actor模式）
CREATE TABLE user_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  actor_type TEXT CHECK (actor_type IN ('user', 'guest')),
  actor_id TEXT,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(actor_type, actor_id, target_type, target_id)
);

-- 9. 用户收藏表
CREATE TABLE user_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  actor_type TEXT CHECK (actor_type IN ('user', 'guest')),
  actor_id TEXT,
  target_type TEXT,
  target_id TEXT,
  post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(actor_type, actor_id, target_type, target_id)
);

-- 10. 用户关注的社区
CREATE TABLE user_followed_communities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  actor_type TEXT CHECK (actor_type IN ('user', 'guest')),
  actor_id TEXT,
  community_tag_id UUID REFERENCES community_tags(id) ON DELETE CASCADE,
  followed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(actor_type, actor_id, community_tag_id)
);

-- 第三步：创建索引（提升查询性能）

-- profiles 索引
CREATE INDEX idx_profiles_handle ON profiles(user_handle);

-- chat_sessions 索引
CREATE INDEX idx_chat_sessions_session_id ON chat_sessions(session_id);
CREATE INDEX idx_chat_sessions_owner ON chat_sessions(owner_type, owner_id);
CREATE INDEX idx_chat_sessions_created_at ON chat_sessions(created_at DESC);

-- chat_messages 索引
CREATE INDEX idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX idx_chat_messages_timestamp ON chat_messages(timestamp DESC);

-- artifacts 索引
CREATE INDEX idx_artifacts_session_id ON artifacts(session_id);
CREATE INDEX idx_artifacts_type ON artifacts(artifact_type);
CREATE INDEX idx_artifacts_created_at ON artifacts(created_at DESC);

-- chat_history 索引
CREATE INDEX idx_chat_history_profile ON chat_history(profile_id);
CREATE INDEX idx_chat_history_session_id ON chat_history(session_id);
CREATE INDEX idx_chat_history_owner ON chat_history(owner_type, owner_id);
CREATE INDEX idx_chat_history_timestamp ON chat_history(timestamp DESC);
CREATE INDEX idx_chat_history_is_public ON chat_history(is_public);
CREATE INDEX idx_chat_history_tags ON chat_history USING GIN(tags);
CREATE INDEX idx_chat_history_expires_at ON chat_history(expires_at);

-- community_posts 索引
CREATE INDEX idx_community_posts_author_type ON community_posts(author_type);
CREATE INDEX idx_community_posts_community_tag ON community_posts(community_tag_id);
CREATE INDEX idx_community_posts_timestamp ON community_posts(timestamp DESC);
CREATE INDEX idx_community_posts_tags ON community_posts USING GIN(tags);
CREATE INDEX idx_community_posts_expires_at ON community_posts(expires_at);

-- community_tags 索引
CREATE INDEX idx_community_tags_name ON community_tags(name);

-- user_likes 索引
CREATE INDEX idx_user_likes_profile ON user_likes(profile_id);
CREATE INDEX idx_user_likes_actor ON user_likes(actor_type, actor_id);
CREATE INDEX idx_user_likes_target ON user_likes(target_type, target_id);

-- user_bookmarks 索引
CREATE INDEX idx_user_bookmarks_profile ON user_bookmarks(profile_id);
CREATE INDEX idx_user_bookmarks_actor ON user_bookmarks(actor_type, actor_id);

-- user_followed_communities 索引
CREATE INDEX idx_user_followed_profile ON user_followed_communities(profile_id);
CREATE INDEX idx_user_followed_actor ON user_followed_communities(actor_type, actor_id);

-- 第四步：启用行级安全（RLS）

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_followed_communities ENABLE ROW LEVEL SECURITY;

-- 第五步：创建RLS策略（Hackathon demo：允许所有访问）

-- profiles
CREATE POLICY "Allow all access to profiles" ON profiles FOR ALL USING (true) WITH CHECK (true);

-- chat_sessions
CREATE POLICY "Allow all access to chat_sessions" ON chat_sessions FOR ALL USING (true) WITH CHECK (true);

-- chat_messages
CREATE POLICY "Allow all access to chat_messages" ON chat_messages FOR ALL USING (true) WITH CHECK (true);

-- artifacts
CREATE POLICY "Allow all access to artifacts" ON artifacts FOR ALL USING (true) WITH CHECK (true);

-- chat_history
CREATE POLICY "Allow all access to chat_history" ON chat_history FOR ALL USING (true) WITH CHECK (true);

-- community_posts
CREATE POLICY "Allow all access to community_posts" ON community_posts FOR ALL USING (true) WITH CHECK (true);

-- community_tags
CREATE POLICY "Allow all access to community_tags" ON community_tags FOR ALL USING (true) WITH CHECK (true);

-- user_likes
CREATE POLICY "Allow all access to user_likes" ON user_likes FOR ALL USING (true) WITH CHECK (true);

-- user_bookmarks
CREATE POLICY "Allow all access to user_bookmarks" ON user_bookmarks FOR ALL USING (true) WITH CHECK (true);

-- user_followed_communities
CREATE POLICY "Allow all access to user_followed_communities" ON user_followed_communities FOR ALL USING (true) WITH CHECK (true);

-- 第六步：创建更新触发器

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_chat_sessions_updated_at BEFORE UPDATE ON chat_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_chat_history_updated_at BEFORE UPDATE ON chat_history FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_community_posts_updated_at BEFORE UPDATE ON community_posts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 完成！
