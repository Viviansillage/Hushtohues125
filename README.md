# Hush to Hues

An AI-powered creative assistant with a hand-drawn sketch aesthetic. Turn your thoughts into visual artifacts, mindmaps, and share them with the community.

## ✨ Features

- 🎨 **AI Chat Interface** - Natural conversation with creative AI
- 📝 **History Archive** - Save and manage chat sessions
- 🌍 **Community Sharing** - Discover and share creative works
- 🎯 **Hand-drawn UI** - Unique sketch-style interface with animations
- 💾 **Cloud Database** - Supabase PostgreSQL + Storage

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Supabase account (free)
- Vercel account (optional, for deployment)

### Local Development

```bash
# 1. Clone and install
git clone <your-repo>
cd Hushtohues125
npm install

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# 3. Setup database
# Run the SQL in supabase/schema.sql in Supabase SQL Editor

# 4. Migrate data (optional)
node supabase/migrate-data.js

# 5. Start development servers
npm run dev:all
# Frontend: http://localhost:3000
# Backend: http://localhost:3001
```

## 📦 Tech Stack

**Frontend**
- React 18.3 + TypeScript
- Vite 6.3
- Radix UI + Framer Motion
- Tailwind CSS

**Backend**
- Node.js + Express
- Supabase (PostgreSQL + Storage)
- RESTful API

**Deployment**
- Vercel (Serverless Functions)
- Supabase (Database + Storage)

## 📚 Documentation

- [DEPLOYMENT.md](DEPLOYMENT.md) - Complete deployment guide
- [supabase/schema.sql](supabase/schema.sql) - Database schema

## 🛠️ Development

```bash
# Frontend only
npm run dev

# Backend only
npm run dev:server

# Both (recommended)
npm run dev:all

# Build for production
npm run build
```

## 🚀 Deploy

See [DEPLOYMENT.md](DEPLOYMENT.md) for step-by-step deployment instructions.

## 📄 License

MIT

---

**Original Design**: [Figma](https://www.figma.com/design/RHXcG8erzo4CbUHz8p3GSm/Hush-to-Hues)
  
