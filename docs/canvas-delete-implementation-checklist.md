# Canvas Delete Feature - Implementation Checklist

Pre-deployment checklist: verify each plan item against code.

---

## 1. Plan Items vs Implementation

| # | Plan Item | Implementation | Status |
|---|-----------|----------------|--------|
| 1 | Delete entry: hover shows black X top-right, click to delete | `CanvasDetail.tsx`: `DraggableCanvasItemCard` has `<button data-delete-item>`, `onDeleteItem(item)` | ✅ |
| 2 | Remove from items; if messageId exists, remove from savedMessages | `handleDeleteItem`: `setItems` filter; `setSavedMessages` filter when `deletedItem.messageId` exists and non-empty | ✅ |
| 3 | Don't delete artifacts; don't change title | No delete on artifacts; no title change on delete/Save | ✅ |
| 4 | Card preview = first text, empty if none, no last_message fallback | `history.js` list: `lastMessage: (firstText \|\| '').trim()`, `firstText = deriveFirstTextPreview(item)` | ✅ |
| 5 | Save recalculates preview_images (items with type===image, content order) | `CanvasDetail` handleSave: `previewImages = itemsWithRealHeights.filter(i=>i.type==='image').map(i=>i.content)`, passes `updateHistoryItem(..., { previewImages })` | ✅ |
| 6 | PATCH writes preview_images only when body.previewImages !== undefined | `history.js`: `if (body.previewImages !== undefined) updates.preview_images = body.previewImages` | ✅ |
| 7 | savedMessages in state, init from contentJson?.savedMessages ?? [], written to content_json on Save | `CanvasDetail`: `useState(() => item.contentJson?.savedMessages ?? [])`; `updatedContentJson.savedMessages = currentSaved` | ✅ |
| 8 | extractCanvasText adds image item.meta?.title | `supabase.js`: `if (item.type === 'image' && item.meta?.title)` then push cleanTextValue(item.meta.title) | ✅ |
| 9 | Publish returns 400 when canvasText empty, English message | `history.js` PATCH, `community.js` publish: `if (!canvasText \|\| !String(canvasText).trim()) return 400`, message in English | ✅ |
| 10 | saveMessage adds messageId to all new items; image adds meta.title | `archive.js` saveMessage: image/mindmap/summary text/plain text all get `messageId`; image with data.title gets `meta: { title }`; update/create branches also add meta.title for image | ✅ |
| 11 | calculatedMinHeight from items bottom + padding, empty items=2000 | `CanvasDetail`: iterate items for y+height, maxBottom+BOTTOM_PADDING; items.length===0 then DEFAULT_CANVAS_MIN_HEIGHT 2000 | ✅ |
| 12 | Legacy fallback: missing messageId only deletes items; missing savedMessages use []; previewImages not passed don't write; height auto/missing use 120 | See "Legacy fallback" section | ✅ |

---

## 2. Cross-File Naming and Field Consistency

| Data | Frontend → request body | Backend (body) | Backend → DB | Backend → response |
|------|-------------------------|----------------|--------------|--------------------|
| Content JSON | `contentJson` | `body.contentJson` | `content_json` | `contentJson: data.content_json` |
| Preview images | `previewImages` | `body.previewImages` | `preview_images` | `previewImages: data.preview_images \|\| []` |
| Saved message IDs | (in contentJson) | `body.contentJson.savedMessages` | `content_json.savedMessages` | `savedMessages` |
| Item message ref | `messageId` (on item) | - | `content_json.items[].messageId` | - |

- **camelCase** between frontend and API: `contentJson`, `previewImages`, `savedMessages`, `messageId`.
- **snake_case** for DB/Supabase: `content_json`, `preview_images`; inside `content_json` use camelCase for keys.

---

## 3. Critical Call Chain

1. **Canvas Save**  
   `updateHistoryItem(item.id, { title, contentJson: updatedContentJson, previewImages })`  
   → PATCH `/api/history?id=...` with body `contentJson`, `previewImages`  
   → `updates.content_json = body.contentJson`, `updates.preview_images = body.previewImages` (when !== undefined)  
   → Write to DB `content_json`, `preview_images`. ✅

2. **Chat saved state**  
   Chat requests `GET /api/archive?action=getSavedMessages&sessionId=...`  
   → Returns `{ ok: true, savedMessages }` (from `content_json.savedMessages`)  
   → ChatPage uses `archiveData.savedMessages` to mark `msg.saved`. ✅  
   After Canvas delete + Save, `content_json.savedMessages` updates; next Chat load gets new list. ✅

3. **List lastMessage**  
   GET `/api/history` returns `lastMessage: (deriveFirstTextPreview(item) || '').trim()`, no longer uses `item.last_message`. ✅

4. **Publish 400**  
   history.js PATCH (isPublic) and community.js publish both return 400 when `!canvasText || !String(canvasText).trim()`, `error` + `message` in English. ✅

---

## 4. Post-Deploy Verification

1. Open an archive canvas, hover text/image/mindmap, confirm black X appears top-right and deletes.
2. Delete an item, click Save, open corresponding Chat, confirm message becomes unsaved and can be saved again.
3. Delete all text on canvas, check list: card preview should be empty (no old last_message).
4. Delete first image then Save: list/detail cover should show next image or empty.
5. With no text and no image/mindmap with title, try publish: should return 400 with English message.
6. In read-only/preview (e.g. Community detail), delete X should not appear.
7. Legacy data (item without messageId): delete removes from canvas only, no error.

Confirm no issues before going live.
