import createDOMPurify from 'dompurify';
import type { ImageDisplayMode } from './readingPreferences';

const allowedTags = [
  'p', 'br', 'div', 'span', 'strong', 'b', 'em', 'i', 'del', 's', 'u', 'sup', 'sub',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code', 'ul', 'ol', 'li',
  'a', 'img', 'figure', 'figcaption', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
];

function safeUrl(value: string | null): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value, 'https://www.zhihu.com/');
    return (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

export function createRichContentSanitizer(root: typeof window) {
  const purify = createDOMPurify(root);
  let currentMode: ImageDisplayMode = 'show';
  purify.addHook('afterSanitizeAttributes', node => {
    if (node.tagName === 'IMG') {
      if (currentMode !== 'show') {
        node.removeAttribute('src');
        return;
      }
      const src = ['data-actualsrc', 'data-original', 'data-src', 'src']
        .map(name => safeUrl(node.getAttribute(name)))
        .find(Boolean);
      if (src) node.setAttribute('src', src);
      else node.removeAttribute('src');
      node.setAttribute('loading', 'lazy');
      node.setAttribute('referrerpolicy', 'no-referrer');
    }
    if (node.tagName === 'A') {
      const href = safeUrl(node.getAttribute('href'));
      if (href) {
        node.setAttribute('href', href);
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
      } else {
        node.removeAttribute('href');
      }
    }
  });
  return (html: string, mode: ImageDisplayMode = 'show') => {
    currentMode = mode;
    const fragment = purify.sanitize(html, {
      ALLOWED_TAGS: mode === 'hide' ? allowedTags.filter(tag => tag !== 'img') : allowedTags,
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'data-actualsrc', 'data-original', 'data-src'],
      ALLOW_DATA_ATTR: false,
      RETURN_DOM_FRAGMENT: true,
    });
    // Zhihu comments also represent images as a text link instead of an img.
    fragment.querySelectorAll('a[href]').forEach(link => {
      const label = link.textContent?.trim();
      if (!label || !['查看图片', '图片', '[图片]'].includes(label)) return;
      const href = link.getAttribute('href');
      if (!href) return;
      const url = new URL(href);
      if (!(url.hostname === 'zhimg.com' || url.hostname.endsWith('.zhimg.com')) ||
          !/\.(?:jpe?g|png|gif|webp|avif|bmp)$/i.test(url.pathname)) return;
      if (mode === 'hide') {
        link.remove();
        return;
      }
      const image = root.document.createElement('img');
      image.setAttribute('alt', '图片');
      if (mode === 'show') {
        image.setAttribute('src', href);
        image.setAttribute('loading', 'lazy');
        image.setAttribute('referrerpolicy', 'no-referrer');
      }
      link.replaceWith(image);
    });
    if (mode === 'placeholder') {
      fragment.querySelectorAll('img').forEach(image => {
        const placeholder = root.document.createElement('span');
        placeholder.className = 'image-placeholder';
        placeholder.setAttribute('role', 'img');
        placeholder.setAttribute('aria-label', '图片');
        placeholder.textContent = '图片';
        image.replaceWith(placeholder);
      });
    }
    const container = root.document.createElement('div');
    container.appendChild(fragment);
    return container.innerHTML;
  };
}
