/**
 * Guest ID 管理：为未登录用户生成和维护唯一标识
 */

const GUEST_ID_KEY = 'hushtohues_guest_id';
const CHAT_SESSION_ID_KEY = 'hushtohues_chat_session_id';
const GUEST_DISPLAY_NAME_KEY = 'hushtohues_guest_display_name';

/**
 * 生成 UUID v4
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * 清理用于 API 请求的消息数据
 * 移除 ALL base64/binary 字段，防止 413 FUNCTION_PAYLOAD_TOO_LARGE
 * @param messages - 原始消息数组
 * @returns 清理后的消息数组（只保留文本和 URL 引用）
 */
export function sanitizeForApiRequest(messages: any[]): any[] {
  return messages.map(msg => {
    // 只保留必要字段
    const clean: any = {
      id: msg.id,
      text: msg.text,
      sender: msg.sender,
      timestamp: typeof msg.timestamp === 'string' ? msg.timestamp : msg.timestamp?.toISOString?.() || new Date().toISOString()
    };
    
    // 如果有 artifact，只保留 type 和最小化的 data
    if (msg.artifact) {
      clean.artifact = {
        type: msg.artifact.type
      };
      
      // 只传递必要的元数据，绝对不传递 base64/binary
      if (msg.artifact.data) {
        const data = msg.artifact.data;
        clean.artifact.data = {
          // 只保留 URL 和文本元数据
          imageUrl: data.imageUrl?.startsWith('http') ? data.imageUrl : undefined,
          storagePath: data.storagePath,
          imagePrompt: data.imagePrompt,
          title: data.title,
          provider: data.provider,
          model: data.model,
          mermaidCode: data.mermaidCode,
          // 明确排除所有危险字段
          // imageBase64: REMOVED
          // inlineData: REMOVED
          // dataUrl: REMOVED
          // rawImage: REMOVED
          // bytes: REMOVED
        };
      }
    }
    
    return clean;
  });
}

/**
 * 清理消息数据，移除大型 base64/binary 字段，防止 QuotaExceededError
 * @param messages - 原始消息数组
 * @returns 清理后的消息数组（只保留 URL 引用）
 */
export function sanitizeMessagesForLocalStorage(messages: any[]): any[] {
  return messages.map(msg => {
    // 深拷贝消息
    const sanitized = { ...msg };
    
    // 删除危险字段（base64 图片数据）
    const dangerousFields = [
      'imageBase64',
      'inlineData',
      'dataUrl',
      'rawImage',
      'bytes',
      'bytesBase64Encoded'
    ];
    
    dangerousFields.forEach(field => {
      delete (sanitized as any)[field];
    });
    
    // 清理 artifact 数据
    if (sanitized.artifact?.data) {
      const artifactData = { ...sanitized.artifact.data };
      
      // 只保留 URL 引用，删除 base64
      dangerousFields.forEach(field => {
        delete (artifactData as any)[field];
      });
      
      // 如果 imageUrl 是 data URL，删除它（应该使用 Supabase URL）
      if (artifactData.imageUrl?.startsWith('data:')) {
        console.warn('⚠️ Found data URL in artifact, removing to prevent localStorage overflow');
        (artifactData as any).imageUrl = null;
      }
      
      sanitized.artifact = {
        ...sanitized.artifact,
        data: artifactData
      };
    }
    
    return sanitized;
  });
}

/**
 * 获取或创建 Guest ID
 * - 从 localStorage 读取已有的 guest_id
 * - 如果不存在，生成新的并保存
 * @returns {string} guest ID (UUID 格式)
 */
export function getOrCreateGuestId(): string {
  try {
    // 尝试从 localStorage 读取
    let guestId = localStorage.getItem(GUEST_ID_KEY);
    
    if (!guestId) {
      // 生成新的 guest ID
      guestId = `guest-${generateUUID()}`;
      localStorage.setItem(GUEST_ID_KEY, guestId);
      console.log('🆕 Created new guest ID:', guestId);
    }
    // Existing guest ID - no need to log every time
    
    return guestId;
  } catch (error) {
    // localStorage 不可用（隐私模式/禁用），使用临时 ID
    console.warn('localStorage not available, using temporary guest ID');
    return `guest-temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * 获取 Chat Session ID 的 localStorage key（按 guestId 隔离）
 */
export function getChatMessagesKey(): string {
  const guestId = getOrCreateGuestId();
  const sessionId = getOrCreateChatSessionId();
  return `hushtohues_chat_messages_${guestId}_${sessionId}`;
}

/**
 * 获取 Guest 自定义昵称（localStorage 兜底，用于无帖子的 guest）
 */
export function getGuestDisplayName(): string | null {
  try {
    return localStorage.getItem(GUEST_DISPLAY_NAME_KEY);
  } catch {
    return null;
  }
}

/**
 * 保存 Guest 自定义昵称到 localStorage（改名后持久化，供无帖子时使用）
 */
export function setGuestDisplayName(name: string): void {
  try {
    localStorage.setItem(GUEST_DISPLAY_NAME_KEY, name);
  } catch {
    // ignore
  }
}

/**
 * 清除 Guest ID（用于登录后或重置）
 */
export function clearGuestId(): void {
  try {
    localStorage.removeItem(GUEST_ID_KEY);
    console.log('🗑️  Guest ID cleared');
  } catch (error) {
    console.warn('Failed to clear guest ID:', error);
  }
}

/**
 * 获取或创建 Chat Session ID
 * - 从 localStorage 读取当前会话 ID
 * - 如果不存在，生成新的并保存
 * @returns {string} session ID (UUID 格式)
 */
export function getOrCreateChatSessionId(): string {
  try {
    let sessionId = localStorage.getItem(CHAT_SESSION_ID_KEY);
    
    if (!sessionId) {
      sessionId = `session-${generateUUID()}`;
      localStorage.setItem(CHAT_SESSION_ID_KEY, sessionId);
      console.log('🆕 Created new chat session:', sessionId);
    }
    
    return sessionId;
  } catch (error) {
    console.warn('localStorage not available, using temporary session ID');
    return `session-temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * 创建新的 Chat Session（清空当前对话）
 * @returns {string} 新的 session ID
 */
export function createNewChatSession(): string {
  try {
    const sessionId = `session-${generateUUID()}`;
    localStorage.setItem(CHAT_SESSION_ID_KEY, sessionId);
    console.log('🔄 Started new chat session:', sessionId);
    return sessionId;
  } catch (error) {
    console.warn('Failed to create new session');
    return `session-temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * 重置聊天会话：创建新 sessionId 并清空对应的消息历史
 * 用于 "New Chat" 功能
 * @returns {string} 新的 session ID
 */
export function resetChatSession(): string {
  try {
    // 创建新 session ID
    const newSessionId = `session-${generateUUID()}`;
    localStorage.setItem(CHAT_SESSION_ID_KEY, newSessionId);
    
    // 清空新 session 的消息记录
    const guestId = getOrCreateGuestId();
    const newMessagesKey = `hushtohues_chat_messages_${guestId}_${newSessionId}`;
    localStorage.removeItem(newMessagesKey);
    
    console.log('🆕 Reset chat session:', newSessionId);
    return newSessionId;
  } catch (error) {
    console.warn('Failed to reset session:', error);
    return `session-temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * 检查当前是否是 Guest 模式
 * @returns {boolean}
 */
export function isGuestMode(): boolean {
  // 未来可扩展：检查是否有 Supabase Auth session
  // const session = supabase.auth.getSession();
  // return !session;
  return true; // 当前版本全部都是 guest
}
