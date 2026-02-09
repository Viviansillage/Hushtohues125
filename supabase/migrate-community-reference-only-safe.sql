-- ========================================
-- Community Reference-Only Migration (SAFE VERSION)
-- Convert Community from snapshot/copy mode to reference-only mode
-- ========================================
-- ⚠️ Warning: this script will rebuild the community_posts table
-- ⚠️ Before running:
--    1. Ensure Supabase has a recent backup
--    2. Validate in a test environment
--    3. Record the current row count of the table
-- ========================================

-- [Step 1] Inspect current table structure and data
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

-- [Step 2] Backup existing data (all columns)
DROP TABLE IF EXISTS community_posts_backup CASCADE;
CREATE TABLE community_posts_backup AS SELECT * FROM community_posts;

SELECT 
  'Backup created' as status,
  COUNT(*) as backed_up_rows 
FROM community_posts_backup;

-- [Step 3] Inspect dependencies (foreign key constraints)
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
  
  -- Check foreign keys that reference community_posts
  SELECT COUNT(*) INTO fk_count
  FROM information_schema.constraint_column_usage
  WHERE table_name = 'community_posts';
  
  IF fk_count > 0 THEN
    RAISE WARNING 'Found % foreign keys referencing community_posts - these will be CASCADE deleted!', fk_count;
    RAISE NOTICE 'Affected tables: user_bookmarks (post_id column)';
  END IF;
END $$;

-- [Step 4] Drop foreign key constraints on dependent tables (avoid CASCADE deleting data)
-- user_bookmarks may reference community_posts.id
ALTER TABLE IF EXISTS user_bookmarks 
  DROP CONSTRAINT IF EXISTS user_bookmarks_post_id_fkey CASCADE;

-- [Step 5] Drop old table
DROP TABLE IF EXISTS community_posts CASCADE;

-- [Step 6] Create new reference-only table structure
CREATE TABLE community_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- ========== Core reference field (source of truth from archive) ==========
  session_id TEXT NOT NULL,  -- Points to chat_sessions.session_id (NOT NULL, must have a session)
  
  -- ========== Author information ==========
  author_type TEXT NOT NULL CHECK (author_type IN ('user', 'guest', 'seed')),
  author_id TEXT NOT NULL,  -- user.id or guest_id
  author_name TEXT NOT NULL,  -- Redundant, avoids extra JOIN to profiles
  
  -- ========== Publish status ==========
  is_public BOOLEAN NOT NULL DEFAULT true,  -- Whether the post is public
  
  -- ========== Performance fields (redundant, not source of truth) ==========
  -- These fields are for list performance only; real data comes from archive
  cover_image_url TEXT,  -- Cover image in list (from preview_images[0] or first artifact image)
  title TEXT,            -- Title (from chat_history.title)
  tags TEXT[] DEFAULT '{}',  -- Tags (from chat_history.tags)
  
  -- ========== Community category ==========
  community_tag_id UUID,  -- References community_tags (optional, allows NULL)
  -- No FK here to avoid cascading deletes on posts when a tag is removed
  
  -- ========== Demo/temporary flags ==========
  is_demo BOOLEAN DEFAULT false,  -- Whether this is demo data
  expires_at TIMESTAMPTZ,  -- Expiration time (e.g. guest data expires after 7 days)
  
  -- ========== Stats (maintained here, not in archive) ==========
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  
  -- ========== Timestamps ==========
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- Published time
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- ========== Constraint: each session can only be published once ==========
  CONSTRAINT uq_community_posts_session UNIQUE(session_id)
);

-- [Step 7] Add foreign key constraint (reference chat_sessions)
-- Use ON DELETE CASCADE: if a session is deleted, the corresponding community post is deleted as well
ALTER TABLE community_posts
  ADD CONSTRAINT fk_community_posts_session
  FOREIGN KEY (session_id)
  REFERENCES chat_sessions(session_id)
  ON DELETE CASCADE;

-- [Step 8] Create indexes (performance)
CREATE INDEX idx_community_posts_session_id ON community_posts(session_id);
CREATE INDEX idx_community_posts_author ON community_posts(author_type, author_id);
CREATE INDEX idx_community_posts_public_timestamp ON community_posts(is_public, timestamp DESC) 
  WHERE is_public = true;  -- Partial index, only for public posts
CREATE INDEX idx_community_posts_community_tag ON community_posts(community_tag_id)
  WHERE community_tag_id IS NOT NULL;

-- [Step 9] Enable Row Level Security
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;

-- [Step 10] Create RLS policies
-- Public posts: readable by everyone
CREATE POLICY "community_posts_public_read" 
  ON community_posts 
  FOR SELECT 
  USING (is_public = true);

-- Authors can insert their own posts
CREATE POLICY "community_posts_author_insert" 
  ON community_posts 
  FOR INSERT 
  WITH CHECK (true);  -- Hackathon simplification: allow anyone to insert
  
-- Authors can update/delete their own posts
CREATE POLICY "community_posts_author_update" 
  ON community_posts 
  FOR UPDATE 
  USING (true);  -- Hackathon simplification: allow anyone to update

CREATE POLICY "community_posts_author_delete" 
  ON community_posts 
  FOR DELETE 
  USING (true);  -- Hackathon simplification: allow anyone to delete

-- [Step 11] Data migration (if old table has session_id)
-- ⚠️ Note: migrate only records that have session_id
DO $$
DECLARE
  has_session_id BOOLEAN;
  migrated_count INTEGER := 0;
BEGIN
  -- Check whether backup table has a session_id column
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
      COALESCE(author_type, 'guest'),  -- default to guest
      COALESCE(author_id, 'unknown'),
      COALESCE(author_name, 'Anonymous'),
      true,  -- old data is treated as public
      COALESCE(image_url, preview_image),  -- support different column names
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
    WHERE session_id IS NOT NULL  -- only migrate rows with session_id
      AND session_id <> '';       -- exclude empty strings
    
    GET DIAGNOSTICS migrated_count = ROW_COUNT;
    RAISE NOTICE 'Migrated % rows from backup', migrated_count;
  ELSE
    RAISE WARNING 'No session_id column in backup - skipping migration';
    RAISE NOTICE 'Old data in community_posts_backup will NOT be migrated';
    RAISE NOTICE 'You need to manually re-publish from Archive';
  END IF;
END $$;

-- [Step 12] Verify migration result
SELECT 
  'Migration Summary' as title,
  (SELECT COUNT(*) FROM community_posts_backup) as backup_rows,
  (SELECT COUNT(*) FROM community_posts) as new_rows,
  (SELECT COUNT(*) FROM community_posts WHERE is_public = true) as public_rows,
  (SELECT COUNT(DISTINCT session_id) FROM community_posts) as unique_sessions,
  (SELECT COUNT(*) FROM community_posts WHERE session_id IS NULL) as null_sessions;

-- [Step 13] Check for orphaned records (session_id not in chat_sessions)
SELECT 
  'Orphaned Posts (session not found)' as warning,
  COUNT(*) as orphaned_count
FROM community_posts cp
WHERE NOT EXISTS (
  SELECT 1 FROM chat_sessions cs WHERE cs.session_id = cp.session_id
);

-- [Done]
SELECT '✅ Migration completed! Check the summary above.' as status;
