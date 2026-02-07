/**
 * 测量文本在 Canvas 中的实际渲染高度
 * 使用与 CanvasDetail AutoResizingTextarea 完全相同的 textarea 元素和样式进行测量
 * @param text - 文本内容
 * @param widthPx - 容器宽度（summary 用 400，纯消息用 600）
 * @returns 测量得到的高度（像素）
 */
export function measureCanvasTextHeight(text: string, widthPx: number): number {
  if (!text || typeof document === 'undefined') return 120;

  const textarea = document.createElement('textarea');
  textarea.setAttribute('data-measure', 'true');
  textarea.value = text;
  textarea.readOnly = true;
  // 与 CanvasDetail AutoResizingTextarea 完全一致
  textarea.style.cssText = `
    position: absolute;
    left: -9999px;
    top: 0;
    visibility: hidden;
    width: ${widthPx}px;
    min-height: 3rem;
    padding: 0.2rem 0 0 0;
    margin: 0;
    border: none;
    outline: none;
    resize: none;
    overflow: hidden;
    font-family: 'Quicksand', Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 1.5rem;
    font-weight: 700;
    line-height: 3rem;
    letter-spacing: 0.01em;
    box-sizing: border-box;
  `;
  document.body.appendChild(textarea);
  // 与 AutoResizingTextarea 一样：height = scrollHeight
  textarea.style.height = 'auto';
  const scrollHeight = textarea.scrollHeight;
  document.body.removeChild(textarea);
  // 加上 Canvas 文本项父容器的 pt-2 pb-2 (8px + 8px = 16px)
  const total = Math.ceil(scrollHeight + 16);
  // 保守加一点余量，避免字体/子像素差异导致轻微重叠
  return Math.ceil(total * 1.05);
}
