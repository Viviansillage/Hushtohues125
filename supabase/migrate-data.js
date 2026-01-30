import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// 加载 .env.local 文件
dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 错误：请在 .env.local 中配置 SUPABASE_URL 和 SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function clearDatabase() {
  console.log('🗑️  清空现有数据...\n');
  
  try {
    // 按依赖关系倒序删除
    const tables = [
      'user_bookmarks',
      'user_likes', 
      'user_followed_communities',
      'community_posts',
      'community_tags',
      'chat_history',
      'profiles'
    ];
    
    for (const table of tables) {
      const { error } = await supabase
        .from(table)
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      
      if (error) {
        console.log(`⚠️  清空 ${table} 表失败（可能是空表）:`, error.message);
      }
    }
    
    console.log('✅ 数据库已清空\n');
  } catch (error) {
    console.error('❌ 清空数据库失败:', error);
    throw error;
  }
}

async function migrateData() {
  try {
    console.log('🚀 开始迁移数据...\n');

    // 先清空数据库
    await clearDatabase();

    // 读取 db.json
    const dbPath = join(__dirname, '..', 'server', 'db.json');
    const dbData = JSON.parse(readFileSync(dbPath, 'utf-8'));

    // 1. 迁移用户配置
    console.log('📝 迁移用户配置...');
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .insert({
        user_name: dbData.profile.userName,
        user_handle: dbData.profile.userHandle,
        avatar: dbData.profile.avatar,
        preferences: dbData.profile.preferences
      })
      .select()
      .single();

    if (profileError) {
      console.error('❌ 用户配置迁移失败:', profileError.message);
      return;
    }
    console.log('✅ 用户配置已迁移\n');

    const profileId = profile.id;

    // 2. 迁移聊天历史
    console.log('📝 迁移聊天历史...');
    for (const item of dbData.history) {
      const { error } = await supabase
        .from('chat_history')
        .insert({
          profile_id: profileId,
          title: item.title,
          message_count: item.messageCount,
          last_message: item.lastMessage,
          preview_images: item.previewImages,
          is_public: item.isPublic,
          tags: item.tags,
          timestamp: item.timestamp
        });

      if (error) {
        console.error(`❌ 历史记录 "${item.title}" 迁移失败:`, error.message);
      }
    }
    console.log(`✅ ${dbData.history.length} 条聊天历史已迁移\n`);

    // 3. 迁移社区标签
    console.log('📝 迁移社区标签...');
    const allTags = [...dbData.community.followed, ...dbData.community.recommended];
    const uniqueTags = Array.from(new Map(allTags.map(tag => [tag.name, tag])).values());
    
    const tagIdMap = {};
    for (const tag of uniqueTags) {
      const { data, error } = await supabase
        .from('community_tags')
        .insert({
          name: tag.name,
          icon: tag.icon,
          color: tag.color,
          member_count: tag.memberCount || 0
        })
        .select()
        .single();

      if (error) {
        console.error(`❌ 标签 "${tag.name}" 迁移失败:`, error.message);
      } else {
        tagIdMap[tag.name] = data.id;
      }
    }
    console.log(`✅ ${uniqueTags.length} 个社区标签已迁移\n`);

    // 4. 迁移关注的社区
    console.log('📝 迁移关注的社区...');
    for (const tagName of dbData.user.followedCommunities) {
      if (tagIdMap[tagName]) {
        const { error } = await supabase
          .from('user_followed_communities')
          .insert({
            profile_id: profileId,
            community_tag_id: tagIdMap[tagName]
          });

        if (error && error.code !== '23505') {
          console.error(`❌ 关注社区 "${tagName}" 失败:`, error.message);
        }
      }
    }
    console.log(`✅ ${dbData.user.followedCommunities.length} 个关注的社区已迁移\n`);

    // 5. 迁移社区帖子
    console.log('📝 迁移社区帖子...');
    const postIdMap = {};
    for (const post of dbData.communityPosts) {
      const { data, error } = await supabase
        .from('community_posts')
        .insert({
          title: post.title,
          author_name: post.author.name,
          image_url: post.imageUrl,
          content: post.content,
          likes: post.likes,
          comments: post.comments,
          tags: post.tags,
          timestamp: post.timestamp
        })
        .select()
        .single();

      if (error) {
        console.error(`❌ 帖子 "${post.title}" 迁移失败:`, error.message);
      } else {
        postIdMap[post.id] = data.id;
      }
    }
    console.log(`✅ ${dbData.communityPosts.length} 个社区帖子已迁移\n`);

    // 6. 迁移点赞记录
    console.log('📝 迁移点赞记录...');
    let likeCount = 0;
    for (const likeId of dbData.user.likes) {
      let targetType, targetId;
      
      if (likeId.includes(':')) {
        const [, oldPostId] = likeId.split(':');
        targetType = 'post';
        targetId = postIdMap[oldPostId];
      } else {
        targetType = 'post';
        targetId = postIdMap[likeId];
      }

      if (targetId) {
        const { error } = await supabase
          .from('user_likes')
          .insert({
            profile_id: profileId,
            target_type: targetType,
            target_id: targetId
          });

        if (error && error.code !== '23505') {
          console.error(`❌ 点赞记录迁移失败:`, error.message);
        } else {
          likeCount++;
        }
      }
    }
    console.log(`✅ ${likeCount} 条点赞记录已迁移\n`);

    // 7. 迁移收藏记录
    console.log('📝 迁移收藏记录...');
    let bookmarkCount = 0;
    for (const oldPostId of dbData.user.bookmarks) {
      const newPostId = postIdMap[oldPostId];
      if (newPostId) {
        const { error } = await supabase
          .from('user_bookmarks')
          .insert({
            profile_id: profileId,
            post_id: newPostId
          });

        if (error && error.code !== '23505') {
          console.error(`❌ 收藏记录迁移失败:`, error.message);
        } else {
          bookmarkCount++;
        }
      }
    }
    console.log(`✅ ${bookmarkCount} 条收藏记录已迁移\n`);

    console.log('🎉 数据迁移完成！');
    console.log('\n下一步：');
    console.log('1. 访问 Supabase Dashboard 验证数据');
    console.log('2. 运行 npm run dev:all 测试应用');
    console.log('3. 部署到 Vercel: vercel --prod');

  } catch (error) {
    console.error('❌ 迁移过程中发生错误:', error);
  }
}

migrateData();
