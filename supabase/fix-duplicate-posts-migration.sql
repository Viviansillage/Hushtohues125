-- ============================================================
-- SAFE MIGRATION: Deduplicate community_posts + enforce UNIQUE(session_id)
-- ============================================================
-- Priority: 1) Non-anonymous author, 2) Newest created_at, 3) Highest id
-- Safe: Backup outside transaction, defensive indexes
-- Columns used: id, session_id, author_type, author_name, author_id, created_at, is_public
-- ============================================================

-- -----------------------
-- Step 0: Backup (outside transaction - survives failures)
-- -----------------------
DO $$
DECLARE
  backup_table_name TEXT;
  backup_count INTEGER;
BEGIN
  backup_table_name := 'community_posts_backup_' || to_char(now(), 'YYYYMMDD_HH24MISS');
  EXECUTE format('CREATE TABLE public.%I AS SELECT * FROM public.community_posts', backup_table_name);
  EXECUTE format('SELECT COUNT(*) FROM public.%I', backup_table_name) INTO backup_count;
  RAISE NOTICE '✅ Created backup table: public.% (% rows)', backup_table_name, backup_count;
END $$;

-- -----------------------
-- Step 1+: Dedupe + constraints in transaction
-- -----------------------
BEGIN;

-- Log current state
DO $$
DECLARE
  total_posts INTEGER;
  duplicate_sessions INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_posts FROM public.community_posts;
  SELECT COUNT(*) INTO duplicate_sessions FROM (
    SELECT session_id FROM public.community_posts
    WHERE session_id IS NOT NULL
    GROUP BY session_id HAVING COUNT(*) > 1
  ) dupes;
  
  RAISE NOTICE '📊 Before cleanup: % total posts, % sessions with duplicates', 
    total_posts, COALESCE(duplicate_sessions, 0);
END $$;

-- Step 1: Delete duplicates with SMART PRIORITY
-- Keep: 1) Non-anonymous, 2) Newest created_at, 3) Highest id
WITH ranked_posts AS (
  SELECT
    id,
    session_id,
    author_name,
    author_type,
    author_id,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY session_id
      ORDER BY
        -- ✅ PRIORITY 1: Non-anonymous first
        CASE 
          WHEN author_type IS NOT NULL AND author_type != 'anonymous' THEN 1
          WHEN author_name IS NOT NULL AND author_name != 'Anonymous' THEN 1
          WHEN author_id IS NOT NULL THEN 1
          ELSE 2
        END ASC,
        -- ✅ PRIORITY 2: Newest created_at
        created_at DESC NULLS LAST,
        -- ✅ PRIORITY 3: Highest id (tie-breaker)
        id DESC
    ) AS rn
  FROM public.community_posts
  WHERE session_id IS NOT NULL
)
DELETE FROM public.community_posts p
USING ranked_posts r
WHERE p.id = r.id
  AND r.rn > 1;

-- Log deletion result
DO $$
DECLARE
  remaining_posts INTEGER;
  remaining_dupes INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_posts FROM public.community_posts;
  SELECT COUNT(*) INTO remaining_dupes FROM (
    SELECT session_id FROM public.community_posts
    WHERE session_id IS NOT NULL
    GROUP BY session_id HAVING COUNT(*) > 1
  ) dupes;
  
  RAISE NOTICE '✅ After cleanup: % posts remaining, % duplicates left', 
    remaining_posts, COALESCE(remaining_dupes, 0);
END $$;

-- Step 2: Add UNIQUE constraint if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'community_posts_session_id_key'
      AND conrelid = 'public.community_posts'::regclass
  ) THEN
    ALTER TABLE public.community_posts
      ADD CONSTRAINT community_posts_session_id_key UNIQUE (session_id);
    RAISE NOTICE '✅ Added UNIQUE constraint on session_id';
  ELSE
    RAISE NOTICE '⚠️  UNIQUE constraint already exists';
  END IF;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION '❌ Cannot add UNIQUE constraint: duplicates still exist!';
END $$;

-- Step 3: Safe indexes (use created_at, not timestamp)
CREATE INDEX IF NOT EXISTS idx_community_posts_public_created_at
  ON public.community_posts (is_public, created_at DESC)
  WHERE is_public = true;

CREATE INDEX IF NOT EXISTS idx_community_posts_author
  ON public.community_posts (author_type, author_id)
  WHERE author_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_community_posts_session_id
  ON public.community_posts (session_id)
  WHERE session_id IS NOT NULL;

DO $$
BEGIN
  RAISE NOTICE '✅ Added performance indexes';
END $$;

-- Step 4: Final verification
DO $$
DECLARE
  final_count INTEGER;
  anonymous_count INTEGER;
  guest_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO final_count FROM public.community_posts;
  SELECT COUNT(*) INTO anonymous_count 
    FROM public.community_posts 
    WHERE author_name = 'Anonymous' OR author_type = 'anonymous';
  SELECT COUNT(*) INTO guest_count 
    FROM public.community_posts 
    WHERE author_name LIKE 'Guest-%' OR author_type = 'guest';
  
  RAISE NOTICE '===========================================';
  RAISE NOTICE '✅ MIGRATION COMPLETE';
  RAISE NOTICE '   Final posts: %', final_count;
  RAISE NOTICE '   Anonymous: %', anonymous_count;
  RAISE NOTICE '   Guest: %', guest_count;
  RAISE NOTICE '===========================================';
END $$;

COMMIT;

-- -----------------------
-- Verification queries (run after to double-check)
-- -----------------------

-- Check remaining duplicates:
-- SELECT session_id, COUNT(*) AS cnt,
--        array_agg(author_name ORDER BY created_at DESC) as authors
-- FROM public.community_posts
-- WHERE session_id IS NOT NULL
-- GROUP BY session_id
-- HAVING COUNT(*) > 1;

-- List backups:
-- SELECT tablename FROM pg_tables
-- WHERE schemaname='public' AND tablename LIKE 'community_posts_backup_%'
-- ORDER BY tablename DESC;

-- Rollback if needed:
-- BEGIN;
-- DROP TABLE public.community_posts CASCADE;
-- ALTER TABLE public.community_posts_backup_YYYYMMDD_HHMMSS RENAME TO community_posts;
-- COMMIT;
