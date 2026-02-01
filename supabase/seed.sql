-- ========================================
-- Hush to Hues - 初始数据脚本
-- ========================================
-- 用法：在reset-database.sql之后运行
-- ========================================

-- 1. 插入默认用户配置
INSERT INTO profiles (user_name, user_handle, avatar, email_notifications, save_history, public_profile)
VALUES (
  'Alex Morgan',
  '@alexmorgan',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwZW9wbGUlMjBwb3J0cmFpdHxlbnwxfHx8fDE3NjkzMTcxMDZ8MA&ixlib=rb-4.1.0&q=80&w=400',
  true,
  true,
  true
);

-- 2. 插入示例聊天会话
INSERT INTO chat_sessions (session_id, owner_type, owner_id, title, last_message_at)
VALUES
  ('session-1', 'guest', 'guest-demo', 'Creative Writing Ideas', '2026-01-24T10:30:00.000Z'),
  ('session-2', 'guest', 'guest-demo', 'Project Planning', '2026-01-23T15:45:00.000Z'),
  ('session-3', 'guest', 'guest-demo', 'Recipe Suggestions', '2026-01-22T09:20:00.000Z');

-- 3. 插入示例消息（session-1: Creative Writing Ideas）
INSERT INTO chat_messages (session_id, message_id, sender, text, timestamp)
VALUES
  ('session-1', 'msg-1-1', 'user', 'Can you help me brainstorm story concepts?', '2026-01-24T10:30:00.000Z'),
  ('session-1', 'msg-1-2', 'bot', 'Of course! I''d love to help you brainstorm story ideas. What genre are you interested in? Fantasy, sci-fi, mystery, romance, or something else?', '2026-01-24T10:30:15.000Z'),
  ('session-1', 'msg-1-3', 'user', 'I''m thinking fantasy with a modern twist', '2026-01-24T10:31:00.000Z'),
  ('session-1', 'msg-1-4', 'bot', 'Great choice! Here are some concepts:\n\n1. **Urban Enchanter**: A software developer discovers they can debug reality itself, fixing "glitches" in the fabric of the world.\n\n2. **The Last Bookshop**: In a world where magic is stored in physical books, a struggling bookshop owner is the only one who can access ancient spells.\n\n3. **Dragon Shares**: Dragons exist as corporate entities, and your protagonist just inherited shares in one.\n\nWhich direction interests you most?', '2026-01-24T10:31:30.000Z');

-- 4. 插入示例历史记录（添加owner_type和owner_id）
INSERT INTO chat_history (session_id, owner_type, owner_id, title, message_count, last_message, timestamp, preview_images, is_public, tags)
VALUES
  (
    'session-1',
    'guest',
    'guest-demo',
    'Creative Writing Ideas',
    24,
    'Can you help me brainstorm story concepts?',
    '2026-01-24T10:30:00.000Z',
    ARRAY[
      'https://images.unsplash.com/photo-1760561993754-8dcdb1a39487?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxub3RlYm9vayUyMHdyaXRpbmclMjBza2V0Y2h8ZW58MXx8fHwxNzY5MzA1NzMyfDA&ixlib=rb-4.1.0&q=80&w=1080',
      'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
      'https://images.unsplash.com/photo-1455390582262-044cdead277a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400'
    ],
    true,
    ARRAY['writing', 'creativity', 'storytelling']
  ),
  (
    'session-2',
    'guest',
    'guest-demo',
    'Project Planning',
    18,
    'What are the key milestones for a product launch?',
    '2026-01-23T15:45:00.000Z',
    ARRAY[
      'https://images.unsplash.com/photo-1571456610111-72c649ad3521?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwbGFubmluZyUyMHdoaXRlYm9hcmQlMjBza2V0Y2h8ZW58MXx8fHwxNzY5MzA1NzMyfDA&ixlib=rb-4.1.0&q=80&w=1080',
      'https://images.unsplash.com/photo-1531403009284-440f080d1e12?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400'
    ],
    false,
    ARRAY['planning', 'product', 'strategy', 'launch']
  ),
  (
    'session-3',
    'guest',
    'guest-demo',
    'Recipe Suggestions',
    12,
    'I need healthy breakfast ideas',
    '2026-01-22T09:20:00.000Z',
    ARRAY[
      'https://images.unsplash.com/photo-1550497507-634bd6d81ecd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoZWFsdGh5JTIwZm9vZCUyMHNrZXRjaHxlbnwxfHx8fDE3NjkzMDU3MzJ8MA&ixlib=rb-4.1.0&q=80&w=1080',
      'https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400'
    ],
    false,
    ARRAY['food', 'health', 'breakfast']
  );

-- 5. 插入社区示例帖子（完整字段匹配reset-database.sql）
INSERT INTO community_posts (
  post_id,
  session_id,
  author_type,
  author_id,
  author_name,
  author_handle,
  author_avatar,
  title,
  content,
  summary,
  preview_image,
  image_url,
  asset_urls,
  likes,
  likes_count,
  comments,
  comments_count,
  timestamp,
  tags,
  is_demo
)
VALUES
  (
    'post-1',
    'session-1',
    'seed',
    'demo-user-1',
    'Alex Morgan',
    '@alexmorgan',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwZW9wbGUlMjBwb3J0cmFpdHxlbnwxfHx8fDE3NjkzMTcxMDZ8MA&ixlib=rb-4.1.0&q=80&w=400',
    'Creative Writing Session',
    'Brainstorming fantasy story ideas with a modern twist! This creative session explores innovative storytelling techniques.',
    'Brainstorming fantasy story ideas with a modern twist!',
    'https://images.unsplash.com/photo-1760561993754-8dcdb1a39487?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxub3RlYm9vayUyMHdyaXRpbmclMjBza2V0Y2h8ZW58MXx8fHwxNzY5MzA1NzMyfDA&ixlib=rb-4.1.0&q=80&w=1080',
    'https://images.unsplash.com/photo-1760561993754-8dcdb1a39487?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxub3RlYm9vayUyMHdyaXRpbmclMjBza2V0Y2h8ZW58MXx8fHwxNzY5MzA1NzMyfDA&ixlib=rb-4.1.0&q=80&w=1080',
    ARRAY['https://images.unsplash.com/photo-1760561993754-8dcdb1a39487?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxub3RlYm9vayUyMHdyaXRpbmclMjBza2V0Y2h8ZW58MXx8fHwxNzY5MzA1NzMyfDA&ixlib=rb-4.1.0&q=80&w=1080'],
    42,
    42,
    12,
    12,
    '2026-01-24T10:30:00.000Z',
    ARRAY['writing', 'creativity', 'fantasy'],
    false
  ),
  (
    'post-2',
    'session-2',
    'seed',
    'demo-user-2',
    'Jordan Lee',
    '@jordanlee',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
    'Product Launch Planning',
    'Mapping out the key milestones for our upcoming product launch with detailed timeline and strategy.',
    'Mapping out the key milestones for our upcoming product launch',
    'https://images.unsplash.com/photo-1571456610111-72c649ad3521?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwbGFubmluZyUyMHdoaXRlYm9hcmQlMjBza2V0Y2h8ZW58MXx8fHwxNzY5MzA1NzMyfDA&ixlib=rb-4.1.0&q=80&w=1080',
    'https://images.unsplash.com/photo-1571456610111-72c649ad3521?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwbGFubmluZyUyMHdoaXRlYm9hcmQlMjBza2V0Y2h8ZW58MXx8fHwxNzY5MzA1NzMyfDA&ixlib=rb-4.1.0&q=80&w=1080',
    ARRAY['https://images.unsplash.com/photo-1571456610111-72c649ad3521?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwbGFubmluZyUyMHdoaXRlYm9hcmQlMjBza2V0Y2h8ZW58MXx8fHwxNzY5MzA1NzMyfDA&ixlib=rb-4.1.0&q=80&w=1080'],
    28,
    28,
    8,
    8,
    '2026-01-23T15:45:00.000Z',
    ARRAY['planning', 'product', 'business'],
    false
  );

-- 6. 插入社区标签
INSERT INTO community_tags (name, icon, color, member_count, total_posts)
VALUES
  ('Creative Writing', '✍️', '#FF6B6B', 1250, 3420),
  ('Product Design', '🎨', '#4ECDC4', 980, 2150),
  ('Mental Health', '🧠', '#95E1D3', 2100, 5670),
  ('Career Growth', '📈', '#FFD93D', 1560, 4200),
  ('Tech Tips', '💻', '#6C5CE7', 3200, 8900);

-- 完成！
SELECT 
  'Database seeded successfully!' as status,
  (SELECT COUNT(*) FROM profiles) as profiles_count,
  (SELECT COUNT(*) FROM chat_sessions) as sessions_count,
  (SELECT COUNT(*) FROM chat_messages) as messages_count,
  (SELECT COUNT(*) FROM chat_history) as history_count,
  (SELECT COUNT(*) FROM community_posts) as posts_count,
  (SELECT COUNT(*) FROM community_tags) as tags_count;
