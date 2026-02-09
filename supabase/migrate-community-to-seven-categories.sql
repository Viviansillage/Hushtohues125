-- ========================================
-- Community categories migration: old 5 tags → new 7 categories
-- ========================================
-- Prerequisite: seed.sql has already run and old community_tags exist.
-- Effect: delete old tags, insert 7 new categories; existing posts will have community_tag_id set to NULL (via ON DELETE SET NULL).
-- ========================================

-- 1. Delete old community tags (will CASCADE delete related rows in user_followed_communities, and set community_posts.community_tag_id to NULL)
DELETE FROM community_tags;

-- 2. Insert 7 new categories
INSERT INTO community_tags (name, icon, color, member_count, total_posts)
VALUES
  ('Entertainment', '🎬', '#E74C3C', 0, 0),
  ('Music', '🎵', '#9B59B6', 0, 0),
  ('Games', '🎮', '#3498DB', 0, 0),
  ('Creative', '✨', '#F39C12', 0, 0),
  ('Technology', '💻', '#1ABC9C', 0, 0),
  ('Lifestyle', '🏠', '#2ECC71', 0, 0),
  ('Business', '📈', '#34495E', 0, 0);

-- Done
SELECT
  'Community categories migrated to 7 partitions.' AS status,
  (SELECT COUNT(*) FROM community_tags) AS tags_count;
