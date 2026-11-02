import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { useHistoryStore } from '../src/store/useHistoryStore';

const entry = (id: string, kind = 'answer') => ({ id, kind, title: '历史标题', excerpt: '', author: '', time: '', url: `https://www.zhihu.com/answer/${id}` });

async function withBrowser(run: (dom: JSDOM) => Promise<void>) {
  const previousWindow = globalThis.window;
  const previousFetch = globalThis.fetch;
  const dom = new JSDOM('', { url: 'http://localhost/history' });
  globalThis.window = dom.window as unknown as Window & typeof globalThis;
  useHistoryStore.getState().reset();
  try { await run(dom); }
  finally { useHistoryStore.getState().reset(); globalThis.window = previousWindow; globalThis.fetch = previousFetch; dom.window.close(); }
}

test('history requires a Cookie and never persists private records', async () => withBrowser(async dom => {
  globalThis.fetch = async () => { throw new Error('must not request without Cookie'); };
  await useHistoryStore.getState().refresh();
  assert.match(useHistoryStore.getState().error, /Cookie/);
  dom.window.localStorage.setItem('zhihu-focus-cookie', 'd_c0=fixture');
  globalThis.fetch = async (_, init) => {
    assert.equal(init?.cache, 'no-store');
    assert.equal(new Headers(init?.headers).get('X-Zhihu-Cookie'), 'd_c0=fixture');
    return Response.json({ items: [entry('1')], hasMore: false });
  };
  await useHistoryStore.getState().refresh();
  assert.equal(useHistoryStore.getState().items.length, 1);
  assert.equal(dom.window.localStorage.length, 1);
  useHistoryStore.getState().reset();
  assert.deepEqual(useHistoryStore.getState().items, []);
}));

test('history pagination deduplicates by type and ID and preserves records for retry', async () => withBrowser(async dom => {
  dom.window.localStorage.setItem('zhihu-focus-cookie', 'd_c0=fixture');
  let requests = 0;
  globalThis.fetch = async input => {
    requests++;
    if (requests === 1) return Response.json({ items: [entry('1'), entry('1')], nextCursor: 'next', hasMore: true });
    assert.equal(String(input), '/api/history?cursor=next');
    if (requests === 2) return Response.json({ error: '分页失败' }, { status: 502 });
    return Response.json({ items: [entry('1'), entry('1', 'article'), entry('2')], hasMore: false });
  };
  await useHistoryStore.getState().refresh();
  await useHistoryStore.getState().loadMore();
  assert.equal(useHistoryStore.getState().error, '分页失败');
  assert.equal(useHistoryStore.getState().items.length, 1);
  assert.equal(useHistoryStore.getState().cursor, 'next');
  await useHistoryStore.getState().loadMore();
  assert.deepEqual(useHistoryStore.getState().items.map(x => `${x.kind}:${x.id}`), ['answer:1', 'article:1', 'answer:2']);
  assert.equal(useHistoryStore.getState().hasMore, false);
}));

test('switching accounts clears history immediately and ignores the old response', async () => withBrowser(async dom => {
  dom.window.localStorage.setItem('zhihu-focus-cookie', 'd_c0=old');
  let finishOld!: (response: Response) => void;
  globalThis.fetch = async (_, init) => new Headers(init?.headers).get('X-Zhihu-Cookie') === 'd_c0=old'
    ? new Promise(resolve => { finishOld = resolve; }) : Response.json({ items: [entry('new')], hasMore: false });
  useHistoryStore.setState({ items: [entry('previous')] });
  const old = useHistoryStore.getState().refresh();
  assert.deepEqual(useHistoryStore.getState().items, []);
  dom.window.localStorage.setItem('zhihu-focus-cookie', 'd_c0=new');
  await useHistoryStore.getState().refresh();
  finishOld(Response.json({ items: [entry('old')], hasMore: false }));
  await old;
  assert.equal(useHistoryStore.getState().items[0].id, 'new');
  dom.window.localStorage.clear();
  await useHistoryStore.getState().refresh();
  assert.deepEqual(useHistoryStore.getState().items, []);
}));

test('reset invalidates pending history pages and repeated cursors stop loading', async () => withBrowser(async dom => {
  dom.window.localStorage.setItem('zhihu-focus-cookie', 'd_c0=fixture');
  globalThis.fetch = async () => Response.json({ items: [entry('1')], nextCursor: 'next', hasMore: true });
  await useHistoryStore.getState().refresh();
  await useHistoryStore.getState().loadMore();
  assert.equal(useHistoryStore.getState().hasMore, false);
  let finish!: (response: Response) => void;
  globalThis.fetch = async () => new Promise(resolve => { finish = resolve; });
  const pending = useHistoryStore.getState().refresh();
  useHistoryStore.getState().reset();
  finish(Response.json({ items: [entry('stale')], hasMore: false }));
  await pending;
  assert.deepEqual(useHistoryStore.getState().items, []);
}));

test('refresh after a history write does not reuse an earlier pending history read', async () => withBrowser(async dom => {
  dom.window.localStorage.setItem('zhihu-focus-cookie', 'd_c0=fixture');
  let finishOld!: (response: Response) => void;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    if (calls === 1) return new Promise(resolve => { finishOld = resolve; });
    return Response.json({ items: [entry('newly-saved')], hasMore: false });
  };
  const old = useHistoryStore.getState().refresh();
  await useHistoryStore.getState().refresh();
  assert.equal(calls, 2);
  finishOld(Response.json({ items: [], hasMore: false }));
  await old;
  assert.equal(useHistoryStore.getState().items[0].id, 'newly-saved');
}));

test('ensureLoaded reuses cached and pending results until credentials change or refresh is requested', async () => withBrowser(async dom => {
  dom.window.localStorage.setItem('zhihu-focus-cookie', 'd_c0=fixture');
  let finish!: (response: Response) => void;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Promise(resolve => { finish = resolve; }); };
  const first = useHistoryStore.getState().ensureLoaded();
  await useHistoryStore.getState().ensureLoaded();
  assert.equal(calls, 1, 'pending initialization is shared across remounts');
  finish(Response.json({ items: [entry('cached')], nextCursor: 'next', hasMore: true }));
  await first;
  useHistoryStore.getState().setScrollY(420);
  await useHistoryStore.getState().ensureLoaded();
  assert.equal(calls, 1);
  assert.equal(useHistoryStore.getState().cursor, 'next');
  assert.equal(useHistoryStore.getState().scrollY, 420);
  dom.window.localStorage.setItem('zhihu-focus-cookie', 'd_c0=other');
  useHistoryStore.getState().syncCookie();
  assert.deepEqual(useHistoryStore.getState().items, []);
  assert.equal(useHistoryStore.getState().scrollY, 0);
  const changed = useHistoryStore.getState().ensureLoaded();
  assert.equal(calls, 2);
  finish(Response.json({ items: [], hasMore: false }));
  await changed;
  await useHistoryStore.getState().ensureLoaded();
  assert.equal(calls, 2, 'an empty history page is cached too');
}));

test('confirmed writes update cached history without losing pagination or racing an older refresh', async () => withBrowser(async dom => {
  dom.window.localStorage.setItem('zhihu-focus-cookie', 'd_c0=fixture');
  let finish!: (response: Response) => void;
  globalThis.fetch = async () => new Promise(resolve => { finish = resolve; });
  const pending = useHistoryStore.getState().ensureLoaded();
  useHistoryStore.getState().recordSaved('d_c0=fixture', entry('new'));
  finish(Response.json({ items: [entry('old')], nextCursor: 'next', hasMore: true }));
  await pending;
  assert.deepEqual(useHistoryStore.getState().items.map(x => x.id), ['new', 'old']);
  useHistoryStore.getState().setScrollY(420);
  useHistoryStore.getState().recordSaved('d_c0=fixture', { ...entry('old'), title: '重新读过' });
  assert.deepEqual(useHistoryStore.getState().items.map(x => x.id), ['old', 'new']);
  assert.equal(useHistoryStore.getState().cursor, 'next');
  assert.equal(useHistoryStore.getState().scrollY, 420);
  useHistoryStore.getState().recordSaved('d_c0=other', entry('other-account'));
  assert.equal(useHistoryStore.getState().items.length, 2);
}));
