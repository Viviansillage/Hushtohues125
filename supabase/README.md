# Supabase Database Guide

Guide for setting up and maintaining the Hush to Hues database on Supabase.

---

## What each file does

| File | Purpose |
|------|--------|
| **reset-database.sql** | Drops all tables and recreates them from the current schema. Run this first when building the DB from scratch. |
| **seed.sql** | Inserts initial data (profiles, sample sessions, messages, history, community posts). Run after `reset-database.sql`. |
| **guest-migration.sql** | Adds guest/seed support: `profiles` (e.g. `is_seed`, `display_name`), `chat_history`, `community_posts`, `user_likes`. Required after a fresh reset (reset does not add `profiles.is_seed` / `display_name`). For existing DBs, run as first migration. |
| **fix-community-following.sql** | Adds `actor_type` / `actor_id` and indexes to `user_followed_communities` for guest support. For existing DBs only (reset already includes these columns). |
| **migrate-community-reference-only-safe.sql** | Switches `community_posts` from snapshot/copy mode to reference-only (stores `session_id` reference). Recreates the table and backs up to `community_posts_backup`. Optional; for existing DBs or schema change. |
| **fix-duplicate-posts-migration.sql** | Deduplicates `community_posts` by session and enforces `UNIQUE(session_id)`. Run when you have duplicate posts for the same session. |
| **migrate-community-to-seven-categories.sql** | Replaces the original 5 community tags (from seed) with 7 new categories: Entertainment, Music, Games, Creative, Technology, Lifestyle, Business. Existing posts’ category becomes NULL; run once after seed if you want the new partition set. |
| **cleanup-before-today.sql** | Maintenance: deletes rows with `created_at` before today (Pacific time) in chat/history/community/likes/etc. Use for periodic demo DB cleanup. |
| **cleanup-storage-before-today.js** | Maintenance: deletes files in the Storage bucket that were uploaded before today (Pacific). Run from project root: `npm run cleanup-storage`. Requires `.env.local`. |
| **migrate-data.js** | Node script for programmatic data migration or seeding. Optional. |
| **SCHEMA_VALIDATION.md** | Schema and field reference; not executed. |

---

## Run order

### Scenario 1: From scratch (new project or full reset)

Run in this order in the Supabase SQL Editor:

1. **reset-database.sql** — creates all tables.
2. **seed.sql** — inserts initial data.
3. **guest-migration.sql** — adds `profiles.is_seed`, `profiles.display_name`, and any other guest columns missing from the base schema (idempotent).

Then in the Dashboard:

4. Create Storage bucket **`artifacts`** (Public). See [Quick start](#quick-start-from-scratch) below.

**When to use:** First deploy, or whenever you can wipe all data (e.g. dev/demo).

---

### Scenario 2: Existing database (keep data, add features)

Do **not** run `reset-database.sql`. Run in this order:

1. **guest-migration.sql** — add guest/seed columns if not already applied.
2. **fix-community-following.sql** — add actor columns and indexes to `user_followed_communities` if needed.
3. **migrate-community-reference-only-safe.sql** — (optional) switch community to reference-only; backs up and recreates `community_posts`.
4. **fix-duplicate-posts-migration.sql** — (as needed) when you have duplicate posts per session.
5. **migrate-community-to-seven-categories.sql** — (optional) replace the 5 seed community tags with the 7 new categories (Entertainment, Music, Games, Creative, Technology, Lifestyle, Business). Run once when you want to switch to this partition set.

All of these are idempotent where possible; re-running after already applied is generally safe. **migrate-community-to-seven-categories.sql** is safe to run only once (re-running just deletes and re-inserts the same 7 tags).

**When to use:** Production or any DB with data you must keep.

---

### Maintenance (any time)

- **cleanup-before-today.sql** — run in SQL Editor to trim DB to “today and later” (Pacific).
- **cleanup-storage-before-today.js** — run from repo root: `npm run cleanup-storage` (uses `.env.local`).

---

## Quick start: from scratch

### 1. Open SQL Editor

1. Go to [Supabase Dashboard](https://supabase.com/dashboard) and select your project.
2. Open **SQL Editor**.

### 2. Run reset and seed

1. **New query** → paste full contents of **reset-database.sql** → **Run**.
2. **New query** → paste full contents of **seed.sql** → **Run**.
3. **New query** → paste full contents of **guest-migration.sql** → **Run**.

You should see something like:

```
Database seeded successfully!   | 1 | 3 | 4 | 3 | 2
```

### 3. Create Storage bucket

1. Go to **Storage** → **Create a new bucket**.
2. **Name:** `artifacts`
3. **Public bucket:** enabled.
4. Optionally set **File size limit** (e.g. 50 MB). Leave **Allowed MIME types** empty.

### 4. Verify

In **Table Editor**, confirm tables exist and have data:  
`profiles`, `chat_sessions`, `chat_messages`, `artifacts`, `chat_history`, `community_tags`, `community_posts`, `user_likes`, `user_bookmarks`, `user_followed_communities`.

---

## Database schema overview

### Main tables (10)

| Table | Purpose | Key fields |
|-------|---------|------------|
| `profiles` | User config | user_name, user_handle, avatar, is_seed, display_name |
| `chat_sessions` | Chat session metadata | session_id, owner_type, owner_id, title |
| `chat_messages` | Chat messages | session_id, message_id, sender, text |
| `artifacts` | Generated images/diagrams | session_id, artifact_type, public_url, provider, model |
| `chat_history` | Archive/canvas (one per session) | session_id, owner_type, owner_id, content_json, title, tags |
| `community_tags` | Community categories | name, icon, color, member_count |
| `community_posts` | Community posts | session_id, author_type, author_id, title, likes_count |
| `user_likes` | User likes | actor_type, actor_id, target_type, target_id |
| `user_bookmarks` | User bookmarks | actor_type, actor_id, post_id |
| `user_followed_communities` | Followed communities | actor_type, actor_id, community_tag_id |

### Relationship sketch

```
profiles (1) ──── (n) chat_sessions
                       ├── (n) chat_messages
                       ├── (n) artifacts
                       └── (1) chat_history

community_tags (1) ──── (n) community_posts ──── (n) user_likes / user_bookmarks
                              │
                              └── user_followed_communities
```

---

## Changing the schema later

- **Full reset (dev/demo):** Edit **reset-database.sql** and **seed.sql**, then run both plus **guest-migration.sql** again. All data is replaced.
- **Existing DB with data:** Add a new migration script (e.g. `ALTER TABLE ... ADD COLUMN`, `CREATE INDEX`), run it in SQL Editor; do not run reset.

---

## Troubleshooting

- **reset-database.sql "permission denied"** — Use a role with DB owner rights; running in Dashboard usually works.
- **seed.sql fails** — Run **reset-database.sql** first so tables exist.
- **Storage bucket missing** — Refresh the Dashboard or confirm the correct project.
- **RLS blocking access** — Default is permissive; if you changed policies, ensure the app can read/write as needed.

---

## References

- [Supabase Docs](https://supabase.com/docs)
- [Supabase SQL Editor](https://supabase.com/docs/guides/database/overview)
- [Supabase Storage](https://supabase.com/docs/guides/storage)

---

## Post-setup checklist

- [ ] All 10 tables created and visible in Table Editor.
- [ ] **seed.sql** ran successfully and sample data is present.
- [ ] **guest-migration.sql** ran (so `profiles` has `is_seed`, `display_name`).
- [ ] Storage bucket **artifacts** exists and is public.
- [ ] App can connect and read/write (quick smoke test).
