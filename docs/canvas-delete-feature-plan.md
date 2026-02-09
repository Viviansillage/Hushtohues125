# Canvas Element Delete Feature - Change Plan (Draft)

> Discussion draft; confirm before implementing.

---

## 1. Main Requirements: Delete Entry and Delete Semantics

1. **Delete entry**: On each canvas element (image / text / mindmap) hover, show a black "X" button top-right (similar to resize handle), click to delete that element.

2. **Delete semantics**:
   - Remove the element from `content_json.items` (remove from canvas item list only).
   - **If element came from Chat Save** (has `messageId`): also remove that `messageId` from `content_json.savedMessages`, so Chat shows it as "unsaved" and it can be saved again.
   - **Pure summary / no messageId item**: just remove from items.
   - **Image / Mindmap**: **Do not delete the image/data itself**—only remove "this item on canvas"; underlying data stays in `content_json.artifacts`. If conversation is still loaded, message becomes saveable again; if conversation was refreshed, can't save again (expected).

3. **Don't change title**: Deleting anything (including what was used for title) does not change title; title is set on first creation or manual edit only.

4. **Card preview**: The "list" here is the **archive canvas card list** (not chat message list). Deleting only affects canvas content, not chat history. Card preview text = first text in current items; if first is deleted, show new first; **if all text is deleted, show empty** (no fallback to DB last_message).

---

## 2. All Canvas/Archive Content Usage (Audit)

**Note**: "List" in the table = **archive canvas card page** (each row is one canvas card), not chat message list. Delete affects only canvas content, not chat history.

| Usage | Location | Data used | Impact / conclusion |
|-------|----------|-----------|---------------------|
| **List visibility** | `api/history.js` `hasArchiveContent` | `content_json.items`, `content_json.artifacts` | Show if `items.length>0 \|\| artifacts.length>0`. Delete only changes items, not artifacts. | No change |
| **Card preview text** | `api/history.js` list | Canvas card preview line. Currently `lastMessage: firstText \|\| item.last_message`. **Convention**: if all text deleted, show empty, no last_message fallback. | This plan (remove last_message fallback) |
| **Card cover image** | `api/history.js` deriveCoverImage, derivePreviewImages | `preview_images[0]` or first image in `content_json.items` | Plan: Save recalculates `preview_images` from current items. | This plan |
| **Chat saved marker** | `src/ChatPage.tsx`, `api/archive.js` | `content_json.savedMessages` | When deleting item with messageId, remove from savedMessages, persist on Save; Chat shows unsaved. | This plan |
| **Publish tag/category** | `api/history.js` PATCH, `api/community.js` publish | `extractCanvasText(contentJson, title)` | If all text deleted, no content. Plan: use image/mindmap title; empty = 400, can't publish. | This plan |
| **Publish cover** | `api/history.js` PATCH publish to community_posts | `deriveCoverImage(data)` | Save recalculates preview_images; publish uses same source. | Same as Save |
| **Canvas render** | `src/CanvasDetail.tsx` | `contentJson.items` init canvas | After delete, fewer items, render updates. | No change |
| **Canvas min height** | `src/CanvasDetail.tsx` | `calculatedMinHeight` for scroll area minHeight | Based on items: iterate items, bottom = y+height, max + padding; empty items = 2000. | This plan |
| **Print / Share** | `src/CanvasDetail.tsx` | Current DOM / archive id | Prints/shares current state. | No change |
| **Community detail** | `api/community.js` | Full `content_json`, `content_json.artifacts` | Pass contentJson to frontend; artifacts form images/mindmaps. | No change |
| **Archive detail** | `api/history/[id].js`, HistoryPage | `content_json`, `artifacts` | Detail uses contentJson.items; images/mindmaps from artifacts. Delete doesn't remove artifacts. | No change |
| **Archive saveMessage** | `api/archive.js` | `content_json.items`, `savedMessages`, `artifacts` | Save appends items, savedMessages, artifacts. Delete is on Canvas side. | No change |

---

## 3. Affected Areas Summary

| Module | Impact | Conclusion |
|--------|--------|------------|
| **Title** | Delete affects title content | Don't change title on delete; only first gen or user edit. | No change |
| **Card preview (lastMessage)** | Show first text; empty if none | Use only `deriveFirstTextPreview()` as `lastMessage`, no DB `last_message` fallback. | This plan |
| **Chat saved state** | After delete, must show unsaved | Remove messageId from savedMessages on delete, persist on Save. | Canvas maintains savedMessages, write on Save |
| **Export / Print / Share** | Use current items | Delete updates items, naturally effective. | No change |
| **Community publish** | Use current content_json | Delete updates content_json. | No change |
| **preview_images (cover)** | Cover = current first image | Save recalculates from items (type==='image' content order); no image = empty array. | This plan |
| **content_json.artifacts** | Delete item, don't delete image/data | Don't delete artifacts on delete; only remove from items and savedMessages. | Don't delete artifacts |
| **Publish tag/category** | No text after delete | Use image/diagram title; empty = can't publish. | This plan |

---

## 4. Publish (Public): Tag/Category and "Cannot Publish" Message

**Issue**: If all canvas text is deleted, publish tag/category relies on `extractCanvasText`; no text means no tags/category.

**Convention**:

1. **When image/diagram remain**: Use their **title** for tag/category.
2. **When nothing remains**: Return 400, "Cannot publish". Message in **English**, e.g. `"Cannot publish: the canvas has no text or image/mindmap titles to generate tags and category. Please add some content before publishing."`

**Implementation**:
- **extractCanvasText** (supabase.js): Add image `item.meta?.title` collection.
- **archive.js**: In saveMessage, add `meta: { title }` for image items when artifact has data.title.
- **Publish** (history.js PATCH + community.js publish): Call `extractCanvasText`; if empty, return 400 with English message.

---

## 5. Implementation (Minimal Invasive)

### 1. Data: Add optional `messageId` to item
- For delete: know which id to remove from savedMessages.
- Frontend: `DraggableItem` add `messageId?: string`.
- Backend: archive.js saveMessage adds `messageId` to all new items.

### 2. Canvas: Delete UI + local state
- Delete button: black X on hover top-right in DraggableCanvasItemCard; only when not readOnly.
- handleDeleteItem: remove from items; if messageId exists, remove from savedMessages.
- savedMessages: state, init from contentJson?.savedMessages ?? []; write to content_json on Save.

### 3. Cover (preview_images) aligned with Save
- handleSave: `previewImages = items.filter(i=>i.type==='image').map(i=>i.content)`.
- PATCH: only write when body.previewImages !== undefined.

### 4. Backend: saveMessage item has messageId + image has meta.title
- All new items get messageId.
- Image item with data.title gets meta: { title }.

### 5. Publish text: extractCanvasText includes image title; empty = 400
- extractCanvasText: add image item.meta?.title.
- Publish: if extractCanvasText empty, return 400.

### 6. Card preview: no text = empty (no last_message fallback)
- history.js list: `lastMessage = deriveFirstTextPreview(item) || ''`.

### 7. Canvas min height: from items bottom
- calculatedMinHeight: iterate items, bottom = y+height, max + padding; empty = 2000.

---

## 6. Legacy Fallback

| Field / case | May be missing | Fallback |
|--------------|----------------|----------|
| item.messageId | Old item has none | Delete: only remove from savedMessages if messageId exists. |
| item.meta (image) | Old image has no meta | extractCanvasText: use item.meta?.title, skip if none. |
| content_json.savedMessages | Old archive has none | Init: `?? []`. Save: write current. Backend: `|| []`. |
| body.previewImages | Not passed | Only write when !== undefined. |
| lastMessage | Old has item.last_message | Use deriveFirstTextPreview only, no fallback. |
| calculatedMinHeight | Empty items; height auto | Empty: 2000. Auto/missing: 120. |
| Publish 400 | - | Message in English. |

---

## 7. No Changes

- **Title**: Not recalculated on delete.
- **content_json.artifacts**: Not deleted on item delete.
- **onClose**: Still refetch archive and update list with detail.title.

---

## 8. Files and Changes

| File | Changes |
|------|---------|
| `src/components/CanvasDetail.tsx` | Add messageId; savedMessages state; handleDeleteItem + delete UI; handleSave previewImages; calculatedMinHeight from items. |
| `api/archive.js` | All new items get messageId; image items get meta.title. |
| `api/history.js` | PATCH preview_images when !== undefined; isPublic empty extractCanvasText = 400; list lastMessage from deriveFirstTextPreview only. |
| `api/community.js` | Publish empty extractCanvasText = 400. |
| `api/supabase.js` | extractCanvasText add image item.meta?.title. |
| `src/lib/api.ts` | updateHistoryItem supports previewImages. |

---

## 9. Acceptance

1. Hover any canvas element, black X appears, click removes element.
2. Delete from Chat save, Save, open Chat: message unsaved, can save again.
3. Delete doesn't change title; card preview = first text, empty if none.
4. Read-only: no delete X.
5. Legacy (no messageId): delete from items only, no error.
6. Cover: After Save, cover = first image; delete first, Save, cover = next or empty.
7. Publish: no text + no title image/mindmap = 400, English message.
8. Canvas min height: from items bottom + padding.

Confirm plan before implementation.
