-- Hush to Hues Database Schema for Supabase

-- 用户配置表
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_name TEXT NOT NULL,
  user_handle TEXT NOT NULL UNIQUE,
  avatar TEXT,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 聊天历史表
CREATE TABLE IF NOT EXISTS chat_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message_count INTEGER DEFAULT 0,
  last_message TEXT,
  preview_images TEXT[] DEFAULT '{}',
  is_public BOOLEAN DEFAULT false,
  tags TEXT[] DEFAULT '{}',
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 社区帖子表
CREATE TABLE IF NOT EXISTS community_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  author_name TEXT NOT NULL,
  image_url TEXT,
  content TEXT,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 社区标签表
CREATE TABLE IF NOT EXISTS community_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  icon TEXT,
  color TEXT,
  member_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 用户关注的社区
CREATE TABLE IF NOT EXISTS user_followed_communities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  community_tag_id UUID REFERENCES community_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(profile_id, community_tag_id)
);

-- 用户点赞记录
CREATE TABLE IF NOT EXISTS user_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL, -- 'post' or 'history'
  target_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(profile_id, target_type, target_id)
);

-- 用户收藏记录
CREATE TABLE IF NOT EXISTS user_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(profile_id, post_id)
);

-- 创建索引以提升查询性能
CREATE INDEX IF NOT EXISTS idx_chat_history_profile ON chat_history(profile_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_timestamp ON chat_history(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_timestamp ON community_posts(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_user_likes_profile ON user_likes(profile_id);
CREATE INDEX IF NOT EXISTS idx_user_bookmarks_profile ON user_bookmarks(profile_id);

-- 启用 Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_followed_communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_bookmarks ENABLE ROW LEVEL SECURITY;

-- RLS 策略：允许所有人读取（因为是 hackathon demo，简化权限）
-- 生产环境需要更细粒度的权限控制

CREATE POLICY "Allow public read profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Allow public insert profiles" ON profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update profiles" ON profiles FOR UPDATE USING (true);

CREATE POLICY "Allow public read chat_history" ON chat_history FOR SELECT USING (true);
CREATE POLICY "Allow public insert chat_history" ON chat_history FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update chat_history" ON chat_history FOR UPDATE USING (true);
CREATE POLICY "Allow public delete chat_history" ON chat_history FOR DELETE USING (true);

CREATE POLICY "Allow public read community_posts" ON community_posts FOR SELECT USING (true);
CREATE POLICY "Allow public insert community_posts" ON community_posts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update community_posts" ON community_posts FOR UPDATE USING (true);

CREATE POLICY "Allow public read community_tags" ON community_tags FOR SELECT USING (true);
CREATE POLICY "Allow public insert community_tags" ON community_tags FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read user_followed_communities" ON user_followed_communities FOR SELECT USING (true);
CREATE POLICY "Allow public insert user_followed_communities" ON user_followed_communities FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete user_followed_communities" ON user_followed_communities FOR DELETE USING (true);

CREATE POLICY "Allow public read user_likes" ON user_likes FOR SELECT USING (true);
CREATE POLICY "Allow public insert user_likes" ON user_likes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete user_likes" ON user_likes FOR DELETE USING (true);

CREATE POLICY "Allow public read user_bookmarks" ON user_bookmarks FOR SELECT USING (true);
CREATE POLICY "Allow public insert user_bookmarks" ON user_bookmarks FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete user_bookmarks" ON user_bookmarks FOR DELETE USING (true);

-- 插入默认数据（从 db.json 迁移）
-- 这些数据可以通过运行单独的迁移脚本插入
