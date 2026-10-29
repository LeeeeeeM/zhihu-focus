export type FeedItem = { id:string; kind:'问题'|'回答'|'文章'|'想法'; category:string; title:string; excerpt:string; author:string; avatar?:string; stats:string; time:string; tag?:string; url:string; };
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
  repliesCursor?: string; repliesHasMore?: boolean;
};
export type CommentPage = { items: CommentItem[]; nextCursor?: string; hasMore: boolean };
export type ContentType = 'answer' | 'article';
export type ContentOpenType = ContentType | 'question';
