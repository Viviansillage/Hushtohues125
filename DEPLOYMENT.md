# Deployment Guide

Complete guide to deploy **Hush to Hues** to Vercel + Supabase.

## 📋 Quick Navigation

1. [Supabase Setup](#supabase-setup) (5 min)
2. [Local Development](#local-development) (5 min)
3. [Deploy to Vercel](#deploy-to-vercel) (5 min)
4. [Team Collaboration](#team-collaboration)
5. [Troubleshooting](#troubleshooting)

---

## Supabase Setup

### 1. Create Project

Visit https://supabase.com → Sign in → New Project

- **Name**: `hush-to-hues`
- **Password**: Create a strong password
- **Region**: Tokyo or Singapore
- Wait 2-3 minutes for creation

### 2. Get API Keys

Go to **Project Settings** → **API**, copy:

```
Project URL: https://xxxxx.supabase.co
anon public: eyJhbGci...
service_role: eyJhbGci...
```

### 3. Setup Database

**SQL Editor** → New query → Copy content from `supabase/schema.sql` → Run

### 4. Create Storage

**Storage** → Create bucket → Name: `images` → Public → Create

---

## Local Development

### 1. Configure Environment

Create `.env.local`:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
```

### 2. Install & Start

```bash
npm install
node supabase/migrate-data.js  # Optional: migrate test data
npm run dev:all
```

Visit http://localhost:3000

---

## Deploy to Vercel

### Quick Deploy

```bash
# 1. Push to GitHub
git add .
git commit -m "feat: integrate Supabase"
git push

# 2. Import to Vercel
# Visit vercel.com → Import Project → Select repo

# 3. Add Environment Variables in Vercel:
SUPABASE_URL
SUPABASE_SERVICE_KEY
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY

# 4. Deploy (1-2 min)
```

Your app will be live at `https://your-app.vercel.app`

### Using CLI

```bash
npm install -g vercel
vercel login
vercel
vercel env add SUPABASE_URL
vercel env add SUPABASE_SERVICE_KEY
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY
vercel --prod
```

---

## Team Collaboration

### Setup (Team Members)

1. Pull code: `git pull && npm install`
2. Get `.env.local` config from team lead
3. Start: `npm run dev:all`

### Workflow

```bash
git pull              # Always pull first
# Make changes...
npm run dev:all      # Test locally
git add .
git commit -m "feat: description"
git push             # Vercel auto-deploys
```

### Sharing Config

**Team Lead**: Create `team-config.txt` (DON'T commit):

```
VITE_SUPABASE_URL=https://...
VITE_SUPABASE_ANON_KEY=...
SUPABASE_URL=https://...
SUPABASE_SERVICE_KEY=...
```

Share via private message only.

---

## Troubleshooting

### API 404 Errors

Check:
- `vercel.json` exists
- `api/index.js` exists  
- Environment variables set in Vercel

### Database Connection Failed

- Verify `.env.local` has correct keys
- Check Supabase project not paused
- Confirm SQL schema ran successfully

### Port Conflicts

```bash
npx kill-port 3000
npx kill-port 3001
```

### No Data Showing

```bash
node supabase/migrate-data.js
# Check Supabase Table Editor for data
```

### Build Fails

```bash
# Test build locally
npm run build

# Check for TypeScript errors
# Verify all dependencies installed
```

---

## Resource Limits

### Supabase Free Tier
- 500MB Database
- 1GB Storage  
- 2GB Bandwidth/month
- Pauses after 7 days inactivity (auto-resumes)

### Vercel Free Tier
- 100GB Bandwidth/month
- Unlimited deployments

**Estimated Hackathon Usage**: ~100MB (well under limits)

---

## Security Notes

✅ **DO**:
- Use `.env.local` locally
- Set env vars in Vercel dashboard
- Share keys privately

❌ **DON'T**:
- Commit `.env.local` to Git
- Post keys publicly
- Share screenshots with visible keys

---

## Tips

- **Auto-deploy**: Push to GitHub triggers Vercel deploy
- **Rollback**: Vercel Dashboard → Deployments → Promote previous
- **Logs**: Check Vercel Dashboard → Logs
- **Database**: View data in Supabase Table Editor

---

**Questions?** Check [README.md](README.md) or review error logs in Vercel/Supabase dashboards.
