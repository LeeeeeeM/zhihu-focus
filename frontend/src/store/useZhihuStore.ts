import { create } from 'zustand';
import { historyChangedEvent, zhihuService } from '../services/zhihu';
import { readZhihuCookie } from '../services/searchCredential';
import { useHistoryStore } from './useHistoryStore';
import { contentKey, idKey, mergeUnique, nextPageState } from '../services/pagination';
import { displayTime } from '../services/time';
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
  readerMode: 'drawer' | 'page' | null;
  contentType: ContentType | null;
  contentId: string;
  detail: ContentDetail | null;
  detailLoading: boolean;
  detailError: string;
  readingReportError: string;
  historyWriteError: string;
  comments: CommentItem[];
  commentsLoading: boolean;
  commentsError: string;
  commentsCursor: string;
  commentsHasMore: boolean;
  commentsMoreLoading: boolean;
  commentRepliesLoading: Record<string, boolean>;
  commentRepliesErrors: Record<string, string>;
  questionId: string;
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
  invalidateAccount: () => void;
  refreshFeed: () => Promise<void>;
  loadMoreFeed: () => Promise<number>;
  search: (query: string) => Promise<void>;
  loadMoreSearch: () => Promise<number>;
  openContent: (type: ContentType, id: string, mode?: 'drawer' | 'page') => Promise<void>;
  closeDrawer: () => void;
  loadMoreComments: () => Promise<void>;
  loadCommentReplies: (commentId: string) => Promise<void>;
  loadQuestion: (id: string) => Promise<void>;
  loadMoreQuestionAnswers: () => Promise<number>;
};

function storedPage(page: { nextCursor?: string; hasMore: boolean }, current = '') {
  return nextPageState(page.nextCursor, page.hasMore, current);
}

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
  drawerOpen: false, readerMode: null, contentType: null, contentId: '', detail: null, detailLoading: false, detailError: '', readingReportError: '', historyWriteError: '',
  comments: [], commentsLoading: false, commentsError: '', commentsCursor: '', commentsHasMore: false, commentsMoreLoading: false,
  commentRepliesLoading: {}, commentRepliesErrors: {},
  questionId: '', question: null, questionLoading: false, questionError: '', questionAnswers: [], questionAnswersLoading: false,
  questionAnswersError: '', questionAnswersCursor: '', questionAnswersHasMore: false, questionAnswersMoreLoading: false,

  initialize: async () => {
    void zhihuService.getStatus().then(status => set({ serviceConfigured: status.configured })).catch(() => {});
    await get().refreshFeed();
  },

  invalidateAccount: () => {
    feedRequestVersion++; searchRequestVersion++; questionRequestVersion++; contentRequestVersion++;
    set({
      feed: [], feedSource: '', feedLoading: false, feedMoreLoading: false, feedError: '', feedCursor: '', feedHasMore: false,
      searchResults: [], searchSource: '', searchUsedFallback: false, searchCursor: '', searchHasMore: false, searchLoading: false, searchMoreLoading: false, searchError: '', searchMoreError: '',
      drawerOpen: false, readerMode: null, contentType: null, contentId: '', detail: null, detailLoading: false, detailError: '', readingReportError: '', historyWriteError: '',
      comments: [], commentsLoading: false, commentsError: '', commentsCursor: '', commentsHasMore: false, commentsMoreLoading: false, commentRepliesLoading: {}, commentRepliesErrors: {},
      questionId: '', question: null, questionLoading: false, questionError: '', questionAnswers: [], questionAnswersLoading: false, questionAnswersError: '', questionAnswersCursor: '', questionAnswersHasMore: false, questionAnswersMoreLoading: false,
    });
  },

  refreshFeed: async () => {
    const version = ++feedRequestVersion;
    set({ feed: [], feedCursor: '', feedHasMore: false, feedLoading: true, feedError: '', feedMoreLoading: false });
    try {
      const page = await zhihuService.getFeed();
      if (version === feedRequestVersion) {
        const paging = storedPage(page);
        set({ feed: mergeUnique([], page.items, contentKey).items, feedSource: page.source || 'recommendation', feedCursor: paging.cursor, feedHasMore: paging.hasMore });
      }
    } catch (error) {
      if (version === feedRequestVersion) set({ feedSource: '', feedError: error instanceof Error ? error.message : '加载推荐失败' });
    } finally { if (version === feedRequestVersion) set({ feedLoading: false }); }
  },

  loadMoreFeed: async () => {
    const { feedCursor, feedHasMore, feedLoading, feedMoreLoading } = get();
    if (!feedCursor || !feedHasMore || feedLoading || feedMoreLoading) return 0;
    const version = feedRequestVersion;
    set({ feedMoreLoading: true, feedError: '' });
    let freshCount = 0;
    try {
      const page = await zhihuService.getFeed(feedCursor);
      if (version !== feedRequestVersion) return 0;
      set(state => {
        if (state.feedCursor !== feedCursor) return {};
        const merged = mergeUnique(state.feed, page.items, contentKey);
        const paging = storedPage(page, feedCursor);
        freshCount = merged.freshCount;
        return { feed: merged.items, feedSource: page.source || state.feedSource, feedCursor: paging.cursor, feedHasMore: paging.hasMore };
      });
    } catch (error) {
      if (version === feedRequestVersion) set({ feedError: error instanceof Error ? error.message : '加载推荐失败' });
    } finally { if (version === feedRequestVersion) set({ feedMoreLoading: false }); }
    return freshCount;
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
      if (version === searchRequestVersion) {
        const paging = storedPage(page);
        set({ searchResults: mergeUnique([], page.items, contentKey).items, searchCursor: paging.cursor, searchHasMore: paging.hasMore, searchSource: page.source || '', searchUsedFallback: page.usedFallback || false });
      }
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
        const merged = mergeUnique(state.searchResults, page.items, contentKey);
        const paging = storedPage(page, searchCursor);
        freshCount = merged.freshCount;
        return { searchResults: merged.items, searchCursor: paging.cursor, searchHasMore: paging.hasMore, searchSource: page.source || state.searchSource, searchUsedFallback: page.usedFallback || state.searchUsedFallback };
      });
    } catch (error) {
      if (version === searchRequestVersion) set({ searchMoreError: error instanceof Error ? error.message : '加载更多搜索结果失败' });
    } finally {
      if (version === searchRequestVersion) set({ searchMoreLoading: false });
    }
    return freshCount;
  },

  openContent: async (type, id, mode = 'drawer') => {
    const version = ++contentRequestVersion;
    const cookie = readZhihuCookie().trim();
    const isCurrent = () => version === contentRequestVersion && get().readerMode === mode && get().contentId === id && get().contentType === type && readZhihuCookie().trim() === cookie;
    set({ drawerOpen: mode === 'drawer', readerMode: mode, contentType: type, contentId: id, detail: null, detailError: '', readingReportError: '', historyWriteError: '', detailLoading: true, comments: [], commentsError: '', commentsLoading: true, commentsCursor: '', commentsHasMore: false, commentsMoreLoading: false, commentRepliesLoading: {}, commentRepliesErrors: {} });
    const detailTask = zhihuService.getContentDetail(type, id)
      .then(detail => {
        if (!isCurrent()) return;
        set({ detail });
        if (cookie) {
          // Reporting must not delay reading or count stale/closed requests as reads.
          void zhihuService.reportReading(type, id, cookie).catch(error => {
            if (isCurrent()) set({ readingReportError: error instanceof Error ? error.message : '阅读状态同步失败' });
          });
          void zhihuService.addHistory(type, id, cookie).then(() => {
            if (readZhihuCookie().trim() === cookie) {
              useHistoryStore.getState().recordSaved(cookie, {
                id, kind: type, title: detail.title, excerpt: detail.content?.slice(0, 240) || '', author: detail.author,
                time: displayTime(new Date().toISOString()), url: detail.url,
              });
              window.dispatchEvent(new window.Event(historyChangedEvent));
            }
          }).catch(error => {
            if (isCurrent()) set({ historyWriteError: error instanceof Error ? error.message : '浏览历史保存失败' });
          });
        }
      })
      .catch(error => set(state => version === contentRequestVersion && state.contentId === id && state.contentType === type ? { detailError: error instanceof Error ? error.message : '读取内容失败' } : {}))
      .finally(() => set(state => version === contentRequestVersion && state.contentId === id && state.contentType === type ? { detailLoading: false } : {}));
    const commentsTask = zhihuService.getContentComments(type, id)
      .then(page => set(state => {
        if (version !== contentRequestVersion || state.contentId !== id || state.contentType !== type) return {};
        const paging = storedPage(page);
        return { comments: mergeUnique([], page.items, idKey).items, commentsCursor: paging.cursor, commentsHasMore: paging.hasMore };
      }))
      .catch(error => set(state => version === contentRequestVersion && state.contentId === id && state.contentType === type ? { commentsError: error instanceof Error ? error.message : '读取评论失败' } : {}))
      .finally(() => set(state => version === contentRequestVersion && state.contentId === id && state.contentType === type ? { commentsLoading: false } : {}));
    await Promise.all([detailTask, commentsTask]);
  },

  closeDrawer: () => {
    contentRequestVersion += 1;
    set({ drawerOpen: false, readerMode: null, commentsMoreLoading: false });
  },

  loadMoreComments: async () => {
    const { contentType, contentId, commentsCursor, commentsHasMore, commentsMoreLoading } = get();
    if (!contentType || !contentId || !commentsCursor || !commentsHasMore || commentsMoreLoading) return;
    const version = contentRequestVersion;
    set({ commentsMoreLoading: true, commentsError: '' });
    try {
      const page = await zhihuService.getContentComments(contentType, contentId, commentsCursor);
      set(state => {
        if (version !== contentRequestVersion || state.contentId !== contentId || state.contentType !== contentType) return {};
        const merged = mergeUnique(state.comments, page.items, idKey);
        const paging = storedPage(page, commentsCursor);
        return { comments: merged.items, commentsCursor: paging.cursor, commentsHasMore: paging.hasMore };
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
    if ((comment.repliesLoaded && !comment.repliesHasMore) || (!comment.repliesHasMore && (comment.replies?.length || 0) >= comment.replyCount)) return;
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
        const merged = mergeUnique(current.replies || [], page.items, idKey);
        const paging = storedPage(page, current.repliesCursor);

        return {
          comments: state.comments.map(item => item.id === commentId ? {
            ...item,
            replies: merged.items,
            repliesCursor: paging.cursor,
            repliesHasMore: paging.hasMore,
            repliesLoaded: true,
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
    set({ questionId: id, question: null, questionLoading: true, questionError: '', questionAnswers: [], questionAnswersLoading: true,
      questionAnswersError: '', questionAnswersCursor: '', questionAnswersHasMore: false, questionAnswersMoreLoading: false });
    const questionTask = zhihuService.getQuestion(id)
      .then(question => { if (version === questionRequestVersion) set({ question }); })
      .catch(error => { if (version === questionRequestVersion) set({ questionError: error instanceof Error ? error.message : '读取问题失败' }); })
      .finally(() => { if (version === questionRequestVersion) set({ questionLoading: false }); });
    const answersTask = zhihuService.getQuestionAnswers(id)
      .then(page => {
        if (version !== questionRequestVersion) return;
        const paging = storedPage(page);
        set({ questionAnswers: mergeUnique([], page.items, idKey).items, questionAnswersCursor: paging.cursor, questionAnswersHasMore: paging.hasMore });
      })
      .catch(error => { if (version === questionRequestVersion) set({ questionAnswersError: error instanceof Error ? error.message : '读取问题回答失败' }); })
      .finally(() => { if (version === questionRequestVersion) set({ questionAnswersLoading: false }); });
    await Promise.all([questionTask, answersTask]);
  },

  loadMoreQuestionAnswers: async () => {
    const { questionId: id, questionAnswersCursor, questionAnswersHasMore, questionAnswersMoreLoading } = get();
    if (!id || !questionAnswersCursor || !questionAnswersHasMore || questionAnswersMoreLoading) return 0;
    const version = questionRequestVersion;
    set({ questionAnswersMoreLoading: true, questionAnswersError: '' });
    let freshCount = 0;
    try {
      const page = await zhihuService.getQuestionAnswers(id, questionAnswersCursor);
      set(state => {
        if (version !== questionRequestVersion || state.questionId !== id) return {};
        const merged = mergeUnique(state.questionAnswers, page.items, idKey);
        const paging = storedPage(page, questionAnswersCursor);
        freshCount = merged.freshCount;
        return { questionAnswers: merged.items, questionAnswersCursor: paging.cursor, questionAnswersHasMore: paging.hasMore };
      });
    } catch (error) {
      set(state => version === questionRequestVersion && state.questionId === id
        ? { questionAnswersError: error instanceof Error ? error.message : '加载更多回答失败' }
        : {});
    } finally {
      set(state => version === questionRequestVersion && state.questionId === id
        ? { questionAnswersMoreLoading: false }
        : {});
    }
    return freshCount;
  },
}));
