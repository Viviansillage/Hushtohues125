/**
 * Guest ID 管理：为未登录用户生成和维护唯一标识
 */

const GUEST_ID_KEY = 'hushtohues_guest_id';

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
    } else {
      console.log('✅ Using existing guest ID:', guestId);
    }
    
    return guestId;
  } catch (error) {
    // localStorage 不可用（隐私模式/禁用），使用临时 ID
    console.warn('localStorage not available, using temporary guest ID');
    return `guest-temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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
 * 检查当前是否是 Guest 模式
 * @returns {boolean}
 */
export function isGuestMode(): boolean {
  // 未来可扩展：检查是否有 Supabase Auth session
  // const session = supabase.auth.getSession();
  // return !session;
  return true; // 当前版本全部都是 guest
}
