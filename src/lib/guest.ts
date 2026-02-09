/**
 * Guest ID management: generate and maintain unique ID for unauthenticated users
 */

const GUEST_ID_KEY = 'hushtohues_guest_id';
const CHAT_SESSION_ID_KEY = 'hushtohues_chat_session_id';
const GUEST_DISPLAY_NAME_KEY = 'hushtohues_guest_display_name';

/**
 * Generate UUID v4
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Sanitize message data for API requests
 * Remove ALL base64/binary fields to prevent 413 FUNCTION_PAYLOAD_TOO_LARGE
 * @param messages - Raw message array
 * @returns Sanitized messages (text and URL refs only)
 */
export function sanitizeForApiRequest(messages: any[]): any[] {
  return messages.map(msg => {
    // Keep only required fields
    const clean: any = {
      id: msg.id,
      text: msg.text,
      sender: msg.sender,
      timestamp: typeof msg.timestamp === 'string' ? msg.timestamp : msg.timestamp?.toISOString?.() || new Date().toISOString()
    };
    
    // If artifact exists, keep only type and minimal data
    if (msg.artifact) {
      clean.artifact = {
        type: msg.artifact.type
      };
      
      // Pass only necessary metadata, never base64/binary
      if (msg.artifact.data) {
        const data = msg.artifact.data;
        clean.artifact.data = {
          // Keep only URL and text metadata
          imageUrl: data.imageUrl?.startsWith('http') ? data.imageUrl : undefined,
          storagePath: data.storagePath,
          imagePrompt: data.imagePrompt,
          title: data.title,
          provider: data.provider,
          model: data.model,
          mermaidCode: data.mermaidCode,
          // Explicitly exclude all dangerous fields
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
 * Sanitize messages: remove large base64/binary fields to prevent QuotaExceededError
 * @param messages - Raw message array
 * @returns Sanitized messages (URL refs only)
 */
export function sanitizeMessagesForLocalStorage(messages: any[]): any[] {
  return messages.map(msg => {
    // Deep copy message
    const sanitized = { ...msg };
    
    // Remove dangerous fields (base64 image data)
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
    
    // Sanitize artifact data
    if (sanitized.artifact?.data) {
      const artifactData = { ...sanitized.artifact.data };
      
      // Keep only URL refs, remove base64
      dangerousFields.forEach(field => {
        delete (artifactData as any)[field];
      });
      
      // If imageUrl is data URL, remove it (should use Supabase URL)
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
 * Get or create Guest ID
 * - Read from localStorage if exists
 * - If not, generate new and save
 * @returns {string} guest ID (UUID format)
 */
export function getOrCreateGuestId(): string {
  try {
    // Try to read from localStorage
    let guestId = localStorage.getItem(GUEST_ID_KEY);
    
    if (!guestId) {
      // Generate new guest ID
      guestId = `guest-${generateUUID()}`;
      localStorage.setItem(GUEST_ID_KEY, guestId);
      console.log('🆕 Created new guest ID:', guestId);
    }
    // Existing guest ID - no need to log every time
    
    return guestId;
  } catch (error) {
    // localStorage unavailable (private mode/disabled), use temp ID
    console.warn('localStorage not available, using temporary guest ID');
    return `guest-temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Get localStorage key for Chat Session ID (scoped by guestId)
 */
export function getChatMessagesKey(): string {
  const guestId = getOrCreateGuestId();
  const sessionId = getOrCreateChatSessionId();
  return `hushtohues_chat_messages_${guestId}_${sessionId}`;
}

/**
 * Get Guest display name (localStorage fallback for guests with no posts)
 */
export function getGuestDisplayName(): string | null {
  try {
    return localStorage.getItem(GUEST_DISPLAY_NAME_KEY);
  } catch {
    return null;
  }
}

/**
 * Save Guest display name to localStorage (persist after rename, for guests with no posts)
 */
export function setGuestDisplayName(name: string): void {
  try {
    localStorage.setItem(GUEST_DISPLAY_NAME_KEY, name);
  } catch {
    // ignore
  }
}

/**
 * Clear Guest ID (used after login or reset)
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
 * Get or create Chat Session ID
 * - Read current session ID from localStorage
 * - If not exists, generate new and save
 * @returns {string} session ID (UUID format)
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
 * Create new Chat Session (clear current conversation)
 * @returns {string} new session ID
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
 * Reset chat session: create new sessionId and clear message history
 * Used for "New Chat" feature
 * @returns {string} new session ID
 */
export function resetChatSession(): string {
  try {
    // Create new session ID
    const newSessionId = `session-${generateUUID()}`;
    localStorage.setItem(CHAT_SESSION_ID_KEY, newSessionId);
    
    // Clear message records for new session
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
 * Check if currently in Guest mode
 * @returns {boolean}
 */
export function isGuestMode(): boolean {
  // Future: check for Supabase Auth session
  // const session = supabase.auth.getSession();
  // return !session;
  return true; // All users are guest in current version
}
