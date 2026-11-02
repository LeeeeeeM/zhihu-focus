import { ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ContentOpenType } from '../models/content';

const routes: Record<ContentOpenType, string> = { answer: 'answers', article: 'articles', question: 'questions' };

export function ContentTabLink({ type, id }: { type: ContentOpenType; id: string }) {
  return <Link className="detail-link" to={`/${routes[type]}/${encodeURIComponent(id)}`} target="_blank" rel="noopener noreferrer">新标签页打开 <ExternalLink size={14}/></Link>;
}
