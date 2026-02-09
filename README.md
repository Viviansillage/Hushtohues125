# Hush to Hues

Turns raw thoughts (text or voice) into structured outputs: Mermaid diagrams (mind map, flowchart, or graph—chosen by the model), summaries, and AI-generated images. Hackathon project; supports guest mode, archive, and community sharing.

---

## Demo

- **Live App:** [https://hushtohues.vercel.app](https://hushtohues.vercel.app)
- **Demo Video:** [https://youtu.be/kaT2cOuxtdM](https://youtu.be/kaT2cOuxtdM)

---

## Core Features

- **Chat-based input** — Conversational interface for thought capture; optional voice input.
- **AI analysis** — Gemini parses and clarifies user input, returning structured JSON (reply, title, summary, tags, follow-up questions, mindmap skeleton).
- **Diagram generation** — Mermaid diagrams (mind map, flowchart, or graph) from conversation; diagram type chosen by the model from content structure (hierarchical → mindmap, relational → graph, process → flowchart).
- **Image generation** — Images generated from conversation context via Gemini image models (e.g. `gemini-3-pro-image-preview`); prompt is first produced by a text model.
- **Archive system** — Save artifacts (diagram + image + metadata) per session; append-only updates per session; list/load by session or ID.
- **Community sharing** — Publish sessions as posts; discover feed; like, bookmark, follow communities; guest users can publish with `X-Guest-ID`.
- **Guest mode** — Use without auth via `X-Guest-ID` header; guest data can be marked demo and given an expiry (e.g. 7 days for history, 60 days for demo flag).

---

## Gemini Integration

### Features using Gemini API

| Feature | Description | Model | Location |
|---------|-------------|-------|----------|
| **Process conversations and extract logic** | Parse user input, clarify meaning, return structured JSON (reply, title, summary, tags, mindmap skeleton) | `gemini-3-pro-preview` | `api/chat.js` → `callGemini` |
| **Generate images and diagrams** | Create Mermaid diagrams (mindmap/graph/flowchart) and AI images from conversation context | Diagram: `gemini-3-pro-preview`; Image: `gemini-3-pro-image-preview` | `api/chat.js` → `callGemini`, `callGeminiFlashImage` |
| **Auto-extract tags from canvas text** | Suggest semantic tags when saving/editing canvas content | `gemini-3-pro-preview` | `api/supabase.js` → `generateSemanticTags` |
| **Intelligently classify content into communities** | Assign canvas content to one of 7 fixed community categories when publishing | `gemini-3-pro-preview` | `api/supabase.js` → `classifyCommunityCategory` |

### Models

| Use case | Model | Notes |
|----------|--------|------|
| Chat, title generation, tagging, image-prompt generation | `gemini-3-pro-preview` (default) | Via `generateContent` (REST) or `@google/generative-ai` SDK; overridable with `GEMINI_TEXT_MODEL` |
| Image generation | `gemini-3-pro-image-preview` (default) | Overridable with `GEMINI_IMAGE_MODEL`; falls back to model detection when unavailable |

Image generation uses the Gemini Developer API (generativelanguage.googleapis.com). Imagen (`imagen-*`) is not used here (Vertex-only).

### Backend usage

- **Chat:** `api/chat.js` builds a message list, sends it to Gemini with a system prompt that enforces a **strict JSON schema** (reply, title, summary, tags, followUpQuestions, mindmap with root/branches/relations). Response is parsed with `safeParseGeminiJson()` (extract first `{...}`, fallback title on parse failure).
- **Diagram:** A second Gemini call with `MINDMAP_PROMPT` takes the structured understanding and returns JSON with `diagramType` (`mindmap` | `graph` | `flowchart`), `title`, `summary`, `mermaidCode`. Mermaid is rendered in the frontend.
- **Image:** An `IMAGE_PROMPT` call returns JSON with `imagePrompt` (and title/summary); that prompt is sent to `callGeminiFlashImage()` (REST to `gemini-3-pro-image-preview` or env model) which returns inline base64 image data.
- **Tagging:** `api/supabase.js` uses `gemini-3-pro-preview` for tag suggestions.

### Error handling and retries

- **Retries:** `retryWithBackoff(fn, 3, 1000)` retries on 429, 503, ECONNRESET, timeout/ETIMEDOUT with exponential backoff + jitter; other errors are thrown immediately.
- **Parsing:** Malformed or non-JSON Gemini output is handled by `safeParseGeminiJson()` with a fallback title and defensive extraction of a single JSON object.

---

## Architecture

- **Frontend:** React (TypeScript) SPA, Vite, Tailwind; talks to backend via relative `/api/*` URLs.
- **Backend:** Node.js serverless functions on Vercel; each file under `api/` is a serverless handler (e.g. `api/chat.js`, `api/history.js`, `api/community.js`, `api/archive.js`).
- **Database / storage:** Supabase (PostgreSQL + Storage). Tables include profiles, chat_history, community_posts, archives, etc.; storage for images/artifacts.
- **AI:** Google Gemini API (see [Gemini Integration](#gemini-integration)).

```
                   ┌──────────────────────────────────────────┐
                   │           Vercel (hosting)               │
                   │  ┌────────────┐     ┌─────────────────┐  │
                   │  │   Static   │     │  Serverless     │  │
                   │  │   (Vite    │     │  Functions      │  │
  Browser          │  │   build)   │     │  (api/*.js)     │  │
    │              │  └──────┬─────┘     └────────┬────────┘  │
    │  /api/* ────────────────────────────────────┤           │
    └──────────────│  React SPA (/)               │           │
                   └──────────────────────────────┼───────────┘
                                                  │
                    ┌─────────────────────────────┼─────────────────────────────┐
                    │                             │                             │
                    ▼                             ▼                             ▼
            ┌───────────────┐             ┌───────────────┐             ┌───────────────┐
            │   Supabase    │             │  Gemini API   │             │   Supabase    │
            │  (PostgreSQL) │             │ chat, diagram │             │   (Storage)   │
            │  profiles,    │             │ image         │             │   artifacts   │
            │  history,     │             │               │             │   images      │
            │  community    │             └───────────────┘             └───────────────┘
            └───────────────┘
```

---

## Tech Stack

| Layer | Technologies |
|-------|----------------|
| **Frontend** | React 18, TypeScript, Vite 6, Tailwind CSS, Radix UI, Mermaid, Motion, Recharts |
| **Backend** | Node.js (ESM), Vercel Serverless Functions |
| **Database** | Supabase (PostgreSQL) |
| **Storage** | Supabase Storage |
| **AI** | Google Gemini API (`@google/generative-ai`, REST for image) |
| **Deployment** | Vercel |

---

## Project Structure

```
├── api/                    # Vercel serverless handlers
│   ├── chat.js             # Chat, diagram (mindmap/graph/flowchart), image (Gemini); sessions
│   ├── history.js          # Chat history CRUD; publish to community
│   ├── history/[id].js     # Single history item, publish action
│   ├── community.js        # Posts, discover, like, bookmark, follow
│   ├── profile.js          # User profile
│   ├── archive.js          # Save/load artifacts by session
│   ├── health.js           # Health check
│   ├── supabase.js         # Supabase client, getActor (user/guest), tagging (Gemini)
│   └── index.js            # Fallback router for /api
├── src/
│   ├── components/         # Pages and UI (ChatPage, HistoryPage, CommunityPage, etc.)
│   ├── lib/                # api.ts (API client), chatStore, guest.ts
│   ├── App.tsx, main.tsx
│   └── index.css, styles/
├── supabase/               # SQL migrations, seed, cleanup scripts, migrate-data.js
├── index.html
├── vite.config.ts
├── vercel.json             # SPA rewrite; /api and /assets excluded
└── package.json
```

---

## Local Development

### Environment variables

Create `.env.local` in the project root (see `.env.example` if present). Required for full functionality:

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL (frontend) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (frontend) |
| `SUPABASE_URL` | Supabase project URL (serverless) |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (serverless) |
| `GEMINI_API_KEY` | Gemini API key (chat, diagram, image, tagging) |

Optional: `GEMINI_TEXT_MODEL` — override text model (default `gemini-3-pro-preview`). `GEMINI_IMAGE_MODEL` — override image model (default `gemini-3-pro-image-preview`).

### Install and run

```bash
npm install
npm run dev
```

- **Frontend:** Dev server runs (default port in `vite.config.ts`). All `/api/*` requests must hit a backend; locally that is either:
  - **Deployed backend:** Use Vercel dev or a deployed app and proxy `/api` to it, or
  - **Local API stub:** Run `node local-dev-server.js` (serves a subset of API on port 3001) and ensure Vite proxy sends `/api` to `http://localhost:3001` (see `vite.config.ts`).
- **Backend:** Full API runs on Vercel when deployed. For local backend testing, use `node local-dev-server.js` or deploy to Vercel.

```bash
npm run build          # Production build
npm run preview        # Preview production build
npm run cleanup-storage # Run supabase/cleanup-storage-before-today.js
```

---

## Documentation

- **[DOCS.md](DOCS.md)** — Full API reference, Gemini integration details, testing guide, storage setup, troubleshooting.
- **[DEPLOYMENT.md](DEPLOYMENT.md)** — Supabase + Vercel setup, environment variables, team workflow, deployment troubleshooting.

---

## Future Work

- Auth (e.g. Supabase Auth) alongside guest mode
- Rate limiting and quotas for Gemini and publish
- Automated tests (API handlers and critical flows)
- Community discovery (tags, search, moderation)
- Voice-to-text pipeline and accessibility for generated visuals
