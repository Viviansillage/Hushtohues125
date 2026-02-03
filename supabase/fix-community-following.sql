-- =====================================================
-- Fix: Community Following List Bug
-- 问题：user_followed_communities 表缺少 guest 支持
-- 解决：添加 actor_type/actor_id 字段，更新查询逻辑
-- =====================================================

-- 1. 扩展 user_followed_communities 表以支持 Guest
ALTER TABLE user_followed_communities 
  ADD COLUMN IF NOT EXISTS actor_type TEXT DEFAULT 'user' CHECK (actor_type IN ('guest', 'user')),
  ADD COLUMN IF NOT EXISTS actor_id TEXT;

-- 为已有记录填充 actor_type = 'user' 和 actor_id（从 profile_id 转换）
UPDATE user_followed_communities 
SET actor_type = 'user', actor_id = profile_id::text 
WHERE actor_type IS NULL AND profile_id IS NOT NULL;

-- 2. 创建索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_user_followed_communities_actor 
  ON user_followed_communities(actor_type, actor_id);

-- 3. 创建新的复合唯一索引（防止重复 follow）
-- 先删除旧的 UNIQUE 约束（如果存在）
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_followed_communities_profile_id_community_tag_id_key'
  ) THEN
    ALTER TABLE user_followed_communities 
      DROP CONSTRAINT user_followed_communities_profile_id_community_tag_id_key;
  END IF;
END $$;

-- 创建新的唯一约束（基于 actor）
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_followed_communities_unique_actor 
  ON user_followed_communities(actor_type, actor_id, community_tag_id);

-- 4. 验证表结构
DO $$
BEGIN
  RAISE NOTICE 'Community following schema migration completed!';
  RAISE NOTICE 'user_followed_communities now supports guest users';
END $$;
