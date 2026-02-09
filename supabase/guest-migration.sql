-- =====================================================
-- Guest-first Demo: Schema Migration Patch
-- How to run: paste and execute in Supabase Dashboard > SQL Editor
-- Principle: only ADD COLUMN; do not break existing fields
-- =====================================================

-- 1. Extend profiles table (support seed profiles)
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS is_seed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS display_name TEXT;

-- For existing profiles, fill display_name from user_name
UPDATE profiles SET display_name = user_name WHERE display_name IS NULL;

-- 2. Extend chat_history table (used as Archive, support guest)
ALTER TABLE chat_history 
  ADD COLUMN IF NOT EXISTS owner_type TEXT DEFAULT 'user' CHECK (owner_type IN ('guest', 'user')),
  ADD COLUMN IF NOT EXISTS owner_id TEXT,
  ADD COLUMN IF NOT EXISTS content_json JSONB,
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- For existing records, fill owner_type = 'user' and owner_id from profile_id
UPDATE chat_history 
SET owner_type = 'user', owner_id = profile_id::text 
WHERE owner_type IS NULL AND profile_id IS NOT NULL;

-- 3. Extend community_posts table (support guest and seed)
ALTER TABLE community_posts 
  ADD COLUMN IF NOT EXISTS author_type TEXT DEFAULT 'user' CHECK (author_type IN ('seed', 'guest', 'user')),
  ADD COLUMN IF NOT EXISTS author_id TEXT,
  ADD COLUMN IF NOT EXISTS community_tag_id UUID REFERENCES community_tags(id),
  ADD COLUMN IF NOT EXISTS content_json JSONB,
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS asset_urls TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- For existing posts, set default values (infer user from author_name)
UPDATE community_posts 
SET author_type = 'user', author_id = 'legacy', summary = content 
WHERE author_type IS NULL;

-- 4. Extend user_likes table (support guest)
ALTER TABLE user_likes 
  ADD COLUMN IF NOT EXISTS actor_type TEXT DEFAULT 'user' CHECK (actor_type IN ('guest', 'user')),
  ADD COLUMN IF NOT EXISTS actor_id TEXT;

-- For existing like records, fill actor_type = 'user'
UPDATE user_likes 
SET actor_type = 'user', actor_id = profile_id::text 
WHERE actor_type IS NULL AND profile_id IS NOT NULL;

-- 5. Create indexes to optimize queries
CREATE INDEX IF NOT EXISTS idx_chat_history_owner ON chat_history(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_is_demo ON chat_history(is_demo) WHERE is_demo = true;
CREATE INDEX IF NOT EXISTS idx_community_posts_author ON community_posts(author_type, author_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_community ON community_posts(community_tag_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_timestamp_demo ON community_posts(timestamp DESC) WHERE is_demo = false;
CREATE INDEX IF NOT EXISTS idx_user_likes_actor ON user_likes(actor_type, actor_id);
CREATE INDEX IF NOT EXISTS idx_user_likes_target ON user_likes(target_type, target_id);

-- 6. Adjust UNIQUE constraint on user_likes (support guest)
-- First drop old constraint, then create new one
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_likes_profile_id_target_type_target_id_key'
  ) THEN
    ALTER TABLE user_likes DROP CONSTRAINT user_likes_profile_id_target_type_target_id_key;
  END IF;
END $$;

-- Create new composite unique index (based on actor)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_likes_unique_actor 
  ON user_likes(actor_type, actor_id, target_type, target_id);

-- 7. Create a function to clean up expired demo data (for scheduled jobs)
CREATE OR REPLACE FUNCTION cleanup_expired_demos()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER := 0;
  rows_affected INTEGER;
BEGIN
  -- Delete expired chat_history
  DELETE FROM chat_history 
  WHERE is_demo = true 
    AND expires_at IS NOT NULL 
    AND expires_at < NOW();
  
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  deleted_count := deleted_count + rows_affected;
  
  -- Delete expired community_posts
  DELETE FROM community_posts 
  WHERE is_demo = true 
    AND expires_at IS NOT NULL 
    AND expires_at < NOW();
  
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  deleted_count := deleted_count + rows_affected;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Completion notice
DO $$
BEGIN
  RAISE NOTICE 'Guest-first migration completed successfully!';
END $$;
