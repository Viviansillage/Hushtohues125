-- =====================================================
-- Fix: Community Following List Bug
-- Problem: user_followed_communities table lacks guest support
-- Solution: add actor_type/actor_id columns, update query logic
-- =====================================================

-- 1. Extend user_followed_communities table to support Guest
ALTER TABLE user_followed_communities 
  ADD COLUMN IF NOT EXISTS actor_type TEXT DEFAULT 'user' CHECK (actor_type IN ('guest', 'user')),
  ADD COLUMN IF NOT EXISTS actor_id TEXT;

-- For existing records, fill actor_type = 'user' and actor_id from profile_id
UPDATE user_followed_communities 
SET actor_type = 'user', actor_id = profile_id::text 
WHERE actor_type IS NULL AND profile_id IS NOT NULL;

-- 2. Create index to optimize query performance
CREATE INDEX IF NOT EXISTS idx_user_followed_communities_actor 
  ON user_followed_communities(actor_type, actor_id);

-- 3. Create new composite unique index (prevent duplicate follow)
-- First drop the old UNIQUE constraint (if it exists)
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

-- Create new unique constraint (based on actor)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_followed_communities_unique_actor 
  ON user_followed_communities(actor_type, actor_id, community_tag_id);

-- 4. Verify table structure
DO $$
BEGIN
  RAISE NOTICE 'Community following schema migration completed!';
  RAISE NOTICE 'user_followed_communities now supports guest users';
END $$;
