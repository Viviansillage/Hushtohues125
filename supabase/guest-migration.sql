-- =====================================================
-- Guest-first Demo: Schema Migration Patch
-- 执行方式：在 Supabase Dashboard > SQL Editor 粘贴执行
-- 原则：只 ADD COLUMN，不破坏现有字段
-- =====================================================

-- 1. 扩展 profiles 表（支持 seed profiles）
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS is_seed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS display_name TEXT;

-- 更新已有 profiles 的 display_name（从 user_name 复制）
UPDATE profiles SET display_name = user_name WHERE display_name IS NULL;

-- 2. 扩展 chat_history 表（用作 Archive，支持 guest）
ALTER TABLE chat_history 
  ADD COLUMN IF NOT EXISTS owner_type TEXT DEFAULT 'user' CHECK (owner_type IN ('guest', 'user')),
  ADD COLUMN IF NOT EXISTS owner_id TEXT,
  ADD COLUMN IF NOT EXISTS content_json JSONB,
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- 为已有记录填充 owner_type = 'user' 和 owner_id
UPDATE chat_history 
SET owner_type = 'user', owner_id = profile_id::text 
WHERE owner_type IS NULL AND profile_id IS NOT NULL;

-- 3. 扩展 community_posts 表（支持 guest 和 seed）
ALTER TABLE community_posts 
  ADD COLUMN IF NOT EXISTS author_type TEXT DEFAULT 'user' CHECK (author_type IN ('seed', 'guest', 'user')),
  ADD COLUMN IF NOT EXISTS author_id TEXT,
  ADD COLUMN IF NOT EXISTS community_tag_id UUID REFERENCES community_tags(id),
  ADD COLUMN IF NOT EXISTS content_json JSONB,
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS asset_urls TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- 为已有帖子设置默认值（从 author_name 推断为 user）
UPDATE community_posts 
SET author_type = 'user', author_id = 'legacy', summary = content 
WHERE author_type IS NULL;

-- 4. 扩展 user_likes 表（支持 guest）
ALTER TABLE user_likes 
  ADD COLUMN IF NOT EXISTS actor_type TEXT DEFAULT 'user' CHECK (actor_type IN ('guest', 'user')),
  ADD COLUMN IF NOT EXISTS actor_id TEXT;

-- 为已有点赞记录填充 actor_type = 'user'
UPDATE user_likes 
SET actor_type = 'user', actor_id = profile_id::text 
WHERE actor_type IS NULL AND profile_id IS NOT NULL;

-- 5. 创建索引优化查询
CREATE INDEX IF NOT EXISTS idx_chat_history_owner ON chat_history(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_is_demo ON chat_history(is_demo) WHERE is_demo = true;
CREATE INDEX IF NOT EXISTS idx_community_posts_author ON community_posts(author_type, author_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_community ON community_posts(community_tag_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_timestamp_demo ON community_posts(timestamp DESC) WHERE is_demo = false;
CREATE INDEX IF NOT EXISTS idx_user_likes_actor ON user_likes(actor_type, actor_id);
CREATE INDEX IF NOT EXISTS idx_user_likes_target ON user_likes(target_type, target_id);

-- 6. 修改 user_likes 的 UNIQUE 约束（支持 guest）
-- 先删除旧约束，再创建新约束
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_likes_profile_id_target_type_target_id_key'
  ) THEN
    ALTER TABLE user_likes DROP CONSTRAINT user_likes_profile_id_target_type_target_id_key;
  END IF;
END $$;

-- 创建新的复合唯一索引（基于 actor）
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_likes_unique_actor 
  ON user_likes(actor_type, actor_id, target_type, target_id);

-- 7. 创建清理过期 demo 数据的函数（定期任务可调用）
CREATE OR REPLACE FUNCTION cleanup_expired_demos()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER := 0;
  rows_affected INTEGER;
BEGIN
  -- 删除过期的 chat_history
  DELETE FROM chat_history 
  WHERE is_demo = true 
    AND expires_at IS NOT NULL 
    AND expires_at < NOW();
  
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  deleted_count := deleted_count + rows_affected;
  
  -- 删除过期的 community_posts
  DELETE FROM community_posts 
  WHERE is_demo = true 
    AND expires_at IS NOT NULL 
    AND expires_at < NOW();
  
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  deleted_count := deleted_count + rows_affected;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 执行完成提示
DO $$
BEGIN
  RAISE NOTICE 'Guest-first migration completed successfully!';
END $$;
