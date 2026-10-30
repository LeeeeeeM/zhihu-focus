export async function copyTextToClipboard(text: string, root: typeof window = window): Promise<boolean> {
  if (!text) return false;
  try {
    if (root.navigator.clipboard?.writeText) {
      await root.navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* Fall back for browsers without Clipboard API access. */ }

  // Clipboard API is unavailable on HTTP origins such as an intranet NodePort.
  const document = root.document;
  if (typeof document.execCommand !== 'function') return false;
  const activeElement = document.activeElement;
  const selection = root.getSelection();
  const ranges = selection ? Array.from({ length: selection.rangeCount }, (_, index) => selection.getRangeAt(index).cloneRange()) : [];
  const input = document.createElement('textarea');
  input.value = text;
  input.readOnly = true;
  input.tabIndex = -1;
  input.setAttribute('aria-hidden', 'true');
  input.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
  try {
    document.body.appendChild(input);
    input.focus();
    input.select();
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    input.remove();
    if (activeElement instanceof root.HTMLElement) activeElement.focus({ preventScroll: true });
    selection?.removeAllRanges();
    for (const range of ranges) selection?.addRange(range);
  }
}
