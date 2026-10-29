import assert from 'node:assert/strict';
import test from 'node:test';
import { useZhihuStore } from '../src/store/useZhihuStore';
import type { FeedItem } from '../src/models/content';

function item(kind: FeedItem['kind'], id: string): FeedItem {
  return { id, kind, title: '标题', category: '推荐', excerpt: '', author: '作者', stats: '', time: '', url: '' };
}

test('failed refresh does not leave the previous account feed or cursor visible', async () => {
  const previousFetch = globalThis.fetch;
  useZhihuStore.setState({ feed: [item('回答', '1')], feedCursor: 'old-cursor', feedHasMore: true, feedSource: 'recommendation', feedLoading: false });
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
  useZhihuStore.setState({ feed: [item('回答', '1')], feedCursor: 'next', feedHasMore: true, feedLoading: false, feedMoreLoading: false });
  globalThis.fetch = async () => new Response(JSON.stringify({ items: [item('文章', '1')], hasMore: false }), { status: 200 });
  try {
    await useZhihuStore.getState().loadMoreFeed();
    assert.deepEqual(useZhihuStore.getState().feed.map(({ kind, id }) => `${kind}:${id}`), ['回答:1', '文章:1']);
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
  useZhihuStore.setState({ question: { id: '1' } as NonNullable<ReturnType<typeof useZhihuStore.getState>['question']>, questionAnswers: [], questionAnswersCursor: 'old', questionAnswersHasMore: true, questionAnswersMoreLoading: false });
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
