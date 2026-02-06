const SYSTEM_TAGS = new Set(['save', 'image', 'mindmap', 'auto-saved']);

export function isSystemTag(tag) {
  if (!tag) return false;
  return SYSTEM_TAGS.has(String(tag).toLowerCase());
}

export function filterSystemTags(tags) {
  if (!Array.isArray(tags)) return [];
  return tags.filter((tag) => !isSystemTag(tag));
}

function cleanTextValue(value) {
  if (!value) return '';
  const text = String(value).trim();
  if (!text) return '';
  if (text.toLowerCase() === 'type something...') return '';
  return text;
}

export function extractCanvasText(contentJson, title = '') {
  const chunks = [];

  if (contentJson && Array.isArray(contentJson.items)) {
    contentJson.items.forEach((item) => {
      if (!item) return;
      if (item.type === 'text' && item.content) {
        const cleaned = cleanTextValue(item.content);
        if (cleaned) chunks.push(cleaned);
      }
      if (item.type === 'mindmap' && item.meta) {
        const titleText = cleanTextValue(item.meta.title);
        const summaryText = cleanTextValue(item.meta.summary);
        if (titleText) chunks.push(titleText);
        if (summaryText) chunks.push(summaryText);
      }
    });
  }

  if (chunks.length === 0 && contentJson) {
    const contentText = cleanTextValue(contentJson.content);
    if (contentText) chunks.push(contentText);

    if (Array.isArray(contentJson.messages)) {
      contentJson.messages.forEach((message) => {
        if (!message) return;
        const msgText = cleanTextValue(message.text || message.content);
        if (msgText) chunks.push(msgText);
      });
    }

    if (Array.isArray(contentJson.artifacts)) {
      contentJson.artifacts.forEach((artifact) => {
        if (!artifact) return;
        if (artifact.type === 'mindmap' && artifact.data) {
          const titleText = cleanTextValue(artifact.data.title);
          const summaryText = cleanTextValue(artifact.data.summary);
          if (titleText) chunks.push(titleText);
          if (summaryText) chunks.push(summaryText);
        }
      });
    }
  }

  const cleanedTitle = cleanTextValue(title);
  if (chunks.length === 0 && cleanedTitle) chunks.push(cleanedTitle);

  const combined = chunks.join('\n').trim();
  if (!combined) return '';

  return combined.length > 4000 ? combined.slice(0, 4000) : combined;
}

export function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];

  const normalized = [];
  const seen = new Set();

  tags.forEach((raw) => {
    if (typeof raw !== 'string') return;
    let tag = raw.trim();
    if (!tag) return;

    tag = tag.replace(/^#+/, '');
    tag = tag.replace(/[\s_]+/g, '-');
    tag = tag.replace(/[^\p{L}\p{N}-]+/gu, '');
    tag = tag.replace(/-+/g, '-').replace(/^-+|-+$/g, '');

    if (!tag) return;

    if (/[A-Za-z]/.test(tag)) {
      tag = tag.toLowerCase();
    }

    if (tag.length > 40) {
      tag = tag.slice(0, 40);
    }

    if (!tag || seen.has(tag)) return;
    if (isSystemTag(tag)) return;

    seen.add(tag);
    normalized.push(tag);
  });

  return normalized;
}

function extractJson(text) {
  if (!text || typeof text !== 'string') return null;
  let cleaned = text.trim();

  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/i, '').replace(/\s*```$/i, '');
  }

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(cleaned);
  } catch (error) {
    console.warn('[Tagging] Failed to parse Gemini JSON:', error);
    return null;
  }
}

export async function generateSemanticTags(text) {
  if (!text || !text.trim()) return [];

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[Tagging] GEMINI_API_KEY not configured');
    return [];
  }

  const systemPrompt = `You create concise semantic tags for a piece of text.\n\nReturn ONLY valid JSON with the shape: {"tags":["tag-one","tag-two","tag-three"]}.\nRequirements:\n- Exactly 3 tags if possible.\n- Same language as the input text.\n- Kebab-case (lowercase for Latin, use hyphens instead of spaces).\n- No # symbol, no duplicates, no extra fields.`;

  const userPrompt = `Text:\n${text}\n\nJSON:`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
          temperature: 0.2,
          topP: 0.9,
          maxOutputTokens: 256,
          responseMimeType: 'application/json'
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn('[Tagging] Gemini error:', response.status, errorText.substring(0, 200));
      return [];
    }

    const data = await response.json();
    const textResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textResponse) {
      console.warn('[Tagging] Gemini returned empty response');
      return [];
    }

    const parsed = extractJson(textResponse);
    const normalized = normalizeTags(parsed?.tags || []);
    return normalized.slice(0, 3);
  } catch (error) {
    console.warn('[Tagging] Gemini request failed:', error?.message || error);
    return [];
  }
}

export function hasLegacySystemTags(tags) {
  if (!Array.isArray(tags)) return false;
  return tags.some((tag) => isSystemTag(tag));
}

export { SYSTEM_TAGS };
