import * as api from '../api/zhihu';
import type { CommentItem, ContentType, SearchInput } from '../models/content';
import { displayTime } from './time';

function displayComment(item: CommentItem): CommentItem {
  return { ...item, createdAt: displayTime(item.createdAt), replies: item.replies?.map(displayComment) };
}
export const historyChangedEvent = 'zhihu-focus-history-changed';
export const zhihuService = {
  getStatus: () => api.getStatus(),
  getFeed: (cursor?: string) => api.getFeed(cursor),
  getHistory: async (cookie: string, cursor?: string) => {
    const page = await api.getHistory(cookie, cursor);
    return { ...page, items: page.items.map(item => ({ ...item, time: displayTime(item.time) })) };
  },
  addHistory: async (type: ContentType, id: string, cookie: string) => {
    const result = await api.addHistory(type, id, cookie);
    if (result.success !== true) throw new Error('知乎未确认浏览历史保存成功');
  },
  search: (input: SearchInput) => api.searchZhihu(input),
  getContentDetail: async (type: ContentType, id: string) => {
    const detail = await api.getContentDetail(type, id);
    return { ...detail, createdAt: displayTime(detail.createdAt) };
  },
  reportReading: async (type: ContentType, id: string, cookie: string) => {
    const result = await api.reportReading(type, id, cookie);
    if (result.success !== true) throw new Error('知乎未确认阅读状态同步成功');
  },
  getContentComments: async (type: ContentType, id: string, cursor?: string) => {
    const page = await api.getContentComments(type, id, cursor);
    return { ...page, items: page.items.map(displayComment) };
  },
  getCommentReplies: async (type: ContentType, contentId: string, commentId: string, cursor?: string) => {
    const page = await api.getCommentReplies(type, contentId, commentId, cursor);
    return { ...page, items: page.items.map(displayComment) };
  },
  getQuestion: async (id: string) => {
    const item = await api.getQuestion(id);
    return { ...item, createdAt: displayTime(item.createdAt), updatedAt: displayTime(item.updatedAt) };
  },
  getQuestionAnswers: async (id: string, cursor?: string) => {
    const page = await api.getQuestionAnswers(id, cursor);
    return { ...page, items: page.items.map(item => ({ ...item, createdAt: displayTime(item.createdAt) })) };
  },
};
