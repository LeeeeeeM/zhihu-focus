import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useZhihuStore } from '../store/useZhihuStore';

type Options = {
  hasItems: boolean;
  hasMore: boolean;
  loading: boolean;
  moreLoading: boolean;
  error?: string;
  resetKey?: string;
  loadMore: () => Promise<number>;
};

export function useAutoLoad(options: Options) {
  const enabled = useZhihuStore(state => state.autoLoad);
  const [armed, setArmed] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const latest = useRef(options);
  latest.current = options;
  const generation = useRef(0);
  const busy = useRef(false);
  const pause = useCallback(() => { generation.current++; busy.current = false; setArmed(false); }, []);

  useLayoutEffect(() => {
    pause();
    return () => { generation.current++; };
  }, [options.resetKey, pause]);

  useEffect(() => {
    const onScroll = () => { if (window.scrollY > 0) setArmed(true); };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const target = sentinel.current;
    if (!target || !enabled || !armed || !options.hasItems || !options.hasMore || options.loading || options.moreLoading || options.error) return;
    let active = true;
    const observer = new IntersectionObserver(entries => {
      const current = latest.current;
      if (!active || busy.current || !useZhihuStore.getState().autoLoad || !current.hasMore || current.loading || current.moreLoading || current.error || !entries.some(entry => entry.isIntersecting)) return;
      busy.current = true;
      const token = generation.current;
      void (async () => {
        try {
          const added = await current.loadMore();
          if (token === generation.current && added === 0) setArmed(false);
        } catch {
          if (token === generation.current) setArmed(false);
        } finally {
          if (token === generation.current) busy.current = false;
        }
      })();
    }, { rootMargin: '240px 0px' });
    observer.observe(target);
    return () => { active = false; observer.disconnect(); };
  }, [enabled, armed, options.hasItems, options.hasMore, options.loading, options.moreLoading, options.error, options.resetKey, options.loadMore]);

  return { sentinel, automatic: enabled && armed && options.hasItems && !options.error, pause };
}
