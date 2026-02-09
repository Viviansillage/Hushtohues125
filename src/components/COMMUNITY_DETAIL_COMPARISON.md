# CommunityDetailPage: Legacy vs Current

## 1. Core Differences (cannot mix)

| Item | Legacy (CommunityDetailPage.old.tsx) | Current (CommunityDetailPage.tsx) |
|------|-------------------------------------|-----------------------------------|
| **Page meaning** | **Community detail page**: shows post list + sidebar for a community | **Post detail page**: shows full canvas of a single post |
| **Entry** | From Following → click community (pass `communityName`) | From Discover or community feed → click post (pass `postId`) |
| **Props** | `communityName: string`, `onBack` | `postId: string`, `onBack` |
| **API** | `getCommunityDetail(communityName)` returns `{ joined, detail: { members, online, posts[] } }` | `getCommunityDetail(postId)` returns single post canvas (title, images, mindmaps, content, author, stats…) |
| **Backend** | Needs endpoint to return members + online + post list by community name | Current only has endpoint to return single post by postId |

## 2. Legacy Content Removed (UI)

- **Back to Communities** button
- **Community header**: `#` icon + name + X Members + X Online + Follow/Unfollow button
- **Latest Discussions** title + "Filter by"
- **Post list**: each with avatar, author, time, content, tags, like/comment (clickable like)
- **Sidebar About Community**: description + Created Jan 2025 + English
- **Sidebar Trending Topics**: static list e.g. #Beginner Guide, #Showcase, #Weekly Challenge

## 3. Current Logic (must not break)

- **Discover → click card** → `handleNavigateToCommunity(post.id)` → `CommunityDetailPage` receives **postId** → must show **single post canvas** (current impl).
- **Following → click community** → `handleEnterCommunity(community)` → `CommunityFeedPage` receives **community** → shows that community's **post list** (implemented).

If legacy is restored as `CommunityDetailPage`:
- Component would expect `communityName` and legacy API `posts[]`;
- App passes `postId` when "click post", would error or white screen;
- Backend no longer has "return community detail by communityName" endpoint.

## 4. Conclusion and Restoration

- **Do not** replace current `CommunityDetailPage.tsx` with legacy, or "click post to see canvas" will break.
- **Community detail** is now handled by **CommunityFeedPage** (from Following), using `getDiscoverFeed(communityName)` + `community.stats`.
- To match legacy "community detail" UI, **only change CommunityFeedPage**: copy text, layout, and styles from legacy (Back to Communities, Join/Unfollow, About Community, Trending Topics etc.), keep existing API.
- **CommunityDetailPage.old.tsx** can be kept as reference or deleted; do not use as current CommunityDetailPage.
