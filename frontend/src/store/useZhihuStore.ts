import { create } from 'zustand';
import { zhihuService } from '../services/zhihu';
import { readAutoLoadPreference, readHideUserAvatars, readImageDisplayMode, readMinimalMode, saveAutoLoadPreference, saveHideUserAvatars, saveImageDisplayMode, saveMinimalMode } from '../services/readingPreferences';
import type { ImageDisplayMode } from '../services/readingPreferences';
import { normalizeThemeColor, readThemeColor, saveThemeColor } from '../services/themePreferences';
import type { CommentItem, ContentDetail, ContentType, FeedItem, QuestionAnswer, QuestionInfo, SearchResult, ServiceStatus } from '../models/content';

type Store = {
  minimalMode: boolean;
  setMinimalMode: (enabled: boolean) => void;
  hideUserAvatars: boolean;
  setHideUserAvatars: (hidden: boolean) => void;
  autoLoad: boolean;
  setAutoLoad: (enabled: boolean) => void;
  themeColor: string;
  setThemeColor: (color: string) => void;
  imageDisplayMode: ImageDisplayMode;
  setImageDisplayMode: (mode: ImageDisplayMode) => void;
  serviceConfigured: ServiceStatus['configured'];
  feed: FeedItem[];
  feedSource: 'recommendation'|'hotlist'|'';
  feedLoading: boolean;
  feedError: string;
  feedCursor: string;
  feedHasMore: boolean;
  feedMoreLoading: boolean;
  searchResults: SearchResult[];
  searchQuery: string;
  searchSource: 'cookie' | 'access_secret' | '';
  searchUsedFallback: boolean;
  searchCursor: string;
  searchHasMore: boolean;
  searchLoading: boolean;
  searchMoreLoading: boolean;
  searchError: string;
  searchMoreError: string;
  drawerOpen: boolean;
  contentType: ContentType | null;
  contentId: string;
  detail: ContentDetail | null;
  detailLoading: boolean;
  detailError: string;
  comments: CommentItem[];
  commentsLoading: boolean;
  commentsError: string;
  commentsCursor: string;
  commentsHasMore: boolean;
  commentsMoreLoading: boolean;
  commentRepliesLoading: Record<string, boolean>;
  commentRepliesErrors: Record<string, string>;
  question: QuestionInfo | null;
  questionLoading: boolean;
  questionError: string;
  questionAnswers: QuestionAnswer[];
  questionAnswersLoading: boolean;
  questionAnswersError: string;
  questionAnswersCursor: string;
  questionAnswersHasMore: boolean;
  questionAnswersMoreLoading: boolean;
  initialize: () => Promise<void>;
  refreshFeed: () => Promise<void>;
  loadMoreFeed: () => Promise<void>;
  search: (query: string) => Promise<void>;
  loadMoreSearch: () => Promise<number>;
  openContent: (type: ContentType, id: string) => Promise<void>;
  closeDrawer: () => void;
  loadMoreComments: () => Promise<void>;
  loadCommentReplies: (commentId: string) => Promise<void>;
  loadQuestion: (id: string) => Promise<void>;
  loadMoreQuestionAnswers: () => Promise<void>;
};

let searchRequestVersion = 0;
let questionRequestVersion = 0;
let feedRequestVersion = 0;
let contentRequestVersion = 0;

export const useZhihuStore = create<Store>((set, get) => ({
  minimalMode: readMinimalMode(),
  setMinimalMode: enabled => { saveMinimalMode(enabled); set({ minimalMode: enabled }); },
  hideUserAvatars: readHideUserAvatars(),
  setHideUserAvatars: hidden => { saveHideUserAvatars(hidden); set({ hideUserAvatars: hidden }); },
  autoLoad: readAutoLoadPreference(),
  setAutoLoad: enabled => { saveAutoLoadPreference(enabled); set({ autoLoad: enabled }); },
  themeColor: readThemeColor(),
  setThemeColor: color => { const normalized = normalizeThemeColor(color); saveThemeColor(normalized); set({ themeColor: normalized }); },
  imageDisplayMode: readImageDisplayMode(),
  setImageDisplayMode: mode => { saveImageDisplayMode(mode); set({ imageDisplayMode: mode }); },
  serviceConfigured: { search: false },
  feed: [], feedSource: '', feedLoading: true, feedError: '', feedCursor: '', feedHasMore: false, feedMoreLoading: false,
  searchResults: [], searchQuery: '', searchSource: '', searchUsedFallback: false, searchCursor: '', searchHasMore: false,
  searchLoading: false, searchMoreLoading: false, searchError: '', searchMoreError: '',
  drawerOpen: false, contentType: null, contentId: '', detail: null, detailLoading: false, detailError: '',
  comments: [], commentsLoading: false, commentsError: '', commentsCursor: '', commentsHasMore: false, commentsMoreLoading: false,
  commentRepliesLoading: {}, commentRepliesErrors: {},
  question: null, questionLoading: false, questionError: '', questionAnswers: [], questionAnswersLoading: false,
  questionAnswersError: '', questionAnswersCursor: '', questionAnswersHasMore: false, questionAnswersMoreLoading: false,

  initialize: async () => {
    void zhihuService.getStatus().then(status => set({ serviceConfigured: status.configured })).catch(() => {});
    await get().refreshFeed();
  },

  refreshFeed: async () => {
    const version = ++feedRequestVersion;
    set({ feed: [], feedCursor: '', feedHasMore: false, feedLoading: true, feedError: '', feedMoreLoading: false });
    try {
      const page = await zhihuService.getFeed();
      if (version === feedRequestVersion) set({ feed: page.items, feedSource: page.source || 'recommendation', feedCursor: page.nextCursor || '', feedHasMore: page.hasMore });
    } catch (error) {
      if (version === feedRequestVersion) set({ feedSource: '', feedError: error instanceof Error ? error.message : '加载推荐失败' });
    } finally { if (version === feedRequestVersion) set({ feedLoading: false }); }
  },

  loadMoreFeed: async () => {
    const { feedCursor, feedLoading, feedMoreLoading } = get();
    if (!feedCursor || feedLoading || feedMoreLoading) return;
    const version = feedRequestVersion;
    set({ feedMoreLoading: true, feedError: '' });
    try {
      const page = await zhihuService.getFeed(feedCursor);
      if (version !== feedRequestVersion) return;
      set(state => {
        if (state.feedCursor !== feedCursor) return {};
        const seen = new Set(state.feed.map(item => `${item.kind}:${item.id}`));
        const fresh = page.items.filter(item => { const key = `${item.kind}:${item.id}`; if (seen.has(key)) return false; seen.add(key); return true; });
        return { feed: [...state.feed, ...fresh], feedSource: page.source || state.feedSource, feedCursor: page.nextCursor || '', feedHasMore: page.hasMore };
      });
    } catch (error) {
      if (version === feedRequestVersion) set({ feedError: error instanceof Error ? error.message : '加载推荐失败' });
    } finally { if (version === feedRequestVersion) set({ feedMoreLoading: false }); }
  },

  search: async query => {
    const version = ++searchRequestVersion;
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      set({ searchResults: [], searchQuery: '', searchSource: '', searchUsedFallback: false, searchCursor: '', searchHasMore: false, searchError: '', searchMoreError: '', searchLoading: false, searchMoreLoading: false });
      return;
    }
    set({ searchResults: [], searchQuery: normalizedQuery, searchSource: '', searchUsedFallback: false, searchCursor: '', searchHasMore: false, searchError: '', searchMoreError: '', searchLoading: true, searchMoreLoading: false });
    try {
      const page = await zhihuService.search({ query: normalizedQuery });
      if (version === searchRequestVersion) set({ searchResults: page.items, searchCursor: page.nextCursor || '', searchHasMore: page.hasMore, searchSource: page.source || '', searchUsedFallback: page.usedFallback || false });
    } catch (error) {
      if (version === searchRequestVersion) set({ searchError: error instanceof Error ? error.message : '搜索失败' });
    } finally { if (version === searchRequestVersion) set({ searchLoading: false }); }
  },

  loadMoreSearch: async () => {
    const { searchQuery, searchCursor, searchHasMore, searchMoreLoading } = get();
    if (!searchQuery || !searchCursor || !searchHasMore || searchMoreLoading) return 0;
    const version = searchRequestVersion;
    set({ searchMoreLoading: true, searchMoreError: '' });
    let freshCount = 0;
    try {
      const page = await zhihuService.search({ query: searchQuery, cursor: searchCursor });
      if (version !== searchRequestVersion) return 0;
      set(state => {
        if (state.searchQuery !== searchQuery || state.searchCursor !== searchCursor) return {};
        const seen = new Set(state.searchResults.map(item => `${item.kind}:${item.id}`));
        const fresh = page.items.filter(item => { const key = `${item.kind}:${item.id}`; if (seen.has(key)) return false; seen.add(key); return true; });
        freshCount = fresh.length;
        return { searchResults: [...state.searchResults, ...fresh], searchCursor: page.nextCursor || '', searchHasMore: page.hasMore, searchSource: page.source || state.searchSource, searchUsedFallback: page.usedFallback || state.searchUsedFallback };
      });
    } catch (error) {
      if (version === searchRequestVersion) set({ searchMoreError: error instanceof Error ? error.message : '加载更多搜索结果失败' });
    } finally {
      if (version === searchRequestVersion) set({ searchMoreLoading: false });
    }
    return freshCount;
  },

  openContent: async (type, id) => {
    const version = ++contentRequestVersion;
    set({ drawerOpen: true, contentType: type, contentId: id, detail: null, detailError: '', detailLoading: true, comments: [], commentsError: '', commentsLoading: true, commentsCursor: '', commentsHasMore: false, commentsMoreLoading: false, commentRepliesLoading: {}, commentRepliesErrors: {} });
    const detailTask = zhihuService.getContentDetail(type, id)
      .then(detail => set(state => version === contentRequestVersion && state.contentId === id && state.contentType === type ? { detail } : {}))
      .catch(error => set(state => version === contentRequestVersion && state.contentId === id && state.contentType === type ? { detailError: error instanceof Error ? error.message : '读取内容失败' } : {}))
      .finally(() => set(state => version === contentRequestVersion && state.contentId === id && state.contentType === type ? { detailLoading: false } : {}));
    const commentsTask = zhihuService.getContentComments(type, id)
      .then(page => set(state => version === contentRequestVersion && state.contentId === id && state.contentType === type ? { comments: page.items, commentsCursor: page.nextCursor || '', commentsHasMore: page.hasMore } : {}))
      .catch(error => set(state => version === contentRequestVersion && state.contentId === id && state.contentType === type ? { commentsError: error instanceof Error ? error.message : '读取评论失败' } : {}))
      .finally(() => set(state => version === contentRequestVersion && state.contentId === id && state.contentType === type ? { commentsLoading: false } : {}));
    await Promise.all([detailTask, commentsTask]);
  },

  closeDrawer: () => {
    contentRequestVersion += 1;
    set({ drawerOpen: false, commentsMoreLoading: false });
  },

  loadMoreComments: async () => {
    const { contentType, contentId, commentsCursor, commentsMoreLoading } = get();
    if (!contentType || !contentId || !commentsCursor || commentsMoreLoading) return;
    const version = contentRequestVersion;
    set({ commentsMoreLoading: true, commentsError: '' });
    try {
      const page = await zhihuService.getContentComments(contentType, contentId, commentsCursor);
      set(state => {
        if (version !== contentRequestVersion || state.contentId !== contentId || state.contentType !== contentType) return {};
        const seen = new Set(state.comments.map(comment => comment.id));
        const fresh = page.items.filter(comment => { if (seen.has(comment.id)) return false; seen.add(comment.id); return true; });
        return { comments: [...state.comments, ...fresh], commentsCursor: page.nextCursor || '', commentsHasMore: page.hasMore };
      });
    } catch (error) {
      set(state => version === contentRequestVersion && state.contentId === contentId && state.contentType === contentType
        ? { commentsError: error instanceof Error ? error.message : '加载评论失败' }
        : {});
    } finally {
      set(state => version === contentRequestVersion && state.contentId === contentId && state.contentType === contentType
        ? { commentsMoreLoading: false }
        : {});
    }
  },

  loadCommentReplies: async commentId => {
    const { contentType, contentId, comments, commentRepliesLoading } = get();
    const comment = comments.find(item => item.id === commentId);
    if (!contentType || !contentId || !comment || commentRepliesLoading[commentId]) return;
    if (!comment.repliesHasMore && (comment.replies?.length || 0) >= comment.replyCount) return;
    const version = contentRequestVersion;
    set(state => ({
      commentRepliesLoading: { ...state.commentRepliesLoading, [commentId]: true },
      commentRepliesErrors: { ...state.commentRepliesErrors, [commentId]: '' },
    }));
    try {
      const page = await zhihuService.getCommentReplies(contentType, contentId, commentId, comment.repliesCursor);
      set(state => {
        if (version !== contentRequestVersion || state.contentId !== contentId || state.contentType !== contentType) return {};
        const current = state.comments.find(item => item.id === commentId);
        if (!current) return {};
        const seen = new Set((current.replies || []).map(reply => reply.id));
        const fresh = page.items.filter(reply => { if (seen.has(reply.id)) return false; seen.add(reply.id); return true; });
        return {
          comments: state.comments.map(item => item.id === commentId ? {
            ...item,
            replies: [...(item.replies || []), ...fresh],
            repliesCursor: page.nextCursor || '',
            repliesHasMore: page.hasMore,
          } : item),
          commentRepliesErrors: { ...state.commentRepliesErrors, [commentId]: '' },
        };
      });
    } catch (error) {
      set(state => version === contentRequestVersion && state.contentId === contentId && state.contentType === contentType
        ? { commentRepliesErrors: { ...state.commentRepliesErrors, [commentId]: error instanceof Error ? error.message : '加载回复失败' } }
        : {});
    } finally {
      set(state => version === contentRequestVersion && state.contentId === contentId && state.contentType === contentType
        ? { commentRepliesLoading: { ...state.commentRepliesLoading, [commentId]: false } }
        : {});
    }
  },

  loadQuestion: async id => {
    const version = ++questionRequestVersion;
    set({ question: null, questionLoading: true, questionError: '', questionAnswers: [], questionAnswersLoading: true,
      questionAnswersError: '', questionAnswersCursor: '', questionAnswersHasMore: false, questionAnswersMoreLoading: false });
    const questionTask = zhihuService.getQuestion(id)
      .then(question => { if (version === questionRequestVersion) set({ question }); })
      .catch(error => { if (version === questionRequestVersion) set({ questionError: error instanceof Error ? error.message : '读取问题失败' }); })
      .finally(() => { if (version === questionRequestVersion) set({ questionLoading: false }); });
    const answersTask = zhihuService.getQuestionAnswers(id)
      .then(page => { if (version === questionRequestVersion) set({ questionAnswers: page.items, questionAnswersCursor: page.nextCursor || '', questionAnswersHasMore: page.hasMore }); })
      .catch(error => { if (version === questionRequestVersion) set({ questionAnswersError: error instanceof Error ? error.message : '读取问题回答失败' }); })
      .finally(() => { if (version === questionRequestVersion) set({ questionAnswersLoading: false }); });
    await Promise.all([questionTask, answersTask]);
  },

  loadMoreQuestionAnswers: async () => {
    const { question, questionAnswersCursor, questionAnswersMoreLoading } = get();
    if (!question || !questionAnswersCursor || questionAnswersMoreLoading) return;
    const id = question.id;
    const version = questionRequestVersion;
    set({ questionAnswersMoreLoading: true, questionAnswersError: '' });
    try {
      const page = await zhihuService.getQuestionAnswers(id, questionAnswersCursor);
      set(state => {
        if (version !== questionRequestVersion || state.question?.id !== id) return {};
        const seen = new Set(state.questionAnswers.map(item => item.id));
        const fresh = page.items.filter(item => { if (seen.has(item.id)) return false; seen.add(item.id); return true; });
        return { questionAnswers: [...state.questionAnswers, ...fresh], questionAnswersCursor: page.nextCursor || '', questionAnswersHasMore: page.hasMore };
      });
    } catch (error) {
      set(state => version === questionRequestVersion && state.question?.id === id
        ? { questionAnswersError: error instanceof Error ? error.message : '加载更多回答失败' }
        : {});
    } finally {
      set(state => version === questionRequestVersion && state.question?.id === id
        ? { questionAnswersMoreLoading: false }
        : {});
    }
  },
}));
