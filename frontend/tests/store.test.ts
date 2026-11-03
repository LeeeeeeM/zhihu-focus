import assert from 'node:assert/strict';
import test from 'node:test';
import { useZhihuStore } from '../src/store/useZhihuStore';
import type { FeedItem } from '../src/models/content';
import { JSDOM } from 'jsdom';

function item(kind: FeedItem['kind'], id: string): FeedItem {
  return { id, kind, title: '标题', category: '推荐', excerpt: '', author: '作者', stats: '', time: '', url: '' };
}

test('account invalidation clears all private state and rejects pending old responses', async () => {
  const previousFetch = globalThis.fetch;
  let finish!: (response: Response) => void;
  globalThis.fetch = async () => new Promise(resolve => { finish = resolve; });
  try {
    const pending = useZhihuStore.getState().refreshFeed();
    useZhihuStore.setState({ searchResults: [{ id: 'old' } as never], drawerOpen: true, detail: { id: 'old' } as never, comments: [{ id: 'old' } as never], questionAnswers: [{ id: 'old' } as never] });
    useZhihuStore.getState().invalidateAccount();
    finish(Response.json({ items: [item('answer', 'old')], nextCursor: 'old', hasMore: true }));
    await pending;
    const state = useZhihuStore.getState();
    assert.deepEqual(state.feed, []);
    assert.deepEqual(state.searchResults, []);
    assert.deepEqual(state.comments, []);
    assert.deepEqual(state.questionAnswers, []);
    assert.equal(state.drawerOpen, false);
    assert.equal(state.detail, null);
  } finally { globalThis.fetch = previousFetch; }
});

test('exhausted reply pagination stops even when the upstream total includes unavailable replies', async () => {
  const previousFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({ items: [{ id: '2', content: '回复' }], hasMore: false }); };
  useZhihuStore.setState({ contentType: 'answer', contentId: '1', comments: [{ id: '1', replyCount: 5, repliesHasMore: true } as never], commentRepliesLoading: {} });
  try {
    await useZhihuStore.getState().loadCommentReplies('1');
    await useZhihuStore.getState().loadCommentReplies('1');
    assert.equal(calls, 1);
    assert.equal(useZhihuStore.getState().comments[0].replyCount, 5, 'do not invent a new upstream total');
  } finally { globalThis.fetch = previousFetch; }
});

for (const total of [10, 20, 25]) {
  test(`reply pagination stops at ${total} unique replies even when upstream advertises another page`, async () => {
    const previousFetch = globalThis.fetch;
    const requests: string[] = [];
    globalThis.fetch = async input => {
      const path = String(input);
      const page = requests.length;
      assert.equal(new URL(path, 'http://localhost').searchParams.get('cursor'), `page-${page}`);
      requests.push(path);
      return Response.json({
        items: Array.from({ length: Math.min(10, total - page * 10) }, (_, i) => ({ id: String(page * 10 + i + 1), content: '回复' })),
        nextCursor: `page-${page + 1}`, hasMore: true,
      });
    };
    useZhihuStore.setState({ contentType: 'answer', contentId: '1', comments: [{ id: '100', replyCount: total, repliesCursor: 'page-0', repliesHasMore: true } as never], commentRepliesLoading: {}, commentRepliesErrors: {} });
    try {
      const pages = Math.ceil(total / 10);
      for (let page = 0; page < pages; page++) {
        await useZhihuStore.getState().loadCommentReplies('100');
        assert.equal(requests.length, page + 1, 'one click requests exactly one page');
        assert.equal(useZhihuStore.getState().comments[0].repliesHasMore, page + 1 < pages);
      }
      const comment = useZhihuStore.getState().comments[0];
      assert.equal(comment.replies?.length, total);
      assert.equal(comment.repliesCursor, '');
      await useZhihuStore.getState().loadCommentReplies('100');
      assert.equal(requests.length, pages, 'do not probe an extra empty page');
    } finally { globalThis.fetch = previousFetch; }
  });
}

test('reply completion counts unique replies rather than repeated rows', async () => {
  const previousFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    const ids = calls === 1 ? ['1', '2', '3', '4', '5', '6', '7', '8', '1', '2'] : ['9', '10'];
    return Response.json({ items: ids.map(id => ({ id, content: '回复' })), nextCursor: `page-${calls}`, hasMore: true });
  };
  useZhihuStore.setState({ contentType: 'answer', contentId: '1', comments: [{ id: '100', replyCount: 10, repliesCursor: 'page-0', repliesHasMore: true } as never], commentRepliesLoading: {}, commentRepliesErrors: {} });
  try {
    await useZhihuStore.getState().loadCommentReplies('100');
    assert.equal(useZhihuStore.getState().comments[0].replies?.length, 8);
    assert.equal(useZhihuStore.getState().comments[0].repliesHasMore, true);
    await useZhihuStore.getState().loadCommentReplies('100');
    assert.equal(useZhihuStore.getState().comments[0].replies?.length, 10);
    assert.equal(useZhihuStore.getState().comments[0].repliesHasMore, false);
  } finally { globalThis.fetch = previousFetch; }
});

test('reply pagination follows the cursor even when the initial total is stale', async () => {
  const previousFetch = globalThis.fetch;
  const requests: string[] = [];
  globalThis.fetch = async input => {
    requests.push(String(input));
    return requests.length === 1
      ? Response.json({ items: Array.from({ length: 10 }, (_, i) => ({ id: String(i + 1), content: '回复' })), nextCursor: 'next-page', hasMore: true })
      : Response.json({ items: [{ id: '11', content: '新增回复' }], hasMore: false });
  };
  useZhihuStore.setState({ contentType: 'answer', contentId: '1', comments: [{ id: '100', replyCount: 3, repliesCursor: 'first-page', repliesHasMore: true } as never], commentRepliesLoading: {}, commentRepliesErrors: {} });
  try {
    await useZhihuStore.getState().loadCommentReplies('100');
    assert.equal(useZhihuStore.getState().comments[0].replies?.length, 10);
    assert.equal(useZhihuStore.getState().comments[0].repliesHasMore, true);
    await useZhihuStore.getState().loadCommentReplies('100');
    assert.equal(new URL(requests[1], 'http://localhost').searchParams.get('cursor'), 'next-page');
    assert.equal(useZhihuStore.getState().comments[0].replies?.length, 11);
    assert.equal(useZhihuStore.getState().comments[0].repliesHasMore, false);
    await useZhihuStore.getState().loadCommentReplies('100');
    assert.equal(requests.length, 2, 'one request per page and none after exhaustion');
  } finally { globalThis.fetch = previousFetch; }
});

test('reply loading locks concurrent clicks and preserves the cursor for a failed-page retry', async () => {
  const previousFetch = globalThis.fetch;
  let reject!: (error: Error) => void;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    if (calls === 1) return new Promise<Response>((_, fail) => { reject = fail; });
    return Response.json({ items: [{ id: '2', content: '回复' }], hasMore: false });
  };
  useZhihuStore.setState({ contentType: 'answer', contentId: '1', comments: [{ id: '100', replyCount: 1, repliesCursor: 'first-page', repliesHasMore: true } as never], commentRepliesLoading: {}, commentRepliesErrors: {} });
  try {
    const pending = useZhihuStore.getState().loadCommentReplies('100');
    await useZhihuStore.getState().loadCommentReplies('100');
    assert.equal(calls, 1);
    reject(new Error('network failure'));
    await pending;
    assert.equal(useZhihuStore.getState().comments[0].repliesCursor, 'first-page');
    assert.equal(useZhihuStore.getState().commentRepliesLoading['100'], false);
    assert.equal(useZhihuStore.getState().commentRepliesErrors['100'], 'network failure');
    await useZhihuStore.getState().loadCommentReplies('100');
    assert.equal(calls, 2);
    assert.equal(useZhihuStore.getState().comments[0].replies?.length, 1);
    assert.equal(useZhihuStore.getState().commentRepliesErrors['100'], '');
  } finally { globalThis.fetch = previousFetch; }
});

test('reply responses from an old reader cannot alter a new reader with the same comment ID', async () => {
  const previousFetch = globalThis.fetch;
  let finishOld!: (response: Response) => void;
  let finishNew!: (response: Response) => void;
  globalThis.fetch = async input => {
    const path = String(input);
    if (path.includes('/api/comment-replies?') && path.includes('contentId=1&')) return new Promise(resolve => { finishOld = resolve; });
    if (path.includes('/api/comment-replies?')) return new Promise(resolve => { finishNew = resolve; });
    if (path.includes('/api/detail?')) return Response.json({ id: '2', title: '新回答' });
    if (path.includes('/api/comments?')) return Response.json({ items: [{ id: '100', replyCount: 1, repliesHasMore: true }], hasMore: false });
    throw new Error(`Unexpected request: ${path}`);
  };
  useZhihuStore.setState({ contentType: 'answer', contentId: '1', comments: [{ id: '100', replyCount: 1, repliesHasMore: true } as never], commentRepliesLoading: {}, commentRepliesErrors: {} });
  try {
    const old = useZhihuStore.getState().loadCommentReplies('100');
    await useZhihuStore.getState().openContent('answer', '2');
    const current = useZhihuStore.getState().loadCommentReplies('100');
    finishOld(Response.json({ items: [{ id: 'old' }], hasMore: false }));
    await old;
    assert.equal(useZhihuStore.getState().comments[0].replies, undefined);
    assert.equal(useZhihuStore.getState().commentRepliesLoading['100'], true);
    finishNew(Response.json({ items: [{ id: 'new' }], hasMore: false }));
    await current;
    assert.equal(useZhihuStore.getState().comments[0].replies?.[0].id, 'new');
    assert.equal(useZhihuStore.getState().commentRepliesLoading['100'], false);
  } finally { globalThis.fetch = previousFetch; }
});

test('successful content opens report read with the opening account and do not wait for reporting', async () => {
  const previousFetch = globalThis.fetch;
  const previousWindow = globalThis.window;
  const dom = new JSDOM('', { url: 'http://localhost' });
  globalThis.window = dom.window as unknown as Window & typeof globalThis;
  dom.window.localStorage.setItem('zhihu-focus-cookie', 'd_c0=opening-account');
  let resolveReport!: (response: Response) => void;
  const pendingReport = new Promise<Response>(resolve => { resolveReport = resolve; });
  const reports: { path: string; init?: RequestInit }[] = [];
  const historyWrites: { path: string; init?: RequestInit }[] = [];
  globalThis.fetch = async (input, init) => {
    const path = String(input);
    if (path.startsWith('/api/read?')) { reports.push({ path, init }); return pendingReport; }
    if (path.startsWith('/api/history?')) { historyWrites.push({ path, init }); return Response.json({ success: true }); }
    if (path.startsWith('/api/detail?')) return Response.json({ id: '123', title: '正文' });
    if (path.startsWith('/api/comments?')) return Response.json({ items: [], hasMore: false });
    throw new Error(`Unexpected request: ${path}`);
  };
  try {
    await useZhihuStore.getState().openContent('answer', '123');
    assert.equal(useZhihuStore.getState().detail?.title, '正文');
    assert.equal(useZhihuStore.getState().detailLoading, false);
    assert.equal(reports.length, 1);
    assert.equal(reports[0].path, '/api/read?type=answer&id=123');
    assert.equal(reports[0].init?.method, 'POST');
    assert.equal(new Headers(reports[0].init?.headers).get('X-Zhihu-Cookie'), 'd_c0=opening-account');
    assert.equal(historyWrites.length, 1);
    assert.equal(historyWrites[0].path, '/api/history?type=answer&id=123');
    assert.equal(historyWrites[0].init?.method, 'POST');
    assert.equal(new Headers(historyWrites[0].init?.headers).get('X-Zhihu-Cookie'), 'd_c0=opening-account');
    resolveReport(Response.json({ success: true }));
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(useZhihuStore.getState().readingReportError, '');
  } finally { globalThis.fetch = previousFetch; globalThis.window = previousWindow; dom.window.close(); }
});

test('read reporting failure remains separate from readable content and retries on reopen', async () => {
  const previousFetch = globalThis.fetch;
  const previousWindow = globalThis.window;
  const dom = new JSDOM('', { url: 'http://localhost' });
  globalThis.window = dom.window as unknown as Window & typeof globalThis;
  dom.window.localStorage.setItem('zhihu-focus-cookie', 'd_c0=fixture');
  let reports = 0;
  globalThis.fetch = async input => {
    const path = String(input);
    if (path.startsWith('/api/read?')) {
      reports++;
      return reports === 1 ? Response.json({ error: '同步失败' }, { status: 502 }) : Response.json({ success: true });
    }
    if (path.startsWith('/api/history?')) return Response.json({ success: true });
    if (path.startsWith('/api/detail?')) return Response.json({ id: '456', title: '文章正文' });
    return Response.json({ items: [], hasMore: false });
  };
  try {
    await useZhihuStore.getState().openContent('article', '456');
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(useZhihuStore.getState().readingReportError, '同步失败');
    assert.equal(useZhihuStore.getState().detailError, '');
    assert.equal(useZhihuStore.getState().detail?.title, '文章正文');
    await useZhihuStore.getState().openContent('article', '456');
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(reports, 2);
    assert.equal(useZhihuStore.getState().readingReportError, '');
  } finally { globalThis.fetch = previousFetch; globalThis.window = previousWindow; dom.window.close(); }
});

test('failed, closed, superseded and changed-account detail loads never report read', async () => {
  const previousFetch = globalThis.fetch;
  const previousWindow = globalThis.window;
  const dom = new JSDOM('', { url: 'http://localhost' });
  globalThis.window = dom.window as unknown as Window & typeof globalThis;
  let reports = 0;
  let resolveDetail!: (response: Response) => void;
  globalThis.fetch = async input => {
    const path = String(input);
    if (path.startsWith('/api/read?') || path.startsWith('/api/history?')) { reports++; return Response.json({ success: true }); }
    if (path.startsWith('/api/detail?')) return new Promise<Response>(resolve => { resolveDetail = resolve; });
    return Response.json({ items: [], hasMore: false });
  };
  try {
    for (const scenario of ['failed', 'closed', 'superseded', 'changed-account', 'no-cookie']) {
      dom.window.localStorage.setItem('zhihu-focus-cookie', scenario === 'no-cookie' ? '' : 'd_c0=fixture');
      const task = useZhihuStore.getState().openContent('answer', '123');
      const finishOld = resolveDetail;
      let nextTask: Promise<void> | undefined;
      if (scenario === 'closed') useZhihuStore.getState().closeDrawer();
      if (scenario === 'changed-account') dom.window.localStorage.setItem('zhihu-focus-cookie', 'd_c0=other');
      if (scenario === 'superseded') nextTask = useZhihuStore.getState().openContent('article', '456');
      finishOld(scenario === 'failed' ? Response.json({ error: '正文失败' }, { status: 502 }) : Response.json({ id: '123' }));
      await task;
      if (nextTask) { resolveDetail(Response.json({ error: '正文失败' }, { status: 502 })); await nextTask; }
      await new Promise(resolve => setTimeout(resolve, 0));
      assert.equal(reports, 0, scenario);
    }
  } finally { globalThis.fetch = previousFetch; globalThis.window = previousWindow; dom.window.close(); }
});

test('a delayed report failure cannot alter a newer drawer', async () => {
  const previousFetch = globalThis.fetch;
  const previousWindow = globalThis.window;
  const dom = new JSDOM('', { url: 'http://localhost' });
  globalThis.window = dom.window as unknown as Window & typeof globalThis;
  dom.window.localStorage.setItem('zhihu-focus-cookie', 'd_c0=fixture');
  let finishOldReport!: (response: Response) => void;
  const pending = new Promise<Response>(resolve => { finishOldReport = resolve; });
  globalThis.fetch = async input => {
    const path = String(input);
    if (path === '/api/read?type=answer&id=1') return pending;
    if (path.startsWith('/api/read?')) return Response.json({ success: true });
    if (path.startsWith('/api/history?')) return Response.json({ success: true });
    if (path.startsWith('/api/detail?')) return Response.json({ id: path.endsWith('id=1') ? '1' : '2' });
    return Response.json({ items: [], hasMore: false });
  };
  try {
    await useZhihuStore.getState().openContent('answer', '1');
    await useZhihuStore.getState().openContent('answer', '2');
    finishOldReport(Response.json({ error: '旧上报失败' }, { status: 502 }));
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(useZhihuStore.getState().contentId, '2');
    assert.equal(useZhihuStore.getState().readingReportError, '');
  } finally { globalThis.fetch = previousFetch; globalThis.window = previousWindow; dom.window.close(); }
});

test('history writes are independent of read reports, retry after failure, and notify after success', async () => {
  const previousFetch = globalThis.fetch;
  const previousWindow = globalThis.window;
  const dom = new JSDOM('', { url: 'http://localhost' });
  globalThis.window = dom.window as unknown as Window & typeof globalThis;
  dom.window.localStorage.setItem('zhihu-focus-cookie', 'd_c0=fixture');
  let writes = 0, notifications = 0;
  dom.window.addEventListener('zhihu-focus-history-changed', () => { notifications++; });
  globalThis.fetch = async input => {
    const path = String(input);
    if (path.startsWith('/api/history?')) {
      writes++;
      return writes === 1 ? Response.json({ error: '保存失败' }, { status: 502 }) : Response.json({ success: true });
    }
    if (path.startsWith('/api/read?')) return Response.json({ error: '已读失败' }, { status: 502 });
    if (path.startsWith('/api/detail?')) return Response.json({ id: '123', title: '正文' });
    return Response.json({ items: [], hasMore: false });
  };
  try {
    await useZhihuStore.getState().openContent('answer', '123');
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(useZhihuStore.getState().detail?.title, '正文');
    assert.equal(useZhihuStore.getState().detailError, '');
    assert.equal(useZhihuStore.getState().readingReportError, '已读失败');
    assert.equal(useZhihuStore.getState().historyWriteError, '保存失败');
    assert.equal(notifications, 0);
    await useZhihuStore.getState().openContent('answer', '123');
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(writes, 2);
    assert.equal(useZhihuStore.getState().historyWriteError, '');
    assert.equal(notifications, 1);
  } finally { globalThis.fetch = previousFetch; globalThis.window = previousWindow; dom.window.close(); }
});

test('a delayed history write cannot pollute a new drawer or refresh another account', async () => {
  const previousFetch = globalThis.fetch;
  const previousWindow = globalThis.window;
  const dom = new JSDOM('', { url: 'http://localhost' });
  globalThis.window = dom.window as unknown as Window & typeof globalThis;
  dom.window.localStorage.setItem('zhihu-focus-cookie', 'd_c0=first');
  let finish!: (response: Response) => void;
  const pending = new Promise<Response>(resolve => { finish = resolve; });
  let notifications = 0;
  dom.window.addEventListener('zhihu-focus-history-changed', () => { notifications++; });
  globalThis.fetch = async input => {
    const path = String(input);
    if (path.startsWith('/api/history?')) return path.endsWith('id=1') ? pending : Response.json({ success: true });
    if (path.startsWith('/api/read?')) return Response.json({ success: true });
    if (path.startsWith('/api/detail?')) return Response.json({ id: '2' });
    return Response.json({ items: [], hasMore: false });
  };
  try {
    await useZhihuStore.getState().openContent('answer', '1');
    dom.window.localStorage.setItem('zhihu-focus-cookie', 'd_c0=second');
    await useZhihuStore.getState().openContent('answer', '2');
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(notifications, 1);
    finish(Response.json({ error: '旧历史保存失败' }, { status: 502 }));
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(useZhihuStore.getState().historyWriteError, '');
    assert.equal(notifications, 1);
  } finally { globalThis.fetch = previousFetch; globalThis.window = previousWindow; dom.window.close(); }
});

test('failed refresh does not leave the previous account feed or cursor visible', async () => {
  const previousFetch = globalThis.fetch;
  useZhihuStore.setState({ feed: [item('answer', '1')], feedCursor: 'old-cursor', feedHasMore: true, feedSource: 'recommendation', feedLoading: false });
  globalThis.fetch = async () => new Response(JSON.stringify({ error: '请求失败' }), { status: 502 });
  try {
    await useZhihuStore.getState().refreshFeed();
    const state = useZhihuStore.getState();
    assert.deepEqual(state.feed, []);
    assert.equal(state.feedCursor, '');
    assert.equal(state.feedHasMore, false);
    assert.equal(state.feedError, '请求失败');
  } finally { globalThis.fetch = previousFetch; }
});

test('feed pagination keeps items of different kinds with the same ID', async () => {
  const previousFetch = globalThis.fetch;
  useZhihuStore.setState({ feed: [item('answer', '1')], feedCursor: 'next', feedHasMore: true, feedLoading: false, feedMoreLoading: false });
  globalThis.fetch = async () => new Response(JSON.stringify({ items: [item('article', '1')], hasMore: false }), { status: 200 });
  try {
    await useZhihuStore.getState().loadMoreFeed();
    assert.deepEqual(useZhihuStore.getState().feed.map(({ kind, id }) => `${kind}:${id}`), ['answer:1', 'article:1']);
  } finally { globalThis.fetch = previousFetch; }
});

test('a previous comment-page failure cannot alter the new drawer or its loading state', async () => {
  const previousFetch = globalThis.fetch;
  let rejectOld!: (error: Error) => void;
  let resolveNew!: (response: Response) => void;
  const oldPage = new Promise<Response>((_, reject) => { rejectOld = reject; });
  const newPage = new Promise<Response>(resolve => { resolveNew = resolve; });
  useZhihuStore.setState({ drawerOpen: true, contentType: 'answer', contentId: '1', comments: [], commentsCursor: 'old', commentsHasMore: true, commentsMoreLoading: false });
  globalThis.fetch = async input => {
    const path = String(input);
    if (path.includes('/api/comments?type=answer&id=1&cursor=')) return oldPage;
    if (path.includes('/api/comments?type=answer&id=2&cursor=')) return newPage;
    if (path.includes('/api/comments?type=answer&id=2')) return new Response(JSON.stringify({ items: [], nextCursor: 'new', hasMore: true }));
    if (path.includes('/api/detail?type=answer&id=2')) return new Response(JSON.stringify({ id: '2', title: '新回答', content: '', author: '', avatar: '', createdAt: '', voteUpCount: 0, commentCount: 0, url: '' }));
    throw new Error(`Unexpected request: ${path}`);
  };
  try {
    const oldRequest = useZhihuStore.getState().loadMoreComments();
    await useZhihuStore.getState().openContent('answer', '2');
    const newRequest = useZhihuStore.getState().loadMoreComments();
    assert.equal(useZhihuStore.getState().commentsMoreLoading, true);
    rejectOld(new Error('旧评论失败'));
    await oldRequest;
    assert.equal(useZhihuStore.getState().commentsError, '');
    assert.equal(useZhihuStore.getState().commentsMoreLoading, true);
    resolveNew(new Response(JSON.stringify({ items: [], hasMore: false })));
    await newRequest;
    assert.equal(useZhihuStore.getState().commentsMoreLoading, false);
    assert.equal(useZhihuStore.getState().contentId, '2');
  } finally { globalThis.fetch = previousFetch; }
});

test('a previous question-page failure cannot alter the new question pagination', async () => {
  const previousFetch = globalThis.fetch;
  let rejectOld!: (error: Error) => void;
  let resolveNew!: (response: Response) => void;
  const oldPage = new Promise<Response>((_, reject) => { rejectOld = reject; });
  const newPage = new Promise<Response>(resolve => { resolveNew = resolve; });
  useZhihuStore.setState({ questionId: '1', question: { id: '1' } as NonNullable<ReturnType<typeof useZhihuStore.getState>['question']>, questionAnswers: [], questionAnswersCursor: 'old', questionAnswersHasMore: true, questionAnswersMoreLoading: false });
  globalThis.fetch = async input => {
    const path = String(input);
    if (path.includes('/api/question/answers?id=1&cursor=')) return oldPage;
    if (path.includes('/api/question/answers?id=2&cursor=')) return newPage;
    if (path.includes('/api/question/answers?id=2')) return new Response(JSON.stringify({ items: [], nextCursor: 'new', hasMore: true }));
    if (path.includes('/api/question?id=2')) return new Response(JSON.stringify({ id: '2' }));
    throw new Error(`Unexpected request: ${path}`);
  };
  try {
    const oldRequest = useZhihuStore.getState().loadMoreQuestionAnswers();
    await useZhihuStore.getState().loadQuestion('2');
    const newRequest = useZhihuStore.getState().loadMoreQuestionAnswers();
    rejectOld(new Error('旧问题加载失败'));
    await oldRequest;
    assert.equal(useZhihuStore.getState().questionAnswersError, '');
    assert.equal(useZhihuStore.getState().questionAnswersMoreLoading, true);
    resolveNew(new Response(JSON.stringify({ items: [], hasMore: false })));
    await newRequest;
    assert.equal(useZhihuStore.getState().questionAnswersMoreLoading, false);
    assert.equal(useZhihuStore.getState().question?.id, '2');
  } finally { globalThis.fetch = previousFetch; }
});
