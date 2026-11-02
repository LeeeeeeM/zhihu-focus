export type FeedKind = 'answer' | 'article' | 'question' | 'pin';
export type FeedItem = { id:string; kind: FeedKind; category:string; title:string; excerpt:string; author:string; avatar?:string; stats:string; time:string; tag?:string; url:string; };
export type FeedPage = { items: FeedItem[]; nextCursor?: string; hasMore: boolean; source?:'recommendation'|'hotlist' };
export type SearchInput = { query:string; cursor?:string; cookie?:string };
export type SearchResult = { id:string; title:string; excerpt:string; author:string; avatar?:string; kind:string; stats:string; url:string };
export type SearchPageData = { items:SearchResult[]; nextCursor?:string; hasMore:boolean; source?:'cookie'|'access_secret'; usedFallback?:boolean };
export type ServiceStatus = { status: string; configured: { search: boolean } };
export type ContentDetail = {
  id: string; questionId?: string; title: string; content: string; contentHtml?: string; author: string; avatar: string;
  createdAt: string; voteUpCount: number; commentCount: number; url: string;
};
export type QuestionInfo = {
  metadataLimited?: boolean;
  id: string; title: string; detail: string; detailHtml?: string; author: string;
  createdAt: string; updatedAt: string; answerCount: number;
  followerCount: number; commentCount: number; topics: string[]; url: string;
};
export type QuestionAnswer = {
  id: string; excerpt: string; author: string; avatar: string;
  createdAt: string; voteUpCount: number; commentCount: number;
};
export type QuestionAnswerPage = { items: QuestionAnswer[]; nextCursor?: string; hasMore: boolean };
export type CommentItem = {
  id: string; content: string; contentHtml?: string; author: string; avatar: string;
  createdAt: string; likeCount: number; replyCount: number; replies?: CommentItem[];
  repliesCursor?: string; repliesHasMore?: boolean; repliesLoaded?: boolean;
};
export type CommentPage = { items: CommentItem[]; nextCursor?: string; hasMore: boolean };
export type ContentType = 'answer' | 'article';
export type ContentOpenType = ContentType | 'question';

const kindAliases: Record<string, string> = {
  answer: 'answer', article: 'article', question: 'question', pin: 'pin',
  回答: 'answer', 文章: 'article', 问题: 'question', 想法: 'pin',
};
const kindLabels: Record<string, string> = {
  answer: '回答', article: '文章', question: '问题', pin: '想法', profile: '用户', zvideo: '视频',
};

export function canonicalKind(kind: string) {
  return kindAliases[kind] || kind;
}

export function contentKindLabel(kind: string) {
  const canonical = canonicalKind(kind);
  return kindLabels[canonical] || kind;
}

export function openableContent(kind: string, id: string): { type: ContentOpenType; id: string } | null {
  const canonical = canonicalKind(kind);
  if (canonical === 'answer' || canonical === 'article' || canonical === 'question') return { type: canonical, id };
  return null;
}

export function zhihuWebURL(kind: string, id: string) {
  switch (canonicalKind(kind)) {
    case 'answer': return `https://www.zhihu.com/answer/${id}`;
    case 'article': return `https://zhuanlan.zhihu.com/p/${id}`;
    case 'question': return `https://www.zhihu.com/question/${id}`;
    case 'pin': return `https://www.zhihu.com/pin/${id}`;
    default: return '';
  }
}
export type HistoryItem = { id: string; kind: string; title: string; excerpt: string; author: string; time: string; url: string };
export type HistoryPage = { items: HistoryItem[]; nextCursor?: string; hasMore: boolean };
