import { useLayoutEffect } from 'react';
import { Button, Empty, Spin } from 'antd';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { useHistoryStore } from '../store/useHistoryStore';
import { useAutoLoad } from '../hooks/useAutoLoad';
import { useContentOpener } from '../hooks/useContentOpener';
import { ContentTabLink } from '../components/ContentTabLink';
import { isZhihuCookieStorageKey, readZhihuCookie, zhihuCookieChangedEvent } from '../services/searchCredential';

const kindLabels: Record<string, string> = { answer: '回答', article: '文章', question: '问题', pin: '想法', profile: '用户', zvideo: '视频' };

export default function HistoryPage() {
  const { items, loading, moreLoading, error, hasMore, refresh, loadMore, ensureLoaded, setScrollY } = useHistoryStore(useShallow(state => ({
    items: state.items, loading: state.loading, moreLoading: state.moreLoading, error: state.error, hasMore: state.hasMore,
    refresh: state.refresh, loadMore: state.loadMore, ensureLoaded: state.ensureLoaded, setScrollY: state.setScrollY,
  })));
  const handleOpen = useContentOpener();
  const { sentinel: loadSentinel, automatic, pause } = useAutoLoad({ hasItems: items.length > 0, hasMore, loading, moreLoading, error, loadMore });

  useLayoutEffect(() => {
    let cookie = readZhihuCookie();
    void ensureLoaded();
    window.scrollTo(0, useHistoryStore.getState().scrollY);
    const rememberScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener('scroll', rememberScroll, { passive: true });
    const changed = () => {
      const next = readZhihuCookie();
      if (cookie !== next) {
        cookie = next;
        pause();
        void ensureLoaded(); window.scrollTo(0, 0);
      }
    };
    const storage = (event: StorageEvent) => { if (isZhihuCookieStorageKey(event.key)) changed(); };
    window.addEventListener(zhihuCookieChangedEvent, changed);
    window.addEventListener('storage', storage);
    return () => {
      window.removeEventListener('scroll', rememberScroll);
      window.removeEventListener(zhihuCookieChangedEvent, changed);
      window.removeEventListener('storage', storage);
    };
  }, [ensureLoaded, setScrollY, pause]);

  const refreshHistory = () => {
    pause();
    window.scrollTo(0, 0); void refresh();
  };

  return <div className="history-page">
    <div className="welcome history-welcome"><div className="eyebrow"><span className="eyebrow-line"/> READING HISTORY</div><h1>找回读过的内容</h1><p>查看当前知乎账号的云端浏览记录。</p></div>
    <div className="section-head"><h2>浏览历史</h2><div className="section-actions"><Button type="text" icon={<RefreshCw size={13}/>} loading={loading} onClick={refreshHistory}>刷新记录</Button></div></div>
    {error && <div className="error-notice" role="status">{error} <Link to="/settings">设置与 Cookie</Link>{!hasMore && <Button type="link" onClick={refreshHistory}>重试</Button>}</div>}
    {loading ? <div className="loading-state"><Spin/><span>正在读取浏览历史…</span></div>
      : items.length ? <div className="feed-list">{items.map(item => {
        const kind = item.kind;
        const readable = kind === 'answer' || kind === 'article' || kind === 'question';
        const open = () => {
          if (kind === 'question' || kind === 'answer' || kind === 'article') handleOpen(kind, item.id);
        };
        return <article className={`feed-card ${readable ? 'feed-card-openable' : ''}`} key={`${kind}:${item.id}`} onClick={event => {
          if (!(event.target as HTMLElement).closest('a,button') && readable) open();
        }}>
          <div className="card-top"><span className="content-kind">{kindLabels[kind] || '内容'}</span>{item.time && <><span className="dot-sep">·</span><span>{item.time} 浏览</span></>}</div>
          <div className="feed-body"><div className="feed-copy">{readable ? <button className="content-link content-title-button" onClick={open}>{item.title}</button> : <h2>{item.title}</h2>}<p>{item.excerpt}</p></div></div>
          <div className="card-footer"><div className="author"><b>{item.author}</b></div><div className="card-actions">{(kind === 'answer' || kind === 'article' || kind === 'question') && <ContentTabLink type={kind} id={item.id}/>}<a className="detail-link" href={item.url} target="_blank" rel="noopener noreferrer">在知乎打开 <ExternalLink size={14}/></a></div></div>
        </article>;
      })}</div> : !error && <Empty className="page-empty" description="暂无云端浏览记录"/>}
    {hasMore && !loading && (automatic
      ? <div className="load-sentinel" ref={loadSentinel} aria-live="polite">{moreLoading ? <><Spin size="small"/> 正在加载更多历史…</> : '继续向下滚动以加载'}</div>
      : <Button className="load-more" type="text" loading={moreLoading} onClick={() => void loadMore()}>{error ? '重试加载' : '加载更多历史'}　↓</Button>)}
    {!loading && !hasMore && items.length > 0 && !error && <div className="feed-end">已经到底了</div>}
  </div>;
}
