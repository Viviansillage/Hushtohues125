/**
 * Measure actual rendered text height in Canvas
 * Uses same textarea element and styles as CanvasDetail AutoResizingTextarea
 * @param text - Text content
 * @param widthPx - Container width (400 for summary, 600 for plain message)
 * @returns Measured height in pixels
 */
export function measureCanvasTextHeight(text: string, widthPx: number): number {
  if (!text || typeof document === 'undefined') return 120;

  const textarea = document.createElement('textarea');
  textarea.setAttribute('data-measure', 'true');
  textarea.value = text;
  textarea.readOnly = true;
  // Same as CanvasDetail AutoResizingTextarea
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
  // Same as AutoResizingTextarea: height = scrollHeight
  textarea.style.height = 'auto';
  const scrollHeight = textarea.scrollHeight;
  document.body.removeChild(textarea);
  // Add pt-2 pb-2 (8px + 8px = 16px) from Canvas text item parent
  const total = Math.ceil(scrollHeight + 16);
  // Add small margin to avoid overlap from font/subpixel differences
  return Math.ceil(total * 1.05);
}
