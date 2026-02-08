-- ========================================
-- 社区分区迁移：旧 5 个标签 → 新 7 个分区
-- ========================================
-- 适用：seed 已跑过，数据库中已有旧的 community_tags。
-- 效果：删除旧标签，插入 7 个新分区；已有帖子的 community_tag_id 会变为 NULL（由 ON DELETE SET NULL 保证）。
-- ========================================

-- 1. 删除旧社区标签（会 CASCADE 删除 user_followed_communities 中对应关注，并把 community_posts.community_tag_id 置为 NULL）
DELETE FROM community_tags;

-- 2. 插入 7 个新分区
INSERT INTO community_tags (name, icon, color, member_count, total_posts)
VALUES
  ('Entertainment', '🎬', '#E74C3C', 0, 0),
  ('Music', '🎵', '#9B59B6', 0, 0),
  ('Games', '🎮', '#3498DB', 0, 0),
  ('Creative', '✨', '#F39C12', 0, 0),
  ('Technology', '💻', '#1ABC9C', 0, 0),
  ('Lifestyle', '🏠', '#2ECC71', 0, 0),
  ('Business', '📈', '#34495E', 0, 0);

-- 完成
SELECT
  'Community categories migrated to 7 partitions.' AS status,
  (SELECT COUNT(*) FROM community_tags) AS tags_count;
