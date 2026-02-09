-- ========================================
-- Hush to Hues - Cleanup data before today
-- ========================================
-- Usage: run this in Supabase SQL Editor
-- Effect: delete by created_at, keeping only chat/history/canvas/artifact records created today
-- Note: delete in FK dependency order to avoid constraint violations
-- ========================================

-- "Today" = midnight in Pacific Time (America/Los_Angeles)
-- i.e. keep records where created_at >= today 00:00 in Pacific Time
DO $$
DECLARE
  today_start TIMESTAMPTZ := ((NOW() AT TIME ZONE 'America/Los_Angeles')::date)::timestamp AT TIME ZONE 'America/Los_Angeles';
BEGIN
  RAISE NOTICE 'Cleaning records before (Pacific midnight): %', today_start;
END $$;

-- 1. user_likes (likes) - linked to community_posts, must be deleted first
DELETE FROM user_likes
WHERE created_at < (((NOW() AT TIME ZONE 'America/Los_Angeles')::date)::timestamp AT TIME ZONE 'America/Los_Angeles');

-- 2. user_bookmarks (bookmarks) - linked to community_posts
DELETE FROM user_bookmarks
WHERE created_at < (((NOW() AT TIME ZONE 'America/Los_Angeles')::date)::timestamp AT TIME ZONE 'America/Los_Angeles');

-- 3. community_posts (community posts) - linked to chat_sessions
DELETE FROM community_posts
WHERE created_at < (((NOW() AT TIME ZONE 'America/Los_Angeles')::date)::timestamp AT TIME ZONE 'America/Los_Angeles');

-- 4. chat_history（Archive/Canvas）
DELETE FROM chat_history
WHERE created_at < (((NOW() AT TIME ZONE 'America/Los_Angeles')::date)::timestamp AT TIME ZONE 'America/Los_Angeles');

-- 5. chat_messages (messages) - linked to chat_sessions
DELETE FROM chat_messages
WHERE created_at < (((NOW() AT TIME ZONE 'America/Los_Angeles')::date)::timestamp AT TIME ZONE 'America/Los_Angeles');

-- 6. artifacts (artifacts table, if exists) - linked to chat_sessions
DELETE FROM artifacts
WHERE created_at < (((NOW() AT TIME ZONE 'America/Los_Angeles')::date)::timestamp AT TIME ZONE 'America/Los_Angeles');

-- 7. chat_sessions (sessions) - delete last; CASCADE will delete its chat_messages and artifacts
DELETE FROM chat_sessions
WHERE created_at < (((NOW() AT TIME ZONE 'America/Los_Angeles')::date)::timestamp AT TIME ZONE 'America/Los_Angeles');

-- 8. user_followed_communities (followed communities, optional)
DELETE FROM user_followed_communities
WHERE created_at < (((NOW() AT TIME ZONE 'America/Los_Angeles')::date)::timestamp AT TIME ZONE 'America/Los_Angeles');

-- Optional: clean backup table for community_posts (if exists)
-- DELETE FROM community_posts_bac...
-- WHERE created_at < (((NOW() AT TIME ZONE 'America/Los_Angeles')::date)::timestamp AT TIME ZONE 'America/Los_Angeles');

-- Done
SELECT 'Cleanup completed. Only records from today onwards remain.' AS status;
