-- ========================================
-- Hush to Hues - 清理今天之前的数据
-- ========================================
-- 用法：在 Supabase SQL Editor 中运行
-- 效果：按 created_at 删除，仅保留今天创建的 chat/history/canvas/artifact 等
-- 注意：按外键依赖顺序删除，避免违反约束
-- ========================================

-- "今天" = 太平洋时间 (America/Los_Angeles) 零点
-- 即：保留 created_at >= 太平洋今天 00:00 的记录
DO $$
DECLARE
  today_start TIMESTAMPTZ := ((NOW() AT TIME ZONE 'America/Los_Angeles')::date)::timestamp AT TIME ZONE 'America/Los_Angeles';
BEGIN
  RAISE NOTICE 'Cleaning records before (Pacific midnight): %', today_start;
END $$;

-- 1. user_likes（点赞）- 关联 community_posts，需先删
DELETE FROM user_likes
WHERE created_at < (((NOW() AT TIME ZONE 'America/Los_Angeles')::date)::timestamp AT TIME ZONE 'America/Los_Angeles');

-- 2. user_bookmarks（收藏）- 关联 community_posts
DELETE FROM user_bookmarks
WHERE created_at < (((NOW() AT TIME ZONE 'America/Los_Angeles')::date)::timestamp AT TIME ZONE 'America/Los_Angeles');

-- 3. community_posts（社区帖子）- 关联 chat_sessions
DELETE FROM community_posts
WHERE created_at < (((NOW() AT TIME ZONE 'America/Los_Angeles')::date)::timestamp AT TIME ZONE 'America/Los_Angeles');

-- 4. chat_history（Archive/Canvas）
DELETE FROM chat_history
WHERE created_at < (((NOW() AT TIME ZONE 'America/Los_Angeles')::date)::timestamp AT TIME ZONE 'America/Los_Angeles');

-- 5. chat_messages（消息）- 关联 chat_sessions
DELETE FROM chat_messages
WHERE created_at < (((NOW() AT TIME ZONE 'America/Los_Angeles')::date)::timestamp AT TIME ZONE 'America/Los_Angeles');

-- 6. artifacts（artifacts 表，若存在）- 关联 chat_sessions
DELETE FROM artifacts
WHERE created_at < (((NOW() AT TIME ZONE 'America/Los_Angeles')::date)::timestamp AT TIME ZONE 'America/Los_Angeles');

-- 7. chat_sessions（会话）- 最后删；CASCADE 会自动删除其 chat_messages、artifacts
DELETE FROM chat_sessions
WHERE created_at < (((NOW() AT TIME ZONE 'America/Los_Angeles')::date)::timestamp AT TIME ZONE 'America/Los_Angeles');

-- 8. user_followed_communities（关注的社区，可选）
DELETE FROM user_followed_communities
WHERE created_at < (((NOW() AT TIME ZONE 'America/Los_Angeles')::date)::timestamp AT TIME ZONE 'America/Los_Angeles');

-- 可选：清理 community_posts 的备份表（若存在）
-- DELETE FROM community_posts_bac...
-- WHERE created_at < (((NOW() AT TIME ZONE 'America/Los_Angeles')::date)::timestamp AT TIME ZONE 'America/Los_Angeles');

-- 完成
SELECT 'Cleanup completed. Only records from today onwards remain.' AS status;
