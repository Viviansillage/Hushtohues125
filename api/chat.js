import { supabase, getActor } from './supabase.js';
import { uploadBase64Image } from '../server/storage.js';

async function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

/**
 * System Prompt: Hush to Hues 产品定位
 */
const SYSTEM_PROMPT = `You are Hush to Hues AI assistant. Transform chaotic ideas into clear, organized expressions.

**OUTPUT STRICT JSON ONLY** (no markdown, no extra text):
{
  "reply": "<conversational response>",
  "title": "<concise title, max 10 words>",
  "summary": "<2-3 sentence summary>",
  "tags": ["tag1", "tag2", "tag3"],
  "mindmap": {
    "root": "<main topic>",
    "branches": [{"label": "<branch>", "children": ["<item1>", "<item2>"]}]
  }
}`;

const MINDMAP_PROMPT = `Analyze the conversation and create a mindmap in Mermaid format.

**OUTPUT STRICT JSON ONLY**:
{
  "title": "<topic title>",
  "summary": "<brief summary of the topic>",
  "mermaidCode": "mindmap\\n  root((Main Topic))\\n    Branch 1\\n      Detail 1\\n      Detail 2\\n    Branch 2\\n      Detail 3"
}

Example mermaid mindmap syntax:
mindmap
  root((Central Idea))
    Branch A
      Sub A1
      Sub A2
    Branch B
      Sub B1
        Detail B1a
    Branch C

Generate proper Mermaid mindmap code based on the conversation.`;

const IMAGE_PROMPT = `Based on the ENTIRE conversation history below, generate a detailed image description and title that captures the essence, theme, or key concepts discussed.

Analyze all messages to understand the main topic, mood, and visual elements that would best represent this conversation.

**OUTPUT STRICT JSON ONLY**:
{
  "title": "<descriptive title for the image, max 50 characters>",
  "summary": "<brief summary of what the image represents from the conversation, 1-2 sentences>",
  "imagePrompt": "<detailed, vivid description for AI image generation. Include: main subject, style (photorealistic/artistic/abstract), mood/atmosphere, colors, lighting, composition, specific visual details. Make it creative and visually engaging. Max 500 characters>"
}

Example:
{
  "title": "Sunset Over Mountains",
  "summary": "Represents the peaceful nature discussion about mountain landscapes",
  "imagePrompt": "A breathtaking mountain landscape at sunset, golden hour lighting, warm orange and pink sky, snow-capped peaks, serene alpine lake reflecting the colors, photorealistic style, high detail, cinematic composition, peaceful atmosphere, dramatic clouds"
}

Important: Synthesize ALL conversation messages to create a cohesive visual concept, not just the last message.`;

/**
 * 调用 Google Imagen 3 API 生成图片
 */
async function callImagen(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${apiKey}`;
  
  const body = {
    instances: [{ prompt: prompt }],
    parameters: { 
      sampleCount: 1, 
      aspectRatio: "16:9" 
    }
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Imagen API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  
  if (!data.predictions || !data.predictions[0] || !data.predictions[0].bytesBase64Encoded) {
    throw new Error('No image data returned from Imagen API');
  }

  // Convert base64 to Data URL
  const base64Image = data.predictions[0].bytesBase64Encoded;
  const dataUrl = `data:image/png;base64,${base64Image}`;
  
  return dataUrl;
}

/**
 * 调用 Gemini API
 */
async function callGemini(messages, userText, customPrompt = null) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const contents = [];
  
  if (messages && messages.length > 0) {
    messages.forEach(msg => {
      contents.push({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
      });
    });
  }

  contents.push({
    role: 'user',
    parts: [{ text: userText }]
  });

  const requestBody = {
    contents,
    systemInstruction: {
      parts: [{ text: customPrompt || SYSTEM_PROMPT }]
    },
    generationConfig: {
      temperature: 0.3,
      topP: 0.9,
      maxOutputTokens: 2048,
      responseMimeType: 'application/json'
    }
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!text) {
    throw new Error('No text in Gemini response');
  }

  return text;
}

/**
 * 安全解析 Gemini JSON
 */
function safeParseGeminiJson(text, fallbackTitle = 'Untitled') {
  try {
    let cleaned = text.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    // 提取第一个 { 到最后一个 }
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }

    const parsed = JSON.parse(cleaned);

    // 验证必需字段
    if (!parsed.reply && !parsed.title) {
      parsed.reply = 'Got your idea!';
    }
    if (!parsed.title) parsed.title = fallbackTitle;
    if (!parsed.summary) parsed.summary = parsed.reply || 'An interesting concept.';
    if (!Array.isArray(parsed.tags)) parsed.tags = [];
    if (!parsed.mindmap) {
      parsed.mindmap = {
        root: parsed.title,
        branches: [{ label: 'Key Points', children: [parsed.summary] }]
      };
    }

    return parsed;
  } catch (error) {
    console.error('Failed to parse Gemini JSON:', error);
    return {
      reply: text.substring(0, 200),
      title: fallbackTitle,
      summary: 'Unable to parse response.',
      tags: ['error'],
      mindmap: { root: 'Error', branches: [] }
    };
  }
}

/**
 * 获取或创建对话
 */
async function getOrCreateConversation(actor, conversationId) {
  if (conversationId) {
    const { data, error } = await supabase
      .from('chat_history')
      .select('*')
      .eq('id', conversationId)
      .eq('owner_type', actor.type)
      .eq('owner_id', actor.id)
      .maybeSingle();

    if (error) console.error('[getConversation] Error:', error);
    return data;
  }

  // 创建新对话
  const { data, error } = await supabase
    .from('chat_history')
    .insert({
      owner_type: actor.type,
      owner_id: actor.id,
      title: 'Chat Session',
      last_message: '',
      content_json: { messages: [] },
      message_count: 0,
      is_public: false,
      tags: ['chat'],
      is_demo: actor.type === 'guest',
      expires_at: actor.type === 'guest' ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() : null,
      timestamp: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    console.error('[createConversation] Error:', error);
    throw error;
  }

  return data;
}

/**
 * 更新对话
 */
async function updateConversation(conversationId, messages, title = null) {
  const updateData = {
    content_json: { messages },
    message_count: messages.length,
    timestamp: new Date().toISOString()
  };

  if (title) {
    updateData.title = title;
  }

  const { data, error } = await supabase
    .from('chat_history')
    .update(updateData)
    .eq('id', conversationId)
    .select()
    .single();

  if (error) {
    console.error('[updateConversation] Error:', error);
    throw error;
  }

  return data;
}

/**
 * 统一的 Chat API 端点
 */
export default async function handler(req, res) {
  console.log('[chat.js] Handler called:', req.method, req.url);
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Guest-ID');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const action = url.searchParams.get('action') || 'messages';
    const actor = getActor(req);

    console.log('[chat.js] Action:', action, 'Actor:', actor);

    // ========== GET /api/chat?action=messages - 已废弃（前端自行维护 messages）==========
    if (req.method === 'GET' && action === 'messages') {
      console.log('[GET messages] Deprecated: returning empty array');
      return res.status(200).json([]);
    }

    // ========== POST /api/chat?action=message - 发送消息（纯内存对话，不写 DB）==========
    if (req.method === 'POST' && action === 'message') {
      const body = await parseBody(req);
      const { text, messages: contextMessages } = body;

      if (!text) {
        return res.status(400).json({ error: 'Missing "text" in request body' });
      }

      console.log('[POST message] Text:', text, 'Context messages:', contextMessages?.length || 0);

      try {
        // 使用前端传来的 messages 作为上下文（不读写 DB）
        let messages = Array.isArray(contextMessages) ? [...contextMessages] : [];

        console.log('[POST message] Using context messages:', messages.length);

        // 添加用户消息
        const userMessage = {
          id: `msg-${Date.now()}-u`,
          text,
          sender: 'user',
          timestamp: new Date().toISOString()
        };
        messages.push(userMessage);

        // 调用 Gemini
        const geminiResponse = await callGemini(messages, text);
        const structured = safeParseGeminiJson(geminiResponse);

        // 添加 bot 消息
        const botMessage = {
          id: `msg-${Date.now()}-b`,
          text: structured.reply,
          sender: 'bot',
          timestamp: new Date().toISOString()
        };
        messages.push(botMessage);

        console.log('[POST message] Returning messages (no DB write):', messages.length);

        return res.status(200).json({
          messages,
          structured: {
            title: structured.title,
            summary: structured.summary,
            tags: structured.tags,
            mindmap: structured.mindmap
          }
        });

      } catch (geminiError) {
        console.error('[POST message] Gemini error:', geminiError);
        return res.status(500).json({
          error: 'Failed to process message',
          details: geminiError.message
        });
      }
    }

    // ========== POST /api/chat?action=artifact - 创建 artifact ==========
    if (req.method === 'POST' && action === 'artifact') {
      const body = await parseBody(req);
      const { kind, conversationId, messages: providedMessages, prompt } = body;

      if (!kind || !['mindmap', 'image', 'save'].includes(kind)) {
        return res.status(400).json({ error: 'Invalid or missing "kind" (mindmap/image/save)' });
      }

      console.log('[POST artifact] Kind:', kind, 'ConversationId:', conversationId, 'Provided messages:', providedMessages?.length);

      try {
        // 获取消息（优先使用 providedMessages，否则从 conversation 读取）
        let messages = providedMessages;
        if (!messages || messages.length === 0) {
          if (conversationId) {
            const conversation = await getOrCreateConversation(actor, conversationId);
            messages = conversation?.content_json?.messages || [];
            console.log('[POST artifact] Loaded messages from conversation:', messages.length);
          } else {
            messages = [];
          }
        }

        // ========== kind="mindmap" ==========
        if (kind === 'mindmap') {
          // 使用 Gemini 生成结构化 mindmap
          const conversationText = messages.map(m => `${m.sender}: ${m.text}`).join('\n') || prompt || 'No conversation yet';
          const geminiResponse = await callGemini([], conversationText, MINDMAP_PROMPT);
          const mindmapData = safeParseGeminiJson(geminiResponse, 'Mindmap');

          // 提取聊天摘要作为 last_message（只关注聊天内容）
          const chatSummary = messages.slice(-3).map(m => m.text).join(' ').substring(0, 200);

          // 保存到 chat_history
          const { data, error } = await supabase
            .from('chat_history')
            .insert({
              owner_type: actor.type,
              owner_id: actor.id,
              title: mindmapData.title || 'Mindmap',
              last_message: chatSummary || mindmapData.summary || 'Conversation mindmap',
              content_json: {
                kind: 'mindmap',
                structuredMindmap: mindmapData,
                mermaidCode: mindmapData.mermaidCode,
                messages: messages.slice(-5)  // 保存最近5条消息作为上下文
              },
              message_count: messages.length,
              is_public: false,
              tags: ['mindmap'],
              is_demo: actor.type === 'guest',
              expires_at: actor.type === 'guest' ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() : null,
              timestamp: new Date().toISOString()
            })
            .select()
            .single();

          if (error) {
            console.error('[POST artifact mindmap] Supabase error:', error);
            return res.status(500).json({ error: 'Failed to save mindmap', details: error.message });
          }

          console.log('[POST artifact mindmap] Saved:', data.id);

          return res.status(200).json({
            history: {
              id: data.id,
              title: data.title,
              messageCount: data.message_count,
              lastMessage: data.last_message,
              timestamp: data.timestamp,
              previewImages: [],
              isPublic: false,
              tags: data.tags || []
            },
            message: {
              id: `msg-${Date.now()}`,
              text: `✅ Saved mindmap: ${data.title}`,
              sender: 'bot',
              timestamp: new Date().toISOString()
            },
            structuredMindmap: {
              mermaidCode: mindmapData.mermaidCode || 'mindmap\n  root((No data))',
              title: mindmapData.title,
              summary: mindmapData.summary
            }
          });
        }

        // ========== kind="image" ==========
        if (kind === 'image') {
          // Step 1: 使用 Gemini 生成图片描述（分析完整对话历史）
          const conversationText = messages.map(m => `${m.sender}: ${m.text}`).join('\n');
          
          let imageData;
          try {
            const { GoogleGenerativeAI } = await import('@google/generative-ai');
            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
            
            console.log('[Image] Analyzing conversation:', messages.length, 'messages');
            
            const imagePromptResponse = await model.generateContent(
              IMAGE_PROMPT + '\n\n=== CONVERSATION HISTORY ===\n' + conversationText + '\n\n=== END CONVERSATION ===\n\nNow generate the image description JSON:'
            );
            
            const imageText = imagePromptResponse.response.text();
            console.log('[Image] Gemini response:', imageText.substring(0, 200));
            const jsonMatch = imageText.match(/\{[\s\S]*\}/);
            imageData = jsonMatch ? JSON.parse(jsonMatch[0]) : {
              title: 'Generated Image',
              summary: 'AI generated image from conversation',
              imagePrompt: conversationText.substring(0, 500)
            };
          } catch (err) {
            console.error('[Image] Gemini error:', err);
            // 降级方案：使用最后几条消息
            const fallbackText = messages.slice(-3).map(m => m.text).join(' ');
            imageData = {
              title: 'Generated Image',
              summary: 'AI generated image',
              imagePrompt: fallbackText.substring(0, 400) + ', digital art, high quality, detailed'
            };
          }

          // Step 2: 调用 Google Imagen 3 API 生成真实图片
          let imageUrl;
          try {
            console.log('[Image] Calling Imagen 3 with prompt:', imageData.imagePrompt.substring(0, 100));
            imageUrl = await callImagen(imageData.imagePrompt);
            console.log('[Image] Imagen 3 generated image successfully');
          } catch (imagenError) {
            console.error('[Image] Imagen 3 API error:', imagenError);
            // 降级到 Pollinations 作为备份
            const imagePrompt = encodeURIComponent(imageData.imagePrompt);
            imageUrl = `https://image.pollinations.ai/prompt/${imagePrompt}?width=1024&height=1024&seed=${Date.now()}&nologo=true`;
            console.log('[Image] Using Pollinations as fallback');
          }
          
          // Step 3: 提取聊天摘要作为 last_message
          const chatSummary = messages.slice(-3).map(m => m.text).join(' ').substring(0, 200);

          const { data, error } = await supabase
            .from('chat_history')
            .insert({
              owner_type: actor.type,
              owner_id: actor.id,
              title: imageData.title || 'Generated Image',
              last_message: chatSummary || imageData.summary || 'Image from conversation',
              content_json: {
                kind: 'image',
                messages: messages.slice(-3),
                imageUrl: imageUrl,
                imagePrompt: imageData.imagePrompt,
                summary: imageData.summary
              },
              message_count: messages.length,
              is_public: false,
              tags: ['image'],
              is_demo: actor.type === 'guest',
              expires_at: actor.type === 'guest' ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() : null,
              timestamp: new Date().toISOString()
            })
            .select()
            .single();

          if (error) {
            console.error('[POST artifact image] Supabase error:', error);
            return res.status(500).json({ error: 'Failed to save image', details: error.message });
          }

          console.log('[POST artifact image] Saved:', data.id);

          return res.status(200).json({
            history: {
              id: data.id,
              title: data.title,
              messageCount: data.message_count,
              lastMessage: data.last_message,
              timestamp: data.timestamp,
              previewImages: [imageUrl],
              isPublic: false,
              tags: data.tags || []
            },
            message: {
              id: `msg-${Date.now()}`,
              text: `✅ Generated and saved: ${imageData.title}`,
              sender: 'bot',
              timestamp: new Date().toISOString()
            },
            generatedImage: {
              url: imageUrl,
              title: imageData.title,
              summary: imageData.summary,
              prompt: imageData.imagePrompt
            }
          });
        }

        // ========== kind="save" ==========
        if (kind === 'save') {
          // 提取聊天摘要（只关注聊天内容，不要 sender 等元数据）
          const chatSummary = messages.slice(-5).map(m => m.text).join(' ').substring(0, 300);

          const { data, error } = await supabase
            .from('chat_history')
            .insert({
              owner_type: actor.type,
              owner_id: actor.id,
              title: 'Saved Conversation',
              last_message: chatSummary || 'Conversation saved',
              content_json: {
                kind: 'save',
                messages
              },
              message_count: messages.length,
              is_public: false,
              tags: ['save'],
              is_demo: actor.type === 'guest',
              expires_at: actor.type === 'guest' ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() : null,
              timestamp: new Date().toISOString()
            })
            .select()
            .single();

          if (error) {
            console.error('[POST artifact save] Supabase error:', error);
            return res.status(500).json({ error: 'Failed to save conversation', details: error.message });
          }

          console.log('[POST artifact save] Saved:', data.id);

          return res.status(200).json({
            history: {
              id: data.id,
              title: data.title,
              messageCount: data.message_count,
              lastMessage: data.last_message,
              timestamp: data.timestamp,
              previewImages: [],
              isPublic: false,
              tags: data.tags || []
            },
            message: {
              id: `msg-${Date.now()}`,
              text: '✅ Conversation saved to your archive!',
              sender: 'bot',
              timestamp: new Date().toISOString()
            }
          });
        }

      } catch (artifactError) {
        console.error('[POST artifact] Error:', artifactError);
        return res.status(500).json({
          error: 'Failed to create artifact',
          details: artifactError.message
        });
      }
    }

    return res.status(400).json({ error: 'Invalid action parameter' });

  } catch (error) {
    console.error('[chat.js] Unhandled error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}
