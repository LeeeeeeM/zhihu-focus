import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Empty, Spin } from 'antd';
import { RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useZhihuStore } from '../store/useZhihuStore';
import type { ContentOpenType } from '../models/content';
import { FeedCard } from '../components/ContentCard';

const recommendationCategories = ['全部', '回答', '文章', '想法'];
const hotListCategories = ['全部', '问题'];

export default function RecommendationPage() {
  const autoLoad = useZhihuStore(state => state.autoLoad);
  const feed = useZhihuStore(state => state.feed);
  const feedLoading = useZhihuStore(state => state.feedLoading);
  const feedError = useZhihuStore(state => state.feedError);
  const feedHasMore = useZhihuStore(state => state.feedHasMore);
  const feedMoreLoading = useZhihuStore(state => state.feedMoreLoading);
  const feedSource = useZhihuStore(state => state.feedSource);
  const refreshFeed = useZhihuStore(state => state.refreshFeed);
  const loadMoreFeed = useZhihuStore(state => state.loadMoreFeed);
  const openContent = useZhihuStore(state => state.openContent);
  const navigate = useNavigate();
  const [category, setCategory] = useState('全部');
  const [autoLoadArmed, setAutoLoadArmed] = useState(false);
  const loadSentinel = useRef<HTMLDivElement>(null);
  const categoryRef = useRef(category);
  categoryRef.current = category;
  const categories = feedSource === 'hotlist' ? hotListCategories : recommendationCategories;
  const visible = useMemo(() => feed.filter(item => category === '全部' || item.kind === category), [feed, category]);
  const hasVisibleItems = visible.length > 0;

  useEffect(() => {
    const armAfterScroll = () => { if (window.scrollY > 0) setAutoLoadArmed(true); };
    window.addEventListener('scroll', armAfterScroll, { passive: true });
    return () => window.removeEventListener('scroll', armAfterScroll);
  }, []);

  useEffect(() => {
    setAutoLoadArmed(false);
    window.scrollTo(0, 0);
  }, [category]);

  useEffect(() => { setCategory('全部'); }, [feedSource]);

  const loadMoreAutomatically = useCallback(async () => {
    const state = useZhihuStore.getState();
    if (!state.autoLoad || state.feedMoreLoading || categoryRef.current !== category) return;
    const countBefore = visible.length;
    await loadMoreFeed();
    if (categoryRef.current !== category) return;
    const updatedFeed = useZhihuStore.getState().feed;
    const countAfter = updatedFeed.filter(item => category === '全部' || item.kind === category).length;
    if (countAfter <= countBefore) setAutoLoadArmed(false);
  }, [category, visible.length, loadMoreFeed]);

  useEffect(() => {
    const target = loadSentinel.current;
    if (!target || !autoLoad || !autoLoadArmed || !hasVisibleItems || !feedHasMore || feedLoading || feedMoreLoading) return;
    let active = true;
    const observer = new IntersectionObserver(entries => {
      if (active && entries.some(entry => entry.isIntersecting)) void loadMoreAutomatically();
    }, { rootMargin: '240px 0px' });
    observer.observe(target);
    return () => { active = false; observer.disconnect(); };
  }, [autoLoad, autoLoadArmed, hasVisibleItems, feedHasMore, feedLoading, feedMoreLoading, loadMoreAutomatically]);

  const handleOpen = (type: ContentOpenType, id: string) => {
    if (type === 'question') {
      navigate(`/questions/${id}`);
      return;
    }
    void openContent(type, id);
  };

  return <>
    <div className="welcome recommendation-welcome">
      <div className="eyebrow"><span className="eyebrow-line"/> YOUR QUIET CORNER</div>
      <h1>把注意力，留给值得的内容。</h1>
      <p>一个更安静的知乎阅读空间。只留下推荐和搜索。</p>
    </div>
    <div className="feed-toolbar">
      <div className="tabs">{categories.map(value => <button className={category === value ? 'selected' : ''} key={value} onClick={() => setCategory(value)}>{value}</button>)}</div>
      <div className="feed-toolbar-actions">
        {feedSource && <span className="feed-source">{feedSource === 'hotlist' ? '知乎热榜' : '个性化推荐'}</span>}
        <Button type="text" icon={<RefreshCw size={13}/>} onClick={() => { setAutoLoadArmed(false); window.scrollTo(0, 0); void refreshFeed(); }} loading={feedLoading}>重新推荐</Button>
      </div>
    </div>
    {feedError && <div className="error-notice">{feedError}</div>}
    {feedLoading ? <div className="loading-state"><Spin/><span>正在加载知乎推荐…</span></div> : visible.length
      ? <div className="feed-list">{visible.map(item => <FeedCard key={`${item.kind}:${item.id}`} item={item} onOpen={handleOpen}/>)}</div>
      : <Empty className="page-empty" description={feedError ? '推荐暂时不可用' : '当前分类没有推荐内容'}/>}
    {feedHasMore && (autoLoad && autoLoadArmed && hasVisibleItems
      ? <div className="load-sentinel" ref={loadSentinel} aria-live="polite">{feedMoreLoading ? <><Spin size="small"/> 正在加载更多推荐…</> : '继续向下滚动以加载'}</div>
      : <Button className="load-more" type="text" onClick={() => void loadMoreFeed()} loading={feedMoreLoading}>继续探索　↓</Button>)}
    {!feedLoading && !feedHasMore && !feedError && <div className="feed-end">已经到底了</div>}
  </>;
}
