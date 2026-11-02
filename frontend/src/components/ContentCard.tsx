import type { ReactNode } from 'react';
import { ExternalLink } from 'lucide-react';
import { ContentTabLink } from './ContentTabLink';
import { contentKindLabel, openableContent, type ContentOpenType, type FeedItem, type SearchResult } from '../models/content';
import { UserAvatar } from './UserAvatar';

type ReadableContent = { type: ContentOpenType; id: string };

function CardFooter({ author, avatar, stats, url, hasDetail, content }: { author: string; avatar?: string; stats: string; url: string; hasDetail: boolean; content: ReadableContent | null }) {
  return <div className="card-footer">
    <div className="author">
      <UserAvatar size={22} src={avatar} name={author}/>
      <b>{author || '知乎用户'}</b>
      <span>{stats}</span>
    </div>
    <div className="card-actions">
      {content && <ContentTabLink type={content.type} id={content.id}/>}
      {url && <a className="detail-link" href={url} target="_blank" rel="noopener noreferrer">{hasDetail ? '查看原文' : '在知乎打开'} <ExternalLink size={14}/></a>}
    </div>
  </div>;
}

function ListCard({ kind, id, meta, title, excerpt, excerptClass = '', author, avatar, stats, url, className, onOpen }: {
  kind: string; id: string; meta: ReactNode; title: string; excerpt: string; excerptClass?: string; author: string; avatar?: string; stats: string; url: string; className: string;
  onOpen: (type: ContentOpenType, id: string) => void;
}) {
  const readable = openableContent(kind, id);
  const label = contentKindLabel(kind);
  const open = () => { if (readable) onOpen(readable.type, readable.id); };
  return <article className={`${className} ${readable ? 'feed-card-openable' : ''}`} onClick={event => {
    if ((event.target as HTMLElement).closest('a,button')) return;
    open();
  }}>
    <div className="card-top"><span className={`content-kind kind-${label}`}>{label}</span>{meta}</div>
    <div className="feed-body"><div className="feed-copy">
      {readable ? <button className="content-link content-title-button" onClick={open}>{title}</button> : <h2>{title}</h2>}
      <p className={excerptClass}>{excerpt}</p>
    </div></div>
    <CardFooter author={author} avatar={avatar} stats={stats} url={url} hasDetail={Boolean(readable)} content={readable}/>
  </article>;
}

export function FeedCard({ item, onOpen }: { item: FeedItem; onOpen: (type: ContentOpenType, id: string) => void }) {
  return <ListCard className="feed-card" kind={item.kind} id={item.id} meta={<><span className="dot-sep">·</span><span>{item.category}</span><span className="dot-sep">·</span><span>{item.time}</span></>} title={item.title} excerpt={item.excerpt} author={item.author} avatar={item.avatar} stats={item.stats} url={item.url} onOpen={onOpen}/>;
}

export function SearchCard({ item, onOpen }: { item: SearchResult; onOpen: (type: ContentOpenType, id: string) => void }) {
  return <ListCard className="feed-card result-card" kind={item.kind} id={item.id} meta={<><span className="dot-sep">·</span><span>搜索</span><span className="dot-sep">·</span><span>知乎搜索</span></>} title={item.title} excerpt={item.excerpt} excerptClass="search-excerpt" author={item.author} avatar={item.avatar} stats={item.stats} url={item.url} onOpen={onOpen}/>;
}
