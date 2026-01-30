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
      } else {
        console.log(`✅ 已清空 ${table}`);
      }
    }
    
    console.log('\n✅ 数据库已清空\n');
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

// =====================================================
// Seed 数据：为 Guest-first Demo 提供高质量内容
// =====================================================
async function seedDemoData() {
  try {
    console.log('\n🌱 开始插入 Seed 数据...\n');

    // 1. 创建 Seed Profiles
    console.log('👤 创建 Seed 用户...');
    const seedProfiles = [
      { user_name: 'Emma Chen', user_handle: '@emma_wisdom', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=emma', is_seed: true, display_name: 'Emma Chen' },
      { user_name: 'Alex Rivera', user_handle: '@alex_creates', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alex', is_seed: true, display_name: 'Alex Rivera' },
      { user_name: 'Jordan Lee', user_handle: '@jordan_reflects', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=jordan', is_seed: true, display_name: 'Jordan Lee' },
      { user_name: 'Sam Taylor', user_handle: '@sam_grows', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=sam', is_seed: true, display_name: 'Sam Taylor' },
      { user_name: 'Riley Morgan', user_handle: '@riley_inspires', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=riley', is_seed: true, display_name: 'Riley Morgan' },
      { user_name: 'Casey Jordan', user_handle: '@casey_explores', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=casey', is_seed: true, display_name: 'Casey Jordan' },
      { user_name: 'Morgan Blake', user_handle: '@morgan_heals', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=morgan', is_seed: true, display_name: 'Morgan Blake' },
      { user_name: 'Taylor Kim', user_handle: '@taylor_dreams', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=taylor', is_seed: true, display_name: 'Taylor Kim' }
    ];

    const seedProfileIds = [];
    for (const profile of seedProfiles) {
      // 先尝试查询是否已存在
      const { data: existing } = await supabase
        .from('profiles')
        .select('id, user_name')
        .eq('user_handle', profile.user_handle)
        .single();
      
      if (existing) {
        seedProfileIds.push({ id: existing.id, name: existing.user_name });
        console.log(`✅ ${profile.user_name} (已存在)`);
      } else {
        const { data, error } = await supabase
          .from('profiles')
          .insert(profile)
          .select('id, user_name')
          .single();
        
        if (error) {
          console.error(`❌ 创建 seed profile ${profile.user_name} 失败:`, error.message);
        } else {
          seedProfileIds.push({ id: data.id, name: data.user_name });
          console.log(`✅ ${profile.user_name}`);
        }
      }
    }
    console.log(`\n✅ ${seedProfileIds.length} 个 Seed 用户已创建\n`);

    // 2. 创建社区标签
    console.log('🏷️  创建社区标签...');
    const communities = [
      { name: 'Mindfulness', icon: '🧘', color: '#8B5CF6', member_count: 4532 },
      { name: 'Relationships', icon: '❤️', color: '#EC4899', member_count: 3876 },
      { name: 'Career', icon: '💼', color: '#3B82F6', member_count: 5241 },
      { name: 'Creativity', icon: '🎨', color: '#F59E0B', member_count: 2983 },
      { name: 'Wellness', icon: '🌿', color: '#10B981', member_count: 4102 }
    ];

    const communityIds = {};
    for (const comm of communities) {
      // 先尝试查询是否已存在
      const { data: existing } = await supabase
        .from('community_tags')
        .select('id, name')
        .eq('name', comm.name)
        .single();
      
      if (existing) {
        communityIds[comm.name] = existing.id;
        console.log(`✅ ${comm.name} (已存在)`);
      } else {
        const { data, error } = await supabase
          .from('community_tags')
          .insert(comm)
          .select('id, name')
          .single();
        
        if (error) {
          console.error(`❌ 创建社区 ${comm.name} 失败:`, error.message);
        } else {
          communityIds[comm.name] = data.id;
          console.log(`✅ ${comm.name}`);
        }
      }
    }
    console.log(`\n✅ ${Object.keys(communityIds).length} 个社区已创建\n`);

    // 3. 创建 Seed Posts（20-50 条）
    console.log('📮 创建 Seed 帖子...');
    const seedPosts = [
      // Mindfulness
      {
        title: 'My Journey Through Mindful Morning Routines',
        author_type: 'seed',
        author_id: seedProfileIds[0]?.id,
        author_name: seedProfileIds[0]?.name,
        community_tag_id: communityIds['Mindfulness'],
        summary: 'Discovered how 10 minutes of meditation changed my entire day. Started with just breathing exercises and gradually built up to guided visualizations.',
        content: 'For the past 6 months, I\'ve been experimenting with different morning routines. The biggest game-changer? Meditation. Just 10 minutes of sitting quietly, focusing on my breath, has transformed my days. I\'m calmer, more focused, and better equipped to handle stress.',
        tags: ['meditation', 'morning-routine', 'wellness'],
        asset_urls: ['https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800'],
        likes: 127,
        comments: 23
      },
      {
        title: 'Breathing Techniques That Actually Work',
        author_type: 'seed',
        author_id: seedProfileIds[1]?.id,
        author_name: seedProfileIds[1]?.name,
        community_tag_id: communityIds['Mindfulness'],
        summary: 'Box breathing helped me through my anxiety. Here\'s the simple 4-4-4-4 method that changed everything.',
        content: 'When panic hits, our breath becomes shallow. Box breathing (4 counts in, hold 4, out 4, hold 4) activates the parasympathetic nervous system. I use this before presentations, during stressful moments, and even to fall asleep.',
        tags: ['breathing', 'anxiety-relief', 'techniques'],
        asset_urls: ['https://images.unsplash.com/photo-1545389336-cf090694435e?w=800'],
        likes: 89,
        comments: 15
      },
      {
        title: 'The Art of Being Present',
        author_type: 'seed',
        author_id: seedProfileIds[2]?.id,
        author_name: seedProfileIds[2]?.name,
        community_tag_id: communityIds['Mindfulness'],
        summary: 'Smartphones are stealing our presence. I started a 30-day digital detox and here\'s what happened.',
        content: 'We\'re physically here but mentally elsewhere. I challenged myself to put my phone away during meals, conversations, and walks. The first week was hard. By week three, I noticed I was actually listening to people instead of waiting to speak.',
        tags: ['presence', 'digital-detox', 'awareness'],
        asset_urls: ['https://images.unsplash.com/photo-1499209974431-9dddcece7f88?w=800'],
        likes: 203,
        comments: 34
      },
      
      // Relationships
      {
        title: 'How I Saved My Marriage By Learning to Listen',
        author_type: 'seed',
        author_id: seedProfileIds[3]?.id,
        author_name: seedProfileIds[3]?.name,
        community_tag_id: communityIds['Relationships'],
        summary: 'We were on the brink of divorce. A therapist taught us active listening, and it changed everything.',
        content: 'My partner would talk, and I would immediately formulate my response. Sound familiar? Active listening means truly hearing without planning your rebuttal. It feels awkward at first, but it saved our relationship.',
        tags: ['marriage', 'communication', 'listening'],
        asset_urls: ['https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=800'],
        likes: 312,
        comments: 67
      },
      {
        title: 'Setting Boundaries with Family',
        author_type: 'seed',
        author_id: seedProfileIds[4]?.id,
        author_name: seedProfileIds[4]?.name,
        community_tag_id: communityIds['Relationships'],
        summary: 'Saying "no" to family felt impossible. Here\'s how I learned to set healthy boundaries without guilt.',
        content: 'For years, I was the family yes-person. Boundaries felt selfish. But burnout taught me: you can\'t pour from an empty cup. Now I say "I need to check my schedule" instead of automatic yes. Game changer.',
        tags: ['boundaries', 'family', 'self-care'],
        asset_urls: ['https://images.unsplash.com/photo-1511895426328-dc8714191300?w=800'],
        likes: 156,
        comments: 28
      },
      {
        title: 'Friendship in Your 30s Hits Different',
        author_type: 'seed',
        author_id: seedProfileIds[5]?.id,
        author_name: seedProfileIds[5]?.name,
        community_tag_id: communityIds['Relationships'],
        summary: 'Making friends as an adult is weird. Here are the strategies that actually worked for me.',
        content: 'Post-college friendship is intentional. I joined a book club, started rock climbing, and initiated hangouts. Quality over quantity. Three deep friendships beat 50 surface-level ones.',
        tags: ['friendship', 'adulting', 'connection'],
        asset_urls: ['https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800'],
        likes: 94,
        comments: 19
      },
      
      // Career
      {
        title: 'I Quit My Corporate Job to Freelance',
        author_type: 'seed',
        author_id: seedProfileIds[6]?.id,
        author_name: seedProfileIds[6]?.name,
        community_tag_id: communityIds['Career'],
        summary: 'Here\'s what they don\'t tell you about leaving stability for freedom. 1 year update.',
        content: 'Month 1: Terrifying. Month 6: Still scary but exhilarating. Month 12: Best decision ever. The income is inconsistent, but my mental health has never been better. I work 30 hours a week and earn more than my 9-5.',
        tags: ['freelance', 'career-change', 'remote-work'],
        asset_urls: ['https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800'],
        likes: 421,
        comments: 89
      },
      {
        title: 'Imposter Syndrome is a Liar',
        author_type: 'seed',
        author_id: seedProfileIds[7]?.id,
        author_name: seedProfileIds[7]?.name,
        community_tag_id: communityIds['Career'],
        summary: 'Got promoted to senior engineer. Still feel like a fraud. Here\'s how I\'m dealing with it.',
        content: 'That voice saying "you don\'t deserve this" is imposter syndrome. I started keeping a brag document - every win, every compliment, every success. When doubt creeps in, I read it. You ARE good enough.',
        tags: ['imposter-syndrome', 'career-growth', 'confidence'],
        asset_urls: ['https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=800'],
        likes: 267,
        comments: 52
      },
      {
        title: 'Negotiating Salary: What I Wish I Knew',
        author_type: 'seed',
        author_id: seedProfileIds[0]?.id,
        author_name: seedProfileIds[0]?.name,
        community_tag_id: communityIds['Career'],
        summary: 'Always accepting the first offer cost me $100K over 5 years. Never again.',
        content: 'They will ALWAYS lowball the first offer. I researched market rates, practiced my pitch, and asked for 20% more. They came back with 15% more. Silence is your friend in negotiations.',
        tags: ['salary', 'negotiation', 'career-advice'],
        asset_urls: ['https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800'],
        likes: 543,
        comments: 103
      },
      
      // Creativity
      {
        title: 'I Made Art Every Day for 100 Days',
        author_type: 'seed',
        author_id: seedProfileIds[1]?.id,
        author_name: seedProfileIds[1]?.name,
        community_tag_id: communityIds['Creativity'],
        summary: 'The 100-day project taught me more than 4 years of art school. Here\'s my journey.',
        content: 'Day 1: Excited. Day 30: Exhausted. Day 70: In flow state. Day 100: Transformed. Consistency beats talent. I went from stick figures to selling prints. Just. Keep. Creating.',
        tags: ['art', '100-day-project', 'creativity'],
        asset_urls: ['https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=800'],
        likes: 178,
        comments: 31
      },
      {
        title: 'Overcoming Creative Block',
        author_type: 'seed',
        author_id: seedProfileIds[2]?.id,
        author_name: seedProfileIds[2]?.name,
        community_tag_id: communityIds['Creativity'],
        summary: 'Staring at blank pages for weeks. These 5 strategies brought my creativity back.',
        content: 'Creative block is fear wearing a disguise. I broke through by: 1) Making bad art on purpose, 2) Changing my environment, 3) Consuming different media, 4) Collaborating, 5) Resting without guilt.',
        tags: ['creative-block', 'inspiration', 'art'],
        asset_urls: ['https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800'],
        likes: 145,
        comments: 24
      },
      {
        title: 'From Hobbyist to Selling My Work',
        author_type: 'seed',
        author_id: seedProfileIds[3]?.id,
        author_name: seedProfileIds[3]?.name,
        community_tag_id: communityIds['Creativity'],
        summary: 'Made $5K last month selling digital art. Here\'s the exact strategy I used.',
        content: 'Started on Etsy, moved to my own site. Built an email list. Showed my process on Instagram. Charged what I\'m worth. The internet has democratized creative careers - use it.',
        tags: ['selling-art', 'side-hustle', 'digital-art'],
        asset_urls: ['https://images.unsplash.com/photo-1452860606245-08befc0ff44b?w=800'],
        likes: 389,
        comments: 71
      },
      
      // Wellness
      {
        title: 'Healing My Relationship with Food',
        author_type: 'seed',
        author_id: seedProfileIds[4]?.id,
        author_name: seedProfileIds[4]?.name,
        community_tag_id: communityIds['Wellness'],
        summary: '15 years of disordered eating. Finally free. Here\'s what actually worked.',
        content: 'Diets made it worse. Intuitive eating saved me. I learned to trust my body, eat without guilt, and stop labeling food as good or bad. Food is fuel, pleasure, and culture - not the enemy.',
        tags: ['intuitive-eating', 'mental-health', 'recovery'],
        asset_urls: ['https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800'],
        likes: 234,
        comments: 45
      },
      {
        title: 'Sleep Optimization Changed My Life',
        author_type: 'seed',
        author_id: seedProfileIds[5]?.id,
        author_name: seedProfileIds[5]?.name,
        community_tag_id: communityIds['Wellness'],
        summary: 'Chronic insomnia for 10 years. These science-backed methods fixed it.',
        content: 'Blackout curtains. No screens 1 hour before bed. Magnesium supplement. Cold room. Consistent wake time. These aren\'t sexy, but they work. I went from 4 hours to 8 hours of quality sleep.',
        tags: ['sleep', 'insomnia', 'health'],
        asset_urls: ['https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?w=800'],
        likes: 312,
        comments: 58
      },
      {
        title: 'My Mental Health Toolkit',
        author_type: 'seed',
        author_id: seedProfileIds[6]?.id,
        author_name: seedProfileIds[6]?.name,
        community_tag_id: communityIds['Wellness'],
        summary: 'Therapy, medication, exercise, journaling, and community. Here\'s how I manage depression.',
        content: 'There\'s no single fix. My toolkit: weekly therapy, SSRI that works for me, morning walks, gratitude journaling, and friends who check in. Some days I use all of it. Some days I just survive. Both are okay.',
        tags: ['mental-health', 'depression', 'self-care'],
        asset_urls: ['https://images.unsplash.com/photo-1499209974431-9dddcece7f88?w=800'],
        likes: 487,
        comments: 92
      },
      
      // 更多帖子...
      {
        title: 'Walking 10K Steps Daily: 6 Month Update',
        author_type: 'seed',
        author_id: seedProfileIds[7]?.id,
        author_name: seedProfileIds[7]?.name,
        community_tag_id: communityIds['Wellness'],
        summary: 'Not a gym person. Started walking everywhere. Lost 20 lbs and gained mental clarity.',
        content: 'No fancy equipment needed. I walk to the grocery store, take calls while walking, and explore my neighborhood. It\'s meditation in motion. My body and mind have never felt better.',
        tags: ['walking', 'fitness', 'habit-building'],
        asset_urls: ['https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=800'],
        likes: 198,
        comments: 37
      },
      {
        title: 'Journaling Prompts That Actually Help',
        author_type: 'seed',
        author_id: seedProfileIds[0]?.id,
        author_name: seedProfileIds[0]?.name,
        community_tag_id: communityIds['Mindfulness'],
        summary: 'Blank pages intimidated me. These prompts made journaling a game-changer.',
        content: 'My go-to prompts: "What do I need to let go of?", "What am I grateful for?", "What would I do if I wasn\'t afraid?". 10 minutes a day, handwritten. It\'s therapy you can afford.',
        tags: ['journaling', 'self-reflection', 'prompts'],
        asset_urls: ['https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800'],
        likes: 167,
        comments: 29
      },
      {
        title: 'How I Built a Reading Habit',
        author_type: 'seed',
        author_id: seedProfileIds[1]?.id,
        author_name: seedProfileIds[1]?.name,
        community_tag_id: communityIds['Creativity'],
        summary: 'From 0 books to 52 books a year. The trick? Stop forcing yourself to finish bad books.',
        content: 'Permission to quit books that don\'t spark joy was revolutionary. I read before bed, on my commute, and during lunch. E-readers made it easy. Audiobooks count. Just read.',
        tags: ['reading', 'habits', 'learning'],
        asset_urls: ['https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800'],
        likes: 223,
        comments: 41
      },
      {
        title: 'Dealing with Toxic Coworkers',
        author_type: 'seed',
        author_id: seedProfileIds[2]?.id,
        author_name: seedProfileIds[2]?.name,
        community_tag_id: communityIds['Career'],
        summary: 'You can\'t change them. But you can change your response. Here\'s my survival guide.',
        content: 'Document everything. Keep communication in writing. Don\'t engage in gossip. Set clear boundaries. If HR won\'t help, update your resume. Life\'s too short for toxic workplaces.',
        tags: ['workplace', 'boundaries', 'career'],
        asset_urls: ['https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=800'],
        likes: 276,
        comments: 53
      },
      {
        title: 'Learning to Love Being Alone',
        author_type: 'seed',
        author_id: seedProfileIds[3]?.id,
        author_name: seedProfileIds[3]?.name,
        community_tag_id: communityIds['Relationships'],
        summary: 'Solitude scared me. Now it\'s my sanctuary. Here\'s how I made peace with being alone.',
        content: 'Alone doesn\'t mean lonely. I take myself on dates, cook elaborate meals for one, and dance in my living room. The relationship with yourself is the longest one you\'ll have - invest in it.',
        tags: ['solitude', 'self-love', 'independence'],
        asset_urls: ['https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=800'],
        likes: 189,
        comments: 34
      }
    ];

    let postCount = 0;
    for (const post of seedPosts) {
      if (!post.author_id || !post.community_tag_id) {
        console.log(`⚠️  跳过帖子 "${post.title}" (缺少 author 或 community)`);
        continue;
      }
      
      const { error } = await supabase
        .from('community_posts')
        .insert({
          ...post,
          content_json: { content: post.content },
          is_demo: false, // seed 内容不是 demo
          timestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString() // 过去 30 天随机时间
        });
      
      if (error) {
        console.error(`❌ 创建帖子 "${post.title}" 失败:`, error.message);
      } else {
        postCount++;
        console.log(`✅ ${post.title.slice(0, 50)}...`);
      }
    }
    console.log(`\n✅ ${postCount} 条 Seed 帖子已创建\n`);

    console.log('🎉 Seed 数据插入完成！\n');
    console.log('📊 数据统计：');
    console.log(`   - ${seedProfileIds.length} 个 Seed 用户`);
    console.log(`   - ${Object.keys(communityIds).length} 个社区`);
    console.log(`   - ${postCount} 条高质量帖子\n`);
    
  } catch (error) {
    console.error('❌ Seed 数据插入失败:', error);
    throw error;
  }
}

// 主流程
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--seed-only')) {
    console.log('🌱 只执行 Seed 数据插入（不清空现有数据）\n');
    await seedDemoData();
  } else {
    await migrateData();
    console.log('\n是否要插入 Seed 数据？(y/n)');
    console.log('提示：运行 node supabase/migrate-data.js --seed-only 可单独插入 seed\n');
    // 自动插入 seed
    await seedDemoData();
  }
}

main();
