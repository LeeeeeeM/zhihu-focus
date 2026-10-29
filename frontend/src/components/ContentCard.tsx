import { ExternalLink } from 'lucide-react';
import type { ContentOpenType, FeedItem, SearchResult } from '../models/content';
import { UserAvatar } from './UserAvatar';

type ReadableContent = { type: ContentOpenType; id: string };
type CardFooterProps = {
  author: string;
  avatar?: string;
  stats: string;
  url: string;
  hasDetail: boolean;
};

function feedReadableContent(item: FeedItem): ReadableContent | null {
  if (item.kind === '问题') return { type: 'question', id: item.id };
  if (item.kind === '回答') return { type: 'answer', id: item.id };
  if (item.kind === '文章') return { type: 'article', id: item.id };
  return null;
}

function searchReadableContent(item: SearchResult): ReadableContent | null {
  const kind = item.kind.toLowerCase();
  if (kind === 'question' || kind === '问题') return { type: 'question', id: item.id };
  if (kind === 'answer') return { type: 'answer', id: item.id };
  if (kind === 'article') return { type: 'article', id: item.id };
  return null;
}

function contentKindLabel(kind: string) {
  if (kind.toLowerCase() === 'question' || kind === '问题') return '问题';
  if (kind.toLowerCase() === 'answer' || kind === '回答') return '回答';
  if (kind.toLowerCase() === 'article' || kind === '文章') return '文章';
  return kind;
}

function CardFooter({ author, avatar, stats, url, hasDetail }: CardFooterProps) {
  return <div className="card-footer">
    <div className="author">
      <UserAvatar size={22} src={avatar} name={author}/>
      <b>{author || '知乎用户'}</b>
      <span>{stats}</span>
    </div>
    <div className="card-actions">
      {url && <a className="detail-link" href={url} target="_blank" rel="noopener noreferrer">{hasDetail ? '查看原文' : '在知乎打开'} <ExternalLink size={14}/></a>}
    </div>
  </div>;
}

export function FeedCard({ item, onOpen }: { item: FeedItem; onOpen: (type: ContentOpenType, id: string) => void }) {
  const readable = feedReadableContent(item);
  return <article className={`feed-card ${readable ? 'feed-card-openable' : ''}`} onClick={event => {
    if ((event.target as HTMLElement).closest('a,button')) return;
    if (readable) onOpen(readable.type, readable.id);
  }}>
    <div className="card-top"><span className={`content-kind kind-${item.kind}`}>{item.kind}</span><span className="dot-sep">·</span><span>{item.category}</span><span className="dot-sep">·</span><span>{item.time}</span></div>
    <div className="feed-body"><div className="feed-copy">
      {readable ? <button className="content-link content-title-button" onClick={() => onOpen(readable.type, readable.id)}>{item.title}</button> : <h2>{item.title}</h2>}
      <p>{item.excerpt}</p>
    </div></div>
    <CardFooter author={item.author} avatar={item.avatar} stats={item.stats} url={item.url} hasDetail={Boolean(readable)}/>
  </article>;
}

export function SearchCard({ item, onOpen }: { item: SearchResult; onOpen: (type: ContentOpenType, id: string) => void }) {
  const readable = searchReadableContent(item);
  const kindLabel = contentKindLabel(item.kind);
  return <article className={`feed-card result-card ${readable ? 'feed-card-openable' : ''}`} onClick={event => {
    if ((event.target as HTMLElement).closest('a,button')) return;
    if (readable) onOpen(readable.type, readable.id);
  }}>
    <div className="card-top"><span className={`content-kind kind-${kindLabel}`}>{kindLabel}</span><span className="dot-sep">·</span><span>搜索</span><span className="dot-sep">·</span><span>知乎搜索</span></div>
    <div className="feed-body"><div className="feed-copy">
      {readable ? <button className="content-link content-title-button" onClick={() => onOpen(readable.type, readable.id)}>{item.title}</button> : <h2>{item.title}</h2>}
      <p className="search-excerpt">{item.excerpt}</p>
    </div></div>
    <CardFooter author={item.author} avatar={item.avatar} stats={item.stats} url={item.url} hasDetail={Boolean(readable)}/>
  </article>;
}
