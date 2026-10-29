import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Empty, Input, Spin, Switch } from 'antd';
import { RefreshCw, Search as SearchIcon } from 'lucide-react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { SearchCard } from '../components/ContentCard';
import { useZhihuStore } from '../store/useZhihuStore';
import type { ContentOpenType } from '../models/content';

const autoLoadStorageKey = 'zhihu-focus-search-auto-load';

function readAutoLoadPreference() {
  try { return window.localStorage.getItem(autoLoadStorageKey) === 'true'; } catch { return false; }
}

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlQuery = searchParams.get('q') || '';
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const results = useZhihuStore(state => state.searchResults);
  const loading = useZhihuStore(state => state.searchLoading);
  const error = useZhihuStore(state => state.searchError);
  const moreError = useZhihuStore(state => state.searchMoreError);
  const hasMore = useZhihuStore(state => state.searchHasMore);
  const moreLoading = useZhihuStore(state => state.searchMoreLoading);
  const searchSource = useZhihuStore(state => state.searchSource);
  const searchUsedFallback = useZhihuStore(state => state.searchUsedFallback);
  const searchQuery = useZhihuStore(state => state.searchQuery);
  const search = useZhihuStore(state => state.search);
  const loadMoreSearch = useZhihuStore(state => state.loadMoreSearch);
  const openContent = useZhihuStore(state => state.openContent);
  const [autoLoad, setAutoLoad] = useState(readAutoLoadPreference);
  const [autoLoadArmed, setAutoLoadArmed] = useState(false);
  const loadSentinel = useRef<HTMLDivElement>(null);
  const queryRef = useRef(urlQuery);
  const navigate = useNavigate();
  const location = useLocation();
  queryRef.current = urlQuery;

  useEffect(() => {
    setQuery(urlQuery);
    setSubmittedQuery(urlQuery);
    setAutoLoadArmed(false);
    window.scrollTo(0, 0);
    if (urlQuery && searchQuery === urlQuery) return;
    void search(urlQuery);
  }, [urlQuery, search, searchQuery]);

  useEffect(() => {
    try { window.localStorage.setItem(autoLoadStorageKey, String(autoLoad)); } catch { /* Storage is optional. */ }
  }, [autoLoad]);

  useEffect(() => {
    const armAfterScroll = () => { if (window.scrollY > 0) setAutoLoadArmed(true); };
    window.addEventListener('scroll', armAfterScroll, { passive: true });
    return () => window.removeEventListener('scroll', armAfterScroll);
  }, []);

  const loadMoreAutomatically = useCallback(async () => {
    if (useZhihuStore.getState().searchMoreLoading) return;
    const countBefore = useZhihuStore.getState().searchResults.length;
    const freshCount = await loadMoreSearch();
    if (queryRef.current !== urlQuery) return;
    if (freshCount === 0 || useZhihuStore.getState().searchResults.length <= countBefore) setAutoLoadArmed(false);
  }, [loadMoreSearch, urlQuery]);

  useEffect(() => {
    const target = loadSentinel.current;
    if (!target || !autoLoad || !autoLoadArmed || !results.length || !hasMore || loading || moreLoading) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) void loadMoreAutomatically();
    }, { rootMargin: '240px 0px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [autoLoad, autoLoadArmed, results.length, hasMore, loading, moreLoading, loadMoreAutomatically]);

  function submit(value = query) { setSearchParams(value.trim() ? { q: value.trim() } : {}); }

  const handleOpen = (type: ContentOpenType, id: string) => {
    if (type === 'question') {
      navigate(`/questions/${id}`, { state: { from: `${location.pathname}${location.search}` } });
      return;
    }
    void openContent(type, id);
  };

  return <>
    <div className="welcome">
      <div className="eyebrow"><span className="eyebrow-line"/> SEARCH ZHIHU</div>
      <h1>搜索你真正关心的</h1>
      <p>搜索知乎问题、回答和文章。</p>
    </div>
    <form className="search-wrap" onSubmit={event => { event.preventDefault(); submit(); }}>
      <SearchIcon size={19}/>
      <Input variant="borderless" placeholder="搜索问题、话题，或输入一个想法…" value={query} onChange={event => setQuery(event.target.value)} aria-label="搜索知乎"/>
      {query && <Button type="text" aria-label="清空搜索" onClick={() => { setQuery(''); setSearchParams({}); void search(''); }}>清空</Button>}
      <Button type="primary" htmlType="submit">搜索 <span>↵</span></Button>
    </form>
    <div className="search-results">
      <div className="section-head">
        <div><div className="eyebrow small">SEARCH RESULTS</div><h2>{submittedQuery ? `关于「${submittedQuery}」` : '搜索知乎'}</h2></div>
        <div className="search-result-actions">
          <span className="result-count">{loading ? '搜索中…' : `${results.length} 条结果`}</span>
          {searchSource && <span className="search-source">{searchSource === 'cookie' ? '个人 Cookie' : searchUsedFallback ? 'Access Secret 兜底' : 'Access Secret'}</span>}
          <Button type="text" icon={<RefreshCw size={13}/>} onClick={() => { setAutoLoadArmed(false); window.scrollTo(0, 0); void search(submittedQuery); }} loading={loading} disabled={!submittedQuery.trim()}>重新搜索</Button>
          <label className="auto-load-control"><span>滚到底自动加载</span><Switch size="small" checked={autoLoad} onChange={setAutoLoad} aria-label="搜索滚到底自动加载"/></label>
        </div>
      </div>
      {error && <div className="error-notice">{error}</div>}
      {moreError && <div className="error-notice">{moreError}</div>}
      {loading ? <div className="loading-state"><Spin/><span>正在搜索知乎…</span></div> : results.length
        ? results.map(result => <SearchCard key={`${result.kind}:${result.id}`} item={result} onOpen={handleOpen}/>)
        : <Empty className="page-empty" image={<SearchIcon size={26}/>} description={error ? '请检查知乎凭证或稍后重试' : submittedQuery ? '还没有找到相关内容，试试更短的关键词' : '输入关键词开始搜索'}/>}
      {hasMore && (autoLoad && autoLoadArmed && results.length
        ? <div className="load-sentinel" ref={loadSentinel} aria-live="polite">{moreLoading ? <><Spin size="small"/> 正在加载更多搜索结果…</> : '继续向下滚动以加载'}</div>
        : <Button className="load-more" type="text" onClick={() => void loadMoreSearch()} loading={moreLoading}>继续搜索　↓</Button>)}
      {!loading && !hasMore && results.length > 0 && !error && <div className="feed-end">已经到底了</div>}
    </div>
    <footer className="footnote">知简 · 为专注阅读而做 <span>真实知乎数据</span></footer>
  </>;
}
