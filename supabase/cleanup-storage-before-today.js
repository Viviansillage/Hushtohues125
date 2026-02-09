/**
 * Clean up images in Supabase Storage that were uploaded before today.
 * "Today" = midnight in Pacific Time (America/Los_Angeles).
 * Usage: npm run cleanup-storage
 * Zero external deps: Node built-ins + Supabase REST API only.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function loadEnv() {
  for (const name of ['.env.local', '.env']) {
    const p = path.join(root, name);
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf8');
      for (const line of content.split(/\r?\n/)) {
        const m = line.match(/^\s*([^#=]+)=(.*)$/);
        if (m) {
          const k = m[1].trim();
          let v = m[2].trim().replace(/^["']|["']$/g, '');
          if (v.endsWith('\r')) v = v.slice(0, -1);
          process.env[k] = v;
        }
      }
      return name;
    }
  }
  return null;
}
const loadedFile = loadEnv();

const baseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'artifacts';

if (!baseUrl || !key) {
  console.error('Missing required environment variables.');
  if (loadedFile) {
    const keys = Object.keys(process.env).filter((k) => k.includes('SUPABASE'));
    console.error(`Loaded ${loadedFile}, found Supabase-related variables: ${keys.join(', ') || 'none'}`);
  } else {
    console.error('Could not find .env.local or .env file');
  }
  console.error('Required: SUPABASE_URL (or VITE_SUPABASE_URL) + SUPABASE_SERVICE_KEY (or VITE_SUPABASE_ANON_KEY)');
  console.error('Optional: SUPABASE_STORAGE_BUCKET (default artifacts; you can change to an existing bucket like "images")');
  process.exit(1);
}

const headers = { Authorization: `Bearer ${key}`, apikey: key };

function getPacificMidnightTodayMs() {
  const now = new Date();
  const todayPacific = now.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  for (let h = 0; h < 24; h++) {
    const d = new Date(todayPacific + 'T' + String(h).padStart(2, '0') + ':00:00.000Z');
    const hourInPacific = parseInt(d.toLocaleString('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', hour12: false }));
    if (hourInPacific === 0) return d.getTime();
  }
  return new Date(todayPacific).getTime();
}
const todayStartMs = getPacificMidnightTodayMs();

// [DEBUG] Print the boundary of "today" to help debug accidental deletions
const todayStr = new Date(todayStartMs).toISOString();
console.log('[DEBUG] "Today" start (Pacific midnight):', todayStr, 'timestamp:', todayStartMs);

async function listAllFiles(prefix = '', files = []) {
  const url = `${baseUrl}/storage/v1/object/list/${BUCKET}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix, limit: 1000 })
  });
  if (!res.ok) {
    const body = await res.text();
    if (body.includes('Bucket not found')) {
      throw new Error(`Bucket "${BUCKET}" does not exist. Please create it in Supabase Dashboard → Storage, or set SUPABASE_STORAGE_BUCKET=images (or another existing bucket name).`);
    }
    throw new Error(`List failed: ${res.status} ${body}`);
  }
  const items = await res.json();
  for (const item of items || []) {
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id != null) {
      files.push(fullPath);
    } else {
      await listAllFiles(fullPath, files);
    }
  }
  return files;
}

async function main() {
  console.log(`Listing files in bucket ${BUCKET}...`);
  const allPaths = await listAllFiles();
  console.log(`Found ${allPaths.length} files`);

  const toDelete = [];
  const kept = [];
  for (const p of allPaths) {
    const fileName = p.split('/').pop();
    const match = fileName && /^(\d+)-/.exec(fileName);
    if (match) {
      const ts = parseInt(match[1], 10);
      if (ts < todayStartMs) {
        toDelete.push(p);
      } else {
        kept.push({ path: p, ts });
      }
    } else {
      console.warn('[DEBUG] Skipping file with unparseable timestamp:', p);
    }
  }

  // [DEBUG] Show samples for kept/deleted files
  if (kept.length > 0) {
    console.log('[DEBUG] Sample kept for today (first 3):', kept.slice(0, 3));
  }
  if (toDelete.length > 0) {
    console.log('[DEBUG] Sample to delete (first 5):', toDelete.slice(0, 5));
  }

  console.log(`Will delete ${toDelete.length} files before today, keeping ${kept.length} files from today`);
  if (toDelete.length === 0) {
    console.log('No files need deletion, done');
    return;
  }

  // Supabase can delete at most 1000 objects per request
  for (let i = 0; i < toDelete.length; i += 1000) {
    const batch = toDelete.slice(i, i + 1000);
    const res = await fetch(`${baseUrl}/storage/v1/object/${BUCKET}`, {
      method: 'DELETE',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefixes: batch })
    });
    if (!res.ok) {
      console.error('Delete failed:', res.status, await res.text());
      process.exit(1);
    }
    console.log(`Deleted ${batch.length} files`);
  }
  console.log('All done, deleted', toDelete.length, 'files in total');
  console.log('[DEBUG] This script only deletes files in Storage; it does not modify chat_history/chat_messages or other tables');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
