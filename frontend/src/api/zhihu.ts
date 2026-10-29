import type { CommentPage, ContentDetail, ContentType, FeedPage, QuestionAnswerPage, QuestionInfo, SearchInput, SearchPageData, ServiceStatus } from '../models/content';
import { readZhihuCookie } from '../services/searchCredential';

const inFlight = new Map<string, Promise<unknown>>();

async function request<T>(path: string, init?: RequestInit, identity = ''): Promise<T> {
  const method = (init?.method ?? 'GET').toUpperCase();
  const key = `${method}:${path}:${identity}`;
  const pending = inFlight.get(key);
  if (pending) return pending as Promise<T>;

  const task = (async () => {
    const base = import.meta.env?.BASE_URL || '/';
    const res = await fetch(`${base.replace(/\/$/, '')}${path}`, init);
    if (!res.ok) {
      let detail = '';
      try { detail = (await res.json()).error || ''; } catch { /* Keep the status fallback. */ }
      throw new Error(detail || `请求失败 (${res.status})`);
    }
    return res.json() as Promise<T>;
  })();

  inFlight.set(key, task);
  try { return await task; }
  finally { if (inFlight.get(key) === task) inFlight.delete(key); }
}

export const getStatus = () => request<ServiceStatus>('/api/health');
function cookieIdentity(cookie: string) {
  let hash = 2166136261;
  for (let index = 0; index < cookie.length; index += 1) hash = Math.imul(hash ^ cookie.charCodeAt(index), 16777619);
  return `${cookie.length}:${(hash >>> 0).toString(36)}`;
}

function cookieRequest<T>(path: string, cookie = readZhihuCookie()) {
  const normalizedCookie = cookie.trim();
  const init = normalizedCookie ? { headers: { 'X-Zhihu-Cookie': normalizedCookie } } : undefined;
  return request<T>(path, init, normalizedCookie ? cookieIdentity(normalizedCookie) : '');
}

export const getFeed = (cursor?: string) => cookieRequest<FeedPage>(`/api/feed${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`);

export const searchZhihu = ({ query, cursor, cookie }: SearchInput) => {
  const selectedCookie = cookie === undefined ? readZhihuCookie() : cookie;
  return cookieRequest<SearchPageData>(`/api/search?q=${encodeURIComponent(query)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, selectedCookie);
};
export const getContentDetail = (type: ContentType, id: string) => cookieRequest<ContentDetail>(`/api/detail?type=${type}&id=${encodeURIComponent(id)}`);
export const getContentComments = (type: ContentType, id: string, cursor?: string) => cookieRequest<CommentPage>(`/api/comments?type=${type}&id=${encodeURIComponent(id)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
export const getCommentReplies = (type: ContentType, contentId: string, commentId: string, cursor?: string) => cookieRequest<CommentPage>(`/api/comment-replies?type=${type}&contentId=${encodeURIComponent(contentId)}&commentId=${encodeURIComponent(commentId)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
export const getQuestion = (id: string) => cookieRequest<QuestionInfo>(`/api/question?id=${encodeURIComponent(id)}`);
export const getQuestionAnswers = (id: string, cursor?: string) => cookieRequest<QuestionAnswerPage>(`/api/question/answers?id=${encodeURIComponent(id)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
