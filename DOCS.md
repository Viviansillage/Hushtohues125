# 📚 Development Documentation

Complete API documentation, testing guides, and development notes for Hush to Hues.

---

## 📑 Table of Contents

1. [API Reference](#api-reference)
2. [Gemini Integration](#gemini-integration)
3. [Testing Guide](#testing-guide)
4. [Storage Setup](#storage-setup)
5. [Troubleshooting](#troubleshooting)

---

## 🔌 API Reference

### Authentication

All requests require the `X-Guest-ID` header:

```http
Content-Type: application/json
X-Guest-ID: guest-xxxxx-xxxxx
```

**Actor Types:**
- `guest` - Temporary visitor (7-day data retention)
- `user` - Registered user (permanent storage, future)

### Endpoints

#### 1. Chat API

**POST /api/chat?action=message**

Send message and get AI response.

```json
// Request
{
  "messages": [
    { "role": "user", "content": "Help me plan a morning routine" }
  ],
  "sessionId": "session-uuid"
}

// Response
{
  "message": {
    "id": "msg-uuid",
    "text": "Great idea! Let me help you organize...",
    "sender": "bot",
    "timestamp": "2026-01-31T10:00:00Z"
  }
}
```

**POST /api/chat?action=artifact**

Generate diagram (mindmap / graph / flowchart), image, or save to archive.

```json
// Request
{
  "kind": "image",  // "mindmap" | "image" | "save"
  "messages": [...],
  "sessionId": "session-uuid"
}

// Response (Image)
{
  "message": {
    "text": "Generated image: A serene morning landscape...",
    "artifact": {
      "type": "image",
      "data": {
        "imageUrl": "https://...supabase.co/storage/.../image.png",
        "storagePath": "artifacts/2026/01/xxx.png",
        "imagePrompt": "Peaceful morning scene...",
        "provider": "gemini",
        "model": "gemini-3-pro-image-preview"
      }
    }
  },
  "generatedImage": { ... }
}

// Response (Mindmap)
{
  "structuredMindmap": {
    "mermaidCode": "mindmap\n  root((Morning Routine))\n    ...",
    "jsonData": {
      "root": "Morning Routine",
      "branches": [...]
    }
  }
}
```

#### 2. Profile API

**GET /api/profile**

Get user/guest profile.

```json
// Response (Guest)
{
  "userName": "Guest-abc123",
  "userHandle": "@guest_abc123",
  "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=...",
  "preferences": {},
  "isGuest": true
}
```

#### 3. History/Archive API

**GET /api/history**

Get saved sessions.

```json
// Response
[
  {
    "id": "uuid",
    "title": "My First Chat",
    "messageCount": 10,
    "lastMessage": "This was great...",
    "previewImages": ["https://..."],
    "isPublic": false,
    "tags": ["mindfulness"],
    "timestamp": "2026-01-29T10:30:00Z",
    "isDemo": true  // Guest sessions
  }
]
```

**POST /api/history**

Save session to archive.

```json
// Request
{
  "title": "Morning Routine Chat",
  "content": "Full chat content...",
  "messages": [...],
  "tags": ["wellness", "routine"],
  "previewImages": ["https://..."]
}

// Response
{
  "id": "uuid",
  "title": "Morning Routine Chat",
  "timestamp": "2026-01-31T10:00:00Z",
  "isDemo": true
}
```

**Rules:**
- Guest: `is_demo=true`, expires after 7 days
- User: `is_demo=false`, permanent

#### 4. Community API

**GET /api/community?discover=true**

Get community posts (seed content + user posts).

```json
// Response
[
  {
    "id": "uuid",
    "title": "Mindful Morning Routines",
    "author": {
      "name": "Emma Chen",
      "id": "seed-profile-uuid",
      "type": "seed"
    },
    "imageUrl": "https://...",
    "content": "For the past 6 months...",
    "summary": "Discovered how 10 minutes...",
    "likes": 127,
    "comments": 23,
    "timestamp": "2026-01-15T08:00:00Z",
    "tags": ["meditation"],
    "communityName": "Mindfulness"
  }
]
```

#### 5. Archive API (Save to Canvas)

One archive per session; saving a message or artifact appends to that session’s `content_json`.

**`content_json` shape:**
- `items` — Canvas elements (image, text, diagram blocks with position/size).
- `savedMessages` — Array of message IDs already saved to the canvas.
- `artifacts` — Saved artifact entries (image/mindmap).
- `sessionId` — Session id.

**POST /api/archive?action=saveMessage**

Save a single message (with or without artifact) to the canvas.

```json
// Request
{ "sessionId": "session-xyz", "messageId": "msg-123", "messageText": "...", "artifact": { "type": "image", "data": { ... } } }
// Response
{ "ok": true, "archiveId": "uuid", "messageId": "msg-123", "itemsAdded": 2 }
```

**GET /api/archive?action=getSavedMessages&sessionId=xxx**

Return list of message IDs already saved for the session.

```json
// Response
{ "ok": true, "savedMessages": ["msg-123", "msg-456"] }
```

Backend deduplicates by `messageId`; frontend shows "✓ Saved" and disables the Save button for those messages.

#### 6. Debug Endpoints

**GET /api/debug/models**

List all available Gemini models.

**GET /api/chat?action=diagnostics**

Check image generation setup status.

---

## 🤖 Gemini Integration

### Features using Gemini API

| Feature | Description | Model | Code location |
|---------|-------------|-------|---------------|
| **Process conversations and extract logic** | Parse user input, clarify meaning, return structured JSON (reply, title, summary, tags, follow-up questions, mindmap skeleton) | `gemini-3-pro-preview` | `api/chat.js` → `callGemini` |
| **Generate images and diagrams** | Mermaid diagrams (mindmap / graph / flowchart) from conversation; AI images from generated prompts | Diagram: `gemini-3-pro-preview`; Image: `gemini-3-pro-image-preview` | `api/chat.js` → `callGemini` (MINDMAP_PROMPT), `callGeminiFlashImage` |
| **Auto-extract tags from canvas text** | Suggest semantic tags when saving or editing canvas content | `gemini-3-pro-preview` | `api/supabase.js` → `generateSemanticTags` |
| **Intelligently classify content into communities** | Assign canvas content to one of 7 fixed community categories (Entertainment, Music, Games, Creative, Technology, Lifestyle, Business) when publishing | `gemini-3-pro-preview` | `api/supabase.js` → `classifyCommunityCategory` |

### Models Used

- **Chat, title, tagging, diagram prompt**: `gemini-3-pro-preview` - Conversation and structured JSON (overridable via `GEMINI_TEXT_MODEL`)
- **Image generation**: `gemini-3-pro-image-preview` - Image generation (overridable via `GEMINI_IMAGE_MODEL`)

### Chat Configuration

**System Instruction:**
```
You are Hush to Hues AI assistant.
Help users transform chaotic ideas into clear, organized expressions.
Output formats: mindmaps, summaries, creative prompts, social posts.
```

**JSON Response Format:**
```json
{
  "reply": "Conversational response...",
  "title": "Concise title (max 10 words)",
  "summary": "2-3 sentence summary",
  "tags": ["tag1", "tag2", "tag3"],
  "mindmap": {
    "root": "Main Topic",
    "branches": [
      {
        "label": "Branch Name",
        "children": ["Subtopic 1", "Subtopic 2"]
      }
    ]
  }
}
```

**API Configuration:**
```javascript
{
  systemInstruction: {
    parts: [{ text: "You are Hush to Hues AI..." }]
  },
  generationConfig: {
    responseMimeType: 'application/json',
    responseSchema: { ... },
    temperature: 0.7,
    topK: 40,
    topP: 0.95
  }
}
```

### Image Generation

**Critical Configuration:**
```javascript
// ✅ CORRECT
{
  generationConfig: {
    responseModalities: ['TEXT', 'IMAGE']  // Must include both!
  }
}

// ❌ WRONG
{
  generationConfig: {
    responseModalities: ['IMAGE']  // Missing TEXT causes errors
  }
}
```

**Response Structure:**
```javascript
{
  candidates: [{
    content: {
      parts: [
        { text: "I've created an image of..." },
        { 
          inlineData: {
            mimeType: "image/png",
            data: "base64EncodedImageData..."
          }
        }
      ]
    }
  }]
}
```

**Storage Pipeline:**
```
1. Extract base64 from Gemini response
2. Convert to Buffer
3. Upload to Supabase Storage bucket "artifacts"
4. Return public URL (not base64)
5. Save URL to database
```

---

## 🧪 Testing Guide

### Local Image API Testing

Before deploying, test image generation locally.

#### Setup

**Windows PowerShell:**
```powershell
$env:GEMINI_API_KEY="AIza..."
node test-image-api.js
```

**Linux/Mac:**
```bash
export GEMINI_API_KEY="AIza..."
node test-image-api.js
```

#### What It Tests

1. **Model Discovery** - Lists all available Gemini models
2. **Image Generation** - Tests 3 configurations:
   - Config A: `['TEXT', 'IMAGE']` ✅ Recommended
   - Config B: `['IMAGE']` ❌ Usually fails
   - Config C: No modalities (default behavior)

#### Success Output

```
✅ Image found!
   - Part 0: image/png, 245678 bytes
   Data URL length: 327570 characters
   ✅ This config works!
```

#### Failure Output

```
❌ Image not found
   Returned text:
   - Part 0: "I cannot generate images..."
```

### Production Diagnostics

After deployment, check these endpoints:

```bash
# Quick diagnostics
curl https://your-app.vercel.app/api/chat?action=diagnostics

# Full model list
curl https://your-app.vercel.app/api/debug/models
```

---

## 💾 Storage Setup

### Supabase Storage

**Create Bucket:**

1. Go to Supabase Dashboard → Storage
2. Create new bucket: `artifacts`
3. Set as **Public** (allow public URL access)
4. File size limit: 50MB recommended

**Path Structure:**
```
artifacts/
  └── 2026/
      └── 01/
          ├── 1738312345678-abc123.png
          ├── 1738312456789-def456.png
          └── ...
```

**Upload Function:**
```javascript
// api/supabase.js
export async function uploadImageToStorage(base64Data, mimeType, metadata) {
  const buffer = Buffer.from(base64Data, 'base64');
  const fileName = `${timestamp}-${random}.${ext}`;
  const storagePath = `artifacts/${year}/${month}/${fileName}`;
  
  await supabase.storage
    .from('artifacts')
    .upload(storagePath, buffer, {
      contentType: mimeType,
      metadata: { prompt, sessionId, actorType, actorId, createdAt }
    });
  
  const { publicUrl } = supabase.storage
    .from('artifacts')
    .getPublicUrl(storagePath);
  
  return { publicUrl, storagePath };
}
```

### LocalStorage Management

**Sanitization:**
```javascript
// src/lib/guest.ts
export function sanitizeMessagesForLocalStorage(messages) {
  return messages.map(msg => {
    // Remove dangerous fields
    const dangerousFields = [
      'imageBase64', 'inlineData', 'dataUrl',
      'rawImage', 'bytes', 'bytesBase64Encoded'
    ];
    
    dangerousFields.forEach(field => delete msg[field]);
    
    // Remove data URLs from artifacts
    if (msg.artifact?.data?.imageUrl?.startsWith('data:')) {
      msg.artifact.data.imageUrl = null;
    }
    
    return msg;
  });
}
```

**Error Handling:**
```javascript
// QuotaExceededError handling
try {
  const sanitized = sanitizeMessagesForLocalStorage(messages);
  localStorage.setItem(key, JSON.stringify(sanitized));
} catch (error) {
  if (error.name === 'QuotaExceededError') {
    // Auto-cleanup old sessions
    // Retry save
    toast.info('Local cache full; messages saved to cloud');
  }
}
```

---

## 🔧 Troubleshooting

### Image Generation Issues

**Problem: "No image data returned from Gemini Flash"**

**Solution:**
1. Check `responseModalities: ['TEXT', 'IMAGE']` (must include both)
2. Test locally: `node test-image-api.js`
3. Verify API key has image permissions
4. Check account billing enabled

**Problem: QuotaExceededError in localStorage**

**Solution:**
1. Images now uploaded to Supabase Storage (not localStorage)
2. Only URLs stored locally (~50 bytes vs ~500KB)
3. Auto-cleanup of old sessions on quota error

### Supabase Issues

**Problem: Upload fails with 401/403**

**Cause:** `SUPABASE_SERVICE_KEY` missing or incorrect

**Solution:**
1. Check `.env.local` has `SUPABASE_SERVICE_KEY` (not `SUPABASE_ANON_KEY`)
2. Verify key in Supabase Dashboard → Settings → API
3. Ensure bucket `artifacts` is public

**Problem: Images uploaded but 404 on access**

**Cause:** Bucket not set to public

**Solution:**
1. Dashboard → Storage → `artifacts` bucket
2. Settings → Make Public
3. Regenerate public URL

### API Errors

**Problem: 500 Internal Server Error on /api/chat**

**Check:**
```bash
# Vercel logs
vercel logs --follow

# Look for:
# - "GEMINI_API_KEY is not configured"
# - "Failed to call Gemini API"
# - "[Storage] Upload failed"
```

**Common Causes:**
1. Missing environment variables
2. Gemini API quota exceeded
3. Supabase connection timeout
4. Invalid JSON schema in system prompt

---

## 📝 Development Notes

### Environment Variables

**Required:**
```bash
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGci...  # NOT anon key!
GEMINI_API_KEY=AIza...
```

**Optional:**
```bash
GEMINI_TEXT_MODEL=gemini-3-pro-preview      # Default for text
GEMINI_IMAGE_MODEL=gemini-3-pro-image-preview  # Default for image
NODE_ENV=production
```

### Data Retention

- **Guest sessions**: 7 days (`expires_at` set automatically)
- **Guest artifacts**: 7 days cleanup job (manual for now)
- **User data**: Permanent (no `expires_at`)

### Rate Limits

- **Gemini API**: 60 requests/minute (free tier)
- **Supabase**: 2GB transfer/month (free tier)
- **Vercel**: 100GB bandwidth/month (hobby tier)

### Best Practices

1. **Always test locally** before deploying image changes
2. **Use diagnostics endpoints** for production debugging
3. **Monitor Supabase Storage** size (quota limits)
4. **Clean localStorage** on major updates (prevent stale data)
5. **Check Vercel logs** for server-side errors

---

## 🎯 Quick Reference

### Common Commands

```bash
# Local testing
npm run dev                    # Frontend (port 5173)
node test-image-api.js        # Image API test

# Build
npm run build                 # Production build
npm run preview               # Preview build locally

# Deploy
git push                      # Auto-deploy to Vercel (if connected)
vercel --prod                # Manual deploy
```

### Important Files

- `api/chat.js` - Chat + Artifact generation
- `api/supabase.js` - Database + Storage utilities
- `src/lib/api.ts` - Frontend API client
- `src/lib/guest.ts` - Guest ID + localStorage management
- `supabase/reset-database.sql` - Database schema (creates all tables); see `supabase/README.md` for run order
- `test-image-api.js` - Local image testing script

### Support Resources

- **Gemini API Docs**: https://ai.google.dev/gemini-api/docs
- **Supabase Docs**: https://supabase.com/docs
- **Vercel Docs**: https://vercel.com/docs
- **Project Issues**: Check Git commit history for fixes

---

**Last Updated**: 2026-01-31  
**Version**: 2.0 (Gemini Image + Supabase Storage integration)
