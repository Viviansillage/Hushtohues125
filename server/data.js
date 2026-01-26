const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'db.json');

const defaultDb = {
  profile: {
    userName: 'Alex Morgan',
    userHandle: '@alexmorgan',
    avatar:
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwZW9wbGUlMjBwb3J0cmFpdHxlbnwxfHx8fDE3NjkzMTcxMDZ8MA&ixlib=rb-4.1.0&q=80&w=400',
    preferences: {
      emailNotifications: true,
      saveHistory: true,
      publicProfile: true
    }
  },
  history: [
    {
      id: '1',
      title: 'Creative Writing Ideas',
      messageCount: 24,
      lastMessage: 'Can you help me brainstorm story concepts?',
      timestamp: '2026-01-24T10:30:00.000Z',
      previewImages: [
        'https://images.unsplash.com/photo-1760561993754-8dcdb1a39487?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxub3RlYm9vayUyMHdyaXRpbmclMjBza2V0Y2h8ZW58MXx8fHwxNzY5MzA1NzMyfDA&ixlib=rb-4.1.0&q=80&w=1080',
        'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
        'https://images.unsplash.com/photo-1455390582262-044cdead277a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400'
      ],
      isPublic: true,
      tags: ['writing', 'creativity', 'storytelling']
    },
    {
      id: '2',
      title: 'Project Planning',
      messageCount: 18,
      lastMessage: 'What are the key milestones for a product launch?',
      timestamp: '2026-01-23T15:45:00.000Z',
      previewImages: [
        'https://images.unsplash.com/photo-1571456610111-72c649ad3521?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwbGFubmluZyUyMHdoaXRlYm9hcmQlMjBza2V0Y2h8ZW58MXx8fHwxNzY5MzA1NzMyfDA&ixlib=rb-4.1.0&q=80&w=1080',
        'https://images.unsplash.com/photo-1531403009284-440f080d1e12?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400'
      ],
      isPublic: false,
      tags: ['planning', 'product', 'strategy', 'launch']
    },
    {
      id: '3',
      title: 'Recipe Suggestions',
      messageCount: 12,
      lastMessage: 'I need healthy breakfast ideas',
      timestamp: '2026-01-22T09:20:00.000Z',
      previewImages: [
        'https://images.unsplash.com/photo-1550497507-634bd6d81ecd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoZWFsdGh5JTIwZm9vZCUyMHNrZXRjaHxlbnwxfHx8fDE3NjkzMDU3MzJ8MA&ixlib=rb-4.1.0&q=80&w=1080',
        'https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400'
      ],
      isPublic: false,
      tags: ['food', 'health', 'cooking']
    },
    {
      id: '4',
      title: 'Learning Python',
      messageCount: 31,
      lastMessage: 'Explain list comprehensions',
      timestamp: '2026-01-21T14:10:00.000Z',
      previewImages: [
        'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb21wdXRlciUyMGNvZGUlMjBzY3JlZW58ZW58MXx8fHwxNzY5MjUxNDg2fDA&ixlib=rb-4.1.0&q=80&w=1080',
        'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400'
      ],
      isPublic: true,
      tags: ['python', 'coding', 'learning', 'basics']
    },
    {
      id: '5',
      title: 'Travel Recommendations',
      messageCount: 15,
      lastMessage: 'Best places to visit in Japan?',
      timestamp: '2026-01-20T11:00:00.000Z',
      previewImages: [
        'https://images.unsplash.com/photo-1645609736206-787ead0e0545?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxqYXBhbiUyMGt5b3RvJTIwc3RyZWV0fGVufDF8fHx8MTc2OTMwNTczMnww&ixlib=rb-4.1.0&q=80&w=1080'
      ],
      isPublic: false,
      tags: ['travel', 'japan', 'guide']
    },
    {
      id: '6',
      title: 'Design Feedback',
      messageCount: 8,
      lastMessage: 'Thoughts on this UI mockup?',
      timestamp: '2026-01-19T16:30:00.000Z',
      previewImages: [
        'https://images.unsplash.com/photo-1547027072-332f09bd6bb3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx1aSUyMGRlc2lnbiUyMG1vY2t1cCUyMHNrZXRjaHxlbnwxfHx8fDE3NjkzMDU3MzJ8MA&ixlib=rb-4.1.0&q=80&w=1080'
      ],
      isPublic: true,
      tags: ['design', 'ui', 'feedback']
    }
  ],
  communityPosts: [
    {
      id: 'c3',
      title: 'Machine Learning Roadmap',
      author: { name: 'Emma Rodriguez' },
      imageUrl:
        'https://images.unsplash.com/photo-1724264601953-d1018680f321?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoYW5kJTIwZHJhd24lMjBtaW5kJTIwbWFwJTIwc2tldGNoJTIwZGlhZ3JhbXxlbnwxfHx8fDE3NjkzMTcxMDZ8MA&ixlib=rb-4.1.0&q=80&w=1080',
      content:
        'Mapped out the key concepts I need to study for my ML journey. The connections are finally making sense!',
      likes: 89,
      comments: 15,
      timestamp: '2026-01-23T11:20:00.000Z',
      tags: ['learning', 'education', 'ML']
    },
    {
      id: 'c5',
      title: 'Product Brainstorming',
      author: { name: 'Lisa Park' },
      imageUrl:
        'https://images.unsplash.com/photo-1760561993754-8dcdb1a39487?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjcmVhdGl2ZSUyMHNrZXRjaGJvb2slMjBub3RlcyUyMHdyaXRpbmd8ZW58MXx8fHwxNzY5MzE3MTA2fDA&ixlib=rb-4.1.0&q=80&w=1080',
      content:
        'Using AI to generate prompts for our team brainstorming session. This layout helped organize our chaotic ideas.',
      likes: 73,
      comments: 11,
      timestamp: '2026-01-22T10:00:00.000Z',
      tags: ['brainstorming', 'work', 'creativity']
    },
    {
      id: 'c6',
      title: 'Archive Sketches',
      author: { name: 'David Wilson' },
      imageUrl:
        'https://images.unsplash.com/photo-1614558097757-bf9aa8fb830e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsYW5kc2NhcGUlMjBza2V0Y2glMjBwZW5jaWwlMjBkcmF3aW5nfGVufDF8fHx8MTc2OTMxNzEwNnww&ixlib=rb-4.1.0&q=80&w=1080',
      content:
        'Found these old landscape studies in my archive thanks to the new auto-tagging feature.',
      likes: 124,
      comments: 23,
      timestamp: '2026-01-25T08:00:00.000Z',
      tags: ['features', 'organization', 'landscape']
    },
    {
      id: 'c7',
      title: 'Novel Mood Board',
      author: { name: 'Sophie Turner' },
      imageUrl:
        'https://images.unsplash.com/photo-1739476479431-d9ead70f3923?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMG1vb2Rib2FyZCUyMGFydGlzdGljJTIwY29sbGFnZXxlbnwxfHx8fDE3NjkzMTcxMDZ8MA&ixlib=rb-4.1.0&q=80&w=1080',
      content:
        'Visualizing the atmosphere for chapter 4. The color palette is really coming together.',
      likes: 45,
      comments: 6,
      timestamp: '2026-01-24T14:20:00.000Z',
      tags: ['art', 'writing', 'inspiration']
    }
  ],
  community: {
    followed: [
      {
        name: 'writing',
        stats: { totalPosts: 1240, members: 5800, online: 142, postsToday: 35 },
        trending: ['Character development tips', 'Plot twist ideas', 'Daily writing prompt']
      },
      {
        name: 'productivity',
        stats: { totalPosts: 850, members: 3200, online: 89, postsToday: 24 },
        trending: ['Notion templates', 'Time blocking', 'Morning routines']
      },
      {
        name: 'design',
        stats: { totalPosts: 2100, members: 8900, online: 256, postsToday: 56 },
        trending: ['Minimalist UI', 'Hand-drawn aesthetics', 'Color theory']
      }
    ],
    recommended: [
      {
        name: 'illustration',
        stats: { totalPosts: 3400, members: 12000, online: 450, postsToday: 89 },
        trending: ['Digital brushes', 'Character design', 'Color palettes']
      },
      {
        name: 'storytelling',
        stats: { totalPosts: 1800, members: 6500, online: 210, postsToday: 42 },
        trending: ['Hero\'s journey', 'World building', 'Dialogue tips']
      },
      {
        name: 'photography',
        stats: { totalPosts: 5600, members: 15000, online: 680, postsToday: 120 },
        trending: ['Composition', 'Lighting setup', 'Editing workflows']
      },
      {
        name: 'coding',
        stats: { totalPosts: 9200, members: 25000, online: 1200, postsToday: 340 },
        trending: ['React hooks', 'Python scripts', 'Web accessibility']
      },
      {
        name: 'mindfulness',
        stats: { totalPosts: 1500, members: 4200, online: 95, postsToday: 18 },
        trending: ['Meditation apps', 'Breathing exercises', 'Focus music']
      }
    ]
  },
  communityDetail: {
    writing: {
      members: 12500,
      online: 432,
      posts: [
        {
          id: '101',
          author: { name: 'Alice Walker' },
          content: 'Just started exploring this topic. Any beginner tips?',
          likes: 12,
          comments: 4,
          timestamp: '2026-01-25T09:00:00.000Z',
          tags: ['beginner', 'help']
        },
        {
          id: '102',
          author: { name: 'Bob Smith' },
          content: 'Here is a resource I found really helpful for understanding the basics.',
          likes: 34,
          comments: 2,
          timestamp: '2026-01-24T18:30:00.000Z',
          tags: ['resources', 'learning']
        },
        {
          id: '103',
          author: { name: 'Charlie Davis' },
          content: 'Working on a new project using these principles. Will share updates soon!',
          likes: 56,
          comments: 8,
          timestamp: '2026-01-24T12:15:00.000Z',
          tags: ['project', 'wip']
        }
      ]
    }
  },
  user: {
    likes: [],
    bookmarks: [],
    followedCommunities: ['writing', 'productivity', 'design'],
    joinedCommunities: []
  },
  chat: {
    activeHistoryId: null,
    messages: [
      {
        id: '1',
        text: 'Hello! I\'m your creative assistant. How can I help you today?',
        sender: 'bot',
        timestamp: new Date().toISOString()
      }
    ]
  }
};

const loadDb = () => {
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify(defaultDb, null, 2));
    return JSON.parse(JSON.stringify(defaultDb));
  }

  try {
    return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  } catch (error) {
    fs.writeFileSync(dbPath, JSON.stringify(defaultDb, null, 2));
    return JSON.parse(JSON.stringify(defaultDb));
  }
};

const saveDb = (db) => {
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
};

module.exports = {
  loadDb,
  saveDb,
  defaultDb
};
