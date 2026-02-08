/**
 * 清理 Supabase Storage 中今天之前上传的图片
 * "今天" = 太平洋时间 (America/Los_Angeles) 零点
 * 用法：npm run cleanup-storage
 * 零依赖，仅用 Node 内置模块 + Supabase REST API
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
  console.error('缺少环境变量。');
  if (loadedFile) {
    const keys = Object.keys(process.env).filter((k) => k.includes('SUPABASE'));
    console.error(`已从 ${loadedFile} 加载，找到的 Supabase 相关变量: ${keys.join(', ') || '无'}`);
  } else {
    console.error('未找到 .env.local 或 .env 文件');
  }
  console.error('需要: SUPABASE_URL（或 VITE_SUPABASE_URL）+ SUPABASE_SERVICE_KEY（或 VITE_SUPABASE_ANON_KEY）');
  console.error('可选: SUPABASE_STORAGE_BUCKET（默认 artifacts，若不存在可改为 images）');
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

// [DEBUG] 打印"今天"的边界，便于排查是否误删今日文件
const todayStr = new Date(todayStartMs).toISOString();
console.log('[DEBUG] "今天"起点(太平洋零点):', todayStr, 'timestamp:', todayStartMs);

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
      throw new Error(`Bucket "${BUCKET}" 不存在。请在 Supabase Dashboard → Storage 中创建，或设置 SUPABASE_STORAGE_BUCKET=images 等已存在的 bucket 名。`);
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
  console.log(`正在列出 ${BUCKET} bucket 中的文件...`);
  const allPaths = await listAllFiles();
  console.log(`共找到 ${allPaths.length} 个文件`);

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
      console.warn('[DEBUG] 跳过无法解析时间的文件:', p);
    }
  }

  // [DEBUG] 展示保留/删除的样本
  if (kept.length > 0) {
    console.log('[DEBUG] 今日保留的样本(前3个):', kept.slice(0, 3));
  }
  if (toDelete.length > 0) {
    console.log('[DEBUG] 待删除的样本(前5个):', toDelete.slice(0, 5));
  }

  console.log(`需要删除 ${toDelete.length} 个今天之前的文件，保留 ${kept.length} 个今日文件`);
  if (toDelete.length === 0) {
    console.log('无需删除，完成');
    return;
  }

  // Supabase 单次最多删除 1000 个
  for (let i = 0; i < toDelete.length; i += 1000) {
    const batch = toDelete.slice(i, i + 1000);
    const res = await fetch(`${baseUrl}/storage/v1/object/${BUCKET}`, {
      method: 'DELETE',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefixes: batch })
    });
    if (!res.ok) {
      console.error('删除失败:', res.status, await res.text());
      process.exit(1);
    }
    console.log(`已删除 ${batch.length} 个文件`);
  }
  console.log('全部完成，共删除', toDelete.length, '个文件');
  console.log('[DEBUG] 本脚本仅删除 Storage 中的文件，不会修改 chat_history/chat_messages 等数据库表');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
