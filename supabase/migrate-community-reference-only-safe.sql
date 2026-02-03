-- ========================================
-- Community Reference-Only Migration (SAFE VERSION)
-- 将 Community 从 snapshot/copy 模式改为 reference-only 模式
-- ========================================
-- ⚠️ 警告：此脚本会重建 community_posts 表
-- ⚠️ 请在执行前：
--    1. 确认 Supabase 已备份
--    2. 在测试环境验证
--    3. 记录当前表中的数据量
-- ========================================

-- 【步骤 1】检查当前表结构和数据
DO $$
BEGIN
  RAISE NOTICE '=== Current community_posts table info ===';
  RAISE NOTICE 'Total rows: %', (SELECT COUNT(*) FROM community_posts);
  RAISE NOTICE 'Columns: %', (
    SELECT string_agg(column_name, ', ')
    FROM information_schema.columns
    WHERE table_name = 'community_posts'
  );
END $$;

-- 【步骤 2】备份现有数据（包含所有字段）
DROP TABLE IF EXISTS community_posts_backup CASCADE;
CREATE TABLE community_posts_backup AS SELECT * FROM community_posts;

SELECT 
  'Backup created' as status,
  COUNT(*) as backed_up_rows 
FROM community_posts_backup;

-- 【步骤 3】检查依赖关系（外键约束）
DO $$
DECLARE
  fk_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO fk_count
  FROM information_schema.table_constraints
  WHERE constraint_type = 'FOREIGN KEY'
    AND table_name = 'community_posts';
  
  IF fk_count > 0 THEN
    RAISE NOTICE 'Found % foreign key constraints on community_posts', fk_count;
  END IF;
  
  -- 检查引用 community_posts 的外键
  SELECT COUNT(*) INTO fk_count
  FROM information_schema.constraint_column_usage
  WHERE table_name = 'community_posts';
  
  IF fk_count > 0 THEN
    RAISE WARNING 'Found % foreign keys referencing community_posts - these will be CASCADE deleted!', fk_count;
    RAISE NOTICE 'Affected tables: user_bookmarks (post_id column)';
  END IF;
END $$;

-- 【步骤 4】删除依赖表的外键约束（避免 CASCADE 删除数据）
-- user_bookmarks 表可能引用 community_posts.id
ALTER TABLE IF EXISTS user_bookmarks 
  DROP CONSTRAINT IF EXISTS user_bookmarks_post_id_fkey CASCADE;

-- 【步骤 5】删除旧表
DROP TABLE IF EXISTS community_posts CASCADE;

-- 【步骤 6】创建新的 reference-only 表结构
CREATE TABLE community_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- ========== 核心引用字段（source of truth from archive）==========
  session_id TEXT NOT NULL,  -- 指向 chat_sessions.session_id（NOT NULL，必须有 session）
  
  -- ========== 作者信息 ==========
  author_type TEXT NOT NULL CHECK (author_type IN ('user', 'guest', 'seed')),
  author_id TEXT NOT NULL,  -- user.id 或 guest_id
  author_name TEXT NOT NULL,  -- 冗余字段，避免每次 JOIN profiles
  
  -- ========== 发布状态 ==========
  is_public BOOLEAN NOT NULL DEFAULT true,  -- 是否公开展示
  
  -- ========== 性能优化字段（冗余，非 source of truth）==========
  -- 这些字段仅用于列表展示性能优化，真实数据从 archive 查询
  cover_image_url TEXT,  -- 列表封面图（来自 preview_images[0] 或 artifacts 第一张图）
  title TEXT,            -- 标题（来自 chat_history.title）
  tags TEXT[] DEFAULT '{}',  -- 标签（来自 chat_history.tags）
  
  -- ========== 社区分类 ==========
  community_tag_id UUID,  -- 关联 community_tags（可选，允许 NULL）
  -- 不添加外键约束，避免删除 tag 时级联删除 posts
  
  -- ========== Demo/临时数据标记 ==========
  is_demo BOOLEAN DEFAULT false,  -- 是否为演示数据
  expires_at TIMESTAMPTZ,  -- 过期时间（guest 数据 7 天后过期）
  
  -- ========== 统计字段（维护在本表，不影响 archive）==========
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  
  -- ========== 时间戳 ==========
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- 发布时间
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- ========== 约束：同一 session 只能发布一次 ==========
  CONSTRAINT uq_community_posts_session UNIQUE(session_id)
);

-- 【步骤 7】添加外键约束（引用 chat_sessions）
-- 使用 ON DELETE CASCADE：如果 session 被删除，community post 也删除
ALTER TABLE community_posts
  ADD CONSTRAINT fk_community_posts_session
  FOREIGN KEY (session_id)
  REFERENCES chat_sessions(session_id)
  ON DELETE CASCADE;

-- 【步骤 8】创建索引（提升查询性能）
CREATE INDEX idx_community_posts_session_id ON community_posts(session_id);
CREATE INDEX idx_community_posts_author ON community_posts(author_type, author_id);
CREATE INDEX idx_community_posts_public_timestamp ON community_posts(is_public, timestamp DESC) 
  WHERE is_public = true;  -- 部分索引，只索引公开帖子
CREATE INDEX idx_community_posts_community_tag ON community_posts(community_tag_id)
  WHERE community_tag_id IS NOT NULL;

-- 【步骤 9】启用 Row Level Security
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;

-- 【步骤 10】创建 RLS 策略
-- 公开帖子：所有人可读
CREATE POLICY "community_posts_public_read" 
  ON community_posts 
  FOR SELECT 
  USING (is_public = true);

-- 作者可以插入自己的帖子
CREATE POLICY "community_posts_author_insert" 
  ON community_posts 
  FOR INSERT 
  WITH CHECK (true);  -- Hackathon 简化：允许任何人插入

-- 作者可以更新/删除自己的帖子
CREATE POLICY "community_posts_author_update" 
  ON community_posts 
  FOR UPDATE 
  USING (true);  -- Hackathon 简化：允许任何人更新

CREATE POLICY "community_posts_author_delete" 
  ON community_posts 
  FOR DELETE 
  USING (true);  -- Hackathon 简化：允许任何人删除

-- 【步骤 11】数据迁移（如果旧表有 session_id）
-- ⚠️ 注意：只迁移有 session_id 的记录
DO $$
DECLARE
  has_session_id BOOLEAN;
  migrated_count INTEGER := 0;
BEGIN
  -- 检查备份表是否有 session_id 字段
  SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'community_posts_backup' 
      AND column_name = 'session_id'
  ) INTO has_session_id;
  
  IF has_session_id THEN
    RAISE NOTICE 'Found session_id in backup, starting migration...';
    
    INSERT INTO community_posts (
      session_id, 
      author_type, 
      author_id, 
      author_name, 
      is_public,
      cover_image_url,
      title, 
      tags, 
      community_tag_id,
      is_demo,
      expires_at,
      likes,
      comments,
      timestamp,
      created_at,
      updated_at
    )
    SELECT 
      session_id,
      COALESCE(author_type, 'guest'),  -- 默认为 guest
      COALESCE(author_id, 'unknown'),
      COALESCE(author_name, 'Anonymous'),
      true,  -- 旧数据默认为公开
      COALESCE(image_url, preview_image),  -- 兼容不同字段名
      COALESCE(title, 'Untitled'),
      COALESCE(tags, ARRAY[]::TEXT[]),
      community_tag_id,
      COALESCE(is_demo, false),
      expires_at,
      COALESCE(likes, 0),
      COALESCE(comments, 0),
      COALESCE(timestamp, created_at, NOW()),
      COALESCE(created_at, NOW()),
      COALESCE(updated_at, NOW())
    FROM community_posts_backup
    WHERE session_id IS NOT NULL  -- 只迁移有 session_id 的数据
      AND session_id <> '';  -- 排除空字符串
    
    GET DIAGNOSTICS migrated_count = ROW_COUNT;
    RAISE NOTICE 'Migrated % rows from backup', migrated_count;
  ELSE
    RAISE WARNING 'No session_id column in backup - skipping migration';
    RAISE NOTICE 'Old data in community_posts_backup will NOT be migrated';
    RAISE NOTICE 'You need to manually re-publish from Archive';
  END IF;
END $$;

-- 【步骤 12】验证迁移结果
SELECT 
  'Migration Summary' as title,
  (SELECT COUNT(*) FROM community_posts_backup) as backup_rows,
  (SELECT COUNT(*) FROM community_posts) as new_rows,
  (SELECT COUNT(*) FROM community_posts WHERE is_public = true) as public_rows,
  (SELECT COUNT(DISTINCT session_id) FROM community_posts) as unique_sessions,
  (SELECT COUNT(*) FROM community_posts WHERE session_id IS NULL) as null_sessions;

-- 【步骤 13】检查孤立记录（session_id 不存在于 chat_sessions）
SELECT 
  'Orphaned Posts (session not found)' as warning,
  COUNT(*) as orphaned_count
FROM community_posts cp
WHERE NOT EXISTS (
  SELECT 1 FROM chat_sessions cs WHERE cs.session_id = cp.session_id
);

-- 【完成】
SELECT '✅ Migration completed! Check the summary above.' as status;
