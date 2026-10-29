import { useMemo } from 'react';
import { createRichContentSanitizer } from '../services/richContent';
import { useZhihuStore } from '../store/useZhihuStore';

const sanitize = createRichContentSanitizer(window);

export function RichContent({ html, text, className }: { html?: string; text: string; className: string }) {
  const imageDisplayMode = useZhihuStore(state => state.imageDisplayMode);
  const hasMarkup = Boolean(html && /<[a-z][\s\S]*?>/i.test(html));
  const sanitized = useMemo(() => hasMarkup && html ? sanitize(html, imageDisplayMode) : '', [hasMarkup, html, imageDisplayMode]);

  return hasMarkup
    ? <div className={`${className} rich-content`} dangerouslySetInnerHTML={{ __html: sanitized }}/>
    : <div className={className}>{text}</div>;
}
