import { useEffect } from 'react';
import { Empty, Spin } from 'antd';
import { Link, useParams } from 'react-router-dom';
import { ContentReader } from '../components/ContentReader';
import { useZhihuStore } from '../store/useZhihuStore';
import type { ContentType } from '../models/content';
import { readZhihuCookie } from '../services/searchCredential';

export default function ContentPage({ type }: { type: ContentType }) {
  const label = type === 'answer' ? '回答' : '文章';
  const { id = '' } = useParams();
  const openContent = useZhihuStore(state => state.openContent);
  const active = useZhihuStore(state => state.readerMode === 'page' && state.contentType === type && state.contentId === id);
  const valid = /^\d{1,32}$/.test(id);
  useEffect(() => {
    window.scrollTo(0, 0);
    if (valid) void openContent(type, id, 'page');
    return () => {
      const state = useZhihuStore.getState();
      if (state.readerMode === 'page' && state.contentType === type && state.contentId === id) state.closeDrawer();
    };
  }, [id, valid, type, openContent]);

  return <div className="content-page">
    <div className="section-head"><h2>{label}详情</h2></div>
    {!readZhihuCookie() && <div className="error-notice">阅读{label}需要知乎 Cookie。<Link to="/settings">前往设置</Link></div>}
    {!valid ? <Empty className="page-empty" description={`无效的${label}链接`}/>
      : active ? <ContentReader/> : <div className="loading-state"><Spin/><span>正在读取{label}…</span></div>}
  </div>;
}
