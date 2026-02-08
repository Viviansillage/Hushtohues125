# CommunityDetailPage 旧版 vs 当前版 对比

## 1. 核心区别（不能混用）

| 项目 | 旧版 (CommunityDetailPage.old.tsx) | 当前版 (CommunityDetailPage.tsx) |
|------|-------------------------------------|-----------------------------------|
| **页面含义** | **分区详情页**：展示「某个分区」下的帖子列表 + 侧栏 | **帖子详情页**：展示「某一条帖子」的 canvas 全文 |
| **入口** | 从 Following 点进某个分区（传 `communityName`） | 从 Discover 或分区 feed 点进某条帖子（传 `postId`） |
| **Props** | `communityName: string`, `onBack` | `postId: string`, `onBack` |
| **API** | `getCommunityDetail(communityName)`，期望返回 `{ joined, detail: { members, online, posts[] } }` | `getCommunityDetail(postId)`，返回单条帖子的 canvas（title, images, mindmaps, content, author, stats…） |
| **后端** | 需要「按分区名返回 members + online + 帖子列表」的接口 | 当前只有「按 postId 返回单帖详情」的接口 |

## 2. 旧版被删掉的内容（UI）

- **Back to Communities** 按钮
- **分区头**：`#` 图标 + 分区名 + X Members + X Online + Follow/Unfollow 按钮
- **Latest Discussions** 标题 + 「Filter by」
- **帖子列表**：每条有头像、作者、时间、content 文案、tags、点赞/评论（可点击 like）
- **侧栏 About Community**：一段描述 + Created Jan 2025 + English
- **侧栏 Trending Topics**：静态列表如 #Beginner Guide, #Showcase, #Weekly Challenge

## 3. 当前逻辑（不能破坏）

- **Discover 点卡片** → `handleNavigateToCommunity(post.id)` → `CommunityDetailPage` 传 **postId** → 必须显示**单条帖子的 canvas**（当前实现）。
- **Following 点分区** → `handleEnterCommunity(community)` → `CommunityFeedPage` 传 **community** → 显示该分区的**帖子列表**（已实现）。

若把旧版直接恢复成 `CommunityDetailPage`：
- 组件会期望 `communityName` 和旧 API 返回的 `posts[]`；
- App 在「点帖子」时传的是 `postId`，会报错或白屏；
- 且后端已无「按 communityName 返回分区详情」的接口。

## 4. 结论与恢复方式

- **不要**用旧版替换当前的 `CommunityDetailPage.tsx`，否则「点帖子看 canvas」会坏掉。
- **分区详情**已经由 **CommunityFeedPage** 承担（从 Following 进入），数据用 `getDiscoverFeed(communityName)` + `community.stats`。
- 若要让「分区详情」的界面和旧版一致，应**只改 CommunityFeedPage**：把旧版里的文案、布局、样式抄过去（Back to Communities、Join/Unfollow、About Community、Trending Topics 等），数据仍用现有 API。  
- **CommunityDetailPage.old.tsx** 可保留作参考或删除，不要作为当前的 CommunityDetailPage 使用。
