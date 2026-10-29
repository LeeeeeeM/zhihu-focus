import * as api from '../api/zhihu';
import type { ContentType, SearchInput } from '../models/content';
export const zhihuService = {
  getStatus: () => api.getStatus(),
  getFeed: (cursor?: string) => api.getFeed(cursor),
  search: (input: SearchInput) => api.searchZhihu(input),
  getContentDetail: (type: ContentType, id: string) => api.getContentDetail(type, id),
  getContentComments: (type: ContentType, id: string, cursor?: string) => api.getContentComments(type, id, cursor),
  getCommentReplies: (type: ContentType, contentId: string, commentId: string, cursor?: string) => api.getCommentReplies(type, contentId, commentId, cursor),
  getQuestion: (id: string) => api.getQuestion(id),
  getQuestionAnswers: (id: string, cursor?: string) => api.getQuestionAnswers(id, cursor),
};
