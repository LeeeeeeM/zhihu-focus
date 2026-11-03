import type { CommentPage, ContentDetail, ContentType, FeedPage, HistoryPage, QuestionAnswerPage, QuestionInfo, ReplyProgress, SearchInput, SearchPageData, ServiceStatus } from '../models/content';
import { readZhihuCookie } from '../services/searchCredential';

const inFlight = new Map<string, Promise<unknown>>();

async function request<T>(path: string, init?: RequestInit, identity = '', fresh = false): Promise<T> {
  const method = (init?.method ?? 'GET').toUpperCase();
  const key = `${method}:${path}:${identity}`;
  // A history refresh after a write must not reuse a GET started before the write.
  const deduplicate = !fresh;
  const pending = deduplicate ? inFlight.get(key) : undefined;
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

  if (deduplicate) inFlight.set(key, task);
  try { return await task; }
  finally { if (inFlight.get(key) === task) inFlight.delete(key); }
}

export const getStatus = () => request<ServiceStatus>('/api/health');
let identityCookie = '';
let identityVersion = 0;
function cookieIdentity(cookie: string) {
  if (cookie !== identityCookie) { identityCookie = cookie; identityVersion++; }
  return String(identityVersion);
}

function cookieRequest<T>(path: string, cookie = readZhihuCookie(), options: RequestInit = {}) {
  const normalizedCookie = cookie.trim();
  const headers = new Headers(options.headers);
  if (normalizedCookie) headers.set('X-Zhihu-Cookie', normalizedCookie);
  const init: RequestInit = { ...options, cache: 'no-store', headers };
  return request<T>(path, init, normalizedCookie ? cookieIdentity(normalizedCookie) : '', options.method === 'POST');
}

export const getFeed = (cursor?: string) => cookieRequest<FeedPage>(`/api/feed${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`);

export const getHistory = (cookie: string, cursor?: string) => request<HistoryPage>(
  `/api/history${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
  { headers: { 'X-Zhihu-Cookie': cookie }, cache: 'no-store' }, cookieIdentity(cookie), true,
);

export const reportReading = (type: ContentType, id: string, cookie: string) => request<{ success: boolean }>(
  `/api/read?type=${type}&id=${encodeURIComponent(id)}`,
  { method: 'POST', headers: { 'X-Zhihu-Cookie': cookie } },
  cookieIdentity(cookie),
);

export const addHistory = (type: ContentType, id: string, cookie: string) => request<{ success: boolean }>(
  `/api/history?type=${type}&id=${encodeURIComponent(id)}`,
  { method: 'POST', headers: { 'X-Zhihu-Cookie': cookie }, cache: 'no-store' }, cookieIdentity(cookie),
);

export const searchZhihu = ({ query, cursor, cookie }: SearchInput) => {
  const selectedCookie = cookie === undefined ? readZhihuCookie() : cookie;
  return cookieRequest<SearchPageData>(`/api/search?q=${encodeURIComponent(query)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, selectedCookie);
};
export const getContentDetail = (type: ContentType, id: string) => cookieRequest<ContentDetail>(`/api/detail?type=${type}&id=${encodeURIComponent(id)}`);
export const getContentComments = (type: ContentType, id: string, cursor?: string) => cookieRequest<CommentPage>(`/api/comments?type=${type}&id=${encodeURIComponent(id)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
export const getCommentReplies = (type: ContentType, contentId: string, commentId: string, cursor?: string, progress: ReplyProgress = { loadedIds: [] }) => cookieRequest<CommentPage>(`/api/comment-replies?type=${type}&contentId=${encodeURIComponent(contentId)}&commentId=${encodeURIComponent(commentId)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, undefined, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(progress),
});
export const getQuestion = (id: string) => cookieRequest<QuestionInfo>(`/api/question?id=${encodeURIComponent(id)}`);
export const getQuestionAnswers = (id: string, cursor?: string) => cookieRequest<QuestionAnswerPage>(`/api/question/answers?id=${encodeURIComponent(id)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
