# Hush to Hues 🎨

AI-powered creative assistant with hand-drawn sketch aesthetic. Transform your thoughts into mindmaps and images, share with the community.

## ✨ Features

- 🤖 **AI Chat** - Natural conversation with Gemini 2.0 Flash
- 🧠 **Mindmap Generation** - Auto-generate Mermaid mindmaps
- 🎨 **Image Generation** - Create images with Gemini 2.5 Flash Image
- 📚 **History Archive** - Save and browse your creations
- 🌍 **Community Sharing** - Discover and share creative works
- ✍️ **Hand-drawn UI** - Unique sketch-style interface

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Supabase account ([free tier](https://supabase.com))
- Gemini API key ([get it here](https://aistudio.google.com/apikey))

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local
# Add your keys to .env.local:
#   SUPABASE_URL=https://xxx.supabase.co
#   SUPABASE_SERVICE_KEY=eyJhbGci...
#   GEMINI_API_KEY=AIza...

# 3. Setup database
# Run SQL from supabase/schema.sql in Supabase SQL Editor
# Create Storage bucket: "artifacts" (public access)

# 4. Start development
npm run dev
```

Frontend: `http://localhost:5173`

## 📦 Tech Stack

- **Frontend**: React + TypeScript + Vite + Tailwind
- **Backend**: Vercel Serverless Functions
- **Database**: Supabase (PostgreSQL + Storage)
- **AI**: Google Gemini API (2.0 Flash + 2.5 Flash Image)

## 📚 Documentation

- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Complete deployment guide to Vercel
- **[DOCS.md](DOCS.md)** - API documentation & development guide

## 🛠️ Development

```bash
# Development mode
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 🌐 Deploy

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed Vercel deployment instructions.

## 📄 License

MIT

---

**Design Credits**: Original Figma design from [Hush to Hues](https://www.figma.com/design/RHXcG8erzo4CbUHz8p3GSm/Hush-to-Hues)
  
