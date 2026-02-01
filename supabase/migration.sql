-- Migration Script: Add DB-backed chat architecture
-- Run this in Supabase SQL Editor

-- Step 1: Create new tables
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL UNIQUE,
  owner_type TEXT NOT NULL CHECK (owner_type IN ('user', 'guest')),
  owner_id TEXT NOT NULL,
  title TEXT,
  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  is_public BOOLEAN DEFAULT false,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL REFERENCES chat_sessions(session_id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,
  sender TEXT NOT NULL CHECK (sender IN ('user', 'bot')),
  text TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, message_id)
);

CREATE TABLE IF NOT EXISTS artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL REFERENCES chat_sessions(session_id) ON DELETE CASCADE,
  artifact_type TEXT NOT NULL CHECK (artifact_type IN ('image', 'mindmap', 'save')),
  prompt TEXT,
  storage_path TEXT,
  public_url TEXT NOT NULL,
  provider TEXT,
  model TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Add session_id column to existing chat_history table
ALTER TABLE chat_history 
ADD COLUMN IF NOT EXISTS session_id TEXT REFERENCES chat_sessions(session_id) ON DELETE CASCADE;

ALTER TABLE chat_history
ADD COLUMN IF NOT EXISTS owner_type TEXT DEFAULT 'guest';

ALTER TABLE chat_history
ADD COLUMN IF NOT EXISTS owner_id TEXT;

ALTER TABLE chat_history
ADD COLUMN IF NOT EXISTS content_json JSONB DEFAULT '{}';

-- Step 3: Create indexes
CREATE INDEX IF NOT EXISTS idx_chat_sessions_owner ON chat_sessions(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_session_id ON chat_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_timestamp ON chat_messages(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_artifacts_session_id ON artifacts(session_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_created_at ON artifacts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_history_session_id ON chat_history(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_owner ON chat_history(owner_type, owner_id);

-- Step 4: Enable RLS on new tables
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifacts ENABLE ROW LEVEL SECURITY;

-- Step 5: Create RLS policies (public access for hackathon)
CREATE POLICY "Allow public read chat_sessions" ON chat_sessions FOR SELECT USING (true);
CREATE POLICY "Allow public insert chat_sessions" ON chat_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update chat_sessions" ON chat_sessions FOR UPDATE USING (true);
CREATE POLICY "Allow public delete chat_sessions" ON chat_sessions FOR DELETE USING (true);

CREATE POLICY "Allow public read chat_messages" ON chat_messages FOR SELECT USING (true);
CREATE POLICY "Allow public insert chat_messages" ON chat_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete chat_messages" ON chat_messages FOR DELETE USING (true);

CREATE POLICY "Allow public read artifacts" ON artifacts FOR SELECT USING (true);
CREATE POLICY "Allow public insert artifacts" ON artifacts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete artifacts" ON artifacts FOR DELETE USING (true);

-- Step 6: Create Storage bucket for artifacts (if not exists)
-- Note: This must be done via Supabase Dashboard → Storage
-- Bucket name: artifacts
-- Public: Yes
-- File size limit: 10 MB

-- Step 7: Verify migration
SELECT 'chat_sessions' as table_name, COUNT(*) as count FROM chat_sessions
UNION ALL
SELECT 'chat_messages', COUNT(*) FROM chat_messages
UNION ALL
SELECT 'artifacts', COUNT(*) FROM artifacts
UNION ALL
SELECT 'chat_history', COUNT(*) FROM chat_history;

-- Expected output: All tables should exist (counts may be 0)

COMMENT ON TABLE chat_sessions IS 'New architecture: Stores chat session metadata';
COMMENT ON TABLE chat_messages IS 'New architecture: Stores individual messages per session';
COMMENT ON TABLE artifacts IS 'New architecture: Stores generated images/mindmaps with Supabase Storage URLs';
COMMENT ON TABLE chat_history IS 'Legacy table: Will be deprecated in future, kept for backward compatibility';
