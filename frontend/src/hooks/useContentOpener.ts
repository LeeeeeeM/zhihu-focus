import { useCallback } from 'react';
import { useHref } from 'react-router-dom';
import type { ContentOpenType } from '../models/content';
import { useZhihuStore } from '../store/useZhihuStore';

export function useContentOpener() {
  const questionBase = useHref('/questions');
  const openContent = useZhihuStore(state => state.openContent);
  return useCallback((type: ContentOpenType, id: string) => {
    if (type === 'question') {
      window.open(`${questionBase}/${encodeURIComponent(id)}`, '_blank', 'noopener,noreferrer');
      return;
    }
    void openContent(type, id);
  }, [questionBase, openContent]);
}
