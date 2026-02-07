import { supabase, getActor } from './supabase.js';

/**
 * 指数退避重试工具函数
 * @param {Function} fn - 要执行的异步函数
 * @param {number} maxRetries - 最大重试次数
 * @param {number} initialDelay - 初始延迟（毫秒）
 * @returns {Promise} 函数执行结果
 */
async function retryWithBackoff(fn, maxRetries = 3, initialDelay = 1000) {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // 检查是否应该重试
      const shouldRetry = 
        error.message?.includes('429') || // Rate limit
        error.message?.includes('503') || // Service unavailable
        error.message?.includes('ECONNRESET') || // Connection reset
        error.message?.includes('timeout') || // Timeout
        error.message?.includes('ETIMEDOUT');
      
      if (!shouldRetry || attempt === maxRetries - 1) {
        throw error;
      }
      
      // 指数退避延迟
      const delay = initialDelay * Math.pow(2, attempt);
      const jitter = Math.random() * 200; // 加入随机抖动
      const totalDelay = delay + jitter;
      
      console.log(`[Retry] Attempt ${attempt + 1}/${maxRetries} failed. Retrying in ${Math.round(totalDelay)}ms...`);
      console.log(`[Retry] Error: ${error.message?.substring(0, 100)}`);
      
      await new Promise(resolve => setTimeout(resolve, totalDelay));
    }
  }
  
  throw lastError;
}

async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let bodySize = 0;
    const MAX_BODY_SIZE = 5 * 1024 * 1024; // 5MB limit (Vercel's limit)
    
    req.on('data', chunk => {
      bodySize += chunk.length;
      
      // Guard: Reject if body exceeds 5MB
      if (bodySize > MAX_BODY_SIZE) {
        console.error('Request body too large:', (bodySize / 1024 / 1024).toFixed(2) + 'MB');
        req.destroy();
        reject(new Error('PAYLOAD_TOO_LARGE: Request body exceeds 5MB. Remove images/artifacts from messages.'));
        return;
      }
      
      body += chunk.toString();
    });
    
    req.on('end', () => {
      console.log('Request body size:', (bodySize / 1024).toFixed(1) + 'KB');
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
    
    req.on('error', () => reject(new Error('Failed to parse request body')));
  });
}

/**
 * System Prompt: Hush to Hues 产品定位
 */
const SYSTEM_PROMPT = `You are the Hush to Hues AI assistant.
Your primary role is to help users clarify, organize, and reflect on their own thoughts — not to invent new ideas.

DEFAULT OUTPUT LANGUAGE: English.
If the user input is clearly written in another language, switch to that language.

Core principles:
- Focus on understanding the user's intended meaning and internal logic.
- Resolve ambiguity by interpreting words and phrases in context.
- When multiple interpretations are possible, choose the most reasonable one and clearly state assumptions.
- Do NOT fabricate facts, opinions, or motivations not present in the user's input.
- Do NOT over-interpret or extend beyond what the user has expressed.
- Preserve uncertainty, tension, or incompleteness if they exist.
- When key information is missing, gently prompt the user to clarify or add details.

Internal reasoning steps (do NOT output these steps):
1. Identify core concepts and viewpoints expressed by the user.
2. Detect potentially ambiguous words or phrases and disambiguate them using context.
3. Identify logical relationships between concepts (e.g., cause, contrast, dependency, priority).
4. Identify gaps, uncertainties, or unstated assumptions.
5. Decide whether clarification questions are necessary.

Final output MUST be valid JSON ONLY, using the schema below.
Use clear, logically structured natural language in the "reply" field.

**Response Format Guidelines:**
- The "reply" field MUST be plain text WITHOUT any markdown formatting (no **, __, *, #, etc.)
- Use natural paragraph breaks and clear language structure instead of markdown
- For emphasis or structure, use: line breaks, natural language transitions, or numbered/bulleted lists in plain text format
- End each reply with a friendly confirmation question, such as:
  "Does this capture your thinking clearly? Feel free to add more details or adjust anything."
  "Is this the logic you had in mind? Let me know if you'd like to refine it further."
  "Have I understood this correctly? We can continue the conversation if needed."
- Keep the tone warm and collaborative.
- Title should be concise (max 10 words).

Required JSON schema:
{
  "reply": "<clear, logically structured natural language response in PLAIN TEXT without markdown, natural conversational text, NOT JSON or code blocks>",
  "title": "<concise topic title, max 10 words>",
  "summary": "<2–3 sentences summarizing the user's clarified thinking>",
  "tags": ["<relevant tag>", "<relevant tag>", "<relevant tag>"],
  "followUpQuestions": ["<optional clarification question>", "<optional clarification question>"],
  "mindmap": {
    "root": "<main topic>",
    "branches": [
      {
        "label": "<branch label>",
        "children": ["<item>", "<item>"]
      }
    ],
    "relations": [
      {
        "from": "<concept>",
        "to": "<concept>",
        "type": "cause | contrast | support | depends_on | priority",
        "note": "<optional short explanation>"
      }
    ]
  }
}`;

const MINDMAP_PROMPT = `You are given a structured understanding of the user's thinking, including:
- root topic
- branches
- relationships between concepts

Your task:
1. Identify the dominant thinking structure:
   - hierarchical (categorization, brainstorming)
   - relational (cause, contrast, dependency)
   - process-oriented (steps, decisions, evolution)

2. Select the most appropriate Mermaid diagram type:
   - hierarchical → mindmap
   - relational → graph TD or graph LR
   - process-oriented → flowchart TD

3. Generate VALID Mermaid code.
   - Do NOT invent new concepts.
   - Do NOT drop important relationships.
   - Avoid Mermaid syntax errors.
   - Keep labels concise and human-readable.

**CRITICAL MERMAID SYNTAX RULES - MUST FOLLOW**:

1. **NO PARENTHESES inside (( ))**:
   - NEVER use any type of parentheses inside double parentheses
   - ✗ WRONG: root((Topic (Subtitle)))
   - ✗ WRONG: root((Topic（Subtitle）))
   - ✓ CORRECT: root((Topic - Subtitle))

2. **If title contains parentheses, rewrite as "A - B"**:
   - "Dungeon Meshi (迷宫饭)" → "Dungeon Meshi - 迷宫饭"
   - "Python (Programming)" → "Python - Programming"

3. **Each node MUST be on its own line**:
   - One line = One node
   - No inline children

4. **Use exactly 2 spaces for indentation**:
   - Level 1 (root): no indent
   - Level 2: 2 spaces
   - Level 3: 4 spaces
   - Level 4: 6 spaces

Output STRICT JSON ONLY:
{
  "diagramType": "mindmap | graph | flowchart",
  "title": "<concise diagram title, max 10 words>",
  "summary": "<1–2 sentence summary using the TOPIC as subject, NOT 'this diagram' or 'this mindmap'. Example: 'Machine learning fundamentals include...', NOT 'This diagram shows...'>",
  "mermaidCode": "<valid Mermaid code>"
}`;

const IMAGE_PROMPT = `You are generating an image to support understanding of the user's clarified thinking.

Core rules:
- The image must visually reflect the logical structure, relationships, or tensions discussed.
- Do NOT generate random imagery based on isolated keywords.
- Prefer functional or conceptual visuals over purely decorative ones.
- Visual metaphors should map to relationships such as:
  - contrast → opposing elements or split composition
  - cause → chain reactions or directional flow
  - dependency → support, connection, balance
  - priority → scale, focus, brightness

Internal steps (do NOT output):
1. Identify the core theme.
2. Identify 1–2 key logical relationships.
3. Translate relationships into visual metaphors.
4. Decide appropriate style and mood.

Output STRICT JSON ONLY:
{
  "title": "<image title, max 10 words>",
  "summary": "<1–2 sentence summary using the TOPIC as subject, NOT 'this image' or 'this mindmap'. Example: 'Urban sustainability explores...', NOT 'This image represents...'>",
  "imagePrompt": "<detailed functional image description including subject, style, mood, composition, color palette, lighting, and constraints. Avoid text, logos, or UI elements. Max 500 characters>"
}`;

// 全局缓存：可用的图像模型列表
let availableImageModels = null;

/**
 * 检测当前 API key 可用的图像生成模型
 * 返回格式: { hasImagen: boolean, hasGeminiFlash: boolean, models: string[] }
 * 
 * IMPORTANT NOTE - Imagen API vs Gemini Image Models:
 * - Imagen API (imagen-4.0-generate-001) is VERTEX AI only, not available via Gemini Developer API
 * - For Gemini Developer API (generativelanguage.googleapis.com), use:
 *   - gemini-2.5-flash-image (Nano Banana) - fast, efficient
 *   - gemini-3-pro-image-preview (Nano Banana Pro) - high quality, advanced features
 * - Do NOT attempt to call imagen-* models from generativelanguage.googleapis.com endpoint
 */
async function detectAvailableImageModels() {
  if (availableImageModels) {
    return availableImageModels; // 使用缓存
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('[ModelDetect] GEMINI_API_KEY not found');
    return { hasImagen: false, hasGeminiFlash: false, models: [], allModels: [] };
  }

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    console.log('[ModelDetect] ========================================');
    console.log('[ModelDetect] Listing available models from Gemini Developer API...');
    console.log('[ModelDetect] Endpoint:', endpoint.replace(apiKey, 'API_KEY'));
    
    const response = await fetch(endpoint);
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ModelDetect] Failed to list models:', response.status, errorText.substring(0, 300));
      return { hasImagen: false, hasGeminiFlash: false, models: [], allModels: [] };
    }

    const data = await response.json();
    const allModels = data.models || [];
    const modelNames = allModels.map(m => m.name.replace('models/', ''));
    
    // 查找图像相关模型
    const imagenModels = modelNames.filter(name => name.includes('imagen'));
    const geminiFlashModels = modelNames.filter(name => 
      name.includes('gemini-2.5-flash-image') || 
      name.includes('gemini-3-pro-image') ||
      name.includes('gemini-2.0-flash-image')
    );
    const allImageModels = modelNames.filter(n => 
      n.includes('image') || 
      n.includes('imagen') ||
      n.toLowerCase().includes('vision')
    );
    
    console.log('[ModelDetect] ========================================');
    console.log('[ModelDetect] MODEL DETECTION RESULTS:');
    console.log('[ModelDetect] Total models available:', modelNames.length);
    console.log('[ModelDetect] Imagen models (Vertex only):', imagenModels);
    console.log('[ModelDetect] Gemini Flash Image models:', geminiFlashModels);
    console.log('[ModelDetect] All image-capable models:', allImageModels);
    console.log('[ModelDetect] NOTE: imagen-* models require Vertex AI, not supported by Gemini Developer API');
    console.log('[ModelDetect] ========================================');

    availableImageModels = {
      hasImagen: imagenModels.length > 0,
      hasGeminiFlash: geminiFlashModels.length > 0,
      imagenModel: imagenModels[0] || null,
      geminiFlashModel: geminiFlashModels[0] || 'gemini-2.5-flash-image',
      models: modelNames,
      allModels: allImageModels
    };

    return availableImageModels;
  } catch (error) {
    console.error('[ModelDetect] Error detecting models:', error.message);
    return { hasImagen: false, hasGeminiFlash: false, models: [], allModels: [] };
  }
}

/**
 * 使用 Gemini 2.5 Flash Image (Nano Banana) 生成图片
 * 官方文档: https://ai.google.dev/gemini-api/docs/image-generation
 * 
 * CRITICAL: This uses Gemini Developer API's native image generation capability.
 * Model: gemini-2.5-flash-image (or env var GEMINI_IMAGE_MODEL)
 * Endpoint: /v1beta/models/{model}:generateContent
 * Response: candidates[0].content.parts[] contains inlineData with base64 images
 * 
 * DETERMINISTIC CONFIGURATION:
 * - Model must explicitly support image output
 * - Use responseModalities to request IMAGE output
 * - Parse ALL parts, not just first one
 */
async function callGeminiFlashImage(prompt) {
  const requestId = `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // 使用重试机制包装实际调用
  return await retryWithBackoff(async () => {
    const startTime = Date.now();
    
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    
    console.log('[GeminiFlash] ======================================== REQUEST START');
    console.log('[GeminiFlash] Request ID:', requestId);
    console.log('[GeminiFlash] Model:', model);
    console.log('[GeminiFlash] Endpoint:', endpoint.replace(apiKey, 'API_KEY'));
    console.log('[GeminiFlash] Prompt:', prompt.substring(0, 150) + '...');
    
    // CRITICAL: Request configuration must explicitly request IMAGE output
    const requestBody = {
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        // MUST include IMAGE in responseModalities
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: {
          aspectRatio: '16:9'
        }
      }
    };
    
    console.log('[GeminiFlash] Request Body:', JSON.stringify(requestBody, null, 2));

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const duration = Date.now() - startTime;
      console.log('[GeminiFlash] Response:', response.status, response.statusText, `(${duration}ms)`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[GeminiFlash] API Error Response:', errorText.substring(0, 500));
        
        // Structured error log
        console.error(JSON.stringify({
          level: 'ERROR',
          requestId,
          model,
          endpoint: endpoint.replace(apiKey, 'API_KEY'),
          status: response.status,
          duration,
          error: errorText.substring(0, 200)
        }));
        
        throw new Error(`Gemini Flash Image API error (${response.status}): ${errorText.substring(0, 200)}`);
      }

      const data = await response.json();
      
      // Parse ALL parts from response (not just first)
      const candidates = data.candidates || [];
      const firstCandidate = candidates[0];
      const parts = firstCandidate?.content?.parts || [];
      
      console.log('[GeminiFlash] Response Structure:');
      console.log('  Candidates:', candidates.length);
      console.log('  Parts in first candidate:', parts.length);
      
      // Collect ALL image and text parts
      const imageParts = [];
      const textParts = [];
      const partsSummary = [];
      
      parts.forEach((part, idx) => {
        const partInfo = {
          index: idx,
          hasText: !!part.text,
          hasInlineData: !!part.inlineData,
          mimeType: part.inlineData?.mimeType || null,
          dataLength: part.inlineData?.data?.length || 0
        };
        
        partsSummary.push(partInfo);
        
        console.log(`[GeminiFlash] Part ${idx}:`, partInfo);
        
        if (part.inlineData && part.inlineData.data) {
          imageParts.push({
            index: idx,
            mimeType: part.inlineData.mimeType,
            data: part.inlineData.data
        });
      }
      if (part.text) {
        textParts.push({
          index: idx,
          text: part.text
        });
      }
    });
    
    console.log('[GeminiFlash] 📋 Summary:');
    console.log('  Image parts found:', imageParts.length);
    console.log('  Text parts found:', textParts.length);
    
    // Structured success/failure log
    const logEntry = {
      level: imageParts.length > 0 ? 'SUCCESS' : 'ERROR',
      requestId,
      model,
      endpoint: endpoint.replace(apiKey, 'API_KEY'),
      responseModalities: requestBody.generationConfig.responseModalities,
      imagesFound: imageParts.length,
      textPartsFound: textParts.length,
      partsSummary,
      duration
    };
    
    console.log('[GeminiFlash] Structured Log:', JSON.stringify(logEntry, null, 2));
    
    if (imageParts.length === 0) {
      console.error('[GeminiFlash] NO IMAGE PARTS FOUND');
      console.error('[GeminiFlash] Full response (first 1000 chars):', JSON.stringify(data).substring(0, 1000));
      
      // Build detailed error message
      const textContent = textParts.map(t => t.text).join(' ').substring(0, 300);
      const partsTypeList = partsSummary.map(p => 
        p.hasInlineData ? `inlineData(${p.mimeType})` : 'text'
      ).join(', ');
      
      throw new Error(
        `Gemini returned no inlineData image parts. ` +
        `Model: "${model}", ` +
        `ResponseModalities: ${JSON.stringify(requestBody.generationConfig.responseModalities)}, ` +
        `Parts types: [${partsTypeList}], ` +
        `Text returned: "${textContent}...". ` +
        `Check: 1) Model supports image output, 2) API key has image generation permissions, 3) Region/billing is enabled.`
      );
    }

    // Use the first image
    const firstImage = imageParts[0];
    const base64Image = firstImage.data;
    const mimeType = firstImage.mimeType || 'image/png';
    const dataUrl = `data:${mimeType};base64,${base64Image}`;
    
    console.log('[GeminiFlash] Successfully generated image');
    console.log('[GeminiFlash] MIME type:', mimeType);
    console.log('[GeminiFlash] Base64 length:', base64Image.length);
    console.log('[GeminiFlash] Data URL length:', dataUrl.length);
    console.log('[GeminiFlash] ======================================== REQUEST END');
    
    return dataUrl;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    // Structured error log
    console.error(JSON.stringify({
      level: 'ERROR',
      requestId,
      model,
      endpoint: endpoint.replace(apiKey, 'API_KEY'),
      duration,
      error: error.message
    }));
    
    throw error;
  }
  }, 3, 1000); // 最多重试3次，初始延迟1秒
}

/**
 * 调用 Google Imagen 4 API 生成图片
 * 官方文档: https://ai.google.dev/gemini-api/docs/imagen
 * 模型: imagen-4.0-generate-001 (最新稳定版本)
 */
async function callImagen(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.error('[Imagen] GEMINI_API_KEY not found in environment');
    throw new Error('GEMINI_API_KEY not configured. Please add it to Vercel environment variables.');
  }

  console.log('[Imagen] Using API key:', apiKey.substring(0, 10) + '...');
  
  // 使用官方推荐的 Imagen 4 endpoint
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:generateImages?key=${apiKey}`;
  
  const body = {
    prompt: prompt,
    config: {
      numberOfImages: 1,
      aspectRatio: "16:9"
    }
  };

  console.log('[Imagen] Sending request to:', endpoint.replace(apiKey, 'API_KEY'));
  console.log('[Imagen] Request body:', JSON.stringify(body, null, 2));
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  console.log('[Imagen] Response status:', response.status, response.statusText);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Imagen] API error response:', errorText.substring(0, 500));
    
    // 解析常见错误
    if (response.status === 401) {
      throw new Error('Authentication failed: Invalid GEMINI_API_KEY');
    } else if (response.status === 403) {
      throw new Error('Forbidden: API key lacks Imagen permissions or region not supported');
    } else if (response.status === 429) {
      throw new Error('Rate limit exceeded: Too many requests to Imagen API');
    } else if (response.status === 404) {
      throw new Error('Imagen 4 model not found: Ensure GEMINI_API_KEY has Imagen API access');
    }
    
    throw new Error(`Imagen API error (${response.status}): ${errorText.substring(0, 200)}`);
  }

  const data = await response.json();
  console.log('[Imagen] Response data keys:', Object.keys(data));
  
  // Imagen 4 返回格式: { generatedImages: [{ bytesBase64Encoded: "..." }] }
  if (!data.generatedImages || !data.generatedImages[0] || !data.generatedImages[0].bytesBase64Encoded) {
    console.error('[Imagen] Unexpected response structure:', JSON.stringify(data).substring(0, 500));
    throw new Error('No image data returned from Imagen API');
  }

  // Convert base64 to Data URL
  const base64Image = data.generatedImages[0].bytesBase64Encoded;
  const dataUrl = `data:image/png;base64,${base64Image}`;
  
  console.log('[Imagen] Successfully generated image, data URL length:', dataUrl.length);
  return dataUrl;
}

/**
 * 调用 Gemini API
 */
async function callGemini(messages, userText, customPrompt = null) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('[callGemini] GEMINI_API_KEY not configured');
    throw new Error('GEMINI_API_KEY not configured');
  }

  console.log('[callGemini] Input:', {
    messagesCount: messages?.length || 0,
    userTextLength: userText?.length || 0,
    hasCustomPrompt: !!customPrompt
  });

  const contents = [];
  
  if (messages && messages.length > 0) {
    messages.forEach((msg, idx) => {
      if (!msg.sender || !msg.text) {
        console.warn(`[callGemini] Message ${idx} missing fields:`, msg);
      }
      contents.push({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text || '' }]
      });
    });
  }

  // 若未传入 messages，fallback 使用 userText 作为输入
  if (contents.length === 0 && userText) {
    contents.push({
      role: 'user',
      parts: [{ text: userText }]
    });
  }

  console.log('[callGemini] Request contents length:', contents.length);

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

  console.log('[callGemini] Calling Gemini API...');

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  console.log('[callGemini] Response status:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[callGemini] API error:', errorText.substring(0, 500));
    throw new Error(`Gemini API error: ${response.status} - ${errorText.substring(0, 200)}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!text) {
    console.error('[callGemini] No text in response:', JSON.stringify(data).substring(0, 500));
    throw new Error('Gemini returned no text');
  }

  console.log('[callGemini] Success, response length:', text.length);
  
  return text;
  
  if (!text) {
    throw new Error('No text in Gemini response');
  }

  return text;
}

/**
 * 生成会话标题（使用 Gemini）
 */
async function generateSessionTitle(messages) {
  if (!messages || messages.length === 0) {
    return 'Untitled Session';
  }

  // 如果没有 API key，直接 fallback
  if (!process.env.GEMINI_API_KEY) {
    console.warn('[Title Generation] GEMINI_API_KEY not set, using fallback');
    const firstUserMsg = messages.find(m => m.sender === 'user');
    if (firstUserMsg) {
      const fallback = firstUserMsg.text.substring(0, 50);
      return fallback.length < firstUserMsg.text.length ? fallback + '...' : fallback;
    }
    return 'Untitled Session';
  }

  try {
    const recentMessages = messages.slice(-10); // 最近 10 条消息
    const conversationText = recentMessages
      .map(m => `${m.sender}: ${m.text}`)
      .join('\n');

    const titlePrompt = `You are a professional editor tasked with creating concise, descriptive titles for conversations.

Analyze this conversation and generate a SHORT, DESCRIPTIVE title that captures the main topic or purpose.

Requirements:
- Must be 3-8 words in English (or 4-12 characters in Chinese)
- Should be a PHRASE or TOPIC, not a sentence
- Focus on the MAIN SUBJECT or GOAL of the conversation
- Examples of GOOD titles: "AI Image Generation Tutorial", "Python Debugging Guide", "Travel Planning Ideas"
- Examples of BAD titles: "I wanna learn more about", "Can you help me with", "Let's discuss"

Conversation:
${conversationText}

Title (phrase/topic only, no quotes):`;

    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });  // 使用稳定模型
    
    const result = await model.generateContent(titlePrompt);
    let title = result.response.text().trim();
    
    // 清理引号
    title = title.replace(/^["']|["']$/g, '');
    
    // 限制长度
    if (title.length > 100) {
      title = title.substring(0, 100);
    }
    
    return title || 'Conversation Summary';
  } catch (error) {
    console.error('[Title Generation] Error:', error);
    // Fallback: 从对话中提取关键信息
    const userMessages = messages.filter(m => m.sender === 'user');
    if (userMessages.length > 0) {
      // 尝试从第一条消息中提取主题
      const firstMsg = userMessages[0].text;
      // 移除常见的开场白（中英文）
      const cleaned = firstMsg
        .replace(/^(hi|hello|hey|can you|could you|i want|i wanna|please|help me|let's|how do i|how to|what is|what's|tell me about|explain)/i, '')
        .trim();
      
      if (cleaned.length > 5) {
        const title = cleaned.substring(0, 50);
        return title.length < cleaned.length ? title + '...' : title;
      }
    }
    return 'Untitled Session';
  }
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
  const welcomeMessage = {
    id: `msg-${Date.now()}-welcome`,
    text: "Hi there! I'm here to help you organize and clarify your thoughts. Just share your ideas with me, and we'll work together to make them clearer and more structured.",
    sender: 'bot',
    timestamp: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('chat_history')
    .insert({
      owner_type: actor.type,
      owner_id: actor.id,
      title: 'Chat Session',
      last_message: welcomeMessage.text,
      content_json: { messages: [welcomeMessage] },
      message_count: 1,
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

    // ========== GET /api/chat?action=diagnostics - 模型诊断端点 ==========
    if (req.method === 'GET' && action === 'diagnostics') {
      console.log('[GET diagnostics] Running model availability check...');
      try {
        const detectionResult = await detectAvailableImageModels();
        return res.status(200).json({
          timestamp: new Date().toISOString(),
          apiKeyConfigured: !!process.env.GEMINI_API_KEY,
          imageModelEnvVar: process.env.GEMINI_IMAGE_MODEL || 'not set (using default)',
          detection: {
            hasImagen: detectionResult.hasImagen,
            hasGeminiFlash: detectionResult.hasGeminiFlash,
            imagenModel: detectionResult.imagenModel,
            geminiFlashModel: detectionResult.geminiFlashModel,
            totalModels: detectionResult.models?.length || 0,
            imageCapableModels: detectionResult.allModels || []
          },
          recommendation: detectionResult.hasGeminiFlash 
            ? `Use ${detectionResult.geminiFlashModel} for image generation`
            : 'No image generation models available. Check API key permissions.',
          note: 'Imagen models (imagen-*) require Vertex AI and are NOT available via Gemini Developer API (generativelanguage.googleapis.com)'
        });
      } catch (error) {
        return res.status(500).json({
          error: 'Diagnostics failed',
          details: error.message
        });
      }
    }

    // ========== GET /api/debug/models - 列出所有可用模型 ==========
    if (req.method === 'GET' && (action === 'debug-models' || url.pathname === '/api/debug/models')) {
      console.log('[GET debug-models] Listing all available models...');
      
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error: 'GEMINI_API_KEY not configured',
          suggestion: 'Set GEMINI_API_KEY in Vercel environment variables'
        });
      }
      
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const response = await fetch(endpoint);
        
        if (!response.ok) {
          const errorText = await response.text();
          return res.status(response.status).json({
            error: 'Failed to list models',
            status: response.status,
            details: errorText.substring(0, 300)
          });
        }
        
        const data = await response.json();
        const allModels = data.models || [];
        const modelNames = allModels.map(m => m.name.replace('models/', ''));
        
        // 筛选图像相关模型
        const imageModels = modelNames.filter(name => 
          name.includes('image') || 
          name.includes('imagen') ||
          name.toLowerCase().includes('vision') ||
          name.includes('flash-image') ||
          name.includes('pro-image')
        );
        
        // 检查推荐模型
        const recommended = [
          'gemini-2.5-flash-image',
          'gemini-2.0-flash-image',
          'gemini-3-pro-image-preview'
        ];
        
        const recommendations = {};
        recommended.forEach(model => {
          recommendations[model] = modelNames.includes(model) ? 'available' : 'not found';
        });
        
        return res.status(200).json({
          timestamp: new Date().toISOString(),
          totalModels: modelNames.length,
          imageCapableModels: imageModels,
          recommendedModels: recommendations,
          allModels: modelNames,
          note: 'Imagen models (imagen-*) are Vertex AI only, NOT available via Gemini Developer API'
        });
        
      } catch (error) {
        return res.status(500).json({
          error: 'Failed to fetch models',
          details: error.message
        });
      }
    }

    // ========== GET /api/chat?action=sessions - 获取所有聊天会话列表 ==========
    if (req.method === 'GET' && action === 'sessions') {
      try {
        const { getChatSessions } = await import('./supabase.js');
        const sessions = await getChatSessions(actor);
        
        console.log('[GET sessions] Loaded:', { count: sessions.length });
        
        return res.status(200).json({ sessions });
      } catch (error) {
        console.error('[GET sessions] Error:', error);
        return res.status(500).json({ error: 'Failed to load sessions', details: error.message });
      }
    }

    // ========== GET /api/chat?action=load - 从DB加载消息 ==========
    if (req.method === 'GET' && action === 'load') {
      const sessionId = url.searchParams.get('sessionId');  // 修复：使用 URL params
      
      if (!sessionId) {
        return res.status(400).json({ error: 'Missing sessionId parameter' });
      }
      
      try {
        const { getMessages } = await import('./supabase.js');
        const messages = await getMessages(sessionId);
        
        console.log('[GET load] Loaded:', { sessionId, count: messages.length });
        
        return res.status(200).json({ messages });
      } catch (error) {
        console.error('[GET load] Error:', error);
        return res.status(500).json({ error: 'Failed to load messages', details: error.message });
      }
    }

    // ========== POST /api/chat?action=save - 保存单条消息到DB ==========
    if (req.method === 'POST' && action === 'save') {
      const body = await parseBody(req);
      const { sessionId, message } = body;
      
      if (!sessionId || !message) {
        return res.status(400).json({ error: 'Missing sessionId or message' });
      }
      
      try {
        const { saveMessage } = await import('./supabase.js');
        await saveMessage(sessionId, message, actor);
        
        return res.status(200).json({ success: true });
      } catch (error) {
        console.error('[POST save] Error:', error);
        return res.status(500).json({ error: 'Failed to save message', details: error.message });
      }
    }

    // ========== GET /api/chat?action=messages - 已废弃（前端自行维护 messages）==========
    if (req.method === 'GET' && action === 'messages') {
      console.log('[GET messages] Deprecated: returning empty array');
      return res.status(200).json([]);
    }

    // ========== POST /api/chat?action=message - 发送消息（新架构：从DB获取+保存）==========
    if (req.method === 'POST' && action === 'message') {
      const requestId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      try {
        const body = await parseBody(req);
        const { text, sessionId } = body;

        if (!text) {
          return res.status(400).json({ error: 'Missing "text" in request body' });
        }
        
        if (!sessionId) {
          return res.status(400).json({ error: 'Missing "sessionId" in request body' });
        }

        console.log(`[${requestId}] [POST message] Text:`, text.substring(0, 100), 'SessionId:', sessionId);

        // 从DB加载现有消息
        const { getMessages, saveMessage } = await import('./supabase.js');
        let messages = await getMessages(sessionId);
        
        console.log(`[${requestId}] [POST message] Loaded from DB:`, messages.length);

        // 添加用户消息
        const userMessage = {
          id: `msg-${Date.now()}-u`,
          text,
          sender: 'user',
          timestamp: new Date().toISOString()
        };
        
        // 保存用户消息到DB
        await saveMessage(sessionId, userMessage, actor);

        console.log(`[${requestId}] [POST message] Calling Gemini...`);
        
        // 调用 Gemini - 传入包含用户消息的完整历史
        const messagesWithUser = [...messages, userMessage];
        const geminiResponse = await callGemini(messagesWithUser, text);
        const structured = safeParseGeminiJson(geminiResponse);

        console.log(`[${requestId}] [POST message] Gemini responded, saving bot message...`);
        
        // 添加 bot 消息
        const botMessage = {
          id: `msg-${Date.now()}-b`,
          text: structured.reply,
          sender: 'bot',
          timestamp: new Date().toISOString()
        };
        
        // 保存bot消息到DB
        await saveMessage(sessionId, botMessage, actor);
        
        // 构建完整消息列表返回
        const allMessages = [...messagesWithUser, botMessage];

        console.log(`[${requestId}] [POST message] Saved to DB, returning:`, allMessages.length);

        return res.status(200).json({
          messages: allMessages,
          structured: {
            title: structured.title,
            summary: structured.summary,
            tags: structured.tags,
            mindmap: structured.mindmap
          }
        });

      } catch (geminiError) {
        console.error(`[${requestId}] [POST message] Error:`, geminiError);
        console.error(`[${requestId}] [POST message] Stack:`, geminiError.stack);
        return res.status(500).json({
          error: 'Failed to process message',
          details: geminiError.message,
          requestId
        });
      }
    }

    // ========== POST /api/chat?action=artifact - 创建 artifact（新架构：从DB获取messages）==========
    if (req.method === 'POST' && action === 'artifact') {
      const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const body = await parseBody(req);
      const { kind, sessionId } = body;

      if (!kind || !['mindmap', 'image', 'save'].includes(kind)) {
        console.error(`[${requestId}] Invalid kind:`, kind);
        return res.status(400).json({ error: 'Invalid or missing "kind" (mindmap/image/save)' });
      }

      if (!sessionId) {
        console.error(`[${requestId}] Missing sessionId`);
        return res.status(400).json({ error: 'Missing "sessionId"' });
      }

      console.log(`[${requestId}] [POST artifact] Kind:`, kind, 'SessionId:', sessionId);

      try {
        // 从DB加载消息
        const { getMessages, saveArtifact } = await import('./supabase.js');
        const messages = await getMessages(sessionId);
        
        console.log(`[${requestId}] Loaded messages from DB:`, messages.length);
        
        // 验证消息数量
        if (kind === 'mindmap' && messages.length < 2) {
          console.warn(`[${requestId}] Not enough messages for mindmap:`, messages.length);
          return res.status(400).json({ 
            error: 'Not enough content to create mindmap', 
            details: `Need at least 2 messages, got ${messages.length}. Please have a conversation first.`,
            requestId 
          });
        }
        
        let artifactResult = null;
        let provider = 'google-gemini';
        let model = 'unknown';

        // ========== kind="mindmap" ==========
        if (kind === 'mindmap') {
          const conversationText = messages.map(m => `${m.sender}: ${m.text}`).join('\n');
          
          console.log(`[${requestId}] Generating mindmap from ${messages.length} messages...`);
          
          const geminiResponse = await callGemini(messages, conversationText, MINDMAP_PROMPT);
          const mindmapData = safeParseGeminiJson(geminiResponse, 'Mindmap');
          
          model = 'gemini-2.0-flash-exp';

          // 保存artifact到DB
          const savedArtifact = await saveArtifact(sessionId, {
            type: 'mindmap',
            prompt: conversationText.substring(0, 500),
            publicUrl: 'mindmap://inline', // mindmap不需要存储URL
            provider,
            model,
            metadata: {
              title: mindmapData.title,
              summary: mindmapData.summary,
              mermaidCode: mindmapData.mermaidCode,
              structuredMindmap: mindmapData
            }
          });
          
          console.log(`[${requestId}] Mindmap artifact saved:`, savedArtifact.id);

          artifactResult = {
            kind: 'mindmap',
            createdAt: new Date().toISOString(),
            summary: mindmapData.summary,
            payload: {
              mermaidCode: mindmapData.mermaidCode,
              title: mindmapData.title,
              structuredMindmap: mindmapData
            },
            provider,
            model
          };

        // ========== kind="image" ==========
        } else if (kind === 'image') {
          console.log(`[${requestId}] ==================== IMAGE GENERATION START ====================`);
          console.log(`[${requestId}] kind: ${kind}`);
          console.log(`[${requestId}] sessionId: ${sessionId}`);
          console.log(`[${requestId}] actor: ${JSON.stringify(actor)}`);
          console.log(`[${requestId}] messages count: ${messages.length}`);
          
          let imageData;
          try {
            // Step 1: 生成图片 prompt
            console.log(`[${requestId}] [Step 1/5] Generating image prompt via Gemini...`);
            const { GoogleGenerativeAI } = await import('@google/generative-ai');
            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
            
            const conversationText = messages.map(m => `${m.sender}: ${m.text}`).join('\n');
            const imagePromptResponse = await model.generateContent(
              IMAGE_PROMPT + '\n\n=== CONVERSATION HISTORY ===\n' + conversationText + '\n\n=== END CONVERSATION ===\n\nNow generate the image description JSON:'
            );
            
            const imageText = imagePromptResponse.response.text();
            const jsonMatch = imageText.match(/\{[\s\S]*\}/);
            imageData = jsonMatch ? JSON.parse(jsonMatch[0]) : {
              title: 'Generated Image',
              summary: 'AI generated image from conversation',
              imagePrompt: conversationText.substring(0, 500)
            };
            console.log(`[${requestId}] Prompt generated: ${imageData.imagePrompt.substring(0, 100)}...`);
          } catch (err) {
            console.error(`[${requestId}] [Step 1/5] FAILED - Prompt generation error:`, err.message);
            return res.status(500).json({ 
              ok: false,
              error: 'Image prompt generation failed', 
              details: err.message,
              requestId
            });
          }
          
          let imageUrl;
          let usedProvider = null;
          let usedModel = null;

          try {
            // Step 2: 检测可用模型
            console.log(`[${requestId}] [Step 2/5] Detecting available image models...`);
            const detectionResult = await detectAvailableImageModels();
            console.log(`[${requestId}] Model detection result:`, {
              hasImagen: detectionResult.hasImagen,
              hasGeminiFlash: detectionResult.hasGeminiFlash,
              geminiFlashModel: detectionResult.geminiFlashModel
            });

            // Step 3: 生成图片（优先使用 Gemini Flash）
            console.log(`[${requestId}] [Step 3/5] Generating image...`);
            if (detectionResult.hasGeminiFlash) {
              console.log(`[${requestId}] Using Gemini 2.5 Flash Image...`);
              imageUrl = await callGeminiFlashImage(imageData.imagePrompt);
              usedProvider = 'google-gemini';
              usedModel = 'gemini-2.5-flash-image';
              console.log(`[${requestId}] Gemini Flash Image generated successfully`);
            } else if (detectionResult.hasImagen) {
              console.log(`[${requestId}] Fallback to Imagen 4...`);
              imageUrl = await callImagen(imageData.imagePrompt);
              usedProvider = 'google-imagen';
              usedModel = 'imagen-4.0-generate-001';
              console.log(`[${requestId}] Imagen 4 generated successfully`);
            } else {
              console.error(`[${requestId}] No image generation models available`);
              throw new Error('No image generation models available (neither Gemini Flash nor Imagen)');
            }
            
            // 验证生成的 imageUrl 是 data URL
            if (!imageUrl || !imageUrl.startsWith('data:image')) {
              console.error(`[${requestId}] Invalid image data format:`, imageUrl?.substring(0, 100));
              throw new Error(`Invalid image data returned from ${usedModel}: expected data:image URL`);
            }
            console.log(`[${requestId}] Image data validated (data:image format)`);

          } catch (error) {
            console.error(`[${requestId}] [Step 3/5] FAILED - Image generation error:`, error.message);
            console.error(`[${requestId}] Error stack:`, error.stack);
            return res.status(500).json({ 
              ok: false,
              error: 'Image generation failed', 
              details: error.message,
              requestId
            });
          }

          // Step 4: 上传到 Supabase Storage
          console.log(`[${requestId}] [Step 4/5] Uploading to Supabase Storage...`);
          
          let publicUrl = null;
          let storagePath = null;
          
          try {
            // 提取 base64 数据
            const base64Match = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
            if (!base64Match) {
              console.error(`[${requestId}] Invalid data URL format`);
              throw new Error('Invalid data URL format - cannot extract base64');
            }
            
            const mimeType = base64Match[1];
            const base64Data = base64Match[2];
            const estimatedSizeKB = Math.round(base64Data.length * 0.75 / 1024);
            
            console.log(`[${requestId}] Base64 extracted successfully:`, {
              mimeType,
              estimatedSize: estimatedSizeKB + 'KB',
              base64Length: base64Data.length
            });
            
            // 上传到 Supabase Storage
            console.log(`[${requestId}] Calling uploadImageToStorage...`);
            const { uploadImageToStorage } = await import('./supabase.js');
            const uploadResult = await uploadImageToStorage(base64Data, mimeType, {
              prompt: imageData.imagePrompt,
              sessionId,
              actor
            });
            
            publicUrl = uploadResult.publicUrl;
            storagePath = uploadResult.storagePath;
            
            console.log(`[${requestId}] Upload complete:`, {
              publicUrl,
              storagePath,
              bucket: 'artifacts'
            });
            
            // 验证 publicUrl 格式
            if (!publicUrl || !publicUrl.startsWith('http')) {
              console.error(`[${requestId}] Invalid publicUrl returned:`, publicUrl);
              throw new Error('Supabase returned invalid publicUrl');
            }
            
          } catch (uploadError) {
            console.error(`[${requestId}] [Step 4/5] FAILED - Storage upload error:`, uploadError.message);
            console.error(`[${requestId}] Error stack:`, uploadError.stack);
            return res.status(500).json({
              ok: false,
              error: 'Storage upload failed',
              details: uploadError.message,
              requestId
            });
          }
          
          // Step 5: 保存artifact到DB
          console.log(`[${requestId}] [Step 5/5] Saving artifact to database...`);
          let savedArtifact;
          try {
            savedArtifact = await saveArtifact(sessionId, {
              type: 'image',
              prompt: imageData.imagePrompt,
              storagePath,
              publicUrl,
              provider: usedProvider,
              model: usedModel,
              metadata: {
                title: imageData.title,
                summary: imageData.summary
              }
            });
            console.log(`[${requestId}] Image artifact saved to DB:`, {
              artifactId: savedArtifact.id,
              type: 'image',
              storagePath,
              publicUrl
            });
          } catch (dbError) {
            console.error(`[${requestId}] [Step 5/5] FAILED - Database save error:`, dbError.message);
            // 数据库保存失败但图片已上传，仍返回成功（降级处理）
            console.warn(`[${requestId}] Continuing despite DB error - image is uploaded`);
          }
          
          // 构建返回数据（不包含base64）
          artifactResult = {
            kind: 'image',
            createdAt: new Date().toISOString(),
            summary: imageData.summary,
            payload: {
              imageUrl: publicUrl,
              storagePath,
              imagePrompt: imageData.imagePrompt?.substring(0, 500),
              title: imageData.title,
              provider: usedProvider,
              model: usedModel
            }
          };
          
          // 验证不包含base64
          const payloadStr = JSON.stringify(artifactResult);
          if (payloadStr.includes('base64')) {
            console.error(`[${requestId}] WARNING: base64 detected in artifact payload!`);
          }
          console.log(`[${requestId}] Artifact payload size:`, (payloadStr.length / 1024).toFixed(1), 'KB');

        // ========== kind="save" ==========
        } else if (kind === 'save') {
          console.log(`[${requestId}] Saving conversation...`);
          
          // Save功能只更新chat_history,不需要生成新artifact
          artifactResult = {
            kind: 'save',
            createdAt: new Date().toISOString(),
            summary: 'Conversation saved to archive'
          };
        }

        // 构造响应（不再更新chat_history表，该表将被deprecated）
        const response = {
          message: {
            id: `msg-${Date.now()}`,
            text: `${kind.charAt(0).toUpperCase() + kind.slice(1)} created successfully`,
            sender: 'bot',
            timestamp: new Date().toISOString()
          },
          requestId
        };

        // 根据kind添加特定数据
        if (kind === 'mindmap' && artifactResult) {
          response.structuredMindmap = {
            mermaidCode: artifactResult.payload.mermaidCode || 'mindmap\n  root((No data))',
            title: artifactResult.payload.title,
            summary: artifactResult.summary,
            provider: artifactResult.provider,
            model: artifactResult.model
          };
        }
        
        if (kind === 'image' && artifactResult) {
          // 验证 imageUrl 必须存在且可访问
          const imageUrl = artifactResult.payload.imageUrl;
          if (!imageUrl || !imageUrl.startsWith('http')) {
            console.error(`[${requestId}] CRITICAL: Invalid imageUrl:`, imageUrl);
            return res.status(500).json({
              ok: false,
              error: 'Invalid image URL',
              details: 'Image upload succeeded but publicUrl is invalid',
              requestId
            });
          }
          
          // 统一的 artifact 响应结构
          response.artifact = {
            type: 'image',
            title: artifactResult.payload.title || 'Generated Image',
            summary: artifactResult.summary || '',
            storagePath: artifactResult.payload.storagePath,
            imageUrl: imageUrl,
            prompt: artifactResult.payload.imagePrompt || '',
            provider: artifactResult.payload.provider,
            model: artifactResult.payload.model
          };
          
          // 向后兼容：保留 generatedImage 字段
          response.generatedImage = response.artifact;
          
          // 标记成功
          response.ok = true;
          
          // 验证响应中不包含 base64
          const responseStr = JSON.stringify(response);
          if (responseStr.includes('base64')) {
            console.error(`[${requestId}] CRITICAL: base64 detected in response!`);
            return res.status(500).json({
              ok: false,
              error: 'Response validation failed',
              details: 'Response contains base64 data (should only have URL)',
              requestId
            });
          }
          console.log(`[${requestId}] Image response validated:`, imageUrl);
          console.log(`[${requestId}] Response size:`, (responseStr.length / 1024).toFixed(1) + 'KB');
        }

        console.log(`[${requestId}] Artifact ${kind} completed successfully`);
        
        // ========== 只有 kind='save' 才保存到 chat_history (Archive) ==========
        if (kind === 'save') {
          console.log(`[${requestId}] Saving to archive (chat_history)...`);
          
          // 查询是否已有该 sessionId 的记录
          const { data: existingRecord } = await supabase
            .from('chat_history')
            .select('*')
            .eq('owner_type', actor.type)
            .eq('owner_id', actor.id)
            .eq('content_json->>sessionId', sessionId)
            .maybeSingle();
          
          // 生成标题
          const generatedTitle = await generateSessionTitle(messages);
          const title = generatedTitle || `Session ${new Date().toLocaleString()}`;
          const lastMessage = messages.slice(-1)[0]?.text?.substring(0, 200) || 'Saved conversation';
          
          if (existingRecord) {
            // UPDATE: 更新现有记录
            await supabase
              .from('chat_history')
              .update({
                title,
                last_message: lastMessage,
                message_count: messages.length,
                tags: Array.from(new Set([...(existingRecord.tags || []), 'save'])),
                updated_at: new Date().toISOString()
              })
              .eq('id', existingRecord.id);
            
            console.log(`[${requestId}] Updated archive record:`, existingRecord.id);
          } else {
            // INSERT: 创建新记录
            await supabase
              .from('chat_history')
              .insert({
                owner_type: actor.type,
                owner_id: actor.id,
                title,
                last_message: lastMessage,
                content_json: { sessionId, messages: messages.slice(-10) }, // 只保存最近10条
                message_count: messages.length,
                tags: ['save'],
                is_demo: actor.type === 'guest',
                expires_at: actor.type === 'guest' ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() : null,
                timestamp: new Date().toISOString()
              });
            
            console.log(`[${requestId}] Created new archive record`);
          }
        } else {
          console.log(`[${requestId}] Skipping archive (kind=${kind} does not auto-archive)`);
        }
        
        return res.status(200).json(response);

      } catch (artifactError) {
        console.error(`[${requestId}] Error:`, artifactError);
        return res.status(500).json({
          error: 'Failed to create artifact',
          details: artifactError.message,
          requestId
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
